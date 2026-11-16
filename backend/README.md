# Backend — Western Ghats Sound Identifier

Flask API that accepts field audio recordings, detects bird/frog calls with
YAMNet, maps them to Western Ghats species, and produces biodiversity reports.

## Setup

**Requirements:** Python 3.10–3.11, (optional) ffmpeg for M4A files.

```bash
cd backend
python -m venv venv
venv\Scripts\activate                 # Windows Git Bash: source venv/Scripts/activate
pip install -r requirements.txt       # TensorFlow download is ~200 MB

python seed_data.py                   # create DB + insert 20 birds / 10 frogs
python app.py                         # dev server on http://localhost:5000
```

Production-style local run (Windows-friendly WSGI server):

```bash
waitress-serve --host 0.0.0.0 --port 5000 app:app
```

### First-run notes

- On the first processing request, YAMNet downloads from TensorFlow Hub and is
  cached in `data/models/tfhub/` (override with the `TFHUB_CACHE_DIR` env var).
- The database is `sound_identifier.db` (SQLite) in this folder by default.
  Set `DATABASE_URL=postgresql://...` to switch databases.

## Configuration (environment variables)

| Variable                | Default                          | Purpose                       |
|-------------------------|----------------------------------|-------------------------------|
| `DATABASE_URL`          | SQLite `sound_identifier.db`     | SQLAlchemy connection string  |
| `MAX_UPLOAD_SIZE_MB`    | `500`                            | Upload size limit             |
| `UPLOAD_FOLDER`         | `./uploads`                      | Audio storage                 |
| `SPECTROGRAM_FOLDER`    | `./spectrograms`                 | Spectrogram PNGs              |
| `REPORT_FOLDER`         | `./reports`                      | Generated PDF/CSV files       |
| `YAMNET_MODEL_URL`      | tfhub.dev/google/yamnet/1        | Model source                  |
| `YAMNET_SCORE_THRESHOLD`| `0.15`                           | Detection sensitivity         |
| `TFHUB_CACHE_DIR`       | `./data/models/tfhub`            | Model cache                   |

## API reference

### `POST /api/audio/upload`
Form-data: `file` (WAV/MP3/M4A), optional `location`.
**201** → `{file_id, filename, upload_date, duration, location, sample_rate}`.
**400** on missing/unsupported format, **413** over the size limit.

### `POST /api/process/{file_id}`
Starts background analysis. **202** → job JSON with `status: in_queue`.
**409** if already running. Job states: `in_queue → processing → completed | failed`.

### `GET /api/process/{file_id}/status`
Current job status; when `completed`, includes the full results payload.

### `GET /api/results/{file_id}`
```json
{
  "status": "completed",
  "results": {
    "recording": {"file_id": "...", "filename": "...", "duration": 30.0, ...},
    "summary": {
      "total_detections": 9, "unique_species": 4, "birds": 3, "frogs": 1,
      "shannon_diversity": 1.21,
      "per_species": [{"species_name": "...", "count": 4, "avg_confidence": 0.42, ...}]
    },
    "detections": [{"species_name": "...", "start_time": 1.0, "end_time": 2.9,
                    "confidence": 0.41, "category": "bird", "yamnet_label": "Bird"}],
    "spectrogram_url": "/api/spectrogram/<file_id>"
  }
}
```
Returns `status: not_started | in_queue | processing` with `results: null` until
analysis completes.

### `GET /api/spectrogram/{file_id}` — annotated Mel-spectrogram PNG.
### `POST /api/reports/{file_id}/pdf` — generates and streams the PDF report.
### `POST /api/reports/{file_id}/csv` — generates and streams the CSV export.
### `GET /api/recordings?page=1&per_page=10` — history for the dashboard.
### `DELETE /api/recordings/{file_id}` — removes the recording and all artifacts.
### `GET /api/health` — service status and model load state.

## How detection works (MVP, plan Option A)

1. Audio is decoded to mono 16 kHz and peak-normalised (`audio_processor.load_audio`).
2. YAMNet scores 521 generic AudioSet classes for every 0.96 s patch
   (`ml_inference.YamnetSpeciesClassifier`).
3. Bird/frog-related classes are collapsed into a per-frame category score;
   adjacent frames are merged into call events.
4. Each event's dominant frequency (FFT peak) selects the species whose
   approximate call band (`species_reference.py`) contains it — otherwise the
   nearest band is used with a lower confidence prior.

This is deliberately honest about its limits: YAMNet cannot distinguish real
species, so treat species-level output as plausible grouping, not ground truth.
Confidence thresholds are tunable via `YAMNET_SCORE_THRESHOLD`.

## Tests

```bash
venv\Scripts\python scripts\smoke_test.py
```

End-to-end: synthesises a 30 s chirp WAV, uploads it, processes it, verifies
results/spectrogram/PDF/CSV/history/delete. Requires internet for the first
YAMNet download; subsequent runs use the cache.
