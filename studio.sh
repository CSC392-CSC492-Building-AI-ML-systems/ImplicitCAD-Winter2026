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
  DOCKER_COMPOSE_VER=""
  if command -v docker &>/dev/null; then
    DOCKER_VER=$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)
    DOCKER_VER="${DOCKER_VER//[$'\n\r']/}"  # strip newlines
    if [ -z "$DOCKER_VER" ]; then
      DOCKER_VER="installed (daemon not running)"
    fi
    DOCKER_OK=true
  fi

  # Docker Compose
  COMPOSE=""
  if docker compose version &>/dev/null; then
    COMPOSE="docker compose"
    DOCKER_COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "")
  elif command -v docker-compose &>/dev/null; then
    COMPOSE="docker-compose"
    DOCKER_COMPOSE_VER=$(docker-compose version --short 2>/dev/null || echo "")
  fi

  # Disk space (GB free)
  if [ "$OS" = "Darwin" ]; then
    DISK_FREE_GB=$(df -g / 2>/dev/null | tail -1 | awk '{print $4}' || echo "?")
  else
    DISK_FREE_GB=$(df -BG / 2>/dev/null | tail -1 | awk '{gsub(/G/,""); print $4}' || echo "?")
  fi

  # Ollama — local binary check
  OLLAMA_LOCAL=false
  OLLAMA_VER="not found"
  if command -v ollama &>/dev/null; then
    OLLAMA_VER=$(ollama --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "installed")
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

  # Try each URL in priority order (|| true prevents set -e from exiting on failure)
  if [ -n "${OLLAMA_URL:-}" ]; then
    _try_ollama_url "$OLLAMA_URL" || true
  fi
  if ! $OLLAMA_API_OK; then
    _try_ollama_url "http://localhost:11434" || true
  fi
  if ! $OLLAMA_API_OK; then
    _try_ollama_url "http://host.docker.internal:11434" || true
  fi
  if ! $OLLAMA_API_OK && [ "$OS_NAME" = "WSL2" ]; then
    # WSL: try Windows host IP from /etc/resolv.conf
    local win_ip
    win_ip=$(grep nameserver /etc/resolv.conf 2>/dev/null | head -1 | awk '{print $2}')
    if [ -n "$win_ip" ]; then
      _try_ollama_url "http://${win_ip}:11434" || true
    fi
  fi

  # If no API found but local binary exists, test if CLI still works
  # (WSL case: ollama CLI works via socket but HTTP API is not exposed)
  if ! $OLLAMA_API_OK && $OLLAMA_LOCAL; then
    OLLAMA_OK=true
    if ollama list &>/dev/null; then
      OLLAMA_RUNNING=true  # CLI works = Ollama is functional
    fi
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
  echo -e "  System:   ${W}${OS_NAME} ${ARCH_NAME}${D} | RAM: ${W}${RAM_GB}GB${D} | Disk: ${W}${DISK_FREE_GB}GB free${D}"
  echo -e "  GPU:      ${W}${GPU_INFO}${D}"
  echo -e "  Docker:   ${W}${DOCKER_VER}${D} | Ollama: ${W}${OLLAMA_VER}${D}"
  if $OLLAMA_API_OK && $OLLAMA_LOCAL; then
    echo -e "  Ollama:  ${G}running${D}  ${DIM}(${OLLAMA_URL_IN_USE})${D}"
  elif $OLLAMA_API_OK; then
    echo -e "  Ollama:  ${G}running (remote)${D}  ${DIM}(${OLLAMA_URL_IN_USE})${D}"
  elif $OLLAMA_RUNNING && $OLLAMA_LOCAL; then
    echo -e "  Ollama:  ${G}running (CLI)${D}  ${DIM}(HTTP API not exposed)${D}"
  elif $OLLAMA_LOCAL; then
    echo -e "  Ollama:  ${Y}installed but not running${D}  ${DIM}(run: ollama serve)${D}"
  else
    echo -e "  Ollama:  ${R}✗ not found${D}  ${DIM}(set OLLAMA_URL if running elsewhere)${D}"
  fi
  echo -e "  ${DIM}Models are pulled directly by Ollama — no extra tools needed.${D}"
  echo ""
  # System requirements summary
  echo -e "  ${DIM}─── Requirements ───────────────────────────────────────${D}"
  echo -e "  ${DIM}Docker services use ~200MB RAM + ~2GB disk (images)${D}"
  echo -e "  ${DIM}0.8B test model: ~1GB disk, ~1GB RAM    (any machine)${D}"
  echo -e "  ${DIM}9B  production:  ~6GB disk, ~6GB RAM    (8GB+ total recommended)${D}"
  # Warnings based on actual system
  if [ "$RAM_GB" -lt 4 ] 2>/dev/null; then
    echo -e "  ${R}⚠ ${RAM_GB}GB RAM is below minimum (4GB). Docker + 0.8B model may not fit.${D}"
  elif [ "$RAM_GB" -lt 8 ] 2>/dev/null; then
    echo -e "  ${Y}! ${RAM_GB}GB RAM: 0.8B test model OK, 9B will be tight.${D}"
  fi
  if [ "$DISK_FREE_GB" != "?" ] && [ "$DISK_FREE_GB" -lt 5 ] 2>/dev/null; then
    echo -e "  ${R}⚠ Only ${DISK_FREE_GB}GB disk free. Need at least 5GB for Docker images + models.${D}"
  fi
  echo ""
}

# ── Version Checks ──────────────────────────────────────────────────────────

check_versions() {
  local warnings=0

  # Docker version check (minimum 20.x) — only if we got a numeric version
  if $DOCKER_OK; then
    local docker_major
    docker_major=$(echo "$DOCKER_VER" | cut -d. -f1)
    if [[ "$docker_major" =~ ^[0-9]+$ ]] && [ "$docker_major" -lt 20 ]; then
      warn "Docker $DOCKER_VER is old. Version 20+ recommended."
      warnings=$((warnings + 1))
    fi
  fi

  # Ollama version check (minimum 0.5.x for HuggingFace model support)
  if $OLLAMA_LOCAL && [ "$OLLAMA_VER" != "not found" ] && [ "$OLLAMA_VER" != "remote" ]; then
    local ollama_minor
    ollama_minor=$(echo "$OLLAMA_VER" | cut -d. -f2)
    if [ "$ollama_minor" -lt 5 ] 2>/dev/null; then
      warn "Ollama $OLLAMA_VER is old. Version 0.5+ needed for HuggingFace model support."
      warnings=$((warnings + 1))
    fi
  fi

  return 0
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
            OLLAMA_LOCAL=true
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
          # Install zstd first if missing (needed by newer Ollama installer)
          if ! command -v zstd &>/dev/null; then
            echo -e "  ${DIM}Installing zstd (required by Ollama installer)...${D}"
            if command -v apt-get &>/dev/null; then
              sudo apt-get update -qq && sudo apt-get install -y -qq zstd 2>/dev/null || true
            elif command -v dnf &>/dev/null; then
              sudo dnf install -y zstd 2>/dev/null || true
            fi
          fi
          curl -fsSL https://ollama.com/install.sh | sh
          info "Ollama installed"
          OLLAMA_OK=true
          OLLAMA_LOCAL=true
          # Disable systemd service — we run ollama as current user to avoid permission issues
          if command -v systemctl &>/dev/null && systemctl is-active ollama &>/dev/null; then
            echo -e "  ${DIM}Disabling Ollama system service (will run as current user instead)...${D}"
            sudo systemctl stop ollama 2>/dev/null || true
            sudo systemctl disable ollama 2>/dev/null || true
          fi
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

  # If not installed locally, guide user
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

  # If ollama systemd service is running as a different user, stop it first
  # so we can start ollama as the current user (avoids file permission issues)
  if command -v systemctl &>/dev/null && systemctl is-active ollama &>/dev/null; then
    local service_user
    service_user=$(ps -eo user,comm 2>/dev/null | grep -w "ollama" | grep -v grep | head -1 | awk '{print $1}' || true)
    if [ -n "$service_user" ] && [ "$service_user" != "$(whoami)" ]; then
      echo -e "  ${DIM}Stopping Ollama system service (runs as '${service_user}', need current user)...${D}"
      sudo systemctl stop ollama 2>/dev/null || true
      sleep 1
    fi
  fi

  echo -e "  Starting Ollama as $(whoami)..."
  ollama serve &>/dev/null &
  local ollama_pid=$!
  disown

  # Verify process didn't crash immediately
  sleep 1
  if ! kill -0 "$ollama_pid" 2>/dev/null; then
    # Maybe port is already taken by something else
    if curl -sf "${OLLAMA_URL_IN_USE:-http://localhost:11434}/api/tags" --connect-timeout 2 &>/dev/null; then
      OLLAMA_RUNNING=true
      OLLAMA_API_OK=true
      if [ -z "$OLLAMA_URL_IN_USE" ]; then OLLAMA_URL_IN_USE="http://localhost:11434"; fi
      info "Ollama already running"
      return
    fi
    fail "Ollama process exited immediately. Check 'ollama serve' manually for errors."
    return 1
  fi

  # Wait up to 10 seconds for API
  for i in $(seq 1 10); do
    if curl -sf "${OLLAMA_URL_IN_USE:-http://localhost:11434}/api/tags" --connect-timeout 2 --max-time 3 &>/dev/null; then
      OLLAMA_RUNNING=true
      OLLAMA_API_OK=true
      if [ -z "$OLLAMA_URL_IN_USE" ]; then OLLAMA_URL_IN_USE="http://localhost:11434"; fi
      info "Ollama started as $(whoami)"
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

  # WSL + Windows ollama.exe: convert Modelfile path so Windows can read it
  local actual_modelfile="$modelfile"
  if [ "$OS_NAME" = "WSL2" ] && command -v wslpath &>/dev/null; then
    local ollama_path
    ollama_path=$(command -v ollama 2>/dev/null || true)
    if echo "$ollama_path" | grep -qi "mnt/c\|windows\|\.exe" 2>/dev/null || \
       file "$ollama_path" 2>/dev/null | grep -qi "PE32\|Windows"; then
      actual_modelfile=$(wslpath -w "$(cd "$(dirname "$modelfile")" && pwd)/$(basename "$modelfile")")
      echo -e "  ${DIM}WSL detected: converting path for Windows Ollama${D}"
    fi
  fi

  if $OLLAMA_LOCAL; then
    echo -e "  Creating ${W}${name}${D}..."
    if ! ollama create "$name" -f "$actual_modelfile"; then
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
      --max-time 1800 2>&1) || true
    if [ "$http_code" != "200" ]; then
      fail "Failed to create $name (HTTP $http_code)"
      return 1
    fi
  fi
  info "Created $name"
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
  echo -e "  ${W}Model Status${D}"
  echo -e "  ${DIM}──────────────────────────────────────${D}"

  if ! $OLLAMA_API_OK && ! $OLLAMA_LOCAL; then
    warn "Ollama not available. Cannot check model status."
    echo ""
    return
  fi

  # Get model list — use CLI if local, API if remote
  local models=""
  if $OLLAMA_LOCAL; then
    models=$(ollama list 2>/dev/null || echo "")
  elif $OLLAMA_API_OK; then
    models=$(curl -s "${OLLAMA_URL_IN_USE}/api/tags" 2>/dev/null || echo "")
  fi

  echo ""
  echo -e "  ${C}Installed Models:${D}"
  for name in implicitcad-dev implicitcad-9b; do
    if echo "$models" | grep -q "$name"; then
      echo -e "    ${G}✓${D} $name"
    else
      echo -e "    ${DIM}○${D} $name ${DIM}(not installed)${D}"
    fi
  done
  echo ""

  if $OLLAMA_API_OK && ! $OLLAMA_LOCAL; then
    echo -e "  ${DIM}Connected to: ${OLLAMA_URL_IN_USE}${D}"
    echo ""
  fi
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
  export WORKSPACE_DIR="${WORKSPACE_DIR:-${SCRIPT_DIR}/_workspace}"
  mkdir -p "$WORKSPACE_DIR"

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
    warn "Docker Compose not available"
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

# ── Combined Setup Workflows ─────────────────────────────────────────────────

# First-time setup: install Ollama, verify Docker
setup_first_time() {
  echo ""
  echo -e "  ${W}First-Time Setup${D}"
  echo -e "  ${DIM}Installs Ollama and verifies Docker is available.${D}"
  echo ""

  # Step 1: Install Ollama
  echo -e "  ${C}Step 1/2:${D} Ollama..."
  install_ollama
  ensure_ollama_running || return

  # Step 2: Verify Docker
  echo ""
  echo -e "  ${C}Step 2/2:${D} Docker..."
  if $DOCKER_OK; then
    info "Docker found (${DOCKER_VER})"
  else
    fail "Docker not found. Install from https://docs.docker.com/get-docker/"
    echo -e "    ${DIM}Docker is required to run Studio services.${D}"
    return
  fi
  if [ -n "$COMPOSE" ]; then
    info "Docker Compose found"
  else
    fail "Docker Compose not found."
    return
  fi

  echo ""
  info "Setup complete!"
  echo ""
  echo -e "  ${W}Next steps:${D}"
  echo -e "  1. Download a model — pick ${C}Add 9B${D} (recommended) or ${C}Add 0.8B${D} (test) from the menu"
  echo -e "  2. Start Studio — launches Docker services and opens browser"
}

# Setup 0.8B test model
setup_0_8b() {
  echo ""
  echo -e "  ${W}0.8B Test Model Setup${D}"
  echo -e "  ${DIM}Pulls qwen3.5:0.8b (~1GB) and creates the implicitcad-dev app model.${D}"
  echo ""

  ensure_ollama_running || return

  # Step 1: Pull base model (skip if already pulled)
  echo -e "  ${C}Step 1/2:${D} Pulling base model (qwen3.5:0.8b, ~1GB)..."
  if has_ollama_model "qwen3.5:0.8b"; then
    info "qwen3.5:0.8b already pulled — skipping"
  else
    pull_model "qwen3.5:0.8b" || { fail "Failed to pull base model."; return; }
  fi

  # Step 2: Create app model
  echo ""
  echo -e "  ${C}Step 2/2:${D} Creating app model (implicitcad-dev)..."
  if has_ollama_model "implicitcad-dev"; then
    warn "implicitcad-dev already exists — recreating"
  fi
  create_model "implicitcad-dev" "./ollama/Modelfile.dev"

  echo ""
  info "0.8B test model ready!"
  echo ""
  echo -e "  ${W}How to use it:${D}"
  echo -e "  1. Start Studio from the menu"
  echo -e "  2. In the AI Chat panel, select ${C}implicitcad-dev${D}"
  echo -e "  3. Start chatting — this is a small test model, not fine-tuned"
}

# Setup production 9B model (merged — pulled directly from HuggingFace)
setup_9b() {
  echo ""
  echo -e "  ${W}9B Production Model Setup${D}"
  echo -e "  ${DIM}Downloads the fine-tuned 9B model (~6GB) and creates implicitcad-9b.${D}"
  echo -e "  ${DIM}This may take several minutes on the first download.${D}"
  echo ""

  ensure_ollama_running || return

  # Step 1: Pull merged model from HuggingFace
  echo -e "  ${C}Step 1/2:${D} Pulling model from HuggingFace (~6GB)..."
  echo -e "  ${DIM}Large download — if it times out, it will resume where it left off on retry.${D}"
  if has_ollama_model "hf.co/Max2475/Qwen3.5-9B-OpenSCAD-Instruct"; then
    info "Model already pulled — skipping"
  else
    # Retry up to 3 times — HuggingFace CDN can be slow and Ollama may timeout
    local attempt
    for attempt in 1 2 3; do
      if pull_model "hf.co/Max2475/Qwen3.5-9B-OpenSCAD-Instruct"; then
        break
      fi
      if [ "$attempt" -lt 3 ]; then
        warn "Download interrupted (attempt $attempt/3). Retrying — Ollama resumes partial downloads..."
        sleep 2
      else
        fail "Failed after 3 attempts. Check your internet connection and try again."
        echo -e "    ${DIM}You can also try manually: ${C}ollama pull hf.co/Max2475/Qwen3.5-9B-OpenSCAD-Instruct${D}"
        return
      fi
    done
  fi

  # Step 2: Create app model with system prompt and parameters
  echo ""
  echo -e "  ${C}Step 2/2:${D} Creating app model (implicitcad-9b)..."
  if has_ollama_model "implicitcad-9b"; then
    warn "implicitcad-9b already exists — recreating"
  fi
  create_model "implicitcad-9b" "./ollama/Modelfile.9b"

  echo ""
  info "9B model ready!"
  echo ""
  echo -e "  ${W}How to use it:${D}"
  echo -e "  1. Start Studio from the menu"
  echo -e "  2. In the AI Chat panel, select ${C}implicitcad-9b${D}"
  echo -e "  3. Start chatting — the fine-tuned 9B model generates OpenSCAD code"
}

# ── Non-Interactive Mode ─────────────────────────────────────────────────────

if [ $# -gt 0 ]; then
  detect_system
  case "$1" in
    --install)
      setup_first_time
      ;;
    --start)
      ensure_ollama_running
      start_studio
      ;;
    --setup-0.8b)
      setup_0_8b
      ;;
    --setup-9b)
      setup_9b
      ;;
    --stop)
      stop_all
      ;;
    --status)
      show_service_status
      show_model_status
      ;;
    *)
      echo "Usage: ./studio.sh [--install|--start|--setup-9b|--setup-0.8b|--stop|--status]"
      exit 1
      ;;
  esac
  exit 0
fi

# ── Arrow-Key Menu ──────────────────────────────────────────────────────────

# Static menu structure
MENU_LABELS=(
  "First-time setup"
  "Start Studio"
  "Add 0.8B (test)"
  "Add 9B (production)"
  "View status"
  "Stop all services"
  "Full rebuild"
  "Quit"
)

MENU_SECTIONS=(
  "Setup"
  "Launch"
  "Download Models"
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

  # 0: First-time setup — needs Docker
  if [ -n "$need_docker" ]; then
    MENU_DESCS[0]="Install Ollama, verify Docker is available"
    MENU_TAGS[0]="$need_docker"
    MENU_DISABLED[0]="1"
  else
    MENU_DESCS[0]="Install Ollama, verify Docker is available"
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

  # 2: Add 0.8B — needs Ollama
  if ! $OLLAMA_OK; then
    MENU_DESCS[2]="Tiny test model (~1GB) — verify setup works"
    MENU_TAGS[2]="$need_ollama"
    MENU_DISABLED[2]="1"
  else
    MENU_DESCS[2]="Tiny test model (~1GB) — verify setup works"
    MENU_TAGS[2]=""
    MENU_DISABLED[2]=""
  fi

  # 3: Add 9B — needs Ollama
  if ! $OLLAMA_OK; then
    MENU_DESCS[3]="Fine-tuned OpenSCAD model (~6GB)"
    MENU_TAGS[3]="$need_ollama"
    MENU_DISABLED[3]="1"
  else
    MENU_DESCS[3]="Fine-tuned OpenSCAD model (~6GB)"
    MENU_TAGS[3]="${G}← recommended${D}"
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
    clear
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
    fi
    echo ""
    read -p "  Press Enter to continue..." _
    return
  fi

  # Clear screen before running commands — avoids garbled ANSI positioning
  clear
  echo ""
  case "$sel" in
    0) setup_first_time ;;
    1) ensure_ollama_running; start_studio ;;
    2) setup_0_8b ;;
    3) setup_9b ;;
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
  # Need: interactive terminal with stdin and stdout connected to a tty
  [ -t 0 ] && [ -t 1 ]
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
  check_versions

  # Query actual cursor position after header (avoids hardcoding row count)
  # printf sends the query to stdout (terminal); read captures the response
  _cursor_row=""
  printf '\033[6n'
  IFS=';' read -rs -t 2 -d R _cursor_row _ 2>/dev/null || true
  if [ -n "$_cursor_row" ]; then
    MENU_START_ROW=${_cursor_row#*[}
  else
    MENU_START_ROW=20  # Safe fallback if cursor query fails
  fi

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
