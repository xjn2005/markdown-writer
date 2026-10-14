import { Plugin } from '@milkdown/kit/prose/state';
import { $prose, insert } from '@milkdown/kit/utils';

type MarkdownTableRow = {
  columnCount: number;
};

function parseMarkdownTableRow(line: string): MarkdownTableRow | null {
  if (/^(?: {4,}|\t)/.test(line)) return null;
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  const cells: string[] = [];
  let cell = '';
  let escaped = false;
  let codeFenceLength = 0;
  for (let index = 1; index < trimmed.length - 1; index += 1) {
    const character = trimmed[index];
    if (escaped) {
      cell += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      cell += character;
      escaped = true;
      continue;
    }
    if (character === '`') {
      let runLength = 1;
      while (trimmed[index + runLength] === '`') runLength += 1;
      if (codeFenceLength === 0) codeFenceLength = runLength;
      else if (codeFenceLength === runLength) codeFenceLength = 0;
      cell += '`'.repeat(runLength);
      index += runLength - 1;
      continue;
    }
    if (character === '|' && codeFenceLength === 0) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  return cells.length >= 2 ? { columnCount: cells.length } : null;
}

function isMarkdownTableSeparator(line: string, columnCount: number) {
  if (/^(?: {4,}|\t)/.test(line)) return false;
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
  return (
    cells.length === columnCount &&
    cells.every((cell) => /^:?-{1,}:?$/.test(cell))
  );
}

function nextNonBlankLine(lines: string[], start: number) {
  let index = start;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  return index;
}

function fencedCodeMarker(line: string) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
  return match?.[1] ?? '';
}

/**
 * Repairs a strict GFM table whose rows were separated by blank lines by a
 * rich-text clipboard source. Other Markdown, escaped pipes, and fenced code
 * are preserved byte-for-byte.
 */
export function normalizeMarkdownTablePaste(markdown: string) {
  const normalizedNewlines = markdown.replace(/\r\n?/g, '\n');
  const lines = normalizedNewlines.split('\n');
  const output: string[] = [];
  let fence = '';
  let changed = false;

  for (let index = 0; index < lines.length;) {
    const marker = fencedCodeMarker(lines[index]);
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = '';
      output.push(lines[index]);
      index += 1;
      continue;
    }
    if (fence) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const header = parseMarkdownTableRow(lines[index]);
    if (!header) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const separatorIndex = nextNonBlankLine(lines, index + 1);
    if (
      separatorIndex >= lines.length ||
      !isMarkdownTableSeparator(lines[separatorIndex], header.columnCount)
    ) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const rowIndexes: number[] = [];
    let cursor = nextNonBlankLine(lines, separatorIndex + 1);
    while (cursor < lines.length) {
      const row = parseMarkdownTableRow(lines[cursor]);
      if (!row || row.columnCount !== header.columnCount) break;
      rowIndexes.push(cursor);
      cursor = nextNonBlankLine(lines, cursor + 1);
    }
    if (rowIndexes.length === 0) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const tableIndexes = [index, separatorIndex, ...rowIndexes];
    const hasInternalBlankLine = tableIndexes.some(
      (lineIndex, itemIndex) => itemIndex > 0 && lineIndex > tableIndexes[itemIndex - 1] + 1,
    );
    if (!hasInternalBlankLine) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    output.push(...tableIndexes.map((lineIndex) => lines[lineIndex]));
    changed = true;
    index = rowIndexes[rowIndexes.length - 1] + 1;
  }

  return changed ? output.join('\n') : markdown;
}

export const rinMarkdownTablePastePlugin = $prose((ctx) => {
  return new Plugin({
    props: {
      handleDOMEvents: {
        paste: (_view, event) => {
          const markdown = event.clipboardData?.getData('text/plain') ?? '';
          if (!markdown) return false;
          const normalized = normalizeMarkdownTablePaste(markdown);
          if (normalized === markdown) return false;
          event.preventDefault();
          insert(normalized)(ctx);
          return true;
        },
      },
    },
  });
});
