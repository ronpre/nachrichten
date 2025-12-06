#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "news.json");

const HISTORY_SOURCE = "Wikipedia On This Day";
const FALLBACK_SOURCE = "Kuratiertes Archiv";
const PRE_MODERN_YEAR = 1700; // vor dem 18. Jahrhundert
const MODERN_THRESHOLD = 1800; // neuere Geschichte
const MODERN_COUNT = 4;
const HISTORY_TOTAL = MODERN_COUNT + 1;

const FALLBACK_PRE_MODERN = [
  {
    year: 1648,
    title: "Westfälischer Friede beendet den Dreißigjährigen Krieg",
    summary:
      "Mit dem Westfälischen Frieden einigen sich die europäischen Großmächte auf ein neues Machtgleichgewicht und die völkerrechtliche Anerkennung souveräner Staaten.",
    link: "https://en.wikipedia.org/wiki/Peace_of_Westphalia",
    slug: "peace-of-westphalia"
  },
  {
    year: 1683,
    title: "Die Zweite Wiener Türkenbelagerung scheitert",
    summary:
      "Ein vereinigtes europäisches Heer stoppt das Osmanische Reich vor Wien und leitet die Gegenoffensive der Habsburger ein.",
    link: "https://en.wikipedia.org/wiki/Battle_of_Vienna",
    slug: "battle-of-vienna"
  },
  {
    year: 1697,
    title: "Frieden von Rijswijk beendet den Pfälzischen Erbfolgekrieg",
    summary:
      "Frankreich erkennt in Rijswijk die europäische Machtbalance erneut an und zieht seine Truppen aus mehreren besetzten Gebieten ab.",
    link: "https://en.wikipedia.org/wiki/Treaty_of_Ryswick",
    slug: "treaty-of-ryswick"
  }
];

const FALLBACK_MODERN = [
  {
    year: 1804,
    title: "Napoleon Bonaparte krönt sich zum Kaiser der Franzosen",
    summary: "In Notre-Dame hebt Napoleon das Kaiserreich aus der Taufe und stellt die Machtverhältnisse Europas erneut auf die Probe.",
    link: "https://en.wikipedia.org/wiki/Napoleon",
    slug: "napoleon-emperor"
  },
  {
    year: 1871,
    title: "Gründung des Deutschen Kaiserreichs in Versailles",
    summary: "Wilhelm I. wird im Spiegelsaal zum Kaiser ausgerufen – ein Meilenstein der europäischen Nationalstaatsbildung.",
    link: "https://en.wikipedia.org/wiki/German_Empire",
    slug: "german-empire"
  },
  {
    year: 1919,
    title: "Die Weimarer Verfassung tritt in Kraft",
    summary: "Deutschland erhält erstmals eine parlamentarische Demokratie mit Grundrechten und Gewaltenteilung.",
    link: "https://en.wikipedia.org/wiki/Weimar_Constitution",
    slug: "weimar-constitution"
  },
  {
    year: 1949,
    title: "Das Grundgesetz begründet die Bundesrepublik Deutschland",
    summary: "Mit dem Grundgesetz entsteht ein föderaler Staat mit festen Grundrechten und parlamentarischem System.",
    link: "https://en.wikipedia.org/wiki/Basic_Law_for_the_Federal_Republic_of_Germany",
    slug: "basic-law"
  },
  {
    year: 1989,
    title: "Fall der Berliner Mauer",
    summary: "Der friedliche Druck der Bürgerbewegungen öffnet die innerdeutsche Grenze und leitet die Wiedervereinigung ein.",
    link: "https://en.wikipedia.org/wiki/Berlin_Wall",
    slug: "berlin-wall"
  }
];

function sanitizeText(value) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  if (!value) return "entry";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "entry";
}

function buildEntryFromEvent(event) {
  if (typeof event.year !== "number") return null;
  const page = event.pages?.[0];
  const rawSummary = event.text?.trim() || page?.extract || "Historischer Eintrag";
  const summary = sanitizeText(rawSummary);
  const titleText = sanitizeText(page?.titles?.display || event.text || "Historisches Ereignis");
  const slug = slugify(titleText);
  const link =
    page?.content_urls?.desktop?.page ||
    page?.content_urls?.mobile?.page ||
    "https://en.wikipedia.org/wiki/Portal:History";

  return {
    id: `history-wiki-${event.year}-${slug}`,
    title: `${event.year}: ${titleText}`,
    summary,
    paragraphs: summary ? [summary] : [],
    link,
    source: HISTORY_SOURCE,
    publishedAt: new Date().toISOString(),
    year: event.year
  };
}

function buildEntryFromFallback(item, prefix) {
  const summary = sanitizeText(item.summary);
  const slug = item.slug || slugify(item.title);
  return {
    id: `history-${prefix}-${item.year}-${slug}`,
    title: `${item.year}: ${item.title}`,
    summary,
    paragraphs: summary ? [summary] : [],
    link: item.link,
    source: item.source || FALLBACK_SOURCE,
    publishedAt: new Date().toISOString(),
    year: item.year
  };
}

function takeEntries(primary, fallbackSpecs, needed, prefix) {
  const entries = [];
  const seen = new Set();

  for (const item of primary) {
    if (!item || entries.length >= needed) break;
    const key = `${item.year}-${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(item);
  }

  if (entries.length < needed) {
    for (const spec of fallbackSpecs) {
      if (entries.length >= needed) break;
      const fallbackEntry = buildEntryFromFallback(spec, prefix);
      const key = `${fallbackEntry.year}-${fallbackEntry.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(fallbackEntry);
    }
  }

  if (entries.length < needed) {
    throw new Error(`Nicht genug ${prefix === "pre" ? "Vor-1700" : "moderne"} Ereignisse gefunden.`);
  }
  return entries;
}

function normalizeWikipediaEvents(events = []) {
  const normalized = [];
  const seen = new Set();

  for (const event of events) {
    const entry = buildEntryFromEvent(event);
    if (!entry) continue;
    const key = `${entry.year}-${entry.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(entry);
  }

  return normalized.sort((a, b) => b.year - a.year);
}

async function fetchHistoryItems() {
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
  const normalized = normalizeWikipediaEvents(payload.events || []);

  const modernCandidates = normalized.filter((item) => item.year >= MODERN_THRESHOLD);
  const preModernCandidates = normalized.filter((item) => item.year < PRE_MODERN_YEAR);

  const modernEntries = takeEntries(modernCandidates, FALLBACK_MODERN, MODERN_COUNT, "modern");
  const preEntry = takeEntries(preModernCandidates, FALLBACK_PRE_MODERN, 1, "pre")[0];

  return [...modernEntries, preEntry];
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
  const historyItems = await fetchHistoryItems();

  const next = {
    ...existing,
    updatedAt: new Date().toISOString(),
    categories: {
      ...existing.categories,
      history: historyItems
    }
  };

  await persist(next);
  console.log(
    `Geschichte aktualisiert (${historyItems.length} Einträge: ${MODERN_COUNT} modern + 1 vor 1700).`
  );
}

updateHistory().catch((error) => {
  console.error("History-Update fehlgeschlagen", error);
  process.exitCode = 1;
});
