#!/usr/bin/env node
/** Renders the Ai'sHub logo (generated SVG) to all PNG icon sizes with ImageMagick. */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets');
mkdirSync(out, { recursive: true });

const galaxy = (cx = 256, cy = 256, s = 1) => `
  <g transform="translate(${cx} ${cy}) scale(${s})">
    <circle r="150" fill="url(#core)" opacity="0.95"/>
    <circle r="150" fill="none" stroke="url(#ring)" stroke-width="3" opacity="0.75"/>
    <ellipse rx="150" ry="46" fill="none" stroke="url(#ring)" stroke-width="10" opacity="0.55" transform="rotate(-24)"/>
    <ellipse rx="150" ry="46" fill="none" stroke="url(#ring)" stroke-width="3" opacity="0.9" transform="rotate(38)"/>
    <path d="M -40 -34 L 4 24" stroke="#FFFFFF" stroke-width="23" stroke-linecap="round"/>
    <path d="M -36 28 L 6 -30" stroke="#FFFFFF" stroke-width="23" stroke-linecap="round" opacity="0.92"/>
    <path d="M 44 -44 q 6 26 32 32 q -26 6 -32 32 q -6 -26 -32 -32 q 26 -6 32 -32 z" fill="#8DEBFF" opacity="0.95"/>
    <circle cx="-104" cy="-92" r="9" fill="#8DEBFF"/>
    <circle cx="112" cy="86" r="6" fill="#FFD76E"/>
    <circle cx="-96" cy="96" r="5" fill="#FFFFFF" opacity="0.85"/>
    <circle cx="118" cy="-84" r="4" fill="#FFFFFF" opacity="0.7"/>
  </g>`;

const defs = `
  <defs>
    <radialGradient id="bg" cx="30%" cy="18%" r="105%">
      <stop offset="0" stop-color="#1B1B38"/>
      <stop offset="0.45" stop-color="#0D0D1C"/>
      <stop offset="1" stop-color="#05050A"/>
    </radialGradient>
    <radialGradient id="core" cx="38%" cy="32%" r="72%">
      <stop offset="0" stop-color="#5B6BFF" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="#7B3BFF" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#12122A" stop-opacity="0.85"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22D3EE"/>
      <stop offset="0.5" stop-color="#A78BFA"/>
      <stop offset="1" stop-color="#FF7AB6"/>
    </linearGradient>
    <linearGradient id="splashBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0A0A16"/>
      <stop offset="1" stop-color="#05050A"/>
    </linearGradient>
  </defs>`;

function svg({ size = 512, round = 0, maskable = false, glyphScale = 1 } = {}) {
  const inset = maskable ? 0 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    ${defs}
    <rect x="${inset}" y="${inset}" width="${512 - inset * 2}" height="${512 - inset * 2}" rx="${round}" fill="url(#bg)"/>
    ${galaxy(256, 256, maskable ? 0.74 : 1 * glyphScale)}
  </svg>`;
}

const splashSvg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${defs}
  <rect width="${w}" height="${h}" fill="url(#splashBg)"/>
  ${galaxy(w / 2, h / 2 - 24, Math.min(w, h) / 900)}
  <text x="${w / 2}" y="${h / 2 + Math.min(w, h) * 0.17}" font-family="sans-serif" font-size="${Math.min(w, h) * 0.075}"
    font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">Ai'sHub</text>
</svg>`;

function render(svgText, name, width, height = width) {
  const resvg = new Resvg(svgText, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' });
  writeFileSync(path.join(out, name), resvg.render().asPng());
  console.log('[icons]', name, `${width}x${height}`);
  return path.join(out, name);
}

render(svg({ size: 512 }), 'icon-512.png', 512);
render(svg({ size: 192 }), 'icon-192.png', 192);
render(svg({ size: 512, maskable: true }), 'icon-maskable-512.png', 512);
render(svg({ size: 180 }), 'apple-touch-icon.png', 180);
render(svg({ size: 64 }), 'favicon.png', 64);
// high-res logo used inside the app (chat avatar / about page)
render(svg({ size: 256 }), 'logo.png', 256);

// splash screens + launcher icons used by the Capacitor android project
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');
const splashTargets = [
  ['drawable', 480, 800],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
];
for (const [dir, w, h] of splashTargets) {
  if (!existsSync(androidRes)) break;
  try {
    mkdirSync(path.join(androidRes, dir), { recursive: true });
    const resvg = new Resvg(splashSvg(w, h), { fitTo: { mode: 'width', value: w } });
    writeFileSync(path.join(androidRes, dir, 'splash.png'), resvg.render().asPng());
  } catch (err) {
    console.warn('[icons] skip splash', dir, err.message.split('\n')[0]);
  }
}
for (const [dir, size] of [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
]) {
  if (!existsSync(androidRes)) break;
  try {
    mkdirSync(path.join(androidRes, dir), { recursive: true });
    const write = (svgText, filename, w) => {
      const resvg = new Resvg(svgText, { fitTo: { mode: 'width', value: w } });
      writeFileSync(path.join(androidRes, dir, filename), resvg.render().asPng());
    };
    write(svg({ size }), 'ic_launcher.png', size);
    write(svg({ size, round: size / 2 }), 'ic_launcher_round.png', size);
    const fgSize = Math.round(size * 1.4);
    write(`<svg xmlns="http://www.w3.org/2000/svg" width="${fgSize}" height="${fgSize}" viewBox="0 0 512 512">${defs}${galaxy(256, 256, 0.6)}</svg>`, 'ic_launcher_foreground.png', fgSize);
  } catch (err) {
    console.warn('[icons] skip mipmap', dir, err.message.split('\n')[0]);
  }
}
// store feature graphic + previews
generateStoreScreens();
console.log('[icons] done');

/** Simple branded store/README banner (no live UI screenshot needed). */
function generateStoreScreens() {
  try {
    const store = path.join(root, 'assets', 'store');
    mkdirSync(store, { recursive: true });
    const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
      ${defs}
      <rect width="1024" height="500" fill="url(#splashBg)"/>
      <circle cx="120" cy="120" r="260" fill="#5B6BFF" opacity="0.16"/>
      <circle cx="900" cy="430" r="300" fill="#FF7AB6" opacity="0.12"/>
      ${galaxy(190, 250, 0.42)}
      <text x="360" y="240" font-family="sans-serif" font-size="86" font-weight="800" fill="#FFFFFF">Ai'sHub</text>
      <text x="362" y="298" font-family="sans-serif" font-size="27" fill="#A8B0C8">Your free AI agent · 100+ models · works offline</text>
      <text x="362" y="344" font-family="sans-serif" font-size="21" fill="#22D3EE">chat · agent mode · skills · local engine</text>
    </svg>`;
    writeFileSync(path.join(store, 'feature-graphic.png'), new Resvg(banner, { fitTo: { mode: 'width', value: 1024 } }).render().asPng());
    console.log('[icons] store/feature-graphic.png');
  } catch (err) {
    console.warn('[icons] store graphics skipped:', err.message.split('\n')[0]);
  }
}
