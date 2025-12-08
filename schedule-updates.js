import cron from "node-cron";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "logs");
let logDirReady;

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

const berlinTZ = "Europe/Berlin";
const runOnce = process.env.RUN_ONCE === "true";

let newsJob;
let historyJob;

if (!runOnce) {
  newsJob = cron.schedule(
    "0 6-22/4 * * *",
    () => runScript("news", "update-news.js"),
    { timezone: berlinTZ }
  );

  historyJob = cron.schedule(
    "0 10 * * *",
    () => runScript("history", "update-history.js"),
    { timezone: berlinTZ }
  );

  newsJob.start();
  historyJob.start();

  log("Scheduler aktiv: News alle 4h zwischen 06-22 Uhr, History täglich um 10 Uhr.");
} else {
  log("RUN_ONCE Modus aktiv – führe nur den Initialdurchlauf aus.");
}

// Initial refresh on startup to avoid waiting for the next cron window.
try {
  await ensureLogDir();
  await runScript("news", "update-news.js");
  await runScript("history", "update-history.js");
} catch (err) {
  log(`Initialer Lauf fehlgeschlagen: ${err.message}`);
} finally {
  if (runOnce) {
    log("RUN_ONCE abgeschlossen – Scheduler wird beendet.");
    process.exit(0);
  }
}
