#!/usr/bin/env bash
# Build the static site into PROJECT_DIR/dist and serve it in the foreground.
set -euo pipefail

TIMED() { /usr/bin/time -p "$@"; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
export PORT
DIST_DIR="$PROJECT_DIR/dist"
WEB_META_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
ASSETS=(index.html styles.css data.js game.js favicon.svg)

# Install dependencies only for a package-based project. This static game needs
# no runtime dependencies, so the normal path is a plain asset build below.
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    TIMED npm ci --no-audit --no-fund
  else
    TIMED npm install --no-audit --no-fund
  fi
fi

# Rebuild only when the built output is missing or older than a source asset.
build_needed=0
for asset in "${ASSETS[@]}"; do
  if [[ ! -f "$DIST_DIR/$asset" || "$PROJECT_DIR/$asset" -nt "$DIST_DIR/$asset" ]]; then
    build_needed=1
    break
  fi
done

if (( build_needed )); then
  TIMED rm -rf "$DIST_DIR"
  TIMED mkdir -p "$DIST_DIR"
  for asset in "${ASSETS[@]}"; do
    TIMED cp -p "$PROJECT_DIR/$asset" "$DIST_DIR/$asset"
  done
else
  echo "Using existing build in $DIST_DIR"
fi

# The controller reads this worker-local deployment metadata.
TIMED mkdir -p "$WEB_META_DIR"
TIMED node -e '
  const fs = require("node:fs");
  const [file, project, directory] = process.argv.slice(1);
  fs.writeFileSync(file, JSON.stringify({ project, directory }));
' "$WEB_META_DIR/deployment-output.json" "$PROJECT_DIR" "$DIST_DIR"

cd "$DIST_DIR"

# Keep OPENCODE_WEB_DIR from being rewritten by the runtime helper (it would
# record dist as the project). The metadata above already names the real root.
unset OPENCODE_WEB_DIR
if [[ -n "${RUNTIME_DIR:-}" && -f "$RUNTIME_DIR/scripts/default-start.mjs" ]]; then
  exec /usr/bin/time -p node "$RUNTIME_DIR/scripts/default-start.mjs"
fi

# Fallback for workers without the runtime helper.
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0
