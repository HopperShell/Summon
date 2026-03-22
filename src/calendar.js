// Google Calendar integration module
// Uses credentials.json + token.json from project root for OAuth2 auth.

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = () => path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = () => path.join(process.cwd(), 'token.json');

let calendarClient = null;
let oauth2Client = null;

/**
 * Initialize the Google Calendar client using credentials.json + token.json.
 * Call this once at startup. Returns true if calendar is available, false if not configured.
 */
export function initCalendar() {
  try {
    const credsPath = CREDENTIALS_PATH();
    const tokenPath = TOKEN_PATH();

    if (!fs.existsSync(credsPath) || !fs.existsSync(tokenPath)) {
      return false;
    }

    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const { client_id, client_secret } = creds.installed || creds.web || {};
    if (!client_id || !client_secret) {
      return false;
    }

    const redirectUri = (creds.installed?.redirect_uris?.[0]) ||
                        (creds.web?.redirect_uris?.[0]) ||
                        'http://localhost:3333/callback';

    oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    oauth2Client.setCredentials(token);

    // Save refreshed tokens back to token.json automatically
    oauth2Client.on('tokens', (newTokens) => {
      try {
        const existing = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        const merged = { ...existing, ...newTokens };
        fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
      } catch {
        // Best-effort save; don't crash if it fails
      }
    });

    calendarClient = google.calendar({ version: 'v3', auth: oauth2Client });
    return true;
  } catch {
    calendarClient = null;
    oauth2Client = null;
    return false;
  }
}

/**
 * Returns true if calendar has been initialized successfully.
 */
export function isCalendarAvailable() {
  return calendarClient !== null;
}

/**
 * Get events for a time range.
 * Returns array of { id, summary, start, end, allDay, location }
 */
export async function getEvents(timeMin, timeMax) {
  if (!calendarClient) return [];

  const res = await calendarClient.events.list({
    calendarId: 'primary',
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = res.data.items || [];
  return items.map(formatEvent);
}

/**
 * Helper: get today's events (from start of day to end of day).
 */
export async function getEventsToday() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return getEvents(startOfDay, endOfDay);
}

/**
 * Helper: get this week's events (rest of week from now through Sunday).
 */
export async function getEventsThisWeek() {
  const now = new Date();
  const endOfWeek = new Date(now);
  const daysUntilSunday = 7 - endOfWeek.getDay();
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  return getEvents(now, endOfWeek);
}

/**
 * Helper: get tomorrow's events.
 */
export async function getEventsTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfDay = new Date(tomorrow);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(tomorrow);
  endOfDay.setHours(23, 59, 59, 999);
  return getEvents(startOfDay, endOfDay);
}

/**
 * Create a new event. Returns the created event (formatted).
 */
export async function createEvent({ summary, startTime, endTime, description, location }) {
  if (!calendarClient) return null;

  const event = {
    summary,
    start: { dateTime: new Date(startTime).toISOString() },
    end: { dateTime: new Date(endTime).toISOString() },
  };
  if (description) event.description = description;
  if (location) event.location = location;

  const res = await calendarClient.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return formatEvent(res.data);
}

/**
 * Delete an event by ID.
 */
export async function deleteEvent(eventId) {
  if (!calendarClient) return false;

  await calendarClient.events.delete({
    calendarId: 'primary',
    eventId,
  });
  return true;
}

/**
 * Check if a specific time slot is free. Returns { free: boolean, conflicts: [] }
 */
export async function checkAvailability(startTime, endTime) {
  if (!calendarClient) return { free: true, conflicts: [] };

  const events = await getEvents(startTime, endTime);
  return {
    free: events.length === 0,
    conflicts: events,
  };
}

// --- Internal helpers ---

function formatEvent(event) {
  const allDay = !event.start?.dateTime;
  const startRaw = event.start?.dateTime || event.start?.date;
  const endRaw = event.end?.dateTime || event.end?.date;

  return {
    id: event.id,
    summary: event.summary || '(No title)',
    start: formatDate(startRaw, allDay),
    end: formatDate(endRaw, allDay),
    allDay,
    location: event.location || null,
  };
}

function formatDate(raw, allDay) {
  if (!raw) return null;
  const d = new Date(raw);
  if (allDay) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
