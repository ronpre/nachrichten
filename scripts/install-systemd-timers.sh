#!/bin/bash
set -euo pipefail

LOG_PREFIX="[nachrichten:systemd]"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
NODE_BIN="$(command -v node || true)"

if [[ -z "$NODE_BIN" ]]; then
  echo "$LOG_PREFIX Fehler: Node.js wurde nicht gefunden. Bitte installiere Node 18+ und erneut versuchen." >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "$LOG_PREFIX Fehler: systemctl ist nicht verfügbar. Systemd-basierte Timer können nicht installiert werden." >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"
LOG_DIR="$REPO_DIR/logs"
mkdir -p "$LOG_DIR"

NEWS_SERVICE="$UNIT_DIR/nachrichten-news.service"
HISTORY_SERVICE="$UNIT_DIR/nachrichten-history.service"
NEWS_TIMER="$UNIT_DIR/nachrichten-news.timer"
HISTORY_TIMER="$UNIT_DIR/nachrichten-history.timer"

cat >"$NEWS_SERVICE" <<EOF
[Unit]
Description=Nachrichten News-Aktualisierung
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
ExecStart=$NODE_BIN $REPO_DIR/schedule-updates.js --only news
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
EOF

cat >"$HISTORY_SERVICE" <<EOF
[Unit]
Description=Nachrichten History-Aktualisierung
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_DIR
ExecStart=$NODE_BIN $REPO_DIR/schedule-updates.js --only history
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
EOF

cat >"$NEWS_TIMER" <<'EOF'
[Unit]
Description=Timer für Nachrichten-News-Updates

[Timer]
OnCalendar=*-*-* 06,10,14,18,22:00
Persistent=true
Unit=nachrichten-news.service

[Install]
WantedBy=timers.target
EOF

cat >"$HISTORY_TIMER" <<'EOF'
[Unit]
Description=Timer für Nachrichten-History-Update

[Timer]
OnCalendar=*-*-* 10:05
Persistent=true
Unit=nachrichten-history.service

[Install]
WantedBy=timers.target
EOF

chmod 644 "$NEWS_SERVICE" "$HISTORY_SERVICE" "$NEWS_TIMER" "$HISTORY_TIMER"

if ! systemctl --user daemon-reload >/dev/null; then
  echo "$LOG_PREFIX Warnung: 'systemctl --user daemon-reload' konnte nicht ausgeführt werden. Läuft systemd --user?" >&2
  exit 1
fi

systemctl --user enable --now nachrichten-news.timer
systemctl --user enable --now nachrichten-history.timer

echo "$LOG_PREFIX Systemd-Timer aktiviert."
echo "$LOG_PREFIX News-Timer:   nachrichten-news.timer (06/10/14/18/22 Uhr)"
echo "$LOG_PREFIX History-Timer: nachrichten-history.timer (täglich 10:05 Uhr)"
echo "$LOG_PREFIX Logs bleiben in $LOG_DIR und im Journal sichtbar (journalctl --user -u nachrichten-*.service)."
