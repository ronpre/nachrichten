#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "news.json");
const HISTORY_SOURCE = "Wikipedia On This Day";
const CUTOFF_YEAR = 1800;

async function fetchHistoryEntry() {
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const endpoint = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;

  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "nachrichten-dashboard/1.0 (https://github.com/ronpre/nachrichten)",
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Wikipedia antwortete mit Status ${response.status}`);
  }

  const payload = await response.json();
  const candidates = (payload.events || []).filter(
    (event) => typeof event.year === "number" && event.year < CUTOFF_YEAR
  );

  if (!candidates.length) {
    throw new Error(`Kein History-Beitrag vor ${CUTOFF_YEAR} gefunden.`);
  }

  const entry = candidates[0];
  const page = entry.pages?.[0];
  const rawText = entry.text?.trim() || page?.extract || "Historischer Eintrag";
  const link =
    page?.content_urls?.desktop?.page ||
    page?.content_urls?.mobile?.page ||
    "https://en.wikipedia.org/wiki/Portal:History";
  const normalizedTitle = page?.titles?.display || rawText;

  return {
    id: `history-${entry.year}-${page?.pageid || normalizedTitle.slice(0, 16)}`,
    title: `${entry.year}: ${normalizedTitle}`,
    summary: rawText,
    paragraphs: rawText ? [rawText] : [],
    link,
    source: HISTORY_SOURCE,
    publishedAt: new Date().toISOString(),
    year: entry.year || null
  };
}

async function loadExisting() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      updatedAt: null,
      categories: { wirtschaft: [], politik: [], sport: [], history: [] }
    };
  }
}

async function persist(payload) {
  await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2));
}

async function updateHistory() {
  const existing = await loadExisting();
  const historyEntry = await fetchHistoryEntry();

  const next = {
    ...existing,
    updatedAt: new Date().toISOString(),
    categories: {
      ...existing.categories,
      history: [historyEntry]
    }
  };

  await persist(next);
  console.log(`Geschichte aktualisiert (${historyEntry.year}) aus ${HISTORY_SOURCE}.`);
}

updateHistory().catch((error) => {
  console.error("History-Update fehlgeschlagen", error);
  process.exitCode = 1;
});
