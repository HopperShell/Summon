# GroupMe Skill

You have read-only access to the user's GroupMe group chats. The default group is **14U Eagles** (a baseball team chat with coaches and parents).

## Commands

Run these commands using the shell. The tool is located at `skills/groupme/run.js` relative to the bot's working directory.

### Read messages
- `node skills/groupme/run.js today` — all messages from today
- `node skills/groupme/run.js recent 6` — messages from last 6 hours
- `node skills/groupme/run.js recent 24` — messages from last 24 hours
- `node skills/groupme/run.js messages 50` — last 50 messages
- `node skills/groupme/run.js search "practice"` — search for keyword

### List groups
- `node skills/groupme/run.js groups` — list all available GroupMe groups

### Using a different group
Pass the group ID as the last argument:
- `node skills/groupme/run.js today 102067636`

## Output format

All commands output JSON. Example:
```json
{ "messages": [{ "name": "Coach", "text": "Practice at 6pm", "time": "2026-03-23T18:00:00Z" }], "count": 1 }
```

## When to use

- User asks about practice times, game schedules, updates from the team
- User asks "any updates?", "what did the coaches say?", "when is practice?"
- User asks about uniforms, locations, or logistics from the group chat
- User mentions the team, coaches, baseball, or the group chat

## Important

- This is READ-ONLY access — you cannot send messages to GroupMe
- Summarize messages in a friendly way, don't dump raw JSON
- When the user asks about "updates" or "what's going on", pull today's messages and summarize the key info (times, locations, uniform info, etc.)
- If no messages match, say so — don't make up information
