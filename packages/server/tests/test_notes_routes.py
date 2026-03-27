from pathlib import Path

from fastapi.testclient import TestClient

from increa_reader.main import create_app


def _build_client(tmp_path, monkeypatch):
    repo_root = tmp_path / "demo-repo"
    repo_root.mkdir()
    (repo_root / "docs").mkdir()
    (repo_root / "docs" / "guide.md").write_text("# Guide\n\nHello world\n", encoding="utf-8")

    monkeypatch.setenv("INCREA_REPO", str(repo_root))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("HOME", str(tmp_path))

    app = create_app()
    return TestClient(app), repo_root


def test_notes_crud_roundtrip(tmp_path, monkeypatch):
    client, repo_root = _build_client(tmp_path, monkeypatch)

    response = client.get("/api/notes", params={"repo": "demo-repo", "path": "docs/guide.md"})
    assert response.status_code == 200
    assert response.json() == {"notes": []}

    payload = {
        "repo": "demo-repo",
        "path": "docs/guide.md",
        "note": {
            "color": "yellow",
            "content": "Remember this section",
            "position": {
                "headingPath": ["Guide"],
                "blockText": "Hello world",
                "blockIndex": 1,
                "xRatio": 0.3,
                "yRatio": 0.4,
            },
        },
    }

    create_response = client.post("/api/notes", json=payload)
    assert create_response.status_code == 200
    created = create_response.json()["note"]
    assert created["id"].startswith("note_")
    assert created["content"] == "Remember this section"

    notes_file = repo_root / ".increa" / "notes.json"
    assert notes_file.exists()

    get_response = client.get("/api/notes", params={"repo": "demo-repo", "path": "docs/guide.md"})
    assert get_response.status_code == 200
    assert len(get_response.json()["notes"]) == 1

    update_payload = {
        "repo": "demo-repo",
        "path": "docs/guide.md",
        "note": {
            "color": "blue",
            "content": "Updated note content",
            "position": {
                "headingPath": ["Guide"],
                "blockText": "Hello world",
                "blockIndex": 1,
                "xRatio": 0.5,
                "yRatio": 0.6,
            },
        },
    }
    update_response = client.put(f"/api/notes/{created['id']}", json=update_payload)
    assert update_response.status_code == 200
    updated = update_response.json()["note"]
    assert updated["id"] == created["id"]
    assert updated["color"] == "blue"
    assert updated["content"] == "Updated note content"

    delete_response = client.delete(
        f"/api/notes/{created['id']}",
        params={"repo": "demo-repo", "path": "docs/guide.md"},
    )
    assert delete_response.status_code == 200
    assert delete_response.json() == {"success": True}

    final_response = client.get("/api/notes", params={"repo": "demo-repo", "path": "docs/guide.md"})
    assert final_response.status_code == 200
    assert final_response.json() == {"notes": []}


def test_empty_content_and_invalid_path(tmp_path, monkeypatch):
    client, _ = _build_client(tmp_path, monkeypatch)

    create_response = client.post(
        "/api/notes",
        json={
            "repo": "demo-repo",
            "path": "docs/guide.md",
            "note": {
                "color": "yellow",
                "content": "   ",
                "position": {"blockIndex": 0, "xRatio": 0.1, "yRatio": 0.2},
            },
        },
    )
    assert create_response.status_code == 400

    valid_create = client.post(
        "/api/notes",
        json={
            "repo": "demo-repo",
            "path": "docs/guide.md",
            "note": {
                "color": "yellow",
                "content": "Keep me",
                "position": {"blockIndex": 0, "xRatio": 0.1, "yRatio": 0.2},
            },
        },
    )
    note_id = valid_create.json()["note"]["id"]

    clear_response = client.put(
        f"/api/notes/{note_id}",
        json={
            "repo": "demo-repo",
            "path": "docs/guide.md",
            "note": {
                "color": "yellow",
                "content": "",
                "position": {"blockIndex": 0, "xRatio": 0.1, "yRatio": 0.2},
            },
        },
    )
    assert clear_response.status_code == 200
    assert clear_response.json() == {"deleted": True}

    invalid_path_response = client.get(
        "/api/notes",
        params={"repo": "demo-repo", "path": "../secret.md"},
    )
    assert invalid_path_response.status_code == 403


def test_invalid_color_is_rejected(tmp_path, monkeypatch):
    client, _ = _build_client(tmp_path, monkeypatch)

    response = client.post(
        "/api/notes",
        json={
            "repo": "demo-repo",
            "path": "docs/guide.md",
            "note": {
                "color": "orange",
                "content": "Bad color",
                "position": {"blockIndex": 0, "xRatio": 0.1, "yRatio": 0.2},
            },
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "note.color is invalid"
