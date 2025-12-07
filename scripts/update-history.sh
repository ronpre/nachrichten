#!/bin/zsh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_PREFIX="[nachrichten:update-history]"

if ! command -v node >/dev/null 2>&1; then
  echo "$LOG_PREFIX Fehler: Node.js wurde nicht gefunden" >&2
  exit 1
fi

cd "$REPO_DIR"
node update-history.js
