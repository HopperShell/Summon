import os from 'os';
import path from 'path';

export function resolveProjectsDir() {
  const raw = process.env.PROJECTS_DIR || path.join(os.homedir(), 'Projects');
  if (raw.startsWith('~')) {
    return path.join(os.homedir(), raw.slice(1));
  }
  return path.resolve(raw);
}
