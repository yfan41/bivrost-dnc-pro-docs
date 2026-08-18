# DNC Pro 使用手册

Starlight (Astro) site, published at `https://docs.bivrost.cn/dnc-pro/`.

```bash
pnpm install
pnpm dev                       # http://localhost:4321/ (root base, no /dnc-pro prefix)
DOCS_BASE=/dnc-pro pnpm build  # what CI publishes
```

`VERSION` at the repo of this folder is the single source of truth for the version
badge in the hero, the sidebar changelog badge, and the footer.

Screenshots under `public/img/console/` and `public/img/shopfloor/` are generated —
do not hand-edit them. They come from the reproducible demo dataset in
`../tools/demo-seed/`; see that folder's README to rebuild the data and re-shoot.

Body prose links and images use **root-absolute** paths (`/guide/vault/`,
`/img/console/dashboard.png`); a hast plugin in `astro.config.mjs` rebases them under
`DOCS_BASE` at build time. The front page's hero actions and quick-link cards are the
exception and must stay **relative**, because the links validator reads them from the
source before that plugin runs.
