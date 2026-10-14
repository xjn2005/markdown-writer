# Markdown fidelity, formula safety, and long-document design

## Goal

Make the writer preserve valid Markdown, honor the host's formula trust policy, and avoid whole-document formula work after every DOM mutation.

## Scope

- Preserve HTML break tags outside fenced code blocks.
- Keep secondary H1 headings unchanged while retaining the existing external-title and first-H1 synchronization.
- Thread `mathTrust` into the custom LaTeX preview synchronization path. It remains `false` by default.
- Batch DOM mutation work and synchronize only affected code blocks. A full synchronization remains available for initial setup.
- Add focused regression tests for each behavior and for mutation batching.

## Non-goals

- Changing the title field API or removing first-H1 synchronization.
- Adding file persistence, source mode, or new editing features.
- Changing KaTeX's rendering behavior beyond honoring the existing trust setting.

## Design

### Markdown preservation

`markdownWithoutDefaultTemplate` will only remove Milkdown's empty default template. It will no longer sanitize user Markdown. `markdownWithTitle` will remove or replace only the first leading H1 that represents the external title; later H1 headings remain untouched.

### Formula trust

`CreateWritingInteractionsOptions` gains a `mathTrust` boolean. `MarkdownWriter` supplies it from the editor options, defaulting to `false`. The same value is passed to `syncLatexCodeBlockElement`, so Crepe's LaTeX feature and the custom placeholder preview use one policy.

### Long-document synchronization

The mutation observer will collect affected `.milkdown-code-block` elements, coalesce notifications into one animation frame, and synchronize that set. Initial attachment continues to synchronize all existing code blocks. The observer is cancelled during destruction.

## Tests

- Markdown title tests demonstrate that `<br>` and later H1 headings survive a title round trip.
- Interaction tests exercise trust forwarding and verify multiple mutations schedule one flush for only changed blocks.
- Existing full test and production build commands remain the acceptance checks.

## Error handling and compatibility

The changes only stop automatic destructive normalization. Hosts that need a single-H1 publication rule can validate at save or publish time. Existing `mathTrust: true` hosts retain trusted rendering; omitted configuration becomes consistently untrusted.
