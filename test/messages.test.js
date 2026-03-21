import { describe, it, expect } from 'vitest';
import { routeMessage } from '../src/messages.js';

describe('routeMessage', () => {
  it('routes !new to new_chat', () => {
    expect(routeMessage('!new')).toEqual({ type: 'new_chat' });
    expect(routeMessage('!NEW')).toEqual({ type: 'new_chat' });
    expect(routeMessage('  !new  ')).toEqual({ type: 'new_chat' });
  });

  it('routes !projects to list_projects', () => {
    expect(routeMessage('!projects')).toEqual({ type: 'list_projects' });
  });

  it('routes !work <name> to switch_project', () => {
    expect(routeMessage('!work hello-world')).toEqual({ type: 'switch_project', query: 'hello-world' });
    expect(routeMessage('!work my app')).toEqual({ type: 'switch_project', query: 'my app' });
  });

  it('routes !work with no arg to list_projects', () => {
    expect(routeMessage('!work')).toEqual({ type: 'list_projects' });
  });

  it('routes !status to current_project', () => {
    expect(routeMessage('!status')).toEqual({ type: 'current_project' });
  });

  it('routes !help to help', () => {
    expect(routeMessage('!help')).toEqual({ type: 'help' });
  });

  it('routes unknown ! commands to help', () => {
    expect(routeMessage('!whatever')).toEqual({ type: 'help' });
  });

  it('routes everything else to claude_prompt', () => {
    expect(routeMessage('what files are in this project')).toEqual({
      type: 'claude_prompt',
      prompt: 'what files are in this project',
    });
    expect(routeMessage('fix the bug')).toEqual({
      type: 'claude_prompt',
      prompt: 'fix the bug',
    });
  });
});
