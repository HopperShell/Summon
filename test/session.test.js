import { describe, it, expect, beforeEach } from 'vitest';
import { getSession, resetSession } from '../src/session.js';

describe('session', () => {
  beforeEach(() => {
    resetSession();
  });

  it('initializes with null project and a sessionId', () => {
    const s = getSession();
    expect(s.activeProject).toBeNull();
    expect(s.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(s.busy).toBe(false);
    expect(s.isNewSession).toBe(true);
  });

  it('returns the same session on repeated calls', () => {
    const a = getSession();
    const b = getSession();
    expect(a).toBe(b);
  });

  it('resetSession creates a new sessionId but keeps activeProject', () => {
    const s = getSession();
    s.activeProject = 'my-app';
    const oldId = s.sessionId;
    resetSession();
    const s2 = getSession();
    expect(s2.sessionId).not.toBe(oldId);
    expect(s2.activeProject).toBe('my-app');
    expect(s2.isNewSession).toBe(true);
  });

  it('marks session as not new after markUsed', () => {
    const s = getSession();
    expect(s.isNewSession).toBe(true);
    s.markUsed();
    expect(s.isNewSession).toBe(false);
  });
});
