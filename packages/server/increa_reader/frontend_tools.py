"""
Frontend tools - LLM can call these tools to interact with the frontend UI
"""

import asyncio
import uuid
from typing import Any, Dict, Optional

# Global queue for frontend tool call requests
# SSE endpoint will consume from this queue
frontend_tool_queue: asyncio.Queue = asyncio.Queue()

# Pending tool calls waiting for frontend response
pending_tool_calls: Dict[str, asyncio.Future] = {}


async def frontend_tool_wrapper(name: str, **kwargs) -> Any:
    """
    Wrapper for frontend tools - sends request via SSE and waits for response

    Args:
        name: Tool name
        **kwargs: Tool arguments

    Returns:
        Tool execution result from frontend

    Raises:
        TimeoutError: If frontend doesn't respond within 30 seconds
    """
    call_id = str(uuid.uuid4())
    future = asyncio.Future()
    pending_tool_calls[call_id] = future

    # Put tool call request into global queue
    await frontend_tool_queue.put({
        "type": "tool_call",
        "call_id": call_id,
        "name": name,
        "arguments": kwargs
    })

    try:
        # Wait for frontend response (30s timeout)
        result = await asyncio.wait_for(future, timeout=30.0)
        return result
    finally:
        # Cleanup
        pending_tool_calls.pop(call_id, None)


async def get_visible_content() -> str:
    """
    Get the content currently visible in the user's viewport.

    Use this when:
    - User asks about "this section", "what I'm seeing", "current page"
    - Need to reference specific visible content
    - Analyzing PDF pages, markdown sections, or code blocks

    Do NOT use when:
    - General questions about the file (use Read tool instead)
    - User is just chatting without referencing current view
    """
    return await frontend_tool_wrapper("get_visible_content")


async def get_selection() -> str:
    """
    Get the text currently selected by the user.

    Use when user says "this", "selected text", "highlighted part".
    Returns empty string if nothing is selected.
    """
    return await frontend_tool_wrapper("get_selection")


async def get_page_context() -> dict:
    """
    Get detailed context about the current page (for PDF files).

    Returns:
        {
            "pageNumber": int,
            "totalPages": int,
            "content": str  # Current page content
        }

    Only works when user is viewing a PDF file.
    Raises error if not viewing a PDF.
    """
    return await frontend_tool_wrapper("get_page_context")


def complete_tool_call(call_id: str, result: Any = None, error: Optional[str] = None):
    """
    Complete a pending tool call with result or error

    Called by the API endpoint when frontend sends back the result
    """
    future = pending_tool_calls.get(call_id)
    if future and not future.done():
        if error:
            future.set_exception(Exception(error))
        else:
            future.set_result(result)


# Tool definitions for Claude Agent SDK
FRONTEND_TOOLS = [
    {
        "name": "get_visible_content",
        "description": get_visible_content.__doc__.strip(),
        "function": get_visible_content,
    },
    {
        "name": "get_selection",
        "description": get_selection.__doc__.strip(),
        "function": get_selection,
    },
    {
        "name": "get_page_context",
        "description": get_page_context.__doc__.strip(),
        "function": get_page_context,
    },
]
