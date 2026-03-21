import { spawn } from 'child_process';
import kill from 'tree-kill';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const SYSTEM_PROMPT = `You are a coding assistant in a Slack conversation. You have full access to the project's codebase.

When you complete a task:
- Explain what you changed and why, with relevant code snippets
- Mention files you created, modified, or deleted
- If you ran commands, show the output
- Suggest logical next steps if applicable

When asked questions:
- Be conversational and thorough
- Show relevant code when it helps explain
- Ask clarifying questions when the request is ambiguous

Keep responses well-structured with short paragraphs. Use markdown formatting — it renders in Slack.`;

export async function runClaude(prompt, projectDir, { sessionId, isNew, onProgress } = {}) {
  const args = ['-p', prompt];

  if (sessionId) {
    if (isNew) {
      args.push('--session-id', sessionId);
    } else {
      args.push('--resume', sessionId);
    }
  }

  args.push('--append-system-prompt', SYSTEM_PROMPT);
  args.push('--output-format', 'stream-json', '--verbose');
  args.push('--dangerously-skip-permissions');

  const proc = spawn('claude', args, {
    cwd: projectDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });

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
