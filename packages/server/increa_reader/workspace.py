"""
Workspace management and file tree functionality
"""

import os
from pathlib import Path
from typing import List

from .models import RepoItem, TreeNode, WorkspaceConfig


def load_workspace_config() -> WorkspaceConfig:
    """Load workspace configuration from environment variables"""

    # Parse INCREA_REPO environment variable (colon-separated paths)
    increa_repo = os.getenv("INCREA_REPO", "")
    if increa_repo:
        repo_paths = [path.strip() for path in increa_repo.split(":") if path.strip()]
        repos = []

        for i, repo_path in enumerate(repo_paths):
            path_obj = Path(repo_path).resolve()
            if path_obj.exists():
                repos.append(RepoItem(name=path_obj.name, root=str(path_obj)))

        return WorkspaceConfig(
            title="Increa Reader", repos=repos, excludes=["node_modules", ".*", "*.log"]
        )

    return WorkspaceConfig(
        title="Increa Reader", repos=[], excludes=["node_modules", ".*", "*.log"]
    )


def is_text_file(content: bytes) -> bool:
    """Check if file content is text-based"""
    try:
        content.decode("utf-8")
        return True
    except UnicodeDecodeError:
        # Check for common binary file signatures
        binary_signatures = [
            b"\x89PNG",  # PNG
            b"\xff\xd8\xff",  # JPEG
            b"%PDF",  # PDF
            b"GIF8",  # GIF
        ]
        return not any(content.startswith(sig) for sig in binary_signatures)


def build_file_tree(
    dir_path: Path, relative_to: Path, excludes: List[str]
) -> List[TreeNode]:
    """Recursively build file tree"""
    nodes = []

    try:
        for item in dir_path.iterdir():
            # Skip excluded files/directories
            if any(item.name.startswith(exclude.rstrip("*")) for exclude in excludes):
                continue

            relative_path = str(item.relative_to(relative_to))

            if item.is_dir():
                children = build_file_tree(item, relative_to, excludes)
                nodes.append(
                    TreeNode(
                        type="dir",
                        name=item.name,
                        path=relative_path,
                        children=children,
                    )
                )
            else:
                nodes.append(TreeNode(type="file", name=item.name, path=relative_path))
    except PermissionError:
        pass

    # Sort: directories first, then files (both alphabetically)
    nodes.sort(key=lambda x: (x.type != "dir", x.name.lower()))
    return nodes
