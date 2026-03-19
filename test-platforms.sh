#!/bin/bash
# Smoke test: compile sample .scad files and verify valid STL output
set -e

CONTAINER="implicitcad-engine"
PASS=0
FAIL=0

G='\033[0;32m'
R='\033[0;31m'
D='\033[0m'

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: Container $CONTAINER not running. Start with: docker compose up -d"
  exit 1
fi

test_compile() {
  local name="$1"
  local code="$2"
  local start=$(date +%s%N)

  echo -n "  Testing: $name ... "
  echo "$code" | docker exec -i "$CONTAINER" sh -c 'cat > /tmp/test.scad && extopenscad -r 2 --fopenscad-compat /tmp/test.scad -o /tmp/test.stl 2>&1'
  local exit_code=$?

  local end=$(date +%s%N)
  local elapsed=$(( (end - start) / 1000000 ))

  if [ $exit_code -eq 0 ]; then
    local size=$(docker exec "$CONTAINER" stat -c%s /tmp/test.stl 2>/dev/null || echo "0")
    if [ "$size" -gt 0 ] 2>/dev/null; then
      echo -e "${G}PASS${D} (${elapsed}ms, ${size} bytes)"
      PASS=$((PASS + 1))
    else
      echo -e "${R}FAIL${D} (empty STL)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo -e "${R}FAIL${D} (exit code $exit_code)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "ImplicitCAD Smoke Tests"
echo "═══════════════════════"
echo ""

test_compile "Simple cube" "cube([10, 10, 10]);"
test_compile "Sphere" "sphere(r = 15);"
test_compile "Cylinder with rotation" 'union() { cube([10,10,20], center=true); rotate([90,0,0]) cylinder(h=30, r=5, center=true); }'
test_compile "Boolean difference" 'difference() { cube([20,20,20], center=true); sphere(r=13); }'
test_compile "Parametric" 'w=30; h=20; difference() { cube([w,w,h], center=true); cylinder(r=w/4, h=h+1, center=true); }'

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ $FAIL -gt 0 ]; then exit 1; fi
