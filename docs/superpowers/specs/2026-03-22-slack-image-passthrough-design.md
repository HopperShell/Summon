# Slack Image Passthrough to Claude CLI

## Summary

Allow images pasted in Slack DMs to be forwarded to Claude CLI for vision processing. Images are downloaded from Slack, base64-encoded, and piped to `claude` via `--input-format stream-json` as native image content blocks.

## Scope

- **In scope:** PNG, JPEG, GIF, WEBP images from Slack DMs
- **Out of scope:** PDFs, other file types, other adapters (Discord/Telegram/WhatsApp) — these can be added later using the same mechanism

## Design

### Slack Adapter (`src/adapters/slack.js`)

**Current behavior:** Filters out any message with a `subtype` (which includes file shares, edits, deletions, bot messages, etc.) or without `text`. This means image uploads are silently dropped.

**New behavior:**

1. Allow messages that have `files` even if they have a `subtype` or no `text`
2. Still filter out non-file subtypes (`message_changed`, `message_deleted`, `bot_message`, etc.) — only allow through if `message.files` has supported images
3. Filter `message.files` to supported image MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
4. Skip individual files over 10MB with a console warning; proceed with remaining valid files
5. Download each file from `url_private` using `Authorization: Bearer ${SLACK_BOT_TOKEN}`
6. Base64-encode the downloaded buffer
7. Pass to handler: `{ chatId, text, userId, originalTs, files: [{ base64, mediaType }] }`
8. If all file downloads fail, log the error and send the message as text-only (or drop if no text either)

**Requires:** `files:read` Slack bot scope (likely already present).

### Core Layer (`src/core.js`)

- Accept `files` in `handleMessage` arguments (defaults to `[]`)
- **Before calling `routeMessage`:** if `files` is non-empty and `text` is falsy/empty, substitute `text` with `"What's in this image?"`
- `routeMessage` unchanged — routing is text-based only, always receives a valid string
- Pass `files` through to `runClaude` when route is `claude_prompt`

### Claude Integration (`src/claude.js`)

**Current behavior:** `spawn('claude', ['-p', prompt])` with `stdin: 'ignore'`.

**New behavior:**

1. When files are present, use `--input-format stream-json` alongside `-p` and pipe via stdin
2. When no files, keep the current behavior (`-p prompt`, stdin ignored) — no change to the text-only path
3. Set `stdin` to `'pipe'` when using stream-json
4. Build Anthropic `MessageParam` content array:
   - Images + text: `[...imageBlocks, { type: "text", text: prompt }]`
5. Image blocks use format: `{ type: "image", source: { type: "base64", media_type, data } }`
6. Write the full NDJSON envelope to stdin, then close stdin:

```json
{"type":"user","message":{"role":"user","content":[{"type":"image","source":{"type":"base64","media_type":"image/png","data":"..."}},{"type":"text","text":"What's in this image?"}]},"parent_tool_use_id":null,"session_id":"<session-uuid>"}
```

7. Session ID is passed in the NDJSON envelope's `session_id` field. CLI flags `--session-id`/`--resume` are still used as before for session management.
8. All other behavior unchanged: output parsing, streaming, timeouts

**Note:** `--input-format stream-json` is not fully documented by Anthropic (see [#24594](https://github.com/anthropics/claude-code/issues/24594)). The NDJSON envelope format is based on the Agent SDK's `SDKUserMessage` type. If this proves unreliable, the fallback approach is to save images to temp files and reference them in the text prompt for Claude's Read tool to pick up.

### Base Adapter (`src/adapters/base.js`)

- Add `canSendImages: false` to default capabilities (documentation only, not enforced)
- Slack adapter adds `canSendImages: true` to its capabilities object

### Handler Signature

The `_handler` callback signature becomes:

```
{ chatId, text, userId, originalTs?, files? }
```

Where `files` is `Array<{ base64: string, mediaType: string }>` defaulting to `[]`. Adapters that don't support images simply don't pass it — no changes needed.

## Security

- **File type whitelist:** Only `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- **Size cap:** 10MB per file, skip with console warning; proceed with valid files
- **No persistence:** Images are held in memory only for the duration of the request
- **Auth:** Slack file download uses existing bot token, no new credentials

## Error Handling

- **Download failure:** Log error, skip that file, proceed with remaining files. If no files retrieved and no text, drop the message.
- **Oversized files:** Skip individually, proceed with rest. Log warning.
- **All files filtered out:** Treat as text-only message (or drop if no text).

## Backward Compatibility

- Text-only messages from any adapter work identically to before — `runClaude` only switches to stream-json when files are present
- Adapters that don't pass `files` are unaffected
- The `runClaude` function handles both text-only and multimodal transparently

## Files Changed

| File | Change |
|------|--------|
| `src/adapters/slack.js` | File extraction, download, base64 encoding |
| `src/adapters/base.js` | Add `canSendImages` capability flag |
| `src/core.js` | Default prompt substitution, pass `files` through to `runClaude` |
| `src/claude.js` | Add stream-json stdin path for multimodal messages |

## Future Work

- PDF support (add to whitelist + use `document` content block type)
- Discord image support (`message.attachments`)
- Telegram image support (`message:photo` event)
- WhatsApp image support (Baileys `imageMessage`)
