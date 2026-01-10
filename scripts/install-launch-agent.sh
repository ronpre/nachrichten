#!/bin/zsh
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[nachrichten] LaunchAgents werden nur auf macOS unterstützt." >&2
  echo "[nachrichten] Bitte verwende auf Linux z. B. systemd-Timer oder führe die Skripte manuell aus." >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_PREFIX="[nachrichten:launch-agent]"
NODE_BIN="$(command -v node || true)"

if [[ -z "$NODE_BIN" ]]; then
  echo "$LOG_PREFIX Fehler: Node.js wurde nicht gefunden. Bitte installiere Node 18+." >&2
  exit 1
fi

chmod 644 "$REPO_DIR/schedule-updates.js" \
  "$REPO_DIR/update-history.js" \
  "$REPO_DIR/update-news.js"

LOG_DIR="$REPO_DIR/logs"
mkdir -p "$LOG_DIR"

AGENT_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$AGENT_DIR"

NEWS_PLIST="$AGENT_DIR/de.ronpre.nachrichten.news.plist"
HISTORY_PLIST="$AGENT_DIR/de.ronpre.nachrichten.history.plist"
LAUNCHCTL="$(command -v launchctl)"

if [[ -z "$LAUNCHCTL" ]]; then
  echo "$LOG_PREFIX Fehler: launchctl wurde nicht gefunden." >&2
  exit 1
fi

ENV_PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$(dirname "$NODE_BIN")"

cat >"$NEWS_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>de.ronpre.nachrichten.news</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$REPO_DIR/schedule-updates.js</string>
    <string>--only</string>
    <string>news</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$ENV_PATH</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/scheduler.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/scheduler-error.log</string>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>14</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>22</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF

cat >"$HISTORY_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>de.ronpre.nachrichten.history</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$REPO_DIR/schedule-updates.js</string>
    <string>--only</string>
    <string>history</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$ENV_PATH</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/scheduler.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/scheduler-error.log</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>10</integer>
    <key>Minute</key><integer>5</integer>
  </dict>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF

chmod 644 "$NEWS_PLIST" "$HISTORY_PLIST"

"$LAUNCHCTL" unload "$NEWS_PLIST" 2>/dev/null || true
"$LAUNCHCTL" unload "$HISTORY_PLIST" 2>/dev/null || true
"$LAUNCHCTL" load "$NEWS_PLIST"
"$LAUNCHCTL" load "$HISTORY_PLIST"

echo "$LOG_PREFIX LaunchAgents installiert und aktiviert."
echo "$LOG_PREFIX News:    $NEWS_PLIST"
echo "$LOG_PREFIX History: $HISTORY_PLIST"
echo "$LOG_PREFIX Logs unter $LOG_DIR/scheduler*.log"
