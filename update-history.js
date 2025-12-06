#!/usr/bin/env node
import Parser from "rss-parser";
import { parse } from "node-html-parser";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "news.json");
const LOG_FILE = path.join(__dirname, "history_log.json");
const parser = new Parser({ timeout: 10000 });

const HISTORY_FEEDS = [
  { source: "ZEIT Geschichte", url: "https://newsfeed.zeit.de/wissen/zeit-geschichte" },
  { source: "SPIEGEL Geschichte", url: "https://www.spiegel.de/geschichte/index.rss" },
  { source: "SZ Kultur", url: "https://rss.sueddeutsche.de/rss/kultur" }
];

const HISTORY_COUNT = 5;
const HISTORY_LOG_LIMIT = 500;
const BRITANNICA_BASE = "https://www.britannica.com";

const PRE_MODERN_YEAR = 1800;

async function fetchFeed(feed) {
  try {
    const data = await parser.parseURL(feed.url);
    return data.items.map((item) => normalizeRss(item, feed.source));
  } catch (error) {
    console.warn(`History-Feed fehlgeschlagen (${feed.source}): ${error.message}`);
    return [];
  }
}

function normalizeRss(item, source) {
  const summary = (item.contentSnippet || item.content || item.summary || "").trim();
  const published = item.isoDate || item.pubDate || new Date().toISOString();
  return {
    id: item.guid || item.link || `${source}-${item.title}`,
    title: (item.title || "Ohne Titel").trim(),
    summary,
    paragraphs: summary ? [summary] : [],
    link: item.link || "",
    source,
    publishedAt: new Date(published).toISOString(),
    year: null,
    slug: `${source}-${item.title}`
  };
}

async function fetchBritannicaEvents() {
  const today = new Date();
  const monthName = today.toLocaleString("en-US", { month: "long" });
  const day = today.getUTCDate();
  const url = `${BRITANNICA_BASE}/on-this-day/${monthName}-${day}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "nachrichten-dashboard/1.0 (+https://github.com/ronpre/nachrichten)",
        Accept: "text/html"
      }
    });

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const html = await response.text();
    const root = parse(html);
    const cards = root.querySelectorAll(".md-history-event");

    return cards.map((card, index) => {
      const yearText = card.querySelector(".date-label")?.text.trim();
      const year = yearText ? Number.parseInt(yearText, 10) : null;
      const body = card.querySelector(".card-body");
      const bodyHtml = body?.innerHTML ?? "";
      const summary = cleanText(bodyHtml);
      const firstLink = body?.querySelector("a")?.getAttribute("href") ?? url;
      const link = firstLink.startsWith("http") ? firstLink : `${BRITANNICA_BASE}${firstLink}`;
      const title = year ? `${year}: ${truncate(summary, 90)}` : truncate(summary, 90);

      return {
        id: `britannica-${year || index}-${link}`,
        title,
        summary,
        paragraphs: summary ? [summary] : [],
        link,
        source: "Britannica",
        publishedAt: new Date().toISOString(),
        year: Number.isFinite(year) ? year : null,
        slug: `britannica-${year || index}-${link}`
      };
    });
  } catch (error) {
    console.warn(`Britannica konnte nicht geladen werden: ${error.message}`);
    return [];
  }
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function cleanText(html) {
  const withoutTags = html.replace(/<[^>]+>/g, " ");
  return decodeHtml(withoutTags).replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchWikipediaEvents() {
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
  return (payload.events || []).map((event) => {
    const page = event.pages?.[0];
    const link = page?.content_urls?.desktop?.page || page?.content_urls?.mobile?.page || "https://en.wikipedia.org/wiki/Portal:Current_events";
    const summary = event.text?.trim() || page?.extract || "Historischer Eintrag";
    return {
      id: `wiki-${event.year}-${event.text?.slice(0, 24) || Math.random()}`,
      title: `${event.year}: ${event.text?.trim() || "Historisches Ereignis"}`,
      summary,
      paragraphs: summary ? [summary] : [],
      link,
      source: "Wikipedia",
      publishedAt: new Date().toISOString(),
      year: event.year || null,
      slug: `wiki-${event.year}-${event.text?.slice(0, 32)}`
    };
  });
}

async function loadJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function persist(json, file) {
  await fs.writeFile(file, JSON.stringify(json, null, 2));
}

function chooseHistoryItems(pool, log) {
  const used = new Set(log.used_slugs || []);
  const chosen = [];

  const preModern = pool.filter((item) => typeof item.year === "number" && item.year < PRE_MODERN_YEAR);
  let freshPreModern = preModern.find((item) => !used.has(item.slug));
  if (!freshPreModern) {
    if (!preModern.length) {
      throw new Error("Kein History-Eintrag vor 1800 verfuegbar.");
    }
    console.warn("Kein neuer Vor-1800-Eintrag verfuegbar – verwende bestehenden Eintrag erneut.");
    freshPreModern = preModern[0];
  }
  chosen.push(freshPreModern);
  used.add(freshPreModern.slug);

  for (const item of pool) {
    if (chosen.length >= HISTORY_COUNT) break;
    if (used.has(item.slug)) continue;
    chosen.push(item);
    used.add(item.slug);
  }

  if (chosen.length < HISTORY_COUNT) {
    throw new Error("Nicht genug einzigartige History-Artikel gefunden.");
  }

  const updatedLog = [...(log.used_slugs || []), ...chosen.map((item) => item.slug)];
  const trimmedLog = updatedLog.slice(-HISTORY_LOG_LIMIT);
  return { items: chosen.slice(0, HISTORY_COUNT), slugs: trimmedLog };
}

async function updateHistory() {
  const [existing, log] = await Promise.all([
    loadJson(DATA_FILE, {
      updatedAt: null,
      categories: { wirtschaft: [], politik: [], sport: [], history: [] }
    }),
    loadJson(LOG_FILE, { used_slugs: [] })
  ]);

  const [rssResults, britannicaEntries, wikiEvents] = await Promise.all([
    Promise.all(HISTORY_FEEDS.map(fetchFeed)).then((chunks) => chunks.flat()),
    fetchBritannicaEvents(),
    fetchWikipediaEvents()
  ]);

  const pool = [...rssResults, ...britannicaEntries, ...wikiEvents].sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
  const { items, slugs } = chooseHistoryItems(pool, log);

  const next = {
    ...existing,
    categories: {
      ...existing.categories,
      history: items
    }
  };

  await Promise.all([
    persist(next, DATA_FILE),
    persist({ used_slugs: slugs }, LOG_FILE)
  ]);

  console.log(`History aktualisiert (${items.length} Einträge).`);
}

updateHistory().catch((error) => {
  console.error("History-Update fehlgeschlagen", error);
  process.exitCode = 1;
});
