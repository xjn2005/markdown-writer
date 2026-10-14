import type { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { replaceAll } from '@milkdown/kit/utils';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';

import { LatexBlockEditorPanel, useLatexBlockEditor } from './LatexBlockEditor';
import {
  firstMarkdownHeading,
  markdownWithoutDefaultTemplate,
  synchronizeMarkdownTitle,
} from './markdownTitle';
import { insertLatexBlockInCtx } from './mathCommands';
import { normalizeMilkdownMathMarkdown, restoreSelectionBookmarkInCtx } from './mathMarkdown';
import { createMathReparseController } from './mathReparse';
import {
  createWritingInteractions,
  type CreateWritingInteractionsOptions,
} from './writingInteractions';
import {
  applyWriterTopBarLabels,
  createWriterEditor,
  syncWriterTitle,
  WriterEditorFrame,
  WriterTitleField,
  type CreateWriterEditorOptions,
  type WriterHeadingOption,
  type WriterTopBarLabels,
} from './writer';

export type MarkdownWriterLabels = {
  title: string;
  editor: string;
  enterFullscreen: string;
  exitFullscreen: string;
  mathBlockEditor: string;
  done: string;
  math: string;
  headings: WriterHeadingOption[];
  topBar: WriterTopBarLabels;
  inlineMath: NonNullable<CreateWritingInteractionsOptions['inlineMathLabels']>;
};

type WriterInteractions = {
  attach: () => void;
  destroy: () => void;
};

export type MarkdownWriterInteractionRuntime = Omit<
  CreateWritingInteractionsOptions,
  'host'
> & { host: HTMLElement };

export type MarkdownWriterRefs = {
  editor: MutableRefObject<Crepe | null>;
  markdown: MutableRefObject<string>;
  title: MutableRefObject<string>;
  syncing: MutableRefObject<boolean>;
  readOnly: MutableRefObject<boolean>;
  skipNextMathReparse: MutableRefObject<boolean>;
};

export type MarkdownWriterHandle = {
  closeLatexEditor: (commit?: boolean, focusAfter?: boolean) => void;
  getEditor: () => Crepe | null;
  getMarkdown: () => string;
  replaceMarkdown: (markdown: string) => void;
};

export type MarkdownWriterProps = {
  title: string;
  initialMarkdown: string;
  labels: MarkdownWriterLabels;
  onTitleChange: (title: string) => void;
  onMarkdownChange?: (markdown: string) => void;
  onReadyChange?: (ready: boolean) => void;
  onError?: (error: unknown) => void;
  active?: boolean;
  refs?: MarkdownWriterRefs;
  toolbarAfterTitle?: ReactNode;
  afterEditor?: ReactNode;
  loading?: ReactNode;
  serializeMarkdown?: (markdown: string) => string;
  hydrateMarkdown?: (markdown: string) => string;
  normalizeMarkdown?: (markdown: string) => string;
  createEditor?: (options: CreateWriterEditorOptions) => Crepe;
  createInteractions?: (
    runtime: MarkdownWriterInteractionRuntime,
  ) => WriterInteractions;
  editorOptions?: Partial<
    Pick<
      CreateWriterEditorOptions,
      | 'extendTopBar'
      | 'uploadImage'
      | 'imageCaptionPlaceholder'
      | 'imageUploadPlaceholder'
      | 'mathTrust'
    >
  >;
};

const identityMarkdown = (markdown: string) => markdown;
const defaultNormalizeMarkdown = (markdown: string) =>
  normalizeMilkdownMathMarkdown(markdownWithoutDefaultTemplate(markdown));

function differsOnlyByTrailingBlankLines(current: string, normalized: string) {
  const trimTrailingBlankLines = (value: string) => value.replace(/\n+$/g, '');
  return trimTrailingBlankLines(current) === trimTrailingBlankLines(normalized);
}

/**
 * The title + Milkdown page used by Rinspace and by the generated public page.
 * Site-only controls and services are supplied through adapters and slots.
 */
export const MarkdownWriter = forwardRef<MarkdownWriterHandle, MarkdownWriterProps>(
  function MarkdownWriter(props, forwardedRef) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const internalEditorRef = useRef<Crepe | null>(null);
    const internalMarkdownRef = useRef('');
    const internalTitleRef = useRef('');
    const internalSyncingRef = useRef(false);
    const internalReadOnlyRef = useRef(false);
    const internalSkipNextMathReparseRef = useRef(false);
    const refs = props.refs ?? {
      editor: internalEditorRef,
      markdown: internalMarkdownRef,
      title: internalTitleRef,
      syncing: internalSyncingRef,
      readOnly: internalReadOnlyRef,
      skipNextMathReparse: internalSkipNextMathReparseRef,
    };
    const propsRef = useRef(props);
    propsRef.current = props;
    const refsRef = useRef(refs);
    refsRef.current = refs;
    const [editorReady, setEditorReady] = useState(false);

    const normalizeMarkdown = useCallback((markdown: string) => {
      const current = propsRef.current;
      const serialize = current.serializeMarkdown ?? identityMarkdown;
      const normalize = current.normalizeMarkdown ?? defaultNormalizeMarkdown;
      return normalize(serialize(markdown));
    }, []);

    const latex = useLatexBlockEditor({
      editorRef: refs.editor,
      readOnlyRef: refs.readOnly,
      skipNextMathReparseRef: refs.skipNextMathReparse,
      normalizeMarkdown,
      onCommit: (markdown) => {
        refsRef.current.markdown.current = markdown;
        propsRef.current.onMarkdownChange?.(markdown);
      },
    });

    const replaceMarkdown = useCallback((markdown: string) => {
      const currentRefs = refsRef.current;
      const editor = currentRefs.editor.current;
      if (!editor) return;
      const hydrate = propsRef.current.hydrateMarkdown ?? identityMarkdown;
      currentRefs.syncing.current = true;
      currentRefs.markdown.current = markdown;
      editor.editor.action(replaceAll(hydrate(markdown), true));
      window.setTimeout(() => { currentRefs.syncing.current = false; }, 0);
    }, []);

    useImperativeHandle(forwardedRef, () => ({
      closeLatexEditor: latex.closeEditor,
      getEditor: () => refsRef.current.editor.current,
      getMarkdown: () => refsRef.current.markdown.current,
      replaceMarkdown,
    }), [latex.closeEditor, replaceMarkdown]);

    useEffect(() => {
      refs.title.current = props.title;
    }, [props.title, refs.title]);

    useEffect(() => {
      const host = hostRef.current;
      if (!host || props.active === false) return undefined;
      let disposed = false;
      setEditorReady(false);
      props.onReadyChange?.(false);
      host.innerHTML = '';
      const current = propsRef.current;
      const hydrate = current.hydrateMarkdown ?? identityMarkdown;
      const {
        clear: clearMathReparseTimer,
        hasActiveSelection: editorHasActiveSelection,
        markHandled: markMathReparseHandled,
        replaceAllWhenInactive: replaceAllWhenEditorInactive,
        schedule: scheduleMathReparse,
      } = createMathReparseController({
        host,
        editorRef: refs.editor,
        markdownRef: refs.markdown,
        syncingRef: refs.syncing,
      });
      const makeEditor = current.createEditor ?? createWriterEditor;
      const editor = makeEditor({
        root: host,
        defaultValue: hydrate(current.initialMarkdown),
        headingOptions: current.labels.headings,
        placeholder: false,
        mathLabel: current.labels.math,
        openMath: (ctx) => {
          latex.closeEditor();
          clearMathReparseTimer();
          refs.skipNextMathReparse.current = true;
          const pos = insertLatexBlockInCtx(ctx);
          if (pos === false) {
            refs.skipNextMathReparse.current = false;
            return;
          }
          window.requestAnimationFrame(() => {
            if (latex.openEditorAtPos(pos)) return;
            window.setTimeout(() => { latex.openEditorAtPos(pos); }, 50);
          });
        },
        ...current.editorOptions,
      });
      const interactionRuntime: MarkdownWriterInteractionRuntime = {
        host,
        editorRef: refs.editor,
        readOnlyRef: refs.readOnly,
        mathTrust: current.editorOptions?.mathTrust ?? false,
        scheduleMathReparse,
        openLatexFromPointer: latex.openEditorFromPointer,
        openLatexFromFocus: latex.openEditorFromFocus,
        openLatexFromShortcut: latex.openEditorFromShortcut,
        openFocusedLatex: latex.openFocusedEditor,
        onPasteMarkdown: (markdown) => {
          const pastedTitle = firstMarkdownHeading(markdown);
          if (pastedTitle && pastedTitle !== refs.title.current) {
            refs.title.current = pastedTitle;
            propsRef.current.onTitleChange(pastedTitle);
          }
        },
        inlineMathLabels: current.labels.inlineMath,
      };
      const interactions = current.createInteractions
        ? current.createInteractions(interactionRuntime)
        : createWritingInteractions(interactionRuntime);
      const restoreEditorSelectionAfterTitleSync = () => {
        const activeElement = document.activeElement;
        if (!refs.editor.current || !activeElement || !host.contains(activeElement)) return;
        const bookmark = editor.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          return view.state.selection.getBookmark();
        });
        window.setTimeout(() => {
          refs.editor.current?.editor.action((ctx) => {
            restoreSelectionBookmarkInCtx(ctx, bookmark);
          });
        }, 0);
      };
      let compositionActive = false;
      let compositionSyncPending = false;
      let compositionSyncTimer: number | null = null;
      const clearCompositionSyncTimer = () => {
        if (compositionSyncTimer !== null) {
          window.clearTimeout(compositionSyncTimer);
          compositionSyncTimer = null;
        }
      };
      const applyMarkdownUpdate = (
        markdown: string,
        composing: boolean,
        notifyMarkdownChange = true,
      ) => {
        const cleanMarkdown = normalizeMarkdown(markdown);
        refs.markdown.current = cleanMarkdown;
        if (refs.syncing.current) return;
        if (notifyMarkdownChange) {
          propsRef.current.onMarkdownChange?.(cleanMarkdown);
        }
        if (composing) {
          compositionSyncPending = true;
          return;
        }
        compositionSyncPending = false;
        clearCompositionSyncTimer();
        const synchronized = synchronizeMarkdownTitle(cleanMarkdown, refs.title.current);
        if (synchronized.title !== refs.title.current) {
          refs.title.current = synchronized.title;
          propsRef.current.onTitleChange(synchronized.title);
          restoreEditorSelectionAfterTitleSync();
        }
        const normalizedMarkdown = synchronized.markdown;
        if (normalizedMarkdown !== cleanMarkdown) {
          if (differsOnlyByTrailingBlankLines(cleanMarkdown, normalizedMarkdown)) {
            refs.markdown.current = normalizedMarkdown;
            return;
          }
          refs.syncing.current = true;
          refs.markdown.current = normalizedMarkdown;
          editor.editor.action(replaceAll(hydrate(normalizedMarkdown), true));
          window.setTimeout(() => { refs.syncing.current = false; }, 0);
          return;
        }
        if (refs.skipNextMathReparse.current) {
          refs.skipNextMathReparse.current = false;
          markMathReparseHandled(cleanMarkdown);
          return;
        }
        if (cleanMarkdown !== markdown) {
          if (editorHasActiveSelection()) return;
          refs.syncing.current = true;
          replaceAllWhenEditorInactive(hydrate(cleanMarkdown));
          window.setTimeout(() => { refs.syncing.current = false; }, 0);
        }
      };
      const finishCompositionSync = () => {
        clearCompositionSyncTimer();
        compositionSyncTimer = window.setTimeout(() => {
          compositionSyncTimer = null;
          compositionActive = false;
          if (disposed || !compositionSyncPending) return;
          applyMarkdownUpdate(editor.getMarkdown(), false, false);
        }, 0);
      };
      const beginCompositionSync = () => {
        compositionActive = true;
        clearCompositionSyncTimer();
      };
      host.addEventListener('compositionstart', beginCompositionSync, true);
      host.addEventListener('compositionend', finishCompositionSync, true);
      host.addEventListener('compositioncancel', finishCompositionSync, true);
      refs.editor.current = editor;
      editor.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          applyMarkdownUpdate(markdown, compositionActive);
        });
      });
      void editor.create().then(() => {
        if (disposed) return;
        const serialize = propsRef.current.serializeMarkdown ?? identityMarkdown;
        const currentMarkdown = serialize(editor.getMarkdown());
        const cleanMarkdown = markdownWithoutDefaultTemplate(currentMarkdown);
        refs.markdown.current = cleanMarkdown;
        if (cleanMarkdown !== currentMarkdown) {
          replaceAllWhenEditorInactive(hydrate(cleanMarkdown));
        }
        scheduleMathReparse(cleanMarkdown);
        interactions.attach();
        setEditorReady(true);
        propsRef.current.onReadyChange?.(true);
      }).catch((error: unknown) => {
        if (!disposed) propsRef.current.onError?.(error);
      });
      return () => {
        disposed = true;
        clearCompositionSyncTimer();
        host.removeEventListener('compositionstart', beginCompositionSync, true);
        host.removeEventListener('compositionend', finishCompositionSync, true);
        host.removeEventListener('compositioncancel', finishCompositionSync, true);
        clearMathReparseTimer();
        interactions.destroy();
        latex.closeEditor(false);
        void editor.destroy();
        refs.editor.current = null;
        setEditorReady(false);
        propsRef.current.onReadyChange?.(false);
      };
    }, [normalizeMarkdown, props.active, props.initialMarkdown]);

    useEffect(() => {
      const host = hostRef.current;
      if (!host || !editorReady) return undefined;
      return applyWriterTopBarLabels(host, props.labels.topBar);
    }, [editorReady, props.labels.topBar]);

    const changeTitle = (value: string) => {
      latex.closeEditor();
      refs.title.current = value;
      props.onTitleChange(value);
      if (editorReady) {
        syncWriterTitle({
          editor: refs.editor.current,
          markdownRef: refs.markdown,
          syncingRef: refs.syncing,
          title: value,
        });
      }
    };

    return (
      <main className="writer-shell markdown-writer-shell">
        <div className="writer-publish-bar markdown-writer-publish-bar">
          <WriterTitleField
            title={props.title}
            label={props.labels.title}
            onTitleChange={changeTitle}
          />
          {props.toolbarAfterTitle}
        </div>
        <WriterEditorFrame
          hostRef={hostRef}
          label={props.labels.editor}
          enterFullscreenLabel={props.labels.enterFullscreen}
          exitFullscreenLabel={props.labels.exitFullscreen}
          ready={editorReady}
          loading={editorReady ? null : props.loading}
        />
        {latex.editor ? (
          <LatexBlockEditorPanel
            editor={latex.editor}
            editorHandleRef={latex.editorHandleRef}
            ariaLabel={props.labels.mathBlockEditor}
            doneLabel={props.labels.done}
            onChange={latex.changeValue}
            onSubmit={latex.submitAndContinue}
          />
        ) : null}
        {props.afterEditor}
      </main>
    );
  },
);
