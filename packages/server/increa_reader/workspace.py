"""
Workspace management and file tree functionality
"""

import json
import os
from pathlib import Path
from typing import List

from .models import RepoItem, TreeNode, WorkspaceConfig

DEFAULT_EXCLUDES = ["node_modules", ".*", "*.log"]


def get_config_path() -> Path:
    return Path.home() / ".increa-reader" / "config.json"


def save_workspace_config(repos: List[RepoItem]) -> None:
    """Save repo paths to ~/.increa-reader/config.json"""
    config_path = get_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    data = {"repos": [{"path": repo.root} for repo in repos]}
    config_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _load_repos_from_config() -> List[RepoItem] | None:
    """Try loading repos from config.json, return None if not found"""
    config_path = get_config_path()
    if not config_path.exists():
        return None
    try:
        data = json.loads(config_path.read_text())
        repos = []
        for entry in data.get("repos", []):
            path_obj = Path(entry["path"]).resolve()
            repos.append(RepoItem(name=path_obj.name, root=str(path_obj)))
        return repos
    except (json.JSONDecodeError, KeyError):
        return None


def _load_repos_from_env() -> List[RepoItem]:
    """Load repos from INCREA_REPO environment variable"""
    increa_repo = os.getenv("INCREA_REPO", "")
    if not increa_repo:
        return []
    repos = []
    for repo_path in increa_repo.split(":"):
        repo_path = repo_path.strip()
        if not repo_path:
            continue
        path_obj = Path(repo_path).resolve()
        if path_obj.exists():
            repos.append(RepoItem(name=path_obj.name, root=str(path_obj)))
    return repos


def load_workspace_config() -> WorkspaceConfig:
    """Load workspace config: prioritize config.json, fallback to env var"""
    repos = _load_repos_from_config()
    if repos is None:
        repos = _load_repos_from_env()
    return WorkspaceConfig(title="Increa Reader", repos=repos, excludes=DEFAULT_EXCLUDES)


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
