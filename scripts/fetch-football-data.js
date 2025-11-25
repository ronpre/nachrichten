#!/usr/bin/env node

// Fetches football competitions from football-data.org and writes
// normalized JSON files for the live ticker frontend.

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://api.football-data.org/v4';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(scriptDir, '..');

const DEFAULT_OUTPUTS = new Map([
  ['CL', 'liveticker/public/data/cl-football-data.json'],
  ['PL', 'liveticker/public/data/pl-football-data.json'],
  ['PD', 'liveticker/public/data/laliga-football-data.json']
]);

const DEFAULT_LABELS = new Map([
  ['CL', 'Champions League'],
  ['PL', 'Premier League'],
  ['PD', 'La Liga']
]);

const CL_STAGE_ORDER = new Map([
  ['LEAGUE_STAGE', 1],
  ['LEAGUE_PHASE', 1],
  ['FIRST_STAGE', 1],
  ['PLAYOFFS', 2],
  ['KNOCKOUT_ROUND_PLAYOFFS', 2],
  ['KNOCKOUT_PLAY_OFFS', 2],
  ['ROUND_OF_16', 3],
  ['LAST_16', 3],
  ['QUARTER_FINALS', 4],
  ['QUARTERFINALS', 4],
  ['SEMI_FINALS', 5],
  ['SEMIFINALS', 5],
  ['FINAL', 6]
]);

const CL_STAGE_LABELS = new Map([
  [1, 'Ligaphase'],
  [2, 'Play-offs'],
  [3, 'Achtelfinale'],
  [4, 'Viertelfinale'],
  [5, 'Halbfinale'],
  [6, 'Finale']
]);

function parseCliArguments(argv) {
  const options = {};
  argv.slice(2).forEach((arg) => {
    if (!arg || typeof arg !== 'string') {
      return;
    }
    if (arg.startsWith('--competition=')) {
      options.competition = arg.slice('--competition='.length).trim();
    } else if (arg.startsWith('--season=')) {
      const raw = arg.slice('--season='.length).trim();
      const parsed = Number.parseInt(raw, 10);
      options.season = Number.isFinite(parsed) ? parsed : raw;
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length).trim();
    } else if (arg.startsWith('--label=')) {
      options.label = arg.slice('--label='.length).trim();
    }
  });
  return options;
}

function resolveSeason(seasonLike) {
  if (typeof seasonLike === 'number' && Number.isFinite(seasonLike)) {
    return seasonLike;
  }
  if (typeof seasonLike === 'string' && seasonLike.trim()) {
    const parsed = Number.parseInt(seasonLike.trim(), 10);
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

function normalizeMatch(match, competitionCode) {
  const id = String(match.id);
  const utcDate = match.utcDate || null;
  const isoDate = utcDate ? new Date(utcDate).toISOString().slice(0, 10) : null;
  const status = match.status || 'SCHEDULED';
  const stage = match.stage || null;
  const group = match.group || null;
  const matchday = Number.isFinite(match.matchday) ? match.matchday : null;
  let stageOrder = null;
  if (competitionCode === 'CL') {
    const stageKey = typeof stage === 'string' ? stage.toUpperCase() : '';
    stageOrder = CL_STAGE_ORDER.get(stageKey) ?? null;
  }

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
    stageOrder,
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

function toIsoDate(value) {
  if (!value) {
    return null;
  }
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString().slice(0, 10);
  } catch (error) {
    return null;
  }
}

function createDefaultMatchdayMetadata(matches) {
  if (!Array.isArray(matches)) {
    return [];
  }
  const byMatchday = new Map();

  matches.forEach((match) => {
    const key = Number.isFinite(match?.matchday) ? match.matchday : null;
    if (key == null) {
      return;
    }
    if (!byMatchday.has(key)) {
      byMatchday.set(key, {
        dates: new Set(),
        matchIds: new Set()
      });
    }
    const entry = byMatchday.get(key);
    const isoDate = match.isoDate || toIsoDate(match.utcDate);
    if (isoDate) {
      entry.dates.add(isoDate);
    }
    if (match?.id != null) {
      entry.matchIds.add(String(match.id));
    }
  });

  return Array.from(byMatchday.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([matchday, entry]) => {
      const dates = Array.from(entry.dates).sort();
      return {
        order: matchday,
        label: `${matchday}. Spieltag`,
        primaryDate: dates[0] ?? null,
        dates,
        matchIds: Array.from(entry.matchIds)
      };
    });
}

function createChampionsLeagueMetadata(matches) {
  if (!Array.isArray(matches)) {
    return [];
  }

  const leagueMatches = matches.filter((match) => {
    const stageKey = typeof match?.stage === 'string' ? match.stage.toUpperCase() : '';
    return stageKey === 'LEAGUE_STAGE' || stageKey === 'LEAGUE_PHASE' || stageKey === 'FIRST_STAGE';
  });

  const byMatchday = new Map();
  leagueMatches.forEach((match) => {
    const matchday = Number.isFinite(match?.matchday) ? match.matchday : null;
    if (matchday == null) {
      return;
    }
    if (!byMatchday.has(matchday)) {
      byMatchday.set(matchday, {
        dates: new Set(),
        matchIds: new Set()
      });
    }
    const bucket = byMatchday.get(matchday);
    const isoDate = match.isoDate || toIsoDate(match.utcDate);
    if (isoDate) {
      bucket.dates.add(isoDate);
    }
    if (match?.id != null) {
      bucket.matchIds.add(String(match.id));
    }
  });

  const leagueEntries = Array.from(byMatchday.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([matchday, bucket]) => {
      const dates = Array.from(bucket.dates).sort();
      return {
        order: matchday,
        label: `Ligaphase · ${matchday}. Spieltag`,
        primaryDate: dates[0] ?? null,
        dates,
        matchIds: Array.from(bucket.matchIds),
        stageOrder: 1
      };
    });

  const stageBuckets = new Map();
  matches.forEach((match) => {
    const stageKey = typeof match?.stage === 'string' ? match.stage.toUpperCase() : '';
    const stageOrder = CL_STAGE_ORDER.get(stageKey) ?? null;
    if (!stageOrder || stageOrder === 1) {
      return;
    }
    if (!stageBuckets.has(stageOrder)) {
      stageBuckets.set(stageOrder, {
        matches: [],
        rawStage: stageKey
      });
    }
    stageBuckets.get(stageOrder).matches.push(match);
  });

  const stageEntries = Array.from(stageBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([stageOrder, bucket]) => {
      const ids = new Set();
      const dates = new Set();
      bucket.matches.forEach((match) => {
        if (match?.id != null) {
          ids.add(String(match.id));
        }
        const isoDate = match.isoDate || toIsoDate(match.utcDate);
        if (isoDate) {
          dates.add(isoDate);
        }
      });
      if (!ids.size) {
        return null;
      }
      const sortedDates = Array.from(dates).sort();
      const baseLabel = CL_STAGE_LABELS.get(stageOrder) || bucket.rawStage || `Phase ${stageOrder}`;
      return {
        order: Infinity,
        label: baseLabel,
        primaryDate: sortedDates[0] ?? null,
        dates: sortedDates,
        matchIds: Array.from(ids),
        stageOrder
      };
    })
    .filter((entry) => entry != null);

  const combined = [...leagueEntries, ...stageEntries];
  if (!combined.length) {
    return [];
  }

  combined.sort((a, b) => {
    if (a.stageOrder !== b.stageOrder) {
      return (a.stageOrder ?? Number.POSITIVE_INFINITY) - (b.stageOrder ?? Number.POSITIVE_INFINITY);
    }
    if ((a.stageOrder ?? 0) === 1 && (b.stageOrder ?? 0) === 1) {
      return a.order - b.order;
    }
    const aTime = a.primaryDate ? Date.parse(a.primaryDate) : Number.POSITIVE_INFINITY;
    const bTime = b.primaryDate ? Date.parse(b.primaryDate) : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.label.localeCompare(b.label);
  });

  combined.forEach((entry, index) => {
    entry.order = index + 1;
  });

  return combined;
}

function createMatchdayMetadata(matches, competitionCode) {
  if (competitionCode === 'CL') {
    const championsLeagueEntries = createChampionsLeagueMetadata(matches);
    if (championsLeagueEntries.length) {
      return championsLeagueEntries;
    }
  }
  return createDefaultMatchdayMetadata(matches);
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

function deriveStandingsFromMatches(matches) {
  if (!Array.isArray(matches) || !matches.length) {
    return [];
  }

  const table = new Map();

  const ensureTeam = (team) => {
    const teamId = team?.id != null ? String(team.id) : null;
    const key = teamId || (team?.shortName && team.shortName.trim()) || (team?.name && team.name.trim());
    if (!key) {
      return null;
    }
    if (!table.has(key)) {
      table.set(key, {
        key,
        teamId,
        team: team?.shortName || team?.name || 'Team',
        group: null,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      });
    }
    return table.get(key);
  };

  matches.forEach((match) => {
    const homeScore = match?.score?.fullTime?.home;
    const awayScore = match?.score?.fullTime?.away;
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return;
    }

    const homeTeam = ensureTeam(match?.homeTeam);
    const awayTeam = ensureTeam(match?.awayTeam);
    if (!homeTeam || !awayTeam) {
      return;
    }

    homeTeam.played += 1;
    awayTeam.played += 1;

    homeTeam.goalsFor += homeScore;
    homeTeam.goalsAgainst += awayScore;
    awayTeam.goalsFor += awayScore;
    awayTeam.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      homeTeam.wins += 1;
      homeTeam.points += 3;
      awayTeam.losses += 1;
    } else if (homeScore < awayScore) {
      awayTeam.wins += 1;
      awayTeam.points += 3;
      homeTeam.losses += 1;
    } else {
      homeTeam.draws += 1;
      awayTeam.draws += 1;
      homeTeam.points += 1;
      awayTeam.points += 1;
    }
  });

  const rows = Array.from(table.values())
    .map((row) => {
      row.goalDifference = row.goalsFor - row.goalsAgainst;
      return row;
    })
    .filter((row) => row.played > 0);

  rows.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }
    if (b.goalsFor !== a.goalsFor) {
      return b.goalsFor - a.goalsFor;
    }
    return (a.team || '').localeCompare(b.team || '');
  });

  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows;
}

async function main() {
  const cliOptions = parseCliArguments(process.argv);
  const competitionCode = (cliOptions.competition || 'CL').toUpperCase();
  const competitionLabel = cliOptions.label || DEFAULT_LABELS.get(competitionCode) || competitionCode;

  const outputRelative = cliOptions.output || DEFAULT_OUTPUTS.get(competitionCode);
  if (!outputRelative) {
    throw new Error(`No default output path defined for competition ${competitionCode}. Please specify --output=...`);
  }
  const outputFile = path.isAbsolute(outputRelative)
    ? outputRelative
    : path.join(repoRoot, outputRelative);

  const season = resolveSeason(cliOptions.season);

  const matchesResponse = await fetchFromFootballData(`/competitions/${competitionCode}/matches`, { season });

  let standingsResponse = null;
  try {
    standingsResponse = await fetchFromFootballData(`/competitions/${competitionCode}/standings`, { season });
  } catch (error) {
    if (error instanceof Error && /404/.test(error.message)) {
      console.warn(`Standings endpoint returned 404 for ${competitionCode} – skipping standings for this season.`);
    } else {
      throw error;
    }
  }

  const matches = Array.isArray(matchesResponse.matches)
    ? matchesResponse.matches.map((match) => normalizeMatch(match, competitionCode))
    : [];
  const matchdays = createMatchdayMetadata(matches, competitionCode);
  const standings = standingsResponse
    ? normalizeStandings(standingsResponse.standings)
    : [];

  const standingsWithFallback = standings.length ? standings : deriveStandingsFromMatches(matches);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'football-data.org',
    competition: {
      code: competitionCode,
      label: competitionLabel,
      name: matchesResponse?.competition?.name ?? null,
      emblem: matchesResponse?.competition?.emblem ?? null
    },
    season: {
      year: season,
      startDate: matchesResponse?.competition?.currentSeason?.startDate ?? null,
      endDate: matchesResponse?.competition?.currentSeason?.endDate ?? null,
      matchday: matchesResponse?.filters?.matchday ?? null
    },
    matchdays,
    matches,
    standings: standingsWithFallback
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`${competitionLabel} data written to ${outputFile}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
