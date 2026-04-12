# Increa Reader

An AI-assisted reader for code, Markdown, PDF, images, HTML, and `.board` files.
The chat backend is powered by the Claude Code SDK stack via `claude-agent-sdk`.

## Features

### Multi-format Document Viewer

- **Markdown** — GFM, KaTeX math formulas, Mermaid diagrams, heading outline with scroll sync
- **PDF** — dual modes: native SVG rendering and Markdown reading view; region selection and text extraction
- **Code** — syntax highlighting for 50+ languages
- **Images** — auto-scaled preview
- **HTML** — iframe rendering with source toggle
- **Board** — interactive p5.js canvas with 2D/WebGL 3D drawing, animation, and interactive controls

### Workspace

- Three-panel layout: repository tree, document viewer, and AI chat
- Multi-repository browsing with file tree filtering
- Tabbed file viewer for multiple files simultaneously
- In-app settings for repository paths and API configuration

### AI Chat

- Streaming conversation with Claude, powered by `claude-agent-sdk`
- Session history and persistence
- Context-aware tools: read visible content, selections, current PDF page, and notes
- Image upload via clipboard paste
- Canvas drawing and screenshot tools for `.board` files

### Notes

- Sticky notes for Markdown and PDF documents
- Markdown notes anchored to heading paths and block positions
- PDF notes anchored by page and coordinate ratios
- Color options: yellow, blue, green, pink
- AI tools can read document-wide and visible notes

### Board / Canvas

- p5.js drawing instructions with live rendering
- WebGL 3D support (box, sphere, lighting, camera, etc.)
- KaTeX math formula rendering on canvas
- Animation loop with configurable FPS and persistent variables
- Interactive controls: range sliders, number inputs
- Save/load board state, screenshot snapshots

## Quick Start

### 1. Install dependencies

```bash
git clone <repository-url>
cd increa-reader
pnpm run setup
```

`setup` checks prerequisites (Node.js 22+, Python 3.10+, pnpm), installs all dependencies,
creates `packages/server/.venv`, and generates `packages/server/.env`.

### 2. Configure

Edit `packages/server/.env`:

```bash
INCREA_REPO="/path/to/repo1:/path/to/repo2"
ANTHROPIC_API_KEY="your-api-key"
```

You can also configure repositories and API settings from the UI settings drawer after starting the app.

If you use a Claude-compatible proxy:

```bash
ANTHROPIC_BASE_URL="https://your-proxy-url/api/anthropic"
ANTHROPIC_AUTH_TOKEN="your-proxy-token"
```

### 3. Start development

```bash
pnpm dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start frontend and backend concurrently |
| `pnpm build` | Build all packages |
| `pnpm check` | Run typecheck and lint |
| `pnpm lint` | Lint frontend code (Biome) |
| `pnpm lint:fix` | Lint and auto-fix |
| `pnpm format` | Format frontend code (Biome) |
| `pnpm test` | Run all tests |

Filter to a single package with `--filter`:

```bash
pnpm --filter @increa-reader/ui dev
pnpm --filter @increa-reader/server dev
```

## Packages

| Package | Stack |
|---------|-------|
| `packages/ui` | React 19, TypeScript, Vite (rolldown-vite), Tailwind CSS 4, shadcn/ui, Zustand |
| `packages/server` | FastAPI, claude-agent-sdk, PyMuPDF |
| `packages/pdf-reader-mcp` | Standalone MCP server for PDF reading (can be registered in Claude Code / Claude Desktop) |

## Troubleshooting

**Python / virtualenv issues**

```bash
python3 -m venv packages/server/.venv
packages/server/.venv/bin/pip install -r packages/server/requirements.txt
```

**Chat is not available**

Check that `ANTHROPIC_API_KEY` is set in `packages/server/.env`.

**No repositories are shown**

Check `INCREA_REPO` in `.env`, or configure from the UI settings drawer.

**Backend port changed**

If you change `PORT`, update the proxy target in `packages/ui/vite.config.ts`.

## License

MIT
