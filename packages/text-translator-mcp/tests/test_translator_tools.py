"""
Tests for translator tools
"""

import json

import pytest

from translator_server import (
    _format_numbered_paragraphs,
    _parse_json_safe,
    _parse_numbered_translations,
    _read_file_with_encoding,
    list_supported_languages,
    load_glossary,
    save_glossary,
    split_document,
)


def test_read_file_with_encoding(sample_text_file):
    """Test reading file with encoding detection"""
    content = _read_file_with_encoding(sample_text_file)
    assert "Machine learning" in content
    assert "Neural Networks" in content


def test_read_file_not_found():
    """Test reading non-existent file"""
    with pytest.raises(FileNotFoundError):
        _read_file_with_encoding("/nonexistent/file.txt")


def test_split_document(sample_text_file):
    """Test splitting document into paragraphs"""
    result_json = split_document(sample_text_file)
    result = json.loads(result_json)

    assert "paragraphs" in result
    assert "total" in result
    assert result["total"] > 0
    assert len(result["paragraphs"]) == result["total"]
    assert "Introduction" in result["paragraphs"][0]
    assert any("Machine learning" in p for p in result["paragraphs"])


def test_format_numbered_paragraphs():
    """Test formatting paragraphs with numbers"""
    paragraphs = ["First paragraph", "Second paragraph", "Third paragraph"]
    result = _format_numbered_paragraphs(paragraphs)

    assert "1. First paragraph" in result
    assert "2. Second paragraph" in result
    assert "3. Third paragraph" in result


def test_parse_numbered_translations():
    """Test parsing numbered translation output"""
    text = """1. 第一段翻译
2. 第二段翻译
3. 第三段翻译"""

    translations = _parse_numbered_translations(text)
    assert len(translations) == 3
    assert translations[0] == "第一段翻译"
    assert translations[1] == "第二段翻译"
    assert translations[2] == "第三段翻译"


def test_parse_numbered_translations_with_parentheses():
    """Test parsing translations with parentheses numbering"""
    text = """1) First translation
2) Second translation
3) Third translation"""

    translations = _parse_numbered_translations(text)
    assert len(translations) == 3
    assert translations[0] == "First translation"


def test_parse_numbered_translations_multiline():
    """Test parsing multiline translations"""
    text = """1. This is the first
translation that spans
multiple lines.

2. This is the second
translation.

3. Third one."""

    translations = _parse_numbered_translations(text)
    assert len(translations) == 3
    assert "first" in translations[0]
    assert "multiple lines" in translations[0]


def test_parse_json_safe():
    """Test safe JSON parsing"""
    # Normal JSON
    result = _parse_json_safe('{"key": "value"}')
    assert result == {"key": "value"}

    # JSON with markdown code blocks
    result = _parse_json_safe('```json\n{"key": "value"}\n```')
    assert result == {"key": "value"}

    # Invalid JSON
    result = _parse_json_safe("not json")
    assert result == {}


def test_load_glossary(sample_glossary_file):
    """Test loading glossary from file"""
    result_json = load_glossary(sample_glossary_file)
    result = json.loads(result_json)

    assert "machine learning" in result
    assert result["machine learning"] == "机器学习"


def test_load_glossary_not_found():
    """Test loading non-existent glossary"""
    with pytest.raises(FileNotFoundError):
        load_glossary("/nonexistent/glossary.json")


def test_save_glossary(tmp_path):
    """Test saving glossary to file"""
    glossary = {"term1": "translation1", "term2": "translation2"}
    output_path = str(tmp_path / "test_glossary.json")

    result_json = save_glossary(glossary, output_path)
    result = json.loads(result_json)

    assert result["saved_to"] == output_path
    assert tmp_path.joinpath("test_glossary.json").exists()

    # Verify content
    with open(output_path, encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded == glossary


def test_list_supported_languages():
    """Test listing supported languages"""
    result_json = list_supported_languages()
    result = json.loads(result_json)

    assert "zh-CN" in result
    assert "en" in result
    assert "ja" in result
    assert result["zh-CN"] == "简体中文"
    assert result["en"] == "English"
