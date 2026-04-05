#!/usr/bin/env node

import { execSync } from 'child_process';
import { resolve } from 'path';

const BOT_DIR = resolve(process.env.HOME, 'Projects/KalshiBot');

function run(args) {
  try {
    const result = execSync(`uv run python cli.py ${args}`, {
      cwd: BOT_DIR,
      timeout: 300000,
      encoding: 'utf-8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    process.stdout.write(result);
  } catch (err) {
    console.log(JSON.stringify({ error: err.message, output: err.stdout || '' }));
    process.exit(1);
  }
}

const args = process.argv.slice(2);

if (!args.length || args[0] === 'help') {
  console.log(JSON.stringify({
    commands: {
      'live [league]': 'Show live games with scores',
      'markets <event_ticker>': 'Show markets for a game',
      'bet "<instruction>"': 'Analyze and place bets',
      'balance': 'Check account balance',
      'positions': 'Show open positions',
      'history': 'Recent trade history',
      'monitor': 'Check live sports positions',
    },
  }, null, 2));
} else {
  // Pass all args through, quoting any that have spaces
  const escaped = args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
  run(escaped);
}
