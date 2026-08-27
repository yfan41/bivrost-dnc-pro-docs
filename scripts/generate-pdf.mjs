#!/usr/bin/env node
/**
 * Render the whole manual to one PDF.
 *
 * Serves the already-built dist/ with `astro preview` (which honours `base`, so
 * DOCS_BASE flows straight through), drives headless Chromium over /print/, and
 * writes the PDF into dist/ so it rsyncs with the site and survives the deploy's
 * --delete.
 *
 * Deliberately NOT wired into `astro build`: a developer who has never run
 * `pnpm exec playwright install chromium` must still be able to build the site.
 *
 *   pnpm build && pnpm pdf
 *   DOCS_BASE=/dnc-pro pnpm build && DOCS_BASE=/dnc-pro pnpm pdf
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { PDFDocument } from 'pdf-lib';
import { pdfFileName } from '../src/pdf-name.mjs';

const root = new URL('..', import.meta.url);
const version = readFileSync(new URL('VERSION', root), 'utf8').trim();
const base = (process.env.DOCS_BASE || '/').replace(/\/+$/, '');
const port = Number(process.env.PDF_PORT || 4321);
const origin = `http://127.0.0.1:${port}`;

if (!existsSync(new URL('dist/index.html', root))) {
  throw new Error('dist/ is missing or empty — run `pnpm build` first.');
}

/** @type {import('playwright').BrowserType} */
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (cause) {
  throw new Error('playwright is not installed — run `pnpm install`.', { cause });
}

// --- serve dist/ --------------------------------------------------------------
// Not file://: images and cross-links are root-absolute /img/console/... paths
// (rebased to /dnc-pro/img/... under a base), which would resolve to file:///img/
// and 404.
// Refuse to capture from a server this script did not start. `astro preview` falls
// forward to the next free port when the requested one is taken, so a stray server
// here would answer the readiness poll below and the PDF would be rendered from
// whatever THAT is serving.
const portTaken = await fetch(origin, { signal: AbortSignal.timeout(1000) }).then(
  () => true,
  () => false
);
if (portTaken) {
  throw new Error(`something is already listening on ${origin} — stop it, or set PDF_PORT`);
}

const previewArgs = ['exec', 'astro', 'preview'];
const cwd = new URL('.', root);
// `detached` puts the wrapper and the astro process it starts in their own group, so
// one signal reaches both (see stopPreview).
const preview = spawn('pnpm', [...previewArgs, '--port', String(port), '--host', '127.0.0.1'], {
  cwd,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: process.env,
  detached: true,
});
/*
 * Astro changed how `preview` runs mid-7.x, and the two versions need opposite
 * cleanups:
 *  - up to 7.1 the server stays a child of this process. Signalling the process
 *    group is what stops it, and `astro preview stop` does not exist there — it
 *    parses as plain `astro preview` and starts ANOTHER server, which then blocks
 *    this script forever.
 *  - from 7.2 the server daemonises (detaches, reparents to init, leaves its process
 *    group), so the signal cannot reach it and only `stop` gets rid of it. That case
 *    is recognisable: the wrapper we spawned has already exited.
 * A leaked server is not merely untidy — the next run's readiness poll would be
 * answered by it and the PDF captured from a stale dist/.
 */
let stopped = false;
const stopPreview = () => {
  if (stopped) return;
  stopped = true;
  if (preview.exitCode === null && preview.signalCode === null) {
    try {
      process.kill(-preview.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    return;
  }
  // `stop` is scoped to this project, so it cannot stop a preview server for a
  // sibling docs site. The timeout is a backstop against the 7.1 behaviour above.
  spawnSync('pnpm', [...previewArgs, 'stop'], {
    cwd,
    stdio: 'ignore',
    env: process.env,
    timeout: 30_000,
  });
};
process.on('exit', stopPreview);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopPreview();
    process.exit(1);
  });
}

let ready = false;
for (let i = 0; i < 120 && !ready; i++) {
  try {
    ready = (await fetch(`${origin}${base}/`)).ok;
  } catch {
    /* not up yet */
  }
  if (!ready) await sleep(500);
}
if (!ready) throw new Error(`astro preview never answered at ${origin}${base}/`);

// --- capture ------------------------------------------------------------------
let browser;
try {
  browser = await chromium.launch();
} catch (cause) {
  console.error(
    '\nCould not launch Chromium. Install it once with:\n  pnpm exec playwright install chromium\n'
  );
  throw cause;
}

try {
  const page = await browser.newPage({ colorScheme: 'light' });
  /** @type {string[]} */
  const failures = [];
  page.on('requestfailed', (r) => failures.push(`${r.failure()?.errorText} ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) failures.push(`HTTP ${r.status()} ${r.url()}`);
  });

  await page.goto(`${origin}${base}/print/`, { waitUntil: 'load', timeout: 180_000 });

  // The id/link rewrite has run.
  await page.waitForFunction(() => window.__printManual?.ready === true, null, { timeout: 60_000 });

  // Fonts loaded and every screenshot decoded. `networkidle` is not enough:
  // a fetched-but-undecoded image still prints blank.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? img.decode().catch(() => {})
          : new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            })
      )
    );
  });

  const stats = await page.evaluate(() => window.__printManual);
  if (stats.sections !== stats.expected) {
    throw new Error(`rendered ${stats.sections} sections, expected ${stats.expected}`);
  }
  console.log(`${stats.sections} sections · ${stats.ids} ids prefixed · ${stats.rewritten} links rewritten`);
  if (stats.unresolved.length) {
    console.warn(`${stats.unresolved.length} links are not resolvable inside the PDF:`);
    for (const u of stats.unresolved.slice(0, 20)) console.warn(`    ${u.from}: ${u.href}`);
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    throw new Error(`${failures.length} failed requests while rendering`);
  }

  const out = new URL(`dist/${pdfFileName(version)}`, root);
  // The running head and folio render in a separate Chromium document that resolves
  // fonts against the SYSTEM only — no page CSS, no webfonts. CJK here therefore
  // depends on a system CJK family being installed, which is what the deploy
  // workflow's fc-list assertion guarantees on the runner.
  const chrome =
    "font-family:'Songti SC','Noto Serif CJK SC',SimSun,serif; font-size:8pt; width:100%; padding:0 18mm; color:#444;";
  const layout = {
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    timeout: 300_000,
  };

  const body = await page.pdf({
    ...layout,
    displayHeaderFooter: true,
    headerTemplate: `<div style="${chrome} display:flex; justify-content:space-between; border-bottom:0.5px solid #bbb; padding-bottom:2mm;"><span>DNC Pro 数控程序管理系统 使用说明书</span><span>V${version}</span></div>`,
    footerTemplate: `<div style="${chrome}"></div>`,
    // A real bookmark tree for a 25-chapter manual; `outline` requires `tagged`.
    tagged: true,
    outline: true,
  });

  /*
   * A cover does not carry a running head or a folio, and Chromium's
   * header/footer templates cannot test the page number — they render on every
   * sheet or none. So render the cover a second time with the chrome off (same
   * page geometry, so nothing reflows) and swap it in for page 1.
   *
   * Swapping one page rather than re-assembling the document is what keeps the
   * 250-entry bookmark tree: every other page object is untouched, so the
   * outline's destinations still resolve.
   */
  // Strip everything after the cover before the second capture. `pageRanges: '1'`
  // would re-paginate the whole document — minutes of work on a screenshot-heavy
  // manual — for one sheet that is already laid out.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.print-toc, .print-section')) el.remove();
    // Nothing follows the cover now, so its page break would only risk a blank sheet.
    document.querySelector('.print-cover').style.breakAfter = 'auto';
  });
  const cover = await page.pdf({ ...layout, displayHeaderFooter: false });
  const doc = await PDFDocument.load(body);
  const [coverPage] = await doc.copyPages(await PDFDocument.load(cover), [0]);
  doc.removePage(0);
  doc.insertPage(0, coverPage);
  writeFileSync(out, await doc.save());

  const { size } = statSync(out);
  // Sanity floor, not a target: a blank or half-rendered capture lands well under
  // this, while the real document is dominated by the 40 console screenshots.
  if (size < 1_000_000) {
    throw new Error(`${out.pathname} is only ${size} bytes — something rendered blank`);
  }
  console.log(`wrote dist/${pdfFileName(version)} (${(size / 1e6).toFixed(1)} MB)`);
  await page.close();
} finally {
  await browser.close();
  stopPreview();
}
