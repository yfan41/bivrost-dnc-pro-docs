# DNC Pro 使用手册

Starlight (Astro) site, published at `https://docs.bivrost.cn/dnc-pro/`.

```bash
pnpm install
pnpm dev                       # http://localhost:4321/ (root base, no /dnc-pro prefix)
DOCS_BASE=/dnc-pro pnpm build  # what CI publishes
```

`VERSION` at the root of this folder is the single source of truth for the version
badge in the hero, the sidebar changelog badge, the footer, the PDF's filename and
the deploy subdir.

## 导出 PDF

整本说明书可导出为一份 PDF，供离线阅读与打印。站点右上角的 **下载 PDF** 按钮即指向该文件。

```bash
pnpm exec playwright install chromium   # 仅首次：下载与 playwright 版本匹配的 Chromium
pnpm build && pnpm pdf                  # 生成 dist/bivrost-dnc-pro-manual-v<版本>.pdf
```

- PDF 由 `/print/` 路由渲染。该页面把侧边栏顺序中的全部 25 章合并为一篇长文档，前面加封面与
  目录；用浏览器打开并 Ctrl-P 预览，是调整 `src/styles/print-manual.css` 最快的方式
- 章节顺序的唯一来源是 `src/sidebar.mjs`，侧边栏与 PDF 共用，二者不会脱节。章节标题取自各页
  frontmatter 的 `title`（而非侧边栏的「4 章导言」一类导航简称）
- 合并后各页锚点会重名，页面上的内联脚本会给每章的 `id` 加上 `<章节>--` 前缀，并把站内链接改写
  为文档内锚点，因此 PDF 里的交叉引用可直接跳转
- 版式按说明书惯例设置：正文宋体、标题黑体、表格加框、提示框改为线框、页眉页脚含书名与页码，
  封面不含日期且不带页眉页脚（生成器把封面单独渲染一次再换入第 1 页，以保留 Chromium 生成的
  书签树）
- `pnpm pdf` 不挂在 `pnpm build` 上：没装浏览器也能正常构建站点。`pnpm install` 同样不会下载
  浏览器（见 `pnpm-workspace.yaml` 的 `allowBuilds`）
- CI 在第一次构建后生成一次 PDF，同一份文件同时发布到 `/dnc-pro/` 与 `/dnc-pro/v<版本>/`；
  runner 上需要 `fonts-noto-cjk`，否则中文会渲染成方框
- 不生成 PDF 的构建请设 `PUBLIC_PDF_DOWNLOAD=off`，否则顶栏会给出指向不存在文件的下载链接

Screenshots under `public/img/console/` and `public/img/shopfloor/` are generated —
do not hand-edit them. They come from the reproducible demo dataset in
`../tools/demo-seed/`; see that folder's README to rebuild the data and re-shoot.

## 目录结构要点

- `src/sidebar.mjs` — 章节顺序，侧边栏与 PDF 共用
- `src/components/PrintManual.astro` + `src/pages/print.astro` — 整本合并的打印页
- `src/styles/print-manual.css` — 整本 PDF 的版式、分页、表格与提示框样式
- `src/components/SocialIcons.astro` — 顶栏「下载 PDF」按钮（Starlight 在顶栏与移动端菜单都会
  渲染此组件）
- `scripts/generate-pdf.mjs` — 用 headless Chromium 把打印页导出为 PDF

Body prose links and images use **root-absolute** paths (`/guide/vault/`,
`/img/console/dashboard.png`); a hast plugin in `astro.config.mjs` rebases them under
`DOCS_BASE` at build time. The front page's hero actions and quick-link cards are the
exception and must stay **relative**, because the links validator reads them from the
source before that plugin runs.
