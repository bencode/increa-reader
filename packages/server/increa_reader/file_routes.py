"""
File viewing and preview API routes
"""

import mimetypes
from pathlib import Path

import aiofiles
from fastapi import HTTPException
from fastapi.responses import FileResponse

from .models import ViewResponse, WorkspaceConfig
from .workspace import is_text_file

# Extension to language mapping for code files
EXT_TO_LANG = {
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".mts": "typescript",
    ".cts": "typescript",
    ".py": "python",
    ".pyi": "python",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".hh": "cpp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".json": "json",
    ".jsonc": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".svg": "xml",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".fish": "bash",
    ".vim": "vim",
    ".vimrc": "vim",
    ".toml": "toml",
    ".ini": "ini",
    ".cfg": "ini",
    ".conf": "ini",
    ".txt": "text",
    ".log": "text",
    ".nu": "bash",
    ".sql": "sql",
    ".dockerfile": "dockerfile",
    ".gitignore": "text",
    ".gitattributes": "text",
    ".env": "bash",
    ".envrc": "bash",
    ".rb": "ruby",
    ".rake": "ruby",
    ".lua": "lua",
    ".pl": "perl",
    ".pm": "perl",
    ".r": "r",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".scala": "scala",
    ".clj": "clojure",
    ".cljs": "clojure",
    ".ex": "elixir",
    ".exs": "elixir",
    ".erl": "erlang",
    ".hrl": "erlang",
    ".hs": "haskell",
    ".elm": "elm",
    ".dart": "dart",
    ".proto": "protobuf",
    ".graphql": "graphql",
    ".gql": "graphql",
}

# Special filenames (without extension) to language mapping
FILENAME_TO_LANG = {
    "makefile": "makefile",
    "dockerfile": "dockerfile",
    "cmakelists.txt": "cmake",
    "gemfile": "ruby",
    "rakefile": "ruby",
    "vagrantfile": "ruby",
    "podfile": "ruby",
    "brewfile": "ruby",
}


def create_file_routes(app, workspace_config: WorkspaceConfig):
    """Create file viewing and preview API routes"""

    @app.get("/api/raw/{repo}/{path:path}")
    async def get_raw_file(repo: str, path: str):
        """Get raw file content (returns file bytes directly)"""
        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(
                status_code=404, detail=f"Repository '{repo}' not found"
            )

        file_path = Path(repo_config.root) / path

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        # Detect MIME type
        mime_type, _ = mimetypes.guess_type(str(file_path))

        return FileResponse(
            file_path,
            media_type=mime_type or "application/octet-stream",
            filename=file_path.name,
        )

    @app.get("/api/views/{repo}/{path:path}")
    async def get_file_content(repo: str, path: str):
        """Get file content"""
        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(
                status_code=404, detail=f"Repository '{repo}' not found"
            )

        file_path = Path(repo_config.root) / path

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        # Read file content
        async with aiofiles.open(file_path, "rb") as f:
            content = await f.read()

        if is_text_file(content):
            return ViewResponse(
                type="text",
                content=content.decode("utf-8", errors="replace"),
                filename=Path(path).name,
            )
        else:
            return ViewResponse(
                type="binary",
                content="[Binary file - preview not available]",
                filename=Path(path).name,
            )

    @app.get("/api/preview")
    async def get_file_preview(repo: str, path: str):
        """Get file preview information"""
        # Import here to avoid circular dependency
        from .pdf_routes import get_pdf_metadata

        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(
                status_code=404, detail=f"Repository '{repo}' not found"
            )

        file_path = Path(repo_config.root) / path

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        ext = Path(path).suffix.lower()
        filename = Path(path).name.lower()

        # Image files (excluding SVG which is text/XML)
        image_exts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico"]
        if ext in image_exts:
            return {"type": "image", "path": path}

        # PDF files
        if ext == ".pdf":
            return await get_pdf_metadata(file_path, path)

        # Markdown files
        if ext in [".md", ".markdown"]:
            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                content = await f.read()
            return {"type": "markdown", "body": content}

        # Known code/text files by extension or filename
        lang = FILENAME_TO_LANG.get(filename) or EXT_TO_LANG.get(ext)
        if lang:
            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                content = await f.read()
            return {"type": "code", "lang": lang, "body": content}

        # Unknown extension: check MIME type first
        mime, _ = mimetypes.guess_type(str(file_path))

        # If MIME type is known and not text/*, treat as unsupported
        if mime is not None and not mime.startswith("text"):
            return {"type": "unsupported", "path": path}

        # MIME is text/* or unknown, verify with content detection
        async with aiofiles.open(file_path, "rb") as f:
            content_bytes = await f.read()

        if is_text_file(content_bytes):
            content = content_bytes.decode("utf-8", errors="replace")
            return {"type": "code", "lang": "text", "body": content}

        return {"type": "unsupported", "path": path}

    @app.delete("/api/files/{repo}/{path:path}")
    async def delete_file(repo: str, path: str):
        """Delete a file"""
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(
                status_code=404, detail=f"Repository '{repo}' not found"
            )

        file_path = Path(repo_config.root) / path

        # Security check: prevent path traversal
        try:
            file_path = file_path.resolve()
            repo_root = Path(repo_config.root).resolve()
            if not str(file_path).startswith(str(repo_root)):
                raise HTTPException(status_code=403, detail="Access denied")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid path")

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        # Don't allow deleting directories
        if file_path.is_dir():
            raise HTTPException(
                status_code=400, detail="Cannot delete directories"
            )

        try:
            file_path.unlink()
            return {"success": True, "path": path}
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
