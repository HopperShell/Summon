const sessions = new Map();

const LIST_PATTERNS = [
  /\b(list|show|what)\b.*\bprojects?\b/i,
];

const SWITCH_PATTERNS = [
  /\b(?:work on|switch to|use)\s+(.+)/i,
];

const CURRENT_PATTERNS = [
  /\b(?:what|which|current)\s+project\b/i,
];

export function routeMessage(text) {
  const trimmed = text.trim();

  for (const pattern of CURRENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'current_project' };
    }
  }

  for (const pattern of LIST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'list_projects' };
    }
  }

  for (const pattern of SWITCH_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { type: 'switch_project', query: match[1].trim() };
    }
  }

  return { type: 'claude_prompt', prompt: trimmed };
}

export function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { activeProject: null, busy: false });
  }
  return sessions.get(userId);
}

export function resetSessions() {
  sessions.clear();
}
