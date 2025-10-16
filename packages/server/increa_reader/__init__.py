"""
Increa Reader Server - Python implementation with FastAPI and MCP integration
"""

__version__ = "1.0.0"

# Import key classes for external use
from .models import WorkspaceConfig, RepoItem, TreeNode, ViewResponse, ChatRequest
from .main import app

__all__ = [
    "WorkspaceConfig",
    "RepoItem",
    "TreeNode",
    "ViewResponse",
    "ChatRequest",
    "app"
]