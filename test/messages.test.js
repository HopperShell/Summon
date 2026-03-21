import { describe, it, expect, beforeEach } from 'vitest';
import { routeMessage, getSession, resetSessions } from '../src/messages.js';

describe('routeMessage', () => {
  beforeEach(() => {
    resetSessions();
  });

  it('detects list projects command', () => {
    expect(routeMessage('what projects do I have?')).toEqual({
      type: 'list_projects',
    });
    expect(routeMessage('list my projects')).toEqual({
      type: 'list_projects',
    });
    expect(routeMessage('show projects')).toEqual({
      type: 'list_projects',
    });
  });

  it('detects switch project command', () => {
    expect(routeMessage('work on my-app')).toEqual({
      type: 'switch_project',
      query: 'my-app',
    });
    expect(routeMessage('switch to portfolio')).toEqual({
      type: 'switch_project',
      query: 'portfolio',
    });
    expect(routeMessage('use api-backend')).toEqual({
      type: 'switch_project',
      query: 'api-backend',
    });
  });

  it('detects current project query', () => {
    expect(routeMessage('what project am I on?')).toEqual({
      type: 'current_project',
    });
    expect(routeMessage('which project')).toEqual({
      type: 'current_project',
    });
    expect(routeMessage('current project')).toEqual({
      type: 'current_project',
    });
  });

  it('treats everything else as a claude prompt', () => {
    expect(routeMessage('add a loading spinner')).toEqual({
      type: 'claude_prompt',
      prompt: 'add a loading spinner',
    });
  });
});

describe('session management', () => {
  beforeEach(() => {
    resetSessions();
  });

  it('tracks active project per user', () => {
    const session = getSession('U123');
    expect(session.activeProject).toBeNull();
    session.activeProject = 'my-app';
    expect(getSession('U123').activeProject).toBe('my-app');
  });

  it('tracks busy state per user', () => {
    const session = getSession('U123');
    expect(session.busy).toBe(false);
  });

  it('isolates sessions between users', () => {
    getSession('U123').activeProject = 'my-app';
    expect(getSession('U456').activeProject).toBeNull();
  });
});
