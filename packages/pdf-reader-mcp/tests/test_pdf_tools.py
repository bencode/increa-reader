"""
Unit tests for PDF Reader MCP Server tools
"""

import json
import tempfile
from pathlib import Path

import pytest

from pdf_reader_server import (
    close_pdf,
    documents,
    extract_text,
    generate_doc_id,
    open_pdf,
    page_count,
    render_page_png,
    search_text,
)


def test_generate_doc_id():
    """Test that doc IDs are unique"""
    id1 = generate_doc_id()
    id2 = generate_doc_id()
    assert id1 != id2
    assert isinstance(id1, str)


def test_open_pdf_success(sample_pdf_path):
    """Test successful PDF opening"""
    doc_id = open_pdf(sample_pdf_path)
    assert doc_id in documents
    assert documents[doc_id].page_count == 2


def test_open_pdf_nonexistent_file():
    """Test opening non-existent file"""
    with pytest.raises(RuntimeError):
        open_pdf("/tmp/nonexistent.pdf")


def test_open_pdf_denied_path():
    """Test path security restrictions"""
    with pytest.raises(ValueError, match="Access denied"):
        open_pdf("/etc/passwd")


def test_open_pdf_invalid_file():
    """Test opening invalid file"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pdf", delete=False) as f:
        f.write("Not a PDF")
        invalid_path = f.name

    try:
        with pytest.raises(RuntimeError, match="Failed to open PDF"):
            open_pdf(invalid_path)
    finally:
        Path(invalid_path).unlink()


def test_page_count_valid_doc(sample_pdf_path):
    """Test getting page count for valid document"""
    doc_id = open_pdf(sample_pdf_path)
    count = page_count(doc_id)
    assert count == 2
    assert isinstance(count, int)


def test_page_count_invalid_doc_id():
    """Test page count with invalid doc ID"""
    with pytest.raises(ValueError, match="Invalid or missing doc_id"):
        page_count("invalid_doc_id")


def test_extract_text_valid_page(sample_pdf_path):
    """Test extracting text from valid page"""
    doc_id = open_pdf(sample_pdf_path)
    text = extract_text(doc_id, 1)
    assert "PDF Reader MCP Server Test Document" in text
    assert "neural network" in text


def test_extract_text_page_out_of_range(sample_pdf_path):
    """Test extracting text from non-existent page"""
    doc_id = open_pdf(sample_pdf_path)
    with pytest.raises(ValueError, match="Page number out of range"):
        extract_text(doc_id, 99)


def test_extract_text_invalid_doc_id():
    """Test extracting text with invalid doc ID"""
    with pytest.raises(ValueError, match="Invalid or missing doc_id"):
        extract_text("invalid_doc_id", 1)


def test_search_text_existing_term(sample_pdf_path):
    """Test searching for existing text"""
    doc_id = open_pdf(sample_pdf_path)
    results = json.loads(search_text(doc_id, "neural", 10))

    assert isinstance(results, list)
    assert len(results) > 0
    assert all("page" in result for result in results)


def test_search_text_nonexistent_term(sample_pdf_path):
    """Test searching for non-existent text"""
    doc_id = open_pdf(sample_pdf_path)
    results = json.loads(search_text(doc_id, "nonexistent_xyz", 10))
    assert len(results) == 0


def test_search_text_empty_query(sample_pdf_path):
    """Test searching with empty query"""
    doc_id = open_pdf(sample_pdf_path)
    with pytest.raises(ValueError, match="Missing required parameter: query"):
        search_text(doc_id, "", 10)


def test_render_page_png_valid(sample_pdf_path):
    """Test rendering valid page"""
    doc_id = open_pdf(sample_pdf_path)
    png_path = render_page_png(doc_id, 1, 72)

    assert Path(png_path).exists()
    assert str(png_path).endswith(".png")
    Path(png_path).unlink()


def test_close_pdf_valid(sample_pdf_path):
    """Test closing valid document"""
    doc_id = open_pdf(sample_pdf_path)
    assert doc_id in documents

    result = close_pdf(doc_id)
    assert result == "Document closed successfully"
    assert doc_id not in documents


def test_close_pdf_invalid_doc_id():
    """Test closing with invalid doc ID"""
    with pytest.raises(ValueError, match="Invalid or missing doc_id"):
        close_pdf("invalid_doc_id")


def test_complete_workflow(complex_pdf_path):
    """Test complete workflow with all operations"""
    doc_id = open_pdf(complex_pdf_path)
    assert page_count(doc_id) == 5

    # Extract text from multiple pages
    text1 = extract_text(doc_id, 1)
    text3 = extract_text(doc_id, 3)
    assert "Page 1" in text1
    assert "Unique content only on page 3" in text3

    # Search for terms
    results = json.loads(search_text(doc_id, "reinforcement", 10))
    assert len(results) >= 5

    # Render and cleanup
    png_path = render_page_png(doc_id, 2, 100)
    assert Path(png_path).exists()
    Path(png_path).unlink()

    close_pdf(doc_id)
