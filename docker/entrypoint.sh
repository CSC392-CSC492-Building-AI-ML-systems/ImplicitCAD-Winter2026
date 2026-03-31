#!/bin/sh
set -e

mkdir -p /opt/implicitcad-bin
cp /usr/local/bin/extopenscad /opt/implicitcad-bin/extopenscad
chmod +x /opt/implicitcad-bin/extopenscad

echo "Starting ImplicitCAD engine container..."
echo "  extopenscad: $(extopenscad --help 2>&1 | head -1)"
echo "  mode: shared binary volume + exec shell"

# Keep the helper container alive so studio.sh can exec into it and the
# extopenscad binary remains available through the shared Docker volume.
exec tail -f /dev/null
