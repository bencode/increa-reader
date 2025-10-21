"""
Data models for Increa Reader Server
"""

from typing import List, Optional

from pydantic import BaseModel


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
    children: Optional[List["TreeNode"]] = None


class RepoResource(BaseModel):
    name: str
    files: List[TreeNode]


class ViewResponse(BaseModel):
    type: str  # 'text' | 'binary'
    content: str
    filename: str


class ChatContext(BaseModel):
    repo: Optional[str] = None
    path: Optional[str] = None
    pageNumber: Optional[int] = None


class ChatRequest(BaseModel):
    prompt: str
    sessionId: Optional[str] = None
    repo: Optional[str] = None
    context: Optional[ChatContext] = None
    options: Optional[dict] = None
