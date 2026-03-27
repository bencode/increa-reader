"""
Document sticky note API routes.
"""

import json
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .models import WorkspaceConfig

ALLOWED_NOTE_COLORS = {"yellow", "blue", "green", "pink"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _normalize_content(note: dict[str, Any]) -> str:
    return str(note.get("content", "")).strip()


def _get_repo_config(workspace_config: WorkspaceConfig, repo: str):
    repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
    if not repo_config:
        raise HTTPException(status_code=404, detail=f"Repository '{repo}' not found")
    return repo_config


def _resolve_repo_file(repo_root: Path, path: str) -> Path:
    file_path = (repo_root / path).resolve()
    if not str(file_path).startswith(str(repo_root.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return file_path


def _notes_file_path(repo_root: Path) -> Path:
    return repo_root / ".increa" / "notes.json"


def _read_notes_file(notes_path: Path) -> dict[str, Any]:
    if not notes_path.exists():
        return {"version": 1, "documents": {}}
    try:
        with open(notes_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read notes: {exc}") from exc

    if not isinstance(data, dict):
        return {"version": 1, "documents": {}}

    documents = data.get("documents")
    if not isinstance(documents, dict):
        documents = {}

    return {"version": 1, "documents": documents}


def _write_notes_file(notes_path: Path, data: dict[str, Any]) -> None:
    notes_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=notes_path.parent,
        delete=False,
    ) as tmp:
        json.dump(data, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
        temp_name = tmp.name

    Path(temp_name).replace(notes_path)


def _get_document_notes(data: dict[str, Any], path: str) -> list[dict[str, Any]]:
    documents = data.setdefault("documents", {})
    notes = documents.get(path)
    if notes is None:
        notes = []
        documents[path] = notes
    if not isinstance(notes, list):
        notes = []
        documents[path] = notes
    return notes


def _build_note_payload(note: dict[str, Any], existing: dict[str, Any] | None = None) -> dict[str, Any]:
    position = note.get("position")
    if not isinstance(position, dict) or not position:
        raise HTTPException(status_code=400, detail="note.position is required")

    content = _normalize_content(note)
    if not content:
        raise HTTPException(status_code=400, detail="note.content cannot be empty")

    color = str(note.get("color", "")).strip() or "yellow"
    if color not in ALLOWED_NOTE_COLORS:
        raise HTTPException(status_code=400, detail="note.color is invalid")
    now = _utc_now()
    note_id = str(
        note.get("id")
        or (existing.get("id") if existing else None)
        or f"note_{uuid.uuid4().hex[:12]}"
    )

    return {
        "id": note_id,
        "color": color,
        "content": content,
        "createdAt": (
            existing.get("createdAt")
            if existing
            else str(note.get("createdAt") or now)
        ),
        "updatedAt": str(note.get("updatedAt") or now),
        "position": position,
    }


def create_notes_routes(app, workspace_config: WorkspaceConfig):
    """Create document sticky note routes."""

    @app.get("/api/notes")
    async def get_notes(repo: str, path: str):
        repo_config = _get_repo_config(workspace_config, repo)
        repo_root = Path(repo_config.root).resolve()
        _resolve_repo_file(repo_root, path)

        notes_path = _notes_file_path(repo_root)
        data = _read_notes_file(notes_path)
        notes = data.get("documents", {}).get(path, [])
        if not isinstance(notes, list):
            notes = []
        return {"notes": notes}

    @app.post("/api/notes")
    async def create_note(request: dict[str, Any]):
        repo = request.get("repo")
        path = request.get("path")
        note = request.get("note")

        if not repo or not path or not isinstance(note, dict):
            raise HTTPException(status_code=400, detail="repo, path and note are required")

        repo_config = _get_repo_config(workspace_config, repo)
        repo_root = Path(repo_config.root).resolve()
        _resolve_repo_file(repo_root, path)

        notes_path = _notes_file_path(repo_root)
        data = _read_notes_file(notes_path)
        notes = _get_document_notes(data, path)

        payload = _build_note_payload(note)
        notes.append(payload)
        _write_notes_file(notes_path, data)

        return {"note": payload}

    @app.put("/api/notes/{note_id}")
    async def update_note(note_id: str, request: dict[str, Any]):
        repo = request.get("repo")
        path = request.get("path")
        note = request.get("note")

        if not repo or not path or not isinstance(note, dict):
            raise HTTPException(status_code=400, detail="repo, path and note are required")

        repo_config = _get_repo_config(workspace_config, repo)
        repo_root = Path(repo_config.root).resolve()
        _resolve_repo_file(repo_root, path)

        notes_path = _notes_file_path(repo_root)
        data = _read_notes_file(notes_path)
        notes = _get_document_notes(data, path)

        index = next((i for i, item in enumerate(notes) if item.get("id") == note_id), None)
        if index is None:
            raise HTTPException(status_code=404, detail="Note not found")

        content = _normalize_content(note)
        if not content:
            notes.pop(index)
            _write_notes_file(notes_path, data)
            return {"deleted": True}

        payload = _build_note_payload(note, existing=notes[index])
        payload["id"] = note_id
        notes[index] = payload
        _write_notes_file(notes_path, data)

        return {"deleted": False, "note": payload}

    @app.delete("/api/notes/{note_id}")
    async def delete_note(note_id: str, repo: str, path: str):
        repo_config = _get_repo_config(workspace_config, repo)
        repo_root = Path(repo_config.root).resolve()
        _resolve_repo_file(repo_root, path)

        notes_path = _notes_file_path(repo_root)
        data = _read_notes_file(notes_path)
        notes = _get_document_notes(data, path)

        index = next((i for i, item in enumerate(notes) if item.get("id") == note_id), None)
        if index is None:
            raise HTTPException(status_code=404, detail="Note not found")

        notes.pop(index)
        _write_notes_file(notes_path, data)
        return {"success": True}
