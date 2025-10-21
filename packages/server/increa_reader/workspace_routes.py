"""
Workspace API routes
"""

from pathlib import Path

from .models import RepoResource, WorkspaceConfig
from .workspace import build_file_tree


def create_workspace_routes(app, workspace_config: WorkspaceConfig):
    """Create workspace-related API routes"""

    @app.get("/api/workspace/tree")
    async def get_workspace_tree():
        """Get workspace file tree"""
        result = []

        for repo in workspace_config.repos:
            repo_path = Path(repo.root)
            if repo_path.exists():
                files = build_file_tree(repo_path, repo_path, workspace_config.excludes)
                result.append(RepoResource(name=repo.name, files=files))

        return {"data": result}
