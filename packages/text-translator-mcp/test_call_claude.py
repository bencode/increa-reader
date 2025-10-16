#!/usr/bin/env python3
"""
Quick test for _call_claude function
"""
import asyncio
import sys
from translator_server import _call_claude


async def test_simple_call():
    """Test _call_claude with a simple prompt"""
    print("Testing _call_claude with simple prompt...")

    try:
        result = await _call_claude("Say 'Hello from translator MCP test'")
        print(f"✓ Success! Response:\n{result}\n")
        return True
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False


async def test_json_response():
    """Test _call_claude with JSON output"""
    print("Testing _call_claude with JSON response...")

    prompt = """Return ONLY a JSON object (no markdown):
{"status": "ok", "message": "test successful"}"""

    try:
        result = await _call_claude(prompt)
        print(f"✓ Success! Response:\n{result}\n")

        # Try parsing as JSON
        import json
        parsed = json.loads(result.strip())
        print(f"✓ Valid JSON: {parsed}\n")
        return True
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False


async def main():
    print("=" * 60)
    print("Testing _call_claude function")
    print("=" * 60)
    print()

    test1 = await test_simple_call()
    test2 = await test_json_response()

    print("=" * 60)
    if test1 and test2:
        print("✓ All tests passed!")
        sys.exit(0)
    else:
        print("✗ Some tests failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
