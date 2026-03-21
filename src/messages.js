export function routeMessage(text) {
  const trimmed = text.trim();

  // Commands start with !
  if (trimmed.startsWith('!')) {
    const parts = trimmed.slice(1).trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    switch (cmd) {
      case 'new':
        return { type: 'new_chat' };
      case 'projects':
        return { type: 'list_projects' };
      case 'work':
        return arg ? { type: 'switch_project', query: arg } : { type: 'list_projects' };
      case 'status':
        return { type: 'current_project' };
      case 'help':
        return { type: 'help' };
      default:
        return { type: 'help' };
    }
  }

  return { type: 'claude_prompt', prompt: trimmed };
}
