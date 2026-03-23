# Remote Claude — Setup Guide

Step-by-step instructions for setting up the Slack app and running the bot.

## Prerequisites

- Docker and docker-compose installed
- A Slack workspace where you can create apps

---

## 1. Create the Slack App

1. Go to https://api.slack.com/apps → "Create New App" → "From Scratch"
2. Name: "Remote Claude" (or whatever you want), pick your workspace

## 2. Configure Socket Mode

1. Settings → Socket Mode → toggle ON
2. Generate an app-level token with `connections:write` scope
3. Copy this token — it's your `SLACK_APP_TOKEN` (starts with `xapp-`)

## 3. Set Bot Permissions

1. OAuth & Permissions → Bot Token Scopes → add:
   - `chat:write`
   - `files:read` (for image support)
   - `im:history`
   - `im:read`
   - `im:write`
   - `reactions:write`

## 4. Subscribe to Events

1. Event Subscriptions → toggle ON
2. Subscribe to bot events: `message.im`

## 5. Enable DMs

1. App Home → "Allow users to send Slash commands and messages from the messages tab" → toggle ON

## 6. Install to Workspace

1. OAuth & Permissions → "Install to Workspace" → Authorize
2. Copy the "Bot User OAuth Token" — it's your `SLACK_BOT_TOKEN` (starts with `xoxb-`)

## 7. Configure Environment

```bash
cp .env.example .env
# Edit .env and fill in:
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_APP_TOKEN=xapp-...
```

## 8. Run

```bash
docker compose up -d --build
```

## 9. Verify

1. Open Slack → find "Remote Claude" in your apps → send it a DM
2. Type: `list projects`
3. You should see a list of directories from ~/Projects

---

## Useful Commands

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Rebuild after code changes
docker compose up -d --build

# Stop
docker compose down
```
