import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "logs");
let logDirReady;
const TASKS = [
  { label: "news", script: "update-news.js" },
  { label: "history", script: "update-history.js" }
];

function ensureLogDir() {
  if (!logDirReady) {
    logDirReady = fs.mkdir(LOG_DIR, { recursive: true }).catch((error) => {
      console.error(`Log-Verzeichnis konnte nicht erstellt werden: ${error.message}`);
    });
  }
  return logDirReady;
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function runScript(label, scriptPath) {
  return new Promise((resolve) => {
    log(`Starte ${label} ...`);
    const normalizedLabel = label.replace(/[^a-z0-9_-]/gi, "_");
    const logFile = path.join(LOG_DIR, `update-${normalizedLabel}.log`);
    const appendLog = (text) =>
      ensureLogDir()
        .then(() => {
          const line = `[${new Date().toISOString()}] ${text}`;
          return fs.appendFile(logFile, `${line}\n`);
        })
        .catch((error) => {
          log(`${label} (logwrite): ${error.message}`);
        });
    const pendingWrites = [];
    const queueLog = (text) => pendingWrites.push(appendLog(text));

    execFile(
      process.execPath,
      [path.join(__dirname, scriptPath)],
      { cwd: __dirname },
      (error, stdout, stderr) => {
        if (stdout) {
          stdout
            .trim()
            .split("\n")
            .forEach((line) => {
              if (!line) return;
              log(`${label}: ${line}`);
              queueLog(line);
            });
        }
        if (stderr) {
          stderr
            .trim()
            .split("\n")
            .forEach((line) => {
              if (!line) return;
              log(`${label} (stderr): ${line}`);
              queueLog(`stderr: ${line}`);
            });
        }
        if (error) {
          log(`${label} fehlgeschlagen: ${error.message}`);
          queueLog(`Fehler: ${error.message}`);
        } else {
          log(`${label} abgeschlossen.`);
          queueLog("Job abgeschlossen.");
        }
        Promise.allSettled(pendingWrites).finally(resolve);
      }
    );
  });
}

async function runManualUpdates() {
  await ensureLogDir();
  for (const task of TASKS) {
    await runScript(task.label, task.script);
  }
  log("Alle manuellen Updates abgeschlossen. Anwendung kann beendet werden.");
}

runManualUpdates().catch((error) => {
  log(`Manueller Lauf fehlgeschlagen: ${error.message}`);
  process.exitCode = 1;
});
