#!/bin/zsh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_DIR/logs"
mkdir -p "$LOG_DIR"

NEWS_CMD="0 6,10,14,18,22 * * * /bin/zsh \"$REPO_DIR/scripts/update-news.sh\" >> \"$LOG_DIR/update-news.log\" 2>&1"
HISTORY_CMD="0 9 * * * /bin/zsh \"$REPO_DIR/scripts/update-history.sh\" >> \"$LOG_DIR/update-history.log\" 2>&1"

TMP_CURRENT="$(mktemp)"
crontab -l 2>/dev/null > "$TMP_CURRENT" || true
sed -e '/# nachrichten scheduler start/,/# nachrichten scheduler end/d' "$TMP_CURRENT" > "$TMP_CURRENT.filtered"

{
  cat "$TMP_CURRENT.filtered"
  printf '\n'
  printf '# nachrichten scheduler start\n'
  printf '%s\n' "$NEWS_CMD"
  printf '%s\n' "$HISTORY_CMD"
  printf '# nachrichten scheduler end\n'
  printf '\n'
} | crontab -

rm -f "$TMP_CURRENT" "$TMP_CURRENT.filtered"

echo "Cronjobs installiert. Aktuell gesetzte Einträge:"
crontab -l
