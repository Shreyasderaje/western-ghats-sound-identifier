"""Western Ghats Sound Identifier — Flask backend.

Endpoints
---------
GET  /api/health                          service + model status
GET  /api/species                         species reference list
POST /api/auth/register                   create account -> token
POST /api/auth/login                      login -> token
GET  /api/auth/me                         current user (requires token)
POST /api/audio/upload                    upload a recording -> file_id
POST /api/process/{file_id}               start async analysis (optional threshold)
GET  /api/process/{file_id}/status        job status (results when completed)
GET  /api/results/{file_id}               full detection results
GET  /api/spectrogram/{file_id}           annotated spectrogram PNG
POST /api/reports/{file_id}/pdf           generate + download PDF report
POST /api/reports/{file_id}/csv           generate + download CSV export
GET  /api/recordings                      recording history (paginated)
DELETE /api/recordings/{file_id}          delete recording and its artifacts
POST /api/recordings/{file_id}/share      toggle public sharing
GET  /api/analytics/summary               aggregate statistics
GET  /api/analytics/top-species           most-detected species
GET  /api/analytics/trends                detections per day (last 30 days)
GET  /api/public/recordings               community feed (public recordings)
GET  /api/public/recordings/{file_id}     read-only public results
GET  /api/community/leaderboard           top contributors

Run locally:  python app.py   (serves on http://localhost:5000)
"""
import logging
import threading
import uuid
from datetime import timedelta
from pathlib import Path

from flask import Flask, abort, g, jsonify, request, send_file
from flask_cors import CORS
from sqlalchemy import func as sa_func, desc as sa_desc
from werkzeug.utils import secure_filename

import auth as auth_module
import ml_inference
import report_generator
from audio_processor import (
    QUALITY_CONFIDENCE_FACTOR,
    assess_audio_quality,
    generate_spectrogram,
    load_audio,
    validate_audio,
)
from auth import optional_auth, require_auth
from config import Config
from ml_inference import ModelUnavailableError, classifier
from models import AudioRecording, Detection, ProcessingJob, SpeciesReference, User, db, utcnow

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)
    CORS(app, resources={r"/api/*": {"origins": "*"}})  # React dev server access

    db.init_app(app)

    for folder in (
        app.config["UPLOAD_FOLDER"],
        app.config["SPECTROGRAM_FOLDER"],
        app.config["REPORT_FOLDER"],
    ):
        Path(folder).mkdir(parents=True, exist_ok=True)

    register_error_handlers(app)
    register_routes(app)

    with app.app_context():
        db.create_all()  # convenient for local dev; migrations come later

    return app


def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(err):
        return jsonify(error=str(err.description)), 400

    @app.errorhandler(401)
    def unauthorized(err):
        return jsonify(error=str(err.description)), 401

    @app.errorhandler(404)
    def not_found(err):
        return jsonify(error=str(err.description)), 404

    @app.errorhandler(409)
    def conflict(err):
        return jsonify(error=str(err.description)), 409

    @app.errorhandler(413)
    def payload_too_large(err):
        max_mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return (
            jsonify(error=f"File too large. Maximum upload size is {max_mb} MB."),
            413,
        )

    @app.errorhandler(500)
    def server_error(err):
        logger.exception("Unhandled server error")
        return jsonify(error="Internal server error."), 500


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def register_routes(app):
    @app.get("/api/health")
    def health():
        return jsonify(
            status="ok",
            service="western-ghats-sound-identifier",
            model=classifier.status,
        )

    @app.get("/api/species")
    def list_species():
        species = SpeciesReference.query.order_by(
            SpeciesReference.category, SpeciesReference.common_name
        ).all()
        return jsonify(species=[s.to_dict() for s in species], count=len(species))

    # -- Auth ---------------------------------------------------------------

    @app.post("/api/auth/register")
    def auth_register():
        body = request.get_json(silent=True) or {}
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        if not (3 <= len(username) <= 40) or not username.replace("_", "").isalnum():
            return jsonify(
                error="Username must be 3-40 characters (letters, numbers, underscores)."
            ), 400
        if len(password) < 6:
            return jsonify(error="Password must be at least 6 characters."), 400
        if User.query.filter_by(username=username).first():
            return jsonify(error="That username is already taken."), 409

        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return jsonify(token=auth_module.issue_token(user), user=user.to_dict()), 201

    @app.post("/api/auth/login")
    def auth_login():
        body = request.get_json(silent=True) or {}
        user = User.query.filter_by(
            username=(body.get("username") or "").strip()
        ).first()
        if user is None or not user.check_password(body.get("password") or ""):
            return jsonify(error="Invalid username or password."), 401
        return jsonify(token=auth_module.issue_token(user), user=user.to_dict())

    @app.get("/api/auth/me")
    @require_auth
    def auth_me():
        return jsonify(user=g.user.to_dict())

    # -- Upload / process / results ------------------------------------------

    @app.post("/api/audio/upload")
    @optional_auth
    def upload_audio():
        if "file" not in request.files:
            return jsonify(error="No file part in the request. Use form-data key 'file'."), 400
        uploaded = request.files["file"]
        if not uploaded.filename:
            return jsonify(error="No file selected."), 400

        original_name = secure_filename(uploaded.filename)
        extension = Path(original_name).suffix.lower()
        if extension not in app.config["ALLOWED_EXTENSIONS"]:
            allowed = ", ".join(sorted(app.config["ALLOWED_EXTENSIONS"]))
            return jsonify(error=f"Unsupported format '{extension}'. Allowed: {allowed}."), 400

        latitude, longitude = _parse_coordinates(request.form)
        file_id = uuid.uuid4().hex
        saved_path = Path(app.config["UPLOAD_FOLDER"]) / f"{file_id}{extension}"
        uploaded.save(saved_path)
        logger.info("Saved upload %s -> %s", original_name, saved_path)

        metadata = validate_audio(saved_path)
        recording = AudioRecording(
            id=file_id,
            filename=original_name,
            location=request.form.get("location") or None,
            latitude=latitude,
            longitude=longitude,
            duration=metadata.get("duration"),
            sample_rate=metadata.get("sample_rate"),
            file_path=str(saved_path),
            user_id=getattr(g, "user", None).id if getattr(g, "user", None) else None,
        )
        db.session.add(recording)
        db.session.commit()

        return jsonify(recording.to_dict()), 201

    @app.post("/api/process/<file_id>")
    def process(file_id):
        recording = _get_recording_or_404(file_id)

        active = ProcessingJob.query.filter_by(
            recording_id=file_id, status="processing"
        ).first()
        if active:
            return jsonify(error="A processing job is already running for this file."), 409

        body = request.get_json(silent=True) or {}
        threshold = body.get("confidence_threshold")
        if threshold is not None and not (0.0 < float(threshold) <= 1.0):
            return jsonify(error="confidence_threshold must be between 0 and 1."), 400

        job = ProcessingJob(recording_id=file_id, status="in_queue", confidence_threshold=threshold)
        db.session.add(job)
        db.session.commit()

        # Background thread keeps the HTTP worker free; Celery can replace
        # this in the batch-processing phase without changing the API.
        thread = threading.Thread(
            target=_run_processing,
            args=(app, job.id),
            daemon=True,
            name=f"process-{file_id}",
        )
        thread.start()

        return jsonify(job.to_dict()), 202

    @app.get("/api/process/<file_id>/status")
    def process_status(file_id):
        _get_recording_or_404(file_id)
        job = (
            ProcessingJob.query.filter_by(recording_id=file_id)
            .order_by(ProcessingJob.id.desc())
            .first()
        )
        if job is None:
            return jsonify(error="No processing job found for this file."), 404

        payload = job.to_dict()
        if job.status == "completed":
            payload["results"] = _results_payload(job.recording)
        return jsonify(payload)

    @app.get("/api/results/<file_id>")
    def results(file_id):
        recording = _get_recording_or_404(file_id)
        job = (
            ProcessingJob.query.filter_by(recording_id=file_id)
            .order_by(ProcessingJob.id.desc())
            .first()
        )
        status = job.status if job else "not_started"
        return jsonify(status=status, results=_results_payload(recording))

    @app.get("/api/spectrogram/<file_id>")
    def spectrogram(file_id):
        recording = _get_recording_or_404(file_id)
        png_path = Path(app.config["SPECTROGRAM_FOLDER"]) / f"{recording.id}.png"
        if not png_path.exists():
            return jsonify(error="Spectrogram not generated yet."), 404
        return send_file(png_path, mimetype="image/png")

    # -- Reports ---------------------------------------------------------------

    @app.post("/api/reports/<file_id>/pdf")
    def pdf_report(file_id):
        recording = _get_recording_or_404(file_id)
        detections = [d.to_dict() for d in recording.detections]
        if not detections:
            return jsonify(error="Nothing to report yet — process the recording first."), 409

        spectrogram_path = Path(app.config["SPECTROGRAM_FOLDER"]) / f"{recording.id}.png"
        output_path = Path(app.config["REPORT_FOLDER"]) / f"{recording.id}_report.pdf"
        report_generator.generate_pdf_report(
            recording.to_dict(), detections, spectrogram_path, output_path
        )
        download_name = f"biodiversity_report_{Path(recording.filename).stem}.pdf"
        return send_file(output_path, mimetype="application/pdf", as_attachment=True,
                         download_name=download_name)

    @app.post("/api/reports/<file_id>/csv")
    def csv_report(file_id):
        recording = _get_recording_or_404(file_id)
        detections = [d.to_dict() for d in recording.detections]
        if not detections:
            return jsonify(error="Nothing to export yet — process the recording first."), 409

        output_path = Path(app.config["REPORT_FOLDER"]) / f"{recording.id}_detections.csv"
        report_generator.generate_csv_report(
            recording.to_dict(), detections, output_path
        )
        download_name = f"detections_{Path(recording.filename).stem}.csv"
        return send_file(output_path, mimetype="text/csv", as_attachment=True,
                         download_name=download_name)

    # -- History / sharing -------------------------------------------------------

    @app.get("/api/recordings")
    @optional_auth
    def recordings():
        """Authenticated users see their own uploads; anonymous users see all
        un-owned recordings (local single-user mode)."""
        page = max(int(request.args.get("page", 1)), 1)
        per_page = min(int(request.args.get("per_page", 10)), 100)
        query = AudioRecording.query.order_by(AudioRecording.upload_date.desc())
        if getattr(g, "user", None):
            query = query.filter(AudioRecording.user_id == g.user.id)
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        items = []
        for recording in pagination.items:
            entry = recording.to_dict()
            entry["species_count"] = len({d.species_name for d in recording.detections})
            entry["detection_count"] = len(recording.detections)
            latest_job = (
                ProcessingJob.query.filter_by(recording_id=recording.id)
                .order_by(ProcessingJob.id.desc())
                .first()
            )
            entry["status"] = latest_job.status if latest_job else "not_started"
            items.append(entry)

        return jsonify(
            recordings=items,
            page=pagination.page,
            total_pages=pagination.pages,
            total=pagination.total,
        )

    @app.delete("/api/recordings/<file_id>")
    def delete_recording(file_id):
        recording = _get_recording_or_404(file_id)
        for artifact in (
            Path(recording.file_path),
            Path(app.config["SPECTROGRAM_FOLDER"]) / f"{recording.id}.png",
            Path(app.config["REPORT_FOLDER"]) / f"{recording.id}_report.pdf",
            Path(app.config["REPORT_FOLDER"]) / f"{recording.id}_detections.csv",
        ):
            artifact.unlink(missing_ok=True)
        db.session.delete(recording)
        db.session.commit()
        return jsonify(deleted=file_id)

    @app.post("/api/recordings/<file_id>/share")
    def toggle_share(file_id):
        recording = _get_recording_or_404(file_id)
        body = request.get_json(silent=True) or {}
        recording.is_public = bool(body.get("is_public", not recording.is_public))
        db.session.commit()
        return jsonify(file_id=recording.id, is_public=recording.is_public)

    # -- Analytics -----------------------------------------------------------

    @app.get("/api/analytics/summary")
    @optional_auth
    def analytics_summary():
        query = _scoped_recordings()
        total_recordings = query.count()
        detections = Detection.query.join(
            AudioRecording, Detection.recording_id == AudioRecording.id
        ).filter(AudioRecording.id.in_([r.id for r in query.all()]))

        unique_species = detections.with_entities(
            sa_func.count(sa_func.distinct(Detection.species_name))
        ).scalar() or 0
        total_detections = detections.count()

        week_ago = utcnow() - timedelta(days=7)
        recent = query.filter(AudioRecording.upload_date >= week_ago).count()

        avg_species = round(unique_species / total_recordings, 2) if total_recordings else 0
        return jsonify(
            total_recordings=total_recordings,
            total_detections=total_detections,
            unique_species=unique_species,
            avg_species_per_recording=avg_species,
            recordings_this_week=recent,
        )

    @app.get("/api/analytics/top-species")
    @optional_auth
    def analytics_top_species():
        limit = min(int(request.args.get("limit", 10)), 50)
        rows = (
            db.session.query(
                Detection.species_name,
                sa_func.count(Detection.id).label("count"),
            )
            .join(AudioRecording, Detection.recording_id == AudioRecording.id)
            .filter(AudioRecording.id.in_([r.id for r in _scoped_recordings().all()]))
            .group_by(Detection.species_name)
            .order_by(sa_desc(sa_func.count(Detection.id)))
            .limit(limit)
            .all()
        )
        return jsonify(
            species=[
                {"species_name": name, "count": count} for name, count in rows
            ]
        )

    @app.get("/api/analytics/trends")
    @optional_auth
    def analytics_trends():
        rows = (
            db.session.query(
                sa_func.date(AudioRecording.upload_date).label("day"),
                sa_func.count(Detection.id).label("detections"),
                sa_func.count(sa_func.distinct(Detection.species_name)).label("species"),
            )
            .join(Detection, Detection.recording_id == AudioRecording.id)
            .filter(AudioRecording.id.in_([r.id for r in _scoped_recordings().all()]))
            .group_by(sa_func.date(AudioRecording.upload_date))
            .order_by(sa_func.date(AudioRecording.upload_date))
            .all()
        )
        return jsonify(
            trends=[
                {"date": str(day), "detections": int(d), "species": int(s)}
                for day, d, s in rows
            ]
        )

    # -- Community -----------------------------------------------------------

    @app.get("/api/public/recordings")
    def public_recordings():
        page = max(int(request.args.get("page", 1)), 1)
        per_page = min(int(request.args.get("per_page", 12)), 50)
        pagination = (
            AudioRecording.query.filter_by(is_public=True)
            .order_by(AudioRecording.upload_date.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )
        items = []
        for recording in pagination.items:
            entry = recording.to_dict()
            entry["species_count"] = len({d.species_name for d in recording.detections})
            entry["detection_count"] = len(recording.detections)
            items.append(entry)
        return jsonify(recordings=items, total=pagination.total,
                       page=pagination.page, total_pages=pagination.pages)

    @app.get("/api/public/recordings/<file_id>")
    def public_recording(file_id):
        recording = _get_recording_or_404(file_id)
        if not recording.is_public:
            return jsonify(error="This recording is not shared publicly."), 404
        return jsonify(status="shared", results=_results_payload(recording))

    @app.get("/api/community/leaderboard")
    def leaderboard():
        rows = (
            db.session.query(
                User.username,
                sa_func.count(AudioRecording.id).label("recordings"),
            )
            .join(AudioRecording, AudioRecording.user_id == User.id)
            .group_by(User.username)
            .order_by(sa_desc(sa_func.count(AudioRecording.id)))
            .limit(10)
            .all()
        )
        return jsonify(leaderboard=[
            {"username": name, "recordings": count} for name, count in rows
        ])


# ---------------------------------------------------------------------------
# Processing pipeline
# ---------------------------------------------------------------------------

def _run_processing(flask_app, job_id):
    """Background worker: decode -> quality check -> detect -> store -> spectrogram."""
    with flask_app.app_context():
        job = db.session.get(ProcessingJob, job_id)
        recording = job.recording
        job.status = "processing"
        db.session.commit()
        logger.info("Processing started for %s (%s)", recording.id, recording.filename)

        try:
            waveform = load_audio(recording.file_path)
            recording.duration = round(waveform.shape[0] / Config.TARGET_SAMPLE_RATE, 2)
            recording.sample_rate = Config.TARGET_SAMPLE_RATE

            quality = assess_audio_quality(waveform, Config.TARGET_SAMPLE_RATE)
            recording.quality_score = quality["score"]
            recording.quality_label = quality["label"]

            raw_detections = classifier.detect(
                waveform,
                Config.TARGET_SAMPLE_RATE,
                threshold=job.confidence_threshold,
            )

            # Confidence adjustment by recording quality (plan Step 4.3).
            factor = QUALITY_CONFIDENCE_FACTOR.get(quality["label"], 1.0)
            for det in raw_detections:
                det["confidence"] = min(det["confidence"] * factor, 0.99)

            # Re-processing the same file replaces previous detections.
            Detection.query.filter_by(recording_id=recording.id).delete()
            for det in raw_detections:
                db.session.add(
                    Detection(
                        recording_id=recording.id,
                        species_name=det["species_name"],
                        start_time=det["start_time"],
                        end_time=det["end_time"],
                        confidence_score=det["confidence"],
                        category=det["category"],
                        yamnet_label=det["yamnet_label"],
                        raw_score=det["raw_score"],
                    )
                )

            png_path = Path(flask_app.config["SPECTROGRAM_FOLDER"]) / f"{recording.id}.png"
            generate_spectrogram(waveform, Config.TARGET_SAMPLE_RATE, raw_detections, png_path)

            job.status = "completed"
            job.completed_at = utcnow()
            job.processing_time = round(
                (job.completed_at - job.created_at).total_seconds(), 2
            )
            logger.info(
                "Processing completed for %s: %d detections (quality %s)",
                recording.id,
                len(raw_detections),
                quality["label"],
            )
        except Exception as exc:
            job.status = "failed"
            job.completed_at = utcnow()
            job.error_message = str(exc)
            logger.exception("Processing failed for %s", recording.id)
        finally:
            db.session.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_recording_or_404(file_id) -> AudioRecording:
    recording = db.session.get(AudioRecording, file_id)
    if recording is None:
        abort(404, description="Recording not found.")
    return recording


def _scoped_recordings():
    """Recordings visible to the current user (own uploads or all when anonymous)."""
    from flask import g

    query = AudioRecording.query
    if getattr(g, "user", None):
        query = query.filter(AudioRecording.user_id == g.user.id)
    return query


def _parse_coordinates(form):
    """Optional latitude/longitude form fields; 400 on unparseable values."""
    def parse(name):
        value = form.get(name)
        if value in (None, ""):
            return None
        try:
            return float(value)
        except ValueError:
            abort(400, description=f"'{name}' must be a number.")

    return parse("latitude"), parse("longitude")


def _results_payload(recording) -> dict:
    detections = [d.to_dict() for d in recording.detections]
    summary = report_generator.compute_summary(detections, recording.duration)
    quality = None
    if recording.quality_label:
        quality = {
            "score": recording.quality_score,
            "label": recording.quality_label,
        }
    return {
        "recording": recording.to_dict(),
        "summary": summary,
        "detections": detections,
        "spectrogram_url": f"/api/spectrogram/{recording.id}",
        "quality": quality,
    }


app = create_app()

if __name__ == "__main__":
    # Development server. For production use waitress/gunicorn (see README).
    app.run(host="0.0.0.0", port=5000, debug=True)
