import { routeMessage } from './messages.js';
import { getSession, resetSession } from './session.js';
import { listProjects, matchProject } from './projects.js';
import { runClaude } from './claude.js';
import { chunkResponse } from './chunker.js';
import { convertMarkdown } from './markdown.js';
import { handleCalendarCommand } from './calendar-handler.js';

const PROJECTS_DIR = process.env.PROJECTS_DIR || `${process.env.HOME}/Projects`;

export async function handleMessage({ adapter, chatId, text, userId, originalTs, files = [] }) {
  // Default prompt for image-only messages
  if (files.length > 0 && !text?.trim()) {
    text = 'What\'s in this image?';
  }

  const route = routeMessage(text || '');
  console.log(`[route] text=${JSON.stringify(text)} → ${route.type}`);

  const sessionKey = `${adapter.name}:${chatId}`;
  const session = getSession(sessionKey);

  const shortId = session.sessionId.slice(0, 4);
  const prefix = session.activeProject
    ? `:file_folder: *${session.activeProject}* \`[${shortId}]\` ~ `
    : '';

  const fmt = (t) => convertMarkdown(t, adapter.capabilities.markdownFormat);

  switch (route.type) {
    case 'help': {
      const lines = [
        '*Commands:*',
        '`!work <project>` — switch to a project (coding mode)',
        '`!stop` / `!general` — exit project, back to general mode',
        '`!projects` — list available projects',
        '`!calendar` / `!cal` — today\'s events',
        '`!calendar week` — this week\'s events',
        '`!calendar add <event> at <time>` — create an event',
        '`!new` — start a fresh conversation',
        '`!status` — show current project & session',
        '`!help` — show this message',
        '',
        session.activeProject
          ? `Currently in *coding mode* on *${session.activeProject}*. Messages go to Claude Code.`
          : 'Currently in *general mode*. Messages go to Claude as a general assistant.',
      ];
      await adapter.sendMessage(chatId, fmt(lines.join('\n')));
      break;
    }

    case 'new_chat': {
      resetSession(sessionKey);
      const newId = getSession(sessionKey).sessionId.slice(0, 4);
      await adapter.sendMessage(chatId, fmt(`${prefix}:sparkles: Fresh conversation started. \`[${newId}]\``));
      break;
    }

    case 'list_projects': {
      const projects = listProjects(PROJECTS_DIR);
      if (projects.length === 0) {
        await adapter.sendMessage(chatId, fmt(`${prefix}No projects found.`));
      } else {
        const list = projects.map((p) => `• ${p}`).join('\n');
        await adapter.sendMessage(chatId, fmt(`${prefix}Projects:\n${list}`));
      }
      break;
    }

    case 'switch_project': {
      const projects = listProjects(PROJECTS_DIR);
      const match = matchProject(route.query, projects);
      if (match) {
        session.activeProject = match;
        resetSession(sessionKey); // new project = fresh conversation
        await adapter.sendMessage(chatId, fmt(`:file_folder: *${match}* ~ Switched. What do you want to do?`));
      } else {
        const list = projects.map((p) => `• ${p}`).join('\n');
        await adapter.sendMessage(chatId, fmt(
          `${prefix}No match for "${route.query}". Available:\n${list}`
        ));
      }
      break;
    }

    case 'current_project': {
      if (session.activeProject) {
        await adapter.sendMessage(chatId, fmt(`${prefix}You're here.`));
      } else {
        await adapter.sendMessage(chatId, fmt('No project selected. Say "work on <project>" to pick one.'));
      }
      break;
    }

    case 'exit_project': {
      if (session.activeProject) {
        session.activeProject = null;
        resetSession(sessionKey);
        await adapter.sendMessage(chatId, fmt('Back to general mode.'));
      } else {
        await adapter.sendMessage(chatId, fmt('Already in general mode.'));
      }
      break;
    }

    case 'calendar': {
      const result = await handleCalendarCommand(route.subcommand, route.args);
      await adapter.sendMessage(chatId, fmt(result));
      break;
    }

    case 'claude_prompt': {
      if (session.busy) {
        await adapter.sendMessage(chatId, fmt('Still working on your last request...'));
        return;
      }

      session.busy = true;

      const maxLen = adapter.capabilities.maxMessageLength;
      const canEdit = adapter.capabilities.canEditMessages;
      const projectDir = session.activeProject
        ? `${PROJECTS_DIR}/${session.activeProject}`
        : null;

      // Post initial "working" message
      const statusRef = await adapter.sendMessage(chatId, fmt(`${prefix}> ${route.prompt}\n\n:hourglass_flowing_sand: Working...`));

      // Streaming progress updates (only if adapter supports editing)
      let accumulated = '';
      let lastUpdate = 0;
      const UPDATE_INTERVAL = 2000;

      const onProgress = canEdit
        ? async (progressText) => {
            accumulated += progressText;
            const now = Date.now();
            if (now - lastUpdate > UPDATE_INTERVAL) {
              lastUpdate = now;
              const previewLimit = maxLen - 200;
              const preview = accumulated.length > previewLimit
                ? '...' + accumulated.slice(-previewLimit)
                : accumulated;
              try {
                await adapter.updateMessage(
                  statusRef,
                  fmt(`${prefix}> ${route.prompt}\n\n${preview}\n\n:hourglass_flowing_sand: _working..._`)
                );
              } catch {
                // rate limited or other error, skip update
              }
            }
          }
        : undefined;

      try {
        const result = await runClaude(
          route.prompt,
          projectDir,
          {
            sessionId: session.sessionId,
            isNew: session.isNewSession,
            onProgress,
            files,
          }
        );

        session.markUsed();

        if (result.success) {
          const chunks = chunkResponse(fmt(result.output), maxLen - 200);

          if (canEdit) {
            // Update the status message with final response (or first chunk)
            if (chunks.length > 0) {
              await adapter.updateMessage(
                statusRef,
                `${prefix}> ${route.prompt}\n\n${chunks[0]}`
              );
              // Send remaining chunks as new messages
              for (let i = 1; i < chunks.length; i++) {
                await adapter.sendMessage(chatId, chunks[i]);
                if (i < chunks.length - 1) {
                  await new Promise((r) => setTimeout(r, 1000));
                }
              }
            }
          } else {
            // Cannot edit: send all chunks as new messages
            for (let i = 0; i < chunks.length; i++) {
              const chunkText = i === 0
                ? `${prefix}> ${route.prompt}\n\n${chunks[i]}`
                : chunks[i];
              await adapter.sendMessage(chatId, chunkText);
              if (i < chunks.length - 1) {
                await new Promise((r) => setTimeout(r, 1000));
              }
            }
          }

          // Checkmark reaction on success (pass originalTs for Slack)
          await adapter.addReaction({ ...statusRef, originalTs }, 'white_check_mark');
        } else {
          if (canEdit) {
            await adapter.updateMessage(
              statusRef,
              fmt(`${prefix}> ${route.prompt}\n\n:x: ${result.error}`)
            );
          } else {
            await adapter.sendMessage(chatId, fmt(`${prefix}> ${route.prompt}\n\n:x: ${result.error}`));
          }
        }
      } finally {
        session.busy = false;
      }
      break;
    }
  }
}
