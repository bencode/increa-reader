"""
Chat API endpoints with streaming support
"""

import asyncio
import base64
import json
import os
import time
import uuid
from pathlib import Path

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, create_sdk_mcp_server
from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from .chat_utils import generate_semantic_filename
from .models import ChatRequest, ChatSaveRequest, WorkspaceConfig
from .pdf_tools import (
    close_pdf,
    extract_text,
    open_pdf,
    page_count,
    render_page_png,
    search_text,
)
from .frontend_tools import (
    FRONTEND_TOOLS,
    complete_tool_call,
    frontend_tool_queue,
)
from .workspace import build_sdk_env, load_api_settings

# Debug logging flag
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Global session pool for abort support
active_sessions: dict[str, ClaudeSDKClient] = {}
session_lock = asyncio.Lock()


async def cleanup_active_sessions():
    """Cleanup all active sessions on shutdown"""
    async with session_lock:
        for session_id, client in list(active_sessions.items()):
            try:
                await client.interrupt()
                if DEBUG:
                    print(f"✓ Interrupted session: {session_id}")
            except Exception as e:
                if DEBUG:
                    print(f"✗ Failed to interrupt session {session_id}: {e}")
        active_sessions.clear()


def create_chat_routes(app, workspace_config: WorkspaceConfig):
    """Create chat-related API routes"""

    @app.post("/api/upload/image")
    async def upload_image(request: dict):
        """Upload a base64-encoded image to the first repo's .increa/uploads/ directory"""
        data = request.get("data")
        if not data:
            raise HTTPException(status_code=400, detail="data is required")

        if not workspace_config.repos:
            raise HTTPException(status_code=400, detail="No repositories configured")

        # Save to first repo's .increa/uploads/
        repo_root = Path(workspace_config.repos[0].root)
        uploads_dir = repo_root / ".increa" / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)

        # Strip data URL prefix if present (e.g. "data:image/png;base64,...")
        if "," in data:
            data = data.split(",", 1)[1]

        image_bytes = base64.b64decode(data)
        filename = f"clipboard_{int(time.time())}_{uuid.uuid4().hex[:8]}.png"
        filepath = uploads_dir / filename
        filepath.write_bytes(image_bytes)

        absolute_path = str(filepath.resolve())
        if DEBUG:
            print(f"✓ Image uploaded: {absolute_path}")

        return {"absolutePath": absolute_path, "filename": filename}

    @app.get("/api/uploads/{filename}")
    async def get_uploaded_image(filename: str):
        """Serve uploaded images from the first repo's .increa/uploads/ directory"""
        if not workspace_config.repos:
            raise HTTPException(status_code=404, detail="No repositories configured")

        repo_root = Path(workspace_config.repos[0].root)
        filepath = (repo_root / ".increa" / "uploads" / filename).resolve()

        # Security: ensure path stays within uploads directory
        uploads_dir = (repo_root / ".increa" / "uploads").resolve()
        if not str(filepath).startswith(str(uploads_dir)):
            raise HTTPException(status_code=403, detail="Access denied")

        if not filepath.exists() or not filepath.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(filepath, media_type="image/png")

    @app.post("/api/chat/save")
    async def chat_save(request: ChatSaveRequest):
        """Save chat history to markdown file"""
        from datetime import datetime

        # Get logs directory from env or use default
        logs_path = os.getenv("CHAT_LOGS_DIR", "chat-logs")
        logs_dir = Path(logs_path).expanduser()
        logs_dir.mkdir(parents=True, exist_ok=True)

        # Try to generate semantic filename using LLM
        semantic_name = await generate_semantic_filename(request.messages)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if semantic_name:
            filename = f"{timestamp}_{semantic_name}.md"
            if DEBUG:
                print(f"✓ Generated semantic filename: {filename}")
        else:
            # Fallback to session ID
            session_short = request.sessionId[:8] if request.sessionId else "unknown"
            filename = f"{timestamp}_{session_short}.md"
            if DEBUG:
                print(f"⚠️  Using fallback filename: {filename}")
        filepath = logs_dir / filename

        # Format as markdown
        lines = [f"# Chat Session: {request.sessionId}\n"]
        lines.append(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        if request.stats:
            lines.append("\n## Statistics\n")
            if request.stats.get("duration"):
                duration_s = request.stats["duration"] / 1000
                lines.append(f"- **Duration**: {duration_s:.1f}s\n")
            if request.stats.get("usage"):
                usage = request.stats["usage"]
                lines.append(f"- **Input Tokens**: {usage.get('input_tokens', 0)}\n")
                lines.append(f"- **Output Tokens**: {usage.get('output_tokens', 0)}\n")
                if usage.get("cache_creation_input_tokens"):
                    lines.append(
                        f"- **Cache Creation**: {usage['cache_creation_input_tokens']}\n"
                    )

        lines.append("\n## Messages\n")
        for msg in request.messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            timestamp_ms = msg.get("timestamp", 0)
            dt = datetime.fromtimestamp(timestamp_ms / 1000)
            time_str = dt.strftime("%H:%M:%S")

            lines.append(f"\n### [{time_str}] {role.upper()}\n")
            lines.append(f"{content}\n")

            # Add tool calls if present
            tool_calls = msg.get("toolCalls", [])
            if tool_calls:
                lines.append("\n**Tool Calls:**\n")
                for tool in tool_calls:
                    tool_name = tool.get("name", "unknown")
                    tool_status = tool.get("status", "unknown")
                    lines.append(f"- `{tool_name}` ({tool_status})\n")

        # Write to file
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(lines)

        return {
            "success": True,
            "filepath": str(filepath),
            "filename": filename,
        }

    @app.post("/api/chat/abort")
    async def chat_abort(request: dict):
        """Abort an active chat session"""
        session_id = request.get("sessionId")

        if not session_id:
            raise HTTPException(status_code=400, detail="sessionId is required")

        async with session_lock:
            client = active_sessions.get(session_id)
            if client:
                try:
                    await client.interrupt()
                    if DEBUG:
                        print(f"✓ Interrupted session: {session_id}")
                    return {"status": "interrupted", "sessionId": session_id}
                except Exception as e:
                    if DEBUG:
                        print(f"✗ Failed to interrupt session {session_id}: {e}")
                    raise HTTPException(
                        status_code=500, detail=f"Failed to interrupt: {str(e)}"
                    )

        raise HTTPException(status_code=404, detail="Session not found or not active")

    @app.get("/api/chat/frontend-events")
    async def frontend_events():
        """
        SSE endpoint for frontend tool calls
        Frontend connects to this endpoint and listens for tool call requests
        """
        async def event_stream():
            """Stream tool call requests to frontend"""
            try:
                if DEBUG:
                    print("✓ Frontend connected to SSE")

                while True:
                    # Wait for tool call request from queue
                    tool_call_msg = await frontend_tool_queue.get()

                    if DEBUG:
                        print(f"🔧 Pushing tool call to frontend: {tool_call_msg['name']}")

                    # Send to frontend via SSE
                    yield f"data: {json.dumps(tool_call_msg, ensure_ascii=False)}\n\n"

            except asyncio.CancelledError:
                if DEBUG:
                    print("✓ Frontend SSE disconnected")
                raise

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            },
        )

    @app.post("/api/chat/tool-result")
    async def chat_tool_result(request: dict):
        """
        Receive tool execution result from frontend

        Request body:
        {
            "call_id": str,
            "result": Any,  # optional, tool execution result
            "error": str    # optional, error message if tool failed
        }
        """
        call_id = request.get("call_id")
        if not call_id:
            raise HTTPException(status_code=400, detail="call_id is required")

        result = request.get("result")
        error = request.get("error")

        complete_tool_call(call_id, result=result, error=error)

        if DEBUG:
            status = "error" if error else "success"
            print(f"✓ Tool result received: {call_id} ({status})")

        return {"status": "ok"}

    @app.post("/api/chat/query")
    async def chat_query(request: ChatRequest):
        """Handle chat queries with streaming response"""
        if DEBUG:
            print("\n" + "=" * 80)
            print(f"📥 [CHAT REQUEST] {request.prompt[:100]}...")
            print(f"  SessionId: {request.sessionId}")
            if request.context:
                context_parts = []
                if request.context.repo:
                    context_parts.append(f"repo={request.context.repo}")
                if request.context.path:
                    context_parts.append(f"path={request.context.path}")
                if request.context.pageNumber:
                    context_parts.append(f"page={request.context.pageNumber}")
                print(f"  Context: {', '.join(context_parts)}")
            print("=" * 80 + "\n")

        # Determine working directory and accessible directories
        cwd = None
        add_dirs = [r.root for r in workspace_config.repos]

        # Use context.repo if available, otherwise use first repo as default
        target_repo = request.context.repo if request.context else None
        if target_repo:
            repo_config = next(
                (r for r in workspace_config.repos if r.name == target_repo), None
            )
            if repo_config:
                cwd = repo_config.root
            else:
                return JSONResponse(
                    content={"error": f"Repository '{target_repo}' not found"},
                    status_code=404,
                )
        else:
            # No context repo, use first repo as default cwd
            if workspace_config.repos:
                cwd = workspace_config.repos[0].root

        # Configure MCP servers and default tools
        pdf_server = create_sdk_mcp_server(
            name="pdf-reader",
            version="1.0.0",
            tools=[
                open_pdf,
                page_count,
                extract_text,
                render_page_png,
                search_text,
                close_pdf,
            ],
        )

        # Frontend tools MCP server
        frontend_server = create_sdk_mcp_server(
            name="frontend",
            version="1.0.0",
            tools=FRONTEND_TOOLS,
        )

        default_tools = [
            "Read",
            "Grep",
            "Glob",
            "mcp__pdf-reader__open_pdf",
            "mcp__pdf-reader__page_count",
            "mcp__pdf-reader__extract_text",
            "mcp__pdf-reader__render_page_png",
            "mcp__pdf-reader__search_text",
            "mcp__pdf-reader__close_pdf",
            "mcp__frontend__get_visible_content",
            "mcp__frontend__get_selection",
            "mcp__frontend__get_current_page",
            "mcp__frontend__get_document_notes",
            "mcp__frontend__get_visible_notes",
            "mcp__frontend__refresh_view",
            "mcp__frontend__canvas_draw",
            "mcp__frontend__canvas_clear",
            "mcp__frontend__canvas_get_instructions",
            "mcp__frontend__canvas_snapshot",
            "mcp__frontend__canvas_setup",
            "mcp__frontend__get_headings",
            "mcp__frontend__scroll_to_heading",
        ]

        # Config-first resolution: config.json > env vars
        api_settings = load_api_settings()
        model = (
            (request.options.get("model") if request.options else None)
            or api_settings.get("default_model")
        )

        query_options = ClaudeAgentOptions(
            model=model,
            cwd=cwd,
            mcp_servers={"pdf-reader": pdf_server, "frontend": frontend_server},
            allowed_tools=(
                request.options.get("allowedTools", default_tools)
                if request.options
                else default_tools
            ),
            permission_mode=(
                request.options.get("permissionMode", "bypassPermissions")
                if request.options
                else "bypassPermissions"
            ),
            include_partial_messages=True,
            resume=request.sessionId,
            system_prompt={"type": "preset", "preset": "claude_code"},
            max_turns=request.options.get("maxTurns") if request.options else None,
            env=build_sdk_env(),
            add_dirs=add_dirs,
            stderr=lambda line: print(f"[CLI] {line}", flush=True) if DEBUG else None,
        )

        if DEBUG:
            print("⚙️  [SDK OPTIONS]")
            print(f"  cwd: {cwd}")
            print(f"  mcp_servers: pdf-reader")
            print(f"  allowed_tools: {len(query_options.allowed_tools)} tools")
            print(f"  resume: {query_options.resume}\n")

        # Create client outside generator for abort support
        client = ClaudeSDKClient(options=query_options)
        await client.connect()

        # Track session ID for cleanup
        current_session_id = request.sessionId

        async def generate_response():
            """Generate streaming response using ClaudeSDKClient"""
            nonlocal current_session_id
            try:
                # Build workspace info
                repos_info = "\n".join(
                    [f"  - {repo.name}: {repo.root}" for repo in workspace_config.repos]
                )

                # Enhance prompt with lightweight context
                enhanced_prompt = request.prompt
                if request.context and (request.context.repo or request.context.path):
                    context_info = []
                    if request.context.repo:
                        context_info.append(f"Repository: {request.context.repo}")
                    if request.context.path:
                        context_info.append(f"Current File: {request.context.path}")
                    if request.context.pageNumber:
                        context_info.append(f"Current Page: {request.context.pageNumber}")

                    context_str = "\n".join(context_info)

                    # Keep tool guidance short; only include tools that benefit from a usage hint.
                    tool_guide = """[Available Tools Guide]

Use frontend tools when the user asks about what they are currently viewing.
- get_visible_content: For "this section", "what I'm seeing", or current-page questions.
- get_selection: For user-selected or quoted text.
- get_current_page: For the current PDF page number.
- get_document_notes / get_visible_notes: If the user mentions notes, sticky notes, comments, annotations, reminders, or asks you to incorporate their notes, call one of these before answering.
- refresh_view: After changing a file the user is viewing.

PDF tools: open_pdf -> operate with page_count / extract_text / render_page_png / search_text -> close_pdf.

Canvas tools require a .board file to be open:
- canvas_setup
- canvas_draw
- canvas_clear
- canvas_get_instructions
- canvas_snapshot
"""

                    quote_count = request.context.quoteCount
                    if quote_count and quote_count > 0:
                        tool_guide += f"""
IMPORTANT: The user has {quote_count} quoted text selection(s) in the queue. You MUST call get_selection to retrieve them before answering. These quotes provide critical context for the user's question.
"""

                    enhanced_prompt = f"""[Workspace Configuration]
Available Repositories:
{repos_info}

[Current Context]
{context_str}

{tool_guide}
User Question:
{request.prompt}"""
                else:
                    # No specific context, just provide workspace info
                    enhanced_prompt = f"""[Workspace Configuration]
Available Repositories:
{repos_info}

User Question:
{request.prompt}"""

                await client.query(enhanced_prompt)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__

                    if DEBUG:
                        print(f"📨 [{msg_type}]", flush=True)

                    if msg_type == "SystemMessage" and msg.subtype == "init":
                        session_id = msg.data.get("session_id")
                        if session_id:
                            current_session_id = session_id
                            # Register session for abort support
                            async with session_lock:
                                active_sessions[session_id] = client
                            if DEBUG:
                                print(f"✓ Registered session: {session_id}")

                        yield f"data: {json.dumps({'type': 'system', 'subtype': 'init', 'session_id': session_id}, ensure_ascii=False)}\n\n"

                    elif (
                        msg_type == "StreamEvent"
                        and msg.event.get("type") == "content_block_delta"
                    ):
                        yield f"data: {json.dumps({'type': 'stream_event', 'event': msg.event}, ensure_ascii=False)}\n\n"

                    elif msg_type == "AssistantMessage":
                        content_text = "".join(
                            block.text
                            for block in msg.content
                            if hasattr(block, "text")
                        )
                        yield f"data: {json.dumps({'type': 'assistant', 'content': content_text}, ensure_ascii=False)}\n\n"

                    elif msg_type == "ResultMessage":
                        yield f"data: {json.dumps({'type': 'result', 'session_id': msg.session_id, 'duration_ms': msg.duration_ms, 'usage': msg.usage.__dict__ if hasattr(msg.usage, '__dict__') else msg.usage}, ensure_ascii=False)}\n\n"

            except Exception as e:
                print(f"❌ Error in chat response: {e}")
                import traceback

                traceback.print_exc()
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
            finally:
                # Cleanup: remove from active sessions (SDK will auto-cleanup on GC)
                if current_session_id:
                    async with session_lock:
                        active_sessions.pop(current_session_id, None)
                    if DEBUG:
                        print(f"✓ Removed session from pool: {current_session_id}")

        return StreamingResponse(
            generate_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            },
        )
