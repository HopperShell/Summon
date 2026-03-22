import { describe, it, expect } from 'vitest';
import { convertMarkdown } from '../src/markdown.js';

describe('convertMarkdown', () => {
  // ---- standard (Discord) ----
  describe('standard', () => {
    it('returns text unchanged', () => {
      const md = '**bold** *italic* ~~strike~~ `code` [link](http://x.com)';
      expect(convertMarkdown(md, 'standard')).toBe(md);
    });
  });

  // ---- slack-mrkdwn ----
  describe('slack-mrkdwn', () => {
    it('converts bold', () => {
      expect(convertMarkdown('**hello**', 'slack-mrkdwn')).toBe('*hello*');
    });

    it('converts italic with *', () => {
      expect(convertMarkdown('*hello*', 'slack-mrkdwn')).toBe('_hello_');
    });

    it('converts strikethrough', () => {
      expect(convertMarkdown('~~deleted~~', 'slack-mrkdwn')).toBe('~deleted~');
    });

    it('converts links', () => {
      expect(convertMarkdown('[click](http://example.com)', 'slack-mrkdwn'))
        .toBe('<http://example.com|click>');
    });

    it('leaves inline code as-is', () => {
      expect(convertMarkdown('use `**not bold**` here', 'slack-mrkdwn'))
        .toBe('use `**not bold**` here');
    });

    it('leaves code blocks as-is', () => {
      const input = '```\n**not bold**\n```';
      expect(convertMarkdown(input, 'slack-mrkdwn')).toBe(input);
    });

    it('leaves bullet lists as-is', () => {
      const input = '- item one\n- item two';
      expect(convertMarkdown(input, 'slack-mrkdwn')).toBe(input);
    });

    it('handles bold and italic together', () => {
      expect(convertMarkdown('**bold** and *italic*', 'slack-mrkdwn'))
        .toBe('*bold* and _italic_');
    });
  });

  // ---- telegram-html ----
  describe('telegram-html', () => {
    it('converts bold', () => {
      expect(convertMarkdown('**hello**', 'telegram-html')).toBe('<b>hello</b>');
    });

    it('converts italic with *', () => {
      expect(convertMarkdown('*hello*', 'telegram-html')).toBe('<i>hello</i>');
    });

    it('converts italic with _', () => {
      expect(convertMarkdown('_hello_', 'telegram-html')).toBe('<i>hello</i>');
    });

    it('converts strikethrough', () => {
      expect(convertMarkdown('~~deleted~~', 'telegram-html')).toBe('<s>deleted</s>');
    });

    it('converts inline code', () => {
      expect(convertMarkdown('use `code` here', 'telegram-html'))
        .toBe('use <code>code</code> here');
    });

    it('converts code blocks', () => {
      expect(convertMarkdown('```\nlet x = 1;\n```', 'telegram-html'))
        .toBe('<pre>let x = 1;</pre>');
    });

    it('converts links', () => {
      expect(convertMarkdown('[click](http://example.com)', 'telegram-html'))
        .toBe('<a href="http://example.com">click</a>');
    });

    it('escapes HTML entities in regular text', () => {
      expect(convertMarkdown('a < b & c > d', 'telegram-html'))
        .toBe('a &lt; b &amp; c &gt; d');
    });

    it('escapes HTML inside code blocks', () => {
      expect(convertMarkdown('```\na < b\n```', 'telegram-html'))
        .toBe('<pre>a &lt; b</pre>');
    });

    it('does not convert markdown inside code blocks', () => {
      expect(convertMarkdown('```\n**not bold**\n```', 'telegram-html'))
        .toBe('<pre>**not bold**</pre>');
    });

    it('does not convert markdown inside inline code', () => {
      expect(convertMarkdown('`**not bold**`', 'telegram-html'))
        .toBe('<code>**not bold**</code>');
    });
  });

  // ---- whatsapp ----
  describe('whatsapp', () => {
    it('converts bold', () => {
      expect(convertMarkdown('**hello**', 'whatsapp')).toBe('*hello*');
    });

    it('converts italic with *', () => {
      expect(convertMarkdown('*hello*', 'whatsapp')).toBe('_hello_');
    });

    it('keeps italic _ unchanged', () => {
      expect(convertMarkdown('_hello_', 'whatsapp')).toBe('_hello_');
    });

    it('converts strikethrough', () => {
      expect(convertMarkdown('~~deleted~~', 'whatsapp')).toBe('~deleted~');
    });

    it('converts links to plain text', () => {
      expect(convertMarkdown('[click](http://example.com)', 'whatsapp'))
        .toBe('click (http://example.com)');
    });

    it('leaves inline code as-is', () => {
      expect(convertMarkdown('use `**not bold**` here', 'whatsapp'))
        .toBe('use `**not bold**` here');
    });

    it('leaves code blocks as-is', () => {
      const input = '```\n**not bold**\n```';
      expect(convertMarkdown(input, 'whatsapp')).toBe(input);
    });
  });

  // ---- edge cases ----
  describe('edge cases', () => {
    it('returns falsy input as-is', () => {
      expect(convertMarkdown('', 'slack-mrkdwn')).toBe('');
      expect(convertMarkdown(null, 'slack-mrkdwn')).toBe(null);
      expect(convertMarkdown(undefined, 'slack-mrkdwn')).toBe(undefined);
    });

    it('returns text unchanged for unknown format', () => {
      expect(convertMarkdown('**bold**', 'unknown')).toBe('**bold**');
    });

    it('handles mixed code and formatting', () => {
      const input = '**bold** then `code` then *italic*';
      expect(convertMarkdown(input, 'slack-mrkdwn'))
        .toBe('*bold* then `code` then _italic_');
    });
  });
});
