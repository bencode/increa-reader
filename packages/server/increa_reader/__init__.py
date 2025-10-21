"""
Increa Reader Server - Python implementation with FastAPI and MCP integration
"""

__version__ = "1.0.0"

from .main import app

# Import key classes for external use
from .models import ChatRequest, RepoItem, TreeNode, ViewResponse, WorkspaceConfig

__all__ = [
    "WorkspaceConfig",
    "RepoItem",
    "TreeNode",
    "ViewResponse",
    "ChatRequest",
    "app",
]
