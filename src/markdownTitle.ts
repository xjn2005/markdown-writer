const h1Pattern = /^\s{0,3}#(?!#)(?:\s|$)/;
const crepeDefaultMarkdownPattern = /^#\s+Untitled\s*\n+\s*Start writing here\.\s*$/i;
const markdownTextEscapePattern = /\\([\\`*{}\[\]()#+\-.!_$<>|])/g;
const markdownHeadingSpecialPattern = /([\\`*{}\[\]()#+\-.!_$<>|])/g;

function unescapeMarkdownText(value: string) {
  return value.replace(markdownTextEscapePattern, '$1');
}

function normalizedMarkdownTitleText(value: string) {
  return unescapeMarkdownText(value).replace(/\s+/g, ' ').trim();
}

function escapeMarkdownHeadingText(value: string) {
  return value.replace(markdownHeadingSpecialPattern, '\\$1');
}

export function sanitizeMarkdownSource(markdown: string) {
  return markdown.replace(/\r\n?/g, '\n');
}

export function markdownWithoutDefaultTemplate(markdown: string) {
  const normalized = markdown.replace(/\r\n?/g, '\n').trim();
  return crepeDefaultMarkdownPattern.test(normalized) ? '' : sanitizeMarkdownSource(markdown);
}

export function firstMarkdownHeading(markdown: string) {
  const heading = markdownWithoutDefaultTemplate(markdown)
    .replace(/\r\n?/g, '\n')
    .split('\n')[0];
  if (!heading || !h1Pattern.test(heading)) return null;
  return heading
    .replace(/^\s{0,3}#\s*/, '')
    .replace(/\s+#*\s*$/, '')
    .replace(markdownTextEscapePattern, '$1')
    .trim();
}

export function markdownWithoutMatchingTitle(markdown: string, title: string) {
  const source = markdownWithoutDefaultTemplate(markdown).replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const firstLine = lines[0] || '';
  const firstHeading = firstMarkdownHeading(source);

  if (
    !h1Pattern.test(firstLine) ||
    !firstHeading ||
    normalizedMarkdownTitleText(firstHeading) !== normalizedMarkdownTitleText(title)
  ) {
    return source;
  }

  return lines.slice(1).join('\n').replace(/^\n+/, '');
}

function demoteMarkdownHeading(line: string) {
  return line.replace(/^(\s{0,3})#(?!#)(\s|$)/, '$1##$2');
}

export function markdownWithTitle(markdown: string, title: string) {
  const nextTitle = title.trim();
  const lines = markdownWithoutDefaultTemplate(markdown)
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const bodyLines = lines.map((line, index) => {
    if (index === 0 && h1Pattern.test(line)) return null;
    return line;
  });
  const body = bodyLines
    .filter((line): line is string => line !== null)
    .join('\n')
    .replace(/^\n+/, '');

  if (!nextTitle) return body;
  const escapedTitle = escapeMarkdownHeadingText(unescapeMarkdownText(nextTitle));
  return body.trim() ? `# ${escapedTitle}\n\n${body}` : `# ${escapedTitle}`;
}

export type SynchronizedMarkdownTitle = {
  title: string;
  markdown: string;
};

/** Keep the external title and the editor's first visible line as one value. */
export function synchronizeMarkdownTitle(markdown: string, currentTitle: string) {
  const source = markdownWithoutDefaultTemplate(markdown).replace(/\r\n?/g, '\n');
  const headingTitle = firstMarkdownHeading(source);
  if (headingTitle) {
    return {
      title: headingTitle,
      markdown: markdownWithTitle(source, headingTitle),
    } satisfies SynchronizedMarkdownTitle;
  }

  const lines = source.split('\n');
  const firstLine = lines[0]?.trim() || '';
  if (firstLine) {
    const firstLineTitle = normalizedMarkdownTitleText(
      firstLine.replace(/^\s{0,3}#{1,6}(?:\s+|$)/, ''),
    );
    const body = lines.slice(1).join('\n').replace(/^\n+/, '');
    return {
      title: firstLineTitle,
      markdown: markdownWithTitle(body, firstLineTitle),
    } satisfies SynchronizedMarkdownTitle;
  }

  return {
    title: currentTitle,
    markdown: markdownWithTitle(source, currentTitle),
  } satisfies SynchronizedMarkdownTitle;
}
