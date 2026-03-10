"""
Frontend tools - LLM can call these tools to interact with the frontend UI
"""

import asyncio
import json
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
    "Get the text selected by the user along with surrounding context (before/after text). "
    "Returns selected text and its before/after context for precise location in the document. "
    "Use when user references 'this', 'selected text', or 'highlighted part'. "
    "Returns 'No selection context available' if no selection is queued.",
    {
        "number": {
            "type": "integer",
            "description": "Number of selections to retrieve from the queue. Defaults to 1.",
            "default": 1,
        }
    },
)
async def get_selection(args: dict[str, Any]) -> dict[str, Any]:
    """Get the text selected by the user with surrounding context"""
    number = args.get("number", 1)
    return await frontend_tool_wrapper("get_selection", number=number)


@tool(
    "get_current_page",
    "Get the current PDF page number the user is viewing. "
    "Only works when viewing a PDF file.",
    {},
)
async def get_current_page(args: dict[str, Any]) -> dict[str, Any]:
    """Get the current PDF page number"""
    return await frontend_tool_wrapper("get_current_page")


@tool(
    "refresh_view",
    "Refresh the file viewer to reload content. "
    "Use after modifying a file the user is viewing.",
    {},
)
async def refresh_view(args: dict[str, Any]) -> dict[str, Any]:
    """Refresh the file viewer to reload current file content"""
    return await frontend_tool_wrapper("refresh_view")


@tool(
    "canvas_draw",
    "Draw on the canvas board using p5.js drawing code. "
    "REQUIRES a .board file to be open in the viewer. "
    "The code runs in a p5.js scope with functions like rect(), ellipse(), text(), fill(), stroke(), etc. "
    "Use standard p5.js API. Each call appends one drawing instruction. "
    "Example: fill(255,0,0); rect(100,100,200,150); "
    "For math formulas use: math('E=mc^2', x, y, size)",
    {
        "code": {
            "type": "string",
            "description": "p5.js drawing code string. Available functions: background, fill, noFill, stroke, noStroke, strokeWeight, rect, ellipse, circle, line, triangle, text, textSize, textAlign, push, pop, translate, rotate, scale, math(latex, x, y, size), etc.",
        }
    },
)
async def canvas_draw(args: dict[str, Any]) -> dict[str, Any]:
    """Draw on the canvas board using p5.js code"""
    code = args.get("code", "")
    return await frontend_tool_wrapper("canvas_draw", code=code)


@tool(
    "canvas_clear",
    "Clear all drawings from the canvas board. Requires a .board file to be open.",
    {},
)
async def canvas_clear(args: dict[str, Any]) -> dict[str, Any]:
    """Clear all drawings from the canvas"""
    return await frontend_tool_wrapper("canvas_clear")



@tool(
    "canvas_get_instructions",
    "Get all drawing instructions currently on the canvas board. "
    "Requires a .board file to be open. "
    "Returns the list of p5.js code strings that have been drawn. "
    "Use this to review what has been drawn so far.",
    {},
)
async def canvas_get_instructions(args: dict[str, Any]) -> dict[str, Any]:
    """Get all drawing instructions on the canvas"""
    return await frontend_tool_wrapper("canvas_get_instructions")


@tool(
    "canvas_snapshot",
    "Take a screenshot of the current canvas board and save it as a PNG image. "
    "Requires a .board file to be open. "
    "Returns the absolute file path of the saved image. "
    "You can then use the Read tool to view the image. "
    "Use this to see the current state of your drawings on the canvas.",
    {},
)
async def canvas_snapshot(args: dict[str, Any]) -> dict[str, Any]:
    """Take a snapshot of the canvas board"""
    return await frontend_tool_wrapper("canvas_snapshot")


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
    refresh_view,
    canvas_draw,
    canvas_clear,
    canvas_get_instructions,
    canvas_snapshot,
]
