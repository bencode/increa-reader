import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from increa_reader.session_routes import create_session_routes


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("CHAT_LOGS_DIR", str(tmp_path))
    app = FastAPI()
    create_session_routes(app, None)
    return TestClient(app)


def _write_sessions(tmp_path, count):
    sessions = [
        {
            "id": f"session_{index:03d}",
            "title": f"Session {index}",
            "createdAt": index,
            "lastActiveAt": index,
        }
        for index in range(count)
    ]
    (tmp_path / "sessions.json").write_text(
        json.dumps(
            {
                "sessions": sessions,
                "lastActiveSessionId": sessions[-1]["id"] if sessions else None,
            }
        ),
        encoding="utf-8",
    )


def test_sessions_default_page_is_recent_and_reports_pagination(tmp_path, monkeypatch):
    _write_sessions(tmp_path, 120)
    meta_file = tmp_path / "sessions.json"
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    meta["sessions"][119]["lastActiveAt"] = 118
    meta_file.write_text(json.dumps(meta), encoding="utf-8")

    response = _client(tmp_path, monkeypatch).get("/api/sessions")

    assert response.status_code == 200
    data = response.json()
    assert [session["id"] for session in data["sessions"]] == [
        f"session_{index:03d}" for index in range(119, 69, -1)
    ]
    assert data["lastActiveSessionId"] == "session_119"
    assert data["total"] == 120
    assert data["limit"] == 50
    assert data["offset"] == 0
    assert data["hasMore"] is True


def test_sessions_load_more_returns_non_overlapping_final_pages(tmp_path, monkeypatch):
    _write_sessions(tmp_path, 120)
    client = _client(tmp_path, monkeypatch)

    second = client.get("/api/sessions", params={"limit": 50, "offset": 50}).json()
    final = client.get("/api/sessions", params={"limit": 50, "offset": 100}).json()

    assert len(second["sessions"]) == 50
    assert second["sessions"][0]["id"] == "session_069"
    assert second["sessions"][-1]["id"] == "session_020"
    assert second["hasMore"] is True
    assert len(final["sessions"]) == 20
    assert final["sessions"][0]["id"] == "session_019"
    assert final["sessions"][-1]["id"] == "session_000"
    assert final["hasMore"] is False


def test_sessions_empty_and_invalid_pagination(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    assert client.get("/api/sessions").json() == {
        "sessions": [],
        "lastActiveSessionId": None,
        "total": 0,
        "limit": 50,
        "offset": 0,
        "hasMore": False,
    }
    assert client.get("/api/sessions", params={"limit": 0}).status_code == 422
    assert client.get("/api/sessions", params={"limit": 101}).status_code == 422
    assert client.get("/api/sessions", params={"offset": -1}).status_code == 422
