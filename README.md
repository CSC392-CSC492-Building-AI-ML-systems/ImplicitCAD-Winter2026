# ImplicitCAD Studio

A web-based IDE for [ImplicitCAD](https://github.com/Haskell-Things/ImplicitCAD) — write OpenSCAD code, get instant 3D previews, and generate code with AI.

## AI Model

This project uses a fine-tuned Qwen3.5 9B model for OpenSCAD code generation, hosted on Hugging Face:

  https://huggingface.co/Max2475/Qwen3.5-9B-OpenSCAD-Instruct

> Note: Model weights are hosted on Hugging Face due to GitHub size limits. Run `./studio.sh` and select "Add 9B" to download.

## Quick Start (Docker)

```bash
git clone https://github.com/CSC392-CSC492-Building-AI-ML-systems/ImplicitCAD-Winter2026.git
cd ImplicitCAD-Winter2026
./install.sh
```

> First build takes ~15-20 min (compiling ImplicitCAD from Haskell source). Subsequent starts take seconds.

### Requirements

- **Docker** with Docker Compose

### Docker Commands

```bash
./up.sh -d                        # Start all services and show ports
./up.sh -d --build                # Rebuild and start, then show ports
docker compose down               # Stop
docker compose logs -f            # View logs
docker compose build --no-cache   # Full rebuild
```

`./up.sh` wraps `docker compose up` and automatically prints the published ports after startup. The frontend uses a dynamic host port to avoid conflicts with anything already running on port 3000.

## Development (recommended workflow)

Run the Docker backends and the Vite dev server locally for instant hot-reload:

```bash
# Start only the backend containers
docker compose up -d implicitcad server

# Run the frontend dev server
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Vite starts at **http://localhost:3000** with hot module replacement. API calls are proxied to the Docker backends automatically (`/api` -> `localhost:4000`, `/render` -> `localhost:8080`).

### Running everything in Docker (production-like)

```bash
./up.sh -d --build
```

This builds the frontend into a static nginx image. Use when testing the production setup or deploying.

### Prerequisites (local frontend dev)

- **Node.js** 18+

### Run the Server standalone (no Docker)

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
        http://localhost:3000 (dev) or dynamic port (Docker)
                    |
             [ Vite / nginx ]
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
| `implicitcad-engine` | ImplicitCAD: `implicitsnap` + `extopenscad` | host `8080` -> container `8080` |
| `implicitcad-server` | Node.js API: compile, AI chat, admesh validation | host `4000` -> container `4000` |
| `implicitcad-frontend` | React app via nginx (production only) | dynamic host port -> container `3000` |

The server container uses a Debian base image (matching the engine) so the shared `extopenscad` binary runs correctly. The binary is shared via a Docker named volume mounted at `/opt/implicitcad-bin`.

## Features

- **Code Editor** — Monaco with OpenSCAD syntax highlighting and auto-render
- **3D Viewport** — Three.js viewer with orbit controls, wireframe, camera presets, per-axis grid planes
- **AI Assistant** — Generate ImplicitCAD code from natural language (configurable LLM backend)
- **File Explorer** — Browser File System Access API for local folder editing
- **Export** — Download STL, viewport screenshots

### Viewport Controls

The bottom toolbar provides:

| Button | Action |
|--------|--------|
| Front / Top / Iso | Camera preset angles |
| XY / XZ / YZ | Toggle grid planes on each axis pair |
| W | Toggle wireframe mode |
| Reset | Reset camera to default position |
| Download | Export STL |
| Camera | Take viewport screenshot |
| Settings | Quality slider, $fn segments, resolution, compat mode |

Grid planes default to XY only (floor plane). Toggle XZ (front wall) or YZ (side wall) for additional reference planes. All grids are visible from both sides when orbiting.

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
up.sh              Docker compose wrapper that prints published ports
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
