"""Processing pipeline tests (with the YAMNet model faked)."""
from tests.conftest import process_and_wait, upload_recording


def test_process_completes_with_results(client, wav_file, fake_model):
    file_id = upload_recording(client, wav_file)["file_id"]
    payload = process_and_wait(client, file_id)

    assert payload["status"] == "completed"
    results = payload["results"]
    assert len(results["detections"]) == 3
    assert results["summary"]["unique_species"] == 2
    assert results["summary"]["birds"] == 1  # unique bird species (trogon)
    assert results["summary"]["frogs"] == 1
    assert results["recording"]["duration"] == 10.0
    assert results["recording"]["sample_rate"] == 16000
    assert results["recording"]["quality_label"] in ("poor", "fair", "good", "excellent")
    for det in results["detections"]:
        assert 0.0 < det["confidence"] <= 0.99


def test_threshold_is_passed_to_the_model(client, wav_file, fake_model):
    file_id = upload_recording(client, wav_file)["file_id"]
    process_and_wait(client, file_id, confidence_threshold=0.5)
    assert fake_model == [0.5]


def test_process_unknown_file_returns_404(client):
    response = client.post("/api/process/deadbeef")
    assert response.status_code == 404


def test_results_before_processing(client, wav_file):
    file_id = upload_recording(client, wav_file)["file_id"]
    payload = client.get(f"/api/results/{file_id}").get_json()
    assert payload["status"] == "not_started"
    assert payload["results"]["detections"] == []


def test_spectrogram_generated(client, wav_file, fake_model):
    file_id = upload_recording(client, wav_file)["file_id"]
    process_and_wait(client, file_id)
    response = client.get(f"/api/spectrogram/{file_id}")
    assert response.status_code == 200
    assert response.mimetype == "image/png"
