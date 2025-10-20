#!/usr/bin/env python3
"""
File viewing and preview API endpoints
"""

import json
import mimetypes
from pathlib import Path
from typing import Dict, Any

import aiofiles
import fitz  # PyMuPDF
from fastapi import HTTPException
from fastapi.responses import Response

from .models import ViewResponse, WorkspaceConfig, RepoItem, RepoResource
from .workspace import build_file_tree, is_text_file
from .pdf_processor import extract_page_markdown, render_page_svg


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


def create_view_routes(app, workspace_config: WorkspaceConfig):
    """Create file viewing and preview API routes"""

    @app.get("/api/views/{repo}/{path:path}")
    async def get_file_content(repo: str, path: str):
        """Get file content"""
        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(status_code=404, detail=f"Repository '{repo}' not found")

        file_path = Path(repo_config.root) / path

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        # Read file content
        async with aiofiles.open(file_path, 'rb') as f:
            content = await f.read()

        if is_text_file(content):
            return ViewResponse(
                type="text",
                content=content.decode('utf-8', errors='replace'),
                filename=Path(path).name
            )
        else:
            return ViewResponse(
                type="binary",
                content="[Binary file - preview not available]",
                filename=Path(path).name
            )

    # Extension to language mapping for code files
    EXT_TO_LANG = {
        '.js': 'javascript', '.jsx': 'jsx', '.mjs': 'javascript', '.cjs': 'javascript',
        '.ts': 'typescript', '.tsx': 'tsx', '.mts': 'typescript', '.cts': 'typescript',
        '.py': 'python', '.pyi': 'python',
        '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
        '.h': 'c', '.hpp': 'cpp', '.hh': 'cpp',
        '.go': 'go', '.rs': 'rust', '.php': 'php',
        '.html': 'html', '.htm': 'html',
        '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less',
        '.json': 'json', '.jsonc': 'json',
        '.yaml': 'yaml', '.yml': 'yaml',
        '.xml': 'xml', '.svg': 'xml',
        '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash', '.fish': 'bash',
        '.vim': 'vim', '.vimrc': 'vim',
        '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini', '.conf': 'ini',
        '.txt': 'text', '.log': 'text',
        '.nu': 'bash',
        '.sql': 'sql',
        '.dockerfile': 'dockerfile',
        '.gitignore': 'text', '.gitattributes': 'text',
        '.env': 'bash', '.envrc': 'bash',
        '.rb': 'ruby', '.rake': 'ruby',
        '.lua': 'lua',
        '.pl': 'perl', '.pm': 'perl',
        '.r': 'r',
        '.swift': 'swift',
        '.kt': 'kotlin', '.kts': 'kotlin',
        '.scala': 'scala',
        '.clj': 'clojure', '.cljs': 'clojure',
        '.ex': 'elixir', '.exs': 'elixir',
        '.erl': 'erlang', '.hrl': 'erlang',
        '.hs': 'haskell',
        '.elm': 'elm',
        '.dart': 'dart',
        '.proto': 'protobuf',
        '.graphql': 'graphql', '.gql': 'graphql',
    }

    # Special filenames (without extension) to language mapping
    FILENAME_TO_LANG = {
        'makefile': 'makefile',
        'dockerfile': 'dockerfile',
        'cmakelists.txt': 'cmake',
        'gemfile': 'ruby', 'rakefile': 'ruby', 'vagrantfile': 'ruby',
        'podfile': 'ruby',
        'brewfile': 'ruby',
    }

    @app.get("/api/preview")
    async def get_file_preview(repo: str, path: str):
        """Get file preview information"""
        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(status_code=404, detail=f"Repository '{repo}' not found")

        file_path = Path(repo_config.root) / path

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        ext = Path(path).suffix.lower()
        filename = Path(path).name.lower()

        # Image files (excluding SVG which is text/XML)
        image_exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico']
        if ext in image_exts:
            return {"type": "image", "path": path}

        # PDF files
        if ext == '.pdf':
            return await get_pdf_metadata(file_path, path)

        # Markdown files
        if ext in ['.md', '.markdown']:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
            return {"type": "markdown", "body": content}

        # Known code/text files by extension or filename
        lang = FILENAME_TO_LANG.get(filename) or EXT_TO_LANG.get(ext)
        if lang:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
            return {"type": "code", "lang": lang, "body": content}

        # Unknown extension: check MIME type first
        mime, _ = mimetypes.guess_type(str(file_path))

        # If MIME type is known and not text/*, treat as unsupported
        if mime is not None and not mime.startswith("text"):
            return {"type": "unsupported", "path": path}

        # MIME is text/* or unknown, verify with content detection
        async with aiofiles.open(file_path, 'rb') as f:
            content_bytes = await f.read()

        if is_text_file(content_bytes):
            content = content_bytes.decode('utf-8', errors='replace')
            return {"type": "code", "lang": "text", "body": content}

        return {"type": "unsupported", "path": path}

    @app.get("/api/pdf/page")
    async def get_pdf_page_content(repo: str, path: str, page: int):
        """获取PDF指定页面的Markdown内容"""
        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(status_code=404, detail=f"Repository '{repo}' not found")

        file_path = Path(repo_config.root) / path

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        # 确保是PDF文件
        if file_path.suffix.lower() != '.pdf':
            raise HTTPException(status_code=400, detail="Not a PDF file")

        # 验证页码
        if page < 1:
            raise HTTPException(status_code=400, detail="Page number must be >= 1")

        try:
            # 使用PDF处理器提取页面内容
            result = extract_page_markdown(str(file_path), page)

            return {
                "type": "markdown",
                "body": result["markdown"],
                "page": result["page"],
                "has_tables": result["has_tables"],
                "has_images": result["has_images"],
                "estimated_reading_time": result["estimated_reading_time"]
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process PDF page: {str(e)}")

    @app.get("/api/pdf/page-render")
    async def get_pdf_page_render(repo: str, path: str, page: int):
        """渲染PDF页面为SVG矢量图"""
        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(status_code=404, detail=f"Repository '{repo}' not found")

        file_path = Path(repo_config.root) / path

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        # 确保是PDF文件
        if file_path.suffix.lower() != '.pdf':
            raise HTTPException(status_code=400, detail="Not a PDF file")

        # 验证页码
        if page < 1:
            raise HTTPException(status_code=400, detail="Page number must be >= 1")

        try:
            svg_content = render_page_svg(str(file_path), page)
            return Response(content=svg_content, media_type="image/svg+xml")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to render PDF page: {str(e)}")

    @app.get("/api/temp-image/{filepath:path}")
    async def get_temp_image(filepath: str):
        """获取PDF提取的临时图片"""
        import tempfile
        from pathlib import Path

        # 验证文件路径安全性（防止路径遍历）
        if ".." in filepath or filepath.startswith("/") or filepath.startswith("\\"):
            raise HTTPException(status_code=400, detail="Invalid filepath")

        # 构建临时文件路径
        temp_dir = Path(tempfile.gettempdir())
        img_path = temp_dir / filepath

        # 确保路径在临时目录内（安全检查）
        try:
            img_path = img_path.resolve()
            if not str(img_path).startswith(str(temp_dir.resolve())):
                raise HTTPException(status_code=400, detail="Invalid filepath")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid filepath")

        if not img_path.exists() or not img_path.is_file():
            raise HTTPException(status_code=404, detail="Image not found")

        # 读取并返回图片
        try:
            with open(img_path, 'rb') as f:
                image_data = f.read()
            return Response(content=image_data, media_type="image/png")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read image: {str(e)}")


async def get_pdf_metadata(file_path: Path, path: str) -> Dict[str, Any]:
    """获取PDF文件的元数据"""
    try:
        doc = fitz.open(file_path)

        # 提取元数据
        metadata = doc.metadata

        return {
            "type": "pdf",
            "path": path,
            "metadata": {
                "page_count": doc.page_count,
                "title": metadata.get('title', ''),
                "author": metadata.get('author', ''),
                "subject": metadata.get('subject', ''),
                "creator": metadata.get('creator', ''),
                "producer": metadata.get('producer', ''),
                "creation_date": metadata.get('creationDate', ''),
                "modification_date": metadata.get('modDate', ''),
                "encrypted": doc.is_encrypted
            }
        }
    except Exception as e:
        # 如果无法读取PDF元数据，返回基本信息
        return {
            "type": "pdf",
            "path": path,
            "metadata": {
                "page_count": 0,
                "error": f"无法读取PDF元数据: {str(e)}"
            }
        }