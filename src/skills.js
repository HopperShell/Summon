import fs from 'fs';
import path from 'path';

/**
 * Scan skills/ directory and return concatenated skill.md contents.
 * Returns a string to append to Claude's system prompt, or empty string if no skills.
 */
export function loadSkills() {
  const skillsDir = path.join(process.cwd(), 'skills');

  if (!fs.existsSync(skillsDir)) return '';

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skillTexts = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(skillsDir, entry.name, 'skill.md');
    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, 'utf8');
      skillTexts.push(content);
    }
  }

  if (skillTexts.length === 0) return '';

  return '\n\n---\n\n# Available Skills\n\nYou have access to the following skills/tools. Use them when relevant.\n\n' + skillTexts.join('\n\n---\n\n');
}
