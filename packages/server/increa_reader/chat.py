#!/usr/bin/env python3
"""
Chat API endpoints with streaming support
"""

import os
import json
import asyncio
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, create_sdk_mcp_server
from .models import ChatRequest, WorkspaceConfig
from .pdf_tools import open_pdf, page_count, extract_text, render_page_png, search_text, close_pdf


def create_chat_routes(app, workspace_config: WorkspaceConfig):
    """Create chat-related API routes"""

    @app.post("/api/chat/query")
    async def chat_query(request: ChatRequest):
        """Handle chat queries with streaming response"""
        print("\n" + "="*80)
        print("📥 [CHAT REQUEST] Incoming request:")
        print(f"  Prompt: {request.prompt[:100]}..." if len(request.prompt) > 100 else f"  Prompt: {request.prompt}")
        print(f"  Repo: {request.repo}")
        print(f"  SessionId: {request.sessionId}")
        print(f"  Options: {request.options}")
        print("="*80 + "\n")

        # Find working directory based on repo context
        cwd = None
        system_prompt_append = ""

        if request.repo and request.repo != "~":
            repo_config = next((r for r in workspace_config.repos if r.name == request.repo), None)
            if repo_config:
                cwd = repo_config.root
                system_prompt_append = f"""
当前工作目录: {request.repo} ({cwd})
你可以直接使用相对路径访问此仓库的文件。
如需访问其他仓库，请使用完整路径：
{chr(10).join([f"- {r.name}: {r.root}" for r in workspace_config.repos if r.name != request.repo])}
                """.strip()
            else:
                return JSONResponse(
                    content={"error": f"Repository '{request.repo}' not found"},
                    status_code=404
                )
        else:
            if workspace_config.repos:
                cwd = workspace_config.repos[0].root
                system_prompt_append = f"""
你正在协助分析多个代码仓库：
{chr(10).join([f"- {r.name}: {r.root}" for r in workspace_config.repos])}

请根据用户的问题，搜索相关仓库或询问用户具体需求。
                """.strip()

        # Configure MCP servers - Use SDK MCP server (single process)
        pdf_server = create_sdk_mcp_server(
            name="pdf-reader",
            version="1.0.0",
            tools=[open_pdf, page_count, extract_text, render_page_png, search_text, close_pdf]
        )
        mcp_servers = {"pdf-reader": pdf_server}

        # Query options for Claude SDK
        # Tool naming: mcp__<server_key>__<tool_name>
        default_tools = [
            "Read", "Grep", "Glob",
            "mcp__pdf-reader__open_pdf", "mcp__pdf-reader__page_count", "mcp__pdf-reader__extract_text",
            "mcp__pdf-reader__render_page_png", "mcp__pdf-reader__search_text", "mcp__pdf-reader__close_pdf"
        ]

        # Callback to capture stderr from Claude CLI
        def stderr_callback(line: str):
            print(f"[CLI STDERR] {line}", flush=True)

        query_options = ClaudeAgentOptions(
            cwd=cwd,
            mcp_servers=mcp_servers,
            allowed_tools=request.options.get("allowedTools", default_tools) if request.options else default_tools,
            permission_mode=request.options.get("permissionMode", "bypassPermissions") if request.options else "bypassPermissions",
            include_partial_messages=True,
            resume=request.sessionId,
            system_prompt={
                "type": "preset",
                "preset": "claude_code",
                "append": system_prompt_append
            },
            max_turns=request.options.get("maxTurns") if request.options else None,
            env={
                "ANTHROPIC_BASE_URL": os.getenv("ANTHROPIC_BASE_URL"),
                "ANTHROPIC_AUTH_TOKEN": os.getenv("ANTHROPIC_AUTH_TOKEN"),
                "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY", ""),
            },
            add_dirs=[r.root for r in workspace_config.repos],
            stderr=stderr_callback
        )

        print("\n" + "="*80)
        print("⚙️  [SDK OPTIONS] ClaudeAgentOptions configuration:")
        print(f"  cwd: {cwd}")
        print(f"  mcp_servers: {list(mcp_servers.keys())}")
        print(f"  allowed_tools: {query_options.allowed_tools}")
        print(f"  permission_mode: {query_options.permission_mode}")
        print(f"  include_partial_messages: {query_options.include_partial_messages}")
        print(f"  resume: {query_options.resume}")
        print(f"  system_prompt append: {system_prompt_append[:100]}..." if len(system_prompt_append) > 100 else f"  system_prompt append: {system_prompt_append}")
        print(f"  max_turns: {query_options.max_turns}")
        print(f"  add_dirs: {query_options.add_dirs}")
        print(f"  env keys: {list(query_options.env.keys())}")
        print("="*80 + "\n")

        async def generate_response():
            """Generate streaming response using ClaudeSDKClient"""
            try:
                print(f"🚀 [SDK INPUT] Creating ClaudeSDKClient and calling query(prompt='{request.prompt[:100]}...', options=...)")
                message_count = 0

                async with ClaudeSDKClient(options=query_options) as client:
                    await client.query(request.prompt)

                    async for msg in client.receive_response():
                        message_count += 1
                        print(f"📨 [SDK OUTPUT #{message_count}] {type(msg).__name__}: {msg}")

                        # Convert Python SDK messages to frontend-expected format
                        if type(msg).__name__ == 'SystemMessage':
                            # Convert SystemMessage to frontend format
                            if msg.subtype == 'init':
                                yield f"data: {json.dumps({'type': 'system', 'subtype': 'init', 'session_id': msg.data.get('session_id')}, ensure_ascii=False)}\n\n"

                        elif type(msg).__name__ == 'StreamEvent':
                            # Convert StreamEvent to frontend format
                            event_type = msg.event.get('type')

                            if event_type == 'content_block_delta':
                                # 前端期望的是原始event结构，包含delta.text
                                yield f"data: {json.dumps({'type': 'stream_event', 'event': msg.event}, ensure_ascii=False)}\n\n"

                        elif type(msg).__name__ == 'AssistantMessage':
                            # Convert AssistantMessage to frontend format
                            content_text = ''
                            if msg.content:
                                for block in msg.content:
                                    if hasattr(block, 'text'):
                                        content_text += block.text
                            # Debug: Print content to console
                            print(f"DEBUG AssistantMessage content: {content_text[:100]}...")
                            yield f"data: {json.dumps({'type': 'assistant', 'content': content_text}, ensure_ascii=False)}\n\n"

                        elif type(msg).__name__ == 'ResultMessage':
                            # Convert ResultMessage to frontend format
                            yield f"data: {json.dumps({'type': 'result', 'session_id': msg.session_id, 'duration_ms': msg.duration_ms, 'usage': msg.usage.__dict__ if hasattr(msg.usage, '__dict__') else msg.usage}, ensure_ascii=False)}\n\n"

                        else:
                            # Fallback for unknown message types
                            if hasattr(msg, '__dict__'):
                                msg_dict = msg.__dict__
                                msg_dict['type'] = type(msg).__name__.lower()
                                yield f"data: {json.dumps(msg_dict, default=str, ensure_ascii=False)}\n\n"
                            else:
                                yield f"data: {json.dumps({'type': 'unknown', 'data': str(msg)}, ensure_ascii=False)}\n\n"

            except Exception as e:
                print(f"Error in chat response: {e}")
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