# Rinspace Markdown Editor

[English](README.md)

Rinspace Markdown Editor 基于 [Milkdown](https://github.com/Milkdown/milkdown) 及其 Crepe 编辑器。编辑器框架和内建编辑功能来自 Milkdown；Rinspace 维护页面外壳、接入代码，以及针对标题、数学、表格和光标行为的九项写作增强。上游项目与许可证见[协议与致谢](#协议与致谢)。

完整写作界面就是 Rinspace `/write/markdown` 实际消费的源码，包括标题、标签、摘要、封面、源码可见性、保存与发布控件，以及 Milkdown 工具栏和编辑区域。Rinspace 仅通过有类型的回调接入账号数据和站内服务。一键生成的页面使用本地或空操作适配器渲染同一个组件，因此贡献者看到的就是 Rinspace 会消费的页面。

## 运行页面

`v0.3.5` GitHub Release 提供一条命令创建本地 React 项目、安装精确版本的包并启动 Vite：

```sh
npm exec --yes --package=https://github.com/rinspacehq/rinspace-editor-markdown/releases/download/v0.3.5/rinspacehq-markdown-writer-0.3.5.tgz -- markdown-writer create my-markdown-writer
```

需要 Node.js 20 或更新版本。命令不会覆盖已有目录，会打印本地地址；按 Ctrl+C 停止。在生成目录运行 `npm run build` 可得到 `dist/` 静态文件，再由你自行托管。上述命令不会把页面发布到公网。

发行前验证候选包可执行：

```sh
npm ci
npm run build
npm pack
node bin/create-demo.mjs create my-markdown-writer --package-spec file:/绝对路径/rinspacehq-markdown-writer-0.3.5.tgz
```

页面保留与 Rinspace 相同的写作控件和 Milkdown 编辑区域，默认打开空白文档；它不要求 Rinspace 账号，也不访问 Rinspace 服务。标签和封面预览只留在本地，图片插入在当前会话使用浏览器对象 URL，摘要、Quiver、保存和发布使用空操作适配器。页面不增加测试专用的 Markdown 源码框或导入导出界面。

`v0.3.5` 会修复被剪贴板空行拆开的严格 GFM 表格，同时保留合法表格、转义竖线、普通正文和代码围栏。它继续保留 `v0.3.4` 的代码粘贴、对象 URL、依赖版本和可信 KaTeX 创作行为。仓库改名后，包名和 `markdown-writer` 命令继续兼容。

## 同源代码与公开接口

`@rinspacehq/markdown-writer/writer` 导出产品写作区域的共同代码：

- `@rinspacehq/markdown-writer/page` 导出完整页面组件 `MarkdownWriterPage`。Rinspace 和一键生成项目都直接渲染它；标题栏、页面控件、编辑器生命周期、标题联动、全屏位置和 Milkdown 边框都由它维护。宿主只提供数据和服务回调，不再重建页面工具栏。
- 同一入口也导出较底层的 `MarkdownWriter`，供明确只需要标题与编辑区域的集成使用；完整页面内部同样使用它。

- `WriterTitleField` 和 `WriterEditorFrame` 渲染标题与编辑器边框。
- `createWriterEditor` 以同一份配置构造 Crepe 和写作插件。图片存储和 Quiver 行为通过适配器注入，但对应工具栏控件仍由共享页面配置维护。
- `syncWriterTitle` 和 Markdown 标题工具双向维护标题字段、编辑器第一行与文首 H1 的关系。
- `applyWriterTopBarLabels` 为工具栏提供可访问名称。
- `@rinspacehq/markdown-writer/writer.css` 包含从 Rinspace 写作页迁出的编辑区域样式。

`/latex-editor` 导出同源 LaTeX 块面板和选区生命周期，`/code-editor` 导出共用的 CodeMirror 控件。包根入口提供九项写作插件和 Markdown 工具，其中 `rinMarkdownTablePastePlugin` 专门处理被剪贴板空行拆开的严格 GFM 表格；`/interactions` 提供光标、粘贴、数学及重新解析逻辑。请使用这些公开入口，不要深层导入内部文件。

Milkdown Crepe 的 LaTeX、CodeMirror、Table、Toolbar、BlockEdit、TopBar 和 LinkTooltip 仍是 Milkdown 的内建功能。Rinspace 的九项插件增加经验证的输入与光标行为；公开页面和 Rinspace 都通过同一个 `createWriterEditor` 注册它们。

## 贡献与发行

运行 `npm ci`、`npm run build`、`npm test`、`npm pack --dry-run`，再用打包后的 tarball 在干净目录验证一键页面。页面改动还须让 Rinspace 的 Markdown 文章和书籍编辑器对同一个 tarball 完成集成检查。公开改动只有经过维护者审查、不可变 GitHub Release 和私仓精确依赖及锁文件完整性更新后，才会进入产品。生产不消费 `main` 或 `latest`。

原 `@rinspacehq/milkdown-writing-preset` 的 `v0.1.x` 发行版保留为历史插件包。`@rinspacehq/markdown-writer` 从 `v0.2.0` 开始维护页面；旧包使用者需要主动更新导入路径。

仓库使用 `rinspace-editor-markdown` 名称，以便与今后的 Rinspace 自研编辑器组成统一项目族。`v0.3.x` 继续使用包名 `@rinspacehq/markdown-writer`，现有导入和集成无需改动。

## 协议与致谢

本仓库中由 Rinspace 编写的页面代码、插件、示例和创建器采用 MIT 协议，见 [LICENSE](LICENSE)。[Milkdown 与 Crepe](https://github.com/Milkdown/milkdown) 由 Milkdown 项目维护，保留其 MIT 协议和归属。CodeMirror、KaTeX 等依赖也分别保留各自许可证。本仓库不声称拥有 Milkdown 或其内建编辑功能。
