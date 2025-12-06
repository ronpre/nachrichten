#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Parser from "rss-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "news.json");

const HISTORY_SOURCE = "Wikipedia (de) On This Day";
const FALLBACK_SOURCE = "Kuratiertes Archiv";
const EXTERNAL_HISTORY_SOURCES = [
  {
    id: "zeit",
    label: "ZEIT Geschichte",
    rss: "https://newsfeed.zeit.de/wissen/zeit-geschichte/index",
    limit: 1
  },
  {
    id: "sueddeutsche",
    label: "Süddeutsche Zeitung",
    rss: "https://rss.sueddeutsche.de/rss/leben",
    limit: 1
  },
  {
    id: "spiegel",
    label: "SPIEGEL Geschichte",
    rss: "https://www.spiegel.de/geschichte/index.rss",
    limit: 1
  }
];
const PRE_MODERN_YEAR = 1800; // vor 1800
const MODERN_THRESHOLD = 1800; // neuere Geschichte
const MODERN_COUNT = 4;
const HISTORY_TOTAL = MODERN_COUNT + 1;

const rssParser = new Parser({
  headers: {
    "User-Agent": "nachrichten-dashboard/1.0 (https://github.com/ronpre/nachrichten)"
  }
});

const FALLBACK_PRE_MODERN = [
  {
    year: 1648,
    title: "Westfälischer Friede beendet den Dreißigjährigen Krieg",
    summary:
      "Mit dem Westfälischen Frieden einigen sich die europäischen Großmächte auf ein neues Machtgleichgewicht und die völkerrechtliche Anerkennung souveräner Staaten.",
    link: "https://de.wikipedia.org/wiki/Westf%C3%A4lischer_Friede",
    slug: "peace-of-westphalia"
  },
  {
    year: 1683,
    title: "Die Zweite Wiener Türkenbelagerung scheitert",
    summary:
      "Ein vereinigtes europäisches Heer stoppt das Osmanische Reich vor Wien und leitet die Gegenoffensive der Habsburger ein.",
    link: "https://de.wikipedia.org/wiki/Entsatz_von_Wien",
    slug: "battle-of-vienna"
  },
  {
    year: 1697,
    title: "Frieden von Rijswijk beendet den Pfälzischen Erbfolgekrieg",
    summary:
      "Frankreich erkennt in Rijswijk die europäische Machtbalance erneut an und zieht seine Truppen aus mehreren besetzten Gebieten ab.",
    link: "https://de.wikipedia.org/wiki/Frieden_von_Rijswijk",
    slug: "treaty-of-ryswick"
  }
];

const FALLBACK_MODERN = [
  {
    year: 1804,
    title: "Napoleon Bonaparte krönt sich zum Kaiser der Franzosen",
    summary: "In Notre-Dame hebt Napoleon das Kaiserreich aus der Taufe und stellt die Machtverhältnisse Europas erneut auf die Probe.",
    link: "https://de.wikipedia.org/wiki/Napoleon_Bonaparte",
    slug: "napoleon-emperor"
  },
  {
    year: 1871,
    title: "Gründung des Deutschen Kaiserreichs in Versailles",
    summary: "Wilhelm I. wird im Spiegelsaal zum Kaiser ausgerufen – ein Meilenstein der europäischen Nationalstaatsbildung.",
    link: "https://de.wikipedia.org/wiki/Deutsches_Kaiserreich",
    slug: "german-empire"
  },
  {
    year: 1919,
    title: "Die Weimarer Verfassung tritt in Kraft",
    summary: "Deutschland erhält erstmals eine parlamentarische Demokratie mit Grundrechten und Gewaltenteilung.",
    link: "https://de.wikipedia.org/wiki/Weimarer_Verfassung",
    slug: "weimar-constitution"
  },
  {
    year: 1949,
    title: "Das Grundgesetz begründet die Bundesrepublik Deutschland",
    summary: "Mit dem Grundgesetz entsteht ein föderaler Staat mit festen Grundrechten und parlamentarischem System.",
    link: "https://de.wikipedia.org/wiki/Grundgesetz_f%C3%BCr_die_Bundesrepublik_Deutschland",
    slug: "basic-law"
  },
  {
    year: 1989,
    title: "Fall der Berliner Mauer",
    summary: "Der friedliche Druck der Bürgerbewegungen öffnet die innerdeutsche Grenze und leitet die Wiedervereinigung ein.",
    link: "https://de.wikipedia.org/wiki/Berliner_Mauer",
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

function buildLearningNarrative(baseSummary, sourceLabel, title) {
  const fact = baseSummary || `Der Beitrag "${title}" beleuchtet ein Schlüsselereignis der Zeitgeschichte.`;
  return [
    `Ereignis: ${fact}`,
    `Auswirkungen: ${sourceLabel} dokumentiert die direkten politischen, gesellschaftlichen oder kulturellen Verschiebungen, die das Ereignis auslöste, und beschreibt, welche Akteure an Einfluss gewannen oder verloren.`,
    `Folgen: ${sourceLabel} zeigt, wie sich Entscheidungen und Reaktionen langfristig auf Institutionen, internationale Beziehungen oder Alltagsleben ausgewirkt haben.`,
    `Lehre: ${sourceLabel} filtert heraus, welche Strategien erfolgreich waren, welche Fehler vermieden werden sollten und welches Wissen daraus abgeleitet wurde.`,
    `Parallelen heute: ${sourceLabel} verknüpft das historische Motiv mit aktuellen Konflikten oder Chancen und lädt dazu ein, heutige Entwicklungen im Spiegel der Vergangenheit zu deuten.`
  ];
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
    throw new Error(`Nicht genug ${prefix === "pre" ? "Vor-1800" : "moderne"} Ereignisse gefunden.`);
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

function buildExternalHistoryEntry(item, source) {
  if (!item || !source) return null;
  const title = sanitizeText(item.title || "Historischer Kontext");
  if (!title) {
    return null;
  }
  const baseSummary = sanitizeText(
    item.contentSnippet || item.content || item.summary || item.description || "Analyse und Hintergrund aus den Leitmedien."
  );
  const slug = slugify(`${source.id}-${title}`);
  const rawPublished = item.isoDate || item.pubDate || new Date().toISOString();
  const publishedDate = new Date(rawPublished);
  const publishedIso = Number.isNaN(publishedDate.getTime()) ? new Date().toISOString() : publishedDate.toISOString();
  const link = item.link || item.guid || "https://www.zeit.de/geschichte";
  const narrative = buildLearningNarrative(baseSummary, source.label, title);

  return {
    id: `history-${source.id}-${slug}`,
    title,
    summary: narrative[0],
    paragraphs: narrative,
    link,
    source: source.label,
    publishedAt: publishedIso,
    year: null
  };
}

async function fetchExternalHistoryArticles() {
  const articleBuckets = await Promise.all(
    EXTERNAL_HISTORY_SOURCES.map(async (source) => {
      if (!source?.rss) {
        return [];
      }
      try {
        const feed = await rssParser.parseURL(source.rss);
        const items = Array.isArray(feed?.items) ? feed.items : [];
        return items
          .slice(0, source.limit || 1)
          .map((entry) => buildExternalHistoryEntry(entry, source))
          .filter(Boolean);
      } catch (error) {
        console.warn(`RSS-Feed für ${source.label} konnte nicht geladen werden:`, error.message);
        return [];
      }
    })
  );

  return articleBuckets.flat();
}

async function fetchHistoryItems() {
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const endpoint = `https://de.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;

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
  const [historyItems, externalArticles] = await Promise.all([
    fetchHistoryItems(),
    fetchExternalHistoryArticles()
  ]);
  // Prioritise journalistische Einschätzungen, damit die Website zuerst ZEIT/SZ/SPIEGEL zeigt
  const combinedHistory = [...externalArticles, ...historyItems];

  const next = {
    ...existing,
    updatedAt: new Date().toISOString(),
    categories: {
      ...existing.categories,
      history: combinedHistory
    }
  };

  await persist(next);
  console.log(
    `Geschichte aktualisiert (${historyItems.length} On-this-day + ${externalArticles.length} Artikel von ZEIT/SZ/SPIEGEL).`
  );
}

updateHistory().catch((error) => {
  console.error("History-Update fehlgeschlagen", error);
  process.exitCode = 1;
});
