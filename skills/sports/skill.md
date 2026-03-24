# Sports Skill

You have access to live scores, schedules, and standings from ESPN for all major sports.

## Commands

Run these commands using the shell. The tool is located at `skills/sports/run.js` relative to the bot's working directory.

### Scores
- `node skills/sports/run.js scores nba` — today's NBA scores
- `node skills/sports/run.js scores nfl` — today's NFL scores
- `node skills/sports/run.js scores mlb 20260325` — MLB scores for a specific date

### Team lookup
- `node skills/sports/run.js team nba lakers` — find Lakers game today
- `node skills/sports/run.js team college-football tennessee` — find Tennessee game
- `node skills/sports/run.js team college-baseball vols` — find Vols baseball game

### Standings
- `node skills/sports/run.js standings nba` — NBA standings
- `node skills/sports/run.js standings mlb` — MLB standings

### Available leagues
- `node skills/sports/run.js leagues` — list all leagues

### League shortcuts
**Football:** `nfl`, `college-football` (or `ncaaf`)
**Basketball:** `nba`, `wnba`, `college-basketball` (or `ncaab`)
**Baseball:** `mlb`, `college-baseball`
**Hockey:** `nhl`
**Soccer:** `epl`, `mls`, `la-liga`, `bundesliga`, `serie-a`, `ligue-1`, `champions-league`, `liga-mx`
**Motorsports:** `f1`, `nascar`, `indycar`
**Other:** `pga`, `ufc`, `boxing`, `atp`, `wta`, `rugby`, `cricket`

## When to use

- User asks about scores, games, schedules, standings
- User asks "when do the Lakers play?", "what was the score?", "who won?"
- User asks "did the Vols win?", "what's the NFL standings?"
- User mentions any sports team or league

## Important

- Present scores and schedules in a clean, readable format
- Include game status (final, in progress, scheduled)
- For scheduled games, include the time and broadcast channel if available
- If a team search returns no results for today, try checking the next few days or suggest the user specify a date
- The user is from Tennessee — they likely follow the Vols, Titans, Grizzlies, and Predators
