"""
PDF viewing and processing API routes
"""

import tempfile
from pathlib import Path
from typing import Any, Dict

import fitz  # PyMuPDF
from fastapi import HTTPException
from fastapi.responses import Response

from .models import WorkspaceConfig
from .pdf_processor import extract_page_markdown, render_page_svg


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
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "subject": metadata.get("subject", ""),
                "creator": metadata.get("creator", ""),
                "producer": metadata.get("producer", ""),
                "creation_date": metadata.get("creationDate", ""),
                "modification_date": metadata.get("modDate", ""),
                "encrypted": doc.is_encrypted,
            },
        }
    except Exception as e:
        # 如果无法读取PDF元数据，返回基本信息
        return {
            "type": "pdf",
            "path": path,
            "metadata": {"page_count": 0, "error": f"无法读取PDF元数据: {str(e)}"},
        }


def create_pdf_routes(app, workspace_config: WorkspaceConfig):
    """Create PDF-related API routes"""

    @app.get("/api/pdf/page")
    async def get_pdf_page_content(repo: str, path: str, page: int):
        """获取PDF指定页面的Markdown内容"""
        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(
                status_code=404, detail=f"Repository '{repo}' not found"
            )

        file_path = Path(repo_config.root) / path

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        # 确保是PDF文件
        if file_path.suffix.lower() != ".pdf":
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
                "estimated_reading_time": result["estimated_reading_time"],
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to process PDF page: {str(e)}"
            )

    @app.get("/api/pdf/page-render")
    async def get_pdf_page_render(repo: str, path: str, page: int):
        """渲染PDF页面为SVG矢量图"""
        # Find repository
        repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
        if not repo_config:
            raise HTTPException(
                status_code=404, detail=f"Repository '{repo}' not found"
            )

        file_path = Path(repo_config.root) / path

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        # 确保是PDF文件
        if file_path.suffix.lower() != ".pdf":
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
            raise HTTPException(
                status_code=500, detail=f"Failed to render PDF page: {str(e)}"
            )

    @app.get("/api/temp-image/{filepath:path}")
    async def get_temp_image(filepath: str):
        """获取PDF提取的临时图片"""
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
            with open(img_path, "rb") as f:
                image_data = f.read()
            return Response(content=image_data, media_type="image/png")
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to read image: {str(e)}"
            )
