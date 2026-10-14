# Rinspace Markdown Editor

[简体中文](README.zh-CN.md)

Rinspace Markdown Editor is built with [Milkdown](https://github.com/Milkdown/milkdown) and its Crepe editor. Milkdown supplies the editor framework and built-in editing features. Rinspace maintains the page shell, the integration code, and nine writing enhancements for headings, math, tables, and cursor behavior. We credit Milkdown and the other upstream projects in [License and attribution](#license-and-attribution).

The complete writing surface is the source used by Rinspace's `/write/markdown` page: title, tags, summary, cover, source visibility, save and publish controls, and the Milkdown editor toolbar and frame. Rinspace supplies account-bound data and services through typed callbacks. The generated page renders the same component with local or no-op adapters, so a contributor sees changes in the page that Rinspace actually consumes.

## Run the page

The `v0.3.5` GitHub Release provides one command to create a local React project, install its exact package version, and start Vite:

```sh
npm exec --yes --package=https://github.com/rinspacehq/rinspace-editor-markdown/releases/download/v0.3.5/rinspacehq-markdown-writer-0.3.5.tgz -- markdown-writer create my-markdown-writer
```

Node.js 20 or newer is required. The command refuses to overwrite an existing directory and prints the local URL. Stop it with Ctrl+C. To make static files, run `npm run build` in the generated directory and host `dist/` yourself. This command does not deploy a website.

To try a reviewed candidate before release:

```sh
npm ci
npm run build
npm pack
node bin/create-demo.mjs create my-markdown-writer --package-spec file:/absolute/path/to/rinspacehq-markdown-writer-0.3.5.tgz
```

The page contains the same writing controls and Milkdown surface as Rinspace. It opens with an empty document and does not ask for a Rinspace account or contact Rinspace services. Tags and cover preview stay local, image insertion uses browser object URLs for the current session, and summary, Quiver, save, and publish use no-op adapters. There is no test-only Markdown source panel or import/export UI.

`v0.3.5` repairs strict GFM tables whose rows were separated by clipboard-introduced blank lines while preserving valid tables, escaped pipes, prose, and fenced code. It retains the code-paste, object-URL, dependency, and trusted KaTeX behavior from `v0.3.4`. The package name and `markdown-writer` command remain compatible after the repository rename.

## Shared source and public API

The package exports the production writing pieces from `@rinspacehq/markdown-writer/writer`:

- `@rinspacehq/markdown-writer/page` exports `MarkdownWriterPage`, the complete page component rendered by Rinspace and the generated project. It owns the page controls, editor lifecycle, title synchronization, fullscreen placement, and Milkdown frame. Hosts provide data and service callbacks; they do not rebuild the page toolbar.
- The same entry also exports `MarkdownWriter`, the lower-level title and editor surface used inside `MarkdownWriterPage` and available for intentionally smaller integrations.

- `WriterTitleField` and `WriterEditorFrame` render the retained page controls.
- `createWriterEditor` creates Crepe with the same feature and plugin configuration. Image storage and Quiver behavior enter through adapters while their toolbar controls remain part of the shared page setup.
- `syncWriterTitle` and the Markdown title helpers keep the title field, first visible editor line, and leading H1 aligned in both directions.
- `applyWriterTopBarLabels` gives the toolbar accessible names.
- `@rinspacehq/markdown-writer/writer.css` contains the writing surface styles extracted from the Rinspace page.

`@rinspacehq/markdown-writer/latex-editor` exports the LaTeX block panel and its selection lifecycle. `@rinspacehq/markdown-writer/code-editor` exports the shared CodeMirror control. The package root exports the nine writing plugins and Markdown helpers, including `rinMarkdownTablePastePlugin` for strict GFM tables separated by clipboard-introduced blank lines; `/interactions` exports the cursor, paste, math, and reparse lifecycle. Use these documented entries rather than internal files.

Milkdown Crepe's LaTeX, CodeMirror, Table, Toolbar, BlockEdit, TopBar, and LinkTooltip features remain Milkdown features. The nine Rinspace plugins add the tested input and cursor behaviors. The public page and Rinspace register them through the same `createWriterEditor` function.

## Contributing and releases

Run `npm ci`, `npm run build`, `npm test`, and `npm pack --dry-run`. Test the packed tarball in a clean generated page. Changes to the page must also pass Rinspace's Markdown article and book editor integration checks against that exact tarball. A public change enters the product only after maintainer review, an immutable GitHub Release, and a private dependency update pinned to the release asset and lockfile integrity. Rinspace does not consume `main` or `latest` in production.

The former `@rinspacehq/milkdown-writing-preset` `v0.1.x` releases remain historical plugin-only packages. `@rinspacehq/markdown-writer` starts the page-owning package line at `v0.2.0`; consumers of the earlier package must update their import paths deliberately.

The repository is named `rinspace-editor-markdown` to group Rinspace's first-party editor projects. The package remains `@rinspacehq/markdown-writer` in the `v0.3.x` line so existing imports and integrations continue to work.

## License and attribution

Rinspace's original page code, plugins, example, and creator in this repository are MIT licensed; see [LICENSE](LICENSE). [Milkdown and Crepe](https://github.com/Milkdown/milkdown) are maintained by the Milkdown project and retain their own MIT license and attribution. CodeMirror, KaTeX, and other dependencies retain their respective licenses. This repository does not claim ownership of Milkdown or its built-in editor features.
