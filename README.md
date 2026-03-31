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
cp .env.example .env          # Review and adjust if needed
./studio.sh                   # Interactive TUI — select "First-time setup"
```

> First build takes ~15-20 min (compiling ImplicitCAD from Haskell source). Subsequent starts take seconds.

### System Requirements

- **Docker** 20+ with Docker Compose v2
- **RAM**: 4 GB minimum (8 GB recommended for AI model inference)
- **Disk**: ~10 GB free for Docker images (first build)
- **Node.js** 18+ (only for local frontend development)

### Using the TUI

`./studio.sh` is the single entry point for all operations:

| Menu Option | What it does |
|-------------|-------------|
| First-time setup | Installs Ollama, verifies Docker |
| Start Studio | Launches Docker services, starts Ollama, opens browser |
| Add 0.8B / 9B | Downloads AI models for code generation |
| View status | Shows Docker services, health checks, Ollama status |
| Advanced tools | Shell into containers, run smoke tests, compile files, tail logs |
| Stop all services | Shuts down Docker services and Ollama |
| Full rebuild | Rebuilds all containers from scratch |

`./studio.sh` is the only supported user entry point.

### Docker Commands

```bash
docker compose up -d --build  # Build and start all services
docker compose port frontend 3000  # Find the frontend URL (dynamic host port)
docker compose down           # Stop
docker compose logs -f        # View logs
docker compose build --no-cache   # Full rebuild
```

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

Vite starts at **http://localhost:3000** with hot module replacement. API calls are proxied to the Docker backend automatically (`/api` -> `localhost:14000`). Override the proxy target in `.env`:

```bash
VITE_API_URL=http://localhost:14000
```

### Running everything in Docker (production-like)

```bash
./studio.sh    # Select "Start Studio"
```

This builds the frontend into a static nginx image. Use when testing the production setup or deploying.

### Run the Server standalone (no Docker)

```bash
cd server
npm install
node server.js
```

API server starts at **http://localhost:4000**. See `.env.example` for all configurable environment variables.

### Compile .scad files via CLI

```bash
# Via studio.sh (requires Docker)
./studio.sh compile mymodel.scad -o mymodel.stl

# Or shell into a container for interactive use
./studio.sh exec server
# Inside: "$EXTOPENSCAD" -o output.stl input.scad
# Inside: admesh output.stl
```

## Architecture

```
        http://localhost:3000 (dev) or dynamic port (Docker)
                    |
             [ Vite / nginx ]
                    |
                 /api/*
                    |
               [ Node.js ]
                port 4000
      POST /api/compile
      POST /api/chat/stream
      GET  /api/health
```

| Container | Role | Port |
|-----------|------|------|
| `implicitcad-engine` | ImplicitCAD helper container: shared `extopenscad` binary volume, exec/test target | not published |
| `implicitcad-server` | Node.js API: compile, AI chat, admesh validation | host `SERVER_HOST_PORT` (default `14000`) -> container `4000` |
| `implicitcad-frontend` | React app via nginx (production only) | dynamic host port -> container `3000` |

The server container uses a Debian base image (matching the engine) so the shared `extopenscad` binary runs correctly. The binary is shared via a Docker named volume mounted at `/opt/implicitcad-bin`, and the helper engine container stays alive for `studio.sh exec/test/compile` workflows.

## Features

- **Code Editor** — Monaco with OpenSCAD syntax highlighting and auto-render
- **3D Viewport** — Three.js viewer with orbit controls, wireframe, camera presets, per-axis grid planes
- **AI Assistant** — Generate ImplicitCAD code from natural language (configurable LLM backend)
- **File Explorer** — Browser File System Access API for local folder editing
- **Export** — Download STL, viewport screenshots
- **Error Notifications** — Toast alerts and Output console with unread error badge

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
server/            Node.js API server (zero dependencies)
docker/            ImplicitCAD Dockerfile + entrypoint
ai_context/        ImplicitCAD language reference for LLM prompts
prompt/            Prompt templates for LLM benchmarking
test_files/        96 reference test cases (STL + admesh + prompts)
second-train/      Training data for LLM fine-tuning
studio.sh          TUI launcher — single entry point for all operations
.env.example       Environment variable template
```

## AI Configuration

The AI chat panel supports multiple providers. Select in the UI or configure via `.env`:

| Provider | Setup |
|----------|-------|
| **Ollama** (default) | Run `./studio.sh` → "Add 9B" to download the fine-tuned model |
| **OpenAI** | Set `OPENAI_API_KEY` in `.env` or via the API Keys dialog in the UI |
| **Anthropic** | Set `ANTHROPIC_API_KEY` in `.env` or via the API Keys dialog in the UI |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port conflict on 14000 | Change `SERVER_HOST_PORT` in `.env` |
| Vite proxy errors | Ensure Docker backends are running: `docker compose up -d implicitcad server` |
| "Docker backend not responding" | Wait ~10s after `docker compose up` for ImplicitCAD to compile its first build |
| Ollama not detected (Linux) | Ollama must listen on all interfaces: `sudo systemctl edit ollama`, add `Environment="OLLAMA_HOST=0.0.0.0"` under `[Service]`, then `sudo systemctl restart ollama`. Set `OLLAMA_URL=http://<bridge-ip>:11434` in `.env` where `<bridge-ip>` is your Docker bridge IP (find it with `ip -4 addr show docker0` or `docker network inspect bridge`; typically `172.17.0.1`). `./studio.sh` will auto-detect and guide you. |
| Build fails with OOM | Increase Docker memory limit to 4 GB+ (Docker Desktop → Settings → Resources) |
| Frontend shows blank page | Check browser console. Try `docker compose logs frontend` for nginx errors |

## License

AGPL-3.0-or-later (same as ImplicitCAD)
