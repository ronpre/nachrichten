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
    { source: "Tagesschau", url: "https://www.tagesschau.de/xml/rss2?ressort=wirtschaft" },
    { source: "n-tv", url: "https://www.n-tv.de/wirtschaft/rss" }
  ],
  politik: [
    // DW stellt keinen sauberen Politik-Feed bereit, daher filtern wir den Top-Feed.
    { source: "DW", url: "https://rss.dw.com/xml/rss-de-top" },
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
    allowedSources: new Set(["Tagesschau", "n-tv"]),
    requireAccessible: true
  },
  politik: {
    allowedSources: new Set(["DW", "Sueddeutsche"]),
    requireAccessible: true
  },
  edv: {
    requireAccessible: true
  }
};

const EDV_BALANCE_SOURCES = ["c't", "heise"];

const ECONOMY_KEYWORDS = [
  /wirtschaft/i,
  /finanz/i,
  /finanzmarkt/i,
  /geldpolitik/i,
  /unternehmen/i,
  /konzern/i,
  /industrie/i,
  /produktion/i,
  /markt/i,
  /handel/i,
  /export/i,
  /import/i,
  /bo[eö]rs/i,
  /dax/i,
  /zins/i,
  /inflation/i,
  /konjunktur/i,
  /arbeitsmarkt/i,
  /invest/i,
  /energiepreis/i,
  /lieferkette/i
];

const POLITICS_KEYWORDS = [
  /politik/i,
  /regierung/i,
  /regierungskrise/i,
  /bundestag/i,
  /bundesrat/i,
  /parlament/i,
  /gesetz/i,
  /gesetzgeb/i,
  /koalition/i,
  /opposition/i,
  /minister(?:präsident)?/i,
  /präsident/i,
  /kanzler/i,
  /wahlkampf/i,
  /wahl/i,
  /krieg/i,
  /konflikt/i,
  /außenpolitik/i,
  /innenpolitik/i,
  /diplomat/i,
  /resolution/i,
  /sicherheitsrat/i,
  /demokratie/i,
  /verfassung/i,
  /umfragen?\s+zur\s+wahl/i,
  /sanktion/i,
  /militär/i,
  /verteidigungs/i,
  /regierungschef/i,
  /staatss?chef/i
];

const POLITICS_CATEGORY_ALLOWLIST = new Set([
  "politik",
  "welt",
  "deutschland",
  "aktuelles"
]);

const POLITICS_CATEGORY_BLOCKLIST = new Set([
  "sport",
  "kultur",
  "wirtschaft",
  "umwelt",
  "gesundheit",
  "wissen"
]);

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
    category: Array.isArray(item.categories) && item.categories.length
      ? item.categories[0]
      : item.category || null,
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

function enforceEdvBalance(items, limit) {
  const pools = new Map();
  EDV_BALANCE_SOURCES.forEach((name) => pools.set(name, []));
  pools.set("__other__", []);

  items.forEach((item) => {
    const bucket = EDV_BALANCE_SOURCES.find((name) => item.source === name);
    if (bucket) {
      pools.get(bucket).push(item);
    } else {
      pools.get("__other__").push(item);
    }
  });

  const balanced = [];
  while (balanced.length < limit) {
    let added = false;
    for (const name of EDV_BALANCE_SOURCES) {
      const pool = pools.get(name);
      if (pool.length && balanced.length < limit) {
        balanced.push(pool.shift());
        added = true;
      }
    }
    if (!added) {
      break;
    }
  }

  for (const name of EDV_BALANCE_SOURCES) {
    const pool = pools.get(name);
    while (balanced.length < limit && pool.length) {
      balanced.push(pool.shift());
    }
  }

  const otherPool = pools.get("__other__");
  while (balanced.length < limit && otherPool.length) {
    balanced.push(otherPool.shift());
  }

  return balanced;
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

function isEconomyTopic(item) {
  const textBlob = collectTextFragments(item).toLowerCase();
  return ECONOMY_KEYWORDS.some((pattern) => pattern.test(textBlob));
}

function isPoliticsTopic(item) {
  const category = (item.category || "").trim().toLowerCase();
  if (category) {
    if (POLITICS_CATEGORY_BLOCKLIST.has(category)) {
      return false;
    }
    if (POLITICS_CATEGORY_ALLOWLIST.has(category)) {
      return true;
    }
  }

  const textBlob = collectTextFragments(item).toLowerCase();
  return POLITICS_KEYWORDS.some((pattern) => pattern.test(textBlob));
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
    if (sectionKey === "wirtschaft" && !isEconomyTopic(item)) {
      console.warn(
        `Nicht-Wirtschaft-Artikel ausgeblendet (${item.source || "Unbekannt"}) – ${item.title}`
      );
      return false;
    }
    if (sectionKey === "politik" && !isPoliticsTopic(item)) {
      console.warn(
        `Nicht-Politik-Artikel ausgeblendet (${item.source || "Unbekannt"}) – ${item.title}`
      );
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
    const sorted = dedupe(filtered).sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    const prepared =
      section === "edv"
        ? enforceEdvBalance(sorted, SECTION_SIZE)
        : sorted;

    const ordered = prepared.slice(0, SECTION_SIZE);

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
