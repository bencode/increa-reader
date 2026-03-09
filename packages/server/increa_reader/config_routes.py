"""
Configuration API routes
"""

from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

from .models import RepoItem, WorkspaceConfig
from .workspace import save_workspace_config


class RepoEntry(BaseModel):
    path: str


class UpdateReposRequest(BaseModel):
    repos: list[RepoEntry]


def create_config_routes(app: FastAPI, workspace_config: WorkspaceConfig):
    """Create configuration-related API routes"""

    @app.get("/api/config/repos")
    async def get_config_repos():
        """Get configured repositories with existence check"""
        return {
            "data": [
                {
                    "name": repo.name,
                    "root": repo.root,
                    "exists": Path(repo.root).exists(),
                }
                for repo in workspace_config.repos
            ]
        }

    @app.put("/api/config/repos")
    async def update_config_repos(request: UpdateReposRequest):
        """Update repository configuration"""
        new_repos = []
        for entry in request.repos:
            path_obj = Path(entry.path).resolve()
            new_repos.append(RepoItem(name=path_obj.name, root=str(path_obj)))

        save_workspace_config(new_repos)

        # In-place update so all route handlers see the change immediately
        workspace_config.repos.clear()
        workspace_config.repos.extend(new_repos)

        return {
            "data": [
                {
                    "name": repo.name,
                    "root": repo.root,
                    "exists": Path(repo.root).exists(),
                }
                for repo in workspace_config.repos
            ]
        }
