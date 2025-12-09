#!/bin/zsh
set -euo pipefail

cat <<'MSG'
[nachrichten] LaunchDaemon-Installationen werden nicht mehr unterstützt.

Bitte aktualisiere News & History manuell, zum Beispiel:
  npm run update:news
  npm run update:history
  npm run start:schedule   # führt beide Updates nacheinander aus

Dieses Skript nimmt keine Systemänderungen mehr vor und dient nur als Hinweis.
MSG
