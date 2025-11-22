import json
import os
from pathlib import Path
from typing import Any

from fastapi import HTTPException


def create_session_routes(app, workspace_config):
    """Create session management routes"""

    def get_sessions_dir() -> Path:
        """Get sessions directory path"""
        logs_path = os.getenv("CHAT_LOGS_DIR", "chat-logs")
        logs_dir = Path(logs_path).expanduser()
        sessions_dir = logs_dir / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        return sessions_dir

    def get_sessions_meta_file() -> Path:
        """Get sessions metadata file path"""
        logs_path = os.getenv("CHAT_LOGS_DIR", "chat-logs")
        logs_dir = Path(logs_path).expanduser()
        logs_dir.mkdir(parents=True, exist_ok=True)
        return logs_dir / "sessions.json"

    def get_session_file(session_id: str) -> Path:
        """Get individual session file path"""
        sessions_dir = get_sessions_dir()
        return sessions_dir / f"session_{session_id}.json"

    @app.get("/api/sessions")
    async def get_sessions_metadata():
        """Get all sessions metadata (lightweight list)"""
        meta_file = get_sessions_meta_file()
        if not meta_file.exists():
            return {"sessions": [], "lastActiveSessionId": None}

        with open(meta_file, "r", encoding="utf-8") as f:
            return json.load(f)

    @app.get("/api/sessions/{session_id}")
    async def get_session(session_id: str):
        """Get full session data by ID"""
        session_file = get_session_file(session_id)
        if not session_file.exists():
            raise HTTPException(status_code=404, detail="Session not found")

        with open(session_file, "r", encoding="utf-8") as f:
            return json.load(f)

    @app.put("/api/sessions/{session_id}")
    async def save_session(session_id: str, data: dict[str, Any]):
        """Save/update session data"""
        session_file = get_session_file(session_id)

        # Save full session data
        with open(session_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Update metadata
        meta_file = get_sessions_meta_file()
        if meta_file.exists():
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        else:
            meta = {"sessions": [], "lastActiveSessionId": None}

        # Update or add session in metadata
        session_meta = {
            "id": session_id,
            "title": data.get("title", "New Chat"),
            "createdAt": data.get("createdAt"),
            "lastActiveAt": data.get("lastActiveAt"),
        }

        existing_idx = next(
            (i for i, s in enumerate(meta["sessions"]) if s["id"] == session_id), None
        )
        if existing_idx is not None:
            meta["sessions"][existing_idx] = session_meta
        else:
            meta["sessions"].append(session_meta)

        # Update lastActiveSessionId
        meta["lastActiveSessionId"] = session_id

        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        return {"success": True}

    @app.delete("/api/sessions/{session_id}")
    async def delete_session(session_id: str):
        """Delete a session"""
        session_file = get_session_file(session_id)
        if not session_file.exists():
            raise HTTPException(status_code=404, detail="Session not found")

        # Delete session file
        session_file.unlink()

        # Update metadata
        meta_file = get_sessions_meta_file()
        if meta_file.exists():
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)

            meta["sessions"] = [s for s in meta["sessions"] if s["id"] != session_id]

            if meta["lastActiveSessionId"] == session_id:
                meta["lastActiveSessionId"] = (
                    meta["sessions"][0]["id"] if meta["sessions"] else None
                )

            with open(meta_file, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

        return {"success": True}
