import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProjects, matchProject } from '../src/projects.js';
import fs from 'fs';

vi.mock('fs');

describe('listProjects', () => {
  it('returns directories from the projects path', () => {
    fs.readdirSync.mockReturnValue([
      { name: 'my-app', isDirectory: () => true },
      { name: '.DS_Store', isDirectory: () => false },
      { name: 'portfolio-site', isDirectory: () => true },
    ]);
    const result = listProjects('/projects');
    expect(result).toEqual(['my-app', 'portfolio-site']);
  });

  it('returns empty array when directory is empty', () => {
    fs.readdirSync.mockReturnValue([]);
    const result = listProjects('/projects');
    expect(result).toEqual([]);
  });
});

describe('matchProject', () => {
  const projects = ['my-app', 'portfolio-site', 'api-backend', 'remote-claude'];

  it('matches exact name', () => {
    expect(matchProject('my-app', projects)).toBe('my-app');
  });

  it('matches case-insensitive substring', () => {
    expect(matchProject('portfolio', projects)).toBe('portfolio-site');
  });

  it('matches case-insensitive', () => {
    expect(matchProject('API', projects)).toBe('api-backend');
  });

  it('returns null for no match', () => {
    expect(matchProject('nonexistent', projects)).toBeNull();
  });

  it('returns first match if multiple match', () => {
    const result = matchProject('a', projects);
    expect(projects).toContain(result);
  });
});
