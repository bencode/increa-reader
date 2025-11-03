"""
Chat utility functions for filename generation and sanitization
"""

import asyncio
import os
import re

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

# Debug logging flag
DEBUG = os.getenv("DEBUG", "false").lower() == "true"


def sanitize_filename(name: str, max_length: int = 40) -> str:
    """
    Sanitize filename by removing invalid characters

    Args:
        name: Raw filename
        max_length: Maximum filename length

    Returns:
        Sanitized filename safe for filesystem
    """
    # Remove or replace special characters that are invalid in filenames
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', name)
    # Remove leading/trailing spaces and dots
    name = name.strip('. ')
    # Limit length
    return name[:max_length] if name else "untitled"


async def generate_semantic_filename(messages: list[dict]) -> str | None:
    """
    Generate semantic filename using Claude Haiku based on conversation content

    Args:
        messages: Chat messages list

    Returns:
        Generated filename (without extension and timestamp), or None if failed
    """
    if not messages:
        return None

    try:
        # Extract first 3-5 messages for context (limit tokens)
        sample_messages = messages[:5]

        # Build conversation summary
        conversation = []
        for msg in sample_messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if content:
                # Truncate long messages
                truncated = content[:200] + "..." if len(content) > 200 else content
                conversation.append(f"[{role.upper()}] {truncated}")

        if not conversation:
            return None

        conversation_text = "\n".join(conversation)

        # Prompt for filename generation
        prompt = f"""根据以下对话内容，生成一个简洁的文件名。

要求：
- 中英文均可，优先使用中文
- 20-40 字符
- 避免特殊字符（只用字母、数字、中文、下划线、连字符）
- 能概括对话的主题或主要内容

对话内容：
{conversation_text}

只返回文件名，不要其他内容（不要加 .md 后缀，不要加引号）。"""

        # Create minimal SDK client for simple text generation
        options = ClaudeAgentOptions(
            allowed_tools=[],  # No tools needed
            permission_mode="bypassPermissions",
            max_turns=1,  # Single turn
            env={
                "ANTHROPIC_BASE_URL": os.getenv("ANTHROPIC_BASE_URL"),
                "ANTHROPIC_AUTH_TOKEN": os.getenv("ANTHROPIC_AUTH_TOKEN"),
                "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY", ""),
            },
        )

        client = ClaudeSDKClient(options=options)
        await client.connect()

        # Set timeout for generation
        await asyncio.wait_for(client.query(prompt), timeout=5.0)

        # Collect response
        filename = None
        async for msg in client.receive_response():
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage":
                # Extract text from content blocks
                filename = "".join(
                    block.text
                    for block in msg.content
                    if hasattr(block, "text")
                ).strip()
                break

        if filename:
            # Sanitize the generated filename
            return sanitize_filename(filename)

        return None

    except asyncio.TimeoutError:
        if DEBUG:
            print("⏱️  Filename generation timeout, using fallback")
        return None
    except Exception as e:
        if DEBUG:
            print(f"❌ Failed to generate semantic filename: {e}")
        return None
