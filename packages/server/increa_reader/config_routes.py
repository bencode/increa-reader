"""
Configuration API routes
"""

from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

from .models import RepoItem, WorkspaceConfig
from .workspace import load_api_settings, save_api_settings, save_workspace_config


class RepoEntry(BaseModel):
    path: str


class UpdateReposRequest(BaseModel):
    repos: list[RepoEntry]


class ApiSettingsRequest(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    default_model: str | None = None


def _mask_api_key(key: str | None) -> str | None:
    """Mask API key for display: 'sk-ant-api03-xxxxx' → 'sk-ant-a...yyyy'"""
    if not key or len(key) < 12:
        return key
    return key[:7] + "..." + key[-4:]


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

    @app.get("/api/config/api-settings")
    async def get_api_settings():
        """Get API settings with masked API key"""
        settings = load_api_settings()
        return {
            "base_url": settings.get("base_url"),
            "api_key": _mask_api_key(settings.get("api_key")),
            "default_model": settings.get("default_model"),
        }

    @app.put("/api/config/api-settings")
    async def update_api_settings(request: ApiSettingsRequest):
        """Update API settings.

        api_key handling:
        - None  → not sent, keep existing key
        - ""    → explicitly clear the key
        - "xxx" → set new key (ignoring masked values containing "...")
        """
        current = load_api_settings()
        updated = {
            "base_url": request.base_url,
            "default_model": request.default_model,
        }
        if request.api_key is None:
            updated["api_key"] = current.get("api_key")
        elif request.api_key == "":
            updated["api_key"] = None
        elif "..." not in request.api_key:
            updated["api_key"] = request.api_key
        else:
            updated["api_key"] = current.get("api_key")
        save_api_settings(updated)
        return {
            "base_url": updated["base_url"],
            "api_key": _mask_api_key(updated.get("api_key")),
            "default_model": updated["default_model"],
        }
