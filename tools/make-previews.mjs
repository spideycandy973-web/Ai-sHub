#!/usr/bin/env node
/**
 * Renders the phone mockup previews used in the README (pure SVG -> PNG, no browser).
 * Text is real app copy so the previews stay honest about the UI.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'previews');
mkdirSync(outDir, { recursive: true });

const W = 390, H = 844, PAD = 22;
const C = {
  bg: '#07070B', surface: '#12121F', surface2: '#191927', surface3: '#212133',
  line: '#262638', text: '#F2F3F8', text2: '#A9ADC0', text3: '#6D7188',
  brand: '#7C5CFF', cyan: '#22D3EE', pink: '#FF7AB6', ok: '#34D399', warn: '#FBBF24',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const font = (size, weight = 400, color = C.text) =>
  `font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}"`;

const defs = `
<defs>
  <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6D5BFF"/><stop offset=".45" stop-color="#A855F7"/><stop offset="1" stop-color="#22D3EE"/>
  </linearGradient>
  <linearGradient id="userBubble" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4F46E5"/><stop offset=".6" stop-color="#7C3AED"/><stop offset="1" stop-color="#9333EA"/>
  </linearGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7C5CFF" stop-opacity=".18"/><stop offset="1" stop-color="#7C5CFF" stop-opacity="0"/>
  </linearGradient>
</defs>`;

const statusBar = (title = "Ai'sHub") => `
  <text x="${PAD}" y="52" ${font(13, 700)}>9:41</text>
  <text x="${W - PAD}" y="52" text-anchor="end" ${font(12, 600, C.text2)}>5G &#9679; 82%</text>
  <g transform="translate(${PAD} 66)">
    <rect width="34" height="34" rx="11" fill="url(#brand)"/>
    <path d="M11 11.5 L22 22.5 M10.5 22 L21 11" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
    <text x="46" y="15" ${font(15, 700)}>Ai'sHub</text>
    <text x="46" y="30" ${font(11, 500, C.text3)}>${esc(title)}</text>
    <circle cx="${W - PAD * 2 - 44}" cy="17" r="15" fill="${C.surface}"/>
    <path d="M${W - PAD * 2 - 50} 12 h12 M${W - PAD * 2 - 50} 17 h12 M${W - PAD * 2 - 50} 22 h7" stroke="${C.text2}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="${W - PAD * 2 - 8}" cy="17" r="15" fill="${C.surface}"/>
    <path d="M${W - PAD * 2 - 13} 17 h10 M${W - PAD * 2 - 8} 12 v10" stroke="${C.text}" stroke-width="1.9" stroke-linecap="round"/>
  </g>`;

const tabbar = (active = 'Chat') => {
  const items = [['Chat', 'M21 12a8 8 0 1 1-3.2-6.4'], ['Agent', 'circle'], ['Models', 'box'], ['Prompts', 'lines'], ['Settings', 'gear']];
  const x0 = PAD + 6, w = (W - PAD * 2 - 12) / 5;
  return `
  <g transform="translate(${x0} ${H - 74})">
    <rect x="-6" y="-6" width="${W - PAD * 2 + 12}" height="62" rx="20" fill="${C.surface}" stroke="${C.line}"/>
    ${items
      .map(([label], i) => {
        const cx = w * i + w / 2;
        const on = label === active;
        return `<g opacity="${on ? 1 : 0.55}">
          ${label === 'Chat' ? `<path d="M${cx - 9} ${26} a8 8 0 1 1 3 6.2 l-4.6 1.2 1.2-4.4" fill="none" stroke="${on ? C.cyan : C.text3}" stroke-width="1.8" stroke-linecap="round"/>` : ''}
          ${label === 'Agent' ? `<circle cx="${cx}" cy="25" r="7" fill="none" stroke="${C.text3}" stroke-width="1.8"/><path d="M${cx} 12v3M${cx} 35v3" stroke="${C.text3}" stroke-width="1.8"/>` : ''}
          ${label === 'Models' ? `<path d="M${cx} 16 l8 4.5 v9 L${cx} 34 l-8 -4.5 v-9 Z" fill="none" stroke="${C.text3}" stroke-width="1.8"/>` : ''}
          ${label === 'Prompts' ? `<path d="M${cx - 8} 18h16M${cx - 8} 25h10M${cx - 8} 32h7" stroke="${C.text3}" stroke-width="1.8" stroke-linecap="round"/>` : ''}
          ${label === 'Settings' ? `<circle cx="${cx}" cy="25" r="3" fill="none" stroke="${C.text3}" stroke-width="1.8"/><circle cx="${cx}" cy="25" r="7.5" fill="none" stroke="${C.text3}" stroke-width="1.6" stroke-dasharray="2.4 2.6"/>` : ''}
          <text x="${cx}" y="48" text-anchor="middle" ${font(9.5, 600, on ? C.text : C.text3)}>${label}</text>
        </g>`;
      })
      .join('')}
  </g>`;
};

const composer = (value = '', hint = 'Ai\'sHub · Local engine · free', agent = false) => `
  <g transform="translate(0 ${H - 168})">
    <rect x="${W / 2 - 46}" y="0" width="92" height="26" rx="9" fill="${C.surface}" stroke="${C.line}"/>
    <text x="${W / 2 - 24}" y="17" ${font(10.5, 650, C.text)}>Chat</text>
    <text x="${W / 2 + 18}" y="17" ${font(10.5, 650, agent ? C.cyan : C.text3)}>Agent</text>
    <rect x="${PAD}" y="34" width="${W - PAD * 2}" height="${value ? 62 : 50}" rx="22" fill="${C.surface}" stroke="${C.line}"/>
    <circle cx="${PAD + 24}" cy="${34 + (value ? 31 : 25)}" r="13" fill="${C.surface3}"/>
    <path d="M${PAD + 24} ${34 + (value ? 25 : 19)} v${value ? 12 : 12} M${PAD + 18} ${34 + (value ? 31 : 25)} h12" stroke="${C.text2}" stroke-width="1.8" stroke-linecap="round"/>
    ${value
      ? `<text x="${PAD + 48}" y="${34 + 26}" ${font(13.5, 500)}>${esc(value.slice(0, 30))}</text>
         <text x="${PAD + 48}" y="${34 + 44}" ${font(13.5, 500)}>${esc(value.slice(30, 60))}</text>`
      : `<text x="${PAD + 48}" y="${34 + 30}" ${font(13.5, 400, C.text3)}>Ask anything…</text>`}
    <rect x="${W - PAD - 52}" y="${34 + (value ? 17 : 11)}" width="38" height="38" rx="13" fill="url(#brand)"/>
    <path d="M${W - PAD - 40} ${34 + (value ? 36 : 30)} h16 m-6 -6 6 6 -6 6" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${W / 2}" y="${34 + (value ? 76 : 64)}" text-anchor="middle" ${font(9.5, 500, C.text3)}>${esc(hint)}</text>
  </g>`;

const userMsg = (text, y) => `
  <g transform="translate(0 ${y})">
    <rect x="${W - PAD - Math.min(300, 17 + text.length * 7.6)}" y="0" width="${Math.min(300, 17 + text.length * 7.6)}" height="38" rx="19" fill="url(#userBubble)"/>
    <text x="${W - PAD - 14}" y="24" text-anchor="end" ${font(13, 500, '#fff')}>${esc(text)}</text>
  </g>`;

const aiMsg = (lines, y, model = 'Ai\'sHub Core · on-device') => {
  let cy = 0;
  const parts = [];
  parts.push(`<rect x="0" y="0" width="25" height="25" rx="8" fill="url(#brand)"/>`);
  parts.push(`<path d="M7 8.5 L18 19.5 M6.5 19 L17 8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`);
  parts.push(`<text x="33" y="12" ${font(12, 700)}>Ai'sHub</text>`);
  parts.push(`<text x="86" y="12" ${font(10.5, 500, C.text3)}>${esc(model)}</text>`);
  cy = 40;
  for (const line of lines) {
    if (line.h) { parts.push(`<text x="0" y="${cy}" ${font(14.5, 700)}>${esc(line.h)}</text>`); cy += 26; }
    else if (line.p) { parts.push(`<text x="0" y="${cy}" ${font(13, 400, C.text)}>${esc(line.p)}</text>`); cy += 21; }
    else if (line.card) {
      parts.push(`<rect x="0" y="${cy - 14}" width="${W - PAD * 2}" height="${line.cardH || 58}" rx="12" fill="${C.surface}" stroke="${C.line}"/>`);
      line.card.forEach((l, i) => parts.push(`<text x="14" y="${cy + 4 + i * 17}" ${font(11.5, 500, i === 0 ? C.text2 : C.text3)} >${esc(l)}</text>`));
      cy += (line.cardH || 58) + 12;
    } else if (line.bullet) {
      parts.push(`<circle cx="4" cy="${cy - 5}" r="2.2" fill="${C.text3}"/>`);
      parts.push(`<text x="14" y="${cy}" ${font(12.5, 400, C.text2)}>${esc(line.bullet)}</text>`);
      cy += 20;
    }
  }
  return `<g transform="translate(${PAD} ${y})">${parts.join('')}</g>`;
};

function shell(title, body, active) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${defs}
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    <circle cx="${W - 40}" cy="60" r="220" fill="url(#fade)"/>
    ${statusBar(title)}
    ${body}
    ${tabbar(active)}
  </svg>`;
}

/* ── screen 1: home ── */
const home = shell('Ready · offline-capable', `
  <g transform="translate(${PAD} 140)">
    <rect width="52" height="52" rx="17" fill="url(#brand)"/>
    <path d="M15 17 L37 39 M14 38 L36 16" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <text x="66" y="24" ${font(25, 800)}>Hi, I'm Ai'sHub</text>
    <text x="66" y="45" ${font(12.5, 400, C.text3)}>Your own AI — free, unlimited, offline.</text>
  </g>
  ${(() => {
    let x = PAD;
    return [['On-device engine', C.ok], ['118 models', C.ok], ['Ready', C.ok]]
      .map(([t, col]) => {
        const w = 26 + t.length * 6.3;
        const node = `<g transform="translate(${x} 212)">
          <rect width="${w}" height="27" rx="13.5" fill="${C.surface}" stroke="${C.line}"/>
          <circle cx="13" cy="13.5" r="3" fill="${col}"/>
          <text x="22" y="17.5" ${font(10.5, 600, C.text2)}>${t}</text>
        </g>`;
        x += w + 8;
        return node;
      })
      .join('');
  })()}
  <text x="${PAD}" y="272" ${font(10, 700, C.text3)} letter-spacing="1.2">START WITH</text>
  ${[
    ['Draft a message', 'An email that gets replied', 'M4 6h16M4 12h10M4 18h7'],
    ['Fix my code', 'Explain an error, patch it', 'M8 8l-4 4 4 4M16 8l4 4-4 4'],
    ['Explain something', 'Science, maths, ideas', 'M5 4h11l3 3v13H5z'],
    ['Do the numbers', 'Exact maths, offline', 'M5 3h14v18H5z M8 7h8'],
    ['Run an agent', 'One goal, many steps', 'M6 6h6a4 4 0 010 8H9a4 4 0 000 8h6'],
    ['Translate', 'Into Bengali or more', 'M4 6h9M8 4v2c0 4-2 6-4 7'],
  ]
    .map(([t, s, d], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = PAD + col * ((W - PAD * 2) / 2 + 5);
      const y = 288 + row * 78;
      const w = (W - PAD * 2) / 2 - 5;
      return `<g transform="translate(${x} ${y})">
        <rect width="${w}" height="70" rx="16" fill="${C.surface}" stroke="${C.line}"/>
        <rect x="12" y="11" width="26" height="26" rx="9" fill="#7C5CFF22"/>
        <path d="${d}" transform="translate(17 16) scale(.62)" stroke="#B8A6FF" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <text x="12" y="52" ${font(11.5, 650)}>${t}</text>
        <text x="12" y="64" ${font(9.5, 400, C.text3)}>${s}</text>
      </g>`;
    })
    .join('')}
  ${composer()}
`, 'Chat');

/* ── screen 2: chat ── */
const chat = shell('Chat · offline', `
  ${userMsg('what is 15% of 240', 140)}
  ${aiMsg([
    { h: 'Result' },
    { card: ['15/100 × 240 = 36'], cardH: 44 },
    { p: 'Answer: 36' },
    { bullet: 'Even · not prime' },
    { p: 'Answered on-device — no network used.' },
  ], 196)}
  ${['Copy', 'Retry', 'Edit'].map((t, i) => `<text x="${PAD + i * 62}" y="392" ${font(10.5, 600, C.text3)}>${t}</text>`).join('')}
  ${userMsg('convert 250 km to miles', 424)}
  ${aiMsg([
    { h: 'Conversion' },
    { card: ['km → mi: 155.3428'], cardH: 44 },
    { p: 'Result is 155.34 miles.', },
  ], 480)}
  ${composer('', "Ai'sHub · Local engine · free")}
`, 'Chat');

/* ── screen 3: agent ── */
const agent = shell('Agent · 5 steps', `
  <g transform="translate(${PAD} 140)">
    <rect width="${W - PAD * 2}" height="112" rx="16" fill="${C.surface}" stroke="${C.line}"/>
    <text x="14" y="24" ${font(12.5, 700)}>Agent run</text>
    <text x="${W - PAD * 4}" y="24" text-anchor="end" ${font(10, 700, C.ok)}>DONE</text>
    <line x1="14" y1="34" x2="${W - PAD * 2 - 14}" y2="34" stroke="${C.line}"/>
    ${[
      ['calculator', '18% of 45000 = 8,100'],
      ['convert', '250 km = 155.34 mi'],
      ['checklist', '5 steps · 3 days'],
      ['save_note', 'saved to notes'],
    ]
      .map(([s, o], i) => `<g transform="translate(14 ${50 + i * 17})">
        <circle cx="3" cy="-4" r="3" fill="${C.ok}"/>
        <text ${font(10.5, 650, C.text2)}>${s}</text>
        <text x="92" ${font(10, 400, C.text3)}>${o}</text>
      </g>`)
      .join('')}
  </g>
  <g transform="translate(${PAD} 272)">
    <text ${font(10, 700, C.text3)} letter-spacing="1.2">SKILLS</text>
    ${['Calculator', 'Convert', 'Notes', 'Memory', 'Checklist', 'Dates', 'Text', 'Random']
      .map((t, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const w = [86, 78, 70][col];
        const x = [0, 94, 180][col];
        return `<g transform="translate(${x} ${10 + row * 34})">
          <rect width="${w}" height="27" rx="13.5" fill="${C.surface2}" stroke="${C.line}"/>
          <text x="13" y="18" ${font(10.5, 600, C.text2)}>${t}</text>
        </g>`;
      })
      .join('')}
  </g>
  <g transform="translate(${PAD} 404)">
    <rect width="${W - PAD * 2}" height="120" rx="16" fill="${C.surface}" stroke="${C.line}"/>
    <text x="14" y="24" ${font(12.5, 700)}>New agent task</text>
    <rect x="14" y="36" width="${W - PAD * 2 - 28}" height="46" rx="11" fill="${C.bg}" stroke="${C.line}"/>
    <text x="24" y="56" ${font(10.5, 400, C.text3)}>Plan a 3-day Dhaka trip under</text>
    <text x="24" y="70" ${font(10.5, 400, C.text3)}>15000 taka and save a note</text>
    <rect x="${W - PAD * 4 - 56}" y="90" width="66" height="22" rx="8" fill="url(#brand)"/>
    <text x="${W - PAD * 4 - 23}" y="105" text-anchor="middle" ${font(10.5, 700, '#fff')}>Run</text>
  </g>
  ${composer('', 'Agent mode · asks before saving · max 7 steps', true)}
`, 'Agent');

/* ── screen 4: models ── */
const models = shell('118 models · 23 providers', `
  <g transform="translate(${PAD} 140)">
    <text ${font(10, 700, C.text3)} letter-spacing="1.2">ON-DEVICE · WORKS OFFLINE</text>
    ${['Ai\'s Hub Core', 'Ai\'s Hub Code', 'Ai\'s Hub Agent']
      .map((n, i) => `<g transform="translate(0 ${12 + i * 46})">
        <rect width="${W - PAD * 2}" height="40" rx="13" fill="${i === 0 ? '#7C5CFF22' : C.surface}" stroke="${i === 0 ? '#7C5CFF88' : C.line}"/>
        <rect x="9" y="7" width="26" height="26" rx="9" fill="#0E7490"/>
        <text x="22" y="24" text-anchor="middle" ${font(9, 800, '#04121A')}>AH</text>
        <text x="45" y="18" ${font(11.5, 650)}>${esc(n)}</text>
        <text x="45" y="31" ${font(9.5, 400, C.text3)}>offline · free · 128k ctx</text>
        ${i === 0 ? `<path d="M${W - PAD * 2 - 26} 15 l4 4 7 -8" stroke="${C.cyan}" stroke-width="2" fill="none" stroke-linecap="round"/>` : ''}
      </g>`)
      .join('')}
    <text y="166" ${font(10, 700, C.text3)} letter-spacing="1.2">FREE · NO KEY NEEDED</text>
    ${['OpenAI Fast (Pollen)', 'Gemini (Pollen)', 'DeepSeek (Pollen)']
      .map((n, i) => `<g transform="translate(0 ${178 + i * 46})">
        <rect width="${W - PAD * 2}" height="40" rx="13" fill="${C.surface}" stroke="${C.line}"/>
        <rect x="9" y="7" width="26" height="26" rx="9" fill="#F9A8D422"/>
        <text x="22" y="24" text-anchor="middle" ${font(9, 800, C.pink)}>PO</text>
        <text x="45" y="18" ${font(11.5, 650)}>${esc(n)}</text>
        <text x="45" y="31" ${font(9.5, 400, C.text3)}>Pollinations · free</text>
      </g>`)
      .join('')}
    <text y="332" ${font(10, 700, C.text3)} letter-spacing="1.2">CONNECTED PROVIDERS</text>
    ${['Gemini 2.5 Pro', 'Llama 3.3 70B', 'DeepSeek V3.1']
      .map((n, i) => `<g transform="translate(0 ${344 + i * 46})">
        <rect width="${W - PAD * 2}" height="40" rx="13" fill="${C.surface}" stroke="${C.line}"/>
        <rect x="9" y="7" width="26" height="26" rx="9" fill="#60A5FA22"/>
        <text x="22" y="24" text-anchor="middle" ${font(9, 800, '#60A5FA')}>${['GE', 'OR', 'OR'][i]}</text>
        <text x="45" y="18" ${font(11.5, 650)}>${esc(n)}</text>
        <text x="45" y="31" ${font(9.5, 400, C.text3)}>${['Google', 'OpenRouter', 'OpenRouter'][i]} · free tier</text>
      </g>`)
      .join('')}
  </g>
  ${composer('', '118 models · auto-synced from providers')}
`, 'Models');

/* ── screen 5: settings ── */
const settings = shell('Settings', `
  <g transform="translate(${PAD} 140)">
    ${[
      ['API keys', '2 providers connected · keyless ready', 'Manage'],
      ['Current model', 'Ai\'s Hub Core (on-device)', 'Change'],
      ['Ask before changing data', 'Notes & reminders wait for a tap', ''],
      ['Remember facts about me', '3 saved · local only', ''],
    ]
      .map(([t, s, b], i) => `<g transform="translate(0 ${i * 62})">
        <text ${font(12.5, 650)}>${esc(t)}</text>
        <text y="16" ${font(10, 400, C.text3)}>${esc(s)}</text>
        ${b
          ? `<rect x="${W - PAD * 2 - 62}" y="-12" width="62" height="24" rx="9" fill="${C.surface2}" stroke="${C.line}"/>
             <text x="${W - PAD * 2 - 31}" y="4" text-anchor="middle" ${font(9.5, 650, C.text2)}>${b}</text>`
          : `<rect x="${W - PAD * 2 - 46}" y="-8" width="46" height="24" rx="12" fill="${i === 2 ? C.brand : C.surface3}"/>
             <circle cx="${W - PAD * 2 - (i === 2 ? 14 : 35)}" cy="4" r="8.5" fill="#fff"/>`}
        <line x1="0" y1="34" x2="${W - PAD * 2}" y2="34" stroke="${C.line}" stroke-opacity=".6"/>
      </g>`)
      .join('')}
    <g transform="translate(0 250)">
      <text ${font(12.5, 650)}>Temperature</text>
      <text x="${W - PAD * 2}" y="0" text-anchor="end" ${font(11, 500, C.cyan)}>0.7</text>
      <rect y="12" width="${W - PAD * 2}" height="4" rx="2" fill="${C.surface3}"/>
      <rect y="12" width="${(W - PAD * 2) * 0.47}" height="4" rx="2" fill="url(#brand)"/>
      <circle cx="${(W - PAD * 2) * 0.47}" cy="14" r="9" fill="#fff" stroke="${C.brand}" stroke-width="3"/>
    </g>
    <g transform="translate(0 300)">
      <text ${font(12.5, 650)}>Theme</text>
      <rect y="10" width="${W - PAD * 2}" height="34" rx="12" fill="${C.surface}" stroke="${C.line}"/>
      <rect x="4" y="14" width="${(W - PAD * 2 - 8) / 3}" height="26" rx="9" fill="${C.surface3}"/>
      <text x="${(W - PAD * 2) / 6}" y="31" text-anchor="middle" ${font(10.5, 650)}>Dark</text>
      <text x="${(W - PAD * 2) / 2}" y="31" text-anchor="middle" ${font(10.5, 600, C.text3)}>Light</text>
      <text x="${(W - PAD * 2) * 5 / 6}" y="31" text-anchor="middle" ${font(10.5, 600, C.text3)}>System</text>
    </g>
    <g transform="translate(0 356)">
      <rect width="${W - PAD * 2}" height="96" rx="16" fill="${C.surface}" stroke="${C.line}"/>
      <text x="${(W - PAD * 2) / 2}" y="26" text-anchor="middle" ${font(13, 800)}>Ai'sHub</text>
      <text x="${(W - PAD * 2) / 2}" y="44" text-anchor="middle" ${font(9.5, 400, C.text3)}>Your free AI agent — 100+ models</text>
      <text x="${(W - PAD * 2) / 2}" y="60" text-anchor="middle" ${font(9, 500, C.text3)} >v1.0.0 · pkg com.aishub</text>
      <text x="${(W - PAD * 2) / 2}" y="80" text-anchor="middle" ${font(9, 500, C.ok)}>no accounts · no tracking · no subscription</text>
    </g>
  </g>
  ${composer('', 'Keys never leave this device')}
`, 'Settings');

const screens = { home, chat, agent, models, settings };
for (const [name, svg] of Object.entries(screens)) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 390 * 2 } }).render().asPng();
  writeFileSync(path.join(outDir, `${name}.png`), png);
  console.log('[previews]', name + '.png');
}
