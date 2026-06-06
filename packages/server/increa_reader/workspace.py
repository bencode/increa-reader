"""
Workspace management and file tree functionality
"""

import json
import os
from collections import defaultdict
from pathlib import Path
from typing import List

from .models import RepoItem, TreeNode, WorkspaceConfig

DEFAULT_EXCLUDES = ["node_modules", ".*", "*.log"]


def get_config_path() -> Path:
    return Path.home() / ".increa-reader" / "config.json"


def load_raw_config() -> dict:
    """Read full config.json, return {} if missing or invalid"""
    config_path = get_config_path()
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def save_raw_config(data: dict) -> None:
    """Write full config.json"""
    config_path = get_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def save_workspace_config(repos: List[RepoItem]) -> None:
    """Save repo paths to ~/.increa-reader/config.json"""
    data = load_raw_config()
    data["repos"] = [{"path": repo.root} for repo in repos]
    save_raw_config(data)


def load_api_settings() -> dict:
    """Read config['api_settings'], return {} if absent"""
    return load_raw_config().get("api_settings", {})


def build_sdk_env() -> dict[str, str]:
    """Build env dict for Claude SDK.

    The SDK *merges* this dict over the inherited process env, so masking an
    inherited variable requires explicitly passing "" — dropping the key only
    leaves the parent's value in place. Hence None means "omit" while ""
    means "mask".
    """
    api_settings = load_api_settings()
    # Config first: a token in config.json always matches config's base_url.
    # Shell env is unreliable here — multiple provider blocks in .zshrc can
    # leave a token that belongs to a different base_url.
    auth_token = api_settings.get("auth_token") or os.getenv("ANTHROPIC_AUTH_TOKEN")
    api_key = api_settings.get("api_key") or os.getenv("ANTHROPIC_API_KEY")
    return {
        k: v
        for k, v in {
            "ANTHROPIC_BASE_URL": api_settings.get("base_url")
            or os.getenv("ANTHROPIC_BASE_URL"),
            # Use exactly one credential: AUTH_TOKEN takes priority (proxy mode),
            # otherwise fall back to API_KEY. Mask the loser with "" so an
            # inherited value can't surface — the CLI errors on conflicting
            # credentials.
            "ANTHROPIC_AUTH_TOKEN": auth_token or "",
            "ANTHROPIC_API_KEY": "" if auth_token else (api_key or ""),
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": api_settings.get("haiku_model")
            or os.getenv("ANTHROPIC_DEFAULT_HAIKU_MODEL"),
            "ANTHROPIC_DEFAULT_SONNET_MODEL": api_settings.get("sonnet_model")
            or os.getenv("ANTHROPIC_DEFAULT_SONNET_MODEL"),
            "ANTHROPIC_DEFAULT_OPUS_MODEL": api_settings.get("opus_model")
            or os.getenv("ANTHROPIC_DEFAULT_OPUS_MODEL"),
            # Mask nested-session detection when server runs inside a Claude
            # Code terminal (CLAUDECODE=1). SDK >= 0.2.x strips this itself,
            # but keep the mask for older SDKs.
            "CLAUDECODE": "",
        }.items()
        if v is not None
    }


def save_api_settings(settings: dict) -> None:
    """Merge api_settings into config and write"""
    data = load_raw_config()
    data["api_settings"] = settings
    save_raw_config(data)


def _display_name(path: Path, depth: int) -> str:
    """Build a display name from the last `depth` path segments.

    depth=1 → bare basename (e.g. "docs"); deeper levels append parent
    context in parens joined by ":" (e.g. "docs (projectA)", "docs (x:projA)").
    ":" is used instead of "/" so the name stays URL-safe and never breaks
    the single-segment ":repoName" route.
    """
    parts = path.parts
    basename = parts[-1]
    parents = [p for p in parts[max(0, len(parts) - depth) : -1] if p != "/"]
    if depth <= 1 or not parents:
        return basename
    return f"{basename} ({':'.join(parents)})"


def _unique_repo_names(paths: List[Path]) -> List[str]:
    """Assign collision-free names by climbing parent dirs until unique."""
    depths = [1] * len(paths)
    while True:
        names = [_display_name(p, d) for p, d in zip(paths, depths)]
        groups: dict[str, List[int]] = defaultdict(list)
        for i, name in enumerate(names):
            groups[name].append(i)

        progressed = False
        for indices in groups.values():
            if len(indices) <= 1:
                continue
            # Climb one more level for any member that still has room
            for i in indices:
                if depths[i] < len(paths[i].parts):
                    depths[i] += 1
                    progressed = True
        if not progressed:
            break

    # Final safety net: append a counter to any names still colliding
    seen: dict[str, int] = {}
    result = []
    for name in names:
        if name in seen:
            seen[name] += 1
            result.append(f"{name} {seen[name]}")
        else:
            seen[name] = 1
            result.append(name)
    return result


def build_repo_items(paths: List[str]) -> List[RepoItem]:
    """Resolve paths, dedupe identical ones, assign collision-free names."""
    resolved: List[Path] = []
    seen: set[str] = set()
    for raw in paths:
        path_obj = Path(raw).resolve()
        key = str(path_obj)
        if key in seen:
            continue
        seen.add(key)
        resolved.append(path_obj)

    names = _unique_repo_names(resolved)
    return [
        RepoItem(name=name, root=str(path)) for name, path in zip(names, resolved)
    ]


def _load_repos_from_config() -> List[RepoItem] | None:
    """Try loading repos from config.json, return None if not found"""
    data = load_raw_config()
    if not data or "repos" not in data:
        return None
    try:
        return build_repo_items([entry["path"] for entry in data["repos"]])
    except KeyError:
        return None


def _load_repos_from_env() -> List[RepoItem]:
    """Load repos from INCREA_REPO environment variable"""
    increa_repo = os.getenv("INCREA_REPO", "")
    if not increa_repo:
        return []
    paths = [p.strip() for p in increa_repo.split(":") if p.strip()]
    existing = [p for p in paths if Path(p).resolve().exists()]
    return build_repo_items(existing)


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
