#!/bin/sh
set -e

ARCH="${1:-arm64}"   # Usage: ./scripts/build-portable.sh [arm64|amd64]

echo "▶ Downloading Caddy ($ARCH) with cache-handler..."
curl -fL \
  "https://caddyserver.com/api/download?os=linux&arch=${ARCH}&p=github.com/caddyserver/cache-handler" \
  -o "caddy-${ARCH}"
chmod +x "caddy-${ARCH}"

echo "▶ Building Vite SPA..."
VITE_COMMIT_HASH="$(git rev-parse --short HEAD 2>/dev/null || echo dev)" \
  npm run build

echo "▶ Packaging..."
DIST=/tmp/scorlller-dist
rm -rf "$DIST"
mkdir -p "$DIST"
cp -r dist/. "$DIST/dist/"
cp "caddy-${ARCH}" "$DIST/caddy"
cp Caddyfile "$DIST/Caddyfile"

cat > "$DIST/start.sh" << 'EOF'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
exec ./caddy run --config Caddyfile
EOF
chmod +x "$DIST/caddy" "$DIST/start.sh"

cd /tmp
tar -czf "scorlller-${ARCH}.tar.gz" scorlller-dist
echo "✓ /tmp/scorlller-${ARCH}.tar.gz"
