#!/usr/bin/env bash
# Build EDGE Note for Mac and replace the installed copy in place.
# Your notes live on the server and the sign-in is stored outside the app
# file, so there is nothing to delete or sign in to again.
#
# Usage:  ./install.sh            build, quit, replace, reopen
#         ./install.sh --no-open  same, but do not reopen the app
set -euo pipefail

APP_NAME="EDGE Note"
DEST="/Applications/${APP_NAME}.app"
cd "$(dirname "$0")"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This installer is for macOS." >&2
  exit 1
fi

[[ -d node_modules ]] || npm install

echo "Building ${APP_NAME}..."
npx tauri build --bundles app

BUILT="src-tauri/target/release/bundle/macos/${APP_NAME}.app"
if [[ ! -d "$BUILT" ]]; then
  echo "Build finished but ${BUILT} was not found." >&2
  exit 1
fi

# Quit the running copy (it keeps running in the menu bar when its window is closed).
if pgrep -x "edge-note-desktop" >/dev/null 2>&1; then
  echo "Quitting the running app..."
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    pgrep -x "edge-note-desktop" >/dev/null 2>&1 || break
    sleep 0.25
  done
  pkill -x "edge-note-desktop" >/dev/null 2>&1 || true
fi

echo "Installing to ${DEST}..."
rm -rf "$DEST"
ditto "$BUILT" "$DEST"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

if [[ "${1:-}" != "--no-open" ]]; then
  open "$DEST"
fi
echo "Done."
