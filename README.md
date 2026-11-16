# Western Ghats Sound Identifier

An AI-powered web application that identifies **bird and frog species from audio
recordings** made in the Western Ghats biodiversity hotspot (India). Upload a
field recording, get back species detections with timestamps, confidence
scores, an annotated spectrogram, and downloadable biodiversity reports.

## Features (Phase 1 — backend foundation)

- **Audio uploads** — WAV / MP3 / M4A up to 500 MB, with validation
- **Species detection** — Google's YAMNet audio classifier + a frequency-based
  Western Ghats species mapping heuristic (20 birds, 10 frogs)
- **Async processing** — upload returns immediately; analysis runs in the
  background with pollable status
- **Results API** — detections with timestamps and confidence, summary
  statistics, Shannon diversity index
- **Annotated spectrograms** — Mel-spectrogram PNGs with detection overlays
- **Reports** — PDF biodiversity report (reportlab) and CSV export (pandas)
- **History** — recording list, per-recording species counts, delete

## Tech stack

| Layer     | Technology                                        |
|-----------|---------------------------------------------------|
| Backend   | Python, Flask, SQLAlchemy (SQLite dev / PostgreSQL prod) |
| Audio/ML  | librosa, soundfile, TensorFlow + TensorFlow Hub (YAMNet) |
| Reports   | reportlab (PDF), pandas (CSV), matplotlib (spectrograms) |
| Frontend  | React 18 + TypeScript + Vite *(Phase 2 — upcoming)* |

## Project structure

```
western-ghats-sound-identifier/
├── backend/
│   ├── app.py                 # Flask app + all REST endpoints
│   ├── config.py              # settings (env-overridable)
│   ├── models.py              # SQLAlchemy models
│   ├── audio_processor.py     # decode, normalise, spectrograms
│   ├── ml_inference.py        # YAMNet + species mapping
│   ├── species_reference.py   # 20 birds + 10 frogs reference data
│   ├── report_generator.py    # PDF + CSV reports
│   ├── seed_data.py           # DB initialisation script
│   ├── data/yamnet_class_map.csv
│   └── scripts/smoke_test.py  # end-to-end backend test
└── frontend/                  # (Phase 2 — upcoming)
```

## Quick start (backend)

```bash
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt   # Windows
# source venv/bin/activate on Linux/macOS

python seed_data.py        # create tables + species reference data
python app.py              # http://localhost:5000
```

Verify everything end to end without a server:

```bash
venv\Scripts\python scripts\smoke_test.py
```

> **Note:** M4A decoding needs [ffmpeg](https://ffmpeg.org) on your PATH.
> WAV and MP3 work without it. The YAMNet model (~16 MB) is downloaded from
> TensorFlow Hub on first use and cached in `backend/data/models/tfhub/`.

## API overview

| Method | Endpoint                        | Purpose                          |
|--------|---------------------------------|----------------------------------|
| GET    | `/api/health`                   | Service + model status           |
| GET    | `/api/species`                  | Species reference list           |
| POST   | `/api/audio/upload`             | Upload audio → `file_id`         |
| POST   | `/api/process/{file_id}`        | Start async analysis             |
| GET    | `/api/process/{file_id}/status` | Job status (+ results when done) |
| GET    | `/api/results/{file_id}`        | Full detections + summary        |
| GET    | `/api/spectrogram/{file_id}`    | Annotated spectrogram PNG        |
| POST   | `/api/reports/{file_id}/pdf`    | Generate/download PDF report     |
| POST   | `/api/reports/{file_id}/csv`    | Generate/download CSV export     |
| GET    | `/api/recordings`               | Recording history (paginated)    |
| DELETE | `/api/recordings/{file_id}`     | Delete recording + artifacts     |

Example:

```bash
curl -F "file=@recording.wav" -F "location=Agumbe" http://localhost:5000/api/audio/upload
curl -X POST http://localhost:5000/api/process/<file_id>
curl http://localhost:5000/api/results/<file_id>
```

## Roadmap

- [x] **Phase 1** — Backend foundation (upload → process → results → reports)
- [ ] **Phase 2** — React frontend (upload UI, results, spectrogram viewer, analytics)
- [ ] **Phase 3** — Integration, state management, responsive polish
- [ ] **Phase 4** — ML accuracy improvements, audio quality assessment, batch processing
- [ ] **Phase 5** — Docker deployment, docs, tests, performance
- [ ] **Phase 6** — Auth, live recording, maps, community features
