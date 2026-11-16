"""Configuration settings for the Western Ghats Sound Identifier backend.

All settings can be overridden with environment variables so the same code
runs in development and production (Docker sets the variables in Phase 5).
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Where YAMNet's SavedModel gets cached after the first download.
os.environ.setdefault("TFHUB_CACHE_DIR", str(BASE_DIR / "data" / "models" / "tfhub"))


class Config:
    """Base configuration, read by app.py."""

    # --- General ---
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    JSON_SORT_KEYS = False

    # --- Database ---
    # SQLite for local development; set DATABASE_URL=postgresql://... for production.
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", f"sqlite:///{(BASE_DIR / 'sound_identifier.db').as_posix()}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- Uploads ---
    MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500"))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_SIZE_MB * 1024 * 1024  # Flask rejects larger bodies with 413
    ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a"}
    UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", BASE_DIR / "uploads"))
    SPECTROGRAM_FOLDER = Path(os.getenv("SPECTROGRAM_FOLDER", BASE_DIR / "spectrograms"))
    REPORT_FOLDER = Path(os.getenv("REPORT_FOLDER", BASE_DIR / "reports"))

    # --- Audio processing ---
    # YAMNet expects mono 16 kHz float32 waveforms.
    TARGET_SAMPLE_RATE = 16000
    # YAMNet scores arrive every 0.48 s for 0.96 s patches.
    FRAME_HOP_SECONDS = 0.48
    PATCH_SECONDS = 0.96

    # --- Detection tuning ---
    # Minimum YAMNet score for a frame to count as a detection (0.0-1.0).
    YAMNET_SCORE_THRESHOLD = float(os.getenv("YAMNET_SCORE_THRESHOLD", "0.15"))
    # Adjacent frames of the same category closer than this are merged into one event.
    MERGE_GAP_SECONDS = 1.0
    # Dominant-frequency search window for the species heuristic (Hz).
    FREQ_SEARCH_MIN_HZ = 80
    FREQ_SEARCH_MAX_HZ = 8000

    # --- ML model ---
    YAMNET_MODEL_URL = os.getenv("YAMNET_MODEL_URL", "https://tfhub.dev/google/yamnet/1")
    YAMNET_CLASS_MAP_CSV = BASE_DIR / "data" / "yamnet_class_map.csv"
