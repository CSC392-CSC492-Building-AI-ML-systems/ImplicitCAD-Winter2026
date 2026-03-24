#!/bin/bash
# ImplicitCAD Studio — Start Services
# This script delegates to studio.sh. Run ./studio.sh directly for the TUI menu.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/studio.sh" ] && [ $# -eq 0 ]; then
  exec "$SCRIPT_DIR/studio.sh" --start
fi

# Fallback / passthrough for custom flags (e.g., ./up.sh -d --build)
set -e
docker compose up "$@"

echo ""
echo "┌──────────────────────────────────────────────┐"
echo "│  Published ports                              │"
echo "├──────────────────────────────────────────────┤"

FRONTEND=$(docker compose port frontend 3000 2>/dev/null || echo "unavailable")
SERVER=$(docker compose port server 4000 2>/dev/null || echo "unavailable")
ENGINE=$(docker compose port implicitcad 8080 2>/dev/null || echo "unavailable")

printf "│  Frontend:     %-29s│\n" "$FRONTEND"
printf "│  Server API:   %-29s│\n" "$SERVER"
printf "│  ImplicitCAD:  %-29s│\n" "$ENGINE"
echo "└──────────────────────────────────────────────┘"

if [ "$FRONTEND" != "unavailable" ]; then
  echo ""
  echo "  Open: http://localhost:$(echo "$FRONTEND" | awk -F: '{print $NF}')"
fi
