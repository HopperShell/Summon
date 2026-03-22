import { isCalendarAvailable, getEventsToday, getEventsTomorrow, getEventsThisWeek, createEvent, checkAvailability } from './calendar.js';

/**
 * Handle a calendar subcommand and return a formatted string response.
 */
export async function handleCalendarCommand(subcommand, args) {
  if (!isCalendarAvailable()) {
    return 'Calendar not configured. Add credentials.json and token.json to enable.';
  }

  const cmd = (subcommand || 'today').toLowerCase().trim();

  switch (cmd) {
    case 'today':
      return formatEventList(await getEventsToday(), "Today's events");

    case 'tomorrow':
      return formatEventList(await getEventsTomorrow(), "Tomorrow's events");

    case 'week':
      return formatEventList(await getEventsThisWeek(), "This week's events");

    case 'add':
      return handleAdd(args);

    case 'free':
      return handleFree(args);

    default:
      return [
        '📅 Calendar commands:',
        '  today     — show today\'s events (default)',
        '  tomorrow  — show tomorrow\'s events',
        '  week      — show this week\'s events',
        '  add       — create an event, e.g. "add Meeting at 3pm"',
        '  free      — check availability, e.g. "free 3pm"',
      ].join('\n');
  }
}

// --- Formatting helpers ---

function formatEventList(events, label) {
  if (!events || events.length === 0) {
    return `📅 No events for ${label.toLowerCase().replace("'s events", '')}.`;
  }

  const lines = events.map(e => {
    const time = e.allDay ? 'All day' : formatTimeOnly(e.start);
    return `• ${time} — ${e.summary}`;
  });

  return `📅 ${label}:\n${lines.join('\n')}`;
}

/**
 * Extract just the time portion (e.g. "3:00 PM") from a formatted date string
 * like "Sun, Mar 22, 3:00 PM". Falls back to the full string if no match.
 */
function formatTimeOnly(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
  return match ? match[1] : dateStr;
}

// --- Add handler ---

async function handleAdd(args) {
  if (!args || args.trim() === '') {
    return '❌ Please specify an event, e.g. "add Meeting at 3pm"';
  }

  const parsed = parseEventInput(args.trim());
  if (!parsed) {
    return '❌ Could not parse event. Try something like "Meeting at 3pm" or "Lunch tomorrow at noon".';
  }

  const { summary, startTime, endTime } = parsed;

  const event = await createEvent({ summary, startTime, endTime });
  if (!event) {
    return '❌ Failed to create event.';
  }

  const timeStr = formatTimeOnly(event.start);
  return `✅ Created: ${event.summary} at ${timeStr}`;
}

// --- Free handler ---

async function handleFree(args) {
  if (!args || args.trim() === '') {
    return '❌ Please specify a time, e.g. "free 3pm"';
  }

  const time = parseTime(args.trim());
  if (!time) {
    return '❌ Could not parse time. Try something like "3pm" or "noon".';
  }

  const startTime = time;
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour window

  const { free, conflicts } = await checkAvailability(startTime, endTime);

  const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (free) {
    return `✅ You're free at ${timeStr}`;
  }

  const conflict = conflicts[0];
  const conflictTime = formatTimeOnly(conflict.start);
  return `❌ Conflict: ${conflict.summary} at ${conflictTime}`;
}

// --- Parsing helpers ---

/**
 * Parse natural-language event input like "Meeting at 3pm" or "Lunch tomorrow at noon".
 * Returns { summary, startTime, endTime } or null.
 */
function parseEventInput(input) {
  // Check for "tomorrow" keyword
  const isTomorrow = /\btomorrow\b/i.test(input);

  // Extract the time portion — look for "at <time>" pattern
  const atTimeMatch = input.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)\b/i);
  if (!atTimeMatch) return null;

  const timeStr = atTimeMatch[1];

  // Build the summary by stripping "tomorrow" and "at <time>" from input
  let summary = input
    .replace(/\btomorrow\b/i, '')
    .replace(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)/i, '')
    .trim()
    .replace(/\s{2,}/g, ' ');

  if (!summary) summary = '(No title)';

  // Parse the time
  const baseDate = new Date();
  if (isTomorrow) {
    baseDate.setDate(baseDate.getDate() + 1);
  }

  const startTime = parseTimeOnDate(timeStr, baseDate);
  if (!startTime) return null;

  // Default 1 hour duration
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  return { summary, startTime, endTime };
}

/**
 * Parse a standalone time string (for "free" command).
 * Supports "3pm", "3:30pm", "noon", "midnight", "tomorrow 3pm", etc.
 */
function parseTime(input) {
  const isTomorrow = /\btomorrow\b/i.test(input);
  const cleaned = input.replace(/\btomorrow\b/i, '').trim();

  const baseDate = new Date();
  if (isTomorrow) {
    baseDate.setDate(baseDate.getDate() + 1);
  }

  return parseTimeOnDate(cleaned, baseDate);
}

/**
 * Parse a time string and apply it to a given base date.
 * Handles: "3pm", "3:30pm", "3:30 PM", "15:00", "noon", "midnight"
 */
function parseTimeOnDate(timeStr, baseDate) {
  const d = new Date(baseDate);
  d.setSeconds(0, 0);

  const lower = timeStr.toLowerCase().trim();

  if (lower === 'noon') {
    d.setHours(12, 0);
    return d;
  }
  if (lower === 'midnight') {
    d.setHours(0, 0);
    return d;
  }

  // Match patterns like "3pm", "3:30pm", "3:30 pm", "15:00"
  const match = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3];

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  d.setHours(hours, minutes);
  return d;
}
