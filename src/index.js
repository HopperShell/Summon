// src/index.js
import http from 'http';
import fs from 'fs';
import { handleMessage } from './core.js';
import { SlackAdapter } from './adapters/slack.js';
import { DiscordAdapter } from './adapters/discord.js';
import { TelegramAdapter } from './adapters/telegram.js';
import { WhatsAppAdapter } from './adapters/whatsapp.js';
import { initCalendar } from './calendar.js';
import { resolveProjectsDir } from './paths.js';

const PROJECTS_DIR = resolveProjectsDir();

// Health check server
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Auto-detect which services to start based on env vars
const adapters = [];
if (process.env.SLACK_BOT_TOKEN) adapters.push(new SlackAdapter());
if (process.env.DISCORD_BOT_TOKEN) adapters.push(new DiscordAdapter());
if (process.env.TELEGRAM_BOT_TOKEN) adapters.push(new TelegramAdapter());
if (process.env.WHATSAPP_ENABLED === 'true') adapters.push(new WhatsAppAdapter());

if (adapters.length === 0) {
  console.error('FATAL: No chat service configured. Set at least one token (SLACK_BOT_TOKEN, DISCORD_BOT_TOKEN, TELEGRAM_BOT_TOKEN, or WHATSAPP_ENABLED=true).');
  process.exit(1);
}

// Heartbeat logging
setInterval(() => {
  console.log(`[heartbeat] ${new Date().toISOString()} — ok`);
}, 60_000);

(async () => {
  try {
    fs.readdirSync(PROJECTS_DIR);
  } catch (err) {
    console.error(`FATAL: Cannot read PROJECTS_DIR (${PROJECTS_DIR}): ${err.message}`);
    process.exit(1);
  }

  const calendarReady = initCalendar();
  if (calendarReady) {
    console.log('Google Calendar connected');
  } else {
    console.log('Google Calendar not configured (missing credentials.json or token.json)');
  }

  for (const adapter of adapters) {
    adapter.onMessage((msg) => handleMessage({ adapter, ...msg }));
    await adapter.connect();
  }

  healthServer.listen(3000);
  const names = adapters.map((a) => a.name).join(', ');
  console.log(`Remote Claude is running [${names}]`);
})();
