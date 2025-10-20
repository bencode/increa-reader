#!/usr/bin/env python3
"""
Chat API endpoints with streaming support
"""

import os
import json
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, create_sdk_mcp_server
from .models import ChatRequest, WorkspaceConfig
from .pdf_tools import open_pdf, page_count, extract_text, render_page_png, search_text, close_pdf

# Debug logging flag
DEBUG = os.getenv("DEBUG", "false").lower() == "true"


def create_chat_routes(app, workspace_config: WorkspaceConfig):
    """Create chat-related API routes"""

    @app.post("/api/chat/query")
    async def chat_query(request: ChatRequest):
        """Handle chat queries with streaming response"""
        if DEBUG:
            print("\n" + "="*80)
            print(f"📥 [CHAT REQUEST] {request.prompt[:100]}...")
            print(f"  Repo: {request.repo} | SessionId: {request.sessionId}")
            if request.context:
                print(f"  Context: repo={request.context.repo}, path={request.context.path}")
            print("="*80 + "\n")

        # Determine working directory and accessible directories
        cwd = None
        add_dirs = [r.root for r in workspace_config.repos]

        if request.repo:
            # Set specific repo as cwd
            repo_config = next((r for r in workspace_config.repos if r.name == request.repo), None)
            if repo_config:
                cwd = repo_config.root
            else:
                return JSONResponse(
                    content={"error": f"Repository '{request.repo}' not found"},
                    status_code=404
                )
        else:
            # No specific repo, use first repo as default cwd
            if workspace_config.repos:
                cwd = workspace_config.repos[0].root

        # Configure MCP servers and default tools
        pdf_server = create_sdk_mcp_server(
            name="pdf-reader",
            version="1.0.0",
            tools=[open_pdf, page_count, extract_text, render_page_png, search_text, close_pdf]
        )

        default_tools = [
            "Read", "Grep", "Glob",
            "mcp__pdf-reader__open_pdf", "mcp__pdf-reader__page_count", "mcp__pdf-reader__extract_text",
            "mcp__pdf-reader__render_page_png", "mcp__pdf-reader__search_text", "mcp__pdf-reader__close_pdf"
        ]

        query_options = ClaudeAgentOptions(
            cwd=cwd,
            mcp_servers={"pdf-reader": pdf_server},
            allowed_tools=request.options.get("allowedTools", default_tools) if request.options else default_tools,
            permission_mode=request.options.get("permissionMode", "bypassPermissions") if request.options else "bypassPermissions",
            include_partial_messages=True,
            resume=request.sessionId,
            system_prompt={
                "type": "preset",
                "preset": "claude_code"
            },
            max_turns=request.options.get("maxTurns") if request.options else None,
            env={
                "ANTHROPIC_BASE_URL": os.getenv("ANTHROPIC_BASE_URL"),
                "ANTHROPIC_AUTH_TOKEN": os.getenv("ANTHROPIC_AUTH_TOKEN"),
                "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY", ""),
            },
            add_dirs=add_dirs,
            stderr=lambda line: print(f"[CLI] {line}", flush=True) if DEBUG else None
        )

        if DEBUG:
            print("⚙️  [SDK OPTIONS]")
            print(f"  cwd: {cwd}")
            print(f"  mcp_servers: pdf-reader")
            print(f"  allowed_tools: {len(query_options.allowed_tools)} tools")
            print(f"  resume: {query_options.resume}\n")

        async def generate_response():
            """Generate streaming response using ClaudeSDKClient"""
            try:
                # Build workspace info
                repos_info = "\n".join([
                    f"  - {repo.name}: {repo.root}"
                    for repo in workspace_config.repos
                ])

                # Enhance prompt with context
                enhanced_prompt = request.prompt
                if request.context and (request.context.repo or request.context.path):
                    context_info = []
                    if request.context.repo:
                        context_info.append(f"Repository: {request.context.repo}")
                    if request.context.path:
                        context_info.append(f"Current File: {request.context.path}")

                    context_str = "\n".join(context_info)
                    enhanced_prompt = f"""[Workspace Configuration]
Available Repositories:
{repos_info}

[Current Context]
{context_str}

User Question:
{request.prompt}"""
                else:
                    # No specific context, just provide workspace info
                    enhanced_prompt = f"""[Workspace Configuration]
Available Repositories:
{repos_info}

User Question:
{request.prompt}"""

                async with ClaudeSDKClient(options=query_options) as client:
                    await client.query(enhanced_prompt)

                    async for msg in client.receive_response():
                        msg_type = type(msg).__name__

                        if DEBUG:
                            print(f"📨 [{msg_type}]", flush=True)

                        if msg_type == 'SystemMessage' and msg.subtype == 'init':
                            yield f"data: {json.dumps({'type': 'system', 'subtype': 'init', 'session_id': msg.data.get('session_id')}, ensure_ascii=False)}\n\n"

                        elif msg_type == 'StreamEvent' and msg.event.get('type') == 'content_block_delta':
                            yield f"data: {json.dumps({'type': 'stream_event', 'event': msg.event}, ensure_ascii=False)}\n\n"

                        elif msg_type == 'AssistantMessage':
                            content_text = ''.join(
                                block.text for block in msg.content if hasattr(block, 'text')
                            )
                            yield f"data: {json.dumps({'type': 'assistant', 'content': content_text}, ensure_ascii=False)}\n\n"

                        elif msg_type == 'ResultMessage':
                            yield f"data: {json.dumps({'type': 'result', 'session_id': msg.session_id, 'duration_ms': msg.duration_ms, 'usage': msg.usage.__dict__ if hasattr(msg.usage, '__dict__') else msg.usage}, ensure_ascii=False)}\n\n"

            except Exception as e:
                print(f"❌ Error in chat response: {e}")
                import traceback
                traceback.print_exc()
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

        return StreamingResponse(
            generate_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            }
        )