"""
Tests for translator tools
"""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from mcp.types import TextContent

from translator_server import (
    _analyze_style,
    _format_numbered_paragraphs,
    _parse_json_safe,
    _parse_numbered_translations,
    _read_file_with_encoding,
    _split_paragraphs,
    analyze_document,
    list_supported_languages,
    load_glossary,
    save_glossary,
    translate_paragraphs,
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


def test_split_paragraphs(sample_text_file):
    """Test splitting text into paragraphs"""
    content = _read_file_with_encoding(sample_text_file)
    paragraphs = _split_paragraphs(content)

    assert len(paragraphs) > 0
    assert "Introduction" in paragraphs[0]
    assert any("Machine learning" in p for p in paragraphs)


def test_split_paragraphs_empty_lines():
    """Test splitting with empty lines"""
    text = "Para 1\n\nPara 2\n\n\n\nPara 3"
    paragraphs = _split_paragraphs(text)

    assert len(paragraphs) == 3
    assert paragraphs[0] == "Para 1"
    assert paragraphs[1] == "Para 2"
    assert paragraphs[2] == "Para 3"


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
    from pathlib import Path

    loaded = json.loads(Path(output_path).read_text(encoding="utf-8"))
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


def test_generate_output_path_interleaved():
    """Test generating output path for interleaved format"""
    from translator_server import _generate_output_path

    result = _generate_output_path("/path/to/document.md", "zh-CN", "interleaved")
    assert result == "/path/to/document.zh-CN.bilingual.md"

    result = _generate_output_path("/path/to/file.txt", "en", "interleaved")
    assert result == "/path/to/file.en.bilingual.txt"


def test_generate_output_path_translation_only():
    """Test generating output path for translation_only format"""
    from translator_server import _generate_output_path

    result = _generate_output_path("/path/to/document.md", "zh-CN", "translation_only")
    assert result == "/path/to/document.zh-CN.md"

    result = _generate_output_path("/path/to/file.txt", "ja", "translation_only")
    assert result == "/path/to/file.ja.txt"


@pytest.mark.asyncio
async def test_analyze_style():
    """Test style analysis with mocked context"""
    # Create mock context
    mock_ctx = MagicMock()
    mock_session = AsyncMock()
    mock_ctx.session = mock_session

    # Mock the create_message response
    mock_result = MagicMock()
    mock_result.content = TextContent(
        type="text",
        text='{"style": "technical", "tone": "formal", "domain": "physics", "initial_glossary": {"term1": "术语1"}}'
    )
    mock_session.create_message = AsyncMock(return_value=mock_result)

    # Test the function
    paragraphs = ["This is a technical document.", "It discusses quantum mechanics."]
    result = await _analyze_style(paragraphs, "zh-CN", mock_ctx)

    assert result["style"] == "technical"
    assert result["tone"] == "formal"
    assert result["domain"] == "physics"
    assert "term1" in result["initial_glossary"]

    # Verify create_message was called
    mock_session.create_message.assert_called_once()


@pytest.mark.asyncio
async def test_analyze_document(sample_text_file):
    """Test document analysis with mocked context"""
    # Create mock context
    mock_ctx = MagicMock()
    mock_session = AsyncMock()
    mock_ctx.session = mock_session

    # Mock the create_message response for style analysis
    mock_result = MagicMock()
    mock_result.content = TextContent(
        type="text",
        text='{"style": "technical", "tone": "neutral", "domain": "AI", "initial_glossary": {}}'
    )
    mock_session.create_message = AsyncMock(return_value=mock_result)

    # Test the function
    result_json = await analyze_document(sample_text_file, "zh-CN", ctx=mock_ctx)
    result = json.loads(result_json)

    assert "path" in result
    assert "total_paragraphs" in result
    assert "file_size" in result
    assert "style_analysis" in result
    assert result["total_paragraphs"] > 0
    assert result["style_analysis"]["style"] == "technical"


@pytest.mark.asyncio
async def test_translate_paragraphs_empty_range(sample_text_file):
    """Test translate_paragraphs with out-of-range start"""
    # Create mock context
    mock_ctx = MagicMock()

    # Test with start beyond file length
    result_json = await translate_paragraphs(
        sample_text_file,
        start=1000,
        count=10,
        target_lang="zh-CN",
        ctx=mock_ctx
    )
    result = json.loads(result_json)

    assert result["translations"] == []
    assert result["count"] == 0
    assert result["start"] == 1000


@pytest.mark.asyncio
async def test_translate_paragraphs_with_context(sample_text_file):
    """Test translate_paragraphs with existing context"""
    # Create mock context
    mock_ctx = MagicMock()
    mock_session = AsyncMock()
    mock_ctx.session = mock_session

    # Mock translation result
    mock_trans_result = MagicMock()
    mock_trans_result.content = TextContent(
        type="text",
        text="1. 这是翻译\n2. 第二段翻译"
    )

    # Mock term extraction result
    mock_term_result = MagicMock()
    mock_term_result.content = TextContent(
        type="text",
        text='{"新术语": "new term"}'
    )

    mock_session.create_message = AsyncMock(side_effect=[mock_trans_result, mock_term_result])

    # Test with existing context
    existing_context = {
        "glossary": {"existing": "现有"},
        "previous_paragraphs": [
            {"original": "Previous text", "translation": "之前的文本"}
        ],
        "style_guide": {"style": "technical", "tone": "formal", "domain": "AI"}
    }

    result_json = await translate_paragraphs(
        sample_text_file,
        start=0,
        count=2,
        target_lang="zh-CN",
        context=existing_context,
        ctx=mock_ctx
    )
    result = json.loads(result_json)

    assert result["count"] == 2
    assert len(result["translations"]) == 2
    assert "context" in result
    assert result["context"]["glossary"]["existing"] == "现有"
    assert "新术语" in result["context"]["glossary"]


@pytest.mark.asyncio
async def test_translate_paragraphs_no_context(sample_text_file):
    """Test translate_paragraphs without existing context (first call)"""
    # Create mock context
    mock_ctx = MagicMock()
    mock_session = AsyncMock()
    mock_ctx.session = mock_session

    # Mock style analysis result
    mock_style_result = MagicMock()
    mock_style_result.content = TextContent(
        type="text",
        text='{"style": "technical", "tone": "formal", "domain": "AI", "initial_glossary": {"AI": "人工智能"}}'
    )

    # Mock translation result
    mock_trans_result = MagicMock()
    mock_trans_result.content = TextContent(
        type="text",
        text="1. 机器学习是人工智能的一个子集\n2. 它使系统能够自动从数据中学习"
    )

    # Mock term extraction result
    mock_term_result = MagicMock()
    mock_term_result.content = TextContent(
        type="text",
        text='{"machine learning": "机器学习"}'
    )

    # Set up side_effect for multiple create_message calls
    mock_session.create_message = AsyncMock(side_effect=[
        mock_style_result,
        mock_trans_result,
        mock_term_result
    ])

    # Test without context (first call)
    result_json = await translate_paragraphs(
        sample_text_file,
        start=0,
        count=2,
        target_lang="zh-CN",
        context=None,
        ctx=mock_ctx
    )
    result = json.loads(result_json)

    assert result["count"] == 2
    assert len(result["translations"]) == 2
    assert "context" in result
    assert result["context"]["glossary"]["AI"] == "人工智能"
    assert result["context"]["style_guide"]["style"] == "technical"
    assert "machine learning" in result["context"]["glossary"]

    # Verify create_message was called 3 times (style + translation + terms)
    assert mock_session.create_message.call_count == 3
