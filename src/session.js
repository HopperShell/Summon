import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let session = null;

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

export function getSession() {
  if (!session) {
    session = createSession();
  }
  return session;
}

export function resetSession() {
  const oldId = session?.sessionId;
  const activeProject = session?.activeProject ?? null;

  // Clean up old session files from disk
  if (oldId && session && !session.isNewSession) {
    cleanupSessionFiles(oldId);
  }

  session = createSession(activeProject);
}
