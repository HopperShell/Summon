# Remote Claude — Design Spec

## Overview

A Slack-based interface for sending prompts to Claude Code running on your Mac from anywhere (phone, tablet, another computer). A Dockerized daemon listens for Slack messages, pipes them to the Claude Code CLI, and posts responses back as threaded replies.

## Core User Experience

You DM the bot or post in a dedicated Slack channel. No paths to remember — you interact naturally:

```
You: what projects do I have?
Bot: Here's what's available:
     • remote-claude
     • my-app
     • portfolio-site
     • api-backend

You: work on my-app
Bot: Switched to my-app. What do you want to do?

You: add a loading spinner to the dashboard
Bot: [streams Claude's response as thread replies]
```

The bot remembers your active project for the session. You can switch anytime with natural language ("switch to portfolio", "work on api-backend", etc.).

## Architecture

### Components

```
┌──────────────┐     WebSocket      ┌─────────────────────────┐
│  Slack App   │◄──────────────────►│  Docker Container       │
│  (Slack API) │   (Socket Mode)    │                         │
└──────────────┘                    │  ┌───────────────────┐  │
                                    │  │  Listener Daemon   │  │
                                    │  │  (Node.js)         │  │
                                    │  └────────┬──────────┘  │
                                    │           │              │
                                    │           ▼              │
                                    │  ┌───────────────────┐  │
                                    │  │  Claude Code CLI   │  │
                                    │  │  (claude -p "...")  │  │
                                    │  └────────┬──────────┘  │
                                    │           │              │
                                    │           ▼              │
                                    │  ┌───────────────────┐  │
                                    │  │  ~/Projects (vol)  │  │
                                    │  └───────────────────┘  │
                                    └─────────────────────────┘
```

### 1. Slack App (Configuration — not code)

- Created in the Slack API dashboard
- **Socket Mode** enabled — no public URL needed
- Bot token scopes: `chat:write`, `im:history`, `im:read`, `im:write`
- App-level token for Socket Mode connection
- Listens for direct messages to the bot (DM-only for v1 — channel messages are ignored)

### 2. Listener Daemon (Node.js)

The core process. Responsibilities:

- **Slack connection**: Connects to Slack via `@slack/bolt` in Socket Mode
- **Message routing**: Determines if a message is a command (list projects, switch project) or a prompt for Claude
- **Project management**: Scans `/projects` volume, tracks active project per user, matches project names via case-insensitive substring (e.g. "portfolio" matches "portfolio-site"). No fuzzy matching library needed for v1
- **Claude execution**: Spawns `claude -p "<prompt>" --project-dir /projects/<name>` (the `-p` flag runs Claude in non-interactive print mode)
- **Response handling**: Chunks Claude's output into Slack messages (4000 char limit per message), posts as threaded replies
- **Session state**: Tracks active project per Slack user ID (in-memory, resets on restart — fine for v1)
- **Concurrency**: One prompt at a time per user. If a second message arrives while Claude is running, reply with "Still working on your last request..." and ignore it

### 3. Docker Container

```dockerfile
FROM node:22-slim

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

```yaml
# docker-compose.yml
services:
  remote-claude:
    build: .
    restart: always
    volumes:
      - ~/Projects:/projects:rw             # User's project directories
    environment:
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_APP_TOKEN=${SLACK_APP_TOKEN}
      - PROJECTS_DIR=/projects
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}   # Use API key auth (simpler than OAuth in Docker)
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

## Message Handling Logic

```
Message received from Slack
│
├─ Matches "list projects" / "what projects" / "show projects"
│  └─ Scan /projects, list directories, reply
│
├─ Matches "work on <X>" / "switch to <X>" / "use <X>"
│  └─ Case-insensitive substring match against project directories
│     ├─ Match found → set active project, confirm
│     └─ No match → suggest closest matches
│
├─ Matches "what project" / "which project" / "current project"
│  └─ Reply with current active project (or "none selected")
│
└─ Anything else → treat as a prompt for Claude
   ├─ No active project → ask user to pick one first
   ├─ Claude already running for this user → reply "Still working on your last request..."
   └─ Active project set → execute Claude, stream response
```

## Response Chunking

Slack limits messages to ~4000 characters. Claude responses can be much longer.

Strategy:
- Split response on natural boundaries (double newlines, then single newlines, then at 3900 chars)
- **Never split inside a fenced code block** — if a chunk boundary falls inside triple backticks, extend the chunk to the closing fence, or close and reopen the fence at the boundary
- Post each chunk as a reply in the same thread with a 1-second delay between messages (Slack rate limit: ~1 msg/sec/channel)
- First message in thread is the original prompt (quoted)
- Add a ✅ reaction to the original message when done, ❌ if Claude errors

## Error Handling

- **Claude process fails**: Post error message in thread, add ❌ reaction
- **Claude times out**: Kill process after 5 minutes using `AbortController` signal passed to `child_process.spawn`, ensuring the entire process tree is killed (use `kill(-pid)` or `tree-kill`). Post timeout message
- **Slack disconnects**: `@slack/bolt` auto-reconnects in Socket Mode
- **Container crashes**: `restart: always` in docker-compose brings it back
- **Hung process**: The listener logs a heartbeat every 60 seconds. Docker `healthcheck` in compose pings a simple HTTP endpoint on the daemon (e.g. `GET /health` on port 3000) — if it fails 3 times, Docker restarts the container
- **No active project**: Reply asking user to pick one

## Security Considerations

- **Slack auth is the perimeter** — only users in your Slack workspace can message the bot
- **Single-user mode for v1** — the bot responds to any DM. If you want to lock it to just your user ID, set `ALLOWED_USER_IDS` env var
- **No secrets in the image** — tokens come from env vars / `.env` file
- **Projects mounted read-write** — Claude needs to edit files. This is intentional.

## File Structure

```
remote-claude/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── src/
│   ├── index.js              # Entry point, Slack bolt app setup
│   ├── claude.js             # Spawns claude CLI, handles output
│   ├── projects.js           # Scans /projects, fuzzy matching
│   ├── messages.js           # Message routing + command parsing
│   └── chunker.js            # Splits long responses for Slack
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-03-21-remote-claude-design.md
```

## What v1 Does NOT Include

- **No multi-turn conversations** — each prompt is independent (no `--continue` or `--resume`). Add in v2.
- **No file uploads** — can't send images/files from Slack to Claude. Add later.
- **No queue** — if your Mac is off, messages just won't get a response until it's back
- **No persistent session state** — active project resets on container restart

## Future Considerations (not for v1)

- Multi-turn conversations using `--resume` with session IDs stored per Slack thread
- Slash commands (`/claude`, `/project`) for more structured interaction
- Status indicators (typing indicator while Claude is working)
- Project bookmarks / favorites
- Notification when long-running tasks complete
