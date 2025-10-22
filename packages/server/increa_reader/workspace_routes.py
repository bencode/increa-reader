"""
Workspace API routes
"""

from pathlib import Path

from fastapi import HTTPException

from .models import RepoResource, WorkspaceConfig
from .workspace import build_file_tree


def create_workspace_routes(app, workspace_config: WorkspaceConfig):
    """Create workspace-related API routes"""

    @app.get("/api/workspace/repos")
    async def get_repos():
        """Get list of repositories"""
        return {"data": [{"name": repo.name, "root": repo.root} for repo in workspace_config.repos]}

    @app.get("/api/workspace/repos/{repo_name}/tree")
    async def get_repo_tree(repo_name: str):
        """Get file tree for a specific repository"""
        repo = next((r for r in workspace_config.repos if r.name == repo_name), None)
        if not repo:
            raise HTTPException(status_code=404, detail=f"Repository '{repo_name}' not found")

        repo_path = Path(repo.root)
        if not repo_path.exists():
            raise HTTPException(status_code=404, detail=f"Repository path does not exist: {repo.root}")

        files = build_file_tree(repo_path, repo_path, workspace_config.excludes)
        return {"data": {"name": repo.name, "files": files}}

    @app.get("/api/workspace/tree")
    async def get_workspace_tree():
        """Get workspace file tree (legacy endpoint, kept for backward compatibility)"""
        result = []

        for repo in workspace_config.repos:
            repo_path = Path(repo.root)
            if repo_path.exists():
                files = build_file_tree(repo_path, repo_path, workspace_config.excludes)
                result.append(RepoResource(name=repo.name, files=files))

        return {"data": result}
