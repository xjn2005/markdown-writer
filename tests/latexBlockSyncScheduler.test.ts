import { expect, test } from 'vitest';

import { createLatexBlockSyncScheduler } from '../src/latexBlockSyncScheduler';
import {
  latexSyncKatexOptions,
  type CreateWritingInteractionsOptions,
} from '../src/writingInteractions';

test('accepts an explicit formula trust policy', () => {
  const options: Pick<CreateWritingInteractionsOptions, 'mathTrust'> = {
    mathTrust: false,
  };

  expect(options.mathTrust).toBe(false);
});

test('keeps custom formula preview untrusted by default', () => {
  expect(latexSyncKatexOptions()).toMatchObject({
    throwOnError: false,
    strict: false,
    trust: false,
  });
  expect(latexSyncKatexOptions(true)).toMatchObject({ trust: true });
});

test('deduplicates blocks into one scheduled flush', () => {
  const flushed: string[][] = [];
  let flush: (() => void) | undefined;
  const scheduler = createLatexBlockSyncScheduler<string>({
    schedule: (callback) => {
      flush = callback;
      return 1;
    },
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
    cancel: (handle) => {
      cancelled = handle;
    },
    synchronize: () => undefined,
  });

  scheduler.enqueue('formula');
  scheduler.destroy();

  expect(cancelled).toBe(9);
});
