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
const HISTORY_LESSON_LIMIT = 6;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const HISTORICAL_KEYWORDS = [
  "geschichte",
  "historisch",
  "historiker",
  "jahrhundert",
  "jahrtausend",
  "antike",
  "mittelalter",
  "renaissance",
  "reformation",
  "kaiserreich",
  "dynastie",
  "imperium",
  "kolonie",
  "kolonial",
  "revolution",
  "aufstand",
  "weltkrieg",
  "krieg",
  "friedensschluss",
  "mauer",
  "ddr",
  "rom",
  "römer",
  "athen",
  "perser",
  "wikinger",
  "pharao",
  "bibel",
  "antik",
  "archäolog",
  "chronik"
];

const ERA_TOKENS = ["v. chr", "vor christus", "n. chr", "nach christus", "bc", "ad"];
const MIN_HISTORICAL_SCORE = 3;
const CENTURY_REGEX = /\b\d{1,2}\.?\s*jahrhundert\b/i;

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
    id: "religion",
    label: "Religionskonflikte",
    topic: "Glauben & Identität",
    keywords: ["islam", "religion", "moschee", "kirche", "kopftuch", "glauben", "theolog"],
    impact:
      "Auswirkungen: {{source}} nutzt \"{{title}}\" als Fallstudie und zeigt anhand von {{detail}}, wie Religionspolitik, Schulalltag und Minderheitenschutz neu austariert werden – inklusive der Institutionen, die sofort reagieren müssen.",
    consequences:
      "Folgen: {{source}} verfolgt Gerichtsverfahren, Gesetzesinitiativen und gesellschaftliche Allianzen, die langfristig aus diesem Streit um Glaubensfreiheit und staatliche Neutralität erwachsen.",
    lesson:
      "Lerneffekt: {{source}} arbeitet heraus, dass tragfähige Integrationskonzepte Transparenz, Schutz vor Extremismus und Räume für pluralistische Spiritualität brauchen – eine Erkenntnis, die die Analyse von \"{{title}}\" untermauert.",
    parallels:
      "Parallelen heute: {{source}} verbindet Debatten über religiöse Symbole, Moscheefinanzierung und Schulpolitik mit aktuellen Auseinandersetzungen um Demokratie und sozialen Frieden und stellt explizit Verknüpfungen zu \"{{title}}\" her.",
    reflection:
      "Reflexion: Wo kollidieren Freiheitsrechte heute mit Sicherheitsinteressen – und was lässt sich aus \"{{title}}\" für einen fairen Ausgleich lernen?"
  },
  {
    id: "konflikt",
    label: "Konflikte & Sicherheit",
    topic: "Krisen & Waffenstillstände",
    keywords: ["krieg", "konflikt", "milit", "front", "waffe", "soldat", "angriff", "besatzung"],
    impact:
      "Auswirkungen: {{source}} beschreibt, wie \"{{title}}\" – konkret {{detail}} – Kräfteverhältnisse, Bündnisse und Sicherheitsarchitekturen verschiebt und welche Akteure Terrain gewinnen oder verlieren.",
    consequences:
      "Folgen: {{source}} verfolgt Effekte von Wiederaufbau über Flüchtlingsbewegungen bis hin zu neuem internationalen Recht, die aus den beschriebenen Operationen resultieren.",
    lesson:
      "Lerneffekt: {{source}} extrahiert, welche diplomatischen, humanitären oder militärischen Strategien in der geschilderten Lage funktionierten und welche Eskalationsmuster künftig vermieden werden sollten.",
    parallels:
      "Parallelen heute: {{source}} legt offen, wie Narrative und Erfahrungen aus \"{{title}}\" in aktuelle Kriege, Friedensmissionen oder Rüstungsdebatten hineinwirken.",
    reflection:
      "Reflexion: Welche roten Linien sollten Entscheidungsträger heute ziehen, um die Fehler aus \"{{title}}\" nicht zu wiederholen?"
  },
  {
    id: "kolonial",
    label: "Kolonialerbe",
    topic: "Imperien & Erinnerung",
    keywords: ["kolon", "imperium", "reich", "expansion", "mission", "kolonie", "imperial"],
    impact:
      "Auswirkungen: {{source}} beleuchtet anhand von \"{{title}}\", wie {{detail}} Machtprojektion, Ausbeutung und Wissensproduktion in kolonialen Strukturen verankerte.",
    consequences:
      "Folgen: {{source}} verfolgt Grenzziehungen, ökonomische Abhängigkeiten und Erinnerungspolitiken, die weit über das Ende des Kolonialismus hinaus bestehen bleiben.",
    lesson:
      "Lerneffekt: {{source}} extrahiert Reform- und Wiedergutmachungsansätze, die Gerechtigkeit fördern können, und zeigt, wo vorschnelle Narrative koloniale Blindflecken reproduzieren.",
    parallels:
      "Parallelen heute: {{source}} verbindet koloniale Kontinuitäten mit Debatten über globale Lieferketten, Restitution und geopolitische Spannungen und zieht Linien zu aktuellen Konflikten.",
    reflection:
      "Reflexion: Welche Verantwortung tragen heutige Institutionen für koloniale Kontinuitäten, die in \"{{title}}\" sichtbar werden?"
  },
  {
    id: "politik",
    label: "Demokratien",
    topic: "Politik & Institutionen",
    keywords: ["wahl", "partei", "demokr", "regierung", "kanzler", "bundestag", "parlament", "präsident"],
    impact:
      "Auswirkungen: {{source}} zeigt, wie \"{{title}}\" mit den beschriebenen Entwicklungen – {{detail}} – Machtverhältnisse neu sortiert und Reformstau oder Bewegungen offenlegt.",
    consequences:
      "Folgen: {{source}} verfolgt Gesetzespakete, Koalitionswechsel und gesellschaftliche Erwartungen, die aus diesem politischen Schwenk hervorgehen.",
    lesson:
      "Lerneffekt: {{source}} erklärt, welche Kommunikations- und Beteiligungsstrategien Vertrauen schaffen und wo Institutionen widerstandsfähiger werden müssen, wenn Situationen wie in \"{{title}}\" auftreten.",
    parallels:
      "Parallelen heute: {{source}} zieht Linien zu aktuellen Wahlkämpfen, Populismusdebatten und Fragen nach repräsentativer Legitimation und nutzt die Erkenntnisse aus \"{{title}}\" als Bezugsrahmen.",
    reflection:
      "Reflexion: Welche demokratischen Werkzeuge würdest du einsetzen, um ähnliche Spannungen wie in \"{{title}}\" zu entschärfen?"
  },
  {
    id: "kultur",
    label: "Kultur & Erinnerung",
    topic: "Kunst & Identität",
    keywords: ["literatur", "kultur", "kunst", "schriftsteller", "autor", "lyrik", "theater", "musik", "film"],
    impact:
      "Auswirkungen: {{source}} analysiert, wie \"{{title}}\" – konkret {{detail}} – ästhetische Strömungen, Subkulturen und kulturelle Identität prägt.",
    consequences:
      "Folgen: {{source}} beschreibt Kanonbildungen, Förderstrukturen und internationale Rezeption, die aus dem künstlerischen Impuls hervorgehen.",
    lesson:
      "Lerneffekt: {{source}} zeigt, wie künstlerische Experimente gesellschaftliche Selbstbilder hinterfragen und neue Ausdrucksformen etablieren – ein Kernmotiv der Analyse von \"{{title}}\".",
    parallels:
      "Parallelen heute: {{source}} verknüpft das Motiv mit Debatten zu kultureller Aneignung, digitalen Plattformen oder Popkultur und leitet konkrete Handlungsimpulse für heutige Kulturschaffende ab.",
    reflection:
      "Reflexion: Wo entdeckst du heute künstlerische Strategien, die ähnlich unbequem sind wie die in \"{{title}}\" beschriebenen?"
  },
  {
    id: "wirtschaft",
    label: "Ökonomie",
    topic: "Wirtschaft & Wandel",
    keywords: ["wirtschaft", "industrie", "markt", "arbeit", "finanz", "innovation", "technologie", "unternehmen"],
    impact:
      "Auswirkungen: {{source}} erklärt, wie \"{{title}}\" und die beschriebenen Entwicklungen – {{detail}} – Lieferketten, Arbeitsmärkte und Wohlstandserwartungen neu justieren.",
    consequences:
      "Folgen: {{source}} zeigt Investitionswellen, Krisenprävention oder Regulierungen, die aus dem wirtschaftlichen Impuls folgen und benennt Gewinner wie Verlierer.",
    lesson:
      "Lerneffekt: {{source}} destilliert Best Practices für Innovationspolitik, soziale Abfederung und strategische Unabhängigkeit, die direkt aus den im Artikel diskutierten Erfahrungen hervorgehen.",
    parallels:
      "Parallelen heute: {{source}} verbindet historische Konjunkturen mit aktuellen Diskussionen über Resilienz, KI oder Transformationsfonds und nutzt \"{{title}}\" als Argumentationsbasis.",
    reflection:
      "Reflexion: Welche wirtschaftspolitischen Leitplanken wären heute nötig, um ähnliche Fehlentwicklungen wie in \"{{title}}\" zu vermeiden?"
  },
  {
    id: "gesellschaft",
    label: "Gesellschaft",
    topic: "Zivilgesellschaft & Rechte",
    keywords: ["gesellschaft", "bewegung", "protest", "gerechtigkeit", "frauen", "rechte", "bildung", "sozial"],
    impact:
      "Auswirkungen: {{source}} zeigt, wie \"{{title}}\" mit den beschriebenen Dynamiken – {{detail}} – Normen, Rollenbilder und Teilhaberechte verschiebt.",
    consequences:
      "Folgen: {{source}} dokumentiert Reformen, Netzwerke und kulturelle Lernprozesse, die aus dem zivilgesellschaftlichen Druck entstehen.",
    lesson:
      "Lerneffekt: {{source}} erklärt, wie Beharrlichkeit, Bündnisse und strategische Kommunikation strukturellen Wandel ermöglichen und welche Stolpersteine aus \"{{title}}\" abzuleiten sind.",
    parallels:
      "Parallelen heute: {{source}} spiegelt die Forderungen in aktuellen Bewegungen für Klimaschutz, Gleichstellung oder digitale Rechte an den Erfahrungen, die in \"{{title}}\" sichtbar werden.",
    reflection:
      "Reflexion: Welche heutigen Bewegungen greifen Strategien auf, die \"{{title}}\" bereits vorgedacht hat?"
  },
  {
    id: "klima",
    label: "Klima & Umwelt",
    topic: "Ökologie & Zukunft",
    keywords: ["klima", "umwelt", "natur", "ressource", "energie", "planet", "oekologie", "umwelt"],
    impact:
      "Auswirkungen: {{source}} analysiert, wie \"{{title}}\" mit den geschilderten Befunden – {{detail}} – Ökosysteme, Infrastruktur und Risikowahrnehmung verändert.",
    consequences:
      "Folgen: {{source}} beschreibt Gesetzgebung, technologische Innovationen und soziale Bewegungen, die als Antwort auf ökologische Krisen entstehen.",
    lesson:
      "Lerneffekt: {{source}} zeigt, welche Governance-Modelle Klimaanpassung, Nachhaltigkeit und Gerechtigkeit miteinander verbinden können und leitet Empfehlungen direkt aus \"{{title}}\" ab.",
    parallels:
      "Parallelen heute: {{source}} verknüpft historische Umweltkonflikte mit aktuellen Klimagipfeln, Energiekrisen oder Transformationsstrategien und nutzt das Beispiel aus \"{{title}}\" als Argumentationsanker.",
    reflection:
      "Reflexion: Welche lokalen Entscheidungen könntest du beeinflussen, um die in \"{{title}}\" beschriebenen Umweltfolgen zu begrenzen?"
  }
];

const DEFAULT_REFLECTION =
  "Reflexion: Welche Linien lassen sich von \"{{title}}\" zu aktuellen Entscheidungen ziehen – und was würdest du heute anders machen?";

const DEFAULT_HISTORY_THEME = {
  id: "zeitgeschichte",
  label: "Zeitgeschichte",
  topic: "Historische Perspektive",
  impact:
    "Auswirkungen: {{source}} ordnet \"{{title}}\" und die beschriebenen Entwicklungen – {{detail}} – im größeren historischen Kontext ein und zeigt, welche Institutionen, Regionen oder Milieus unmittelbar betroffen waren.",
  consequences:
    "Folgen: {{source}} zeichnet nach, welche politischen Beschlüsse, ökonomischen Trends oder kulturellen Narrative langfristig bestehen blieben.",
  lesson:
    "Lerneffekt: {{source}} extrahiert Prinzipien für strategisches Handeln, Risikobewertung und Resilienz, die sich aus der Fallstudie ableiten lassen.",
  parallels:
    "Parallelen heute: {{source}} zieht Bezüge zu aktuellen Entwicklungen und lädt dazu ein, Gegenwartspolitik im Spiegel der Vergangenheit zu reflektieren – immer mit Blick auf die konkreten Lehren aus \"{{title}}\".",
  reflection: DEFAULT_REFLECTION
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

function extendWithDetail(baseText = "", detailSentence = "", prefix = "") {
  const trimmedBase = baseText.trim();
  if (!detailSentence) return trimmedBase;
  const normalizedBase = trimmedBase.toLowerCase();
  const normalizedDetail = detailSentence.toLowerCase();
  if (normalizedBase.includes(normalizedDetail)) {
    return trimmedBase;
  }
  const addition = prefix ? `${prefix} ${detailSentence}` : detailSentence;
  return `${trimmedBase} ${addition}`.trim();
}

function extractNumericYears(text = "") {
  const currentYear = new Date().getFullYear();
  const matches = text.matchAll(/\b(\d{3,4})\b/g);
  const years = [];
  for (const match of matches) {
    const year = Number(match[1]);
    if (Number.isNaN(year)) continue;
    if (year < 1 || year > currentYear) continue;
    years.push(year);
  }
  return [...new Set(years)];
}

function mentionsEraTokens(text = "") {
  const haystack = text.toLowerCase();
  return ERA_TOKENS.some((token) => haystack.includes(token));
}

function computeHistoricalScore(article) {
  const haystack = `${article.title || ""} ${article.summary || ""}`.toLowerCase();
  let score = 0;
  const years = extractNumericYears(haystack);
  const currentYear = new Date().getFullYear();

  for (const year of years) {
    if (year <= currentYear - 30) score += 3;
    else if (year <= currentYear - 5) score += 1;
    if (year < 1900) score += 1;
    if (year < 1500) score += 1;
  }

  if (CENTURY_REGEX.test(haystack)) score += 2;
  if (mentionsEraTokens(haystack)) score += 2;

  for (const keyword of HISTORICAL_KEYWORDS) {
    if (haystack.includes(keyword)) score += 1;
  }

  return score;
}

function isHistoricalArticle(article) {
  const score = computeHistoricalScore(article);
  article.historicalScore = score;
  return score >= MIN_HISTORICAL_SCORE;
}

function extractFirstSentence(text = "") {
  const sanitized = text.trim();
  if (!sanitized) return "";
  const sentenceMatch = sanitized.match(/.+?(?:[.!?](?:\s|$)|$)/);
  const sentence = (sentenceMatch ? sentenceMatch[0] : sanitized).trim();
  return sentence.length > 220 ? `${sentence.slice(0, 217)}…` : sentence;
}

function buildCoreQuestion(title, topic) {
  return `Wie verändert "${title}" deinen Blick auf ${topic}?`;
}

function buildQuizPrompt(title, sourceLabel) {
  return `Welchen Wendepunkt beschreibt ${sourceLabel} in Bezug auf "${title}"?`;
}

function computeReinforceAfter(referenceIso) {
  const base = referenceIso ? new Date(referenceIso) : new Date();
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(safeBase.getTime() + 3 * MS_IN_DAY).toISOString();
}

function formatTimelineLabel(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function buildTimelineMeta({ title, year, publishedAt }) {
  if (typeof year === "number" && Number.isFinite(year)) {
    return {
      label: `Jahr ${year}`,
      detail: title.replace(/^\d{4}:\s*/, "")
    };
  }
  const formatted = formatTimelineLabel(publishedAt);
  if (formatted) {
    return {
      label: formatted,
      detail: title.replace(/^[^:]+:\s*/, "")
    };
  }
  return {
    label: "Zeitfenster",
    detail: title
  };
}

function buildLessonBlueprint(baseSummary, sourceLabel, title, publishedAt) {
  const detail = baseSummary || `Der Beitrag "${title}" beleuchtet ein Schlüsselereignis der Zeitgeschichte.`;
  const theme = selectHistoryTheme(detail, title);
  const context = { source: sourceLabel, detail, title };
  const reflectionTemplate = theme.reflection || DEFAULT_REFLECTION;
  const sparkSentence = extractFirstSentence(detail);
  const detailSentence = sparkSentence || extractFirstSentence(detail);

  const applicationText = extendWithDetail(
    fillTemplate(theme.lesson || DEFAULT_HISTORY_THEME.lesson, context),
    detailSentence,
    "Praxis heute:"
  );

  const transferText = extendWithDetail(
    fillTemplate(theme.parallels || DEFAULT_HISTORY_THEME.parallels, context),
    detailSentence,
    "Parallele heute:"
  );

  const reflectionText = extendWithDetail(
    fillTemplate(reflectionTemplate, context),
    detailSentence,
    "Merke dir:"
  );

  return {
    themeLabel: theme.label || DEFAULT_HISTORY_THEME.label,
    topic: theme.topic || DEFAULT_HISTORY_THEME.topic,
    spark: sparkSentence,
    coreQuestion: buildCoreQuestion(title, theme.topic || DEFAULT_HISTORY_THEME.topic),
    insight: fillTemplate(theme.impact || DEFAULT_HISTORY_THEME.impact, context),
    application: applicationText,
    transfer: transferText,
    reflection: reflectionText,
    quizPrompt: buildQuizPrompt(title, sourceLabel),
    reinforceAfter: computeReinforceAfter(publishedAt)
  };
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

function normalizeExternalArticle(item, source) {
  if (!item || !source) return null;
  const title = sanitizeText(item.title || "Historischer Kontext");
  if (!title) return null;
  const summary = sanitizeText(
    item.contentSnippet || item.content || item.summary || item.description || "Analyse und Hintergrund aus den Leitmedien."
  );
  const slug = slugify(`${source.id}-${title}`);
  const rawPublished = item.isoDate || item.pubDate || new Date().toISOString();
  const publishedDate = new Date(rawPublished);
  const publishedIso = Number.isNaN(publishedDate.getTime()) ? new Date().toISOString() : publishedDate.toISOString();
  const dateToken = (publishedIso.slice(0, 10) || "undated").replace(/-/g, "");
  const link = item.link || item.guid || "https://www.zeit.de/geschichte";

  return {
    idBase: `history-${source.id}-${slug}`,
    title,
    summary,
    link,
    source: source.label,
    publishedAt: publishedIso,
    dateToken
  };
}

function buildLessonFromArticle(article) {
  if (!article) return null;
  const blueprint = buildLessonBlueprint(article.summary, article.source, article.title, article.publishedAt);
  return {
    id: `${article.idBase}-${article.dateToken}`,
    title: article.title,
    topic: blueprint.topic,
    themeLabel: blueprint.themeLabel,
    source: article.source,
    link: article.link,
    publishedAt: article.publishedAt,
    spark: blueprint.spark,
    coreQuestion: blueprint.coreQuestion,
    insight: blueprint.insight,
    application: blueprint.application,
    transfer: blueprint.transfer,
    reflection: blueprint.reflection,
    quizPrompt: blueprint.quizPrompt,
    timeline: buildTimelineMeta({ title: article.title, publishedAt: article.publishedAt }),
    reinforceAfter: blueprint.reinforceAfter
  };
}

function buildLessonFromHistoricalEvent(event) {
  if (!event) return null;
  const summary = sanitizeText(event.summary || event.paragraphs?.[0] || "Historischer Kontext");
  const blueprint = buildLessonBlueprint(summary, event.source || HISTORY_SOURCE, event.title, event.publishedAt);
  return {
    id: `${event.id}-lesson`,
    title: event.title,
    topic: blueprint.topic,
    themeLabel: blueprint.themeLabel,
    source: event.source || HISTORY_SOURCE,
    link: event.link,
    publishedAt: event.publishedAt,
    spark: blueprint.spark,
    coreQuestion: blueprint.coreQuestion,
    insight: blueprint.insight,
    application: blueprint.application,
    transfer: blueprint.transfer,
    reflection: blueprint.reflection,
    quizPrompt: blueprint.quizPrompt,
    timeline: buildTimelineMeta({ title: event.title, year: event.year }),
    reinforceAfter: blueprint.reinforceAfter
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
        const perFeedLimit = source.limit || 1;
        const candidateWindow = Math.min(items.length, Math.max(perFeedLimit * 5, perFeedLimit + 4));
        const normalized = items
          .slice(0, candidateWindow)
          .map((entry) => normalizeExternalArticle(entry, source))
          .filter(Boolean);
        const qualified = normalized.filter((article) => isHistoricalArticle(article));
        if (!qualified.length) {
          console.warn(
            `Hinweis: ${source.label} lieferte keine passenden historischen Artikel (Feedeinträge: ${items.length}).`
          );
        }
        return qualified.slice(0, perFeedLimit);
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

function buildHistoryLessons(externalArticles, historyItems) {
  const seen = new Set();
  const lessonsFromArticles = externalArticles
    .map((article) => buildLessonFromArticle(article))
    .filter(Boolean)
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

  const lessons = [];
  for (const lesson of lessonsFromArticles) {
    if (lessons.length >= HISTORY_LESSON_LIMIT) break;
    if (seen.has(lesson.id)) continue;
    seen.add(lesson.id);
    lessons.push(lesson);
  }

  if (lessons.length < HISTORY_LESSON_LIMIT) {
    const fallbackLessons = historyItems.map((event) => buildLessonFromHistoricalEvent(event)).filter(Boolean);
    for (const fallback of fallbackLessons) {
      if (lessons.length >= HISTORY_LESSON_LIMIT) break;
      if (seen.has(fallback.id)) continue;
      seen.add(fallback.id);
      lessons.push(fallback);
    }
  }

  return lessons;
}

async function loadExisting() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    parsed.categories = parsed.categories || { wirtschaft: [], politik: [], sport: [], history: [] };
    parsed.historyLessons = parsed.historyLessons || [];
    return parsed;
  } catch {
    return {
      updatedAt: null,
      historyUpdatedAt: null,
      historyLessons: [],
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
  const lessons = buildHistoryLessons(externalArticles, historyItems);
  const timestamp = new Date().toISOString();

  const next = {
    ...existing,
    updatedAt: timestamp,
    historyUpdatedAt: timestamp,
    historyLessons: lessons,
    categories: {
      ...existing.categories,
      history: historyItems
    }
  };

  await persist(next);
  console.log(
    `Geschichte aktualisiert (${lessons.length} Lernkarten + ${historyItems.length} On-this-day-Einträge, ${externalArticles.length} Artikelquellen).`
  );
}

updateHistory().catch((error) => {
  console.error("History-Update fehlgeschlagen", error);
  process.exitCode = 1;
});
