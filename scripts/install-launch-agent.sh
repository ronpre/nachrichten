#!/bin/zsh
set -euo pipefail

cat <<'MSG'
[nachrichten] LaunchAgent-Installation ist deaktiviert, weil keine zeitgesteuerten Abläufe mehr benötigt werden.

Führe Updates bei Bedarf manuell aus, zum Beispiel:
  npm run update:news
  npm run update:history
  npm run start:schedule   # führt beide Updates nacheinander aus

Dieses Skript verbleibt nur aus Kompatibilitätsgründen und nimmt keine Änderungen vor.
MSG
