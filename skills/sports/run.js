#!/usr/bin/env node

const SPORTS = {
  // Football
  nfl: 'football/nfl',
  'college-football': 'football/college-football',
  ncaaf: 'football/college-football',
  // Basketball
  nba: 'basketball/nba',
  wnba: 'basketball/wnba',
  'college-basketball': 'basketball/mens-college-basketball',
  ncaab: 'basketball/mens-college-basketball',
  // Baseball
  mlb: 'baseball/mlb',
  'college-baseball': 'baseball/college-baseball',
  ncaa_baseball: 'baseball/college-baseball',
  // Hockey
  nhl: 'hockey/nhl',
  // Soccer
  epl: 'soccer/eng.1',
  'premier-league': 'soccer/eng.1',
  mls: 'soccer/usa.1',
  liga: 'soccer/esp.1',
  'la-liga': 'soccer/esp.1',
  bundesliga: 'soccer/ger.1',
  'serie-a': 'soccer/ita.1',
  'ligue-1': 'soccer/fra.1',
  'champions-league': 'soccer/uefa.champions',
  'liga-mx': 'soccer/mex.1',
  // Motorsports
  f1: 'racing/f1',
  nascar: 'racing/nascar',
  indycar: 'racing/irl',
  // Combat
  ufc: 'mma/ufc',
  boxing: 'boxing/boxing',
  // Other
  pga: 'golf/pga',
  atp: 'tennis/atp',
  wta: 'tennis/wta',
  wnhl: 'hockey/nhl',
  // Rugby
  rugby: 'rugby/premiership',
  // Cricket
  cricket: 'cricket/international',
};

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function formatGame(event) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const teams = comp.competitors?.map((c) => ({
    name: c.team?.displayName || c.team?.name || 'TBD',
    abbreviation: c.team?.abbreviation || '',
    score: c.score || '0',
    winner: c.winner || false,
    record: c.records?.[0]?.summary || '',
  })) || [];

  const status = comp.status?.type?.description || '';
  const detail = comp.status?.type?.detail || comp.status?.type?.shortDetail || '';
  const clock = comp.status?.displayClock || '';
  const period = comp.status?.period || 0;
  const venue = comp.venue?.fullName || '';
  const broadcast = comp.broadcasts?.[0]?.names?.[0] || '';

  return {
    id: event.id,
    name: event.name || `${teams[0]?.name} vs ${teams[1]?.name}`,
    date: event.date,
    status,
    detail,
    clock: clock && period ? `${clock} - Period ${period}` : '',
    venue,
    broadcast,
    teams,
  };
}

async function getScoreboard(sportPath, date) {
  let url = `${BASE_URL}/${sportPath}/scoreboard`;
  if (date) url += `?dates=${date}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ESPN API error: ${resp.status}`);
  const data = await resp.json();
  const league = data.leagues?.[0]?.name || sportPath;
  const games = (data.events || []).map(formatGame).filter(Boolean);
  return { league, games, count: games.length };
}

async function searchTeam(sportPath, teamName) {
  // Get scoreboard and filter by team name
  const url = `${BASE_URL}/${sportPath}/scoreboard`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ESPN API error: ${resp.status}`);
  const data = await resp.json();

  const lower = teamName.toLowerCase();
  const games = (data.events || [])
    .filter((e) => {
      const name = (e.name || '').toLowerCase();
      const shortName = (e.shortName || '').toLowerCase();
      const teams = e.competitions?.[0]?.competitors || [];
      return name.includes(lower) ||
        shortName.includes(lower) ||
        teams.some((t) =>
          (t.team?.displayName || '').toLowerCase().includes(lower) ||
          (t.team?.abbreviation || '').toLowerCase() === lower ||
          (t.team?.shortDisplayName || '').toLowerCase().includes(lower)
        );
    })
    .map(formatGame)
    .filter(Boolean);

  return { team: teamName, games, count: games.length };
}

async function getStandings(sportPath) {
  const url = `${BASE_URL}/${sportPath}/standings`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ESPN API error: ${resp.status}`);
  const data = await resp.json();

  const standings = [];
  for (const group of data.children || []) {
    const groupName = group.name || '';
    for (const entry of group.standings?.entries || []) {
      const team = entry.team?.displayName || '';
      const stats = {};
      for (const s of entry.stats || []) {
        stats[s.abbreviation || s.name] = s.displayValue || s.value;
      }
      standings.push({ group: groupName, team, ...stats });
    }
  }

  return { league: data.name || sportPath, standings, count: standings.length };
}

function printUsage() {
  printJson({
    usage: {
      'scores <league>': 'Today\'s scores (e.g., scores nba)',
      'scores <league> <YYYYMMDD>': 'Scores for a specific date',
      'team <league> <name>': 'Find a team\'s game (e.g., team nba lakers)',
      'standings <league>': 'Current standings',
      'leagues': 'List all available leagues',
    },
    leagues: Object.keys(SPORTS).sort(),
  });
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command || command === 'help') {
    printUsage();
    process.exit(0);
  }

  if (command === 'leagues') {
    const leagues = {};
    for (const [key, val] of Object.entries(SPORTS)) {
      if (!Object.values(leagues).includes(val)) {
        leagues[key] = val;
      }
    }
    printJson({ leagues });
    process.exit(0);
  }

  if (command === 'scores') {
    const league = args[0]?.toLowerCase();
    if (!league || !SPORTS[league]) {
      printJson({ error: `Unknown league: ${league}. Use 'leagues' to see available options.` });
      process.exit(1);
    }
    const date = args[1] || '';
    const result = await getScoreboard(SPORTS[league], date);
    printJson(result);
    return;
  }

  if (command === 'team') {
    const league = args[0]?.toLowerCase();
    const teamName = args.slice(1).join(' ');
    if (!league || !SPORTS[league]) {
      printJson({ error: `Unknown league: ${league}. Use 'leagues' to see available options.` });
      process.exit(1);
    }
    if (!teamName) {
      printJson({ error: 'Usage: team <league> <team name>' });
      process.exit(1);
    }
    const result = await searchTeam(SPORTS[league], teamName);
    printJson(result);
    return;
  }

  if (command === 'standings') {
    const league = args[0]?.toLowerCase();
    if (!league || !SPORTS[league]) {
      printJson({ error: `Unknown league: ${league}. Use 'leagues' to see available options.` });
      process.exit(1);
    }
    const result = await getStandings(SPORTS[league]);
    printJson(result);
    return;
  }

  printJson({ error: `Unknown command: ${command}` });
  printUsage();
}

main().catch((err) => {
  printJson({ error: err.message });
  process.exit(1);
});
