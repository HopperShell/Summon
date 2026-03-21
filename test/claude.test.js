import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runClaude } from '../src/claude.js';
import { spawn } from 'child_process';

vi.mock('child_process');
vi.mock('tree-kill', () => ({ default: vi.fn() }));

describe('runClaude', () => {
  let mockProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      pid: 1234,
      kill: vi.fn(),
    };
    spawn.mockReturnValue(mockProcess);
  });

  it('uses --session-id for new sessions', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });
    mockProcess.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') {
        cb(Buffer.from(JSON.stringify({
          type: 'result', subtype: 'success', result: 'done', is_error: false,
        }) + '\n'));
      }
    });
    mockProcess.stderr.on.mockImplementation(() => {});

    await runClaude('test', '/proj', { sessionId: 'abc-123', isNew: true });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', 'test', '--session-id', 'abc-123']),
      expect.any(Object)
    );
  });

  it('uses --resume for existing sessions', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });
    mockProcess.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') {
        cb(Buffer.from(JSON.stringify({
          type: 'result', subtype: 'success', result: 'done', is_error: false,
        }) + '\n'));
      }
    });
    mockProcess.stderr.on.mockImplementation(() => {});

    await runClaude('test', '/proj', { sessionId: 'abc-123', isNew: false });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', 'test', '--resume', 'abc-123']),
      expect.any(Object)
    );
  });

  it('calls onProgress with assistant text', async () => {
    const onProgress = vi.fn();
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });
    mockProcess.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') {
        cb(Buffer.from(
          JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hello' }] } }) + '\n' +
          JSON.stringify({ type: 'result', subtype: 'success', result: 'hello', is_error: false }) + '\n'
        ));
      }
    });
    mockProcess.stderr.on.mockImplementation(() => {});

    const result = await runClaude('test', '/proj', {
      sessionId: 'abc-123', isNew: true, onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith('hello');
    expect(result).toEqual({ success: true, output: 'hello' });
  });

  it('returns error on non-zero exit', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(1), 10);
    });
    mockProcess.stdout.on.mockImplementation(() => {});
    mockProcess.stderr.on.mockImplementation((event, cb) => {
      if (event === 'data') cb(Buffer.from('bad'));
    });

    const result = await runClaude('fail', '/proj', { sessionId: 'x', isNew: true });
    expect(result.success).toBe(false);
  });

  it('returns timeout error when process exceeds time limit', async () => {
    vi.useFakeTimers();
    const { default: kill } = await import('tree-kill');

    let closeCallback;
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') closeCallback = cb;
    });
    mockProcess.stdout.on.mockImplementation(() => {});
    mockProcess.stderr.on.mockImplementation(() => {});

    const resultPromise = runClaude('slow', '/proj', { sessionId: 'x', isNew: true });
    vi.advanceTimersByTime(10 * 60 * 1000);
    closeCallback(null);

    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(kill).toHaveBeenCalledWith(1234, 'SIGTERM');
    vi.useRealTimers();
  });
});
