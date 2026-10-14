import { expect, test } from 'vitest';
import {
  firstMarkdownHeading,
  markdownWithoutMatchingTitle,
  markdownWithTitle,
  markdownWithoutDefaultTemplate,
  sanitizeMarkdownSource,
  synchronizeMarkdownTitle,
} from '../src/markdownTitle';

test('keeps the article title as the first markdown h1', () => {
  expect(markdownWithTitle('Intro\n\n## Section', 'My Title')).toBe(
    '# My Title\n\nIntro\n\n## Section',
  );
});

test('uses the first h1 as the synced title without changing later h1 headings', () => {
  const markdown = '# Original\n\nBody\n\n# Second\n\n### Third';

  expect(firstMarkdownHeading(markdown)).toBe('Original');
  expect(markdownWithTitle(markdown, 'Original')).toBe(
    '# Original\n\nBody\n\n# Second\n\n### Third',
  );
});

test('keeps H1 headings unchanged inside and outside fenced code blocks', () => {
  const markdown = [
    '# Original',
    '',
    '```python',
    '# q, k: [B, T, d_k]',
    '```',
    '',
    '# Second',
  ].join('\n');

  expect(markdownWithTitle(markdown, 'Original')).toBe(
    [
      '# Original',
      '',
      '```python',
      '# q, k: [B, T, d_k]',
      '```',
      '',
      '# Second',
    ].join('\n'),
  );
});

test('only treats the first line h1 as the synced title', () => {
  const markdown = 'Intro\n\n# Body Heading';

  expect(firstMarkdownHeading(markdown)).toBe(null);
  expect(markdownWithTitle(markdown, 'My Title')).toBe(
    '# My Title\n\nIntro\n\n# Body Heading',
  );
});

test('rewrites an existing h1 when the title field changes', () => {
  expect(markdownWithTitle('# Old\n\nBody', 'New')).toBe('# New\n\nBody');
});

test('keeps markdown escapes out of the synced title text', () => {
  expect(firstMarkdownHeading('# Title\\$')).toBe('Title$');
  expect(markdownWithTitle('# Title\\$\n\nBody', 'Title$')).toBe(
    '# Title\\$\n\nBody',
  );
});

test('removes a matching first h1 before rendering article markdown', () => {
  const markdown = '# ghidra script \\(java\\)编写: 常用api/snippet\n\nBody';

  expect(
    markdownWithoutMatchingTitle(
      markdown,
      'ghidra script (java)编写: 常用api/snippet',
    ),
  ).toBe('Body');
  expect(markdownWithoutMatchingTitle('# Different\n\nBody', 'Title')).toBe(
    '# Different\n\nBody',
  );
});

test('treats the crepe default template as an empty markdown document', () => {
  const markdown = '# Untitled\n\nStart writing here.';

  expect(markdownWithoutDefaultTemplate(markdown)).toBe('');
  expect(firstMarkdownHeading(markdown)).toBe(null);
  expect(markdownWithTitle(markdown, 'Real Title')).toBe('# Real Title');
});

test('keeps html break tags in markdown source outside code fences', () => {
  expect(sanitizeMarkdownSource(['前文', '', '<br />', '', '后文'].join('\n'))).toBe(
    ['前文', '', '<br />', '', '后文'].join('\n'),
  );
  expect(sanitizeMarkdownSource('前文<br/>后文')).toBe('前文<br/>后文');
  expect(sanitizeMarkdownSource(['```html', '<br />', '```'].join('\n'))).toBe(
    ['```html', '<br />', '```'].join('\n'),
  );
});

test('keeps html break tags when composing titled markdown', () => {
  expect(markdownWithTitle(['Intro', '<br />', 'Body'].join('\n'), 'Title')).toBe(
    ['# Title', '', 'Intro', '<br />', 'Body'].join('\n'),
  );
});

test('keeps an edited plain first line and the external title synchronized', () => {
  expect(synchronizeMarkdownTitle('Editor title', 'Field title')).toEqual({
    title: 'Editor title',
    markdown: '# Editor title',
  });
});

test('keeps the leading h1 authoritative without demoting later h1 headings', () => {
  expect(
    synchronizeMarkdownTitle('# Editor title\n\nBody\n\n# Section', 'Field title'),
  ).toEqual({
    title: 'Editor title',
    markdown: '# Editor title\n\nBody\n\n# Section',
  });
});
