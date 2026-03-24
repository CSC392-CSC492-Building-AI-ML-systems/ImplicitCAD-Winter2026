#!/bin/bash
# ImplicitCAD Studio — One-Click Install
# This script delegates to studio.sh for the full interactive experience.
# Run ./studio.sh directly for the TUI menu.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/studio.sh" ]; then
  exec "$SCRIPT_DIR/studio.sh" --install
fi

# Fallback: original install logic below
set -e

# ─────────────────────────────────────────────────────────────────────────────
# ImplicitCAD Studio — One-Click Install (legacy fallback)
# ─────────────────────────────────────────────────────────────────────────────

G='\033[0;32m'
Y='\033[1;33m'
R='\033[0;31m'
C='\033[0;36m'
W='\033[1;37m'
D='\033[0m'

info()  { echo -e "${G}[OK]${D}    $1"; }
warn()  { echo -e "${Y}[WARN]${D}  $1"; }
fail()  { echo -e "${R}[FAIL]${D}  $1"; }
fatal() { echo -e "${R}[ERROR]${D} $1"; exit 1; }

echo ""
echo -e "${C}╔══════════════════════════════════════════════════════╗${D}"
echo -e "${C}║${W}        ImplicitCAD Studio — Setup                    ${C}║${D}"
echo -e "${C}╚══════════════════════════════════════════════════════╝${D}"
echo ""

# ── 1. System Detection ─────────────────────────────────────────────────────

OS=$(uname -s)
ARCH=$(uname -m)
IS_WSL=false
if grep -qi microsoft /proc/version 2>/dev/null; then IS_WSL=true; fi

case "$OS" in
  Darwin) OS_NAME="macOS" ;;
  Linux)  OS_NAME="Linux"; if $IS_WSL; then OS_NAME="WSL2 (Windows)"; fi ;;
  *)      OS_NAME="$OS" ;;
esac

case "$ARCH" in
  x86_64)  ARCH_NAME="amd64" ;;
  aarch64|arm64) ARCH_NAME="arm64" ;;
  *)       ARCH_NAME="$ARCH" ;;
esac

echo -e "  System:       ${W}${OS_NAME}${D}"
echo -e "  Architecture: ${W}${ARCH_NAME}${D}"

# ── 2. Docker Check ──────────────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  fatal "Docker not found. Install from https://docs.docker.com/get-docker/"
fi

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
echo -e "  Docker:       ${W}${DOCKER_VERSION}${D}"

if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  fatal "docker compose not found. Install from https://docs.docker.com/compose/install/"
fi
echo -e "  Compose:      ${W}$($COMPOSE version --short 2>/dev/null || echo "$COMPOSE")${D}"

# ── 3. Resource Checks ──────────────────────────────────────────────────────

# Disk space (need ~4GB for Haskell build)
if command -v df &>/dev/null; then
  AVAIL_GB=$(df -BG . 2>/dev/null | awk 'NR==2{print $4}' | tr -d 'G' || echo "0")
  if [ -z "$AVAIL_GB" ] || [ "$AVAIL_GB" = "0" ]; then
    AVAIL_GB=$(df -g . 2>/dev/null | awk 'NR==2{print $4}' || echo "?")
  fi
  echo -e "  Disk free:    ${W}${AVAIL_GB}GB${D}"
  if [ "$AVAIL_GB" != "?" ] && [ "$AVAIL_GB" -lt 4 ] 2>/dev/null; then
    warn "Less than 4GB free. Haskell build may fail."
  fi
fi

# RAM
if [ "$OS" = "Darwin" ]; then
  RAM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
else
  RAM_GB=$(( $(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0) / 1048576 ))
fi
echo -e "  RAM:          ${W}${RAM_GB}GB${D}"
if [ "$RAM_GB" -lt 4 ] 2>/dev/null; then
  warn "Less than 4GB RAM. Build may be slow or fail."
fi

# ── 4. Port Checks ──────────────────────────────────────────────────────────

for PORT in 4000 8080; do
  if lsof -i:$PORT &>/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
    warn "Port $PORT already in use"
  fi
done

echo ""

# ── 5. Create workspace ─────────────────────────────────────────────────────

WORKSPACE_DIR="${WORKSPACE_DIR:-./_workspace}"
mkdir -p "$WORKSPACE_DIR"

if [ ! -f "$WORKSPACE_DIR/hello.scad" ]; then
  cat > "$WORKSPACE_DIR/hello.scad" << 'SCAD'
// Welcome to ImplicitCAD Studio!
// This is your first .scad file. Press Cmd+Enter to render.

difference() {
    cube([20, 20, 20], center = true);
    sphere(r = 13);
}
SCAD
  info "Created sample file: $WORKSPACE_DIR/hello.scad"
fi

# ── 6. Build & Start ────────────────────────────────────────────────────────

echo -e "${C}Building ImplicitCAD Studio...${D}"
echo -e "  ${Y}First build takes 15-20 minutes (compiling Haskell from source)${D}"
echo -e "  ${Y}Subsequent starts take seconds.${D}"
echo ""

$COMPOSE build

echo ""
info "Build complete. Starting services..."
$COMPOSE up -d

FRONTEND_BINDING=$($COMPOSE port frontend 3000 2>/dev/null | awk 'NR==1{print $0}')
SERVER_BINDING=$($COMPOSE port server 4000 2>/dev/null | awk 'NR==1{print $0}')
IMPLICITCAD_BINDING=$($COMPOSE port implicitcad 8080 2>/dev/null | awk 'NR==1{print $0}')
FRONTEND_PORT=$(printf '%s\n' "$FRONTEND_BINDING" | awk -F: 'NF{print $NF}')

if [ -n "$FRONTEND_PORT" ]; then
  FRONTEND_URL="http://localhost:$FRONTEND_PORT"
else
  FRONTEND_URL="http://localhost:<dynamic-port>"
fi

echo ""
info "Published ports:"
echo -e "  Frontend:    ${W}${FRONTEND_BINDING:-unavailable}${D}"
echo -e "  Server API:  ${W}${SERVER_BINDING:-unavailable}${D}"
echo -e "  ImplicitCAD: ${W}${IMPLICITCAD_BINDING:-unavailable}${D}"

echo ""
echo -e "${G}╔══════════════════════════════════════════════════════╗${D}"
echo -e "${G}║${W}              Ready!                                  ${G}║${D}"
echo -e "${G}╠══════════════════════════════════════════════════════╣${D}"
echo -e "${G}║                                                      ║${D}"
echo -e "${G}║  ${C}Open:  ${FRONTEND_URL}${G}                    ║${D}"
echo -e "${G}║                                                      ║${D}"
echo -e "${G}║  ${D}Frontend:    ${FRONTEND_URL} (React + nginx)${G}   ║${D}"
echo -e "${G}║  ${D}Server API:  http://localhost:4000 (Node.js)${G}         ║${D}"
echo -e "${G}║  ${D}ImplicitCAD: http://localhost:8080 (implicitsnap)${G}    ║${D}"
echo -e "${G}║  ${D}Workspace:   $WORKSPACE_DIR${G}                        ║${D}"
echo -e "${G}║                                                      ║${D}"
echo -e "${G}║  ${D}Commands:${G}                                           ║${D}"
echo -e "${G}║    ${D}Stop:    $COMPOSE down${G}                            ║${D}"
echo -e "${G}║    ${D}Logs:    $COMPOSE logs -f${G}                         ║${D}"
echo -e "${G}║    ${D}Rebuild: $COMPOSE build --no-cache${G}                ║${D}"
echo -e "${G}║                                                      ║${D}"
echo -e "${G}║  ${D}Run ImplicitCAD directly:${G}                           ║${D}"
echo -e "${G}║    ${D}docker exec implicitcad-engine extopenscad -o out.stl in.scad${G}║${D}"
echo -e "${G}║                                                      ║${D}"
echo -e "${G}║  ${Y}Press Ctrl+C to detach (services keep running)${G}     ║${D}"
echo -e "${G}╚══════════════════════════════════════════════════════╝${D}"
echo ""

# ── 7. Wait for backend and open browser ─────────────────────────────────────

info "Waiting for services..."
for i in $(seq 1 30); do
  if [ -n "$FRONTEND_PORT" ] && curl -s "$FRONTEND_URL" >/dev/null 2>&1; then
    info "All services ready!"
    break
  fi
  sleep 2
done

if [ -n "$FRONTEND_PORT" ] && command -v open &>/dev/null; then
  open "$FRONTEND_URL"
elif [ -n "$FRONTEND_PORT" ] && command -v xdg-open &>/dev/null; then
  xdg-open "$FRONTEND_URL"
elif [ -n "$FRONTEND_PORT" ] && $IS_WSL && command -v cmd.exe &>/dev/null; then
  cmd.exe /c start "$FRONTEND_URL"
fi
