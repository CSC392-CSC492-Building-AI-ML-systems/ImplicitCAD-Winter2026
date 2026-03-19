# ImplicitCAD Studio

A web-based IDE for [ImplicitCAD](https://github.com/Haskell-Things/ImplicitCAD) — write OpenSCAD code, get instant 3D previews, and generate code with AI.

## Quick Start (Docker)

```bash
git clone https://github.com/CSC392-CSC492-Building-AI-ML-systems/ImplicitCAD-Winter2026.git
cd ImplicitCAD-Winter2026
./install.sh
```

Open **http://localhost:3000**.

> First build takes ~15-20 min (compiling ImplicitCAD from Haskell source). Subsequent starts take seconds.

### Requirements

- **Docker** with Docker Compose

### Docker Commands

```bash
docker compose up -d              # Start all services
docker compose down               # Stop
docker compose logs -f            # View logs
docker compose build --no-cache   # Full rebuild
```

## Local Development (no Docker)

### Prerequisites

- **Node.js** 18+
- **ImplicitCAD** (`extopenscad` and/or `implicitsnap` on PATH)
  - Install via Haskell/Cabal: `cabal install implicit`
- **admesh** (optional, for STL validation): `brew install admesh` / `apt install admesh`

### Run the Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Vite dev server starts at **http://localhost:5173**.

### Run the Server

```bash
cd server
npm install
node server.js
```

API server starts at **http://localhost:4000**. Configure with environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `WORKSPACE` | `./_workspace` | Working directory for file ops |
| `LLM_COMMAND` | `claude -p` | CLI command for AI code generation |
| `EXTOPENSCAD` | auto-detected | Path to extopenscad binary |
| `COMPILE_TIMEOUT` | `60` | Compilation timeout in seconds |

### Run ImplicitCAD Directly

```bash
# Via the CLI wrapper (requires Docker)
./icad compile mymodel.scad -o mymodel.stl

# Or via Docker
docker exec implicitcad-engine extopenscad -o output.stl input.scad
```

## Architecture

```
             http://localhost:3000
                      |
                  [ nginx ]
                 /         \
          /api/*            /render/*
            |                   |
     [ Node.js ]         [ implicitsnap ]
     port 4000            port 8080
     POST /api/compile    jsTHREE format
     POST /api/chat       (real-time preview)
     GET  /api/health
```

| Container | Role | Port |
|-----------|------|------|
| `implicitcad-engine` | ImplicitCAD: `implicitsnap` + `extopenscad` | 8080 |
| `implicitcad-server` | Node.js API: compile, AI chat | 4000 |
| `implicitcad-frontend` | React app via nginx | 3000 |

## Features

- **Code Editor** — Monaco with OpenSCAD syntax highlighting and auto-render
- **3D Viewport** — Three.js viewer with orbit controls, wireframe, camera presets, quality slider
- **AI Assistant** — Generate ImplicitCAD code from natural language (configurable LLM backend)
- **File Explorer** — Browser File System Access API for local folder editing
- **Export** — Download STL, viewport screenshots

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Compile and render |
| `Cmd/Ctrl + S` | Save current file |
| `Cmd/Ctrl + B` | Toggle file explorer |
| `Cmd/Ctrl + Shift + P` | Command palette |

## Project Structure

```
frontend/          React + Vite + TypeScript app
server/            Node.js API server
docker/            ImplicitCAD Dockerfile + entrypoint
ai_context/        ImplicitCAD language reference for LLM prompts
prompt/            Prompt templates for LLM benchmarking
test_files/        96 reference test cases (STL + admesh + prompts)
second-train/      Training data for LLM fine-tuning
install.sh         One-click Docker setup
icad               CLI wrapper for ImplicitCAD via Docker
```

## AI Configuration

```bash
# Claude CLI (default)
LLM_COMMAND="claude -p"

# Ollama
LLM_COMMAND="ollama run qwen3:32b"

# Simon Willison's llm
LLM_COMMAND="llm"
```

Set via `.env` or pass as an environment variable.

## License

AGPL-3.0-or-later (same as ImplicitCAD)
