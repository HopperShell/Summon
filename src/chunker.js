const DEFAULT_LIMIT = 3900;

export function chunkResponse(text, limit = DEFAULT_LIMIT) {
  if (!text) return [];
  if (text.length <= limit) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    let splitAt = findSplitPoint(remaining, limit);
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

function findSplitPoint(text, limit) {
  // Check if we're inside a code block at the limit
  const textUpToLimit = text.slice(0, limit);
  const fencesBefore = (textUpToLimit.match(/^```/gm) || []).length;

  if (fencesBefore % 2 !== 0) {
    // We're inside a code block — find the closing fence
    const closingFence = text.indexOf('\n```', limit);
    if (closingFence !== -1) {
      const endOfFence = text.indexOf('\n', closingFence + 1);
      return endOfFence !== -1 ? endOfFence : closingFence + 4;
    }
  }

  // Try double newline
  const doubleNewline = textUpToLimit.lastIndexOf('\n\n');
  if (doubleNewline > limit * 0.3) return doubleNewline;

  // Try single newline
  const singleNewline = textUpToLimit.lastIndexOf('\n');
  if (singleNewline > limit * 0.3) return singleNewline;

  // Hard split at limit
  return limit;
}
