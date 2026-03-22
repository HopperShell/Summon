// Quick test: OAuth flow + fetch today's calendar events
import fs from 'fs';
import http from 'http';
import { google } from 'googleapis';

const creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
const { client_id, client_secret, redirect_uris } = creds.installed;

// Use localhost redirect for desktop OAuth flow
const REDIRECT_URI = 'http://localhost:3333/callback';
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

// Check if we already have a saved token
if (fs.existsSync('token.json')) {
  const token = JSON.parse(fs.readFileSync('token.json', 'utf8'));
  oauth2Client.setCredentials(token);
  await fetchEvents();
} else {
  // Start OAuth flow
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n=== Open this URL in your browser ===\n');
  console.log(authUrl);
  console.log('\n=====================================\n');

  // Start a temporary server to catch the callback
  const server = http.createServer(async (req, res) => {
    if (!req.url.startsWith('/callback')) return;
    const url = new URL(req.url, 'http://localhost:3333');
    const code = url.searchParams.get('code');

    if (!code) {
      res.writeHead(400);
      res.end('No code received');
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      fs.writeFileSync('token.json', JSON.stringify(tokens, null, 2));
      console.log('Token saved to token.json');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Success! You can close this tab.</h1>');

      await fetchEvents();
    } catch (err) {
      console.error('Error getting token:', err.message);
      res.writeHead(500);
      res.end('Auth failed');
    } finally {
      server.close();
    }
  });

  server.listen(3333, () => {
    console.log('Waiting for OAuth callback on http://localhost:3333...');
  });
}

async function fetchEvents() {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  console.log('\n📅 Your events today:\n');

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items;
  if (!events || events.length === 0) {
    console.log('  No events for the rest of today.');
  } else {
    for (const event of events) {
      const start = event.start.dateTime || event.start.date;
      const time = new Date(start).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      console.log(`  ${time} — ${event.summary}`);
    }
  }
  console.log('');
}
