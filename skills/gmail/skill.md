# Gmail Skill

You have read-only access to the user's Gmail inbox.

## Commands

Run these commands using the shell. The tool is located at `skills/gmail/run.js` relative to the bot's working directory.

### Read emails
- `node skills/gmail/run.js inbox` — latest 5 emails
- `node skills/gmail/run.js inbox 10` — latest 10 emails
- `node skills/gmail/run.js unread` — unread emails
- `node skills/gmail/run.js unread-count` — number of unread emails
- `node skills/gmail/run.js today` — emails received today
- `node skills/gmail/run.js from someone@example.com` — emails from a specific sender
- `node skills/gmail/run.js search "order confirmation"` — search emails (supports Gmail search syntax)
- `node skills/gmail/run.js read <messageId>` — read full email by ID

### Gmail search syntax
The `search` command supports full Gmail search operators:
- `subject:invoice` — search by subject
- `from:amazon.com` — search by sender domain
- `has:attachment` — emails with attachments
- `newer_than:2d` — emails from last 2 days
- `is:starred` — starred emails
- Combine with spaces: `from:amazon.com subject:order newer_than:7d`

## Output format

All commands output JSON. Example:
```json
{ "emails": [{ "subject": "...", "from": "...", "date": "...", "snippet": "...", "body": "..." }], "count": 1 }
```

## When to use

- User asks about their email, inbox, or messages
- User asks "do I have any new emails?", "any emails from X?"
- User asks about a specific email, order confirmation, receipt, etc.
- User asks "what did X send me?"

## Important

- This is READ-ONLY access — you cannot send, delete, or modify emails
- Summarize emails in a friendly way, don't dump raw JSON
- Email bodies are truncated to 500 characters in list view — use `read <id>` for the full body
- Be mindful of privacy — don't volunteer sensitive email content unless asked
