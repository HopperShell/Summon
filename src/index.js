// src/index.js
import bolt from '@slack/bolt';
const { App } = bolt;
import http from 'http';
import fs from 'fs';
import { routeMessage, getSession } from './messages.js';
import { listProjects, matchProject } from './projects.js';
import { runClaude } from './claude.js';
import { chunkResponse } from './chunker.js';

const PROJECTS_DIR = process.env.PROJECTS_DIR || '/projects';
const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS
  ? process.env.ALLOWED_USER_IDS.split(',').map((id) => id.trim())
  : [];

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

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

app.message(async ({ message, say, client }) => {
  // Ignore non-DM messages, bot messages, and message edits
  if (message.channel_type !== 'im') return;
  if (message.subtype) return;

  const userId = message.user;

  // Optional user allowlist
  if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(userId)) {
    return;
  }

  const route = routeMessage(message.text);
  const session = getSession(userId);

  switch (route.type) {
    case 'list_projects': {
      const projects = listProjects(PROJECTS_DIR);
      if (projects.length === 0) {
        await say('No projects found in the projects directory.');
      } else {
        const list = projects.map((p) => `• ${p}`).join('\n');
        await say(`Here are your projects:\n${list}`);
      }
      break;
    }

    case 'switch_project': {
      const projects = listProjects(PROJECTS_DIR);
      const match = matchProject(route.query, projects);
      if (match) {
        session.activeProject = match;
        await say(`Switched to *${match}*. What do you want to do?`);
      } else {
        const list = projects.map((p) => `• ${p}`).join('\n');
        await say(
          `Couldn't find a project matching "${route.query}". Available projects:\n${list}`
        );
      }
      break;
    }

    case 'current_project': {
      if (session.activeProject) {
        await say(`You're working on *${session.activeProject}*.`);
      } else {
        await say('No project selected. Say "work on <project>" to pick one.');
      }
      break;
    }

    case 'claude_prompt': {
      if (!session.activeProject) {
        const projects = listProjects(PROJECTS_DIR);
        const list = projects.map((p) => `• ${p}`).join('\n');
        await say(
          `Pick a project first. Say "work on <project>".\n\nAvailable:\n${list}`
        );
        return;
      }

      if (session.busy) {
        await say('Still working on your last request...');
        return;
      }

      session.busy = true;

      // Quote the prompt as the first message in the thread
      const promptMsg = await say(`> ${route.prompt}`);
      const thread_ts = promptMsg.ts;

      try {
        const result = await runClaude(
          route.prompt,
          `${PROJECTS_DIR}/${session.activeProject}`
        );

        if (result.success) {
          const chunks = chunkResponse(result.output);
          for (let i = 0; i < chunks.length; i++) {
            await client.chat.postMessage({
              channel: message.channel,
              thread_ts,
              text: chunks[i],
            });
            // Rate limit: 1 msg/sec
            if (i < chunks.length - 1) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
          await client.reactions.add({
            channel: message.channel,
            timestamp: message.ts,
            name: 'white_check_mark',
          });
        } else {
          await client.chat.postMessage({
            channel: message.channel,
            thread_ts,
            text: `Error: ${result.error}`,
          });
          await client.reactions.add({
            channel: message.channel,
            timestamp: message.ts,
            name: 'x',
          });
        }
      } finally {
        session.busy = false;
      }
      break;
    }
  }
});

// Heartbeat logging
setInterval(() => {
  console.log(`[heartbeat] ${new Date().toISOString()} — ok`);
}, 60_000);

(async () => {
  // Verify projects directory is accessible
  try {
    fs.readdirSync(PROJECTS_DIR);
  } catch (err) {
    console.error(`FATAL: Cannot read PROJECTS_DIR (${PROJECTS_DIR}): ${err.message}`);
    process.exit(1);
  }

  await app.start();
  healthServer.listen(3000);
  console.log('Remote Claude is running');
})();
