"""
Frontend tools - LLM can call these tools to interact with the frontend UI
"""

import asyncio
import os
import uuid
from typing import Any, Dict, Optional

from claude_agent_sdk import tool

# Debug logging flag
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Global queue for frontend tool call requests
# SSE endpoint will consume from this queue
frontend_tool_queue: asyncio.Queue = asyncio.Queue()

# Pending tool calls waiting for frontend response
pending_tool_calls: Dict[str, asyncio.Future] = {}


async def frontend_tool_wrapper(name: str, **kwargs) -> dict[str, Any]:
    """
    Wrapper for frontend tools - sends request via SSE and waits for response

    Args:
        name: Tool name
        **kwargs: Tool arguments

    Returns:
        MCP tool result format: {"content": [{"type": "text", "text": "..."}]}

    Raises:
        TimeoutError: If frontend doesn't respond within 30 seconds
    """
    call_id = str(uuid.uuid4())
    future = asyncio.Future()
    pending_tool_calls[call_id] = future

    if DEBUG:
        print(f"🔧 [Frontend Tool] Calling {name} (call_id: {call_id[:8]}...)")

    # Put tool call request into global queue
    await frontend_tool_queue.put(
        {"type": "tool_call", "call_id": call_id, "name": name, "arguments": kwargs}
    )

    try:
        # Wait for frontend response (30s timeout)
        result = await asyncio.wait_for(future, timeout=30.0)

        if DEBUG:
            print(f"✅ [Frontend Tool] {name} completed: {str(result)[:100]}...")

        # Convert frontend result to MCP format
        # Frontend returns {"result": ..., "error": ...}
        if isinstance(result, dict) and "error" in result:
            # Error case
            return {
                "content": [{"type": "text", "text": f"Error: {result['error']}"}],
                "is_error": True,
            }

        # Success case - convert result to text content
        if isinstance(result, dict) and "result" in result:
            actual_result = result["result"]
        else:
            actual_result = result

        # Format result as text
        import json

        if isinstance(actual_result, (dict, list)):
            text = json.dumps(actual_result, ensure_ascii=False, indent=2)
        else:
            text = str(actual_result)

        return {"content": [{"type": "text", "text": text}]}
    finally:
        # Cleanup
        pending_tool_calls.pop(call_id, None)


@tool(
    "get_visible_content",
    "Get the content currently visible in the user's viewport. "
    "Use when user asks about 'this section', 'what I'm seeing', or 'current page'. "
    "Do NOT use for general file questions (use Read tool instead).",
    {},
)
async def get_visible_content(args: dict[str, Any]) -> dict[str, Any]:
    """Get the content currently visible in the user's viewport"""
    return await frontend_tool_wrapper("get_visible_content")


@tool(
    "get_selection",
    "Get the text currently selected by the user. "
    "Use when user says 'this', 'selected text', or 'highlighted part'. "
    "Returns empty string if nothing is selected.",
    {},
)
async def get_selection(args: dict[str, Any]) -> dict[str, Any]:
    """Get the text currently selected by the user"""
    return await frontend_tool_wrapper("get_selection")


@tool(
    "get_current_page",
    "Get the current PDF page number the user is viewing. "
    "Only works when viewing a PDF file.",
    {},
)
async def get_current_page(args: dict[str, Any]) -> dict[str, Any]:
    """Get the current PDF page number"""
    return await frontend_tool_wrapper("get_current_page")


def complete_tool_call(call_id: str, result: Any = None, error: Optional[str] = None):
    """
    Complete a pending tool call with result or error

    Called by the API endpoint when frontend sends back the result
    Frontend sends: {"result": ..., "error": ...}
    """
    if DEBUG:
        print(
            f"📨 [Frontend Tool] Received result for call_id: {call_id[:8]}... (error={error is not None})"
        )

    future = pending_tool_calls.get(call_id)
    if future and not future.done():
        if error:
            # Pass error back to wrapper
            future.set_result({"error": error})
        else:
            # Pass result back to wrapper (will be formatted there)
            future.set_result({"result": result})
    else:
        if DEBUG:
            print(f"⚠️  [Frontend Tool] No pending call found for {call_id[:8]}...")


# Export tools for MCP server creation
FRONTEND_TOOLS = [
    get_visible_content,
    get_selection,
    get_current_page,
]
