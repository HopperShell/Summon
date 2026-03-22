import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const sessions = new Map();

function createSession(activeProject = null) {
  const sessionId = crypto.randomUUID();
  let isNew = true;
  return {
    activeProject,
    sessionId,
    busy: false,
    get isNewSession() { return isNew; },
    markUsed() { isNew = false; },
  };
}

function cleanupSessionFiles(sessionId) {
  const home = process.env.HOME;
  const dirs = [
    path.join(home, '.claude', 'sessions'),
    path.join(home, '.claude', 'projects'),
  ];

  for (const dir of dirs) {
    try {
      // Direct session file
      const file = path.join(dir, `${sessionId}.json`);
      if (fs.existsSync(file)) fs.unlinkSync(file);

      // Also check project subdirectories for session files
      if (dir.endsWith('projects')) {
        const projects = fs.readdirSync(dir, { withFileTypes: true });
        for (const p of projects) {
          if (!p.isDirectory()) continue;
          const sessDir = path.join(dir, p.name, 'sessions');
          const sessFile = path.join(sessDir, `${sessionId}.json`);
          try {
            if (fs.existsSync(sessFile)) fs.unlinkSync(sessFile);
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
}

export function getSession(key) {
  if (!sessions.has(key)) {
    sessions.set(key, createSession());
  }
  return sessions.get(key);
}

export function resetSession(key) {
  const old = sessions.get(key);
  const activeProject = old?.activeProject ?? null;
  if (old?.sessionId && !old.isNewSession) {
    cleanupSessionFiles(old.sessionId);
  }
  sessions.set(key, createSession(activeProject));
}
