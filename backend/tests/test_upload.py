"""Upload endpoint validation tests."""
from tests.conftest import upload_recording


def test_missing_file_returns_400(client):
    response = client.post("/api/audio/upload", data={}, content_type="multipart/form-data")
    assert response.status_code == 400
    assert "No file" in response.get_json()["error"]


def test_unsupported_format_returns_400(client, wav_file):
    with open(wav_file, "rb") as handle:
        response = client.post(
            "/api/audio/upload",
            data={"file": (handle, "notes.txt")},
            content_type="multipart/form-data",
        )
    assert response.status_code == 400
    assert "Unsupported format" in response.get_json()["error"]


def test_upload_returns_metadata(client, wav_file):
    payload = upload_recording(client, wav_file, location="Agumbe")
    assert payload["filename"] == "tone.wav"
    assert payload["location"] == "Agumbe"
    assert 9.5 <= payload["duration"] <= 10.5
    assert payload["sample_rate"] == 16000
    assert len(payload["file_id"]) == 32


def test_upload_with_coordinates(client, wav_file):
    payload = upload_recording(client, wav_file, latitude="13.91", longitude="75.09")
    assert payload["latitude"] == 13.91
    assert payload["longitude"] == 75.09


def test_upload_with_bad_coordinates_returns_400(client, wav_file):
    with open(wav_file, "rb") as handle:
        response = client.post(
            "/api/audio/upload",
            data={"file": (handle, "tone.wav"), "latitude": "not-a-number"},
            content_type="multipart/form-data",
        )
    assert response.status_code == 400
