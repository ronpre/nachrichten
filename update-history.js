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
    limit: 3
  },
  {
    id: "sueddeutsche",
    label: "Süddeutsche Zeitung",
    rss: "https://rss.sueddeutsche.de/rss/leben",
    limit: 3
  },
  {
    id: "spiegel",
    label: "SPIEGEL Geschichte",
    rss: "https://www.spiegel.de/geschichte/index.rss",
    limit: 3
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

const HISTORY_LEARNING_THEMES = [
  {
    keywords: ["islam", "religion", "moschee", "kirche", "kopftuch", "glauben", "theolog"],
    impact: "Auswirkungen (Einordnung): {{source}} nutzt \"{{title}}\" als Fallstudie und zeigt anhand von {{detail}} , wie Religionspolitik, Schulalltag und Minderheitenschutz neu austariert werden – inklusive der Institutionen, die sofort reagieren müssen.",
    consequences: "Folgen (Kettenreaktion): {{source}} verfolgt Gerichtsverfahren, Gesetzesinitiativen und gesellschaftliche Allianzen, die langfristig aus diesem Streit um Glaubensfreiheit und staatliche Neutralität erwachsen.",
    lesson: "Lerneffekt: {{source}} arbeitet heraus, dass tragfähige Integrationskonzepte Transparenz, Schutz vor Extremismus und Räume für pluralistische Spiritualität brauchen – eine Erkenntnis, die die Analyse von \"{{title}}\" untermauert.",
    parallels: "Parallelen heute: {{source}} verbindet Debatten über religiöse Symbole, Moscheefinanzierung und Schulpolitik mit aktuellen Auseinandersetzungen um Demokratie und sozialen Frieden und stellt explizit Verknüpfungen zu \"{{title}}\" her."
  },
  {
    keywords: ["krieg", "konflikt", "milit", "front", "waffe", "soldat", "angriff", "besatzung"],
    impact: "Auswirkungen (Einordnung): {{source}} beschreibt, wie \"{{title}}\" – konkret {{detail}} – Kräfteverhältnisse, Bündnisse und Sicherheitsarchitekturen verschiebt und welche Akteure Terrain gewinnen oder verlieren.",
    consequences: "Folgen (Langfristperspektive): {{source}} verfolgt Effekte von Wiederaufbau über Flüchtlingsbewegungen bis hin zu neuem internationalen Recht, die aus den beschriebenen Operationen resultieren.",
    lesson: "Lerneffekt: {{source}} extrahiert, welche diplomatischen, humanitären oder militärischen Strategien in der geschilderten Lage funktionierten und welche Eskalationsmuster künftig vermieden werden sollten.",
    parallels: "Parallelen heute: {{source}} legt offen, wie Narrative und Erfahrungen aus \"{{title}}\" in aktuelle Kriege, Friedensmissionen oder Rüstungsdebatten hineinwirken."
  },
  {
    keywords: ["kolon", "imperium", "reich", "expansion", "mission", "kolonie", "imperial"],
    impact: "Auswirkungen (Kolonialordnung): {{source}} beleuchtet anhand von \"{{title}}\" , wie {{detail}} Machtprojektion, Ausbeutung und Wissensproduktion in kolonialen Strukturen verankerte.",
    consequences: "Folgen (Nachwirkungen): {{source}} verfolgt Grenzziehungen, ökonomische Abhängigkeiten und Erinnerungspolitiken, die weit über das Ende des Kolonialismus hinaus bestehen bleiben.",
    lesson: "Lerneffekt: {{source}} extrahiert Reform- und Wiedergutmachungsansätze, die Gerechtigkeit fördern können, und zeigt, wo vorschnelle Narrative koloniale Blindflecken reproduzieren.",
    parallels: "Parallelen heute: {{source}} verbindet koloniale Kontinuitäten mit Debatten über globale Lieferketten, Restitution und geopolitische Spannungen und zieht Linien zu aktuellen Konflikten."
  },
  {
    keywords: ["wahl", "partei", "demokr", "regierung", "kanzler", "bundestag", "parlament", "präsident"],
    impact: "Auswirkungen (Politikbetrieb): {{source}} zeigt, wie \"{{title}}\" mit den beschriebenen Entwicklungen – {{detail}} – Machtverhältnisse neu sortiert und Reformstau oder Bewegungen offenlegt.",
    consequences: "Folgen (Regelwerk): {{source}} verfolgt Gesetzespakete, Koalitionswechsel und gesellschaftliche Erwartungen, die aus diesem politischen Schwenk hervorgehen.",
    lesson: "Lerneffekt: {{source}} erklärt, welche Kommunikations- und Beteiligungsstrategien Vertrauen schaffen und wo Institutionen widerstandsfähiger werden müssen, wenn Situationen wie in \"{{title}}\" auftreten.",
    parallels: "Parallelen heute: {{source}} zieht Linien zu aktuellen Wahlkämpfen, Populismusdebatten und Fragen nach repräsentativer Legitimation und nutzt die Erkenntnisse aus \"{{title}}\" als Bezugsrahmen."
  },
  {
    keywords: ["literatur", "kultur", "kunst", "schriftsteller", "autor", "lyrik", "theater", "musik", "film"],
    impact: "Auswirkungen (Kultur): {{source}} analysiert, wie \"{{title}}\" – konkret {{detail}} – ästhetische Strömungen, Subkulturen und kulturelle Identität prägt.",
    consequences: "Folgen (Kanon): {{source}} beschreibt Kanonbildungen, Förderstrukturen und internationale Rezeption, die aus dem künstlerischen Impuls hervorgehen.",
    lesson: "Lerneffekt: {{source}} zeigt, wie künstlerische Experimente gesellschaftliche Selbstbilder hinterfragen und neue Ausdrucksformen etablieren – ein Kernmotiv der Analyse von \"{{title}}\".",
    parallels: "Parallelen heute: {{source}} verknüpft das Motiv mit Debatten zu kultureller Aneignung, digitalen Plattformen oder Popkultur und leitet konkrete Handlungsimpulse für heutige Kulturschaffende ab."
  },
  {
    keywords: ["wirtschaft", "industrie", "markt", "arbeit", "finanz", "innovation", "technologie", "unternehmen"],
    impact: "Auswirkungen (Ökonomie): {{source}} erklärt, wie \"{{title}}\" und die beschriebenen Entwicklungen – {{detail}} – Lieferketten, Arbeitsmärkte und Wohlstandserwartungen neu justieren.",
    consequences: "Folgen (Steuerung): {{source}} zeigt Investitionswellen, Krisenprävention oder Regulierungen, die aus dem wirtschaftlichen Impuls folgen und benennt Gewinner wie Verlierer.",
    lesson: "Lerneffekt: {{source}} destilliert Best Practices für Innovationspolitik, soziale Abfederung und strategische Unabhängigkeit, die direkt aus den im Artikel diskutierten Erfahrungen hervorgehen.",
    parallels: "Parallelen heute: {{source}} verbindet historische Konjunkturen mit aktuellen Diskussionen über Resilienz, KI oder Transformationsfonds und nutzt \"{{title}}\" als Argumentationsbasis."
  },
  {
    keywords: ["gesellschaft", "bewegung", "protest", "gerechtigkeit", "frauen", "rechte", "bildung", "sozial"],
    impact: "Auswirkungen (Gesellschaft): {{source}} zeigt, wie \"{{title}}\" mit den beschriebenen Dynamiken – {{detail}} – Normen, Rollenbilder und Teilhaberechte verschiebt.",
    consequences: "Folgen (Strukturen): {{source}} dokumentiert Reformen, Netzwerke und kulturelle Lernprozesse, die aus dem zivilgesellschaftlichen Druck entstehen.",
    lesson: "Lerneffekt: {{source}} erklärt, wie Beharrlichkeit, Bündnisse und strategische Kommunikation strukturellen Wandel ermöglichen und welche Stolpersteine aus \"{{title}}\" abzuleiten sind.",
    parallels: "Parallelen heute: {{source}} spiegelt die Forderungen in aktuellen Bewegungen für Klimaschutz, Gleichstellung oder digitale Rechte an den Erfahrungen, die in \"{{title}}\" sichtbar werden."
  },
  {
    keywords: ["klima", "umwelt", "natur", "ressource", "energie", "planet", "oekologie", "umwelt"],
    impact: "Auswirkungen (Umwelt): {{source}} analysiert, wie \"{{title}}\" mit den geschilderten Befunden – {{detail}} – Ökosysteme, Infrastruktur und Risikowahrnehmung verändert.",
    consequences: "Folgen (Lebenswelten): {{source}} beschreibt Gesetzgebung, technologische Innovationen und soziale Bewegungen, die als Antwort auf ökologische Krisen entstehen.",
    lesson: "Lerneffekt: {{source}} zeigt, welche Governance-Modelle Klimaanpassung, Nachhaltigkeit und Gerechtigkeit miteinander verbinden können und leitet Empfehlungen direkt aus \"{{title}}\" ab.",
    parallels: "Parallelen heute: {{source}} verknüpft historische Umweltkonflikte mit aktuellen Klimagipfeln, Energiekrisen oder Transformationsstrategien und nutzt das Beispiel aus \"{{title}}\" als Argumentationsanker."
  }
];

const DEFAULT_HISTORY_THEME = {
  impact: "Auswirkungen (Kontext): {{source}} ordnet \"{{title}}\" und die beschriebenen Entwicklungen – {{detail}} – im größeren historischen Kontext ein und zeigt, welche Institutionen, Regionen oder Milieus unmittelbar betroffen waren.",
  consequences: "Folgen (Zeithorizont): {{source}} zeichnet nach, welche politischen Beschlüsse, ökonomischen Trends oder kulturellen Narrative langfristig bestehen blieben.",
  lesson: "Lerneffekt: {{source}} extrahiert Prinzipien für strategisches Handeln, Risikobewertung und Resilienz, die sich aus der Fallstudie ableiten lassen.",
  parallels: "Parallelen heute: {{source}} zieht Bezüge zu aktuellen Entwicklungen und lädt dazu ein, Gegenwartspolitik im Spiegel der Vergangenheit zu reflektieren – immer mit Blick auf die konkreten Lehren aus \"{{title}}\"."
};

function fillTemplate(template, replacements) {
  return template
    .replace(/{{source}}/g, replacements.source)
    .replace(/{{detail}}/g, replacements.detail)
    .replace(/{{title}}/g, replacements.title);
}

function selectHistoryTheme(detail, title) {
  const haystack = `${title} ${detail}`.toLowerCase();
  for (const theme of HISTORY_LEARNING_THEMES) {
    if (theme.keywords.some((keyword) => haystack.includes(keyword))) {
      return theme;
    }
  }
  return DEFAULT_HISTORY_THEME;
}

function buildLearningNarrative(baseSummary, sourceLabel, title) {
  const detail = baseSummary || `Der Beitrag "${title}" beleuchtet ein Schlüsselereignis der Zeitgeschichte.`;
  const theme = selectHistoryTheme(detail, title);
  const context = { source: sourceLabel, detail, title };

  return [
    `Ereignis: ${detail}`,
    fillTemplate(theme.impact, context),
    fillTemplate(theme.consequences, context),
    fillTemplate(theme.lesson, context),
    fillTemplate(theme.parallels, context)
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
  const dateToken = (publishedIso.slice(0, 10) || "undated").replace(/-/g, "");
  const link = item.link || item.guid || "https://www.zeit.de/geschichte";
  const narrative = buildLearningNarrative(baseSummary, source.label, title);

  return {
    id: `history-${source.id}-${slug}-${dateToken}`,
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
  const sortedExternal = [...externalArticles].sort((a, b) => {
    const dateA = new Date(a.publishedAt || 0).getTime();
    const dateB = new Date(b.publishedAt || 0).getTime();
    return dateB - dateA;
  });
  const combinedHistory = sortedExternal.length ? sortedExternal : historyItems;

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
