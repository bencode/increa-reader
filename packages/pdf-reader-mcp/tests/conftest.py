"""
Pytest fixtures for PDF Reader MCP Server tests
"""

import os
import tempfile

import pytest
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from pdf_reader_server import documents


@pytest.fixture
def sample_pdf_path():
    """Create a sample PDF for testing"""
    temp_file = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)  # noqa: SIM115

    c = canvas.Canvas(temp_file.name, pagesize=letter)
    c.drawString(100, 750, "PDF Reader MCP Server Test Document")
    c.drawString(100, 700, "This is page 1 of the test PDF.")
    c.drawString(100, 650, "Keywords: neural network, machine learning")
    c.showPage()

    c.drawString(100, 750, "Page 2 - Second Page")
    c.drawString(100, 700, "This is the second page.")
    c.drawString(100, 650, "Search terms: AI, deep learning")
    c.save()

    yield temp_file.name
    os.unlink(temp_file.name)  # noqa: PTH108


@pytest.fixture
def complex_pdf_path():
    """Create a 5-page PDF for testing"""
    temp_file = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)  # noqa: SIM115

    c = canvas.Canvas(temp_file.name, pagesize=letter)

    for i in range(1, 6):
        c.drawString(100, 750, f"Page {i} - Complex Test Document")
        c.drawString(100, 700, f"Content for page {i}.")
        c.drawString(100, 650, "Term: reinforcement learning")

        if i == 3:
            c.drawString(100, 550, "Unique content only on page 3")
            c.drawString(100, 500, "Algorithm: Q-learning")

        c.showPage()

    c.save()
    yield temp_file.name
    os.unlink(temp_file.name)  # noqa: PTH108


@pytest.fixture(autouse=True)
def cleanup_documents():
    """Clean up documents after each test"""
    yield

    for doc_id in list(documents.keys()):
        try:
            documents[doc_id].close()
            del documents[doc_id]
        except Exception:  # noqa: BLE001, S110
            pass
