import { describe, it, expect, beforeEach } from 'vitest';
import { getSession, resetSession } from '../src/session.js';

describe('session', () => {
  const KEY = 'test:user1';

  beforeEach(() => {
    resetSession(KEY);
  });

  it('initializes with null project and a sessionId', () => {
    const s = getSession(KEY);
    expect(s.activeProject).toBeNull();
    expect(s.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(s.busy).toBe(false);
    expect(s.isNewSession).toBe(true);
  });

  it('returns the same session on repeated calls', () => {
    const a = getSession(KEY);
    const b = getSession(KEY);
    expect(a).toBe(b);
  });

  it('different keys get different sessions', () => {
    const a = getSession('slack:user1');
    const b = getSession('discord:user2');
    expect(a).not.toBe(b);
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  it('resetSession creates a new sessionId but keeps activeProject', () => {
    const s = getSession(KEY);
    s.activeProject = 'my-app';
    const oldId = s.sessionId;
    resetSession(KEY);
    const s2 = getSession(KEY);
    expect(s2.sessionId).not.toBe(oldId);
    expect(s2.activeProject).toBe('my-app');
    expect(s2.isNewSession).toBe(true);
  });

  it('marks session as not new after markUsed', () => {
    const s = getSession(KEY);
    expect(s.isNewSession).toBe(true);
    s.markUsed();
    expect(s.isNewSession).toBe(false);
  });
});
