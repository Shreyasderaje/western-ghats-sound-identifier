"""End-to-end smoke test for the backend (no server needed, real YAMNet).

1. Synthesises a 30 s test WAV with bird-like chirps.
2. Uploads it through the Flask test client.
3. Starts processing and polls until the job completes.
4. Verifies results, quality, spectrogram, PDF, CSV, threshold re-run,
   auth, analytics and community endpoints.

Usage:  python scripts/smoke_test.py
"""
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app  # noqa: E402
from seed_data import seed_database  # noqa: E402

TEST_WAV = Path(__file__).resolve().parent / "smoke_test_input.wav"
POLL_TIMEOUT_S = 300


def synthesise_test_recording(path: Path, seconds: int = 30, sr: int = 16000):
    """Chirp bursts every ~3 s over quiet forest-like noise."""
    rng = np.random.default_rng(42)
    t = np.arange(seconds * sr) / sr
    audio = 0.01 * rng.standard_normal(t.size)  # background noise floor

    for start in np.arange(0.5, seconds - 1.0, 3.0):
        burst = np.zeros(int(0.8 * sr))
        n = burst.size
        chirp_t = np.arange(n) / sr
        sweep = np.sin(2 * np.pi * (2500 + 900 * chirp_t) * chirp_t)  # rising chirp
        envelope = np.exp(-4 * chirp_t) * np.hanning(n)
        burst += 0.8 * sweep * envelope
        i0 = int(start * sr)
        audio[i0 : i0 + n] += burst

    audio = (audio / np.max(np.abs(audio)) * 0.9).astype(np.float32)
    sf.write(path, audio, sr)
    print(f"  synthesised {path.name}: {seconds}s @ {sr} Hz")


def wait_for(client, file_id):
    deadline = time.time() + POLL_TIMEOUT_S
    while time.time() < deadline:
        payload = client.get(f"/api/process/{file_id}/status").get_json()
        if payload["status"] in ("completed", "failed"):
            return payload
        time.sleep(3)
    raise AssertionError("processing timed out")


def main() -> int:
    app = create_app()
    seed_database(app)
    synthesise_test_recording(TEST_WAV)

    client = app.test_client()

    # 1. Health + species reference
    health = client.get("/api/health").get_json()
    print(f"  health: {health['status']}, model loaded: {health['model']['loaded']}")
    assert health["model"]["loaded"], f"model unavailable: {health['model']['error']}"

    species = client.get("/api/species").get_json()["species"]
    assert len(species) == 30, len(species)
    print(f"  species reference: {len(species)} species (20 birds, 10 frogs)")

    # 2. Auth (community features)
    token = client.post(
        "/api/auth/register", json={"username": "smoke_tester", "password": "secret123"}
    ).get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    print("  auth: registered + token verified")

    # 3. Upload
    with open(TEST_WAV, "rb") as handle:
        response = client.post(
            "/api/audio/upload",
            data={
                "file": (handle, "smoke_test_input.wav"),
                "location": "Smoke test forest",
                "latitude": "13.91",
                "longitude": "75.09",
            },
            headers=headers,
            content_type="multipart/form-data",
        )
    assert response.status_code == 201, response.get_data(as_text=True)
    file_id = response.get_json()["file_id"]
    print(f"  uploaded: file_id={file_id}")

    bad = client.post(
        "/api/audio/upload",
        data={"file": (b"not audio", "notes.txt")},
        content_type="multipart/form-data",
    )
    assert bad.status_code == 400, f"expected 400 for .txt upload, got {bad.status_code}"
    print("  rejected a .txt upload as expected")

    # 4. Process (async) and poll
    assert client.post(f"/api/process/{file_id}").status_code == 202
    payload = wait_for(client, file_id)
    assert payload["status"] == "completed", f"processing failed: {payload}"
    detections = payload["results"]["detections"]
    print(f"  processing completed in {payload['processing_time']}s, "
          f"{len(detections)} call events")

    # 5. Results + quality
    results = client.get(f"/api/results/{file_id}").get_json()["results"]
    summary = results["summary"]
    quality = results["quality"]
    print(f"  results: unique_species={summary['unique_species']}, "
          f"birds={summary['birds']}, frogs={summary['frogs']}, "
          f"shannon={summary['shannon_diversity']}")
    print(f"  quality: {quality['label']} (score {quality['score']})")
    for det in detections[:5]:
        print(f"    - {det['species_name']} @ {det['start_time']:.1f}s "
              f"(conf {det['confidence']}, via '{det['yamnet_label']}')")

    # 6. Confidence threshold re-run
    client.post(f"/api/process/{file_id}", json={"confidence_threshold": 0.4})
    payload = wait_for(client, file_id)
    assert payload["status"] == "completed"
    strict_count = len(payload["results"]["detections"])
    print(f"  threshold re-run at 0.4: {strict_count} call events")
    assert payload["job_id"] > 1

    # 7. Spectrogram + reports
    response = client.get(f"/api/spectrogram/{file_id}")
    assert response.status_code == 200 and response.mimetype == "image/png"
    response = client.post(f"/api/reports/{file_id}/pdf")
    assert response.status_code == 200 and response.mimetype == "application/pdf"
    response = client.post(f"/api/reports/{file_id}/csv")
    assert response.status_code == 200 and response.mimetype == "text/csv"
    print(f"  spectrogram + PDF + CSV OK "
          f"({strict_count} rows exported)")

    # 8. Analytics + community
    summary_stats = client.get("/api/analytics/summary", headers=headers).get_json()
    print(f"  analytics: {summary_stats['total_recordings']} recordings, "
          f"{summary_stats['unique_species']} unique species")
    assert summary_stats["total_recordings"] >= 1

    client.post(f"/api/recordings/{file_id}/share", json={"is_public": True})
    feed = client.get("/api/public/recordings").get_json()
    assert any(r["file_id"] == file_id for r in feed["recordings"])
    shared = client.get(f"/api/public/recordings/{file_id}").get_json()
    assert "results" in shared
    board = client.get("/api/community/leaderboard").get_json()["leaderboard"]
    print(f"  community: shared recording visible, leaderboard={board}")

    # 9. History + delete
    history = client.get("/api/recordings", headers=headers).get_json()
    assert history["total"] >= 1
    response = client.delete(f"/api/recordings/{file_id}")
    assert response.status_code == 200
    print("  history + delete endpoints OK")

    print("\nSMOKE TEST PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
