# Markdown Fidelity and Long-Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve valid Markdown, apply one KaTeX trust policy throughout the writer, and limit formula synchronization work to changed blocks.

**Architecture:** Keep title behavior in `markdownTitle.ts`, but remove destructive normalization and the later-H1 rewrite. Extract a small production scheduler from `writingInteractions.ts`; it owns one pending animation frame and a set of changed blocks, while the interaction layer maps mutations into that scheduler. Pass the existing `mathTrust` editor option through `MarkdownWriter` into the interaction factory.

**Tech Stack:** TypeScript, Vitest, Milkdown/Crepe, KaTeX, browser MutationObserver and requestAnimationFrame.

---

## File structure

- Modify: `src/markdownTitle.ts` — preserve HTML and later H1 headings during title composition.
- Modify: `src/MarkdownWriter.tsx` — pass the resolved formula trust option to interactions.
- Modify: `src/writingInteractions.ts` — use configured trust and incremental block synchronization.
- Create: `src/latexBlockSyncScheduler.ts` — batch, deduplicate, flush, and cancel block synchronization work.
- Modify: `src/interactions.ts` — export the scheduler for hosts that need the same long-document behavior.
- Modify: `tests/markdownTitle.test.ts` — regression coverage for valid Markdown preservation.
- Create: `tests/latexBlockSyncScheduler.test.ts` — Node-only tests for batching and cancellation.

### Task 1: Preserve source Markdown while syncing the title

**Files:**
- Modify: `tests/markdownTitle.test.ts`
- Modify: `src/markdownTitle.ts:21-46,78-112`

- [ ] **Step 1: Write the failing tests**

```ts
test('keeps HTML break tags while composing a title', () => {
  expect(markdownWithTitle('Before<br />After', 'Title')).toBe(
    '# Title\n\nBefore<br />After',
  );
});

test('keeps later H1 headings while composing a title', () => {
  expect(markdownWithTitle('# Old\n\n# Chapter', 'New')).toBe(
    '# New\n\n# Chapter',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/markdownTitle.test.ts`

Expected: the HTML break assertion fails because `<br />` is removed, and the later H1 assertion fails because it becomes `## Chapter`.

- [ ] **Step 3: Write minimal implementation**

```ts
export function markdownWithoutDefaultTemplate(markdown: string) {
  const normalized = markdown.replace(/\r\n?/g, '\n').trim();
  return crepeDefaultMarkdownPattern.test(normalized) ? '' : markdown;
}

// In the body mapping:
if (index === 0 && h1Pattern.test(line)) return null;
return line;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/markdownTitle.test.ts`

Expected: all title tests pass, with later H1 headings unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/markdownTitle.ts tests/markdownTitle.test.ts
git commit -m "fix: preserve markdown while syncing title"
```

### Task 2: Batch changed formula blocks

**Files:**
- Create: `src/latexBlockSyncScheduler.ts`
- Create: `tests/latexBlockSyncScheduler.test.ts`
- Modify: `src/writingInteractions.ts:122-138,330-352,355-375`
- Modify: `src/interactions.ts`

- [ ] **Step 1: Write the failing scheduler tests**

```ts
import { createLatexBlockSyncScheduler } from '../src/latexBlockSyncScheduler';

test('deduplicates blocks into one scheduled flush', () => {
  const flushed: string[][] = [];
  let flush: (() => void) | undefined;
  const scheduler = createLatexBlockSyncScheduler<string>({
    schedule: (callback) => { flush = callback; return 1; },
    cancel: () => undefined,
    synchronize: (blocks) => flushed.push([...blocks]),
  });
  scheduler.enqueue('first');
  scheduler.enqueue('first');
  scheduler.enqueue('second');
  expect(flushed).toEqual([]);
  flush?.();
  expect(flushed).toEqual([['first', 'second']]);
});

test('cancels pending synchronization', () => {
  let cancelled: number | undefined;
  const scheduler = createLatexBlockSyncScheduler<string>({
    schedule: () => 9,
    cancel: (handle) => { cancelled = handle; },
    synchronize: () => undefined,
  });
  scheduler.enqueue('formula');
  scheduler.destroy();
  expect(cancelled).toBe(9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/latexBlockSyncScheduler.test.ts`

Expected: FAIL because `src/latexBlockSyncScheduler.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function createLatexBlockSyncScheduler<T>({ schedule, cancel, synchronize }: {
  schedule: (callback: () => void) => number;
  cancel: (handle: number) => void;
  synchronize: (blocks: readonly T[]) => void;
}) {
  const pending = new Set<T>();
  let handle: number | null = null;
  const flush = () => { handle = null; const blocks = [...pending]; pending.clear(); synchronize(blocks); };
  return {
    enqueue: (block: T) => { pending.add(block); if (handle === null) handle = schedule(flush); },
    flush,
    destroy: () => { if (handle !== null) cancel(handle); handle = null; pending.clear(); },
  };
}
```

Update `writingInteractions.ts` so initial attachment retains its full `syncLatexBlockViews()` call. The observer must enqueue only code blocks found in mutation targets or added descendants, then the scheduler flush synchronizes each queued block once. Call `destroy()` before disconnecting the observer.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/latexBlockSyncScheduler.test.ts`

Expected: both tests pass, proving batching, deduplication, and cancellation.

- [ ] **Step 5: Commit**

```bash
git add src/latexBlockSyncScheduler.ts src/writingInteractions.ts src/interactions.ts tests/latexBlockSyncScheduler.test.ts
git commit -m "perf: batch latex block synchronization"
```

### Task 3: Apply the host formula-trust policy consistently

**Files:**
- Modify: `src/writingInteractions.ts:28-46,122-130`
- Modify: `src/MarkdownWriter.tsx:220-250`
- Modify: `tests/latexBlockSyncScheduler.test.ts`

- [ ] **Step 1: Write the failing type-level interaction test**

```ts
const options: Pick<CreateWritingInteractionsOptions, 'mathTrust'> = {
  mathTrust: false,
};
expect(options.mathTrust).toBe(false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/latexBlockSyncScheduler.test.ts`

Expected: TypeScript transform fails because `mathTrust` is not part of `CreateWritingInteractionsOptions`.

- [ ] **Step 3: Write minimal implementation**

Add `mathTrust?: boolean` to `CreateWritingInteractionsOptions`, default it to `false` in `createWritingInteractions`, and use `trust: mathTrust` in every `syncLatexCodeBlockElement` call. In `MarkdownWriter`, provide `mathTrust: current.editorOptions?.mathTrust ?? false` in `interactionRuntime`.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm test -- tests/latexBlockSyncScheduler.test.ts tests/markdownTitle.test.ts`

Expected: both files pass and the option is accepted by the interaction type.

- [ ] **Step 5: Commit**

```bash
git add src/MarkdownWriter.tsx src/writingInteractions.ts tests/latexBlockSyncScheduler.test.ts
git commit -m "fix: honor configured math trust"
```

### Task 4: Verify the completed change

**Files:**
- Modify: no production files expected

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all test files pass with no failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Vite build and TypeScript declaration generation exit successfully.

- [ ] **Step 3: Inspect the final change**

Run: `git diff --check HEAD^` and `git status --short`

Expected: no whitespace errors; only the intentional source, test, and plan changes are present.

