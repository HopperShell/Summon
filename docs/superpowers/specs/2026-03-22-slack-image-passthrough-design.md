# Slack Image Passthrough to Claude CLI

## Summary

Allow images pasted in Slack DMs to be forwarded to Claude CLI for vision processing. Images are downloaded from Slack, base64-encoded, and piped to `claude` via `--input-format stream-json` as native image content blocks.

## Scope

- **In scope:** PNG, JPEG, GIF, WEBP images from Slack DMs
- **Out of scope:** PDFs, other file types, other adapters (Discord/Telegram/WhatsApp) — these can be added later using the same mechanism

## Design

### Slack Adapter (`src/adapters/slack.js`)

**Current behavior:** Filters out any message with a `subtype` or without `text`. File shares have `subtype: 'file_share'` and are silently dropped.

**New behavior:**

1. Allow messages that have `files` even if they have a `subtype` or no `text`
2. Filter `message.files` to supported image MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
3. Skip files over 10MB
4. Download each file from `url_private` using `Authorization: Bearer ${SLACK_BOT_TOKEN}`
5. Base64-encode the downloaded buffer
6. Pass to handler: `{ chatId, text, userId, originalTs, files: [{ base64, mediaType }] }`

**Requires:** `files:read` Slack bot scope (likely already present).

### Core Layer (`src/core.js`)

- Accept `files` in `handleMessage` arguments (defaults to `[]`)
- `routeMessage` unchanged — routing is text-based only
- Pass `files` through to `runClaude` when route is `claude_prompt`
- If files present but no text, use default prompt: `"What's in this image?"`

### Claude Integration (`src/claude.js`)

**Current behavior:** `spawn('claude', ['-p', prompt])` with `stdin: 'ignore'`.

**New behavior:**

1. Always use `--input-format stream-json` alongside `-p ""`
2. Set `stdin` to `'pipe'` instead of `'ignore'`
3. Build Anthropic `MessageParam` content array:
   - Text-only: `[{ type: "text", text: prompt }]`
   - Images + text: `[...imageBlocks, { type: "text", text: prompt }]`
   - Images only: `[...imageBlocks, { type: "text", text: "What's in this image?" }]`
4. Image blocks use format: `{ type: "image", source: { type: "base64", media_type, data } }`
5. Write the user message as NDJSON to stdin, then close stdin
6. All other behavior unchanged: output parsing, streaming, timeouts, sessions

### Base Adapter (`src/adapters/base.js`)

- Add `canSendImages: false` to default capabilities (documentation only, not enforced)
- Slack overrides to `canSendImages: true`

### Handler Signature

The `_handler` callback signature becomes:

```
{ chatId, text, userId, originalTs?, files? }
```

Where `files` is `Array<{ base64: string, mediaType: string }>` defaulting to `[]`. Adapters that don't support images simply don't pass it — no changes needed.

## Security

- **File type whitelist:** Only `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- **Size cap:** 10MB per file, skip with console warning
- **No persistence:** Images are held in memory only for the duration of the request
- **Auth:** Slack file download uses existing bot token, no new credentials

## Backward Compatibility

- Text-only messages from any adapter work identically to before
- Adapters that don't pass `files` are unaffected
- The `runClaude` function handles both text-only and multimodal transparently

## Files Changed

| File | Change |
|------|--------|
| `src/adapters/slack.js` | File extraction, download, base64 encoding |
| `src/adapters/base.js` | Add `canSendImages` capability flag |
| `src/core.js` | Pass `files` through to `runClaude` |
| `src/claude.js` | Switch to stdin + stream-json input, build content blocks |

## Future Work

- PDF support (add to whitelist + use `document` content block type)
- Discord image support (`message.attachments`)
- Telegram image support (`message:photo` event)
- WhatsApp image support (Baileys `imageMessage`)
