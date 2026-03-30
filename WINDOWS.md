# Windows Update Guide

Diese Dateien helfen dir, die `schedule-updates.js`-Runs auch unter Windows zuverlässig zu starten.

## Voraussetzungen

- Windows 10 oder neuer mit PowerShell 5.1 (oder PowerShell 7).
- Node.js (gleiche Version wie auf macOS/Linux). Prüfe mit `node --version`.
- Klon dieses Repos (z. B. `C:\Users\ronny\Documents\projekte\nachrichten`).

## Manuelle Ausführung

```
powershell -ExecutionPolicy Bypass -File scripts\run-scheduler-once.ps1 -- --only news
```

- Alle Argumente nach `--` werden unverändert an `schedule-updates.js` weitergereicht (`--skip history`, `--only news`, ...).
- Nach dem Run zeigt das Skript automatisch die letzten Log-Zeilen aus `logs\update-news.log` (falls vorhanden).

## Geplanter Task per Aufgabenplanung

Das Skript `scripts\install-windows-task.ps1` registriert (oder löscht) einen geplanten Task, der direkt `node schedule-updates.js` startet.

### Task anlegen

```
powershell -ExecutionPolicy Bypass -File scripts\install-windows-task.ps1 -IntervalMinutes 30 -TaskName nachrichten-updates -- --skip history
```

- `-IntervalMinutes` steuert das Wiederholintervall (5 bis 1440 Minuten).
- `-TaskName` bestimmt den Anzeigenamen in der Aufgabenplanung.
- Argumente nach `--` werden an `schedule-updates.js` durchgeschleift.
- Verwende `-Force`, wenn ein gleichnamiger Task bereits existiert und überschrieben werden soll.
- `-RunNow` triggert den Task nach erfolgreicher Registrierung einmalig.

### Task entfernen

```
powershell -ExecutionPolicy Bypass -File scripts\install-windows-task.ps1 -TaskName nachrichten-updates -Remove
```

## Logs & Fehlersuche

- Laufende Jobs schreiben nach `logs\update-news.log` und `logs\update-history.log`.
- Nutze `Get-ScheduledTask -TaskName nachrichten-updates | Get-ScheduledTaskInfo` für Statusinformationen.
- Bei Pfad- oder Rechteproblemen kannst du die erzeugte Aktion in der Aufgabenplanung einsehen (Registerkarte *Aktionen*).

## Validierung

1. Manuell: `powershell -ExecutionPolicy Bypass -File scripts\run-scheduler-once.ps1 -- --only news`. Der Exitcode entspricht dem Node-Prozess, die letzten Logzeilen werden angezeigt.
2. Geplanter Task: `Get-ScheduledTask -TaskName nachrichten-updates` prüfen und mit `Start-ScheduledTask -TaskName nachrichten-updates` eine Testausführung erzwingen.
3. Kontrolle: `Get-Content logs\update-news.log -Tail 20` bzw. `...history.log`, um sicherzustellen, dass neue Zeitstempel geschrieben wurden.
