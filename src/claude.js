import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import kill from 'tree-kill';
import { loadSkills } from './skills.js';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const CODING_PROMPT = `You are a coding assistant in a chat conversation. You have full access to the project's codebase.

When you complete a task:
- Explain what you changed and why, with relevant code snippets
- Mention files you created, modified, or deleted
- If you ran commands, show the output
- Suggest logical next steps if applicable

When asked questions:
- Be conversational and thorough
- Show relevant code when it helps explain
- Ask clarifying questions when the request is ambiguous

Keep responses well-structured with short paragraphs. Use markdown formatting.`;

const GENERAL_PROMPT = `You are a personal assistant in a chat conversation. You can help with questions, planning, research, writing, and general tasks. Be conversational and helpful. Use markdown formatting.

Keep responses concise and well-structured.`;

const SKILLS_PROMPT = loadSkills();

function buildContentBlocks(prompt, files) {
  const content = [];

  for (const file of files) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: file.mediaType,
        data: file.base64,
      },
    });
  }

  content.push({ type: 'text', text: prompt });

  return content;
}

export async function runClaude(prompt, projectDir, { sessionId, isNew, onProgress, files = [] } = {}) {
  const hasFiles = files.length > 0;

  const args = [];

  if (hasFiles) {
    // Multimodal: use stream-json input via stdin
    args.push('-p', '', '--input-format', 'stream-json');
  } else {
    // Text-only: pass prompt directly
    args.push('-p', prompt);
  }

  if (sessionId) {
    if (isNew) {
      args.push('--session-id', sessionId);
    } else {
      args.push('--resume', sessionId);
    }
  }

  const isGeneral = !projectDir;
  const systemPrompt = (isGeneral ? GENERAL_PROMPT : CODING_PROMPT) + SKILLS_PROMPT;
  args.push('--append-system-prompt', systemPrompt);
  args.push('--output-format', 'stream-json', '--verbose');

  args.push('--dangerously-skip-permissions');

  if (hasFiles) {
    args.push('--model', 'sonnet');
  } else if (isGeneral) {
    args.push('--model', 'haiku');
  }

  const proc = spawn('claude', args, {
    cwd: projectDir || process.cwd(),
    stdio: [hasFiles ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });

  // Write multimodal message to stdin
  if (hasFiles) {
    const message = {
      type: 'user',
      message: {
        role: 'user',
        content: buildContentBlocks(prompt, files),
      },
      parent_tool_use_id: null,
      session_id: sessionId || randomUUID(),
    };
    proc.stdin.write(JSON.stringify(message) + '\n');
    proc.stdin.end();
  }

  let fullResult = '';
  let stderr = '';
  let timedOut = false;
  let buffer = '';

  const timeout = setTimeout(() => {
    timedOut = true;
    kill(proc.pid, 'SIGTERM');
  }, TIMEOUT_MS);

  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              onProgress?.(block.text);
            }
          }
        }
        if (event.type === 'result') {
          fullResult = event.result || '';
        }
      } catch {
        // skip unparseable lines
      }
    }
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  return new Promise((resolve) => {
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        resolve({ success: false, error: 'Claude timed out after 10 minutes' });
      } else if (code === 0) {
        resolve({ success: true, output: fullResult });
      } else {
        resolve({
          success: false,
          error: stderr || `Claude exited with code ${code}`,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });
  });
}
