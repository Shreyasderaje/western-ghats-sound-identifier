"""Authentication tests (optional auth, user scoping)."""
from tests.conftest import upload_recording


def register(client, username, password="secret123"):
    return client.post("/api/auth/register", json={"username": username, "password": password})


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_and_me(client):
    response = register(client, "field_biologist")
    assert response.status_code == 201
    token = response.get_json()["token"]

    me = client.get("/api/auth/me", headers=auth_headers(token))
    assert me.status_code == 200
    assert me.get_json()["user"]["username"] == "field_biologist"


def test_register_rejects_duplicate_and_bad_input(client):
    assert register(client, "maya").status_code == 201
    assert register(client, "maya").status_code == 409
    assert register(client, "ab").status_code == 400
    assert register(client, "ok_name", password="123").status_code == 400


def test_login_and_me_flow(client):
    register(client, "arjun", password="hunter2x")
    ok = client.post("/api/auth/login", json={"username": "arjun", "password": "hunter2x"})
    assert ok.status_code == 200
    bad = client.post("/api/auth/login", json={"username": "arjun", "password": "wrong"})
    assert bad.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_recordings_scoped_to_user(client, wav_file, fake_model):
    first = register(client, "user_one").get_json()
    second = register(client, "user_two").get_json()

    upload_recording(client, wav_file)  # anonymous recording
    upload_recording(client, wav_file, headers=auth_headers(first["token"]))
    upload_recording(client, wav_file, headers=auth_headers(second["token"]))

    mine = client.get("/api/recordings", headers=auth_headers(first["token"])).get_json()
    assert mine["total"] == 1
    assert mine["recordings"][0]["username"] == "user_one"

    everyone = client.get("/api/recordings").get_json()
    assert everyone["total"] >= 2
