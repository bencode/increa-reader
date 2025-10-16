#!/usr/bin/env python3
"""
PDF Reader MCP Server - An MCP server for reading and searching PDF files using FastMCP
"""

import json
import tempfile
import uuid
from pathlib import Path

import fitz  # PyMuPDF
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("pdf-reader")

# Global document store
documents: dict[str, fitz.Document] = {}


def generate_doc_id() -> str:
    return str(uuid.uuid4())


def _validate_doc_id(doc_id: str) -> fitz.Document:
    """Validate and return document by ID"""
    if doc_id not in documents:
        raise ValueError("Invalid or missing doc_id")
    return documents[doc_id]


def _validate_page_range(doc: fitz.Document, page: int) -> None:
    """Validate page number is within document range"""
    if page < 1 or page > doc.page_count:
        raise ValueError(f"Page number out of range. Valid range: 1-{doc.page_count}")


def _is_allowed_path(path: str) -> bool:
    """Check if path is allowed for security"""
    allowed_paths = ["/Users", "/tmp", Path.cwd(), tempfile.gettempdir()]
    return any(
        Path(path).resolve().is_relative_to(Path(allowed_path).resolve()) for allowed_path in allowed_paths
    )


@mcp.tool()
def open_pdf(path: str) -> str:
    """Open a PDF file and return a document ID

    Args:
        path: Path to the PDF file
    """
    if not _is_allowed_path(path):
        raise ValueError(f"Access denied for path: {path}")

    try:
        doc = fitz.open(path)
    except (FileNotFoundError, fitz.FileDataError, fitz.EmptyFileError) as e:
        raise RuntimeError(f"Failed to open PDF: {e}") from None

    doc_id = generate_doc_id()
    documents[doc_id] = doc
    return doc_id


@mcp.tool()
def page_count(doc_id: str) -> int:
    """Get the number of pages in a PDF document

    Args:
        doc_id: Document ID returned by open_pdf
    """
    doc = _validate_doc_id(doc_id)
    return doc.page_count


@mcp.tool()
def extract_text(doc_id: str, page: int) -> str:
    """Extract text from a specific page

    Args:
        doc_id: Document ID returned by open_pdf
        page: Page number (1-based)
    """
    doc = _validate_doc_id(doc_id)
    _validate_page_range(doc, page)

    page_obj = doc[page - 1]
    return page_obj.get_text()


@mcp.tool()
def render_page_png(doc_id: str, page: int, dpi: int = 144) -> str:
    """Render a page as PNG image

    Args:
        doc_id: Document ID returned by open_pdf
        page: Page number (1-based)
        dpi: Resolution in DPI (default: 144)
    """
    doc = _validate_doc_id(doc_id)
    _validate_page_range(doc, page)

    page_obj = doc[page - 1]
    pix = page_obj.get_pixmap(dpi=dpi)

    temp_file = Path(tempfile.gettempdir()) / f"pdf_page_{page}_{uuid.uuid4().hex[:8]}.png"
    pix.save(temp_file)
    return temp_file


@mcp.tool()
def search_text(doc_id: str, query: str, max_hits: int = 20) -> str:
    """Search for text in the PDF document

    Args:
        doc_id: Document ID returned by open_pdf
        query: Text to search for
        max_hits: Maximum number of results (default: 20)
    """
    if not query:
        raise ValueError("Missing required parameter: query")

    doc = _validate_doc_id(doc_id)
    results = []

    for page_num in range(doc.page_count):
        page = doc[page_num]
        text_instances = page.search_for(query)

        for inst in text_instances:
            # Extract surrounding text
            surrounding_rect = fitz.Rect(
                inst.x0 - 50,
                inst.y0 - 20,
                inst.x1 + 50,
                inst.y1 + 20,
            )
            surrounding_text = page.get_text("text", clip=surrounding_rect)

            results.append(
                {
                    "page": page_num + 1,
                    "text": surrounding_text.strip(),
                    "bbox": [inst.x0, inst.y0, inst.x1, inst.y1],
                },
            )

            if len(results) >= max_hits:
                break

        if len(results) >= max_hits:
            break

    return json.dumps(results, indent=2)


@mcp.tool()
def close_pdf(doc_id: str) -> str:
    """Close a PDF document and free resources

    Args:
        doc_id: Document ID returned by open_pdf
    """
    doc = _validate_doc_id(doc_id)
    doc.close()
    del documents[doc_id]
    return "Document closed successfully"


def main():
    """Entry point for the MCP server"""
    mcp.run()


if __name__ == "__main__":
    main()
