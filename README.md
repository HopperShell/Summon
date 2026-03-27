<p align="center">
  <img src="docs/logo.png" alt="Summon" width="400"/>
</p>

<h1 align="center">Summon</h1>

> **Early beta** — this project is under active development. Things may break, APIs may change. Contributions and feedback welcome.

Talk to Claude from your chat apps. Powered by [Claude Code CLI](https://code.claude.com) and your Claude Max subscription — no API keys, no per-token costs.

Send a message in Slack, Claude works on your codebase and responds. Paste an image, Claude sees it. It's Claude Code, but you reach it from wherever you already are.

## How it works

Summon runs on your machine (or a server), connects to your chat apps via their bot APIs, and forwards messages to `claude -p` — the same CLI you use in your terminal. Responses stream back to the chat.

<p align="center">
  <img src="docs/architecture.svg" alt="Summon Architecture" width="100%"/>
</p>

- **Project mode** — `!work my-app` points Claude at a project directory. Every message becomes a coding task with full file access.
- **General mode** — Without a project selected, Claude acts as a general assistant.
- **Image support** — Paste screenshots, schedules, diagrams. Claude sees them via vision.
- **Skills** — Claude has access to real-time data through built-in skills (see below).
- **Session continuity** — Conversations persist across messages, so Claude has context.

## Skills

Skills give Claude access to live, personal data it wouldn't otherwise have. Claude automatically uses the right skill based on your message — just ask naturally.

| Skill | What it does | Data source |
|-------|-------------|-------------|
| **Calendar** | Check your schedule, create/delete events | Google Calendar |
| **Gmail** | Search and read your emails | Gmail (read-only) |
| **Weather** | Current conditions and forecasts | Open-Meteo API |
| **News** | Headlines and top stories | Google News RSS |
| **Sports** | Live scores, schedules, standings for 30+ leagues | ESPN |
| **Packages** | Track deliveries by scanning your Gmail for shipping emails | Gmail + carrier URLs |
| **Finance** | Account balances, transactions, budgets, net worth, cashflow | Monarch Money |
| **GroupMe** | Read and send GroupMe messages | GroupMe API |

### Example questions

- "Do I have any meetings tomorrow?"
- "What's the weather this weekend?"
- "Did the Vols win?"
- "Where's my Amazon package?"
- "How much did I spend on restaurants this month?"
- "What's my net worth?"
- "Any new emails from my boss?"
- "What's the news today?"

## Supported chat apps

| App | Status | Features |
|-----|--------|----------|
| Slack | Stable | Text, images, message editing, reactions |
| Discord | Stable | Text, message editing, reactions |
| Telegram | Stable | Text, message editing, reactions |
| WhatsApp | Experimental | Text only |

## Quick start

### Prerequisites

- Node.js 20+
- [Claude Code CLI](https://code.claude.com) installed and authenticated
- A Claude Max subscription (or Pro — Max recommended for heavier use)

### 1. Clone and install

```bash
git clone https://github.com/HopperShell/summon.git
cd summon
npm install
```

### 2. Set up a chat app

You need at least one. See [SETUP.md](SETUP.md) for detailed Slack setup instructions.

**Slack (recommended):**
1. Create a Slack app at https://api.slack.com/apps
2. Enable Socket Mode, add bot scopes: `chat:write`, `files:read`, `im:history`, `im:read`, `im:write`, `reactions:write`
3. Subscribe to `message.im` events
4. Install to workspace

### 3. Configure

```bash
cp .env.example .env
# Fill in your bot tokens
```

### 4. Set up skills (optional)

Skills that use public APIs work immediately with no setup. Others need credentials:

#### Weather, News, Sports
No setup needed — these use free public APIs (Open-Meteo, Google News RSS, ESPN).

#### Gmail & Calendar (Google OAuth)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project, enable the Gmail API and Google Calendar API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Download the credentials file and save as `credentials.json` in the project root
5. Run the OAuth flow to generate `token.json` (you'll be prompted to authorize in your browser)

#### Packages
No additional setup — uses the Gmail skill to scan your inbox for shipping emails and extract tracking numbers/URLs. Requires Gmail to be configured (see above).

#### Finance (Monarch Money)
1. Log in to [app.monarch.com](https://app.monarch.com) in your browser
2. Open DevTools (F12) → **Network** tab
3. Filter requests by `api.monarch` to cut through the noise
4. Click any request to `api.monarch.com` → look at the **Headers** tab
5. Copy the value after `Authorization: Token ` (the long string of letters/numbers)
6. Run: `node skills/finance/run.js set-token <your-token>`

The token lasts several months. When it expires, repeat the steps above.

#### GroupMe
1. Go to [dev.groupme.com](https://dev.groupme.com)
2. Log in and grab your access token from the top of the page
3. Add to your `.env` file: `GROUPME_TOKEN=your-token-here`

### 5. Run

```bash
./start.sh
```

Or directly:

```bash
node src/index.js
```

## Usage

| Command | What it does |
|---------|-------------|
| `!work <project>` | Switch to a project (coding mode) |
| `!stop` | Back to general assistant mode |
| `!projects` | List available projects |
| `!new` | Start a fresh conversation |
| `!status` | Show current project and session |
| `!calendar` | Today's events |
| `!help` | Show all commands |

In project mode, every message goes to Claude Code with full access to your codebase. Ask it to write code, fix bugs, review files — anything you'd do in the terminal.

## Why Claude Code CLI?

Summon uses `claude -p` (Claude Code's non-interactive mode) under the hood. This is the same official CLI that powers CI/CD integrations, GitHub Actions, and scripted workflows. Your messages are processed by the real Claude Code binary — not a third-party wrapper, not an extracted token.

This means you get Claude Code's full capabilities: file editing, shell commands, project context, and tool use — all triggered from a chat message instead of a terminal prompt.

## Project structure

```
src/
  index.js          — Entry point, adapter loading
  core.js           — Message routing and handling
  claude.js         — Claude CLI integration
  messages.js       — Command parsing
  session.js        — Conversation session management
  chunker.js        — Response splitting for message limits
  markdown.js       — Markdown conversion per platform
  projects.js       — Project directory listing
  skills.js         — Skills/tools framework
  calendar.js       — Google Calendar integration
  gmail.js          — Gmail read-only access
  monarch.js        — Monarch Money finance integration
  tracking.js       — Package tracking via Gmail
  adapters/
    base.js         — Base adapter interface
    slack.js        — Slack (Socket Mode)
    discord.js      — Discord
    telegram.js     — Telegram (grammy)
    whatsapp.js     — WhatsApp (Baileys)
skills/
  calendar/         — Google Calendar skill
  finance/          — Monarch Money (accounts, budgets, cashflow)
  gmail/            — Gmail inbox access
  groupme/          — GroupMe messaging
  news/             — News headlines
  packages/         — Package tracking via Gmail
  sports/           — ESPN scores and standings
  weather/          — Weather forecasts
```

## License

ISC
