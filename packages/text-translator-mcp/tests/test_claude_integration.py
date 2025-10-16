"""
Integration tests for Claude CLI integration
"""

import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from translator_server import _call_claude, analyze_document, translate_paragraphs


@pytest.mark.asyncio
async def test_call_claude_success():
    """Test successful claude CLI call"""
    mock_process = AsyncMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(b'{"result": "success"}', b''))

    with patch('asyncio.create_subprocess_shell', return_value=mock_process) as mock_subprocess:
        result = await _call_claude("test prompt")

        assert result == '{"result": "success"}'

        # Verify subprocess was called correctly
        mock_subprocess.assert_called_once()
        call_args = mock_subprocess.call_args

        # Check that command contains 'claude --print --output-format text'
        assert 'claude --print --output-format text' in call_args[0][0]
        assert 'test prompt' in call_args[0][0]

        # Check that executable is bash
        assert call_args[1]['executable'] == '/bin/bash'


@pytest.mark.asyncio
async def test_call_claude_with_environment_variables():
    """Test that environment variables are passed correctly"""
    mock_process = AsyncMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(b'test output', b''))

    # Set environment variables
    os.environ['ANTHROPIC_BASE_URL'] = 'https://test.api.com'
    os.environ['ANTHROPIC_AUTH_TOKEN'] = 'test_token_123'

    try:
        with patch('asyncio.create_subprocess_shell', return_value=mock_process) as mock_subprocess:
            await _call_claude("test")

            # Verify environment variables were passed
            call_args = mock_subprocess.call_args
            env = call_args[1]['env']

            assert 'ANTHROPIC_BASE_URL' in env
            assert env['ANTHROPIC_BASE_URL'] == 'https://test.api.com'
            assert 'ANTHROPIC_AUTH_TOKEN' in env
            assert env['ANTHROPIC_AUTH_TOKEN'] == 'test_token_123'
    finally:
        # Clean up
        del os.environ['ANTHROPIC_BASE_URL']
        del os.environ['ANTHROPIC_AUTH_TOKEN']


@pytest.mark.asyncio
async def test_call_claude_command_failure():
    """Test claude CLI call failure handling"""
    mock_process = AsyncMock()
    mock_process.returncode = 1
    mock_process.communicate = AsyncMock(return_value=(b'', b'Error: command failed'))

    with patch('asyncio.create_subprocess_shell', return_value=mock_process):
        with pytest.raises(RuntimeError, match="Claude command failed"):
            await _call_claude("test prompt")


@pytest.mark.asyncio
async def test_analyze_document_integration(sample_text_file):
    """Test analyze_document with mocked claude call"""
    mock_response = json.dumps({
        "style": "technical",
        "tone": "formal",
        "domain": "machine learning",
        "initial_glossary": {
            "machine learning": "机器学习",
            "neural network": "神经网络"
        }
    })

    with patch('translator_server._call_claude', return_value=mock_response):
        result_json = await analyze_document(sample_text_file, "zh-CN")
        result = json.loads(result_json)

        assert "path" in result
        assert "total_paragraphs" in result
        assert "file_size" in result
        assert "style_analysis" in result

        # Verify style analysis content
        style = result["style_analysis"]
        assert style["style"] == "technical"
        assert style["tone"] == "formal"
        assert style["domain"] == "machine learning"
        assert "machine learning" in style["initial_glossary"]


@pytest.mark.asyncio
async def test_analyze_document_fallback_on_error(sample_text_file):
    """Test analyze_document falls back to mock data on error"""
    # Simulate claude command failure
    with patch('translator_server._call_claude', side_effect=RuntimeError("Command failed")):
        result_json = await analyze_document(sample_text_file, "zh-CN")
        result = json.loads(result_json)

        # Should still return valid result with fallback data
        assert "path" in result
        assert "total_paragraphs" in result
        assert "style_analysis" in result

        # Fallback style analysis should be present
        style = result["style_analysis"]
        assert "style" in style
        assert "tone" in style


@pytest.mark.asyncio
async def test_translate_paragraphs_integration(sample_text_file):
    """Test translate_paragraphs with mocked claude calls"""
    # Mock responses for different claude calls
    translation_response = "1. 机器学习是人工智能的一个子集\n2. 它使系统能够从数据中学习"
    terms_response = json.dumps({
        "machine learning": "机器学习",
        "artificial intelligence": "人工智能"
    })

    call_count = [0]
    async def mock_call_claude(prompt):
        call_count[0] += 1
        if "translate" in prompt.lower() or "翻译" in prompt:
            return translation_response
        else:
            return terms_response

    with patch('translator_server._call_claude', side_effect=mock_call_claude):
        result_json = await translate_paragraphs(
            sample_text_file,
            start=0,
            count=2,
            target_lang="zh-CN",
            extract_new_terms=True
        )
        result = json.loads(result_json)

        assert result["count"] == 2
        assert len(result["translations"]) == 2
        assert result["start"] == 0

        # Verify translations
        assert "机器学习" in result["translations"][0]

        # Verify context was updated
        assert "context" in result
        assert "glossary" in result["context"]
        assert "stats" in result
        assert result["stats"]["translated"] == 2


@pytest.mark.asyncio
async def test_translate_paragraphs_with_existing_context(sample_text_file):
    """Test translate_paragraphs preserves and updates existing context"""
    translation_response = "1. 第一段翻译\n2. 第二段翻译"

    existing_context = {
        "glossary": {"existing_term": "现有术语"},
        "style_guide": {"style": "technical", "tone": "formal"},
        "previous_paragraphs": []
    }

    with patch('translator_server._call_claude', return_value=translation_response):
        result_json = await translate_paragraphs(
            sample_text_file,
            start=0,
            count=2,
            target_lang="zh-CN",
            context=existing_context,
            extract_new_terms=False
        )
        result = json.loads(result_json)

        # Context should be preserved
        assert "context" in result
        assert result["context"]["glossary"]["existing_term"] == "现有术语"
        assert result["context"]["style_guide"]["style"] == "technical"


@pytest.mark.asyncio
async def test_translate_paragraphs_fallback_on_error(sample_text_file):
    """Test translate_paragraphs handles errors gracefully"""
    # Simulate claude command failure
    with patch('translator_server._call_claude', side_effect=RuntimeError("Command failed")):
        result_json = await translate_paragraphs(
            sample_text_file,
            start=0,
            count=2,
            target_lang="zh-CN"
        )
        result = json.loads(result_json)

        # Should return error translations
        assert result["count"] == 2
        assert len(result["translations"]) == 2
        assert all("[TRANSLATION ERROR]" in t for t in result["translations"])


@pytest.mark.asyncio
@pytest.mark.skipif(
    os.getenv("CLAUDE_COMMAND") is None,
    reason="Requires CLAUDE_COMMAND environment variable for real integration test"
)
async def test_real_claude_call():
    """Real integration test with actual claude command (requires setup)"""
    try:
        result = await _call_claude("Say 'Hello from test'")
        assert len(result) > 0
        print(f"Real claude response: {result}")
    except RuntimeError as e:
        pytest.skip(f"Claude command not available: {e}")
