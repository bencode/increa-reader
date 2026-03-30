# Increa Reader

An AI-assisted reader for code, Markdown, PDF, images, HTML, and `.board` files.
The chat backend is powered by the Claude Code SDK stack via `claude-agent-sdk`.

## Features

- Three-panel workspace: repository tree, document viewer, and chat
- Multi-repository browsing with left-panel filtering
- In-app settings for repository paths and API configuration
- Preview support for Markdown, PDF, code, images, HTML, and `.board`
- Dual PDF reading modes: native PDF view and Markdown reading view
- Notes for Markdown and PDF documents
- AI tools that can read visible content, selections, the current PDF page, and notes
- `.board` support powered by p5.js drawing instructions and snapshots

## Quick Start

### 1. Install dependencies

```bash
git clone <repository-url>
cd increa-reader
pnpm run setup
```

`setup` installs frontend dependencies, creates `packages/server/.venv`, and generates
`packages/server/.env`.

### 2. Configure repositories and AI

Edit `packages/server/.env`:

```bash
INCREA_REPO="/path/to/repo1:/path/to/repo2"
ANTHROPIC_API_KEY="your-api-key"
```

The SDK currently reads `ANTHROPIC_*` variables. If you use a Claude-compatible proxy, keep the same
variable names and point `ANTHROPIC_BASE_URL` at your proxy.

If you use a proxy:

```bash
ANTHROPIC_BASE_URL="https://your-proxy-url/api/anthropic"
ANTHROPIC_AUTH_TOKEN="your-proxy-token"
```

You can also start the app first and configure repositories from the UI settings drawer.

### 3. Start development

```bash
pnpm dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Common Commands

```bash
pnpm check
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm lint:fix
pnpm format

pnpm --filter @increa-reader/ui dev
pnpm --filter @increa-reader/ui check
pnpm --filter @increa-reader/ui lint
pnpm --filter @increa-reader/ui lint:fix
pnpm --filter @increa-reader/ui format
pnpm --filter @increa-reader/ui test

pnpm --filter @increa-reader/server dev
pnpm --filter @increa-reader/server test
```

## Notes

- Notes are currently supported for Markdown and PDF documents only.
- Markdown notes are anchored to document blocks.
- PDF notes are anchored by `page + ratio`.
- PDF notes appear only in the native PDF view, not in the PDF Markdown view.
- AI tools can read both document-wide notes and currently visible notes.

## Packages

- `packages/ui`: React 19 + TypeScript + Vite + Biome
- `packages/server`: FastAPI + `claude-agent-sdk` (Claude Code SDK stack) + PyMuPDF
- `packages/pdf-reader-mcp`: PDF MCP service

## Troubleshooting

**Python / virtualenv issues**

```bash
python3 -m venv packages/server/.venv
packages/server/.venv/bin/pip install -r packages/server/requirements.txt
```

**Chat is not available**

Check that `ANTHROPIC_API_KEY` is set in `packages/server/.env`. The backend uses the Claude Code
SDK environment naming, so `ANTHROPIC_*` is expected here.

**No repositories are shown**

Check `INCREA_REPO`, or reconfigure repositories from the UI settings drawer.

**You changed the backend port**

If you change `PORT`, update the proxy target in `packages/ui/vite.config.ts`.

## License

Private repository
