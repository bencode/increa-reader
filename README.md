# Increa Reader

A modern code and document reader with AI-powered chat functionality.

## Features

- **Three-panel resizable layout**: File tree, content viewer, and chat panel
- **Multi-repository support**: Browse multiple code repositories simultaneously
- **PDF processing**: Built-in PDF viewing and search capabilities
- **AI chat integration**: Claude-powered assistance for code and document analysis
- **Syntax highlighting**: Rich code display with language-specific highlighting
- **Streaming responses**: Real-time AI interaction

## Prerequisites

- Node.js 18+
- Python 3.10+
- pnpm (`npm install -g pnpm`)

## Quick Start

### Automated Setup (Recommended)

```bash
git clone <repository-url>
cd increa-reader
pnpm run setup
```

This will install all dependencies, create a Python virtual environment, and generate a `.env` file. After setup, edit `packages/server/.env` to configure your settings.

### Manual Setup

```bash
git clone <repository-url>
cd increa-reader

# Install Node.js dependencies
pnpm install

# Create Python virtual environment and install dependencies
python3 -m venv packages/server/.venv
packages/server/.venv/bin/pip install -r packages/server/requirements.txt

# Create .env from example
cp packages/server/.env.example packages/server/.env
# Edit .env with your configuration
```

### Configuration

Edit `packages/server/.env`:

```bash
# Required: paths to repositories you want to browse (colon-separated)
INCREA_REPO="/path/to/repo1:/path/to/repo2"

# Required for AI chat: your Anthropic API key
ANTHROPIC_API_KEY="your-api-key"
```

Alternatively, you can configure repositories through the UI settings panel after starting the application.

### Start Development

```bash
pnpm dev
```

This starts both the frontend (http://localhost:5173) and backend (http://localhost:3000). Open http://localhost:5173 in your browser.

## Architecture

- **Frontend** (`packages/ui`): React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Vite
- **Backend** (`packages/server`): FastAPI, PyMuPDF, Claude SDK, MCP
- **PDF MCP** (`packages/pdf-reader-mcp`): Standalone MCP service for PDF processing

## Commands

```bash
pnpm dev                                      # Start both frontend and backend
pnpm --filter @increa-reader/ui dev           # Frontend only (port 5173)
pnpm --filter @increa-reader/server dev       # Backend only (port 3000)
pnpm build                                    # Build all packages
pnpm --filter @increa-reader/ui typecheck     # Type checking
pnpm --filter @increa-reader/ui lint          # ESLint
```

## Troubleshooting

**"python: command not found" or venv errors**
The server expects a virtual environment at `packages/server/.venv`. Run `pnpm run setup` or create it manually:
```bash
python3 -m venv packages/server/.venv
packages/server/.venv/bin/pip install -r packages/server/requirements.txt
```

**Port 3000 already in use**
Set a custom port in `packages/server/.env`:
```bash
PORT=3001
```
Note: if you change the backend port, also update `packages/ui/vite.config.ts` proxy target to match.

**AI chat not working**
Ensure `ANTHROPIC_API_KEY` is set in `packages/server/.env`. The server will print a warning on startup if the key is missing.

**No repositories showing**
Set `INCREA_REPO` in `packages/server/.env`, or configure repositories through the UI settings panel.

## License

Private repository
