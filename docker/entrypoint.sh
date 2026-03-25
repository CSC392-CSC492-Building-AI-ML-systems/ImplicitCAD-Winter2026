#!/bin/sh
set -e

mkdir -p /opt/implicitcad-bin
cp /usr/local/bin/extopenscad /opt/implicitcad-bin/extopenscad
chmod +x /opt/implicitcad-bin/extopenscad

echo "Starting ImplicitCAD services..."
echo "  extopenscad: $(extopenscad --help 2>&1 | head -1)"

# Create log directory (implicitsnap defaults to log/access.log and log/error.log)
mkdir -p /app/log

# Start implicitsnap (jsTHREE render server) on port 8080
echo "  implicitsnap listening on :8080"
exec implicitsnap -p 8080
