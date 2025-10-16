#!/usr/bin/env python3
"""
Integration test for MCP tools with small sample file
"""
import asyncio
import json
import sys
from pathlib import Path

from translator_server import analyze_document, translate_paragraphs

TEST_FILE = Path(__file__).parent / "test_sample.txt"


async def test_analyze_document():
    """Test analyze_document tool"""
    print("=" * 60)
    print("Testing analyze_document")
    print("=" * 60)

    try:
        result_json = await analyze_document(str(TEST_FILE), "zh-CN")
        result = json.loads(result_json)

        print(f"✓ analyze_document returned valid JSON")
        print(f"  Total paragraphs: {result['total_paragraphs']}")
        print(f"  File size: {result['file_size']} bytes")

        # Style analysis might be empty if claude call failed (fallback mode)
        style = result.get('style_analysis', {})
        if style:
            print(f"  Style: {style.get('style', 'N/A')}")
            print(f"  Tone: {style.get('tone', 'N/A')}")
            print(f"  Domain: {style.get('domain', 'N/A')}")
            print(f"  Initial glossary: {len(style.get('initial_glossary', {}))} terms")
        else:
            print(f"  Style analysis: Empty (fallback mode)")
        print()

        return result
    except Exception as e:
        print(f"✗ analyze_document failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_translate_paragraphs():
    """Test translate_paragraphs tool (first 2 paragraphs)"""
    print("=" * 60)
    print("Testing translate_paragraphs (batch 1: paragraphs 0-1)")
    print("=" * 60)

    try:
        result_json = await translate_paragraphs(
            file_path=str(TEST_FILE),
            start=0,
            count=2,
            target_lang="zh-CN",
            context=None,
            extract_new_terms=True
        )
        result = json.loads(result_json)

        print(f"✓ translate_paragraphs returned valid JSON")
        print(f"  Translated: {result['count']} paragraphs")
        print(f"  New terms extracted: {result['stats']['new_terms']}")
        print(f"  Glossary size: {result['stats']['glossary_size']}")
        print()

        print("Translations:")
        for i, trans in enumerate(result['translations']):
            print(f"  [{i}] {trans}")
        print()

        return result
    except Exception as e:
        print(f"✗ translate_paragraphs failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_translate_with_context():
    """Test translate_paragraphs with existing context (paragraphs 2-3)"""
    print("=" * 60)
    print("Testing translate_paragraphs (batch 2: paragraphs 2-3, with context)")
    print("=" * 60)

    # First batch to get context
    batch1_json = await translate_paragraphs(
        file_path=str(TEST_FILE),
        start=0,
        count=2,
        target_lang="zh-CN",
        context=None,
        extract_new_terms=True
    )
    batch1 = json.loads(batch1_json)

    # Second batch with context
    try:
        result_json = await translate_paragraphs(
            file_path=str(TEST_FILE),
            start=2,
            count=2,
            target_lang="zh-CN",
            context=batch1['context'],
            extract_new_terms=True
        )
        result = json.loads(result_json)

        print(f"✓ translate_paragraphs with context succeeded")
        print(f"  Translated: {result['count']} paragraphs")
        print(f"  Context preserved: {len(result['context']['glossary'])} terms in glossary")
        print(f"  Previous paragraphs tracked: {len(result['context']['previous_paragraphs'])}")
        print()

        print("Translations:")
        for i, trans in enumerate(result['translations']):
            print(f"  [{i+2}] {trans}")
        print()

        return result
    except Exception as e:
        print(f"✗ translate_paragraphs with context failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def main():
    print("\n")
    print("*" * 60)
    print("MCP Tools Integration Test")
    print(f"Test file: {TEST_FILE}")
    print("*" * 60)
    print()

    # Check test file exists
    if not TEST_FILE.exists():
        print(f"✗ Test file not found: {TEST_FILE}")
        sys.exit(1)

    test1 = await test_analyze_document()
    test2 = await test_translate_paragraphs()
    test3 = await test_translate_with_context()

    print("=" * 60)
    if test1 and test2 and test3:
        print("✓ All MCP tools tests passed!")
        print("=" * 60)
        sys.exit(0)
    else:
        print("✗ Some tests failed")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
