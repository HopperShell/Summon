import { describe, it, expect } from 'vitest';
import { routeMessage } from '../src/messages.js';

describe('routeMessage', () => {
  it('detects new chat command', () => {
    expect(routeMessage('new chat')).toEqual({ type: 'new_chat' });
    expect(routeMessage('New Chat')).toEqual({ type: 'new_chat' });
    expect(routeMessage('NEW CHAT')).toEqual({ type: 'new_chat' });
    expect(routeMessage('new  chat')).toEqual({ type: 'new_chat' });
    expect(routeMessage('  new chat  ')).toEqual({ type: 'new_chat' });
    expect(routeMessage('start over')).toEqual({ type: 'new_chat' });
    expect(routeMessage('Start Over')).toEqual({ type: 'new_chat' });
    expect(routeMessage('reset')).toEqual({ type: 'new_chat' });
  });

  it('detects list projects command', () => {
    expect(routeMessage('what projects do I have?')).toEqual({ type: 'list_projects' });
    expect(routeMessage('list my projects')).toEqual({ type: 'list_projects' });
    expect(routeMessage('show projects')).toEqual({ type: 'list_projects' });
  });

  it('detects switch project command', () => {
    expect(routeMessage('work on my-app')).toEqual({ type: 'switch_project', query: 'my-app' });
    expect(routeMessage('lets work on my-app')).toEqual({ type: 'switch_project', query: 'my-app' });
    expect(routeMessage("let's work on my-app")).toEqual({ type: 'switch_project', query: 'my-app' });
    expect(routeMessage('switch to portfolio')).toEqual({ type: 'switch_project', query: 'portfolio' });
    expect(routeMessage('open my-app')).toEqual({ type: 'switch_project', query: 'my-app' });
  });

  it('detects current project query', () => {
    expect(routeMessage('what project am I on?')).toEqual({ type: 'current_project' });
    expect(routeMessage('current project')).toEqual({ type: 'current_project' });
  });

  it('treats everything else as a claude prompt', () => {
    expect(routeMessage('add a loading spinner')).toEqual({
      type: 'claude_prompt',
      prompt: 'add a loading spinner',
    });
  });
});
