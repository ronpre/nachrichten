#!/bin/zsh
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$REPO_DIR/logs/update-news.log"
cd "$REPO_DIR"
node schedule-updates.js

if [[ -f "$LOG_FILE" ]]; then
	tail -n 20 "$LOG_FILE"
fi
