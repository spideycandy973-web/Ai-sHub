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
import { transformSync } from 'esbuild';
import { tokenizer, tokTypes } from 'acorn';
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
  // Supports BOTH marker styles, because CSS files need a CSS-comment marker:
  //   <!-- @include js/app.js -->      (markup context)
  //   /* @include css/base.css */      (inside a <style> block)
  const includeRe = /^([ \t]*)(?:<!--\s*@include\s+([^\s>]+?)\s*-->|\/\*\s*@include\s+([^\s*>]+?)\s*\*\/)[ \t]*$/gm;
  const parts = [];
  let last = 0;
  let m;
  while ((m = includeRe.exec(html))) {
    const [full, indent, htmlRel, cssRel] = m;
    const rel = htmlRel || cssRel;
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

  // Never ship a shell that still contains build markers: that means CSS/JS was
  // silently dropped, which produces an unstyled, dead-looking app on device.
  const leftover = html.match(/^.*@include.*$/gm);
  if (leftover) {
    throw new Error(`unresolved @include markers left in the output:\n  ${leftover.join('\n  ')}`);
  }
  if (!/<style>[\s\S]{500,}<\/style>/.test(html)) {
    throw new Error('no substantial CSS was inlined — the stylesheet marker syntax is probably wrong');
  }
  if (!/<script>[\s\S]{500,}<\/script>/.test(html)) {
    throw new Error('no substantial JS was inlined — the script marker syntax is probably wrong');
  }

  // Old Android WebViews reject ES2020 syntax (?., ??, ||=) with a SyntaxError that
  // kills the whole bundle and leaves a BLANK WHITE SCREEN — which no node/jsdom test
  // can catch, because node parses it happily. Down-level every inline script to
  // ES2017 so the app runs on WebView 55+ (Android 7 and up).
  let transpiled = 0;
  html = html.replace(/<script>([\s\S]*?)<\/script>/g, (whole, code) => {
    const out = transformSync(code, { target: 'es2015', charset: 'utf8', legalComments: 'none' });
    transpiled += 1;
    return `<script>\n${out.code}\n</script>`;
  });
  if (!transpiled) throw new Error('no inline <script> blocks were found to transpile');

  const jsBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((mm) => mm[1]);

  // Guarantee the shipped scripts are parseable by an older Android WebView. This is the
  // exact failure that produced a blank white screen: ES2020 operators parsed fine in node
  // and jsdom, then threw a SyntaxError on the phone and killed the whole bundle.
  for (const [idx, code] of jsBlocks.entries()) {
    const ops = [];
    try {
      const tk = tokenizer(code, {
        ecmaVersion: 2020,
        onToken: (t) => {
          if (t.type === tokTypes.regexp && /\\p\{/.test(t.value.pattern)) ops.push('\\p{...} regex literal');
          if (t.type === tokTypes.questionDot) ops.push('?.');
          if (t.type === tokTypes.coalesce) ops.push('??');
        },
      });
      while (tk.getToken().type !== tokTypes.eof) { /* walk the whole stream */ }
    } catch (err) {
      throw new Error(`script block ${idx} does not parse (${err.message}) — the app would show a blank screen`);
    }
    if (ops.length) {
      throw new Error(`script block ${idx} still contains ${ops.length} unsupported construct(s) [${ops.join(', ')}] after transpilation — older Android WebViews would show a blank screen`);
    }
  }

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
