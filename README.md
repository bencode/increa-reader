# Increa Reader

A modern code and document reader with AI-powered chat functionality.

## Overview

Increa Reader is a monorepo application consisting of a React frontend and FastAPI backend, designed for browsing code repositories and PDF documents with integrated AI assistance.

## Features

- **Three-panel resizable layout**: File tree, content viewer, and chat panel
- **Multi-repository support**: Browse multiple code repositories simultaneously
- **PDF processing**: Built-in PDF viewing and search capabilities
- **AI chat integration**: Claude-powered assistance for code and document analysis
- **Syntax highlighting**: Rich code display with language-specific highlighting
- **Streaming responses**: Real-time AI interaction

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: FastAPI, Python, PyMuPDF, Claude SDK, MCP (Model Context Protocol)
- **Build tool**: Vite with rolldown, React Compiler

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- pnpm

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd increa-reader
pnpm install
cd packages/server && pip install -r requirements.txt
```

### Environment Variables

```bash
# Required
export INCREA_REPO="/path/to/repo1:/path/to/repo2"  # Colon-separated paths
export ANTHROPIC_API_KEY="your-claude-api-key"

# Optional
export PORT=3000                    # Server port (default: 3000)
export ANTHROPIC_BASE_URL="custom-api-url"
```

### Development

```bash
# Start both frontend and backend
pnpm dev

# Or start individually
pnpm --filter @increa-reader/ui dev      # Frontend on port 5173
pnpm --filter @increa-reader/server dev  # Backend on port 3000
```

## Build & Check

```bash
pnpm build                                    # Build all packages
pnpm --filter @increa-reader/ui typecheck    # Type checking
pnpm --filter @increa-reader/ui lint         # ESLint
pnpm --filter @increa-reader/ui format       # Prettier
```

## API Endpoints

- `GET /api/workspace/tree` - Repository file tree
- `GET /api/views/{repo}/{path}` - File content
- `POST /api/chat/query` - AI chat (streaming)
- `GET /api/preview` - File preview

## Technology Stack

**Frontend (@increa-reader/ui)**
- React 19 with React Compiler
- TypeScript, Vite (rolldown)
- Tailwind CSS v4, shadcn/ui
- React Router, React Resizable Panels
- React Markdown, Syntax Highlighting

**Backend (@increa-reader/server)**
- FastAPI, uvicorn
- PyMuPDF for PDF processing
- Claude Agent SDK
- MCP (Model Context Protocol) tools

## License

Private repository