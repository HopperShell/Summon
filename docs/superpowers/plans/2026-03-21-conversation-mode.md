# Conversation Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-shot `claude -p` with session-based conversations that persist across messages, with streaming responses and a "new chat" command.

**Architecture:** Session state holds one active Claude session ID (a UUID). First message creates the session with `--session-id`, subsequent messages use `--resume`. Streaming uses `--output-format stream-json --verbose` to parse incremental `assistant` events and update a single Slack message in-place. "new chat" generates a fresh UUID.

**Tech Stack:** Node.js, @slack/bolt, Claude CLI (`--session-id`, `--resume`, `--output-format stream-json`)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/session.js` (create) | Session state: activeProject, sessionId, busy, newSession/resetSession |
| `src/claude.js` (modify) | Accepts sessionId, uses `--session-id` or `--resume`, streams output via stream-json |
| `src/messages.js` (modify) | Add "new chat" / "start over" route, remove per-user session map (single user) |
| `src/index.js` (modify) | Wire up session, streaming Slack updates, remove user allowlist |
| `test/session.test.js` (create) | Tests for session state management |
| `test/claude.test.js` (modify) | Update tests for new sessionId param and streaming |
| `test/messages.test.js` (modify) | Add "new chat" routing tests, remove multi-user tests |

---

### Task 1: Create session module

**Files:**
- Create: `src/session.js`
- Create: `test/session.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// test/session.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { getSession, resetSession } from '../src/session.js';

describe('session', () => {
  beforeEach(() => {
    resetSession();
  });

  it('initializes with null project and a sessionId', () => {
    const s = getSession();
    expect(s.activeProject).toBeNull();
    expect(s.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(s.busy).toBe(false);
    expect(s.isNewSession).toBe(true);
  });

  it('returns the same session on repeated calls', () => {
    const a = getSession();
    const b = getSession();
    expect(a).toBe(b);
  });

  it('resetSession creates a new sessionId but keeps activeProject', () => {
    const s = getSession();
    s.activeProject = 'my-app';
    const oldId = s.sessionId;
    resetSession();
    const s2 = getSession();
    expect(s2.sessionId).not.toBe(oldId);
    expect(s2.activeProject).toBe('my-app');
    expect(s2.isNewSession).toBe(true);
  });

  it('marks session as not new after markUsed', () => {
    const s = getSession();
    expect(s.isNewSession).toBe(true);
    s.markUsed();
    expect(s.isNewSession).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/session.test.js`
Expected: FAIL — module doesn't exist yet

- [ ] **Step 3: Implement session module**

```js
// src/session.js
import crypto from 'crypto';

let session = null;

function createSession(activeProject = null) {
  const sessionId = crypto.randomUUID();
  let isNew = true;
  return {
    activeProject,
    sessionId,
    busy: false,
    get isNewSession() { return isNew; },
    markUsed() { isNew = false; },
  };
}

export function getSession() {
  if (!session) {
    session = createSession();
  }
  return session;
}

export function resetSession() {
  const activeProject = session?.activeProject ?? null;
  session = createSession(activeProject);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/session.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session.js test/session.test.js
git commit -m "feat: add session module with UUID-based conversation tracking"
```

---

### Task 2: Update claude.js for session-aware streaming

**Files:**
- Modify: `src/claude.js`
- Modify: `test/claude.test.js`

- [ ] **Step 1: Write the failing tests**

Replace `test/claude.test.js` with tests that verify:
- First message uses `--session-id <uuid>` flag
- Resumed message uses `--resume <uuid>` flag
- Both include `--output-format stream-json --verbose`
- `onProgress` callback is called with text chunks from stream-json
- Final result contains the full assembled text
- Timeout still works

```js
// test/claude.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runClaude } from '../src/claude.js';
import { spawn } from 'child_process';

vi.mock('child_process');
vi.mock('tree-kill', () => ({ default: vi.fn() }));

describe('runClaude', () => {
  let mockProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      pid: 1234,
      kill: vi.fn(),
    };
    spawn.mockReturnValue(mockProcess);
  });

  it('uses --session-id for new sessions', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });
    mockProcess.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') {
        cb(Buffer.from(JSON.stringify({
          type: 'result', subtype: 'success', result: 'done', is_error: false,
        }) + '\n'));
      }
    });
    mockProcess.stderr.on.mockImplementation(() => {});

    await runClaude('test', '/proj', { sessionId: 'abc-123', isNew: true });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', 'test', '--session-id', 'abc-123', '--output-format', 'stream-json', '--verbose']),
      expect.any(Object)
    );
  });

  it('uses --resume for existing sessions', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });
    mockProcess.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') {
        cb(Buffer.from(JSON.stringify({
          type: 'result', subtype: 'success', result: 'done', is_error: false,
        }) + '\n'));
      }
    });
    mockProcess.stderr.on.mockImplementation(() => {});

    await runClaude('test', '/proj', { sessionId: 'abc-123', isNew: false });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', 'test', '--resume', 'abc-123']),
      expect.any(Object)
    );
  });

  it('calls onProgress with assistant text', async () => {
    const onProgress = vi.fn();
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });
    mockProcess.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') {
        cb(Buffer.from(
          JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hello' }] } }) + '\n' +
          JSON.stringify({ type: 'result', subtype: 'success', result: 'hello', is_error: false }) + '\n'
        ));
      }
    });
    mockProcess.stderr.on.mockImplementation(() => {});

    const result = await runClaude('test', '/proj', {
      sessionId: 'abc-123', isNew: true, onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith('hello');
    expect(result).toEqual({ success: true, output: 'hello' });
  });

  it('returns error on non-zero exit', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(1), 10);
    });
    mockProcess.stdout.on.mockImplementation(() => {});
    mockProcess.stderr.on.mockImplementation((event, cb) => {
      if (event === 'data') cb(Buffer.from('bad'));
    });

    const result = await runClaude('fail', '/proj', { sessionId: 'x', isNew: true });
    expect(result.success).toBe(false);
  });

  it('returns timeout error when process exceeds time limit', async () => {
    vi.useFakeTimers();
    const { default: kill } = await import('tree-kill');

    let closeCallback;
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') closeCallback = cb;
    });
    mockProcess.stdout.on.mockImplementation(() => {});
    mockProcess.stderr.on.mockImplementation(() => {});

    const resultPromise = runClaude('slow', '/proj', { sessionId: 'x', isNew: true });
    vi.advanceTimersByTime(10 * 60 * 1000);
    closeCallback(null);

    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(kill).toHaveBeenCalledWith(1234, 'SIGTERM');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/claude.test.js`
Expected: FAIL — runClaude signature changed

- [ ] **Step 3: Rewrite claude.js**

```js
// src/claude.js
import { spawn } from 'child_process';
import kill from 'tree-kill';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (conversations take longer)

export async function runClaude(prompt, projectDir, { sessionId, isNew, onProgress } = {}) {
  const args = ['-p', prompt];

  if (sessionId) {
    if (isNew) {
      args.push('--session-id', sessionId);
    } else {
      args.push('--resume', sessionId);
    }
  }

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/claude.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/claude.js test/claude.test.js
git commit -m "feat: session-aware claude runner with stream-json parsing"
```

---

### Task 3: Add "new chat" routing and simplify to single user

**Files:**
- Modify: `src/messages.js`
- Modify: `test/messages.test.js`

- [ ] **Step 1: Update tests**

Add "new chat" / "start over" route detection. Remove multi-user session tests (session module handles state now). Keep routing tests.

```js
// test/messages.test.js
import { describe, it, expect } from 'vitest';
import { routeMessage } from '../src/messages.js';

describe('routeMessage', () => {
  it('detects new chat command', () => {
    expect(routeMessage('new chat')).toEqual({ type: 'new_chat' });
    expect(routeMessage('start over')).toEqual({ type: 'new_chat' });
    expect(routeMessage('reset')).toEqual({ type: 'new_chat' });
  });

  it('detects list projects command', () => {
    expect(routeMessage('what projects do I have?')).toEqual({ type: 'list_projects' });
    expect(routeMessage('list my projects')).toEqual({ type: 'list_projects' });
    expect(routeMessage('show projects')).toEqual({ type: 'list_projects' });
  });

  it('detects switch project command', () => {
    expect(routeMessage('work on my-app')).toEqual({ type: 'switch_project', query: 'my-app' });
    expect(routeMessage('switch to portfolio')).toEqual({ type: 'switch_project', query: 'portfolio' });
  });

  it('detects current project query', () => {
    expect(routeMessage('what project am I on?')).toEqual({ type: 'current_project' });
    expect(routeMessage('current project')).toEqual({ type: 'current_project' });
  });

  it('treats everything else as a claude prompt', () => {
    expect(routeMessage('add a loading spinner')).toEqual({
      type: 'claude_prompt',
      prompt: 'add a loading spinner',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify new chat tests fail**

Run: `npx vitest run test/messages.test.js`
Expected: FAIL — "new chat" not detected

- [ ] **Step 3: Update messages.js**

Remove session management (moved to session.js). Add new_chat route.

```js
// src/messages.js
const NEW_CHAT_PATTERNS = [
  /^new chat$/i,
  /^start over$/i,
  /^reset$/i,
];

const LIST_PATTERNS = [
  /\b(list|show|what)\b.*\bprojects?\b/i,
];

const SWITCH_PATTERNS = [
  /\b(?:work on|switch to|use)\s+(.+)/i,
];

const CURRENT_PATTERNS = [
  /\b(?:what|which|current)\s+project\b/i,
];

export function routeMessage(text) {
  const trimmed = text.trim();

  for (const pattern of NEW_CHAT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'new_chat' };
    }
  }

  for (const pattern of CURRENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'current_project' };
    }
  }

  for (const pattern of LIST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'list_projects' };
    }
  }

  for (const pattern of SWITCH_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { type: 'switch_project', query: match[1].trim() };
    }
  }

  return { type: 'claude_prompt', prompt: trimmed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/messages.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/messages.js test/messages.test.js
git commit -m "feat: add new-chat routing, simplify to single-user"
```

---

### Task 4: Wire up index.js with sessions, streaming, and new chat

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Rewrite index.js**

Key changes:
- Import from `session.js` instead of per-user sessions from `messages.js`
- Remove `ALLOWED_USER_IDS` — single user, no allowlist
- Add `new_chat` handler that calls `resetSession()`
- Pass `sessionId` and `isNew` to `runClaude`
- Call `session.markUsed()` after first successful call
- Use `onProgress` to update Slack message in-place every ~2 seconds
- Keep chunker for final response (streaming updates are best-effort)

```js
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
  const session = getSession();

  const prefix = session.activeProject
    ? `:file_folder: *${session.activeProject}* ~ `
    : '';

  switch (route.type) {
    case 'new_chat': {
      resetSession();
      await say(`${prefix}:sparkles: Fresh conversation started.`);
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
      const UPDATE_INTERVAL = 2000; // update every 2s

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
          // Update the status message with final response (or first chunk)
          const chunks = chunkResponse(result.output);
          if (chunks.length > 0) {
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
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS (index.js has no unit tests — it's the integration entry point)

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: wire up conversation mode with streaming updates"
```

---

### Task 5: Remove ALLOWED_USER_IDS from env config

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update .env.example**

Remove `ALLOWED_USER_IDS` line since this is single-user.

```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
PROJECTS_DIR=/projects
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: remove ALLOWED_USER_IDS from env config"
```

---

### Task 6: Manual smoke test

- [ ] **Step 1: Start the app**

Run: `env $(cat .env | grep -v '^#' | xargs) node src/index.js`

- [ ] **Step 2: Test conversation flow in Slack DM**

1. "work on remote-claude" → should switch project
2. "what files are in src/" → should get response, see streaming updates
3. "what did you just tell me?" → should remember previous answer (conversation mode!)
4. "new chat" → should confirm fresh session
5. "what did you just tell me?" → should NOT remember (fresh session)

- [ ] **Step 3: Verify no regressions**

- "list projects" still works
- "current project" still works
- Error handling still works (bad project name, etc.)
