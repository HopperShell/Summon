import { spawn } from 'child_process';
import kill from 'tree-kill';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function runClaude(prompt, projectDir) {
  const proc = spawn(
    'claude',
    ['-p', prompt, '--project-dir', projectDir],
    { env: { ...process.env, NO_COLOR: '1' } }
  );

  let stdout = '';
  let stderr = '';
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    kill(proc.pid, 'SIGTERM');
  }, TIMEOUT_MS);

  proc.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  return new Promise((resolve) => {
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        resolve({ success: false, error: 'Claude timed out after 5 minutes' });
      } else if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({
          success: false,
          error: stderr || `Claude exited with code ${code}`,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });
  });
}
