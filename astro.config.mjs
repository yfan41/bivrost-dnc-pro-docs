// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { satteri } from '@astrojs/markdown-satteri';
import starlightLinksValidator from 'starlight-links-validator';
import { getSidebar } from './src/sidebar.mjs';

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
        'DNC Pro 数控程序管理系统使用说明书：接入配置、操作方法、参考资料与故障处置',
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
        // Starlight renders SocialIcons in BOTH the desktop header right-group and
        // the mobile menu drawer (MobileMenuFooter.astro), so this one override puts
        // the PDF download link in every header placement without forking
        // Header.astro. `social` is unconfigured, so the default renders nothing.
        SocialIcons: './src/components/SocialIcons.astro',
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
      // Chapter order lives in src/sidebar.mjs, shared with the printed manual
      // (src/components/PrintManual.astro) so the two cannot drift apart.
      sidebar: getSidebar(version),
    }),
  ],
});
