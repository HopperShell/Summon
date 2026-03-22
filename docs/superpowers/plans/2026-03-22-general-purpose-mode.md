# General-Purpose Mode + Calendar Integration

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the bot from a code-only tool into a general-purpose assistant that also does code. Default mode is general assistant. Project mode is opt-in via `!work`.

**Architecture:** Two modes — general (default) and project. General mode runs Claude without a project directory and has access to integrations (calendar first). Project mode works exactly as it does today. New `!general`/`!stop` command exits project mode. Calendar integration via googleapis using existing OAuth token.

**Tech Stack:** googleapis (installed), Google Calendar API, existing adapter system

---

### Task 1: Update message routing with new commands

**Files:**
- Modify: `src/messages.js`
- Modify: `test/messages.test.js`

- [ ] **Step 1: Add new route types to messages.js**

Add `!stop` / `!general` command that returns `{ type: 'exit_project' }`. Add `!calendar` command that returns `{ type: 'calendar', subcommand, args }` for explicit calendar commands.

```js
case 'stop':
case 'general':
  return { type: 'exit_project' };
case 'calendar':
case 'cal':
  return { type: 'calendar', subcommand: parts[1] || 'today', args: parts.slice(2).join(' ') };
```

- [ ] **Step 2: Update help text route to include new commands**

- [ ] **Step 3: Add tests for new routes**

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run test/messages.test.js`

- [ ] **Step 5: Commit**

```bash
git add src/messages.js test/messages.test.js
git commit -m "feat: add exit_project and calendar route types"
```

---

### Task 2: Build calendar integration module

**Files:**
- Create: `src/calendar.js`
- Create: `test/calendar.test.js`

- [ ] **Step 1: Create src/calendar.js**

Module that wraps googleapis calendar. Exports:
- `initCalendar()` — loads credentials.json + token.json, returns true/false
- `isCalendarAvailable()` — returns whether calendar was initialized
- `getEventsToday()` — events for rest of today
- `getEventsTomorrow()` — tomorrow's events
- `getEventsThisWeek()` — rest of week
- `getEvents(timeMin, timeMax)` — arbitrary range
- `createEvent({ summary, startTime, endTime, description, location })` — create event
- `deleteEvent(eventId)` — delete event
- `checkAvailability(startTime, endTime)` — check if time slot is free

Auth: load from `credentials.json` and `token.json` relative to `process.cwd()`. If missing, `initCalendar()` returns false. Handle token auto-refresh by saving updated tokens back to `token.json`.

Use scope `https://www.googleapis.com/auth/calendar` (read+write).

Each function returns formatted objects: `{ summary, start, end, allDay, location, id }`.

- [ ] **Step 2: Create basic tests**

Mock googleapis to test formatting logic and error handling. Test `initCalendar` returns false when files missing.

- [ ] **Step 3: Run tests, verify pass**

Run: `npx vitest run test/calendar.test.js`

- [ ] **Step 4: Commit**

```bash
git add src/calendar.js test/calendar.test.js
git commit -m "feat: add Google Calendar integration module"
```

---

### Task 3: Create calendar command handler

**Files:**
- Create: `src/calendar-handler.js`

- [ ] **Step 1: Create src/calendar-handler.js**

Exports `handleCalendarCommand(subcommand, args)` that returns a formatted string response.

Subcommands:
- `today` — calls `getEventsToday()`, formats as readable list
- `tomorrow` — calls `getEventsTomorrow()`
- `week` — calls `getEventsThisWeek()`
- `add <summary> at <time>` — parses natural-ish time, calls `createEvent()`
- `free <time>` — checks availability at a time
- No subcommand defaults to `today`

Format output as a nice readable list:
```
📅 Today's events:
• 9:00 AM — Warehouse Product Recovery
• 2:00 PM — Team Standup

No more events today.
```

If calendar not available, return "Calendar not configured. Add credentials.json and token.json to enable."

- [ ] **Step 2: Commit**

```bash
git add src/calendar-handler.js
git commit -m "feat: add calendar command handler"
```

---

### Task 4: Update core.js for general-purpose mode

**Files:**
- Modify: `src/core.js`
- Modify: `src/claude.js`

- [ ] **Step 1: Add exit_project route to core.js**

In the switch statement, add:
```js
case 'exit_project': {
  session.activeProject = null;
  await adapter.sendMessage(chatId, fmt('Back to general mode.'));
  break;
}
```

- [ ] **Step 2: Add calendar route to core.js**

```js
case 'calendar': {
  const result = await handleCalendarCommand(route.subcommand, route.args);
  await adapter.sendMessage(chatId, fmt(result));
  break;
}
```

- [ ] **Step 3: Update claude_prompt route for general mode**

Change the `claude_prompt` case: when `session.activeProject` is null, instead of showing "No project selected", run Claude in general-purpose mode — no project directory, different system prompt.

- [ ] **Step 4: Add general-purpose mode to claude.js**

Add a `runClaudeGeneral(prompt, { sessionId, isNew, onProgress })` function (or add a mode parameter to `runClaude`). This runs Claude without `cwd` set to a project, and uses a general-purpose system prompt instead of the coding one:

```
You are a personal assistant in a chat conversation. You can help with questions, planning, research, writing, and general tasks. Be conversational and helpful. Use markdown formatting.

You have access to the user's Google Calendar. When they ask about their schedule, events, or availability, you can check their calendar.
```

It should NOT use `--dangerously-skip-permissions` in general mode since there's no project directory.

- [ ] **Step 5: Update help text**

Update the help command to show `!stop` / `!general` and `!calendar` commands. Show different help depending on whether a project is active.

- [ ] **Step 6: Commit**

```bash
git add src/core.js src/claude.js
git commit -m "feat: general-purpose mode with calendar integration"
```

---

### Task 5: Update index.js to initialize calendar on startup

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Import and initialize calendar in index.js**

```js
import { initCalendar } from './calendar.js';
```

In the startup function, after checking PROJECTS_DIR:
```js
const calendarReady = initCalendar();
if (calendarReady) {
  console.log('Google Calendar connected');
} else {
  console.log('Google Calendar not configured (missing credentials.json or token.json)');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.js
git commit -m "feat: initialize calendar on startup"
```

---

### Task 6: Integration test — end to end

- [ ] **Step 1: Manual test — start the bot, verify general mode works**

Run the bot, send a message without a project active, verify it responds in general mode.

- [ ] **Step 2: Test calendar commands**

Send `!calendar today`, `!calendar week`, verify events come back.

- [ ] **Step 3: Test project mode still works**

Send `!work <project>`, send a coding prompt, verify it works as before. Send `!stop`, verify back to general mode.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: general-purpose assistant mode with Google Calendar"
```
