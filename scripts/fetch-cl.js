#!/usr/bin/env node

// Fetches UEFA Champions League data from football-data.org and writes
// normalized JSON files for the live ticker frontend.

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://api.football-data.org/v4';
const COMPETITION_CODE = 'CL';
const OUTPUT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'liveticker',
  'public',
  'data',
  'cl-football-data.json'
);

function getSeasonFromArgs() {
  const raw = process.argv.find((arg) => arg.startsWith('--season='));
  if (raw) {
    const value = raw.slice('--season='.length);
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  return month >= 7 ? year : year - 1;
}

function assertEnvVar(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Environment variable ${name} is required.`);
  }
  return value.trim();
}

async function fetchFromFootballData(endpoint, params = {}) {
  const token = assertEnvVar('FOOTBALL_DATA_TOKEN');
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') {
      return;
    }
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': token,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`football-data request failed (${response.status} ${response.statusText}): ${text}`);
  }

  return response.json();
}

function normalizeMatch(match) {
  const id = String(match.id);
  const utcDate = match.utcDate || null;
  const isoDate = utcDate ? new Date(utcDate).toISOString().slice(0, 10) : null;
  const status = match.status || 'SCHEDULED';
  const stage = match.stage || null;
  const group = match.group || null;
  const matchday = Number.isFinite(match.matchday) ? match.matchday : null;

  const fullTime = match.score?.fullTime ?? {};
  const penalties = match.score?.penalties ?? {};
  const extraTime = match.score?.extraTime ?? {};

  return {
    id,
    utcDate,
    isoDate,
    status,
    stage,
    group,
    matchday,
    homeTeam: {
      id: match.homeTeam?.id ?? null,
      name: match.homeTeam?.name ?? 'Heim',
      shortName: match.homeTeam?.shortName ?? match.homeTeam?.tla ?? match.homeTeam?.name ?? 'Heim'
    },
    awayTeam: {
      id: match.awayTeam?.id ?? null,
      name: match.awayTeam?.name ?? 'Gast',
      shortName: match.awayTeam?.shortName ?? match.awayTeam?.tla ?? match.awayTeam?.name ?? 'Gast'
    },
    score: {
      fullTime: {
        home: Number.isFinite(fullTime.home) ? fullTime.home : null,
        away: Number.isFinite(fullTime.away) ? fullTime.away : null
      },
      extraTime: {
        home: Number.isFinite(extraTime.home) ? extraTime.home : null,
        away: Number.isFinite(extraTime.away) ? extraTime.away : null
      },
      penalties: {
        home: Number.isFinite(penalties.home) ? penalties.home : null,
        away: Number.isFinite(penalties.away) ? penalties.away : null
      }
    }
  };
}

function createMatchdayMetadata(matches) {
  const byMatchday = new Map();

  matches.forEach((match) => {
    const key = Number.isFinite(match.matchday) ? match.matchday : null;
    if (key == null) {
      return;
    }
    if (!byMatchday.has(key)) {
      byMatchday.set(key, {
        order: key,
        dates: new Set(),
        matchIds: new Set()
      });
    }
    const entry = byMatchday.get(key);
    if (match.isoDate) {
      entry.dates.add(match.isoDate);
    }
    entry.matchIds.add(match.id);
  });

  const sorted = Array.from(byMatchday.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([order, entry]) => {
      const dates = Array.from(entry.dates).sort();
      return {
        order,
        label: `${order}. Spieltag`,
        primaryDate: dates[0] ?? null,
        dates,
        matchIds: Array.from(entry.matchIds)
      };
    });

  return sorted;
}

function normalizeStandings(standingsPayload) {
  if (!Array.isArray(standingsPayload)) {
    return [];
  }
  const buckets = standingsPayload.filter((entry) => entry.type === 'TOTAL' && Array.isArray(entry.table));
  const rows = [];
  buckets.forEach((bucket) => {
    const groupLabel = bucket.group ?? bucket.stage ?? null;
    bucket.table.forEach((teamEntry) => {
      rows.push({
        group: groupLabel,
        rank: Number.isFinite(teamEntry.position) ? teamEntry.position : null,
        team: teamEntry.team?.shortName || teamEntry.team?.tla || teamEntry.team?.name || 'Team',
        played: Number.isFinite(teamEntry.playedGames) ? teamEntry.playedGames : null,
        wins: Number.isFinite(teamEntry.won) ? teamEntry.won : null,
        draws: Number.isFinite(teamEntry.draw) ? teamEntry.draw : null,
        losses: Number.isFinite(teamEntry.lost) ? teamEntry.lost : null,
        goalsFor: Number.isFinite(teamEntry.goalsFor) ? teamEntry.goalsFor : null,
        goalsAgainst: Number.isFinite(teamEntry.goalsAgainst) ? teamEntry.goalsAgainst : null,
        goalDifference: Number.isFinite(teamEntry.goalDifference) ? teamEntry.goalDifference : null,
        points: Number.isFinite(teamEntry.points) ? teamEntry.points : null
      });
    });
  });
  rows.sort((a, b) => {
    if (a.rank != null && b.rank != null && a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return (a.team || '').localeCompare(b.team || '');
  });
  return rows;
}

async function main() {
  const season = getSeasonFromArgs();

  const [matchesResponse, standingsResponse] = await Promise.all([
    fetchFromFootballData(`/competitions/${COMPETITION_CODE}/matches`, { season }),
    fetchFromFootballData(`/competitions/${COMPETITION_CODE}/standings`, { season })
  ]);

  const matches = Array.isArray(matchesResponse.matches)
    ? matchesResponse.matches.map(normalizeMatch)
    : [];
  const matchdays = createMatchdayMetadata(matches);
  const standings = normalizeStandings(standingsResponse.standings);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'football-data.org',
    season: {
      year: season,
      startDate: matchesResponse?.competition?.currentSeason?.startDate ?? null,
      endDate: matchesResponse?.competition?.currentSeason?.endDate ?? null,
      matchday: matchesResponse?.filters?.matchday ?? null
    },
    matchdays,
    matches,
    standings
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Champions League data written to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
