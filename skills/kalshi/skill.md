# Kalshi Trading Skill

You can trade on Kalshi prediction markets — live sports, politics, economics, and more. The trading bot is located at `~/Projects/KalshiBot`.

## Commands

Run these commands using the shell. The tool is located at `skills/kalshi/run.js` relative to the bot's working directory.

### Live Games
- `node skills/kalshi/run.js live` — show all live sports games with scores
- `node skills/kalshi/run.js live nba` — show only live NBA games
- `node skills/kalshi/run.js live mlb` — show only live MLB games

### Markets for a Game
- `node skills/kalshi/run.js markets KXNBAGAME-26APR04DETPHI` — show tradeable markets for a specific game (use event ticker from live output)

### Place Bets (Manual)
- `node skills/kalshi/run.js bet "find me some good NBA bets"` — ask Claude to analyze live games and recommend bets
- `node skills/kalshi/run.js bet "bet on UConn to win"` — place a specific bet

### Portfolio
- `node skills/kalshi/run.js balance` — check account balance
- `node skills/kalshi/run.js positions` — show open positions
- `node skills/kalshi/run.js history` — recent trade history

### Position Monitor
- `node skills/kalshi/run.js monitor` — check all live sports positions right now

## When to use

- User asks about Kalshi, prediction markets, or trading
- User asks to place a bet or make a trade
- User asks "what live games can I bet on?"
- User asks about their positions, balance, or P&L
- User says "bet on the Lakers" or "what are the odds on the UConn game?"
- User asks to check on their bets or positions

## Important

- The bot is currently in DRY RUN mode on the demo API — no real money is at risk
- Always show the user what trades Claude recommends BEFORE placing them
- For live sports bets, the position monitor (separate cron) checks every 5 minutes
- Present odds as percentages (e.g., 55% not 0.5500)
- Include scores and game state when showing live games
