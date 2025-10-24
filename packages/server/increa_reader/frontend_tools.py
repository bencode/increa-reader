"""
Frontend tools - LLM can call these tools to interact with the frontend UI
"""

import asyncio
import uuid
from typing import Any, Dict, Optional

from claude_agent_sdk import tool

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


@tool(
    "get_visible_content",
    "Get the content currently visible in the user's viewport. "
    "Use when user asks about 'this section', 'what I'm seeing', or 'current page'. "
    "Do NOT use for general file questions (use Read tool instead).",
    {}
)
async def get_visible_content(args: dict[str, Any]) -> str:
    """Get the content currently visible in the user's viewport"""
    return await frontend_tool_wrapper("get_visible_content")


@tool(
    "get_selection",
    "Get the text currently selected by the user. "
    "Use when user says 'this', 'selected text', or 'highlighted part'. "
    "Returns empty string if nothing is selected.",
    {}
)
async def get_selection(args: dict[str, Any]) -> str:
    """Get the text currently selected by the user"""
    return await frontend_tool_wrapper("get_selection")


@tool(
    "get_page_context",
    "Get detailed context about the current page (for PDF files). "
    "Returns page number, total pages, and current page content. "
    "Only works when viewing a PDF file.",
    {}
)
async def get_page_context(args: dict[str, Any]) -> dict:
    """Get detailed context about the current page (for PDF files)"""
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


# Export tools for MCP server creation
FRONTEND_TOOLS = [
    get_visible_content,
    get_selection,
    get_page_context,
]
