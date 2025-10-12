#!/usr/bin/env python3
"""
File viewing and preview API endpoints
"""

import json
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

        # File type detection logic
        ext = Path(path).suffix.lower()

        # Image files
        image_exts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']
        if ext in image_exts:
            return {"type": "image", "path": path}

        # Markdown files
        if ext in ['.md', '.markdown']:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
            return {"type": "markdown", "body": content}

        # Code files (simplified language detection)
        code_langs = {
            '.js': 'javascript', '.jsx': 'jsx',
            '.ts': 'typescript', '.tsx': 'tsx',
            '.py': 'python', '.java': 'java',
            '.c': 'c', '.cpp': 'cpp', '.h': 'c',
            '.go': 'go', '.rs': 'rust', '.php': 'php',
            '.html': 'html', '.css': 'css', '.json': 'json',
            '.yaml': 'yaml', '.yml': 'yaml', '.xml': 'xml'
        }

        if ext in code_langs:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
            return {"type": "code", "lang": code_langs[ext], "body": content}

        # PDF files - special handling
        if ext == '.pdf':
            return await get_pdf_metadata(file_path, path)

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