"""
Board file save API routes
"""

import json
from pathlib import Path

from fastapi import HTTPException

from .models import WorkspaceConfig


def create_board_routes(app, workspace_config: WorkspaceConfig):
    """Create board-related API routes"""

    @app.post("/api/board/save")
    async def save_board(request: dict):
        """Save board data to a .board file in the repo"""
        repo_name = request.get("repo")
        path = request.get("path")
        data = request.get("data")

        if not data:
            raise HTTPException(status_code=400, detail="data is required")

        if repo_name and path:
            # Save to specific repo path
            repo_config = next(
                (r for r in workspace_config.repos if r.name == repo_name), None
            )
            if not repo_config:
                raise HTTPException(status_code=404, detail="Repository not found")

            file_path = (Path(repo_config.root) / path).resolve()
            repo_root = Path(repo_config.root).resolve()
            if not str(file_path).startswith(str(repo_root)):
                raise HTTPException(status_code=403, detail="Access denied")
            file_path.parent.mkdir(parents=True, exist_ok=True)
        else:
            # Save to first repo's .increa/boards/
            if not workspace_config.repos:
                raise HTTPException(status_code=400, detail="No repositories configured")

            repo_root = Path(workspace_config.repos[0].root)
            boards_dir = repo_root / ".increa" / "boards"
            boards_dir.mkdir(parents=True, exist_ok=True)

            filename = request.get("filename", "canvas")
            file_path = boards_dir / f"{filename}.board"

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return {"success": True, "path": str(file_path)}
