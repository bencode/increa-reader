#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "=== Increa Reader Setup ==="
echo

# Check prerequisites
echo "Checking prerequisites..."

command -v node >/dev/null 2>&1 || error "Node.js is not installed. Please install Node.js 22+."
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  error "Node.js 22+ is required (found v$(node -v))"
fi
info "Node.js $(node -v)"

command -v pnpm >/dev/null 2>&1 || error "pnpm is not installed. Install with: npm install -g pnpm"
info "pnpm $(pnpm -v)"

command -v python3 >/dev/null 2>&1 || error "Python 3 is not installed. Please install Python 3.10+."
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
if [ "$PYTHON_MINOR" -lt 10 ]; then
  error "Python 3.10+ is required (found $PYTHON_VERSION)"
fi
info "Python $PYTHON_VERSION"

echo

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
pnpm install
info "Node.js dependencies installed"

echo

# Create Python virtual environment
echo "Setting up Python environment..."
if [ ! -d "packages/server/.venv" ]; then
  python3 -m venv packages/server/.venv
  info "Created virtual environment at packages/server/.venv"
else
  info "Virtual environment already exists"
fi

# Install Python dependencies
packages/server/.venv/bin/pip install -r packages/server/requirements.txt --quiet
info "Python dependencies installed"

echo

# Copy .env.example if .env doesn't exist
if [ ! -f "packages/server/.env" ]; then
  cp packages/server/.env.example packages/server/.env
  info "Created packages/server/.env from .env.example"
  warn "Please edit packages/server/.env to configure your settings:"
  echo "   - Set INCREA_REPO to your repository paths"
  echo "   - Set ANTHROPIC_API_KEY for AI chat functionality"
else
  info "packages/server/.env already exists (skipped)"
fi

echo
echo "=== Setup complete! ==="
echo
echo "Next steps:"
echo "  1. Edit packages/server/.env with your configuration"
echo "  2. Run: pnpm dev"
echo
