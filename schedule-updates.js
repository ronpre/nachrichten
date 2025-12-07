import cron from "node-cron";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function runScript(label, scriptPath) {
  return new Promise((resolve) => {
    log(`Starte ${label} ...`);
    execFile(
      process.execPath,
      [path.join(__dirname, scriptPath)],
      { cwd: __dirname },
      (error, stdout, stderr) => {
        if (stdout) {
          stdout.trim().split("\n").forEach((line) => line && log(`${label}: ${line}`));
        }
        if (stderr) {
          stderr.trim().split("\n").forEach((line) => line && log(`${label} (stderr): ${line}`));
        }
        if (error) {
          log(`${label} fehlgeschlagen: ${error.message}`);
        } else {
          log(`${label} abgeschlossen.`);
        }
        resolve();
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
