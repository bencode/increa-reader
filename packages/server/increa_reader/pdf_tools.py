"""
PDF Tools using Claude Agent SDK @tool decorator
"""

import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from claude_agent_sdk import tool

# Global document store
documents: dict[str, fitz.Document] = {}


def _validate_doc_id(doc_id: str) -> fitz.Document:
    """Validate and return document by ID"""
    if doc_id not in documents:
        raise ValueError(f"Invalid doc_id: {doc_id}")
    return documents[doc_id]


def _validate_page_range(doc: fitz.Document, page: int) -> None:
    """Validate page number is within document range"""
    if page < 1 or page > doc.page_count:
        raise ValueError(f"Page {page} out of range (1-{doc.page_count})")


def _is_allowed_path(path: str) -> bool:
    """Check if path is allowed (workspace directories or temp)"""
    path_obj = Path(path).resolve()

    # Allow workspace directories from environment
    workspace_paths = os.getenv("INCREA_REPO", "").split(":")
    for workspace in workspace_paths:
        if workspace and path_obj.is_relative_to(Path(workspace).resolve()):
            return True

    # Allow temp directory
    if path_obj.is_relative_to(Path(tempfile.gettempdir()).resolve()):
        return True

    return False


@tool("open_pdf", "Open a PDF file and return a document ID", {"path": str})
async def open_pdf(args: dict[str, Any]) -> dict[str, Any]:
    """Open a PDF file and return a document ID"""
    path = args["path"]

    if not _is_allowed_path(path):
        return {
            "content": [{"type": "text", "text": f"Access denied: {path}"}],
            "is_error": True,
        }

    try:
        doc = fitz.open(path)
        doc_id = str(uuid.uuid4())
        documents[doc_id] = doc
        return {"content": [{"type": "text", "text": doc_id}]}
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Failed to open PDF: {e}"}],
            "is_error": True,
        }


@tool("page_count", "Get the number of pages in a PDF document", {"doc_id": str})
async def page_count(args: dict[str, Any]) -> dict[str, Any]:
    """Get the number of pages in a PDF document"""
    try:
        doc = _validate_doc_id(args["doc_id"])
        return {"content": [{"type": "text", "text": str(doc.page_count)}]}
    except ValueError as e:
        return {"content": [{"type": "text", "text": str(e)}], "is_error": True}


@tool("extract_text", "Extract text from a specific page", {"doc_id": str, "page": int})
async def extract_text(args: dict[str, Any]) -> dict[str, Any]:
    """Extract text from a specific page (1-based page number)"""
    try:
        doc = _validate_doc_id(args["doc_id"])
        page = args["page"]
        _validate_page_range(doc, page)
        text = doc[page - 1].get_text()
        return {"content": [{"type": "text", "text": text}]}
    except (ValueError, KeyError) as e:
        return {"content": [{"type": "text", "text": str(e)}], "is_error": True}


@tool(
    "render_page_png",
    "Render a page as PNG image",
    {
        "type": "object",
        "properties": {
            "doc_id": {"type": "string"},
            "page": {"type": "integer"},
            "dpi": {"type": "integer", "default": 144},
        },
        "required": ["doc_id", "page"],
    },
)
async def render_page_png(args: dict[str, Any]) -> dict[str, Any]:
    """Render a page as PNG image and return markdown image link"""
    try:
        doc = _validate_doc_id(args["doc_id"])
        page = args["page"]
        dpi = args.get("dpi", 144)
        _validate_page_range(doc, page)

        pix = doc[page - 1].get_pixmap(dpi=dpi)
        filename = f"pdf_page_{page}_{uuid.uuid4().hex[:8]}.png"
        temp_file = Path(tempfile.gettempdir()) / filename
        pix.save(temp_file)

        # Return markdown image format for browser access
        markdown_img = f"![PDF Page {page}](/api/temp-image/{filename})"
        return {"content": [{"type": "text", "text": markdown_img}]}
    except (ValueError, KeyError) as e:
        return {"content": [{"type": "text", "text": str(e)}], "is_error": True}


@tool(
    "search_text",
    "Search for text in the PDF document",
    {
        "type": "object",
        "properties": {
            "doc_id": {"type": "string"},
            "query": {"type": "string"},
            "max_hits": {"type": "integer", "default": 20},
        },
        "required": ["doc_id", "query"],
    },
)
async def search_text(args: dict[str, Any]) -> dict[str, Any]:
    """Search for text in the PDF document"""
    query_text = args.get("query")
    if not query_text:
        return {
            "content": [{"type": "text", "text": "Missing parameter: query"}],
            "is_error": True,
        }

    try:
        doc = _validate_doc_id(args["doc_id"])
        max_hits = args.get("max_hits", 20)
        results = []

        for page_num in range(doc.page_count):
            page = doc[page_num]
            for inst in page.search_for(query_text):
                surrounding_rect = fitz.Rect(
                    inst.x0 - 50, inst.y0 - 20, inst.x1 + 50, inst.y1 + 20
                )
                surrounding_text = page.get_text("text", clip=surrounding_rect)
                results.append(
                    {
                        "page": page_num + 1,
                        "text": surrounding_text.strip(),
                        "bbox": [inst.x0, inst.y0, inst.x1, inst.y1],
                    }
                )
                if len(results) >= max_hits:
                    break
            if len(results) >= max_hits:
                break

        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(results, indent=2, ensure_ascii=False),
                }
            ]
        }
    except (ValueError, KeyError) as e:
        return {"content": [{"type": "text", "text": str(e)}], "is_error": True}


@tool("close_pdf", "Close a PDF document and free resources", {"doc_id": str})
async def close_pdf(args: dict[str, Any]) -> dict[str, Any]:
    """Close a PDF document and free resources"""
    try:
        doc = _validate_doc_id(args["doc_id"])
        doc.close()
        del documents[args["doc_id"]]
        return {"content": [{"type": "text", "text": "Document closed successfully"}]}
    except ValueError as e:
        return {"content": [{"type": "text", "text": str(e)}], "is_error": True}
