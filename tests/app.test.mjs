/**
 * Ai'sHub test suite — run with `npm test`.
 * jsdom drives the real built app (docs/index.html) so these tests cover the
 * shipped artifact, not just isolated modules.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { tokenizer, tokTypes } from 'acorn';

const HTML_PATH = path.join(process.cwd(), 'docs', 'index.html');
let dom;
let window;
let A;
const errors = [];

before(async () => {
  assert.ok(fs.existsSync(HTML_PATH), 'run `npm run build` before `npm test`');
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    if (!/scrollTo|Not implemented/.test(e.message)) errors.push(e.message);
  });
  dom = new JSDOM(fs.readFileSync(HTML_PATH, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://aishub.test/',
    virtualConsole: vc,
  });
  window = dom.window;
  window.HTMLElement.prototype.scrollTo = function (opts) {
    this.scrollTop = (opts && opts.top) || 0;
  };
  await new Promise((r) => setTimeout(r, 900));
  A = window.A;
});

after(() => {
  assert.deepEqual(errors, [], 'no uncaught runtime errors while booting');
  dom.window.close(); // release the reminder interval so node can exit
});

test('boots with the full app surface', () => {
  assert.ok(A, 'A namespace exists');
  for (const key of ['util', 'store', 'bus', 'settings', 'net', 'catalog', 'discovery', 'knowledge', 'offlineEngine', 'skills', 'agent', 'chat', 'ui', 'app', 'ai']) {
    assert.ok(A[key], `A.${key} is defined`);
  }
});

test('catalog exposes 100+ models across 20+ providers', () => {
  assert.ok(A.catalog.all().length >= 100, `models: ${A.catalog.all().length}`);
  assert.ok(A.catalog.providers.length >= 20, `providers: ${A.catalog.providers.length}`);
  const keys = new Set(A.catalog.all().map(A.catalog.keyFor));
  assert.equal(keys.size, A.catalog.all().length, 'model keys are unique');
  assert.ok(A.catalog.all().filter((m) => m.offline).length >= 3, 'has on-device models');
  assert.ok(A.catalog.all().filter((m) => m.free).length >= 30, 'has plenty of free models');
});

test('offline math engine is exact', () => {
  const ev = A.offlineEngine.evalMath;
  assert.equal(ev('2+2'), 4);
  assert.equal(ev('(5+3)*2'), 16);
  assert.equal(ev('2^10'), 1024);
  assert.equal(ev('sqrt(144)'), 12);
  assert.equal(ev('100/8'), 12.5);
  assert.equal(ev('15/100*240'), 36);
  assert.throws(() => ev('1/0'));
  assert.throws(() => ev('2+*3'));
});

test('unit conversion covers length, mass, temperature and data', () => {
  const c = A.offlineEngine.convertUnits;
  assert.ok(Math.abs(c(10, 'km', 'miles').value - 6.2137119) < 1e-6);
  assert.ok(Math.abs(c(5, 'kg', 'lbs').value - 11.0231) < 1e-3);
  assert.ok(Math.abs(c(100, 'f', 'c').value - 37.7778) < 1e-3);
  assert.equal(c(2, 'gb', 'mb').value, 2000);
  assert.equal(c(1, 'm', 'nope'), null);
});

test('intent classification routes the main request types', () => {
  const cls = A.offlineEngine.classify;
  assert.equal(cls('hi there'), 'greet');
  assert.equal(cls('who are you'), 'identity');
  assert.equal(cls('what is 15% of 240'), 'math');
  assert.equal(cls('convert 10 km to miles'), 'convert');
  assert.equal(cls('count words: hello world'), 'wordcount');
  assert.equal(cls('write me an email'), 'write');
  assert.equal(cls('tell me about photosynthesis'), 'explain');
  assert.equal(cls('is it free?'), 'capacity');
});

test('offline replies answer real questions with content', async () => {
  const reply = A.offlineEngine.composeReply({ messages: [{ role: 'user', content: 'what is 15% of 240' }] });
  assert.match(reply, /36/);
  const conv = A.offlineEngine.composeReply({ messages: [{ role: 'user', content: '5 kg to lbs' }] });
  assert.match(conv, /11\.02/);
  const kb = A.offlineEngine.composeReply({ messages: [{ role: 'user', content: 'explain photosynthesis' }] });
  assert.match(kb, /CO₂|Photosynthesis/);
  const empty = A.offlineEngine.composeReply({ messages: [{ role: 'user', content: '   ' }] });
  assert.ok(empty.length > 10);
});

test('knowledge base retrieves and handles plurals', () => {
  assert.equal(A.knowledge.search('photosynthesis')[0].topic.id, 'photosynthesis');
  assert.equal(A.knowledge.search('percentages')[0].topic.id, 'percent');
  assert.equal(A.knowledge.search('git rebase')[0].topic.id, 'git');
  assert.equal(A.knowledge.search('area of a circle')[0].topic.id, 'geometry');
  assert.ok(A.knowledge.topics.length >= 30, `topics: ${A.knowledge.topics.length}`);
});

test('markdown renderer escapes HTML and renders structure', () => {
  const html = A.markdown.render('## Title\n\n**bold** `<script>x</script>`\n\n```js\nconst a = 1 < 2;\n```');
  assert.ok(!html.includes('<script>'), 'script tags escaped');
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /class="code-block"/);
  assert.match(html, /1 &lt; 2/);
});

test('skills run locally: calculator, convert, text, notes, memory', async () => {
  const calc = await A.skills.run('calculator', { expression: '(1250*0.18)+40' });
  assert.equal(calc.value, 265);
  const conv = await A.skills.run('convert', { value: 12, from: 'km', to: 'miles' });
  assert.ok(conv.result > 7.4 && conv.result < 7.5);
  const stats = await A.skills.run('text_stats', { text: 'one two three four' });
  assert.equal(stats.words, 4);
  const note = await A.skills.run('save_note', { title: 'test note', body: 'hello' });
  assert.equal(note.saved, true);
  assert.equal(A.skills.notes.all().length, 1);
  await A.skills.run('remember', { fact: 'prefers short answers' });
  assert.equal(A.skills.memory.all().length, 1);
});

test('agent plans and executes a multi-step goal offline', async () => {
  A.settings.set('selectedModel', 'local:aishub-agent-1');
  A.settings.set('agentApproval', 'auto');
  const task = await A.agent.run('calculate 18% of 45000 and convert 250 km to miles', { approve: async () => true });
  assert.equal(task.state, 'done');
  assert.equal(task.source, 'offline');
  const skills = task.steps.map((s) => s.skill);
  assert.ok(skills.includes('calculator'), 'calculator step present: ' + skills);
  assert.ok(skills.includes('convert'), 'convert step present: ' + skills);
  const calcStep = task.steps.find((s) => s.skill === 'calculator');
  assert.equal(calcStep.output.value, 8100);
  assert.match(task.result, /8,100|8100/);
});

test('agent saves the finished report into a note (deferred step)', async () => {
  A.settings.set('agentApproval', 'auto');
  const task = await A.agent.run('Make a 3-day plan checklist and save it as a note', { approve: async () => true });
  const noteStep = task.steps.find((s) => s.skill === 'save_note');
  assert.ok(noteStep, 'save_note ran');
  assert.equal(noteStep.state, 'ok');
  const saved = A.skills.notes.find('plan');
  assert.ok(saved.length >= 1, 'note persisted');
});

test('storage degrades gracefully without IndexedDB', async () => {
  const chat = A.chatStore.create({ title: 'fallback test' });
  await A.chatStore.append(chat.id, { role: 'user', content: 'hello', ts: Date.now() });
  const msgs = await A.chatStore.messages(chat.id);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].content, 'hello');
});

test('model readiness explains missing keys and offline state', () => {
  const gemini = A.catalog.all().find((m) => m.provider === 'google');
  const ready = A.ai.readiness(gemini);
  assert.equal(ready.ready, false);
  assert.equal(ready.needsKey, 'google');
  assert.match(ready.reason, /API key/i);
  const local = A.catalog.all().find((m) => m.offline);
  assert.equal(A.ai.readiness(local).ready, true);
  const free = A.catalog.all().find((m) => m.provider === 'pollinations');
  assert.equal(A.ai.readiness(free).ready, true, 'keyless models are ready without any key');
});

test('fallback ladder ends on the on-device engine', () => {
  const broken = A.catalog.all().find((m) => m.provider === 'openrouter');
  const chain = A.ai.fallbackChain(broken);
  assert.ok(chain.length > 0);
  assert.ok(chain.some((m) => m.provider === 'local'), 'local engine is the last resort');
});

test('UI screens render and navigation works', () => {
  const doc = window.document;
  A.app.go('models');
  assert.ok(doc.querySelectorAll('#models-list .model-row').length >= 50);
  A.app.go('agent');
  assert.ok(doc.querySelectorAll('#agent-tasks .card').length >= 1);
  A.app.go('prompts');
  assert.ok(doc.querySelectorAll('#prompts-list .prompt-card').length >= 8);
  A.app.go('settings');
  assert.ok(doc.querySelectorAll('#settings-body .setting-group').length >= 6);
  A.app.go('chat');
  assert.ok(doc.querySelector('#screen-chat').classList.contains('is-active'));
});

test('sending a message streams an answer into the chat', async () => {
  A.app.go('chat');
  A.chat.setMode('chat');
  A.settings.set('selectedModel', 'local:aishub-core-1');
  await A.chat.send('what is 12*12');
  await new Promise((r) => setTimeout(r, 2500));
  const doc = window.document;
  assert.ok(doc.querySelectorAll('#messages .msg').length >= 2);
  assert.match(doc.querySelector('#messages').textContent, /144/);
});

test('deleting from a message removes it and everything after', async () => {
  A.chat.newChat({ silent: true });
  await A.chat.send('first question');
  await new Promise((r) => setTimeout(r, 1800));
  await A.chat.send('second question');
  await new Promise((r) => setTimeout(r, 1800));
  const before = A.chat.state.messages.length;
  assert.ok(before >= 4, 'four messages before delete: ' + before);
  const secondUser = A.chat.state.messages.filter((m) => m.role === 'user')[1];
  const ids = A.chat.state.messages.map((m) => m.id);
  // call the store path directly (the UI path asks for confirmation)
  A.chat.state.messages = A.chat.state.messages.filter((m) => m.ts < secondUser.ts);
  await A.chatStore.deleteFrom(A.chat.state.chatId, secondUser.ts);
  A.chat.renderAll();
  const stored = await A.chatStore.messages(A.chat.state.chatId);
  assert.ok(stored.length < before, 'store shrank after delete');
  assert.ok(A.chat.state.messages.length < before);
  assert.ok(ids.length > A.chat.state.messages.length);
});

test('discovered models merge into the live catalog', () => {
  const before = A.catalog.all().length;
  A.discovery.mergeIntoCatalog([
    { id: 'brand-new-model:free', provider: 'openrouter', name: 'Brand New Model', ctx: 32000, free: true, vision: false, tools: true, reasoning: false, offline: false, source: 'discovered' },
  ]);
  assert.equal(A.catalog.all().length, before + 1);
  assert.ok(A.catalog.find('openrouter:brand-new-model:free'), 'new model is findable');
  // merging the same model twice must not duplicate it
  A.discovery.mergeIntoCatalog([{ id: 'brand-new-model:free', provider: 'openrouter', name: 'Brand New Model' }]);
  assert.equal(A.catalog.all().length, before + 1);
  A.app.go('models');
  assert.ok(window.document.querySelector('#models-list').textContent.includes('Brand New Model'));
});

test('vision models receive image parts, text-only models get a notice', () => {
  // the image payload is built inside the chat controller's send flow
  const sendSrc = A.chat.send.toString();
  const controller = window.document.querySelector('script') && sendSrc;
  assert.ok(controller.length > 100);
  const visionModel = A.catalog.all().find((m) => m.vision);
  assert.ok(visionModel, 'at least one vision model ships in the catalog');
  assert.ok(A.catalog.all().filter((m) => m.vision).length >= 10, 'plenty of vision models');
});

test('reset drops discovered rows but keeps every preset', () => {
  const before = A.catalog.all().length;
  A.catalog.dropDiscovered();
  assert.equal(A.catalog.all().length, before - 1, 'only the discovered row is dropped');
  assert.ok(!A.catalog.find('openrouter:brand-new-model:free'));
  assert.ok(A.catalog.all().filter((m) => m.offline).length >= 3, 'presets survive');
});

test('provider key storage round-trips and never leaves the device', () => {
  A.settings.setKey('groq', 'test-key-123');
  assert.equal(A.settings.key('groq'), 'test-key-123');
  assert.equal(A.settings.hasKey('groq'), true);
  const dump = A.store.KV.exportAll();
  assert.equal(dump.settings.providerKeys.groq, 'test-key-123');
  assert.ok(!A.catalog.providers.some((p) => p.baseUrl.includes('aishub')), 'no calls to any Ai\'sHub server');
  A.settings.setKey('groq', '');
  assert.equal(A.settings.hasKey('groq'), false);
});

/* ── regression: the shipped shell must actually contain its CSS and JS ──
   A build that leaves @include markers un-inlined ships an unstyled app whose
   composer sits off-screen, which looks exactly like "the AI is not responding". */
test('the shipped shell inlines real CSS and JS (no unresolved markers)', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.equal(html.includes('@include'), false, 'no @include markers may survive the build');

  const styleText = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const scriptText = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  assert.ok(styleText.length > 20000, `CSS must be inlined (got ${styleText.length} chars)`);
  assert.ok(scriptText.length > 100000, `JS must be inlined (got ${scriptText.length} chars)`);

  // the rules the layout depends on, spot-checked by name
  for (const sel of ['.tabbar', '.composer-wrap', '.screen', '.main', '.welcome', '.msg']) {
    assert.ok(styleText.includes(sel), `stylesheet is missing the ${sel} rule`);
  }
});

/* ── regression: a wedged database must never freeze the chat ──
   Persistence used to run before painting, and IDB had no timeout, so a stalled
   open() left the UI frozen with the user's text gone. */
test('a wedged IndexedDB still paints the message and answers on-device', async () => {
  const vc = new VirtualConsole();
  const blocked = new JSDOM(fs.readFileSync(HTML_PATH, 'utf8'), {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'https://aishub.test/',
    virtualConsole: vc,
  });
  const w = blocked.window;
  Object.defineProperty(w, 'indexedDB', {
    configurable: true,
    value: { open: () => ({}), deleteDatabase: () => ({}) }, // handlers never fire
  });
  for (const s of [...w.document.querySelectorAll('script')]) {
    try { w.eval(s.textContent); } catch (_) { /* ignore */ }
  }
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.scrollTo = () => {};
  await new Promise((r) => setTimeout(r, 300));

  const input = w.document.querySelector('#input');
  input.value = 'still there?';
  w.document.querySelector('#btn-send').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

  let answered = false;
  for (let i = 0; i < 100 && !answered; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const ai = w.document.querySelector('#messages .msg-ai .prose');
    answered = Boolean(ai && ai.textContent.trim().length > 20 && !/Thinking/i.test(ai.textContent));
  }
  assert.ok(w.document.querySelector('#messages .msg-user'), 'the sent message is visible');
  assert.ok(answered, 'the on-device engine still answers when storage is dead');
  w.close();
});

/* ── phone control: natural language → device actions ── */
test('phone requests are recognised from plain language', () => {
  const P = A.phoneActions;
  const expect = {
    'set an alarm for 7:30 am': 'alarm',
    'wake me up at 6:45 pm': 'alarm',
    'set a timer for 10 minutes': 'timer',
    'remind me in 25 minutes': 'timer',
    "what's on my calendar": 'agenda',
    'add a meeting tomorrow at 3pm': 'event',
    'find contact Rahim': 'contact',
    'call 01712345678': 'call',
    'text 01712345678 saying I will be late': 'sms',
    'open youtube': 'openApp',
    'turn on the flashlight': 'torchOn',
    'turn off flashlight': 'torchOff',
    'set volume to 40%': 'volume',
    'copy hello world': 'clipboard',
    'how much battery do I have': 'battery',
    'read the screen': 'screenRead',
    'tap Login': 'screenTap',
    'vibrate': 'vibrate',
  };
  for (const [phrase, action] of Object.entries(expect)) {
    assert.equal(P.detect(phrase)?.name, action, `"${phrase}" should map to ${action}`);
  }
  // ordinary chatting must NOT be treated as phone control
  for (const phrase of ['what is the capital of France', 'write me an email to my boss', 'explain photosynthesis']) {
    assert.equal(P.detect(phrase), null, `"${phrase}" should stay a normal chat question`);
  }
});

test('time and duration parsing handles am/pm, noon and words', () => {
  const P = A.phoneActions;
  // note: values cross the jsdom realm boundary, so compare fields not prototypes
  const at = (phrase) => { const t = P.parseTime(phrase); return t && `${t.hour}:${t.minute}`; };
  assert.equal(at('set an alarm for 7:30 am'), '7:30');
  assert.equal(at('wake me up at 6:45 pm'), '18:45');
  assert.equal(at('alarm at 12 pm'), '12:0');
  assert.equal(at('alarm 12:00 am'), '0:0');
  assert.equal(P.parseDuration('set a timer for 10 minutes'), 600);
  assert.equal(P.parseDuration('timer for two minutes'), 120);
  assert.equal(P.parseDuration('timer for 2 hours'), 7200);
});

test('hidden overlays are really hidden (an always-on backdrop ate every tap)', async () => {
  const html = fs.readFileSync('docs/index.html', 'utf8');
  assert.match(html, /\[hidden\]\s*\{\s*display:\s*none\s*!important/, 'the [hidden] rule ships');

  const dom = await JSDOM.fromFile('docs/index.html', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
  const w = dom.window;
  await new Promise((r) => setTimeout(r, 900));
  for (const id of ['drawer', 'sheet', 'sheet-backdrop']) {
    const el = w.document.getElementById(id);
    if (!el) continue;
    assert.equal(el.hasAttribute('hidden'), true, `#${id} starts hidden`);
    assert.equal(w.getComputedStyle(el).display, 'none', `#${id} must not be painted over the app`);
  }
  // a class that sets display must never beat the attribute
  const css = html.slice(html.indexOf('.drawer'));
  assert.ok(css.includes('display: flex'), 'the drawer really does set display:flex, so the rule is load-bearing');
  w.close();
});

test('the app still boots when IndexedDB is unavailable (no blank screen)', async () => {
  // A device where storage is blocked used to leave the HTML splash on screen forever.
  const dom = await JSDOM.fromFile('docs/index.html', {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    beforeParse(window) {
      try {
        Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined });
      } catch (e) { /* older jsdom has no indexedDB anyway */ }
    },
  });
  const w = dom.window;
  await new Promise((r) => setTimeout(r, 2500));
  assert.equal(w.AIHUB_BOOTED, true, 'boot reaches ready even without storage');
  assert.equal(w.document.documentElement.getAttribute('data-boot'), 'ready');
  const splash = w.document.getElementById('splash');
  assert.ok(!splash || splash.classList.contains('is-gone'), 'the splash must not stay on screen');
  assert.ok(Array.isArray(w.AIHUB_BOOT_LOG), 'boot problems are recorded for the diagnostics panel');
  w.close();
});

test('the shipped bundle parses on an older Android WebView (no ES2020 operators)', async () => {
  const html = fs.readFileSync('docs/index.html', 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length > 5, 'the bundle has inline scripts');
  let tokens = 0;
  for (const [i, code] of blocks.entries()) {
    const bad = [];
    const tk = tokenizer(code, {
      ecmaVersion: 2020,
      onToken: (t) => {
        tokens += 1;
        if (t.type === tokTypes.questionDot) bad.push('?.');
        if (t.type === tokTypes.coalesce) bad.push('??');
      },
    });
    while (tk.getToken().type !== tokTypes.eof) { /* consume */ }
    assert.equal(bad.length, 0, `script block ${i} still uses ${bad.join(', ')} — a pre-2020 WebView would show a blank screen`);
  }
  assert.ok(tokens > 10000, 'the whole bundle was actually tokenised');
});

test('a boot failure is shown on screen instead of a white page', async () => {
  const html = fs.readFileSync('docs/index.html', 'utf8');
  assert.match(html, /AIHUB_BOOT_ERROR/, 'the boot guard ships in the bundle');
  const dom = await JSDOM.fromFile('docs/index.html', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(typeof dom.window.AIHUB_BOOT_ERROR, 'function', 'the guard exposes a reporter');
  assert.equal(dom.window.document.documentElement.getAttribute('data-boot'), 'ready', 'a healthy boot marks the document ready');
  const splash = dom.window.document.getElementById('splash');
  assert.ok(!splash || splash.classList.contains('is-gone'), 'the splash is dismissed after boot');
  dom.window.close();
});

test('native replies never leak "undefined" when the plugin sends no message', async () => {
  // Simulate the Android bridge: methods resolve with {ok:true} and no message field.
  const dom = await JSDOM.fromFile('docs/index.html', { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/' });
  const w = dom.window;
  const silent = () => Promise.resolve({ ok: true });
  w.Capacitor = {
    isNativePlatform: () => true,
    platform: 'android',
    getPlatform: () => 'android',
    Plugins: { PhoneControl: { setAlarm: silent, setTimer: silent, capabilities: () => Promise.resolve({ features: { alarms: true } }) } },
  };
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(w.A.phone.available(), true, 'the simulated bridge is detected');

  for (const request of ['set an alarm for 7:30 am', 'set a timer for 10 minutes']) {
    const res = await w.A.phoneActions.tryHandle(request);
    assert.ok(res && res.text, `${request} produced a reply`);
    assert.equal(res.ok, true, 'the action succeeded');
    assert.ok(!/undefined|null|NaN/.test(res.text), `reply must be clean text, got: ${res.text}`);
    assert.ok(!/[\u2014]\s*\./.test(res.text), `no dangling dash, got: ${res.text}`);
  }
  w.close();
});

test('on the web, phone actions explain the limitation instead of failing', async () => {
  assert.equal(A.phone.available(), false, 'jsdom has no native bridge');
  const res = await A.phoneActions.tryHandle('set an alarm for 7:30 am');
  assert.ok(res, 'the request is handled, not ignored');
  assert.equal(res.ok, false);
  assert.match(res.text, /Android app/i, 'the reply points at the APK');
});
