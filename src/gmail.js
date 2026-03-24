// Gmail integration module (read-only)
// Uses credentials.json + token.json from project root for OAuth2 auth.

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const CREDENTIALS_PATH = () => path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = () => path.join(process.cwd(), 'token.json');

let gmailClient = null;

export function initGmail() {
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

    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    oauth2Client.setCredentials(token);

    oauth2Client.on('tokens', (newTokens) => {
      try {
        const existing = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        const merged = { ...existing, ...newTokens };
        fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
      } catch { /* ignore */ }
    });

    gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
    return true;
  } catch {
    return false;
  }
}

function parseHeader(headers, name) {
  const h = headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function decodeBody(body) {
  if (!body?.data) return '';
  return Buffer.from(body.data, 'base64url').toString('utf8');
}

function extractTextFromParts(parts) {
  if (!parts) return '';
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBody(part.body);
    }
    if (part.parts) {
      const text = extractTextFromParts(part.parts);
      if (text) return text;
    }
  }
  return '';
}

export async function listEmails({ query = '', maxResults = 10 } = {}) {
  const res = await gmailClient.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const messages = res.data.messages || [];
  const results = [];

  for (const msg of messages) {
    const full = await gmailClient.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full',
    });

    const headers = full.data.payload?.headers || [];
    const subject = parseHeader(headers, 'Subject');
    const from = parseHeader(headers, 'From');
    const date = parseHeader(headers, 'Date');

    let body = '';
    if (full.data.payload?.body?.data) {
      body = decodeBody(full.data.payload.body);
    } else if (full.data.payload?.parts) {
      body = extractTextFromParts(full.data.payload.parts);
    }

    // Truncate body to avoid massive output
    if (body.length > 500) {
      body = body.slice(0, 500) + '...';
    }

    results.push({
      id: msg.id,
      subject,
      from,
      date,
      snippet: full.data.snippet,
      body,
    });
  }

  return results;
}

export async function getEmail(messageId) {
  const full = await gmailClient.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = full.data.payload?.headers || [];
  const subject = parseHeader(headers, 'Subject');
  const from = parseHeader(headers, 'From');
  const to = parseHeader(headers, 'To');
  const date = parseHeader(headers, 'Date');

  let body = '';
  if (full.data.payload?.body?.data) {
    body = decodeBody(full.data.payload.body);
  } else if (full.data.payload?.parts) {
    body = extractTextFromParts(full.data.payload.parts);
  }

  return {
    id: messageId,
    subject,
    from,
    to,
    date,
    body,
    labels: full.data.labelIds,
  };
}

export async function getUnreadCount() {
  const res = await gmailClient.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults: 1,
  });
  return res.data.resultSizeEstimate || 0;
}
