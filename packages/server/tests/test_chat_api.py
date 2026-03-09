"""
Test script for /api/chat/query endpoint
"""

import json
import sys

import requests


def test_chat_query(prompt: str = "Hello, can you help me?", repo: str = None):
    """Test the chat query endpoint with SSE streaming"""

    url = "http://localhost:3000/api/chat/query"

    payload = {
        "prompt": prompt,
        "repo": repo,
        "sessionId": None,
    }

    print(f"🚀 Testing {url}")
    print(f"📝 Payload: {json.dumps(payload, indent=2)}\n")

    try:
        # Use stream=True to handle SSE
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            stream=True,
            timeout=30,
        )

        print(f"✅ Status: {response.status_code}")
        print(f"📋 Headers: {dict(response.headers)}\n")

        if response.status_code != 200:
            print(f"❌ Error response: {response.text}")
            return

        print("📨 Streaming response:\n")
        print("-" * 80)

        # Read SSE stream
        for line in response.iter_lines():
            if line:
                decoded = line.decode("utf-8")

                if decoded.startswith("data: "):
                    data = decoded[6:]  # Remove 'data: ' prefix
                    try:
                        msg = json.loads(data)
                        msg_type = msg.get("type", "unknown")

                        print(f"\n[{msg_type.upper()}]")
                        print(json.dumps(msg, indent=2, ensure_ascii=False))

                        # Extract content for better readability
                        if msg_type == "assistant" and "content" in msg:
                            print(f"\n💬 Content: {msg['content'][:200]}...")

                        if msg_type == "stream_event":
                            event = msg.get("event", {})
                            if event.get("type") == "content_block_delta":
                                text = event.get("delta", {}).get("text", "")
                                if text:
                                    print(f"📝 Delta: {text}", end="", flush=True)

                        if msg_type == "error":
                            print(f"\n❌ Error: {msg.get('message')}")

                        if msg_type == "result":
                            print(f"\n✅ Completed:")
                            print(f"   Session: {msg.get('session_id', 'N/A')}")
                            print(
                                f"   Duration: {msg.get('duration_ms', 0) / 1000:.2f}s"
                            )
                            usage = msg.get("usage", {})
                            if usage:
                                print(
                                    f"   Tokens: {usage.get('input_tokens', 0)} in → {usage.get('output_tokens', 0)} out"
                                )

                    except json.JSONDecodeError as e:
                        print(f"⚠️  Failed to parse JSON: {e}")
                        print(f"   Raw data: {data}")
                else:
                    print(f"Other line: {decoded}")

        print("\n" + "-" * 80)
        print("✅ Stream completed\n")

    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error: {e}")
        print("💡 Is the server running on port 3000?")
    except requests.exceptions.Timeout:
        print("❌ Request timeout")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    # Parse command line args
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Hello, what can you help me with?"
    repo = sys.argv[2] if len(sys.argv) > 2 else None

    test_chat_query(prompt, repo)
