"""Analytics + community endpoint tests."""
from tests.conftest import process_and_wait, upload_recording


def seed_two_processed(client, wav_file, fake_model):
    for name in ("site_a.wav", "site_b.wav"):
        file_id = upload_recording(client, wav_file, location=name)["file_id"]
        process_and_wait(client, file_id)


def test_analytics_summary(client, wav_file, fake_model):
    seed_two_processed(client, wav_file, fake_model)
    payload = client.get("/api/analytics/summary").get_json()

    assert payload["total_recordings"] == 2
    assert payload["unique_species"] == 2
    assert payload["total_detections"] == 6
    assert payload["avg_species_per_recording"] == 1.0
    assert payload["recordings_this_week"] == 2


def test_top_species_ordering(client, wav_file, fake_model):
    seed_two_processed(client, wav_file, fake_model)
    species = client.get("/api/analytics/top-species").get_json()["species"]

    by_name = {s["species_name"]: s["count"] for s in species}
    assert by_name["Harpactes fasciatus"] == 4   # 2 detections x 2 recordings
    assert by_name["Hoplobatrachus tigerinus"] == 2
    assert species[0]["count"] >= species[-1]["count"]


def test_trends(client, wav_file, fake_model):
    seed_two_processed(client, wav_file, fake_model)
    trends = client.get("/api/analytics/trends").get_json()["trends"]

    assert len(trends) >= 1
    assert sum(t["detections"] for t in trends) == 6


def test_share_and_public_view(client, wav_file, fake_model):
    file_id = upload_recording(client, wav_file)["file_id"]
    process_and_wait(client, file_id)

    # Not public yet
    assert client.get(f"/api/public/recordings/{file_id}").status_code == 404

    client.post(f"/api/recordings/{file_id}/share", json={"is_public": True})
    feed = client.get("/api/public/recordings").get_json()
    assert feed["total"] == 1
    assert feed["recordings"][0]["file_id"] == file_id

    shared = client.get(f"/api/public/recordings/{file_id}").get_json()
    assert len(shared["results"]["detections"]) == 3

    # Toggle off again
    client.post(f"/api/recordings/{file_id}/share", json={"is_public": False})
    assert client.get(f"/api/public/recordings/{file_id}").status_code == 404


def test_leaderboard_requires_user_uploads(client, wav_file, fake_model):
    token = client.post(
        "/api/auth/register", json={"username": "top_contributor", "password": "secret1"}
    ).get_json()["token"]
    file_id = upload_recording(client, wav_file, headers={"Authorization": f"Bearer {token}"})["file_id"]
    process_and_wait(client, file_id)

    board = client.get("/api/community/leaderboard").get_json()["leaderboard"]
    assert board == [{"username": "top_contributor", "recordings": 1}]
