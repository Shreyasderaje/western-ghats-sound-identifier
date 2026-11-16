"""SQLAlchemy ORM models for the Western Ghats Sound Identifier.

Tables:
- AudioRecording   one uploaded audio file
- Detection        one detected species call event within a recording
- SpeciesReference metadata for the species we can recognise
- ProcessingJob    async processing pipeline state for each recording
- User             account for optional authentication (community features)
"""
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


def utcnow():
    """Naive UTC timestamp — SQLite drops timezone info, so keep one style."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    recordings = db.relationship("AudioRecording", backref="user", lazy="selectin")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {"id": self.id, "username": self.username}


class AudioRecording(db.Model):
    __tablename__ = "audio_recordings"

    # UUID string so file_id can be used in URLs immediately after upload.
    id = db.Column(db.String(36), primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    upload_date = db.Column(db.DateTime, default=utcnow, nullable=False)
    duration = db.Column(db.Float)          # seconds, filled after validation/processing
    location = db.Column(db.String(255))
    latitude = db.Column(db.Float)          # optional GPS coordinates for the map view
    longitude = db.Column(db.Float)
    file_path = db.Column(db.String(1024), nullable=False)
    sample_rate = db.Column(db.Integer)     # Hz, filled after validation/processing
    quality_score = db.Column(db.Float)     # 0-100, from audio quality assessment
    quality_label = db.Column(db.String(16))  # poor / fair / good / excellent
    is_public = db.Column(db.Boolean, default=False, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)

    detections = db.relationship(
        "Detection", backref="recording", cascade="all, delete-orphan",
        lazy="selectin",
    )
    jobs = db.relationship(
        "ProcessingJob", backref="recording", cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "file_id": self.id,
            "filename": self.filename,
            "upload_date": self.upload_date.isoformat() if self.upload_date else None,
            "duration": self.duration,
            "location": self.location,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "sample_rate": self.sample_rate,
            "quality_score": self.quality_score,
            "quality_label": self.quality_label,
            "is_public": self.is_public,
            "username": self.user.username if self.user else None,
        }


class Detection(db.Model):
    __tablename__ = "detections"

    id = db.Column(db.Integer, primary_key=True)
    recording_id = db.Column(
        db.String(36), db.ForeignKey("audio_recordings.id"), nullable=False, index=True
    )
    species_name = db.Column(db.String(160), nullable=False, index=True)
    start_time = db.Column(db.Float, nullable=False)   # seconds from start
    end_time = db.Column(db.Float, nullable=False)     # seconds from start
    confidence_score = db.Column(db.Float, nullable=False)  # 0.0-1.0
    category = db.Column(db.String(16))                # bird / frog
    yamnet_label = db.Column(db.String(120))           # generic YAMNet class evidence
    raw_score = db.Column(db.Float)                    # YAMNet score before mapping

    def to_dict(self):
        return {
            "id": self.id,
            "species_name": self.species_name,
            "category": self.category,
            "start_time": round(self.start_time, 2),
            "end_time": round(self.end_time, 2),
            "confidence": round(self.confidence_score, 3),
            "yamnet_label": self.yamnet_label,
        }


class SpeciesReference(db.Model):
    __tablename__ = "species_reference"

    id = db.Column(db.Integer, primary_key=True)
    species_name = db.Column(db.String(160), unique=True, nullable=False, index=True)
    common_name = db.Column(db.String(160), nullable=False)
    scientific_name = db.Column(db.String(160), nullable=False)
    category = db.Column(db.String(16), nullable=False)  # bird / frog
    habitat = db.Column(db.String(400))
    freq_low_hz = db.Column(db.Integer)
    freq_high_hz = db.Column(db.Integer)

    def to_dict(self):
        return {
            "species_name": self.species_name,
            "common_name": self.common_name,
            "scientific_name": self.scientific_name,
            "category": self.category,
            "habitat": self.habitat,
        }


class ProcessingJob(db.Model):
    __tablename__ = "processing_jobs"

    id = db.Column(db.Integer, primary_key=True)
    recording_id = db.Column(
        db.String(36), db.ForeignKey("audio_recordings.id"), nullable=False, index=True
    )
    # in_queue -> processing -> completed | failed
    status = db.Column(db.String(16), default="in_queue", nullable=False, index=True)
    confidence_threshold = db.Column(db.Float)  # per-run detection threshold override
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    completed_at = db.Column(db.DateTime)
    processing_time = db.Column(db.Float)   # seconds the analysis took
    error_message = db.Column(db.Text)

    def to_dict(self):
        return {
            "job_id": self.id,
            "file_id": self.recording_id,
            "status": self.status,
            "confidence_threshold": self.confidence_threshold,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "processing_time": self.processing_time,
            "error_message": self.error_message,
        }
