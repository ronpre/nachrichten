#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_DATES = ['2025-12-05', '2025-12-06'];
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard';
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
  'balompie',
  'balompié',
  'futbol',
  'fútbol',
  'deportivo'
]);

function normalizeToIsoDate(value) {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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
  const filtered = tokens.filter((token) => !TEAM_NAME_STOP_WORDS.has(token));
  const candidates = filtered.length ? filtered : tokens;
  return candidates.join('');
}

function buildIdentity(home, away, isoDate) {
  const normalizedDate = normalizeToIsoDate(isoDate);
  if (!normalizedDate) {
    return null;
  }
  const homeKey = normalizeTeamName(home);
  const awayKey = normalizeTeamName(away);
  if (!homeKey || !awayKey) {
    return null;
  }
  return `${normalizedDate}|${homeKey}|${awayKey}`;
}

async function fetchScoreboard(date) {
  const isoDate = normalizeToIsoDate(date);
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
    const homeScore = typeof home.score === 'string' ? Number.parseInt(home.score, 10) : Number(home.score);
    const awayScore = typeof away.score === 'string' ? Number.parseInt(away.score, 10) : Number(away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return;
    }
    matches.push({
      isoDate,
      homeName: home.team?.displayName || home.team?.shortDisplayName || home.team?.name,
      awayName: away.team?.displayName || away.team?.shortDisplayName || away.team?.name,
      homeScore,
      awayScore
    });
  });
  return matches;
}

async function main() {
  const targetDates = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_DATES;
  const dataPath = path.resolve(process.cwd(), 'liveticker/public/data/laliga-football-data.json');
  const raw = await readFile(dataPath, 'utf8');
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload.matches)) {
    throw new Error('payload matches missing');
  }

  const identityLookup = new Map();
  payload.matches.forEach((match) => {
    const homeName = match?.homeTeam?.name || match?.homeTeam?.shortName;
    const awayName = match?.awayTeam?.name || match?.awayTeam?.shortName;
    const identity = buildIdentity(homeName, awayName, match?.isoDate || match?.utcDate);
    if (identity) {
      identityLookup.set(identity, match);
    }
  });

  let updates = 0;
  for (const date of targetDates) {
    let scoreboard;
    try {
      scoreboard = await fetchScoreboard(date);
    } catch (error) {
      console.error(`Fehler beim Abruf der ESPN-Daten für ${date}:`, error.message);
      continue;
    }
    const matches = extractCompletedMatches(scoreboard);
    matches.forEach((game) => {
      const identity = buildIdentity(game.homeName, game.awayName, game.isoDate);
      if (!identity || !identityLookup.has(identity)) {
        return;
      }
      const target = identityLookup.get(identity);
      target.status = 'FINISHED';
      target.score = target.score || {};
      target.score.fullTime = target.score.fullTime || {};
      target.score.fullTime.home = game.homeScore;
      target.score.fullTime.away = game.awayScore;
      updates += 1;
    });
  }

  if (!updates) {
    console.log('Keine Updates vorgenommen.');
    return;
  }

  await writeFile(dataPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Aktualisiert: ${updates} Begegnungen.`);
}

main().catch((error) => {
  console.error('Unerwarteter Fehler:', error);
  process.exitCode = 1;
});
