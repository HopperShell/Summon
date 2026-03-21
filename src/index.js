// src/index.js
import bolt from '@slack/bolt';
const { App } = bolt;
import http from 'http';
import fs from 'fs';
import { routeMessage } from './messages.js';
import { getSession, resetSession } from './session.js';
import { listProjects, matchProject } from './projects.js';
import { runClaude } from './claude.js';
import { chunkResponse } from './chunker.js';

const PROJECTS_DIR = process.env.PROJECTS_DIR || `${process.env.HOME}/Projects`;

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
  if (message.channel_type !== 'im') return;
  if (message.subtype) return;
  if (!message.text) return;

  const route = routeMessage(message.text);
  console.log(`[route] text=${JSON.stringify(message.text)} → ${route.type}`);
  const session = getSession();

  const shortId = session.sessionId.slice(0, 4);
  const prefix = session.activeProject
    ? `:file_folder: *${session.activeProject}* \`[${shortId}]\` ~ `
    : '';

  switch (route.type) {
    case 'help': {
      await say([
        '*Commands:*',
        '`!work <project>` — switch to a project',
        '`!projects` — list available projects',
        '`!new` — start a fresh conversation',
        '`!status` — show current project & session',
        '`!help` — show this message',
        '',
        'Anything else goes straight to Claude.',
      ].join('\n'));
      break;
    }

    case 'new_chat': {
      resetSession();
      const newId = getSession().sessionId.slice(0, 4);
      await say(`${prefix}:sparkles: Fresh conversation started. \`[${newId}]\``);
      break;
    }

    case 'list_projects': {
      const projects = listProjects(PROJECTS_DIR);
      if (projects.length === 0) {
        await say(`${prefix}No projects found.`);
      } else {
        const list = projects.map((p) => `• ${p}`).join('\n');
        await say(`${prefix}Projects:\n${list}`);
      }
      break;
    }

    case 'switch_project': {
      const projects = listProjects(PROJECTS_DIR);
      const match = matchProject(route.query, projects);
      if (match) {
        session.activeProject = match;
        resetSession(); // new project = fresh conversation
        await say(`:file_folder: *${match}* ~ Switched. What do you want to do?`);
      } else {
        const list = projects.map((p) => `• ${p}`).join('\n');
        await say(
          `${prefix}No match for "${route.query}". Available:\n${list}`
        );
      }
      break;
    }

    case 'current_project': {
      if (session.activeProject) {
        await say(`${prefix}You're here.`);
      } else {
        await say('No project selected. Say "work on <project>" to pick one.');
      }
      break;
    }

    case 'claude_prompt': {
      if (!session.activeProject) {
        const projects = listProjects(PROJECTS_DIR);
        const list = projects.map((p) => `• ${p}`).join('\n');
        await say(`No project selected. Say "work on <project>".\n\nAvailable:\n${list}`);
        return;
      }

      if (session.busy) {
        await say('Still working on your last request...');
        return;
      }

      session.busy = true;

      // Post initial "working" message that we'll update in-place
      const statusMsg = await say(`${prefix}> ${route.prompt}\n\n:hourglass_flowing_sand: Working...`);

      // Streaming: accumulate text, update Slack message periodically
      let accumulated = '';
      let lastUpdate = 0;
      const UPDATE_INTERVAL = 2000;

      const onProgress = async (text) => {
        accumulated += text;
        const now = Date.now();
        if (now - lastUpdate > UPDATE_INTERVAL) {
          lastUpdate = now;
          const preview = accumulated.length > 3800
            ? '...' + accumulated.slice(-3800)
            : accumulated;
          try {
            await client.chat.update({
              channel: message.channel,
              ts: statusMsg.ts,
              text: `${prefix}> ${route.prompt}\n\n${preview}\n\n:hourglass_flowing_sand: _working..._`,
            });
          } catch {
            // rate limited or other error, skip update
          }
        }
      };

      try {
        const result = await runClaude(
          route.prompt,
          `${PROJECTS_DIR}/${session.activeProject}`,
          {
            sessionId: session.sessionId,
            isNew: session.isNewSession,
            onProgress,
          }
        );

        session.markUsed();

        if (result.success) {
          const chunks = chunkResponse(result.output);
          if (chunks.length > 0) {
            // Update the status message with final response (or first chunk)
            await client.chat.update({
              channel: message.channel,
              ts: statusMsg.ts,
              text: `${prefix}> ${route.prompt}\n\n${chunks[0]}`,
            });
            // Post remaining chunks as replies
            for (let i = 1; i < chunks.length; i++) {
              await client.chat.postMessage({
                channel: message.channel,
                thread_ts: statusMsg.ts,
                text: chunks[i],
              });
              if (i < chunks.length - 1) {
                await new Promise((r) => setTimeout(r, 1000));
              }
            }
          }
          await client.reactions.add({
            channel: message.channel,
            timestamp: message.ts,
            name: 'white_check_mark',
          });
        } else {
          await client.chat.update({
            channel: message.channel,
            ts: statusMsg.ts,
            text: `${prefix}> ${route.prompt}\n\n:x: ${result.error}`,
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
