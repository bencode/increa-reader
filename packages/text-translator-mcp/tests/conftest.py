"""
Pytest fixtures for Text Translator MCP Server tests
"""

import os
import tempfile

import pytest


@pytest.fixture
def sample_text_file():
    """Create a sample text file for testing"""
    content = """Introduction to Machine Learning

Machine learning is a subset of artificial intelligence.

It enables systems to learn from data automatically.

Neural Networks

Neural networks are inspired by biological neurons.

They consist of interconnected layers of nodes."""

    temp_file = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8")
    temp_file.write(content)
    temp_file.close()

    yield temp_file.name
    os.unlink(temp_file.name)


@pytest.fixture
def sample_glossary():
    """Sample glossary for testing"""
    return {
        "machine learning": "机器学习",
        "artificial intelligence": "人工智能",
        "neural network": "神经网络",
    }


@pytest.fixture
def sample_glossary_file(sample_glossary):
    """Create a sample glossary JSON file"""
    import json

    temp_file = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8")
    json.dump(sample_glossary, temp_file, ensure_ascii=False)
    temp_file.close()

    yield temp_file.name
    os.unlink(temp_file.name)
