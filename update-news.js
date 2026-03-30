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
    { source: "Handelsblatt", url: "https://www.handelsblatt.com/contentexport/feed/wirtschaft" }
  ],
  politik: [
    { source: "SPIEGEL", url: "https://www.spiegel.de/politik/index.rss" },
    { source: "Sueddeutsche", url: "https://rss.sueddeutsche.de/rss/Politik" }
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

const SECTION_RULES = {
  wirtschaft: {
    allowedSources: new Set(["Handelsblatt"]),
    requireAccessible: true
  },
  politik: {
    allowedSources: new Set(["SPIEGEL", "Sueddeutsche"])
  },
  edv: {
    requireAccessible: true
  }
};

const GENERIC_PAYWALL_TEXT_HINTS = [
  /\bhb\+\b/i,
  /handelsblatt\s*\+/i,
  /heise\s*\+/i,
  /c't\s*\+/i,
  /\bsz\+\b/i,
  /\babo\b/i,
  /abon(n)?enten/i,
  /\bjetzt\s+weiterlesen\b/i,
  /\bpaywall\b/i,
  /plus-?inhalt/i,
  /nur\s+für\s+abonnenten/i,
  /registrieren.*weiterlesen/i,
  /\[\s*\+\s*\]/
];

const GENERIC_PAYWALL_PATH_HINTS = [
  /\/abo\//i,
  /\/abonnement\//i,
  /\/premium\//i,
  /\/plus\//i,
  /\/select\//i
];

const PAYWALL_HOST_RULES = [
  {
    hostPattern: /handelsblatt\.com$/i,
    pathPatterns: [/\/abo\//i, /\/premium\//i, /\/plus\//i],
    textHints: [/handelsblatt\s*\+/i, /\bhb\+\b/i]
  },
  {
    hostPattern: /spiegel\.de$/i,
    pathPatterns: [/\/plus\//i],
    textHints: [/\[\s*\+\s*\]/]
  },
  {
    hostPattern: /sueddeutsche\.de$/i,
    pathPatterns: [/\/plus\//i],
    textHints: [/\bsz\+\b/i]
  },
  {
    hostPattern: /heise\.de$/i,
    pathPatterns: [/\/select\//i],
    textHints: [/heise\s*\+/i]
  },
  {
    hostPattern: /ct\.de$/i,
    pathPatterns: [/\/plus\//i, /\/premium\//i],
    textHints: [/c't\s*\+/i]
  }
];

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

function collectTextFragments(item) {
  const parts = [];
  if (item.title) parts.push(item.title);
  if (item.summary) parts.push(item.summary);
  if (Array.isArray(item.paragraphs) && item.paragraphs.length) {
    parts.push(item.paragraphs.join(" "));
  }
  if (item.link) parts.push(item.link);
  return parts.join("\n");
}

function isLikelyPaywalled(item) {
  const textBlob = collectTextFragments(item).toLowerCase();

  if (GENERIC_PAYWALL_TEXT_HINTS.some((pattern) => pattern.test(textBlob))) {
    return true;
  }

  try {
    const { hostname, pathname } = new URL(item.link || "");
    const normalizedPath = pathname || "";
    const hostRule = PAYWALL_HOST_RULES.find((rule) => rule.hostPattern.test(hostname));

    if (hostRule) {
      if (
        (hostRule.pathPatterns && hostRule.pathPatterns.some((pattern) => pattern.test(normalizedPath))) ||
        (hostRule.textHints && hostRule.textHints.some((pattern) => pattern.test(textBlob)))
      ) {
        return true;
      }
    } else if (GENERIC_PAYWALL_PATH_HINTS.some((pattern) => pattern.test(normalizedPath))) {
      return true;
    }
  } catch {
    // ignore malformed URLs
  }

  return false;
}

function applySectionRules(sectionKey, items) {
  const rules = SECTION_RULES[sectionKey];
  if (!rules) {
    return items;
  }

  return items.filter((item) => {
    if (rules.allowedSources && !rules.allowedSources.has(item.source)) {
      return false;
    }
    if (rules.requireAccessible && isLikelyPaywalled(item)) {
      console.warn(
        `Paywall-Artikel ausgeblendet (${sectionKey}): ${item.source || "Unbekannt"} – ${item.title}`
      );
      return false;
    }
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

    const filtered = applySectionRules(section, results);
    const ordered = dedupe(filtered)
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
