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

const ARGUMENTS = process.argv.slice(2);
let ACTIVE_TASKS;

try {
  ACTIVE_TASKS = selectTasks(TASKS, parseTaskFilters(ARGUMENTS));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

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

function parseTaskFilters(argv) {
  const options = { only: null, skip: new Set() };
  let index = 0;

  while (index < argv.length) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsageAndExit(0);
    } else if (arg === "--only") {
      const next = argv[index + 1];
      if (!next) {
        console.error("Option --only erwartet eine kommaseparierte Taskliste (z. B. --only news,history).");
        printUsageAndExit(1);
      }
      options.only = new Set(parseListArgument(next));
      index += 2;
      continue;
    } else if (arg.startsWith("--only=")) {
      options.only = new Set(parseListArgument(arg.split("=")[1] ?? ""));
      index += 1;
      continue;
    } else if (arg === "--skip") {
      const next = argv[index + 1];
      if (!next) {
        console.error("Option --skip erwartet eine kommaseparierte Taskliste (z. B. --skip history).");
        printUsageAndExit(1);
      }
      parseListArgument(next).forEach((task) => options.skip.add(task));
      index += 2;
      continue;
    } else if (arg.startsWith("--skip=")) {
      parseListArgument(arg.split("=")[1] ?? "").forEach((task) => options.skip.add(task));
      index += 1;
      continue;
    } else {
      console.warn(`Unbekannte Option ignoriert: ${arg}`);
      index += 1;
    }
  }

  return options;
}

function parseListArgument(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function selectTasks(allTasks, filters) {
  const validLabels = new Set(allTasks.map((task) => task.label));
  const normalizeSet = (setOrNull, label) => {
    if (!setOrNull || !setOrNull.size) return null;
    const filtered = new Set();
    for (const name of setOrNull) {
      if (validLabels.has(name)) {
        filtered.add(name);
      } else {
        console.warn(`Ignoriere unbekannten Task "${name}" in ${label}.`);
      }
    }
    return filtered.size ? filtered : null;
  };

  const onlySet = normalizeSet(filters.only, "--only");
  const skipSet = normalizeSet(filters.skip, "--skip");

  const resolved = allTasks.filter((task) => {
    if (onlySet && !onlySet.has(task.label)) {
      return false;
    }
    if (skipSet && skipSet.has(task.label)) {
      return false;
    }
    return true;
  });

  if (!resolved.length) {
    throw new Error("Keine Tasks nach Filtereinstellungen verfügbar.");
  }

  return resolved;
}

function printUsageAndExit(code = 0) {
  console.log(`Verwendung: node schedule-updates.js [Optionen]

Optionen:
  --only news,history   Nur die angegebenen Tasks ausführen.
  --skip history        Angegebene Tasks überspringen.
  -h, --help            Diese Hilfe anzeigen.
`);
  process.exit(code);
}

async function runManualUpdates(selectedTasks) {
  await ensureLogDir();
  log(`Aktive Tasks: ${selectedTasks.map((task) => task.label).join(", ")}`);
  for (const task of selectedTasks) {
    await runScript(task.label, task.script);
  }
  log("Alle manuellen Updates abgeschlossen. Anwendung kann beendet werden.");
}

runManualUpdates(ACTIVE_TASKS).catch((error) => {
  log(`Manueller Lauf fehlgeschlagen: ${error.message}`);
  process.exitCode = 1;
});
