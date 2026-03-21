import fs from 'fs';

export function listProjects(projectsDir) {
  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function matchProject(query, projects) {
  const q = query.toLowerCase();

  // Exact match first
  const exact = projects.find((p) => p.toLowerCase() === q);
  if (exact) return exact;

  // Substring match
  const matches = projects.filter((p) => p.toLowerCase().includes(q));
  return matches.length > 0 ? matches[0] : null;
}
