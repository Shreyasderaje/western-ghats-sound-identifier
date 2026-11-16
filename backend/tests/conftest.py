"""Shared pytest fixtures: test app, client, fake YAMNet model, sample audio."""
import sys
import time
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ml_inference  # noqa: E402
from app import create_app  # noqa: E402
from config import Config  # noqa: E402

# Detections the fake model returns for every run (2x trogon + 1x bullfrog).
FAKE_DETECTIONS = [
    {
        "species_name": "Harpactes fasciatus",
        "common_name": "Malabar Trogon",
        "scientific_name": "Harpactes fasciatus",
        "category": "bird",
        "start_time": 0.5, "end_time": 2.4,
        "confidence": 0.52, "yamnet_label": "Bird", "raw_score": 0.55,
        "dominant_hz": 1500.0,
    },
    {
        "species_name": "Hoplobatrachus tigerinus",
        "common_name": "Indian Bullfrog",
        "scientific_name": "Hoplobatrachus tigerinus",
        "category": "frog",
        "start_time": 5.0, "end_time": 6.8,
        "confidence": 0.30, "yamnet_label": "Croak", "raw_score": 0.33,
        "dominant_hz": 400.0,
    },
    {
        "species_name": "Harpactes fasciatus",
        "common_name": "Malabar Trogon",
        "scientific_name": "Harpactes fasciatus",
        "category": "bird",
        "start_time": 8.0, "end_time": 9.5,
        "confidence": 0.61, "yamnet_label": "Chirp, tweet", "raw_score": 0.64,
        "dominant_hz": 1600.0,
    },
]


def make_test_config(tmp_path):
    class TestConfig(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
        UPLOAD_FOLDER = tmp_path / "uploads"
        SPECTROGRAM_FOLDER = tmp_path / "spectrograms"
        REPORT_FOLDER = tmp_path / "reports"
        SECRET_KEY = "test-secret"

    return TestConfig


@pytest.fixture
def app(tmp_path):
    return create_app(make_test_config(tmp_path))


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def wav_file(tmp_path):
    """10 s, 16 kHz tone — enough for the pipeline without the real model."""
    path = tmp_path / "tone.wav"
    sr = 16000
    t = np.arange(sr * 10) / sr
    audio = (0.4 * np.sin(2 * np.pi * 2000 * t)).astype(np.float32)
    sf.write(path, audio, sr)
    return path


@pytest.fixture
def fake_model(monkeypatch):
    """Replace YAMNet inference with deterministic detections; returns the
    list of thresholds the pipeline passed to detect()."""
    thresholds = []

    def fake_detect(waveform, sample_rate, threshold=None):
        thresholds.append(threshold)
        return [dict(d) for d in FAKE_DETECTIONS]

    monkeypatch.setattr(ml_inference.classifier, "detect", fake_detect)
    monkeypatch.setattr(
        type(ml_inference.classifier),
        "status",
        property(lambda self: {"loaded": True, "error": None, "model_url": "test"}),
    )
    return thresholds


def upload_recording(client, wav_file, headers=None, **form):
    with open(wav_file, "rb") as handle:
        response = client.post(
            "/api/audio/upload",
            data={"file": (handle, "tone.wav"), **form},
            headers=headers or {},
            content_type="multipart/form-data",
        )
    assert response.status_code == 201, response.get_data(as_text=True)
    return response.get_json()


def process_and_wait(client, file_id, timeout_s=60, **body):
    response = client.post(f"/api/process/{file_id}", json=body or None)
    assert response.status_code == 202, response.get_data(as_text=True)

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        payload = client.get(f"/api/process/{file_id}/status").get_json()
        if payload["status"] in ("completed", "failed"):
            return payload
        time.sleep(0.2)
    raise AssertionError("processing did not finish in time")
