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

# Source .env if present (same vars Docker Compose reads)
[ -f "$SCRIPT_DIR/.env" ] && set -a && . "$SCRIPT_DIR/.env" && set +a

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
  if ! $OLLAMA_API_OK && [ "$OS_NAME" = "Linux" ]; then
    # Linux (non-Desktop Docker): try the Docker bridge interface IP.
    # This is the IP containers use to reach host services — NOT the LAN gateway.
    local bridge_ip=""
    # Method 1: docker0 interface IP (most common)
    bridge_ip=$(ip -4 addr show docker0 2>/dev/null | awk '/inet /{gsub(/\/.*/, "", $2); print $2}' || true)
    # Method 2: Docker bridge network gateway via docker inspect
    if [ -z "$bridge_ip" ] && command -v docker &>/dev/null; then
      bridge_ip=$(docker network inspect bridge -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null || true)
    fi
    if [ -n "$bridge_ip" ]; then
      _try_ollama_url "http://${bridge_ip}:11434" || true
    fi
    if ! $OLLAMA_API_OK && ! $OLLAMA_RUNNING; then
      warn "Ollama not reachable from Docker. On Linux, Ollama must listen on all interfaces:"
      echo -e "    ${C}sudo systemctl edit ollama${D}  then add:"
      echo -e "    ${DIM}[Service]${D}"
      echo -e "    ${DIM}Environment=\"OLLAMA_HOST=0.0.0.0\"${D}"
      echo -e "    Then: ${C}sudo systemctl restart ollama${D}"
      if [ -n "$bridge_ip" ]; then
        echo -e "    And set in .env: ${C}OLLAMA_URL=http://${bridge_ip}:11434${D}"
      fi
    fi
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
  echo -e "  ${DIM}27B advanced:   ~16GB disk, ~32GB RAM   (powerful machine recommended)${D}"
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
  for name in implicitcad-dev implicitcad-9b implicitcad-27b; do
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
  echo -e "  1. Download a model — pick ${C}Add 9B${D} (recommended), ${C}Add 27B${D} (advanced), or ${C}Add 0.8B${D} (test)"
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

# Setup advanced 27B model (merged — pulled directly from HuggingFace)
setup_27b() {
  echo ""
  echo -e "  ${W}27B Advanced Model Setup${D}"
  echo -e "  ${DIM}Downloads the fine-tuned 27B model (~15.4GB) and creates implicitcad-27b.${D}"
  echo -e "  ${DIM}Recommended: 32GB+ RAM. This is a large download and may take a while.${D}"
  echo ""

  ensure_ollama_running || return

  echo -e "  ${C}Step 1/2:${D} Pulling model from HuggingFace (~15.4GB)..."
  echo -e "  ${DIM}Large download — if it times out, it will resume where it left off on retry.${D}"
  if has_ollama_model "hf.co/ziaoliu/Qwen3.5-27B-OpenSCAD-Instruct"; then
    info "Model already pulled — skipping"
  else
    local attempt
    for attempt in 1 2 3; do
      if pull_model "hf.co/ziaoliu/Qwen3.5-27B-OpenSCAD-Instruct"; then
        break
      fi
      if [ "$attempt" -lt 3 ]; then
        warn "Download interrupted (attempt $attempt/3). Retrying — Ollama resumes partial downloads..."
        sleep 2
      else
        fail "Failed after 3 attempts. Check your internet connection and try again."
        echo -e "    ${DIM}You can also try manually: ${C}ollama pull hf.co/ziaoliu/Qwen3.5-27B-OpenSCAD-Instruct${D}"
        return
      fi
    done
  fi

  echo ""
  echo -e "  ${C}Step 2/2:${D} Creating app model (implicitcad-27b)..."
  if has_ollama_model "implicitcad-27b"; then
    warn "implicitcad-27b already exists — recreating"
  fi
  create_model "implicitcad-27b" "./ollama/Modelfile.27b"

  echo ""
  info "27B model ready!"
  echo ""
  echo -e "  ${W}How to use it:${D}"
  echo -e "  1. Start Studio from the menu"
  echo -e "  2. In the AI Chat panel, select ${C}implicitcad-27b${D}"
  echo -e "  3. Start chatting — this is the largest local fine-tuned model"
}

# ── Advanced Tool Functions ─────────────────────────────────────────────────

require_service_running() {
  local service="${1:-}"
  case "$service" in
    engine) service="implicitcad" ;;
  esac

  if ! $COMPOSE ps --status running 2>/dev/null | grep -Eq "(^|[[:space:]])${service}([[:space:]]|$)"; then
    fail "${service} is not running. Start Studio first."
    return 1
  fi
}

do_exec() {
  local service="${1:-}"

  case "$service" in
    engine) service="implicitcad" ;;
    server|implicitcad|frontend|"") ;;
    *)
      warn "Unknown service: $service"
      return 1
      ;;
  esac

  if [ -z "$service" ]; then
    echo "Select container to enter:"
    echo -e "  ${W}1)${D} server      — admesh, extopenscad, node (${C}recommended${D})"
    echo -e "  ${W}2)${D} engine      — extopenscad helper container"
    echo -e "  ${W}3)${D} frontend    — nginx config and logs"
    read -rp "  Choice [1]: " choice
    case "${choice:-1}" in
      1|server)     service="server" ;;
      2|engine)     service="implicitcad" ;;
      3|frontend)   service="frontend" ;;
      *) warn "Invalid choice"; return ;;
    esac
  fi

  require_service_running "$service" || return 1

  local shell="/bin/bash"
  local workdir="/"
  case "$service" in
    server)
      workdir="/workspace"
      echo -e "  ${G}Entering server container${D}"
      echo -e "  ${DIM}Tools: \$EXTOPENSCAD, admesh, node${D}"
      echo -e "  ${DIM}Files: /workspace${D}"
      ;;
    implicitcad)
      workdir="/app"
      echo -e "  ${G}Entering ImplicitCAD engine container${D}"
      echo -e "  ${DIM}Tools: extopenscad${D}"
      echo -e "  ${DIM}Purpose: shared binary volume + compile helper${D}"
      ;;
    frontend)
      shell="/bin/sh"
      echo -e "  ${G}Entering frontend container${D}"
      echo -e "  ${DIM}Config: /etc/nginx/conf.d/${D}"
      echo -e "  ${DIM}Logs:   /var/log/nginx/${D}"
      ;;
  esac
  echo -e "  ${DIM}Type 'exit' to return.${D}"
  echo ""

  $COMPOSE exec -w "$workdir" "$service" "$shell"
}

do_logs() {
  local service="${1:-}"
  case "$service" in
    engine) service="implicitcad" ;;
  esac
  echo -e "  ${DIM}Following logs (Ctrl+C to stop)...${D}"
  if [ -n "$service" ]; then
    $COMPOSE logs -f "$service"
  else
    $COMPOSE logs -f
  fi
}

do_test() {
  local pass=0
  local fail_count=0

  require_service_running implicitcad || return 1

  echo ""
  echo -e "  ${W}ImplicitCAD Smoke Tests${D}"
  echo -e "  ${DIM}══════════════════════════════════════${D}"
  echo ""

  _test_compile() {
    local name="$1"
    local code="$2"
    local start_time=$(date +%s%N 2>/dev/null || date +%s)

    printf "  Testing: %-30s " "$name"
    set +e
    echo "$code" | $COMPOSE exec -T implicitcad sh -c 'cat > /tmp/test.scad && extopenscad -r 2 --fopenscad-compat /tmp/test.scad -o /tmp/test.stl 2>&1' >/dev/null 2>&1
    local exit_code=$?
    set -e

    local end_time=$(date +%s%N 2>/dev/null || date +%s)
    local elapsed="?"
    if [ "${#start_time}" -gt 10 ]; then
      elapsed=$(( (end_time - start_time) / 1000000 ))ms
    fi

    if [ $exit_code -eq 0 ]; then
      local size=$($COMPOSE exec -T implicitcad stat -c%s /tmp/test.stl 2>/dev/null || echo "0")
      if [ "$size" -gt 0 ] 2>/dev/null; then
        echo -e "${G}PASS${D} (${elapsed}, ${size} bytes)"
        pass=$((pass + 1))
      else
        echo -e "${R}FAIL${D} (empty STL)"
        fail_count=$((fail_count + 1))
      fi
    else
      echo -e "${R}FAIL${D} (exit code $exit_code)"
      fail_count=$((fail_count + 1))
    fi
  }

  _test_compile "Simple cube" "cube([10, 10, 10]);"
  _test_compile "Sphere" "sphere(r = 15);"
  _test_compile "Cylinder with rotation" 'union() { cube([10,10,20], center=true); rotate([90,0,0]) cylinder(h=30, r=5, center=true); }'
  _test_compile "Boolean difference" 'difference() { cube([20,20,20], center=true); sphere(r=13); }'
  _test_compile "Parametric" 'w=30; h=20; difference() { cube([w,w,h], center=true); cylinder(r=w/4, h=h+1, center=true); }'

  echo ""
  echo -e "  Results: ${G}$pass passed${D}, ${R}$fail_count failed${D}"

  if [ $fail_count -gt 0 ]; then return 1; fi
}

do_compile() {
  local input=""
  local output=""

  while [ $# -gt 0 ]; do
    case "$1" in
      -o)
        if [ -z "${2:-}" ]; then
          fail "Missing value for -o"
          return 1
        fi
        output="$2"
        shift 2
        ;;
      -h|--help)
        echo "Usage: ./studio.sh compile <file.scad> [-o output.stl]"
        echo "       echo 'cube(10);' | ./studio.sh compile - [-o output.stl]"
        return 0
        ;;
      *)
        if [ -z "$input" ]; then
          input="$1"
          shift
        else
          fail "Unexpected argument: $1"
          return 1
        fi
        ;;
    esac
  done

  if [ -z "$input" ]; then
    echo "Usage: ./studio.sh compile <file.scad> [-o output.stl]"
    echo "       echo 'cube(10);' | ./studio.sh compile -"
    return 1
  fi

  if [ "$input" != "-" ] && [ ! -f "$input" ]; then
    fail "Input file not found: $input"
    return 1
  fi

  require_service_running implicitcad || return 1

  if [ "$input" = "-" ]; then
    # Read from stdin
    local tmpfile
    tmpfile=$(mktemp "${TMPDIR:-/tmp}/icad_XXXXXX.scad")
    cat > "$tmpfile"
    docker cp "$tmpfile" "implicitcad-engine:/tmp/stdin.scad"
    $COMPOSE exec -T implicitcad extopenscad -r 2 --fopenscad-compat /tmp/stdin.scad -o /tmp/output.stl
    output="${output:-./output.stl}"
    docker cp "implicitcad-engine:/tmp/output.stl" "$output"
    info "Output: $output"
    rm -f "$tmpfile"
  else
    [ -z "$output" ] && output="${input%.scad}.stl"
    docker cp "$input" "implicitcad-engine:/tmp/input.scad"
    $COMPOSE exec -T implicitcad extopenscad -r 2 --fopenscad-compat /tmp/input.scad -o /tmp/output.stl
    docker cp "implicitcad-engine:/tmp/output.stl" "$output"
    info "Output: $output"
  fi
}

do_status() {
  show_service_status

  echo -e "  ${W}Health Checks${D}"
  echo -e "  ${DIM}──────────────────────────────────────${D}"
  echo ""

  # Server health
  local server_port
  server_port=$($COMPOSE port server 4000 2>/dev/null | awk -F: '{print $NF}' || echo "")
  if [ -n "$server_port" ]; then
    if curl -sf "http://localhost:${server_port}/api/health" >/dev/null 2>&1; then
      info "Server API: healthy (port $server_port)"
    else
      fail "Server API: not responding (port $server_port)"
    fi
  else
    fail "Server API: not running"
  fi

  # Frontend
  local frontend_port
  frontend_port=$($COMPOSE port frontend 3000 2>/dev/null | awk -F: '{print $NF}' || echo "")
  if [ -n "$frontend_port" ]; then
    if curl -sf "http://localhost:${frontend_port}" >/dev/null 2>&1; then
      info "Frontend: reachable (port $frontend_port)"
    else
      fail "Frontend: not responding (port $frontend_port)"
    fi
  else
    fail "Frontend: not running"
  fi

  # Engine
  if $COMPOSE ps --status running implicitcad 2>/dev/null | grep -q implicitcad; then
    if $COMPOSE exec -T implicitcad extopenscad --help >/dev/null 2>&1; then
      info "ImplicitCAD engine: ready (extopenscad available)"
    else
      fail "ImplicitCAD engine: container running but extopenscad unavailable"
    fi
  else
    fail "ImplicitCAD engine: not running"
  fi

  echo ""
}

advanced_tools_menu() {
  local choice
  while true; do
    echo ""
    echo -e "  ${W}Advanced Tools${D}"
    echo -e "  ${DIM}──────────────────────────────────────${D}"
    echo ""
    echo -e "  ${W} 1)${D} ${B}Shell into server${D}     admesh, extopenscad, node, /workspace"
    echo -e "  ${W} 2)${D} ${B}Shell into engine${D}     extopenscad helper container"
    echo -e "  ${W} 3)${D} ${B}Tail service logs${D}     Follow Docker Compose logs"
    echo -e "  ${W} 4)${D} ${B}Run smoke tests${D}      5 compilation tests with timing"
    echo -e "  ${W} 5)${D} ${B}Compile .scad file${D}   Compile a file via Docker"
    echo -e "  ${W} q)${D} Back to main menu"
    echo ""
    read -rp "  Select [1-5, q]: " choice

    echo ""
    case "$choice" in
      1) do_exec server ;;
      2) do_exec implicitcad ;;
      3) do_logs ;;
      4) do_test ;;
      5)
        local file
        read -rp "  Path to .scad file: " file
        if [ -n "$file" ]; then
          do_compile "$file"
        else
          warn "No file specified"
        fi
        ;;
      q|Q) return ;;
      *) warn "Invalid option" ;;
    esac

    echo ""
    read -rp "  Press Enter to continue..." _
  done
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
    --setup-27b)
      setup_27b
      ;;
    --stop)
      stop_all
      ;;
    --status)
      do_status
      show_model_status
      ;;
    --test|test)
      do_test
      ;;
    compile)
      shift
      do_compile "$@"
      ;;
    run)
      shift
      input="$1"
      if [ -z "$input" ]; then echo "Usage: ./studio.sh run <file.scad>"; exit 1; fi
      require_service_running implicitcad || exit 1
      docker cp "$input" "implicitcad-engine:/tmp/input.scad"
      $COMPOSE exec -T implicitcad extopenscad -r 2 --fopenscad-compat /tmp/input.scad -o /tmp/output.stl
      info "Compiled successfully."
      $COMPOSE exec -T implicitcad ls -la /tmp/output.stl
      ;;
    exec)
      shift
      do_exec "$@"
      ;;
    logs)
      shift
      do_logs "$@"
      ;;
    *)
      echo "Usage: ./studio.sh [--install|--start|--setup-9b|--setup-27b|--setup-0.8b|--stop|--status]"
      echo "       ./studio.sh test                     Run smoke tests"
      echo "       ./studio.sh compile <file.scad>      Compile a .scad file to STL"
      echo "       ./studio.sh run <file.scad>          Compile and show info"
      echo "       ./studio.sh exec [service]           Shell into a container"
      echo "       ./studio.sh logs [service]           Tail Docker Compose logs"
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
  "Add 27B (advanced)"
  "View status"
  "Advanced tools"
  "Stop all services"
  "Full rebuild"
  "Quit"
)

MENU_SECTIONS=(
  "Setup"
  "Launch"
  "Download Models"
  ""
  ""
  "Manage"
  ""
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

  # 4: Add 27B — needs Ollama
  if ! $OLLAMA_OK; then
    MENU_DESCS[4]="Largest fine-tuned model (~15.4GB, 32GB+ RAM)"
    MENU_TAGS[4]="$need_ollama"
    MENU_DISABLED[4]="1"
  else
    MENU_DESCS[4]="Largest fine-tuned model (~15.4GB, 32GB+ RAM)"
    MENU_TAGS[4]="${Y}advanced${D}"
    MENU_DISABLED[4]=""
  fi

  # 5: View status — always available
  MENU_DESCS[5]="Show Docker services, Ollama, and installed models"
  MENU_TAGS[5]=""
  MENU_DISABLED[5]=""

  # 6: Advanced tools — needs Docker
  if [ -n "$need_docker" ]; then
    MENU_DESCS[6]="Shell into containers, run tests, compile files"
    MENU_TAGS[6]="$need_docker"
    MENU_DISABLED[6]="1"
  else
    MENU_DESCS[6]="Shell into containers, run tests, compile files"
    MENU_TAGS[6]=""
    MENU_DISABLED[6]=""
  fi

  # 7: Stop all — always available
  MENU_DESCS[7]="Shut down Docker services and Ollama"
  MENU_TAGS[7]=""
  MENU_DISABLED[7]=""

  # 8: Full rebuild — needs Docker
  if [ -n "$need_docker" ]; then
    MENU_DESCS[8]="Rebuild all containers from scratch (slow)"
    MENU_TAGS[8]="$need_docker"
    MENU_DISABLED[8]="1"
  else
    MENU_DESCS[8]="Rebuild all containers from scratch (slow)"
    MENU_TAGS[8]=""
    MENU_DISABLED[8]=""
  fi

  # 9: Quit — always available
  MENU_DESCS[9]=""
  MENU_TAGS[9]=""
  MENU_DISABLED[9]=""
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
    4) setup_27b ;;
    5) show_service_status; show_model_status ;;
    6) advanced_tools_menu ;;
    7) stop_all ;;
    8) full_rebuild ;;
    9) echo -e "  ${DIM}Goodbye.${D}"; echo ""; exit 0 ;;
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
