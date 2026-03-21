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

  it('spawns claude with correct args', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 10);
    });
    mockProcess.stdout.on.mockImplementation((event, cb) => {
      if (event === 'data') cb(Buffer.from('response'));
    });
    mockProcess.stderr.on.mockImplementation(() => {});

    const result = await runClaude('do something', '/projects/my-app');

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['-p', 'do something', '--project-dir', '/projects/my-app'],
      expect.objectContaining({ env: expect.any(Object) })
    );
    expect(result).toEqual({ success: true, output: 'response' });
  });

  it('returns error on non-zero exit code', async () => {
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(1), 10);
    });
    mockProcess.stdout.on.mockImplementation(() => {});
    mockProcess.stderr.on.mockImplementation((event, cb) => {
      if (event === 'data') cb(Buffer.from('error msg'));
    });

    const result = await runClaude('fail', '/projects/my-app');

    expect(result.success).toBe(false);
    expect(result.error).toContain('error msg');
  });

  it('returns timeout error when process exceeds time limit', async () => {
    vi.useFakeTimers();
    const { default: kill } = await import('tree-kill');

    // Process never closes on its own
    let closeCallback;
    mockProcess.on.mockImplementation((event, cb) => {
      if (event === 'close') closeCallback = cb;
    });
    mockProcess.stdout.on.mockImplementation(() => {});
    mockProcess.stderr.on.mockImplementation(() => {});

    const resultPromise = runClaude('slow task', '/projects/my-app');

    // Advance past the 5-minute timeout
    vi.advanceTimersByTime(5 * 60 * 1000);

    // Simulate process closing after being killed
    closeCallback(null);

    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(kill).toHaveBeenCalledWith(1234, 'SIGTERM');

    vi.useRealTimers();
  });
});
