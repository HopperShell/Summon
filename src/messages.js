const NEW_CHAT_PATTERNS = [
  /\bnew\s+chat\b/i,
  /\bstart\s+over\b/i,
  /^reset$/i,
];

const LIST_PATTERNS = [
  /\b(list|show|what)\b.*\bprojects?\b/i,
];

const SWITCH_PATTERNS = [
  /(?:work on|switch to|open|use)\s+(.+)/i,
];

const CURRENT_PATTERNS = [
  /\b(?:what|which|current)\s+project\b/i,
];

export function routeMessage(text) {
  const trimmed = text.trim();

  for (const pattern of NEW_CHAT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: 'new_chat' };
    }
  }

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
