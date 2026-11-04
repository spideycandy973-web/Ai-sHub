/**
 * Ai'sHub build script.
 *
 * - parses src/index.html for <!-- @include path --> markers and inlines CSS/JS
 *   into a single self-contained index.html (works from file://, https and
 *   Capacitor's localhost origin, no CORS or module-resolution issues)
 * - generates the offline service worker with a content-hash cache name
 * - copies everything into docs/ (GitHub Pages) and dist/ (Capacitor webDir)
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src');
const BUILD_ID = (process.env.BUILD_ID || new Date().toISOString().slice(0, 10));
const VERSION = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
// deterministic cache name (content rev) so repeat builds are byte-identical

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

const escapeHtmlAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function inlineHtml() {
  let html = await readFile(path.join(SRC, 'index.html'), 'utf8');
  const includeRe = /^([ \t]*)<!--\s*@include\s+([^\s>]+)\s*-->[ \t]*$/gm;
  const parts = [];
  let last = 0;
  let m;
  while ((m = includeRe.exec(html))) {
    const [full, indent, rel] = m;
    const file = path.join(SRC, rel);
    if (!existsSync(file)) throw new Error(`@include target missing: ${rel}`);
    parts.push(html.slice(last, m.index));
    let body = await readFile(file, 'utf8');
    body = body.replace(/\n+$/, '');
    if (rel.endsWith('.js')) {
      body = body.replace(/<\/script>/gi, '<\\/script>');
      parts.push(`${indent}<script>\n${body}\n${indent}</script>`);
    } else if (rel.endsWith('.css')) {
      parts.push(`${indent}<style>\n${body}\n${indent}</style>`);
    } else {
      throw new Error(`unsupported include type: ${rel}`);
    }
    last = m.index + full.length;
  }
  parts.push(html.slice(last));
  html = parts.join('');

  html = html
    .replaceAll('__APP_VERSION__', VERSION)
    .replaceAll('__BUILD_ID__', BUILD_ID)
    .replaceAll('__BUILD_DATE__', new Date().toISOString().slice(0, 10));
  return html;
}

async function fingerprint(html) {
  const hash = createHash('sha256');
  hash.update(html);
  for (const f of (await walk(SRC)).filter((f) => /\.(js|css|html)$/.test(f)).sort()) {
    hash.update(f);
    hash.update(await readFile(path.join(SRC, f)));
  }
  for (const f of (await walk(path.join(root, 'assets')).catch(() => []))) {
    hash.update(f);
  }
  return hash.digest('hex').slice(0, 12);
}

const ASSETS = [
  ['manifest.webmanifest', 'image/x-icon'],
  ['logo.png', 'image/png'],
  ['icon-192.png', 'image/png'],
  ['icon-512.png', 'image/png'],
  ['icon-maskable-512.png', 'image/png'],
  ['favicon.png', 'image/png'],
  ['apple-touch-icon.png', 'image/png'],
];

async function main() {
  const html = await inlineHtml();
  const rev = await fingerprint(html);
  const CACHE = `aishub-${VERSION}-${rev}`;

  const outputs = [path.join(root, 'docs'), path.join(root, 'dist')];
  for (const out of outputs) {
    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, 'index.html'), html.replace('__REV__', rev), 'utf8');
    for (const [name] of ASSETS) {
      const src = path.join(root, 'assets', name);
      if (!existsSync(src)) {
        if (name === 'manifest.webmanifest') continue;
        console.warn(`[build] warning: missing asset ${name} (run "npm run icons")`);
        continue;
      }
      await copyFile(src, path.join(out, name));
    }
    // service worker: precache shell + assets, network-first for APIs (never cached)
    const sw = (await readFile(path.join(SRC, 'sw.js'), 'utf8'))
      .replaceAll('__CACHE__', CACHE)
      .replaceAll('__REV__', rev)
      .replaceAll('__SHELL__', JSON.stringify(['./', './index.html', ...ASSETS.map(([n]) => './' + n)]));
    await writeFile(path.join(out, 'sw.js'), sw, 'utf8');
    await writeFile(path.join(out, 'offline.json'), JSON.stringify({ rev, version: VERSION, build: BUILD_ID }, null, 2));
    await writeFile(path.join(out, '.nojekyll'), '');
  }

  const size = (await stat(path.join(root, 'docs', 'index.html'))).size;
  console.log(`[build] Ai'sHub v${VERSION} rev ${rev} -> docs/ + dist/ (index.html ${(size / 1024).toFixed(0)} kB, cache aishub-${VERSION}-${rev})`);
}

main().catch((err) => {
  console.error('[build] failed:', err.message);
  process.exit(1);
});
