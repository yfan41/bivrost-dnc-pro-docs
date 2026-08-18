// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { satteri } from '@astrojs/markdown-satteri';
import starlightLinksValidator from 'starlight-links-validator';

// Single source of truth for the doc version (also drives the CI base path and the
// deploy subdir). See VERSION next to this file.
const version = readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim();

// The manual is served in place at https://docs.bivrost.cn/dnc-pro/ (latest) and as a
// frozen snapshot at /dnc-pro/v<version>/. Deploy sets DOCS_BASE explicitly for both,
// so nothing in CI depends on the fallback below. Default '/' for local dev, matching
// the gateway-manual repo — `pnpm dev` serves at localhost:<port>/ rather than under
// /dnc-pro/. A hand-run `pnpm build` therefore produces a root-based site: pass
// DOCS_BASE=/dnc-pro if you mean to upload it.
const docsBase = process.env.DOCS_BASE || '/';
// Prefix used to rebase hand-authored root-absolute links (see plugin below):
// '' when serving from root, otherwise the base with any trailing slash removed.
const basePrefix = docsBase === '/' ? '' : docsBase.replace(/\/+$/, '');

// The docs author internal links and images as root-absolute paths
// (e.g. [x](/guide/vault/), ![](/img/console/...)). Astro/Starlight only rebase their
// OWN generated URLs (assets, sidebar, relative links) under a non-root `base`;
// hand-authored absolute paths are left untouched and would 404 once served from a
// subfolder. This hast plugin prefixes them with the base at build time so the site
// works under the subfolder and the links validator stays green. (Same shape as the
// rebase plugin in the gateway-manual repo.)
const rebaseAbsoluteLinks = {
  name: 'rebase-absolute-links',
  element: [
    {
      filter: ['a', 'img'],
      /**
       * @param {any} node hast element node (satteri does not type its hastPlugins)
       * @param {any} ctx satteri visitor context (exposes setProperty)
       */
      visit(node, ctx) {
        if (!basePrefix) return;
        const key = node.tagName === 'img' ? 'src' : 'href';
        const url = node.properties?.[key];
        if (
          typeof url === 'string' &&
          url.startsWith('/') &&
          !url.startsWith('//') && // protocol-relative → external, leave alone
          !url.startsWith(basePrefix + '/') &&
          url !== basePrefix
        ) {
          ctx.setProperty(node, key, basePrefix + url);
        }
      },
    },
  ],
};

export default defineConfig({
  site: 'https://docs.bivrost.cn',
  base: docsBase,
  markdown: {
    // headingAttributes：支持自定义标题锚点语法 ## 标题 {#anchor}
    processor: satteri({
      features: { headingAttributes: true },
      hastPlugins: [rebaseAbsoluteLinks],
    }),
  },
  integrations: [
    starlight({
      title: 'DNC Pro 使用手册',
      description:
        'CNC 加工程序的车间级唯一可信源：受控版本、事务式下发、全天候镜像备份与完整审计',
      favicon: '/img/favicon.ico',
      logo: {
        src: './src/assets/logo.png',
        alt: 'Bivrost',
      },
      defaultLocale: 'root',
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      customCss: ['./src/styles/custom.css'],
      components: {
        Footer: './src/components/Footer.astro',
        Hero: './src/components/Hero.astro',
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
      pagination: true,
      // errorOnRelativeLinks off: the front page (index.md) authors its hero actions and
      // quick-link cards as relative links (`start/install/`), because the validator reads
      // frontmatter and raw-HTML hrefs from the source BEFORE rebaseAbsoluteLinks runs —
      // root-absolute links there would fail validation under DOCS_BASE=/dnc-pro even
      // though the rendered output is correct. Relative links resolve under any base and
      // are still existence-checked. Body prose keeps the root-absolute convention.
      plugins: [starlightLinksValidator({ errorOnRelativeLinks: false })],
      sidebar: [
        { label: '一、DNC Pro 是什么', slug: 'index' },
        { label: '二、它解决什么问题', slug: 'why' },
        { label: '三、系统构成', slug: 'architecture' },
        {
          label: '四、快速上手',
          collapsed: false,
          items: [
            { label: '概述', slug: 'start' },
            { label: '4.1. 安装部署', slug: 'start/install' },
            { label: '4.2. 接入网关与机台', slug: 'start/gateways' },
            { label: '4.3. 第一次下发', slug: 'start/first-transfer' },
          ],
        },
        {
          label: '五、日常使用',
          collapsed: false,
          items: [
            { label: '概述', slug: 'guide' },
            { label: '5.1. 程序库与版本', slug: 'guide/vault' },
            { label: '5.2. 审批与放行', slug: 'guide/approvals' },
            { label: '5.3. 机台分配与落地转换', slug: 'guide/assignments' },
            { label: '5.4. 程序下发', slug: 'guide/transfer' },
            { label: '5.5. 试制（试切）', slug: 'guide/trials' },
            { label: '5.6. 滚动镜像与快照', slug: 'guide/mirror' },
            { label: '5.7. 机边修改的处置', slug: 'guide/drift' },
            { label: '5.8. 机边操作台', slug: 'guide/shopfloor' },
            { label: '5.9. 管理与审计', slug: 'guide/admin' },
          ],
        },
        {
          label: '六、参考',
          collapsed: true,
          items: [
            { label: '概述', slug: 'reference' },
            { label: '6.1. 角色与权限', slug: 'reference/rbac' },
            { label: '6.2. 机床系统差异', slug: 'reference/vendors' },
            { label: '6.3. REST API', slug: 'reference/api' },
            { label: '6.4. 运维手册', slug: 'reference/operations' },
            { label: '6.5. 名词解释', slug: 'reference/glossary' },
          ],
        },
        { label: '七、常见问题', slug: 'faq' },
        {
          label: '版本变更历史记录',
          slug: 'changelog',
          badge: { text: `v${version}`, variant: 'note' },
        },
      ],
    }),
  ],
});
