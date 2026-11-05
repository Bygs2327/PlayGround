#!/usr/bin/env bash
# Capture the published preview with an isolated browser owned by this script.
set -euo pipefail

TIMED() { /usr/bin/time -p "$@"; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$PROJECT_DIR"

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact page to capture.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the source tree.}"

CAPTURE_DIR="$(realpath -m "$CAPTURE_DIR")"
case "$CAPTURE_DIR" in
  "$PROJECT_DIR"|"$PROJECT_DIR"/*)
    echo "CAPTURE_DIR must be outside the project source: $CAPTURE_DIR" >&2
    exit 1
    ;;
esac
if [[ -z "$CAPTURE_URL" ]]; then
  echo "CAPTURE_URL must not be empty." >&2
  exit 1
fi

TIMED mkdir -p "$CAPTURE_DIR"
TIMED rm -f "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"

# The start screen can have zero-height body geometry because its panels are
# fixed-position, so wait for an actual rendered control instead of <body>.
export CAPTURE_READY_SELECTOR="${CAPTURE_READY_SELECTOR:-#start}"
export CAPTURE_AUTO_START="${CAPTURE_AUTO_START:-false}"
export CAPTURE_STRICT="${CAPTURE_STRICT:-1}"

status=0
TIMED node "${RUNTIME_DIR:?}/scripts/default-capture.mjs" || status=$?

if (( status == 0 )); then
  for view in desktop mobile; do
    if ! TIMED test -s "$CAPTURE_DIR/final-$view.png"; then
      echo "Capture did not produce a rendered final-$view.png" >&2
      exit 1
    fi
  done
  echo "Captured desktop and mobile views in $CAPTURE_DIR"
  exit 0
fi

# 75 is reserved for transient browser/navigation infrastructure failures.
if (( status == 75 )); then
  echo "Capture failed due to a temporary browser or navigation failure." >&2
  exit 75
fi

echo "Capture failed due to a script or rendering defect (exit $status)." >&2
exit 1
