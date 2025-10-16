#!/usr/bin/env python3
"""
Main application entry point for Increa Reader Server
"""

import os
from pathlib import Path

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed. Environment variables from .env file won't be loaded.")

import uvicorn
from fastapi import FastAPI

# Import local modules
from .models import WorkspaceConfig
from .workspace import load_workspace_config
from .views import create_workspace_routes, create_view_routes
from .chat import create_chat_routes


def create_app() -> FastAPI:
    """Create and configure the FastAPI application"""
    app = FastAPI(
        title="Increa Reader API",
        description="A FastAPI server for increa-reader with PDF and chat capabilities",
        version="1.0.0"
    )

    # CORS middleware
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],  # Vite dev server
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global workspace configuration
    workspace_config = load_workspace_config()

    # Register all route modules
    create_workspace_routes(app, workspace_config)
    create_view_routes(app, workspace_config)
    create_chat_routes(app, workspace_config)

    @app.get("/api")
    async def root():
        """Root endpoint"""
        return {"message": "Increa Reader Server (Python)"}

    @app.get("/health")
    async def health():
        """Health check endpoint"""
        return {"status": "healthy", "repos": len(workspace_config.repos)}

    @app.on_event("startup")
    async def startup_event():
        """Load configuration on startup"""
        print(f"🚀 Increa Reader Server started")
        print(f"   Repositories: {len(workspace_config.repos)}")
        for repo in workspace_config.repos:
            print(f"   - {repo.name}: {repo.root}")

    return app


# Create the app instance for import
app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )