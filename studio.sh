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
B='\033[1m'

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

  # Ollama — local binary check
  OLLAMA_LOCAL=false
  OLLAMA_VER="not found"
  if command -v ollama &>/dev/null; then
    OLLAMA_VER=$(ollama --version 2>/dev/null | awk '{print $NF}' || echo "installed")
    OLLAMA_LOCAL=true
  fi

  # Ollama API — auto-discover reachable URL
  # Priority: OLLAMA_URL env > localhost > host.docker.internal > WSL Windows host IP
  OLLAMA_URL_IN_USE=""
  OLLAMA_API_OK=false
  OLLAMA_RUNNING=false
  OLLAMA_OK=false

  _try_ollama_url() {
    local url="$1"
    if curl -sf "${url}/api/tags" --connect-timeout 2 &>/dev/null; then
      OLLAMA_URL_IN_USE="$url"
      OLLAMA_API_OK=true
      OLLAMA_RUNNING=true
      OLLAMA_OK=true
      if ! $OLLAMA_LOCAL; then
        OLLAMA_VER="remote"
      fi
      return 0
    fi
    return 1
  }

  # Try each URL in priority order
  if [ -n "${OLLAMA_URL:-}" ]; then
    _try_ollama_url "$OLLAMA_URL"
  fi
  if ! $OLLAMA_API_OK; then
    _try_ollama_url "http://localhost:11434"
  fi
  if ! $OLLAMA_API_OK; then
    _try_ollama_url "http://host.docker.internal:11434"
  fi
  if ! $OLLAMA_API_OK && [ "$OS_NAME" = "WSL2" ]; then
    # WSL: try Windows host IP from /etc/resolv.conf
    local win_ip
    win_ip=$(grep nameserver /etc/resolv.conf 2>/dev/null | head -1 | awk '{print $2}')
    if [ -n "$win_ip" ]; then
      _try_ollama_url "http://${win_ip}:11434"
    fi
  fi

  # If no API found but local binary exists, Ollama is installed but not running
  if ! $OLLAMA_API_OK && $OLLAMA_LOCAL; then
    OLLAMA_OK=true
  fi

  # HuggingFace CLI (needed for 9B/27B adapter downloads)
  HF_CLI_OK=false
  if command -v huggingface-cli &>/dev/null || command -v hf &>/dev/null; then
    HF_CLI_OK=true
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
  if $OLLAMA_API_OK && $OLLAMA_LOCAL; then
    echo -e "  Ollama:  ${G}running${D}  ${DIM}(${OLLAMA_URL_IN_USE})${D}"
  elif $OLLAMA_API_OK; then
    echo -e "  Ollama:  ${G}running (remote)${D}  ${DIM}(${OLLAMA_URL_IN_USE})${D}"
  elif $OLLAMA_LOCAL; then
    echo -e "  Ollama:  ${Y}installed but not running${D}  ${DIM}(run: ollama serve)${D}"
  else
    echo -e "  Ollama:  ${R}✗ not found${D}  ${DIM}(set OLLAMA_URL if running elsewhere)${D}"
  fi
  if $HF_CLI_OK; then
    echo -e "  HuggingFace CLI:  ${G}installed${D}"
  else
    echo -e "  HuggingFace CLI:  ${R}✗ not found${D}  ${DIM}— run: ${C}pip install huggingface-hub${D}"
  fi
  echo -e "  ${DIM}The fine-tuned 9B/27B models use LoRA adapters hosted on HuggingFace.${D}"
  echo -e "  ${DIM}The CLI is required to download them. Not needed for the 0.8B test model.${D}"
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
    fail "Ollama not installed. Use option 1 to set up."
    return 1
  fi

  # If not installed locally (e.g., WSL without local ollama), guide user
  if ! $OLLAMA_LOCAL; then
    fail "Ollama is not running and not installed locally."
    if [ "$OS_NAME" = "WSL2" ]; then
      echo -e "    ${W}Option A:${D} Start the Ollama app on Windows, then re-run this script."
      echo -e "    ${W}Option B:${D} Install Ollama in WSL: ${C}curl -fsSL https://ollama.com/install.sh | sh${D}"
      echo -e "               ${DIM}(May need: sudo apt-get install zstd first)${D}"
    else
      echo -e "    Install: ${C}curl -fsSL https://ollama.com/install.sh | sh${D}"
    fi
    return 1
  fi

  echo -e "  Starting Ollama..."
  ollama serve &>/dev/null &
  disown

  # Wait up to 10 seconds
  for i in $(seq 1 10); do
    if curl -s "${OLLAMA_URL_IN_USE:-http://localhost:11434}/api/tags" &>/dev/null; then
      OLLAMA_RUNNING=true
      OLLAMA_API_OK=true
      if [ -z "$OLLAMA_URL_IN_USE" ]; then OLLAMA_URL_IN_USE="http://localhost:11434"; fi
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
  ensure_ollama_running || return 1

  if $OLLAMA_LOCAL; then
    # Local binary available — use CLI
    echo -e "  Pulling ${W}${model}${D}..."
    if ! ollama pull "$model"; then
      fail "Failed to pull $model"
      return 1
    fi
  else
    # Remote Ollama (e.g., Windows host) — use HTTP API
    echo -e "  Pulling ${W}${model}${D} via API..."
    echo -e "  ${DIM}This may take a while for large models. Progress shown below.${D}"
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST ${OLLAMA_URL_IN_USE}/api/pull \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"${model}\", \"stream\": false}" \
      --max-time 600 2>&1) || true
    if [ "$http_code" != "200" ]; then
      fail "Failed to pull $model (HTTP $http_code)"
      return 1
    fi
  fi
  info "Pulled $model"
}

create_model() {
  local name="$1"
  local modelfile="$2"
  ensure_ollama_running || return 1

  if [ ! -f "$modelfile" ]; then
    fail "Modelfile not found: $modelfile"
    return 1
  fi

  if $OLLAMA_LOCAL; then
    # Local binary available — use CLI
    echo -e "  Creating ${W}${name}${D} from ${modelfile}..."
    if ! ollama create "$name" -f "$modelfile"; then
      fail "Failed to create $name"
      return 1
    fi
  else
    # Remote Ollama — use HTTP API with Modelfile content
    echo -e "  Creating ${W}${name}${D} via API..."
    local content
    content=$(cat "$modelfile")
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST ${OLLAMA_URL_IN_USE}/api/create \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"${name}\", \"modelfile\": $(printf '%s' "$content" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'), \"stream\": false}" \
      --max-time 300 2>&1) || true
    if [ "$http_code" != "200" ]; then
      fail "Failed to create $name (HTTP $http_code)"
      echo -e "    ${DIM}Note: ADAPTER paths in the Modelfile must be accessible from the Ollama host.${D}"
      return 1
    fi
  fi
  info "Created $name"
}

download_adapter() {
  local name="$1"
  local repo="$2"
  local dir="$3"

  if ! command -v huggingface-cli &>/dev/null; then
    fail "huggingface-cli not found. Install: pip install huggingface-hub"
    return 1
  fi

  mkdir -p "$dir"
  echo -e "  Downloading ${W}${name}${D} adapter..."
  if ! huggingface-cli download "$repo" --local-dir "$dir"; then
    fail "Failed to download $name adapter"
    return 1
  fi
  info "Downloaded $name adapter to $dir"
}

# Check if adapter directory has safetensors file
has_adapter() {
  local dir="$1"
  [ -f "$dir/adapter_model.safetensors" ]
}

# Check if Ollama has a specific model (works for both local and remote)
has_ollama_model() {
  local model="$1"
  if $OLLAMA_LOCAL; then
    ollama list 2>/dev/null | grep -q "$model"
  else
    # Use API for remote Ollama (e.g., Windows host)
    curl -s "${OLLAMA_URL_IN_USE}/api/tags" 2>/dev/null | grep -q "\"$model"
  fi
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
    info "Ollama: running at ${OLLAMA_URL_IN_USE:-http://localhost:11434}"
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
    echo -e "  ${Y}Use 9B instead.${D}"
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

# ── Combined Setup Workflows ─────────────────────────────────────────────────

# Full first-time setup: install Ollama, pull test model, create app model, start
setup_quickstart() {
  echo ""
  echo -e "  ${W}Quick Start Setup${D}"
  echo -e "  ${DIM}Installs Ollama, pulls test model (0.8B), creates app model, starts Studio.${D}"
  echo ""

  install_ollama
  ensure_ollama_running || return

  # Step 1: Pull base model (skip if already pulled)
  echo ""
  echo -e "  ${C}Step 1/3:${D} Base model (qwen3.5:0.8b, ~1GB)..."
  if has_ollama_model "qwen3.5:0.8b"; then
    info "qwen3.5:0.8b already pulled — skipping"
  else
    pull_model "qwen3.5:0.8b" || { fail "Failed to pull base model. Aborting."; return; }
  fi

  # Step 2: Create app model
  echo ""
  echo -e "  ${C}Step 2/3:${D} Creating app model (implicitcad-dev)..."
  if has_ollama_model "implicitcad-dev"; then
    warn "implicitcad-dev already exists — recreating"
  fi
  create_model "implicitcad-dev" "./ollama/Modelfile.dev"

  # Step 3: Start Studio
  echo ""
  echo -e "  ${C}Step 3/3:${D} Starting Studio..."
  start_studio
}

# Setup production 9B model: pull base + download adapter + create model
setup_9b() {
  echo ""
  echo -e "  ${W}9B Production Model Setup${D}"
  echo -e "  ${DIM}Pulls qwen3.5:9b, downloads the LoRA adapter from HuggingFace,${D}"
  echo -e "  ${DIM}and creates the implicitcad-9b app model.${D}"
  echo ""

  # Pre-flight: check huggingface-cli before starting the long download
  if ! command -v huggingface-cli &>/dev/null; then
    fail "huggingface-cli is required for downloading LoRA adapters."
    echo -e "    Install: ${C}pip install huggingface-hub${D}"
    return
  fi

  ensure_ollama_running || return

  # Step 1: Pull base model (skip if already pulled)
  echo -e "  ${C}Step 1/3:${D} Base model (qwen3.5:9b, ~6GB)..."
  if has_ollama_model "qwen3.5:9b"; then
    info "qwen3.5:9b already pulled — skipping"
  else
    pull_model "qwen3.5:9b" || { fail "Failed to pull base model. Aborting."; return; }
  fi

  # Step 2: Download LoRA adapter (skip if already present)
  echo ""
  echo -e "  ${C}Step 2/3:${D} LoRA adapter from HuggingFace..."
  if has_adapter "./ollama/adapters/9b"; then
    info "9B adapter already downloaded — skipping"
  else
    download_adapter "9B" "Max2475/qwen3.5-9b-openscad-lora" "./ollama/adapters/9b" || { fail "Adapter download failed. Aborting."; return; }
  fi

  # Step 3: Create app model
  echo ""
  echo -e "  ${C}Step 3/3:${D} Creating app model (implicitcad-9b)..."
  if has_ollama_model "implicitcad-9b"; then
    warn "implicitcad-9b already exists — recreating with latest adapter"
  fi
  create_model "implicitcad-9b" "./ollama/Modelfile.9b"

  echo ""
  info "9B model ready!"
  echo ""
  echo -e "  ${W}How to use it:${D}"
  echo -e "  1. Open Studio in your browser"
  echo -e "  2. In the AI Chat panel, click the ${W}model dropdown${D} (top of chat)"
  echo -e "  3. Select ${C}implicitcad-9b${D}"
  echo -e "  4. Start chatting — the 9B model will be used for code generation"
}

# Setup 27B model: pull base + download adapter + create model
setup_27b() {
  check_27b_resources || return

  echo ""
  echo -e "  ${W}27B Advanced Model Setup${D}"
  echo -e "  ${DIM}Pulls qwen3.5:27b, downloads the LoRA adapter from HuggingFace,${D}"
  echo -e "  ${DIM}and creates the implicitcad-27b app model. Requires 16GB+ RAM.${D}"
  echo ""

  # Pre-flight: check huggingface-cli
  if ! command -v huggingface-cli &>/dev/null; then
    fail "huggingface-cli is required for downloading LoRA adapters."
    echo -e "    Install: ${C}pip install huggingface-hub${D}"
    return
  fi

  ensure_ollama_running || return

  # Step 1: Pull base model (skip if already pulled)
  echo -e "  ${C}Step 1/3:${D} Base model (qwen3.5:27b, ~17GB)..."
  if has_ollama_model "qwen3.5:27b"; then
    info "qwen3.5:27b already pulled — skipping"
  else
    pull_model "qwen3.5:27b" || { fail "Failed to pull base model. Aborting."; return; }
  fi

  # Step 2: Download LoRA adapter (skip if already present)
  echo ""
  echo -e "  ${C}Step 2/3:${D} LoRA adapter from HuggingFace..."
  if has_adapter "./ollama/adapters/27b"; then
    info "27B adapter already downloaded — skipping"
  else
    download_adapter "27B" "Max2475/qwen3.5-27b-openscad-instruct-lora" "./ollama/adapters/27b" || { fail "Adapter download failed. Aborting."; return; }
  fi

  # Step 3: Create app model
  echo ""
  echo -e "  ${C}Step 3/3:${D} Creating app model (implicitcad-27b)..."
  if has_ollama_model "implicitcad-27b"; then
    warn "implicitcad-27b already exists — recreating with latest adapter"
  fi
  create_model "implicitcad-27b" "./ollama/Modelfile.27b"

  echo ""
  info "27B model ready!"
  echo ""
  echo -e "  ${W}How to use it:${D}"
  echo -e "  1. Open Studio in your browser"
  echo -e "  2. In the AI Chat panel, click the ${W}model dropdown${D} (top of chat)"
  echo -e "  3. Select ${C}implicitcad-27b${D}"
  echo -e "  4. Start chatting — the 27B model will be used for code generation"
}

# ── Non-Interactive Mode ─────────────────────────────────────────────────────

if [ $# -gt 0 ]; then
  detect_system
  case "$1" in
    --install)
      setup_quickstart
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

# ── Arrow-Key Menu ──────────────────────────────────────────────────────────

# Static menu structure
MENU_LABELS=(
  "First-time install"
  "Start Studio"
  "Add 9B model"
  "Add 27B model"
  "View status"
  "Stop all services"
  "Full rebuild"
  "Quit"
)

MENU_SECTIONS=(
  "Install"
  "Launch"
  "Upgrade AI Model"
  ""
  "Manage"
  ""
  ""
  ""
)

MENU_COUNT=${#MENU_LABELS[@]}

# Dynamic arrays — rebuilt each loop after detect_system
MENU_DESCS=()
MENU_TAGS=()
MENU_DISABLED=()   # "1" = disabled, "" = enabled

build_menu_state() {
  # Prerequisite checks
  local need_docker=""
  local need_ollama=""

  if ! $DOCKER_OK; then need_docker="${R}✗ Install Docker first${D}"; fi
  if ! $OLLAMA_OK; then need_ollama="${R}✗ Install Ollama first${D}"; fi

  local ram_warn=""
  if [ "$RAM_GB" -lt 16 ] 2>/dev/null; then
    ram_warn="${R}✗ Needs 16GB+ RAM (you have ${RAM_GB}GB)${D}"
  fi

  # 0: First-time install — needs Docker
  if [ -n "$need_docker" ]; then
    MENU_DESCS[0]="Set up Ollama, download 0.8B test model, and launch Studio"
    MENU_TAGS[0]="$need_docker"
    MENU_DISABLED[0]="1"
  else
    MENU_DESCS[0]="Set up Ollama, download 0.8B test model, and launch Studio"
    MENU_TAGS[0]=""
    MENU_DISABLED[0]=""
  fi

  # 1: Start Studio — needs Docker
  if [ -n "$need_docker" ]; then
    MENU_DESCS[1]="Launch Docker services, start Ollama, and open browser"
    MENU_TAGS[1]="$need_docker"
    MENU_DISABLED[1]="1"
  else
    MENU_DESCS[1]="Launch Docker services, start Ollama, and open browser"
    MENU_TAGS[1]=""
    MENU_DISABLED[1]=""
  fi

  # 2: Add 9B — needs Ollama + HF CLI
  if ! $OLLAMA_OK; then
    MENU_DESCS[2]="Download fine-tuned 9B model — switch to it in AI Chat settings"
    MENU_TAGS[2]="$need_ollama"
    MENU_DISABLED[2]="1"
  elif ! $HF_CLI_OK; then
    MENU_DESCS[2]="Download fine-tuned 9B model — switch to it in AI Chat settings"
    MENU_TAGS[2]="${R}✗ pip install huggingface-hub${D}"
    MENU_DISABLED[2]="1"
  else
    MENU_DESCS[2]="Download fine-tuned 9B model — switch to it in AI Chat settings"
    MENU_TAGS[2]="${G}← recommended${D}"
    MENU_DISABLED[2]=""
  fi

  # 3: Add 27B — needs Ollama + HF CLI + 16GB RAM
  if ! $OLLAMA_OK; then
    MENU_DESCS[3]="Download fine-tuned 27B model — best quality, needs 16GB+ RAM"
    MENU_TAGS[3]="$need_ollama"
    MENU_DISABLED[3]="1"
  elif ! $HF_CLI_OK; then
    MENU_DESCS[3]="Download fine-tuned 27B model — best quality, needs 16GB+ RAM"
    MENU_TAGS[3]="${R}✗ pip install huggingface-hub${D}"
    MENU_DISABLED[3]="1"
  elif [ -n "$ram_warn" ]; then
    MENU_DESCS[3]="Download fine-tuned 27B model — best quality"
    MENU_TAGS[3]="$ram_warn"
    MENU_DISABLED[3]="1"
  else
    MENU_DESCS[3]="Download fine-tuned 27B model — best quality, needs 16GB+ RAM"
    MENU_TAGS[3]=""
    MENU_DISABLED[3]=""
  fi

  # 4: View status — always available
  MENU_DESCS[4]="Show Docker services, Ollama, and installed models"
  MENU_TAGS[4]=""
  MENU_DISABLED[4]=""

  # 5: Stop all — always available
  MENU_DESCS[5]="Shut down Docker services and Ollama"
  MENU_TAGS[5]=""
  MENU_DISABLED[5]=""

  # 6: Full rebuild — needs Docker
  if [ -n "$need_docker" ]; then
    MENU_DESCS[6]="Rebuild all containers from scratch (slow)"
    MENU_TAGS[6]="$need_docker"
    MENU_DISABLED[6]="1"
  else
    MENU_DESCS[6]="Rebuild all containers from scratch (slow)"
    MENU_TAGS[6]=""
    MENU_DISABLED[6]=""
  fi

  # 7: Quit — always available
  MENU_DESCS[7]=""
  MENU_TAGS[7]=""
  MENU_DISABLED[7]=""
}

# Row offsets (static — computed once)
ITEM_ROW=()

compute_item_rows() {
  local row=0
  local i
  for (( i=0; i<MENU_COUNT; i++ )); do
    if [ -n "${MENU_SECTIONS[$i]}" ]; then
      if [ "$i" -gt 0 ]; then row=$(( row + 1 )); fi
      row=$(( row + 1 ))
    fi
    ITEM_ROW[$i]=$row
    row=$(( row + 1 ))
  done
  MENU_TOTAL_LINES=$(( row + 2 ))
}

compute_item_rows

# Render one menu item at its absolute screen row
render_item() {
  local i=$1
  local sel=$2
  local row=${ITEM_ROW[$i]}
  local label="${MENU_LABELS[$i]}"
  local desc="${MENU_DESCS[$i]}"
  local tag="${MENU_TAGS[$i]}"
  local disabled="${MENU_DISABLED[$i]}"

  printf "\033[%d;1H" $(( MENU_START_ROW + row ))
  printf "\033[2K"

  if [ -n "$disabled" ]; then
    # Disabled item — dim label, show requirement tag
    if [ "$i" -eq "$sel" ]; then
      printf "  ${DIM}▸ %-18s %s${D} %b" "$label" "$desc" "$tag"
    else
      printf "    ${DIM}%-18s %s${D} %b" "$label" "$desc" "$tag"
    fi
  elif [ "$i" -eq "$sel" ]; then
    # Selected + enabled
    printf "  ${C}▸${D} ${W}${B}%-18s${D} %s %b" "$label" "$desc" "$tag"
  else
    # Normal
    printf "    ${DIM}%-18s %s${D} %b" "$label" "$desc" "$tag"
  fi
}

# Full menu draw (once per outer loop)
draw_menu_full() {
  local sel=$1
  local i
  for (( i=0; i<MENU_COUNT; i++ )); do
    if [ -n "${MENU_SECTIONS[$i]}" ]; then
      if [ "$i" -gt 0 ]; then echo ""; fi
      echo -e "  ${DIM}─── ${MENU_SECTIONS[$i]} ──────────────────────────────────${D}"
    fi

    local label="${MENU_LABELS[$i]}"
    local desc="${MENU_DESCS[$i]}"
    local tag="${MENU_TAGS[$i]}"
    local disabled="${MENU_DISABLED[$i]}"

    if [ -n "$disabled" ]; then
      if [ "$i" -eq "$sel" ]; then
        printf "  ${DIM}▸ %-18s %s${D} %b\n" "$label" "$desc" "$tag"
      else
        printf "    ${DIM}%-18s %s${D} %b\n" "$label" "$desc" "$tag"
      fi
    elif [ "$i" -eq "$sel" ]; then
      printf "  ${C}▸${D} ${W}${B}%-18s${D} %s %b\n" "$label" "$desc" "$tag"
    else
      printf "    ${DIM}%-18s %s${D} %b\n" "$label" "$desc" "$tag"
    fi
  done
  echo ""
  echo -e "  ${DIM}↑↓ Navigate  ⏎ Select  q Quit${D}"
}

run_selection() {
  local sel=$1

  # Block disabled items
  if [ -n "${MENU_DISABLED[$sel]}" ]; then
    printf "\033[%d;1H" "$MENU_END_ROW"
    echo ""
    local label="${MENU_LABELS[$sel]}"
    if ! $DOCKER_OK && ! $OLLAMA_OK; then
      fail "${label} requires Docker and Ollama."
      echo -e "    Docker:  ${C}https://docs.docker.com/get-docker/${D}"
      echo -e "    Ollama:  ${C}https://ollama.com/download${D} or ${C}brew install ollama${D}"
    elif ! $DOCKER_OK; then
      fail "${label} requires Docker."
      echo -e "    Install: ${C}https://docs.docker.com/get-docker/${D}"
    elif ! $OLLAMA_OK; then
      fail "${label} requires Ollama."
      echo -e "    Install: ${C}brew install ollama${D} or ${C}https://ollama.com/download${D}"
    elif ! $HF_CLI_OK && ( [ "$sel" -eq 2 ] || [ "$sel" -eq 3 ] ); then
      fail "${label} requires HuggingFace CLI to download LoRA adapters."
      echo -e "    Install: ${C}pip install huggingface-hub${D}"
    elif [ "$sel" -eq 3 ] && [ "$RAM_GB" -lt 16 ] 2>/dev/null; then
      fail "27B model requires 16GB+ RAM. Your system has ${RAM_GB}GB."
      echo -e "    ${Y}Use the 9B model instead.${D}"
    fi
    echo ""
    read -p "  Press Enter to continue..." _
    return
  fi

  printf "\033[%d;1H" "$MENU_END_ROW"
  echo ""
  case "$sel" in
    0) setup_quickstart ;;
    1) ensure_ollama_running; start_studio ;;
    2) setup_9b ;;
    3) setup_27b ;;
    4) show_service_status; show_model_status ;;
    5) stop_all ;;
    6) full_rebuild ;;
    7) echo -e "  ${DIM}Goodbye.${D}"; echo ""; exit 0 ;;
  esac
  echo ""
  read -p "  Press Enter to continue..." _
}

# ── Fallback Menu (number input, no arrow keys) ─────────────────────────────

fallback_menu() {
  while true; do
    detect_system
    build_menu_state
    show_header

    local i
    for (( i=0; i<MENU_COUNT; i++ )); do
      if [ -n "${MENU_SECTIONS[$i]}" ]; then
        if [ "$i" -gt 0 ]; then echo ""; fi
        echo -e "  ${DIM}─── ${MENU_SECTIONS[$i]} ──────────────────────────────────${D}"
      fi
      local label="${MENU_LABELS[$i]}"
      local desc="${MENU_DESCS[$i]}"
      local tag="${MENU_TAGS[$i]}"
      local disabled="${MENU_DISABLED[$i]}"
      local num=$(( i + 1 ))
      if [ "$i" -eq $(( MENU_COUNT - 1 )) ]; then num="q"; fi

      if [ -n "$disabled" ]; then
        printf "  ${DIM}%2s) %-18s %s${D} %b\n" "$num" "$label" "$desc" "$tag"
      else
        printf "  ${W}%2s)${D} ${B}%-18s${D} %s %b\n" "$num" "$label" "$desc" "$tag"
      fi
    done
    echo ""
    read -p "  Select [1-$((MENU_COUNT-1)), q]: " choice

    echo ""
    case "$choice" in
      [1-9])
        idx=$(( choice - 1 ))
        if [ "$idx" -lt "$MENU_COUNT" ]; then
          SELECTED=$idx
          run_selection "$SELECTED"
        fi
        ;;
      q|Q) echo -e "  ${DIM}Goodbye.${D}"; echo ""; exit 0 ;;
      *) warn "Invalid option: $choice" ;;
    esac

    echo ""
    read -p "  Press Enter to continue..." _
  done
}

# ── Detect if terminal supports arrow-key menu ──────────────────────────────

use_arrow_menu() {
  # Need: interactive terminal + bash read -s support
  [ -t 0 ] && [ -t 1 ] && printf "\033[6n" >/dev/null 2>&1
}

# ── Interactive Menu Loop ────────────────────────────────────────────────────

if ! use_arrow_menu; then
  fallback_menu
  exit 0
fi

SELECTED=0

while true; do
  detect_system
  build_menu_state

  show_header

  MENU_START_ROW=13

  draw_menu_full "$SELECTED"

  MENU_END_ROW=$(( MENU_START_ROW + MENU_TOTAL_LINES ))

  printf "\033[?25l"
  trap 'printf "\033[?25h"' EXIT INT TERM

  while true; do
    IFS= read -rsn1 key

    if [ "$key" = $'\x1b' ]; then
      IFS= read -rsn1 bracket
      IFS= read -rsn1 arrow

      PREV=$SELECTED
      case "$arrow" in
        A) SELECTED=$(( (SELECTED - 1 + MENU_COUNT) % MENU_COUNT )) ;;
        B) SELECTED=$(( (SELECTED + 1) % MENU_COUNT )) ;;
      esac

      if [ "$PREV" -ne "$SELECTED" ]; then
        render_item "$PREV" "$SELECTED"
        render_item "$SELECTED" "$SELECTED"
        printf "\033[%d;1H" "$MENU_END_ROW"
      fi
      continue
    fi

    # Enter
    if [ "$key" = "" ]; then
      printf "\033[?25h"
      run_selection "$SELECTED"
      break
    fi

    # q to quit
    if [ "$key" = "q" ] || [ "$key" = "Q" ]; then
      printf "\033[?25h"
      printf "\033[%d;1H" "$MENU_END_ROW"
      echo -e "\n  ${DIM}Goodbye.${D}\n"
      exit 0
    fi

    # Number keys
    if [[ "$key" =~ ^[1-9]$ ]]; then
      idx=$(( key - 1 ))
      if [ "$idx" -lt "$MENU_COUNT" ]; then
        SELECTED=$idx
        printf "\033[?25h"
        run_selection "$SELECTED"
        break
      fi
    fi
  done
done
