# Remote Claude Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Slack bot that forwards prompts to Claude Code running on a Mac, enabling remote usage from a phone.

**Architecture:** A Node.js daemon running in Docker connects to Slack via Socket Mode (WebSocket), receives DMs, routes them as either project commands or Claude prompts, spawns `claude -p` against the selected project directory, and posts chunked responses as threaded Slack replies.

**Tech Stack:** Node.js 22, `@slack/bolt`, `@anthropic-ai/claude-code` (CLI), Docker, docker-compose

**Spec:** `docs/superpowers/specs/2026-03-21-remote-claude-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/index.js` | Entry point — Slack Bolt app setup, health check HTTP server, wires modules together |
| `src/projects.js` | Scans `/projects` volume, lists directories, case-insensitive substring matching |
| `src/messages.js` | Routes incoming messages to commands or Claude prompts, tracks session state + concurrency |
| `src/claude.js` | Spawns `claude -p` subprocess with timeout, collects output |
| `src/chunker.js` | Splits long text into Slack-safe chunks, respects code block boundaries |
| `package.json` | Dependencies: `@slack/bolt`, `tree-kill` |
| `Dockerfile` | Node 22 slim + Claude Code CLI, UID remapping |
| `docker-compose.yml` | Service definition with volumes, env vars, healthcheck |
| `.env.example` | Template for required environment variables |
| `test/projects.test.js` | Tests for project listing and matching |
| `test/chunker.test.js` | Tests for response chunking logic |
| `test/messages.test.js` | Tests for message routing |
| `test/claude.test.js` | Tests for Claude execution + timeout |

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/andrew/Projects/remote-claude
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @slack/bolt tree-kill
npm install -D vitest
```

- [ ] **Step 3: Create .env.example**

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
PROJECTS_DIR=/projects
ALLOWED_USER_IDS=
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
.env
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, set `"type": "module"` (required for ESM imports) and add scripts:
```json
{
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "vitest run"
  }
}
```

- [ ] **Step 6: Create src/ and test/ directories**

```bash
mkdir -p src test
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "feat: scaffold project with dependencies"
```

---

### Task 2: Project listing and matching (`src/projects.js`)

**Files:**
- Create: `test/projects.test.js`
- Create: `src/projects.js`

- [ ] **Step 1: Write failing tests**

```js
// test/projects.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProjects, matchProject } from '../src/projects.js';
import fs from 'fs';

vi.mock('fs');

describe('listProjects', () => {
  it('returns directories from the projects path', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'my-app', isDirectory: () => true },
      { name: '.DS_Store', isDirectory: () => false },
      { name: 'portfolio-site', isDirectory: () => true },
    ]);
    const result = listProjects('/projects');
    expect(result).toEqual(['my-app', 'portfolio-site']);
  });

  it('returns empty array when directory is empty', () => {
    fs.readdirSync.mockReturnValue([]);
    const result = listProjects('/projects');
    expect(result).toEqual([]);
  });
});

describe('matchProject', () => {
  const projects = ['my-app', 'portfolio-site', 'api-backend', 'remote-claude'];

  it('matches exact name', () => {
    expect(matchProject('my-app', projects)).toBe('my-app');
  });

  it('matches case-insensitive substring', () => {
    expect(matchProject('portfolio', projects)).toBe('portfolio-site');
  });

  it('matches case-insensitive', () => {
    expect(matchProject('API', projects)).toBe('api-backend');
  });

  it('returns null for no match', () => {
    expect(matchProject('nonexistent', projects)).toBeNull();
  });

  it('returns first match if multiple match', () => {
    const result = matchProject('a', projects);
    expect(projects).toContain(result);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/projects.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```js
// src/projects.js
import fs from 'fs';

export function listProjects(projectsDir) {
  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function matchProject(query, projects) {
  const q = query.toLowerCase();

  // Exact match first
  const exact = projects.find((p) => p.toLowerCase() === q);
  if (exact) return exact;

  // Substring match
  const matches = projects.filter((p) => p.toLowerCase().includes(q));
  return matches.length > 0 ? matches[0] : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/projects.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/projects.js test/projects.test.js
git commit -m "feat: add project listing and substring matching"
```

---

### Task 3: Response chunker (`src/chunker.js`)

**Files:**
- Create: `test/chunker.test.js`
- Create: `src/chunker.js`

- [ ] **Step 1: Write failing tests**

```js
// test/chunker.test.js
import { describe, it, expect } from 'vitest';
import { chunkResponse } from '../src/chunker.js';

describe('chunkResponse', () => {
  it('returns single chunk for short text', () => {
    const result = chunkResponse('Hello world');
    expect(result).toEqual(['Hello world']);
  });

  it('splits on double newlines when text exceeds limit', () => {
    const part1 = 'a'.repeat(2000);
    const part2 = 'b'.repeat(2000);
    const text = `${part1}\n\n${part2}`;
    const result = chunkResponse(text, 3900);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(part1);
    expect(result[1]).toBe(part2);
  });

  it('does not split inside a fenced code block', () => {
    const before = 'Some text\n\n';
    const codeBlock = '```js\n' + 'x = 1;\n'.repeat(500) + '```';
    const after = '\n\nMore text';
    const text = before + codeBlock + after;
    const chunks = chunkResponse(text, 3900);
    // The code block should be fully contained in one chunk
    const codeChunk = chunks.find((c) => c.includes('```js'));
    expect(codeChunk).toContain('```js');
    expect(codeChunk).toMatch(/```\s*$/m);
  });

  it('hard splits at limit when no natural boundary exists', () => {
    const text = 'a'.repeat(8000);
    const result = chunkResponse(text, 3900);
    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(3900);
    });
  });

  it('returns empty array for empty string', () => {
    expect(chunkResponse('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/chunker.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```js
// src/chunker.js
const DEFAULT_LIMIT = 3900;

export function chunkResponse(text, limit = DEFAULT_LIMIT) {
  if (!text) return [];
  if (text.length <= limit) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    let splitAt = findSplitPoint(remaining, limit);
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

function findSplitPoint(text, limit) {
  // Check if we're inside a code block at the limit
  const textUpToLimit = text.slice(0, limit);
  const fencesBefore = (textUpToLimit.match(/^```/gm) || []).length;

  if (fencesBefore % 2 !== 0) {
    // We're inside a code block — find the closing fence
    const closingFence = text.indexOf('\n```', limit);
    if (closingFence !== -1) {
      const endOfFence = text.indexOf('\n', closingFence + 1);
      return endOfFence !== -1 ? endOfFence : closingFence + 4;
    }
  }

  // Try double newline
  const doubleNewline = textUpToLimit.lastIndexOf('\n\n');
  if (doubleNewline > limit * 0.3) return doubleNewline;

  // Try single newline
  const singleNewline = textUpToLimit.lastIndexOf('\n');
  if (singleNewline > limit * 0.3) return singleNewline;

  // Hard split at limit
  return limit;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/chunker.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/chunker.js test/chunker.test.js
git commit -m "feat: add response chunker with code block awareness"
```

---

### Task 4: Claude execution (`src/claude.js`)

**Files:**
- Create: `test/claude.test.js`
- Create: `src/claude.js`

- [ ] **Step 1: Write failing tests**

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

  it('spawns claude with correct args', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });
    mockProcess.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') cb(Buffer.from('response'));
    });
    mockProcess.stderr.on.mockImplementation(() => {});

    const result = await runClaude('do something', '/projects/my-app');

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['-p', 'do something', '--project-dir', '/projects/my-app'],
      expect.objectContaining({ env: expect.any(Object) })
    );
    expect(result).toEqual({ success: true, output: 'response' });
  });

  it('returns error on non-zero exit code', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(1), 10);
    });
    mockProcess.stdout.on.mockImplementation(() => {});
    mockProcess.stderr.on.mockImplementation((event, cb) => {
      if (event === 'data') cb(Buffer.from('error msg'));
    });

    const result = await runClaude('fail', '/projects/my-app');

    expect(result.success).toBe(false);
    expect(result.error).toContain('error msg');
  });

  it('returns timeout error when process exceeds time limit', async () => {
    vi.useFakeTimers();
    const { default: kill } = await import('tree-kill');

    // Process never closes on its own
    let closeCallback;
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') closeCallback = cb;
    });
    mockProcess.stdout.on.mockImplementation(() => {});
    mockProcess.stderr.on.mockImplementation(() => {});

    const resultPromise = runClaude('slow task', '/projects/my-app');

    // Advance past the 5-minute timeout
    vi.advanceTimersByTime(5 * 60 * 1000);

    // Simulate process closing after being killed
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
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```js
// src/claude.js
import { spawn } from 'child_process';
import kill from 'tree-kill';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function runClaude(prompt, projectDir) {
  const proc = spawn(
    'claude',
    ['-p', prompt, '--project-dir', projectDir],
    { env: { ...process.env, NO_COLOR: '1' } }
  );

  let stdout = '';
  let stderr = '';
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    kill(proc.pid, 'SIGTERM');
  }, TIMEOUT_MS);

  proc.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  return new Promise((resolve) => {
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        resolve({ success: false, error: 'Claude timed out after 5 minutes' });
      } else if (code === 0) {
        resolve({ success: true, output: stdout });
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
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/claude.js test/claude.test.js
git commit -m "feat: add Claude CLI execution with timeout"
```

---

### Task 5: Message routing (`src/messages.js`)

**Files:**
- Create: `test/messages.test.js`
- Create: `src/messages.js`

- [ ] **Step 1: Write failing tests**

```js
// test/messages.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { routeMessage, getSession, resetSessions } from '../src/messages.js';

describe('routeMessage', () => {
  beforeEach(() => {
    resetSessions();
  });

  it('detects list projects command', () => {
    expect(routeMessage('what projects do I have?')).toEqual({
      type: 'list_projects',
    });
    expect(routeMessage('list my projects')).toEqual({
      type: 'list_projects',
    });
    expect(routeMessage('show projects')).toEqual({
      type: 'list_projects',
    });
  });

  it('detects switch project command', () => {
    expect(routeMessage('work on my-app')).toEqual({
      type: 'switch_project',
      query: 'my-app',
    });
    expect(routeMessage('switch to portfolio')).toEqual({
      type: 'switch_project',
      query: 'portfolio',
    });
    expect(routeMessage('use api-backend')).toEqual({
      type: 'switch_project',
      query: 'api-backend',
    });
  });

  it('detects current project query', () => {
    expect(routeMessage('what project am I on?')).toEqual({
      type: 'current_project',
    });
    expect(routeMessage('which project')).toEqual({
      type: 'current_project',
    });
    expect(routeMessage('current project')).toEqual({
      type: 'current_project',
    });
  });

  it('treats everything else as a claude prompt', () => {
    expect(routeMessage('add a loading spinner')).toEqual({
      type: 'claude_prompt',
      prompt: 'add a loading spinner',
    });
  });
});

describe('session management', () => {
  beforeEach(() => {
    resetSessions();
  });

  it('tracks active project per user', () => {
    const session = getSession('U123');
    expect(session.activeProject).toBeNull();
    session.activeProject = 'my-app';
    expect(getSession('U123').activeProject).toBe('my-app');
  });

  it('tracks busy state per user', () => {
    const session = getSession('U123');
    expect(session.busy).toBe(false);
  });

  it('isolates sessions between users', () => {
    getSession('U123').activeProject = 'my-app';
    expect(getSession('U456').activeProject).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/messages.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```js
// src/messages.js
const sessions = new Map();

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

  for (const pattern of CURRENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'current_project' };
    }
  }

  return { type: 'claude_prompt', prompt: trimmed };
}

export function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { activeProject: null, busy: false });
  }
  return sessions.get(userId);
}

export function resetSessions() {
  sessions.clear();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/messages.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/messages.js test/messages.test.js
git commit -m "feat: add message routing and session management"
```

---

### Task 6: Main entry point (`src/index.js`)

**Files:**
- Create: `src/index.js`

- [ ] **Step 1: Write the entry point**

```js
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
```

- [ ] **Step 2: Verify syntax by running a quick parse check**

Run: `node --check src/index.js`
Expected: No output (clean parse)

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: add main entry point with Slack message handling"
```

---

### Task 7: Docker setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:22-slim

# curl needed for Docker healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Match macOS host user UID (501) so volume mounts work correctly
ARG HOST_UID=501
RUN usermod -u ${HOST_UID} node

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

USER node
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --production
COPY --chown=node:node src/ ./src/

CMD ["node", "src/index.js"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
services:
  remote-claude:
    build: .
    restart: always
    volumes:
      - ~/.claude:/home/node/.claude
      - ~/Projects:/projects:rw
    environment:
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_APP_TOKEN=${SLACK_APP_TOKEN}
      - PROJECTS_DIR=/projects
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

- [ ] **Step 3: Verify compose config**

Run: `docker compose config`
Expected: Parsed config output, no errors

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Docker and docker-compose configuration"
```

---

### Task 8: Slack App setup guide + smoke test

**Files:**
- Create: `SETUP.md`

- [ ] **Step 1: Write setup guide**

Create `SETUP.md` with step-by-step instructions for:
1. Go to https://api.slack.com/apps → Create New App → From Scratch
2. Name: "Remote Claude", pick your workspace
3. Enable Socket Mode (Settings → Socket Mode → toggle on) → generate app-level token with `connections:write` scope → copy as `SLACK_APP_TOKEN`
4. OAuth & Permissions → add bot scopes: `chat:write`, `im:history`, `im:read`, `im:write`
5. Install to workspace → copy Bot User OAuth Token as `SLACK_BOT_TOKEN`
6. Event Subscriptions → toggle on → subscribe to `message.im`
7. App Home → toggle "Allow users to send Slash commands and messages from the messages tab"
8. Copy `.env.example` to `.env`, fill in tokens
9. `docker compose up -d`
10. DM the bot in Slack: "list projects"

- [ ] **Step 2: Create .env from example and fill in tokens**

```bash
cp .env.example .env
# User fills in their tokens
```

- [ ] **Step 3: Build and run**

```bash
docker compose up -d --build
```

- [ ] **Step 4: Smoke test — DM the bot "list projects"**

Expected: Bot replies with a list of directories from ~/Projects

- [ ] **Step 5: Smoke test — "work on remote-claude" then "what files are in this project?"**

Expected: Bot switches project, then Claude responds with file listing

- [ ] **Step 6: Commit**

```bash
git add SETUP.md
git commit -m "docs: add Slack app setup guide"
```
