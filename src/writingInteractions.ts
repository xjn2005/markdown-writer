import type { Crepe } from '@milkdown/crepe';
import type { RefCell } from './ref';

import {
  closeActiveCodeBlockFence,
  deleteLatexBlockBeforeParagraphInCtx,
  deleteLatexBlockBeforeSelectionInCtx,
  focusParagraphElementInCtx,
  hasActiveCodeBlockClosingFence,
  openInlineMathPopover,
  promoteActiveCodeBlockInfoString,
} from './mathCommands';
import {
  pasteCodeBlockInCtx,
  pasteMarkdownMathInCtx,
  shouldPasteClipboardAsCodeBlock,
  shouldPasteClipboardAsMarkdown,
} from './mathMarkdown';
import { rinLatexBlockOpenEvent } from './mathEvents';
import { createLatexBlockSyncScheduler } from './latexBlockSyncScheduler';
import { syncLatexCodeBlockElement } from './mathView';

export type InlineMathLabels = {
  ariaLabel: string;
  save: string;
  cancel: string;
};

export type CreateWritingInteractionsOptions = {
  host: HTMLElement;
  editorRef: RefCell<Crepe | null>;
  readOnlyRef: RefCell<boolean>;
  mathTrust?: boolean;
  scheduleMathReparse: (source: string) => void;
  openLatexFromPointer: (event: PointerEvent) => void;
  openLatexFromFocus: (event: FocusEvent) => void;
  openLatexFromShortcut: (event: Event, host: HTMLElement) => void;
  openFocusedLatex: (host: HTMLElement) => boolean;
  onPasteMarkdown?: (markdown: string) => void;
  onSynchronized?: () => void;
  inlineMathLabels?: InlineMathLabels;
};

type PendingCodeBlockFocus = {
  beforeCount: number;
  timeout: number;
};

/** Attach the optional math and cursor DOM lifecycle to a Milkdown host. */
export function createWritingInteractions({
  host,
  editorRef,
  readOnlyRef,
  scheduleMathReparse,
  openLatexFromPointer,
  openLatexFromFocus,
  openLatexFromShortcut,
  openFocusedLatex,
  onPasteMarkdown,
  onSynchronized,
  inlineMathLabels,
  mathTrust = false,
}: CreateWritingInteractionsOptions) {
  let attached = false;
  let destroyed = false;
  let closeInlineMathEditor: (() => void) | null = null;
  let pendingCodeBlockFocus: PendingCodeBlockFocus | null = null;

  const clearPendingCodeBlockFocus = () => {
    if (pendingCodeBlockFocus) {
      window.clearTimeout(pendingCodeBlockFocus.timeout);
    }
    pendingCodeBlockFocus = null;
  };

  const focusLatestEmptyCodeBlockEditor = () => {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      activeElement !== document.body &&
      !host.contains(activeElement)
    ) {
      return false;
    }
    if (
      activeElement instanceof HTMLElement &&
      activeElement.classList.contains('cm-content')
    ) {
      return false;
    }
    const contents = Array.from(
      host.querySelectorAll('.milkdown-code-block:not(.rin-latex-block) .cm-content'),
    );
    const content = contents[contents.length - 1];
    if (!(content instanceof HTMLElement) || (content.textContent || '') !== '') {
      return false;
    }
    content.focus();
    return true;
  };

  const focusPendingCodeBlockEditor = () => {
    const pending = pendingCodeBlockFocus;
    if (!pending || readOnlyRef.current) return false;
    const blocks = Array.from(
      host.querySelectorAll('.milkdown-code-block:not(.rin-latex-block)'),
    );
    if (blocks.length <= pending.beforeCount) return false;
    const activeElement = document.activeElement;
    if (activeElement && activeElement !== document.body && !host.contains(activeElement)) {
      return false;
    }
    const block = blocks[blocks.length - 1];
    const content = block?.querySelector('.cm-content');
    if (!(content instanceof HTMLElement)) return false;
    clearPendingCodeBlockFocus();
    window.requestAnimationFrame(() => {
      content.focus();
      window.setTimeout(() => content.focus(), 50);
      window.setTimeout(() => focusLatestEmptyCodeBlockEditor(), 100);
    });
    return true;
  };

  const syncLatexBlockViews = (
    blocks: Iterable<Element> = host.querySelectorAll('.milkdown-code-block'),
  ) => {
    for (const block of blocks) {
      if (!(block instanceof HTMLElement)) return;
      syncLatexCodeBlockElement(block, latexSyncKatexOptions(mathTrust));
    }
  };

  const synchronize = () => {
    syncLatexBlockViews();
    focusPendingCodeBlockEditor();
    openFocusedLatex(host);
    onSynchronized?.();
  };

  const latexBlockSyncScheduler = createLatexBlockSyncScheduler<HTMLElement>({
    schedule: window.requestAnimationFrame.bind(window),
    cancel: window.cancelAnimationFrame.bind(window),
    synchronize: (blocks) => {
      syncLatexBlockViews(blocks);
      focusPendingCodeBlockEditor();
      openFocusedLatex(host);
      onSynchronized?.();
    },
  });

  const enqueueAffectedLatexBlocks = (node: Node) => {
    if (!(node instanceof Element)) return;
    const containingBlock = node.closest('.milkdown-code-block');
    if (containingBlock instanceof HTMLElement) {
      latexBlockSyncScheduler.enqueue(containingBlock);
    }
    if (node instanceof HTMLElement && node.matches('.milkdown-code-block')) {
      latexBlockSyncScheduler.enqueue(node);
    }
    node.querySelectorAll('.milkdown-code-block').forEach((block) => {
      if (block instanceof HTMLElement) latexBlockSyncScheduler.enqueue(block);
    });
  };

  const parsePastedMathMarkdown = (event: ClipboardEvent) => {
    if (readOnlyRef.current) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    const html = event.clipboardData?.getData('text/html') || '';
    if (!editorRef.current) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.cm-content')) return;
    if (shouldPasteClipboardAsCodeBlock(text, html)) {
      event.preventDefault();
      event.stopPropagation();
      editorRef.current.editor.action((ctx) => pasteCodeBlockInCtx(ctx, text));
      return;
    }
    if (!shouldPasteClipboardAsMarkdown(text, html)) return;
    event.preventDefault();
    event.stopPropagation();
    editorRef.current.editor.action((ctx) => pasteMarkdownMathInCtx(ctx, text));
    onPasteMarkdown?.(text);
    window.setTimeout(() => {
      syncLatexBlockViews();
      const source = editorRef.current?.getMarkdown();
      if (source) scheduleMathReparse(source);
    }, 0);
  };

  const closeCodeBlockFenceOnEnter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || readOnlyRef.current || !editorRef.current) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const block = target.closest('.milkdown-code-block:not(.rin-latex-block)');
    if (!(block instanceof HTMLElement)) return;
    const closeAfterCodeMirrorUpdate = () => {
      window.setTimeout(() => {
        if (readOnlyRef.current || !editorRef.current || !block.isConnected) return;
        closeActiveCodeBlockFence(editorRef.current, block);
      }, 0);
    };
    if (promoteActiveCodeBlockInfoString(editorRef.current, block)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!hasActiveCodeBlockClosingFence(editorRef.current, block)) {
      closeAfterCodeMirrorUpdate();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closeAfterCodeMirrorUpdate();
  };

  const closeCodeBlockFenceAfterEnter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || readOnlyRef.current || !editorRef.current) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const block = target.closest('.milkdown-code-block:not(.rin-latex-block)');
    if (!(block instanceof HTMLElement)) return;
    if (!hasActiveCodeBlockClosingFence(editorRef.current, block)) return;
    event.preventDefault();
    event.stopPropagation();
    closeActiveCodeBlockFence(editorRef.current, block);
  };

  const keepFocusOnBlankParagraphAfterCodeBlock = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || readOnlyRef.current) return;
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
    const paragraph = anchorElement?.closest('.ProseMirror p');
    if (!(paragraph instanceof HTMLElement) || (paragraph.textContent || '') !== '') return;
    const previous = paragraph.previousElementSibling;
    if (
      !(previous instanceof HTMLElement) ||
      !previous.matches('.milkdown-code-block:not(.rin-latex-block)')
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    editorRef.current?.editor.action((ctx) =>
      focusParagraphElementInCtx(ctx, paragraph),
    );
  };

  const keepFocusOnBlankParagraphAfterLatexBlock = (event: KeyboardEvent) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    if (
      editorRef.current?.editor.action((ctx) =>
        deleteLatexBlockBeforeSelectionInCtx(ctx),
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
    const paragraph = anchorElement?.closest('.ProseMirror p');
    if (!(paragraph instanceof HTMLElement) || (paragraph.textContent || '') !== '') return;
    const previousContentSibling = (element: Element) => {
      let current = element.previousElementSibling;
      while (current?.classList.contains('prosemirror-virtual-cursor')) {
        current = current.previousElementSibling;
      }
      return current;
    };
    let targetParagraph = paragraph;
    let previous = previousContentSibling(targetParagraph);
    if (
      previous instanceof HTMLElement &&
      previous.matches('.ProseMirror p') &&
      (previous.textContent || '') === ''
    ) {
      const beforePrevious = previousContentSibling(previous);
      if (
        beforePrevious instanceof HTMLElement &&
        beforePrevious.matches('.rin-latex-block')
      ) {
        targetParagraph = previous;
        previous = beforePrevious;
      }
    }
    if (!(previous instanceof HTMLElement) || !previous.matches('.rin-latex-block')) return;
    event.preventDefault();
    event.stopPropagation();
    editorRef.current?.editor.action((ctx) =>
      deleteLatexBlockBeforeParagraphInCtx(ctx, targetParagraph),
    );
  };

  const requestCodeBlockFocusAfterEnter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || readOnlyRef.current) return;
    const target = event.target instanceof Element ? event.target : null;
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
    const eventInsideHost = Boolean(target && host.contains(target));
    const selectionInsideHost = Boolean(anchorElement && host.contains(anchorElement));
    if (!eventInsideHost && !selectionInsideHost) return;
    if (
      target?.closest('.milkdown-code-block') ||
      anchorElement?.closest('.milkdown-code-block')
    ) {
      return;
    }
    clearPendingCodeBlockFocus();
    pendingCodeBlockFocus = {
      beforeCount: host.querySelectorAll('.milkdown-code-block:not(.rin-latex-block)').length,
      timeout: window.setTimeout(() => {
        pendingCodeBlockFocus = null;
      }, 1200),
    };
    window.setTimeout(() => focusPendingCodeBlockEditor(), 0);
    window.setTimeout(() => focusPendingCodeBlockEditor(), 50);
    window.setTimeout(() => focusPendingCodeBlockEditor(), 200);
    window.setTimeout(() => focusLatestEmptyCodeBlockEditor(), 100);
    window.setTimeout(() => focusLatestEmptyCodeBlockEditor(), 300);
  };

  const openInlineMathEditor = (event: MouseEvent) => {
    if (readOnlyRef.current || !editorRef.current) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const mathNode = target.closest('span[data-type="math_inline"]');
    if (!(mathNode instanceof HTMLElement)) return;
    closeInlineMathEditor?.();
    closeInlineMathEditor = openInlineMathPopover(
      editorRef.current,
      mathNode,
      () => {
        closeInlineMathEditor = null;
      },
      inlineMathLabels,
    );
    if (!closeInlineMathEditor) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const openLatexBlockEditorFromShortcut = (event: Event) => {
    openLatexFromShortcut(event, host);
  };

  const preventReadonlyMutation = (event: Event) => {
    if (!readOnlyRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      enqueueAffectedLatexBlocks(record.target);
      record.addedNodes.forEach(enqueueAffectedLatexBlocks);
    });
  });

  const attach = () => {
    if (attached || destroyed) return;
    attached = true;
    host.addEventListener('paste', parsePastedMathMarkdown, true);
    host.addEventListener('keydown', keepFocusOnBlankParagraphAfterCodeBlock, true);
    host.addEventListener('keydown', keepFocusOnBlankParagraphAfterLatexBlock, true);
    document.addEventListener('keydown', requestCodeBlockFocusAfterEnter, true);
    host.addEventListener(rinLatexBlockOpenEvent, openLatexBlockEditorFromShortcut);
    host.addEventListener('keydown', closeCodeBlockFenceOnEnter, true);
    host.addEventListener('keyup', closeCodeBlockFenceAfterEnter, true);
    host.addEventListener('drop', preventReadonlyMutation, true);
    host.addEventListener('click', openInlineMathEditor, true);
    host.addEventListener('pointerdown', openLatexFromPointer, true);
    host.addEventListener('focusin', openLatexFromFocus, true);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-language'],
    });
    synchronize();
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    clearPendingCodeBlockFocus();
    if (attached) {
      host.removeEventListener('paste', parsePastedMathMarkdown, true);
      host.removeEventListener('keydown', keepFocusOnBlankParagraphAfterCodeBlock, true);
      host.removeEventListener('keydown', keepFocusOnBlankParagraphAfterLatexBlock, true);
      document.removeEventListener('keydown', requestCodeBlockFocusAfterEnter, true);
      host.removeEventListener(rinLatexBlockOpenEvent, openLatexBlockEditorFromShortcut);
      host.removeEventListener('keydown', closeCodeBlockFenceOnEnter, true);
      host.removeEventListener('keyup', closeCodeBlockFenceAfterEnter, true);
      host.removeEventListener('drop', preventReadonlyMutation, true);
      host.removeEventListener('click', openInlineMathEditor, true);
      host.removeEventListener('pointerdown', openLatexFromPointer, true);
      host.removeEventListener('focusin', openLatexFromFocus, true);
    }
    latexBlockSyncScheduler.destroy();
    observer.disconnect();
    closeInlineMathEditor?.();
    closeInlineMathEditor = null;
  };

  return { attach, destroy, synchronize };
}

export function latexSyncKatexOptions(mathTrust = false) {
  return {
    throwOnError: false,
    strict: false,
    trust: mathTrust,
  };
}
