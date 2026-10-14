import { expect, test } from 'vitest';

import { normalizeMarkdownTablePaste } from '../src/plugins/markdownTablePaste';

const rows = [
  '| Method | Admin | Reddit |',
  '|---|---:|---:|',
  '| Prompt Update | 48.35 | 54.57 |',
  '| Logit Update | 52.31 | 57.64 |',
];

test('joins blank-separated table rows and preserves following prose', () => {
  const source = `${rows.join('\n\n')}\n\nLogit Update 的确优于 Prompt Update。`;
  expect(normalizeMarkdownTablePaste(source)).toBe(
    `${rows.join('\n')}\n\nLogit Update 的确优于 Prompt Update。`,
  );
});

test('leaves an already valid GFM table unchanged', () => {
  const source = `${rows.join('\n')}\n\nFollowing paragraph.`;
  expect(normalizeMarkdownTablePaste(source)).toBe(source);
});

test('does not reinterpret prose or escaped pipes as a table', () => {
  const prose = 'Use | as a separator.\n\nThis is ordinary prose.';
  const windowsProse = 'First paragraph.\r\n\r\nSecond paragraph.';
  const escaped = rows.map((row) => `\\${row}`).join('\n\n');
  expect(normalizeMarkdownTablePaste(prose)).toBe(prose);
  expect(normalizeMarkdownTablePaste(windowsProse)).toBe(windowsProse);
  expect(normalizeMarkdownTablePaste(escaped)).toBe(escaped);
});

test('does not rewrite table-like text inside a fenced code block', () => {
  const source = `\`\`\`markdown\n${rows.join('\n\n')}\n\`\`\``;
  expect(normalizeMarkdownTablePaste(source)).toBe(source);
});

test('requires a separator and at least one matching data row', () => {
  const noData = `${rows[0]}\n\n${rows[1]}\n\nFollowing paragraph.`;
  const wrongColumns = `${rows[0]}\n\n${rows[1]}\n\n| only | two |`;
  expect(normalizeMarkdownTablePaste(noData)).toBe(noData);
  expect(normalizeMarkdownTablePaste(wrongColumns)).toBe(wrongColumns);
});
