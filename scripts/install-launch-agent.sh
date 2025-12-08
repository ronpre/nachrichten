#!/bin/zsh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_DIR/logs"
PLIST_LABEL="com.nachrichten.scheduler"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
NODE_BIN="${NODE_BIN:-$(command -v node)}"

if [[ -z "${NODE_BIN}" ]]; then
  echo "[nachrichten:launch-agent] Fehler: Node.js wurde nicht gefunden" >&2
  exit 1
fi

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>%LABEL%</string>
    <key>ProgramArguments</key>
    <array>
      <string>%NODE%</string>
      <string>%SCRIPT%</string>
    </array>
    <key>WorkingDirectory</key>
    <string>%WORKDIR%</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>RUN_ONCE</key>
      <string>false</string>
    </dict>
    <key>StandardOutPath</key>
    <string>%LOGDIR%/scheduler.log</string>
    <key>StandardErrorPath</key>
    <string>%LOGDIR%/scheduler-error.log</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
      <key>SuccessfulExit</key>
      <false/>
    </dict>
  </dict>
</plist>
PLIST

perl -0pi -e "s#%LABEL%#${PLIST_LABEL}#g; s#%NODE%#${NODE_BIN}#g; s#%SCRIPT%#${REPO_DIR}/schedule-updates.js#g; s#%WORKDIR%#${REPO_DIR}#g; s#%LOGDIR%#${LOG_DIR}#g" "$PLIST_PATH"

if launchctl print "gui/$UID/${PLIST_LABEL}" >/dev/null 2>&1; then
  launchctl bootout "gui/$UID" "$PLIST_PATH" || true
fi

launchctl bootstrap "gui/$UID" "$PLIST_PATH"
launchctl kickstart -k "gui/$UID/${PLIST_LABEL}"

echo "LaunchAgent ${PLIST_LABEL} installiert und gestartet."
