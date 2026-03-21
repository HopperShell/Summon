import crypto from 'crypto';

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

export function getSession() {
  if (!session) {
    session = createSession();
  }
  return session;
}

export function resetSession() {
  const activeProject = session?.activeProject ?? null;
  session = createSession(activeProject);
}
