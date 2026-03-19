#!/bin/sh
echo "Starting ImplicitCAD services..."
echo "  extopenscad: $(extopenscad --help 2>&1 | head -1)"

# Start implicitsnap (jsTHREE render server) on port 8080
echo "  implicitsnap listening on :8080"
exec implicitsnap
