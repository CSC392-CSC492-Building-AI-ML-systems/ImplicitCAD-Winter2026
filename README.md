# Lowering Barriers to 3D Design: LLM-Assisted ImplicitCAD

This repository is primarily a CSC398 research project on fine-tuning a large language model for ImplicitCAD-compatible SCAD code generation. The browser-based ImplicitCAD Studio app in this repo is the demonstration environment used to run, inspect, and evaluate that model in an end-to-end workflow.

The project combines:

- a fine-tuned `Qwen3.5-9B` model for code generation
- a small curated dataset of ImplicitCAD editing tasks
- a Dockerized ImplicitCAD toolchain for reproducible compilation
- a browser IDE for editing, previewing, and iterating on generated geometry

## Overview

Code-based 3D modeling tools such as OpenSCAD and ImplicitCAD are precise and reproducible, but they are difficult for new users because geometric ideas must be translated into compilable programs. This project explores whether a domain-tuned LLM can lower that barrier by turning natural-language editing requests into working SCAD code, then pairing the model with compilation, mesh validation, and an interactive studio interface.

The main contribution of the project is the model-training and evaluation pipeline. ImplicitCAD Studio is the integrated demo environment built around that model.

Model weights are hosted separately on Hugging Face:

`https://huggingface.co/Max2475/Qwen3.5-9B-OpenSCAD-Instruct`

> The 9B model is the main research artifact. The smaller `0.8B` option exposed by `./studio.sh` is a lightweight local test model, not the primary evaluated model from the whitepaper.

## Research Summary

### Problem

General-purpose LLMs can often produce code that looks plausible, but geometric code generation has an extra failure mode: code may compile while still producing the wrong shape. ImplicitCAD also has a smaller ecosystem than mainstream languages, which means less documentation, less training data, and fewer benchmark resources.

This project focuses on that gap: ImplicitCAD-specific instruction following, verified compilation, and geometry-aware evaluation.

### Dataset Construction

The fine-tuning dataset contains `139` curated examples. Each example includes:

- a natural-language instruction
- an existing SCAD program
- the expected fully updated SCAD program after applying the requested change

The dataset was built from the project's internal test cases and was designed to cover common geometric editing operations such as:

- translation
- union
- difference
- object insertion

All target programs were manually checked to ensure they compiled correctly with the ImplicitCAD toolchain before being used for training.

### Training Procedure

Each example was converted into the chat format expected by `Qwen3.5`, where:

- the `user` message contains the instruction plus the initial code
- the `assistant` message contains the expected full updated program

Training used response-only supervision so that only assistant tokens contributed to the loss.

The fine-tuning setup from the whitepaper:

- Base model: `Qwen3.5-9B`
- Method: `LoRA`
- LoRA rank: `r=16`
- LoRA scaling: `alpha=32`
- LoRA dropout: `0`
- Sequence length: `8k`
- Optimizer: `AdamW 8-bit`
- Effective batch size: `8`
- Learning rate: `5e-5`
- Warmup steps: `5`
- Weight decay: `0.001`
- Schedule: `linear`
- Epochs: `2`
- Total update steps: `36`
- Hardware: single `A100 40 GB`
- Runtime: under `5 minutes` in Google Colab

The resulting LoRA adapter checkpoint is approximately `300 MB`.

### Export and Local Deployment

After training, the adapter was merged and exported to `GGUF` using Unsloth's GGUF export pipeline. The merged model was quantized to `Q4_K_M`, producing a final artifact of roughly `5 GB`.

This export choice makes the model practical to run locally through tools such as:

- `Ollama`
- `llama.cpp`
- `LM Studio`

In this repository, the local AI workflow is built around `Ollama`.

### Evaluation Results

The whitepaper evaluates the fine-tuned model on a held-out set of `30` unseen prompts.

| Metric | Result |
|--------|--------|
| Compilation rate | `24/30` = `80%` |
| Geometrically correct outputs | `22/30` |
| Overall success rate on test set | about `73%` |
| Untuned base-model compilation rate | `16/30` |

These results show a clear improvement over the untuned base model, especially in compilation reliability and geometric alignment.

### Scope and Limitations

This system is intended for:

- rapid prototyping
- research
- education
- iterative design assistance

It is not intended for:

- manufacturing guarantees
- safety-critical use
- dimensional certification

Automated validation and mesh checks improve robustness, but they do not guarantee that every generated model perfectly matches user intent or real-world engineering constraints.

## ImplicitCAD Studio

### What It Is

ImplicitCAD Studio is the demo application built around the training output above. It provides an end-to-end environment where a user can:

- edit SCAD code
- ask the model to modify or generate code
- compile the result with ImplicitCAD
- inspect the resulting STL in a live 3D viewer

The Studio is important because the model is most useful inside an interactive loop rather than as an isolated artifact.

### Key Features

- Monaco-based code editor with OpenSCAD-style syntax highlighting
- Three.js 3D viewer with orbit controls, camera presets, wireframe, and grid planes
- AI assistant panel with local Ollama support and optional OpenAI / Anthropic backends
- File explorer for local workspace editing
- STL export and viewport screenshots
- Output console, toast errors, and compile diagnostics

### Quick Start

```bash
git clone https://github.com/CSC392-CSC492-Building-AI-ML-systems/ImplicitCAD-Winter2026.git
cd ImplicitCAD-Winter2026
cp .env.example .env
./studio.sh
```

In the TUI:

1. run `First-time setup`
2. run `Start Studio`
3. optionally run `Add 9B (production)` to download the main fine-tuned model

> The first full Docker build can take about `15-20 minutes` because ImplicitCAD is compiled from Haskell source.

### System Requirements

- Docker `20+` with Docker Compose v2
- `4 GB` RAM minimum
- `8 GB+` RAM recommended for local AI inference
- about `10 GB` free disk space for Docker images and model assets
- Node.js `18+` only if you want to run the frontend dev server locally

### TUI Workflow

`./studio.sh` is the single supported user entry point.

| Menu Option | Purpose |
|-------------|---------|
| First-time setup | Verifies Docker, installs or checks Ollama, prepares the environment |
| Start Studio | Starts the Docker services and opens the app |
| Add 0.8B (test) | Downloads a lightweight local test model |
| Add 9B (production) | Downloads the main fine-tuned model |
| View status | Shows service health, Ollama state, and model readiness |
| Advanced tools | Shell access, smoke tests, compile helpers, and logs |
| Stop all services | Stops Docker services and Ollama |
| Full rebuild | Rebuilds all containers from scratch |

### Docker Commands

```bash
docker compose up -d --build
docker compose port frontend 3000
docker compose down
docker compose logs -f
docker compose build --no-cache
```

Use `docker compose port frontend 3000` or `./studio.sh --status` to find the actual frontend URL when running the production Docker setup.

### Development Workflow

For frontend development with hot reload, run the backends in Docker and the frontend with Vite:

```bash
docker compose up -d implicitcad server

cd frontend
npm install --legacy-peer-deps
npm run dev
```

The Vite app starts at `http://localhost:3000` and proxies `/api` requests to the Docker server container.

If you want the production-like setup instead, run:

```bash
./studio.sh
```

and choose `Start Studio`.

### Architecture

```
        browser
           |
   Vite dev server or nginx
           |
         /api/*
           |
      Node.js server
           |
   extopenscad + admesh
           |
      STL -> Three.js viewer
```

| Container | Role | Port |
|-----------|------|------|
| `implicitcad-engine` | Helper container that provides the shared `extopenscad` binary volume and an exec/test target | not published |
| `implicitcad-server` | API server for compile, health, provider management, and AI chat | host `SERVER_HOST_PORT` (default `14000`) -> container `4000` |
| `implicitcad-frontend` | React app served by nginx in production Docker mode | dynamic host port -> container `3000` |

The frontend renders STL output with `Three.js`. The older direct `implicitsnap` render path is no longer part of the active UI pipeline.

### AI Providers

The Studio supports multiple model backends in the chat panel:

| Provider | Use Case |
|----------|----------|
| `Ollama` | Main local workflow, including the fine-tuned 9B model |
| `OpenAI` | Optional cloud comparison / testing |
| `Anthropic` | Optional cloud comparison / testing |

Configure defaults in `.env`, or use the API key dialog inside the app for cloud providers.

### Compile From the Command Line

```bash
./studio.sh compile mymodel.scad -o mymodel.stl
./studio.sh exec server
```

Inside the server container, `"$EXTOPENSCAD"` and `admesh` are available for manual inspection and debugging.

## Repository Structure

```text
frontend/          React + Vite + TypeScript app
server/            Node.js API server and compile / chat orchestration
docker/            Dockerfiles and container entrypoints
ollama/            Ollama Modelfiles for the local app models
ai_context/        ImplicitCAD language reference material used by the server prompt
second-train/      Training data and related model artifacts
test_files/        Reference cases and benchmark assets
studio.sh          Main TUI entry point
.env.example       Runtime configuration template
```

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| Port conflict on `14000` | Change `SERVER_HOST_PORT` in `.env` |
| Frontend URL unknown in Docker mode | Run `docker compose port frontend 3000` |
| Vite proxy errors in local dev | Ensure `docker compose up -d implicitcad server` is running |
| Ollama not reachable on Linux | Set `OLLAMA_HOST=0.0.0.0`, restart Ollama, and point `OLLAMA_URL` at the Docker bridge IP |
| Build runs out of memory | Increase Docker memory to at least `4 GB`, preferably more for local model use |
| Frontend loads but API fails | Check `docker compose logs server` and `./studio.sh --status` |

## Team

CSC398 Group 5

- Ziao Liu
- Ziheng Zhou
- Leon Wang
- Haoping Yang
- Hyeonbin (Owen) Chun

University of Toronto

## License

AGPL-3.0-or-later
