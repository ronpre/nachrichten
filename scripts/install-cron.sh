#!/bin/zsh
set -euo pipefail

cat <<'MSG'
[nachrichten] Automatische Cron-Installation wurde deaktiviert.

Bitte führe die Updates bei Bedarf manuell aus, zum Beispiel:
  npm run update:news
  npm run update:history
  npm run start:schedule   # führt beide Updates nacheinander aus

Dieses Skript verbleibt nur aus Kompatibilitätsgründen.
MSG
