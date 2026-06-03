#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$REPO_ROOT/apps/web"
DIST_DIR="$WEB_DIR/dist"
TARGET_DIR="${WEB_TARGET_DIR:-/var/www/html}"

case "$TARGET_DIR" in
  ""|"/"|"/var"|"/var/www")
    echo "Refusing to deploy to unsafe target: $TARGET_DIR" >&2
    exit 1
    ;;
esac

cd "$WEB_DIR"

if [ ! -d node_modules ]; then
  npm ci
fi

npm run build

if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "Build output not found: $DIST_DIR/index.html" >&2
  exit 1
fi

sudo mkdir -p "$TARGET_DIR"

if command -v rsync >/dev/null 2>&1; then
  sudo rsync -a --delete "$DIST_DIR"/ "$TARGET_DIR"/
else
  sudo find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  sudo cp -a "$DIST_DIR"/. "$TARGET_DIR"/
fi

echo "Web build deployed to $TARGET_DIR"
