#!/usr/bin/env python3
"""
Increa Reader Server - Python implementation with FastAPI and MCP integration
"""

import os
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed. Environment variables from .env file won't be loaded.")

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import aiofiles

# Import the PDF reader MCP server
from pdf_reader_mcp import mcp as pdf_mcp

# Import chat functionality using Claude SDK
from claude_agent_sdk import query, ClaudeAgentOptions

# --- Data Models ---

class RepoItem(BaseModel):
    name: str
    root: str

class WorkspaceConfig(BaseModel):
    title: str
    repos: List[RepoItem]
    excludes: List[str]

class TreeNode(BaseModel):
    type: str  # 'dir' | 'file'
    name: str
    path: str
    children: Optional[List['TreeNode']] = None

class RepoResource(BaseModel):
    name: str
    files: List[TreeNode]

class ViewResponse(BaseModel):
    type: str  # 'text' | 'binary'
    content: str
    filename: str

class ChatRequest(BaseModel):
    prompt: str
    sessionId: Optional[str] = None
    repo: Optional[str] = None
    options: Optional[Dict[str, Any]] = None

# --- Configuration ---

app = FastAPI(
    title="Increa Reader API",
    description="A FastAPI server for increa-reader with PDF and chat capabilities",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global workspace configuration
workspace_config = WorkspaceConfig(
    title="Increa Reader",
    repos=[],
    excludes=["node_modules", ".*", "*.log"]
)

# --- Helper Functions ---

def load_workspace_config():
    """Load workspace configuration from environment variables"""
    global workspace_config

    # Parse INCREA_REPO environment variable (colon-separated paths)
    increa_repo = os.getenv("INCREA_REPO", "")
    if increa_repo:
        repo_paths = [path.strip() for path in increa_repo.split(":") if path.strip()]
        repos = []

        for i, repo_path in enumerate(repo_paths):
            path_obj = Path(repo_path).resolve()
            if path_obj.exists():
                repos.append(RepoItem(
                    name=path_obj.name,
                    root=str(path_obj)
                ))

        workspace_config.repos = repos

def is_text_file(content: bytes) -> bool:
    """Check if file content is text-based"""
    try:
        content.decode('utf-8')
        return True
    except UnicodeDecodeError:
        # Check for common binary file signatures
        binary_signatures = [
            b'\x89PNG',  # PNG
            b'\xff\xd8\xff',  # JPEG
            b'%PDF',  # PDF
            b'GIF8',  # GIF
        ]
        return not any(content.startswith(sig) for sig in binary_signatures)

def build_file_tree(dir_path: Path, relative_to: Path, excludes: List[str]) -> List[TreeNode]:
    """Recursively build file tree"""
    nodes = []

    try:
        for item in dir_path.iterdir():
            # Skip excluded files/directories
            if any(item.name.startswith(exclude.rstrip('*')) for exclude in excludes):
                continue

            relative_path = str(item.relative_to(relative_to))

            if item.is_dir():
                children = build_file_tree(item, relative_to, excludes)
                nodes.append(TreeNode(
                    type="dir",
                    name=item.name,
                    path=relative_path,
                    children=children
                ))
            else:
                nodes.append(TreeNode(
                    type="file",
                    name=item.name,
                    path=relative_path
                ))
    except PermissionError:
        pass

    # Sort: directories first, then files (both alphabetically)
    nodes.sort(key=lambda x: (x.type != "dir", x.name.lower()))
    return nodes

# --- API Routes ---

@app.get("/api/workspace/tree")
async def get_workspace_tree():
    """Get workspace file tree"""
    result = []

    for repo in workspace_config.repos:
        repo_path = Path(repo.root)
        if repo_path.exists():
            files = build_file_tree(repo_path, repo_path, workspace_config.excludes)
            result.append(RepoResource(name=repo.name, files=files))

    return {"data": result}

@app.get("/api/views/{repo}/{path:path}")
async def get_file_content(repo: str, path: str):
    """Get file content"""
    # Find repository
    repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
    if not repo_config:
        raise HTTPException(status_code=404, detail=f"Repository '{repo}' not found")

    file_path = Path(repo_config.root) / path

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Read file content
    async with aiofiles.open(file_path, 'rb') as f:
        content = await f.read()

    if is_text_file(content):
        return ViewResponse(
            type="text",
            content=content.decode('utf-8', errors='replace'),
            filename=Path(path).name
        )
    else:
        return ViewResponse(
            type="binary",
            content="[Binary file - preview not available]",
            filename=Path(path).name
        )

@app.get("/api/preview")
async def get_file_preview(repo: str, path: str):
    """Get file preview information"""
    # Find repository
    repo_config = next((r for r in workspace_config.repos if r.name == repo), None)
    if not repo_config:
        raise HTTPException(status_code=404, detail=f"Repository '{repo}' not found")

    file_path = Path(repo_config.root) / path

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # File type detection logic
    ext = Path(path).suffix.lower()

    # Image files
    image_exts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']
    if ext in image_exts:
        return {"type": "image", "path": path}

    # Markdown files
    if ext in ['.md', '.markdown']:
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            content = await f.read()
        return {"type": "markdown", "body": content}

    # Code files (simplified language detection)
    code_langs = {
        '.js': 'javascript', '.jsx': 'jsx',
        '.ts': 'typescript', '.tsx': 'tsx',
        '.py': 'python', '.java': 'java',
        '.c': 'c', '.cpp': 'cpp', '.h': 'c',
        '.go': 'go', '.rs': 'rust', '.php': 'php',
        '.html': 'html', '.css': 'css', '.json': 'json',
        '.yaml': 'yaml', '.yml': 'yaml', '.xml': 'xml'
    }

    if ext in code_langs:
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            content = await f.read()
        return {"type": "code", "lang": code_langs[ext], "body": content}

    # PDF files - special handling
    if ext == '.pdf':
        return {"type": "pdf", "path": path}

    return {"type": "unsupported", "path": path}

@app.post("/api/chat/query")
async def chat_query(request: ChatRequest):
    """Handle chat queries with streaming response"""
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

    # Configure MCP servers - Use stdio configuration for external Python MCP server
    mcp_servers = {
        "pdf-reader": {
            "command": "python",
            "args": ["-m", "pdf_reader_mcp"],
            "env": {"PYTHONPATH": str(Path(__file__).parent)}
        }
    }

    # Query options for Claude SDK - Python SDK uses different parameter names
    default_tools = ["Read", "Grep", "Glob", "open_pdf", "page_count", "extract_text", "render_page_png", "search_text", "close_pdf"]

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
        add_dirs=[r.root for r in workspace_config.repos]
    )

    async def generate_response():
        """Generate streaming response"""
        try:
            message_count = 0
            async for msg in query(prompt=request.prompt, options=query_options):
                message_count += 1

                # Convert Python SDK messages to frontend-expected format
                if type(msg).__name__ == 'SystemMessage':
                    # Convert SystemMessage to frontend format
                    if msg.subtype == 'init':
                        yield f"data: {json.dumps({'type': 'system', 'subtype': 'init', 'session_id': msg.data.get('session_id')})}\n\n"

                elif type(msg).__name__ == 'StreamEvent':
                    # Convert StreamEvent to frontend format
                    event_type = msg.event.get('type')

                    if event_type == 'content_block_delta':
                        # 前端期望的是原始event结构，包含delta.text
                        yield f"data: {json.dumps({'type': 'stream_event', 'event': msg.event})}\n\n"

                elif type(msg).__name__ == 'AssistantMessage':
                    # Convert AssistantMessage to frontend format
                    content_text = ''
                    if msg.content:
                        for block in msg.content:
                            if hasattr(block, 'text'):
                                content_text += block.text
                    yield f"data: {json.dumps({'type': 'assistant', 'content': content_text})}\n\n"

                elif type(msg).__name__ == 'ResultMessage':
                    # Convert ResultMessage to frontend format
                    yield f"data: {json.dumps({'type': 'result', 'session_id': msg.session_id, 'duration_ms': msg.duration_ms, 'usage': msg.usage.__dict__ if hasattr(msg.usage, '__dict__') else msg.usage})}\n\n"

                else:
                    # Fallback for unknown message types
                    if hasattr(msg, '__dict__'):
                        msg_dict = msg.__dict__
                        msg_dict['type'] = type(msg).__name__.lower()
                        yield f"data: {json.dumps(msg_dict, default=str)}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'unknown', 'data': str(msg)})}\n\n"

        except Exception as e:
            print(f"Error in chat response: {e}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )

@app.get("/api")
async def root():
    """Root endpoint"""
    return {"message": "Increa Reader Server (Python)"}

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "repos": len(workspace_config.repos)}

# --- Lifecycle Events ---

@app.on_event("startup")
async def startup_event():
    """Load configuration on startup"""
    load_workspace_config()
    print(f"🚀 Increa Reader Server started")
    print(f"   Repositories: {len(workspace_config.repos)}")
    for repo in workspace_config.repos:
        print(f"   - {repo.name}: {repo.root}")

# --- Main Entry ---

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )