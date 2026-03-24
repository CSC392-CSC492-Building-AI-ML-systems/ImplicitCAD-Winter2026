#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
# ImplicitCAD Studio — TUI Launcher
# Manages Docker services, Ollama, and local model assets
# ─────────────────────────────────────────────────────────────────────────────

G='\033[0;32m'
Y='\033[1;33m'
R='\033[0;31m'
C='\033[0;36m'
W='\033[1;37m'
M='\033[0;35m'
D='\033[0m'
DIM='\033[2m'

info()  { echo -e "  ${G}✓${D} $1"; }
warn()  { echo -e "  ${Y}!${D} $1"; }
fail()  { echo -e "  ${R}✗${D} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── System Detection ─────────────────────────────────────────────────────────

detect_system() {
  OS=$(uname -s)
  ARCH=$(uname -m)
  case "$OS" in
    Darwin) OS_NAME="macOS" ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        OS_NAME="WSL2"
      else
        OS_NAME="Linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*) OS_NAME="Windows" ;;
    *) OS_NAME="$OS" ;;
  esac

  case "$ARCH" in
    x86_64)        ARCH_NAME="amd64" ;;
    aarch64|arm64) ARCH_NAME="arm64" ;;
    *)             ARCH_NAME="$ARCH" ;;
  esac

  # RAM
  if [ "$OS" = "Darwin" ]; then
    RAM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
  else
    RAM_GB=$(( $(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0) / 1048576 ))
  fi

  # GPU
  GPU_INFO="none"
  if [ "$OS" = "Darwin" ] && [ "$ARCH" = "arm64" ]; then
    CHIP=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple Silicon")
    GPU_INFO="$CHIP (Metal)"
  elif command -v nvidia-smi &>/dev/null; then
    GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo "NVIDIA")
  fi

  # Docker
  DOCKER_OK=false
  DOCKER_VER="not found"
  if command -v docker &>/dev/null; then
    DOCKER_VER=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    DOCKER_OK=true
  fi

  # Docker Compose
  if docker compose version &>/dev/null; then
    COMPOSE="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE="docker-compose"
  else
    COMPOSE=""
  fi

  # Ollama
  OLLAMA_OK=false
  OLLAMA_VER="not found"
  if command -v ollama &>/dev/null; then
    OLLAMA_VER=$(ollama --version 2>/dev/null | awk '{print $NF}' || echo "installed")
    OLLAMA_OK=true
  fi

  # Ollama running?
  OLLAMA_RUNNING=false
  if curl -s http://localhost:11434/api/tags &>/dev/null; then
    OLLAMA_RUNNING=true
  fi
}

# ── Display Header ───────────────────────────────────────────────────────────

show_header() {
  clear
  echo ""
  echo -e "${C}╔══════════════════════════════════════════════════════╗${D}"
  echo -e "${C}║${W}        ImplicitCAD Studio                            ${C}║${D}"
  echo -e "${C}╚══════════════════════════════════════════════════════╝${D}"
  echo ""
  echo -e "  System:  ${W}${OS_NAME} ${ARCH_NAME}${D} | RAM: ${W}${RAM_GB}GB${D} | GPU: ${W}${GPU_INFO}${D}"
  echo -e "  Docker:  ${W}${DOCKER_VER}${D} | Ollama: ${W}${OLLAMA_VER}${D}"
  if $OLLAMA_RUNNING; then
    echo -e "  Ollama:  ${G}running${D}"
  elif $OLLAMA_OK; then
    echo -e "  Ollama:  ${Y}installed but not running${D}"
  else
    echo -e "  Ollama:  ${R}not installed${D}"
  fi
  echo ""
}

# ── Ollama Install ───────────────────────────────────────────────────────────

install_ollama() {
  if $OLLAMA_OK; then
    info "Ollama already installed (${OLLAMA_VER})"
    return
  fi

  echo ""
  echo -e "  ${W}Ollama Installation${D}"
  echo ""

  case "$OS_NAME" in
    macOS)
      echo -e "  Recommended: ${C}brew install ollama${D}"
      echo -e "  Alternative: Download from ${C}https://ollama.com/download${D}"
      echo ""
      read -p "  Install via brew? [Y/n] " yn
      case "$yn" in
        [Nn]*) echo "  Please install Ollama manually and re-run."; return ;;
        *)
          if command -v brew &>/dev/null; then
            brew install ollama
            info "Ollama installed"
            OLLAMA_OK=true
          else
            fail "Homebrew not found. Install Ollama from https://ollama.com/download"
          fi
          ;;
      esac
      ;;
    Linux|WSL2)
      echo -e "  Running: ${C}curl -fsSL https://ollama.com/install.sh | sh${D}"
      echo ""
      read -p "  Proceed? [Y/n] " yn
      case "$yn" in
        [Nn]*) echo "  Please install Ollama manually and re-run."; return ;;
        *)
          curl -fsSL https://ollama.com/install.sh | sh
          info "Ollama installed"
          OLLAMA_OK=true
          ;;
      esac
      ;;
    *)
      echo -e "  Please install Ollama from: ${C}https://ollama.com/download${D}"
      ;;
  esac
}

# ── Ollama Serve ─────────────────────────────────────────────────────────────

ensure_ollama_running() {
  if $OLLAMA_RUNNING; then return; fi
  if ! $OLLAMA_OK; then
    fail "Ollama not installed. Use option 2 to install."
    return 1
  fi

  echo -e "  Starting Ollama..."
  ollama serve &>/dev/null &
  disown

  # Wait up to 10 seconds
  for i in $(seq 1 10); do
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
      OLLAMA_RUNNING=true
      info "Ollama started"
      return
    fi
    sleep 1
  done
  fail "Could not start Ollama. Try running 'ollama serve' manually."
  return 1
}

# ── Model Operations ─────────────────────────────────────────────────────────

pull_model() {
  local model="$1"
  ensure_ollama_running || return
  echo -e "  Pulling ${W}${model}${D}..."
  ollama pull "$model"
  info "Pulled $model"
}

create_model() {
  local name="$1"
  local modelfile="$2"
  ensure_ollama_running || return

  if [ ! -f "$modelfile" ]; then
    fail "Modelfile not found: $modelfile"
    return
  fi

  echo -e "  Creating ${W}${name}${D} from ${modelfile}..."
  ollama create "$name" -f "$modelfile"
  info "Created $name"
}

download_adapter() {
  local name="$1"
  local repo="$2"
  local dir="$3"

  if ! command -v huggingface-cli &>/dev/null; then
    fail "huggingface-cli not found. Install: pip install huggingface-hub"
    return
  fi

  echo -e "  Downloading ${W}${name}${D} adapter..."
  huggingface-cli download "$repo" --local-dir "$dir"
  info "Downloaded $name adapter to $dir"
}

# ── Model Status ─────────────────────────────────────────────────────────────

show_model_status() {
  echo ""
  echo -e "  ${W}Local Model Status${D}"
  echo -e "  ${DIM}──────────────────────────────────────${D}"

  if ! $OLLAMA_RUNNING; then
    warn "Ollama not running. Status may be incomplete."
    echo ""
    return
  fi

  local models
  models=$(ollama list 2>/dev/null || echo "")

  echo ""
  echo -e "  ${C}Base Models:${D}"
  for tag in qwen3.5:0.8b qwen3.5:9b qwen3.5:27b; do
    if echo "$models" | grep -q "$tag"; then
      echo -e "    ${G}✓${D} $tag"
    else
      echo -e "    ${DIM}○${D} $tag ${DIM}(not pulled)${D}"
    fi
  done

  echo ""
  echo -e "  ${C}App Models:${D}"
  for name in implicitcad-dev implicitcad-9b implicitcad-27b; do
    if echo "$models" | grep -q "$name"; then
      echo -e "    ${G}✓${D} $name"
    else
      echo -e "    ${DIM}○${D} $name ${DIM}(not created)${D}"
    fi
  done

  echo ""
  echo -e "  ${C}Adapter Assets:${D}"
  if [ -d "./ollama/adapters/9b" ] && [ "$(ls -A ./ollama/adapters/9b 2>/dev/null)" ]; then
    echo -e "    ${G}✓${D} 9B adapter (./ollama/adapters/9b)"
  else
    echo -e "    ${DIM}○${D} 9B adapter ${DIM}(not downloaded)${D}"
  fi
  if [ -d "./ollama/adapters/27b" ] && [ "$(ls -A ./ollama/adapters/27b 2>/dev/null)" ]; then
    echo -e "    ${G}✓${D} 27B adapter (./ollama/adapters/27b)"
  else
    echo -e "    ${DIM}○${D} 27B adapter ${DIM}(not downloaded)${D}"
  fi
  echo ""
}

# ── Docker Operations ────────────────────────────────────────────────────────

start_studio() {
  if ! $DOCKER_OK; then
    fail "Docker not found. Install from https://docs.docker.com/get-docker/"
    return
  fi
  if [ -z "$COMPOSE" ]; then
    fail "docker compose not found."
    return
  fi

  # Create workspace
  mkdir -p "${WORKSPACE_DIR:-./_workspace}"

  echo -e "  Starting ImplicitCAD Studio..."
  $COMPOSE up -d --build

  local frontend_port
  frontend_port=$($COMPOSE port frontend 3000 2>/dev/null | awk -F: '{print $NF}' || echo "")
  echo ""
  info "Studio is running"
  if [ -n "$frontend_port" ]; then
    echo -e "  Open: ${C}http://localhost:${frontend_port}${D}"
    # Auto-open browser
    if command -v open &>/dev/null; then
      open "http://localhost:${frontend_port}"
    elif command -v xdg-open &>/dev/null; then
      xdg-open "http://localhost:${frontend_port}"
    fi
  fi
  echo ""
}

show_service_status() {
  echo ""
  echo -e "  ${W}Service Status${D}"
  echo -e "  ${DIM}──────────────────────────────────────${D}"
  echo ""

  if [ -n "$COMPOSE" ]; then
    $COMPOSE ps 2>/dev/null || echo "  No services running."
  else
    warn "docker compose not available"
  fi

  echo ""
  if $OLLAMA_RUNNING; then
    info "Ollama: running at http://localhost:11434"
  else
    warn "Ollama: not running"
  fi
  echo ""
}

stop_all() {
  echo -e "  Stopping services..."
  if [ -n "$COMPOSE" ]; then
    $COMPOSE down 2>/dev/null || true
  fi
  info "Docker services stopped"

  # Stop Ollama if we started it
  if pgrep -x ollama &>/dev/null; then
    pkill -x ollama 2>/dev/null || true
    info "Ollama stopped"
  fi
  echo ""
}

full_rebuild() {
  echo -e "  Rebuilding all containers (this may take a while)..."
  if [ -n "$COMPOSE" ]; then
    $COMPOSE build --no-cache
    $COMPOSE up -d
    info "Rebuild complete"
  else
    fail "docker compose not available"
  fi
  echo ""
}

# ── 27B Resource Check ───────────────────────────────────────────────────────

check_27b_resources() {
  if [ "$RAM_GB" -lt 16 ] 2>/dev/null; then
    echo ""
    fail "27B requires 16GB+ RAM. Your system has ${RAM_GB}GB."
    echo -e "  ${Y}Use 9B instead (option 4 in main menu, or option 9 to create).${D}"
    echo ""
    return 1
  elif [ "$RAM_GB" -lt 32 ] 2>/dev/null; then
    echo ""
    warn "27B may be slow on ${RAM_GB}GB RAM. 9B is recommended."
    read -p "  Continue anyway? [y/N] " yn
    case "$yn" in
      [Yy]*) return 0 ;;
      *) return 1 ;;
    esac
  fi
  return 0
}

# ── Non-Interactive Mode ─────────────────────────────────────────────────────

if [ $# -gt 0 ]; then
  detect_system
  case "$1" in
    --install)
      install_ollama
      ensure_ollama_running
      pull_model "qwen3.5:0.8b"
      create_model "implicitcad-dev" "./ollama/Modelfile.dev"
      start_studio
      ;;
    --start)
      start_studio
      ;;
    --start-ai-dev)
      ensure_ollama_running
      start_studio
      ;;
    --start-ai-9b)
      ensure_ollama_running
      start_studio
      ;;
    --stop)
      stop_all
      ;;
    --status)
      show_service_status
      show_model_status
      ;;
    *)
      echo "Usage: ./studio.sh [--install|--start|--start-ai-dev|--stop|--status]"
      exit 1
      ;;
  esac
  exit 0
fi

# ── Interactive Menu ─────────────────────────────────────────────────────────

while true; do
  detect_system
  show_header

  echo -e "  ${W} 1)${D}  Start Studio"
  echo -e "  ${W} 2)${D}  Install / verify Ollama"
  echo -e "  ${W} 3)${D}  Pull qwen3.5:0.8b ${DIM}(test model)${D}"
  echo -e "  ${W} 4)${D}  Pull qwen3.5:9b ${DIM}(production base)${D}"
  echo -e "  ${W} 5)${D}  Pull qwen3.5:27b ${DIM}(16GB+ RAM required)${D}"
  echo -e "  ${W} 6)${D}  Download 9B LoRA adapter"
  echo -e "  ${W} 7)${D}  Download 27B LoRA adapter"
  echo -e "  ${W} 8)${D}  Create implicitcad-dev"
  echo -e "  ${W} 9)${D}  Create implicitcad-9b ${G}← recommended${D}"
  echo -e "  ${W}10)${D}  Create implicitcad-27b"
  echo -e "  ${W}11)${D}  Local model status"
  echo -e "  ${W}12)${D}  Service status"
  echo -e "  ${W}13)${D}  Stop all services"
  echo -e "  ${W}14)${D}  Full rebuild"
  echo -e "  ${W} q)${D}  Quit"
  echo ""
  read -p "  Select [1-14, q]: " choice

  echo ""
  case "$choice" in
    1)  start_studio ;;
    2)  install_ollama ;;
    3)  pull_model "qwen3.5:0.8b" ;;
    4)  pull_model "qwen3.5:9b" ;;
    5)
      check_27b_resources && pull_model "qwen3.5:27b"
      ;;
    6)
      download_adapter "9B" "Max2475/qwen3.5-9b-openscad-lora" "./ollama/adapters/9b"
      ;;
    7)
      download_adapter "27B" "Max2475/qwen3.5-27b-openscad-instruct-lora" "./ollama/adapters/27b"
      ;;
    8)  create_model "implicitcad-dev" "./ollama/Modelfile.dev" ;;
    9)  create_model "implicitcad-9b" "./ollama/Modelfile.9b" ;;
    10)
      check_27b_resources && create_model "implicitcad-27b" "./ollama/Modelfile.27b"
      ;;
    11) show_model_status ;;
    12) show_service_status ;;
    13) stop_all ;;
    14) full_rebuild ;;
    q|Q) echo -e "  ${DIM}Goodbye.${D}"; echo ""; exit 0 ;;
    *)  warn "Invalid option: $choice" ;;
  esac

  echo ""
  read -p "  Press Enter to continue..." _
done
