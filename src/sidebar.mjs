// @ts-check
/**
 * Single source of truth for the manual's chapter order.
 *
 * Imported by astro.config.mjs (for the Starlight sidebar) and by
 * src/components/PrintManual.astro (for the PDF's section order), so the printed
 * book and the site navigation cannot drift apart.
 *
 * NOTE: no filesystem access in this module. It is bundled into the SSR build for
 * the print route, where `import.meta.url` points into a temp dist chunk and fs
 * paths would break — the same trap src/components/Footer.astro documents. The
 * version is therefore passed in rather than read from VERSION here.
 */

/**
 * @typedef {{ slug: string, depth: number }} PrintChapter
 */

/**
 * @param {string} version doc version, for the changelog badge
 * @returns {import('@astrojs/starlight/types').StarlightUserConfig['sidebar']}
 */
export function getSidebar(version) {
  // Manual convention: an unnumbered safety notice leads the book, the body is
  // numbered 1–7, and the revision record closes it unnumbered. Keeping the body
  // numbering as-is means clause cross-references (见 5.3) stay stable.
  return [
    { label: '安全与注意事项', slug: 'safety' },
    { label: '1 概述', slug: 'index' },
    { label: '2 应用背景与目标问题', slug: 'why' },
    { label: '3 系统构成', slug: 'architecture' },
    {
      label: '4 接入与初始配置',
      collapsed: false,
      items: [
        { label: '4 章导言', slug: 'start' },
        { label: '4.1 接入网关与机台', slug: 'start/gateways' },
        { label: '4.2 首次程序下发', slug: 'start/first-transfer' },
      ],
    },
    {
      label: '5 操作说明',
      collapsed: false,
      items: [
        { label: '5 章导言', slug: 'guide' },
        { label: '5.1 程序库与版本', slug: 'guide/vault' },
        { label: '5.2 审批与放行', slug: 'guide/approvals' },
        { label: '5.3 机台分配与落地转换', slug: 'guide/assignments' },
        { label: '5.4 程序下发', slug: 'guide/transfer' },
        { label: '5.5 试制', slug: 'guide/trials' },
        { label: '5.6 滚动镜像与快照', slug: 'guide/mirror' },
        { label: '5.7 机边修改的处置', slug: 'guide/drift' },
        { label: '5.8 机边操作台', slug: 'guide/shopfloor' },
        { label: '5.9 系统管理与审计', slug: 'guide/admin' },
      ],
    },
    {
      label: '6 参考资料',
      collapsed: true,
      items: [
        { label: '6 章导言', slug: 'reference' },
        { label: '6.1 角色与权限', slug: 'reference/rbac' },
        { label: '6.2 机床系统差异', slug: 'reference/vendors' },
        { label: '6.3 REST API', slug: 'reference/api' },
        { label: '6.4 运行维护', slug: 'reference/operations' },
        { label: '6.5 术语表', slug: 'reference/glossary' },
      ],
    },
    { label: '7 常见问题与故障处置', slug: 'faq' },
    {
      label: '修订记录',
      slug: 'changelog',
      badge: { text: `v${version}`, variant: 'note' },
    },
  ];
}

/**
 * Depth-first reading order, as `{ slug, depth }`.
 *
 * Group nodes contribute ORDER and NESTING ONLY — they are never emitted as
 * chapters of their own. Every group here opens with an overview page whose
 * frontmatter title already equals the group label (group '5 操作说明' is the title
 * of guide/index.md), so emitting the group too would print the heading twice.
 *
 * Sidebar labels are likewise ignored: for the three overview pages the sidebar
 * says '5 章导言' (nav shorthand) while the page title says '5 操作说明' (the
 * chapter's real name). The printed book wants the title.
 *
 * @param {any} items
 * @returns {PrintChapter[]}
 */
export function flattenSidebar(items) {
  /** @type {PrintChapter[]} */
  const out = [];

  /** @param {any[]} nodes @param {number} depth */
  const walk = (nodes, depth) => {
    for (const node of nodes) {
      if (typeof node === 'string') {
        out.push({ slug: node, depth });
        continue;
      }
      if (Array.isArray(node.items)) {
        // A group opens with its own overview page ('4 章导言' → start/index.md),
        // which IS the chapter the group is named after, so it stays at the group's
        // level; only the clauses under it ('4.1', '4.2') indent. The printed table
        // of contents then reads the way the numbering does.
        node.items.forEach((/** @type {any} */ child, /** @type {number} */ i) =>
          walk([child], i === 0 ? depth : depth + 1)
        );
        continue;
      }
      if (typeof node.slug === 'string') out.push({ slug: node.slug, depth });
    }
  };

  walk(items ?? [], 0);
  return out;
}

/**
 * Canonical collection key for an entry id, collapsing index files onto their
 * directory: 'index' → '', 'guide/index' → 'guide'.
 *
 * Astro's loaders have gone both ways on whether a trailing `/index` survives in
 * the id, so normalise both sides rather than depending on one of them.
 *
 * @param {string} id
 */
export function canonicalId(id) {
  return id.replace(/(^|\/)index$/, '$1').replace(/\/+$/, '');
}

/**
 * Sidebar slug → canonical collection key. 'index' is the landing page, whose
 * canonical key is the empty string.
 *
 * @param {string} slug
 */
export function entryKeyFor(slug) {
  return slug === 'index' ? '' : slug;
}
