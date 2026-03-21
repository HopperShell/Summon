import { describe, it, expect } from 'vitest';
import { chunkResponse } from '../src/chunker.js';

describe('chunkResponse', () => {
  it('returns single chunk for short text', () => {
    const result = chunkResponse('Hello world');
    expect(result).toEqual(['Hello world']);
  });

  it('splits on double newlines when text exceeds limit', () => {
    const part1 = 'a'.repeat(2000);
    const part2 = 'b'.repeat(2000);
    const text = `${part1}\n\n${part2}`;
    const result = chunkResponse(text, 3900);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(part1);
    expect(result[1]).toBe(part2);
  });

  it('does not split inside a fenced code block', () => {
    const before = 'Some text\n\n';
    const codeBlock = '```js\n' + 'x = 1;\n'.repeat(500) + '```';
    const after = '\n\nMore text';
    const text = before + codeBlock + after;
    const chunks = chunkResponse(text, 3900);
    // The code block should be fully contained in one chunk
    const codeChunk = chunks.find((c) => c.includes('```js'));
    expect(codeChunk).toContain('```js');
    expect(codeChunk).toMatch(/```\s*$/m);
  });

  it('hard splits at limit when no natural boundary exists', () => {
    const text = 'a'.repeat(8000);
    const result = chunkResponse(text, 3900);
    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(3900);
    });
  });

  it('returns empty array for empty string', () => {
    expect(chunkResponse('')).toEqual([]);
  });
});
