/**
 * Converts standard markdown to chat-service-specific formats.
 *
 * Code blocks and inline code are preserved (no conversions inside them).
 */

export function convertMarkdown(text, format) {
  if (!text) return text;
  if (format === 'standard') return text;

  const converter = converters[format];
  if (!converter) return text;

  // 1. Extract code blocks and inline code, replace with placeholders
  const extracted = [];
  let safe = text;

  // Fenced code blocks first (``` ... ```)
  safe = safe.replace(/(```[\s\S]*?```)/g, (match) => {
    const idx = extracted.length;
    extracted.push(match);
    return `\x00CODE${idx}\x00`;
  });

  // Inline code (` ... `)
  safe = safe.replace(/(`[^`]+?`)/g, (match) => {
    const idx = extracted.length;
    extracted.push(match);
    return `\x00CODE${idx}\x00`;
  });

  // 2. Run the format-specific converter on the safe text
  safe = converter(safe);

  // 3. Restore code blocks / inline code
  safe = safe.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
    let code = extracted[Number(i)];
    // For telegram-html, code blocks and inline code need HTML conversion
    if (format === 'telegram-html') {
      code = convertCodeForTelegram(code);
    }
    return code;
  });

  return safe;
}

function convertCodeForTelegram(code) {
  if (code.startsWith('```')) {
    // Fenced code block -> <pre>
    const inner = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
    return `<pre>${escapeHtml(inner)}</pre>`;
  }
  // Inline code -> <code>
  const inner = code.replace(/^`/, '').replace(/`$/, '');
  return `<code>${escapeHtml(inner)}</code>`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------- Format converters (operate on text with code already extracted) ----------

function toSlackMrkdwn(text) {
  // Links: [text](url) -> <url|text>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');
  // Bold: **text** -> placeholder to avoid italic regex matching
  text = text.replace(/\*\*(.+?)\*\*/g, '\x01BOLD$1\x01ENDBOLD');
  // Italic: *text* -> _text_  (single asterisks that are not part of bold)
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');
  // Strikethrough: ~~text~~ -> ~text~
  text = text.replace(/~~(.+?)~~/g, '~$1~');
  // Restore bold
  text = text.replace(/\x01BOLD(.*?)\x01ENDBOLD/g, '*$1*');
  return text;
}

function toTelegramHtml(text) {
  // Escape HTML entities first
  text = escapeHtml(text);

  // Links: [text](url) -> <a href="url">text</a>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Bold: **text** -> <b>text</b>
  text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  // Italic with *: *text* -> <i>text</i>
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
  // Italic with _: _text_ -> <i>text</i>
  text = text.replace(/(?<!\\)_(.+?)(?<!\\)_/g, '<i>$1</i>');
  // Strikethrough: ~~text~~ -> <s>text</s>
  text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');
  return text;
}

function toWhatsApp(text) {
  // Links: [text](url) -> text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  // Bold: **text** -> placeholder
  text = text.replace(/\*\*(.+?)\*\*/g, '\x01BOLD$1\x01ENDBOLD');
  // Strikethrough: ~~text~~ -> ~text~
  text = text.replace(/~~(.+?)~~/g, '~$1~');
  // Italic *text* -> _text_
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');
  // Restore bold
  text = text.replace(/\x01BOLD(.*?)\x01ENDBOLD/g, '*$1*');
  return text;
}

const converters = {
  'slack-mrkdwn': toSlackMrkdwn,
  'telegram-html': toTelegramHtml,
  'whatsapp': toWhatsApp,
};
