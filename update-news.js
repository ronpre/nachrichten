#!/usr/bin/env node
import Parser from "rss-parser";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "news.json");
const parser = new Parser({ timeout: 10000 });

const SECTION_CONFIG = {
  wirtschaft: [
    { source: "ZEIT", url: "https://newsfeed.zeit.de/wirtschaft/index" },
    { source: "SPIEGEL", url: "https://www.spiegel.de/wirtschaft/index.rss" },
    { source: "Sueddeutsche", url: "https://rss.sueddeutsche.de/rss/Wirtschaft" },
    { source: "Handelsblatt", url: "https://www.handelsblatt.com/contentexport/feed/wirtschaft" }
  ],
  politik: [
    { source: "ZEIT", url: "https://newsfeed.zeit.de/politik/index" },
    { source: "SPIEGEL", url: "https://www.spiegel.de/politik/index.rss" },
    { source: "Sueddeutsche", url: "https://rss.sueddeutsche.de/rss/Politik" },
    { source: "Handelsblatt", url: "https://www.handelsblatt.com/contentexport/feed/politik" }
  ],
  sport: [
    { source: "ZEIT", url: "https://newsfeed.zeit.de/sport/index" },
    { source: "SPIEGEL", url: "https://www.spiegel.de/sport/index.rss" },
    { source: "Sueddeutsche", url: "https://rss.sueddeutsche.de/rss/Sport" },
    { source: "Kicker", url: "https://newsfeed.kicker.de/news/aktuell" }
  ],
  edv: [
    { source: "c't", url: "https://www.heise.de/ct/feed.xml" },
    { source: "heise", url: "https://www.heise.de/rss/heise-atom.xml" }
  ]
};

const SECTION_SIZE = 20;
const SECTION_KEYS = Object.keys(SECTION_CONFIG);

function createEmptyCategories() {
  return SECTION_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFeed(feed) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const data = await parser.parseURL(feed.url);
      return data.items.map((item) => normalizeItem(item, feed.source));
    } catch (error) {
      if (attempt === 2) {
        console.warn(`Feed fehlgeschlagen (${feed.source}): ${error.message}`);
        return [];
      }
      await sleep(750);
    }
  }
  return [];
}

function normalizeItem(item, source) {
  const summary = (item.contentSnippet || item.content || item.summary || "").trim();
  const published = item.isoDate || item.pubDate || new Date().toISOString();
  return {
    id: item.guid || item.link || `${source}-${item.title}`,
    title: (item.title || "Ohne Titel").trim(),
    summary,
    paragraphs: summary ? [summary] : [],
    link: item.link || "",
    source,
    publishedAt: new Date(published).toISOString()
  };
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.source}-${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadExisting() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const sourceCategories =
      parsed && typeof parsed.categories === "object" ? parsed.categories : {};
    return {
      updatedAt: parsed?.updatedAt || null,
      categories: SECTION_KEYS.reduce((acc, key) => {
        acc[key] = Array.isArray(sourceCategories[key]) ? sourceCategories[key] : [];
        return acc;
      }, createEmptyCategories())
    };
  } catch {
    return {
      updatedAt: null,
      categories: createEmptyCategories()
    };
  }
}

async function saveData(payload) {
  const body = JSON.stringify(payload, null, 2);
  await fs.writeFile(DATA_FILE, body);
}

async function updateSections() {
  const existing = await loadExisting();
  const next = { ...existing, categories: createEmptyCategories() };

  for (const [section, feeds] of Object.entries(SECTION_CONFIG)) {
    const results = [];
    for (const feed of feeds) {
      const entries = await fetchFeed(feed);
      results.push(...entries);
    }

    const ordered = dedupe(results)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, SECTION_SIZE);

    if (ordered.length < SECTION_SIZE) {
      console.warn(`Warnung: ${section} liefert nur ${ordered.length} Artikel.`);
    }

    next.categories[section] = ordered;
  }

  next.updatedAt = new Date().toISOString();
  await saveData(next);
  console.log(
    `News aktualisiert (${new Date(next.updatedAt).toLocaleString("de-DE")})`
  );
}

updateSections().catch((error) => {
  console.error("News-Update fehlgeschlagen", error);
  process.exitCode = 1;
});
