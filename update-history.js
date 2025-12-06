#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "news.json");
const HISTORY_SOURCE = "Wikipedia On This Day";
const CUTOFF_YEAR = 1800;

const FALLBACK_EVENTS = [
  {
    year: 1697,
    title: "Treaty of Ryswick",
    summary:
      "Europa beendet den Pfälzischen Erbfolgekrieg mit dem Frieden von Rijswijk und bestätigt damit die Grenzen vor dem Konflikt.",
    link: "https://en.wikipedia.org/wiki/Treaty_of_Ryswick"
  },
  {
    year: 1759,
    title: "Publication of Candide",
    summary:
      "Voltaire veröffentlicht 'Candide' anonym und kritisiert darin bitter-satirisch Krieg, Klerus und Optimismus seiner Zeit.",
    link: "https://en.wikipedia.org/wiki/Candide"
  },
  {
    year: 1666,
    title: "Great Fire of London",
    summary:
      "Ein Feuer zerstört große Teile Londons, beschleunigt aber den späteren Wiederaufbau mit modernerer Stadtplanung.",
    link: "https://en.wikipedia.org/wiki/Great_Fire_of_London"
  }
];

function sanitizeText(value) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildEntryFromSource(entry) {
  const page = entry.pages?.[0];
  const rawText = entry.text?.trim() || page?.extract || "Historischer Eintrag";
  const link =
    page?.content_urls?.desktop?.page ||
    page?.content_urls?.mobile?.page ||
    "https://en.wikipedia.org/wiki/Portal:History";
  const normalizedTitle = sanitizeText(page?.titles?.display || rawText || "Historisches Ereignis");

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

function buildFallbackEntry() {
  const today = new Date();
  const index = today.getUTCDate() % FALLBACK_EVENTS.length;
  const base = FALLBACK_EVENTS[index];
  return {
    id: `history-fallback-${base.year}-${index}`,
    title: `${base.year}: ${base.title}`,
    summary: base.summary,
    paragraphs: [base.summary],
    link: base.link,
    source: HISTORY_SOURCE,
    publishedAt: new Date().toISOString(),
    year: base.year
  };
}

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
    console.warn(`Kein History-Beitrag vor ${CUTOFF_YEAR} gefunden – verwende Fallback.`);
    return buildFallbackEntry();
  }

  return buildEntryFromSource(candidates[0]);
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
