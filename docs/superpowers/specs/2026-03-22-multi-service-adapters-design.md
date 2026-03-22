# Multi-Service Chat Adapter Design

## Goal
Support Slack, Discord, Telegram, and WhatsApp through a common adapter interface. Auto-detect which services to start based on env vars.

## Approach
Adapter pattern. Each service implements: `connect()`, `sendMessage()`, `updateMessage()`, `addReaction()`, plus a `capabilities` object. Core logic calls adapter methods and branches on capabilities (edit-in-place streaming vs block streaming for WhatsApp).

## File Structure
```
src/
  index.js              → bootstrap: detect tokens, start adapters
  core.js               → extracted message handling + claude orchestration
  adapters/
    base.js             → BaseAdapter class
    slack.js            → @slack/bolt, socket mode
    discord.js          → discord.js, gateway websocket
    telegram.js         → grammy, long polling
    whatsapp.js         → baileys, QR auth
  markdown.js           → per-service markdown conversion
  session.js            → sessions keyed by adapter:chatId
  claude.js             → unchanged
  messages.js           → unchanged
  chunker.js            → parameterized max length
  projects.js           → unchanged
```

## Adapter Capabilities
| Service | Edit msgs | React | Thread | Max length | Markdown |
|---------|-----------|-------|--------|------------|----------|
| Slack | yes | yes | yes | 3900 | slack-mrkdwn |
| Discord | yes | yes | yes | 2000 | standard |
| Telegram | yes | yes | no | 4096 | telegram-html |
| WhatsApp | no | no | no | 4096 | whatsapp |

## Key Decisions
- Token present → service starts. No config files.
- WhatsApp uses `WHATSAPP_ENABLED=true` + `WHATSAPP_ALLOWED_NUMBER` (QR auth, no token)
- Sessions keyed by `adapter:chatId` for independent conversations per service
- WhatsApp gets block streaming (separate messages), others get edit-in-place streaming
- Markdown converted from Claude's output per adapter format

## New Dependencies
- `discord.js` — Discord
- `grammy` — Telegram
- `baileys` — WhatsApp
