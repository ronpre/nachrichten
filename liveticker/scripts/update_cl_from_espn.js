#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.resolve(process.cwd(), 'liveticker/public/data/cl-football-data.json');
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard';
const TEAM_NAME_STOP_WORDS = new Set([
  'club',
  'de',
  'del',
  'la',
  'el',
  'cf',
  'fc',
  'cd',
  'sd',
  'ud',
  'rcd',
  'ac',
  'sc',
  'ad',
  'fk',
  'nk',
  'sk',
  'if',
  'bk',
  'kv',
  'pae',
  'ssc',
  'balompie',
  'futbol',
  'deportivo'
]);
const TEAM_NAME_TOKEN_SYNONYMS = new Map([
  ['milano', 'milan'],
  ['internazionale', 'inter'],
  ['munchen', 'munich'],
  ['muenchen', 'munich'],
  ['olympiakos', 'olympiacos'],
  ['beograd', 'belgrade'],
  ['paphos', 'pafos']
]);

function normalizeToIsoDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeTeamName(value) {
  if (!value) {
    return '';
  }
  const ascii = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase();
  const tokens = ascii.split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) {
    return ascii.replace(/[^a-z0-9]+/g, '');
  }
  const remapped = tokens
    .map((token) => TEAM_NAME_TOKEN_SYNONYMS.get(token) || token)
    .filter((token) => token && token.trim().length);
  const filtered = remapped.filter((token) => !TEAM_NAME_STOP_WORDS.has(token));
  const candidates = filtered.length ? filtered : remapped;
  return candidates.join('');
}

function buildIdentity(homeName, awayName, isoDate) {
  const normalizedDate = normalizeToIsoDate(isoDate);
  if (!normalizedDate) {
    return null;
  }
  const homeKey = normalizeTeamName(homeName);
  const awayKey = normalizeTeamName(awayName);
  if (!homeKey || !awayKey) {
    return null;
  }
  return `${normalizedDate}|${homeKey}|${awayKey}`;
}

function collectTeamNameCandidates(team) {
  if (!team) {
    return [];
  }
  const rawValues = [
    team.name,
    team.shortName,
    team.shortDisplayName,
    team.displayName,
    team.nickname,
    team.tla,
    team.abbreviation
  ];
  if (team.id != null) {
    rawValues.push(String(team.id));
  }

  const addSegments = (value, push) => {
    const segments = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (segments.length > 1) {
      push(segments[segments.length - 1]);
      push(segments[0]);
    }
  };

  const candidates = [];
  const seen = new Set();
  const push = (entry) => {
    if (!entry) {
      return;
    }
    const lower = entry.toLowerCase();
    if (seen.has(lower)) {
      return;
    }
    seen.add(lower);
    candidates.push(entry);
  };

  rawValues.forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    push(trimmed);
    addSegments(trimmed, push);
  });

  return candidates;
}

function buildMatchLookup(matches) {
  const lookup = new Map();
  matches.forEach((match) => {
    const isoDate = normalizeToIsoDate(match.isoDate || match.utcDate);
    if (!isoDate) {
      return;
    }
    const homeCandidates = collectTeamNameCandidates(match.homeTeam || {});
    const awayCandidates = collectTeamNameCandidates(match.awayTeam || {});
    if (!homeCandidates.length || !awayCandidates.length) {
      return;
    }
    homeCandidates.forEach((homeName) => {
      awayCandidates.forEach((awayName) => {
        const identity = buildIdentity(homeName, awayName, isoDate);
        if (!identity) {
          return;
        }
        if (!lookup.has(identity)) {
          lookup.set(identity, []);
        }
        const bucket = lookup.get(identity);
        if (!bucket.includes(match)) {
          bucket.push(match);
        }
      });
    });
  });
  return lookup;
}

function needsScoreUpdate(match) {
  const homeScore = parseScoreValue(match?.score?.fullTime?.home);
  const awayScore = parseScoreValue(match?.score?.fullTime?.away);
  const status = typeof match?.status === 'string' ? match.status.toUpperCase() : '';
  return !(Number.isFinite(homeScore) && Number.isFinite(awayScore) && (status === 'FINISHED' || status === 'AWARDED'));
}

function parseScoreValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

async function fetchScoreboard(isoDate) {
  const params = new URLSearchParams({ lang: 'de', region: 'de' });
  if (isoDate) {
    params.set('dates', isoDate.replace(/-/g, ''));
  }
  const url = `${ESPN_BASE}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ESPN request failed (${response.status})`);
  }
  return response.json();
}

function extractCompletedMatches(scoreboard) {
  if (!scoreboard || !Array.isArray(scoreboard.events)) {
    return [];
  }
  const matches = [];
  scoreboard.events.forEach((event) => {
    const competition = Array.isArray(event?.competitions) ? event.competitions[0] : null;
    if (!competition) {
      return;
    }
    const state = competition?.status?.type?.state;
    if (state !== 'post') {
      return;
    }
    const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];
    const home = competitors.find((entry) => entry.homeAway === 'home') || competitors[0];
    const away = competitors.find((entry) => entry.homeAway === 'away') || competitors[1];
    if (!home || !away) {
      return;
    }
    const isoDate = normalizeToIsoDate(competition.date || competition.startDate || event.date);
    const homeCandidates = collectTeamNameCandidates(home.team || {});
    const awayCandidates = collectTeamNameCandidates(away.team || {});
    if (!homeCandidates.length) {
      homeCandidates.push(home.team?.shortDisplayName || home.team?.displayName || home.team?.name || '');
    }
    if (!awayCandidates.length) {
      awayCandidates.push(away.team?.shortDisplayName || away.team?.displayName || away.team?.name || '');
    }
    const sanitizedHome = homeCandidates.filter(Boolean);
    const sanitizedAway = awayCandidates.filter(Boolean);
    matches.push({
      isoDate,
      homeCandidates: sanitizedHome,
      awayCandidates: sanitizedAway,
      displayHome: sanitizedHome[0] || home.team?.displayName || home.team?.shortDisplayName || 'Heim',
      displayAway: sanitizedAway[0] || away.team?.displayName || away.team?.shortDisplayName || 'Gast',
      homeScore: parseScoreValue(home.score),
      awayScore: parseScoreValue(away.score)
    });
  });
  return matches;
}

function resolveGameMatches(game, fallbackIsoDate, lookup) {
  const isoDate = normalizeToIsoDate(game.isoDate || fallbackIsoDate);
  if (!isoDate) {
    return null;
  }
  const homeNames = Array.isArray(game.homeCandidates) ? game.homeCandidates : [];
  const awayNames = Array.isArray(game.awayCandidates) ? game.awayCandidates : [];
  for (const homeName of homeNames) {
    for (const awayName of awayNames) {
      const identity = buildIdentity(homeName, awayName, isoDate);
      if (!identity) {
        continue;
      }
      const matchesForIdentity = lookup.get(identity);
      if (matchesForIdentity?.length) {
        return { identity, matches: matchesForIdentity };
      }
    }
  }
  return null;
}

async function main() {
  const raw = await readFile(DATA_FILE, 'utf8');
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload.matches)) {
    throw new Error('Ungültiges Champions-League-Datenformat');
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const pendingMatches = payload.matches.filter((match) => {
    const isoDate = normalizeToIsoDate(match.isoDate || match.utcDate);
    if (isoDate && isoDate > todayIso) {
      return false;
    }
    return needsScoreUpdate(match);
  });

  if (!pendingMatches.length) {
    console.log('Keine offenen Begegnungen zu aktualisieren.');
    return;
  }

  const pendingDates = Array.from(
    new Set(
      pendingMatches
        .map((match) => normalizeToIsoDate(match.isoDate || match.utcDate))
        .filter((isoDate) => isoDate && isoDate <= todayIso)
    )
  ).sort();

  if (!pendingDates.length) {
    console.log('Alle offenen Begegnungen liegen in der Zukunft.');
    return;
  }

  const lookup = buildMatchLookup(payload.matches);
  let updates = 0;
  const unresolved = [];

  for (const isoDate of pendingDates) {
    let scoreboard;
    try {
      scoreboard = await fetchScoreboard(isoDate);
    } catch (error) {
      console.error(`Fehler beim Abruf der ESPN-Daten für ${isoDate}:`, error.message);
      continue;
    }
    const completed = extractCompletedMatches(scoreboard);
    completed.forEach((game) => {
      if (!Number.isFinite(game.homeScore) || !Number.isFinite(game.awayScore)) {
        return;
      }
      const resolved = resolveGameMatches(game, isoDate, lookup);
      if (!resolved) {
        unresolved.push({ isoDate: game.isoDate || isoDate, home: game.displayHome, away: game.displayAway });
        return;
      }
      resolved.matches.forEach((match) => {
        if (!needsScoreUpdate(match)) {
          return;
        }
        match.status = 'FINISHED';
        match.score = match.score || {};
        match.score.fullTime = match.score.fullTime || {};
        match.score.fullTime.home = game.homeScore;
        match.score.fullTime.away = game.awayScore;
        updates += 1;
      });
    });
  }

  if (!updates) {
    console.log('Keine Aktualisierungen vorgenommen.');
    if (unresolved.length) {
      console.warn(`Keine Zuordnung für ${unresolved.length} Begegnungen gefunden.`);
    }
    return;
  }

  payload.generatedAt = new Date().toISOString();
  await writeFile(DATA_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Aktualisiert ${updates} Begegnungen in ${path.relative(process.cwd(), DATA_FILE)}.`);
  if (unresolved.length) {
    console.warn(`Hinweis: ${unresolved.length} Begegnungen konnten nicht gematcht werden.`);
    unresolved.slice(0, 5).forEach((entry) => {
      console.warn(` - ${entry.isoDate}: ${entry.home} vs ${entry.away}`);
    });
  }
}

main().catch((error) => {
  console.error('Unerwarteter Fehler:', error);
  process.exitCode = 1;
});
