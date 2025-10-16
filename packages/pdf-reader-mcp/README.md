# PDF Reader MCP Server

A Model Context Protocol (MCP) server for reading and searching PDF files.

**Note**: This package is now part of the [increa-reader](../../README.md) monorepo.

## Installation

### Development Setup

```bash
# From the monorepo root
cd packages/pdf-reader-mcp

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"
```

### Testing

```bash
# From package directory
pnpm test          # Run all tests
pnpm test:cov      # Run tests with coverage

# Or using pytest directly
pytest tests/ -v
pytest tests/ --cov=pdf_reader_server
```

## Usage

### Development Mode
```bash
# Using pnpm (from monorepo root)
pnpm --filter @increa/pdf-reader-mcp dev

# Or directly with Python
cd packages/pdf-reader-mcp
python pdf_reader_server.py
```

### Install to Claude Code

```bash
# Replace /absolute/path with your actual monorepo path
claude mcp add pdf-reader \
  /absolute/path/increa-reader/packages/pdf-reader-mcp/.venv/bin/python \
  /absolute/path/increa-reader/packages/pdf-reader-mcp/pdf_reader_server.py
```

### 3. Available Tools

The server provides these tools that Claude can use:

1. **open_pdf(path)** - Open PDF and return doc_id
2. **page_count(doc_id)** - Get number of pages
3. **extract_text(doc_id, page)** - Extract text from page
4. **render_page_png(doc_id, page, dpi)** - Render page as PNG
5. **search_text(doc_id, query, max_hits)** - Search for text
6. **close_pdf(doc_id)** - Close document
