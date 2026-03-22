# Calendar Skill

You have access to the user's Google Calendar. Use the calendar CLI tool to read and write events.

## Commands

Run these commands using the shell. The tool is located at `skills/calendar/run.js` relative to the bot's working directory.

### List events
- `node skills/calendar/run.js today` — today's events
- `node skills/calendar/run.js tomorrow` — tomorrow's events
- `node skills/calendar/run.js week` — rest of this week's events
- `node skills/calendar/run.js date 2026-03-25` — events on a specific date
- `node skills/calendar/run.js range 2026-03-25 2026-03-28` — events in a date range

### Create events
- `node skills/calendar/run.js add "Meeting with Bob" "2026-03-25T15:00:00" "2026-03-25T16:00:00"`
- `node skills/calendar/run.js add "Lunch" "2026-03-25T12:00:00" "2026-03-25T13:00:00" "Cafe downtown"`

Arguments: summary, start (ISO 8601), end (ISO 8601), optional location

### Delete events
- `node skills/calendar/run.js delete <event-id>`

Event IDs are included in list output.

### Check availability
- `node skills/calendar/run.js free "2026-03-25T15:00:00" "2026-03-25T16:00:00"`

## Output format

All commands output JSON for easy parsing. Example:
```json
{ "events": [...], "count": 1 }
```

## When to use

- User asks about their schedule, calendar, events, availability, meetings
- User asks to create, add, schedule, book, or set up an event or meeting
- User asks to cancel, delete, or remove an event
- User asks "am I free at...", "what's on my calendar", "when is my next..."

## Important

- Always confirm with the user before creating or deleting events
- When creating events, calculate proper ISO 8601 timestamps based on the current date/time and user's request
- Default event duration is 1 hour if not specified
- Show events in a friendly format when responding to the user, not raw JSON
