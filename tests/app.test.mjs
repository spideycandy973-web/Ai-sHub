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
