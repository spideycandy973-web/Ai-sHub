/* ════════════════════════════════════════════════════════════════
   Ai'sHub · skills (the agent's toolbelt)
   Every skill is a plain async function with a JSON-ish schema so both
   the offline planner and cloud models (via tool calling) can use it.
   Local skills work with zero network; network skills declare that.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { KV } = A.store;
  const { escapeHtml, fmtDate } = A.util;

  const notes = {
    all: () => KV.get('notes', []),
    save(note) {
      const list = notes.all();
      const idx = note.id ? list.findIndex((n) => n.id === note.id) : -1;
      if (idx >= 0) list[idx] = { ...list[idx], ...note, updated: Date.now() };
      else list.unshift({ id: A.util.uid('n_'), created: Date.now(), ...note, updated: Date.now() });
      // keep the newest 120 notes, body capped so localStorage never overflows
      const capped = list.slice(0, 120).map((n) => ({ ...n, body: String(n.body || '').slice(0, 8000) }));
      KV.set('notes', capped);
      A.bus.emit('notes:changed');
      return capped[0];
    },
    remove(id) {
      KV.set('notes', notes.all().filter((n) => n.id !== id));
      A.bus.emit('notes:changed');
    },
    find(query = '') {
      const q = query.toLowerCase();
      return notes
        .all()
        .filter((n) => !q || (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q));
    },
  };

  const memory = {
    all: () => KV.get('memory', []),
    add(text) {
      const list = memory.all();
      const clean = String(text || '').trim();
      if (!clean) return null;
      if (list.some((m) => m.text.toLowerCase() === clean.toLowerCase())) return null;
      const item = { id: A.util.uid('m_'), text: clean, created: Date.now() };
      KV.set('memory', [item, ...list].slice(0, 120));
      A.bus.emit('memory:changed');
      return item;
    },
    remove(id) {
      KV.set('memory', memory.all().filter((m) => m.id !== id));
      A.bus.emit('memory:changed');
    },
    clear() {
      KV.set('memory', []);
      A.bus.emit('memory:changed');
    },
  };

  const HISTORY = () => KV.get('tool:history', []);
  function logRun(skill, input, output, ok) {
    const hist = HISTORY();
    hist.unshift({ id: A.util.uid('t_'), skill, input, output: String(output).slice(0, 400), ok, ts: Date.now() });
    KV.set('tool:history', hist.slice(0, 60));
  }

  /* ───────────────────────── local skills ───────────────────────── */

  const local = {
    calculator: {
      id: 'calculator',
      title: 'Calculator',
      icon: 'calc',
      description: 'Evaluate arithmetic, percentages and functions exactly.',
      params: { expression: 'string — e.g. (1250*0.18)+40 or sqrt(144) or 15% of 240' },
      run: async ({ expression }) => {
        if (!expression) throw new Error('expression is required');
        let expr = String(expression);
        if (/%\s*of\s*/i.test(expr)) {
          expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/gi, '($1/100*$2)');
        }
        const value = A.offlineEngine.evalMath(expr);
        return { value, formatted: value.toLocaleString('en-US', { maximumFractionDigits: 8 }) };
      },
    },
    convert: {
      id: 'convert',
      title: 'Unit converter',
      icon: 'swap',
      description: 'Convert length, mass, volume, time, data, speed and temperature.',
      params: { value: 'number', from: 'unit', to: 'unit' },
      run: async ({ value, from, to }) => {
        const out = A.offlineEngine.convertUnits(Number(value), from, to);
        if (!out) throw new Error(`Cannot convert ${from} → ${to}`);
        return { result: out.value, unit: to, label: `${value} ${from} = ${out.value.toFixed(4).replace(/\.?0+$/, '')} ${to}` };
      },
    },
    text_stats: {
      id: 'text_stats',
      title: 'Text statistics',
      icon: 'text',
      description: 'Count words, characters, sentences and estimate reading time.',
      params: { text: 'string' },
      run: async ({ text = '' }) => {
        const words = (text.match(A.util.wordRe()) || []).length;
        return {
          words,
          characters: text.length,
          sentences: (text.match(/[.!?]+/g) || []).length,
          readingMinutes: Math.max(1, Math.round(words / 220)),
        };
      },
    },
    text_transform: {
      id: 'text_transform',
      title: 'Text transformer',
      icon: 'sparkle',
      description: 'Uppercase, lowercase, title case, slug, reverse, trim, dedupe lines.',
      params: { text: 'string', mode: 'upper|lower|title|slug|reverse|trim|dedupe' },
      run: async ({ text = '', mode = 'upper' }) => {
        const modes = {
          upper: () => text.toUpperCase(),
          lower: () => text.toLowerCase(),
          title: () => text.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
          slug: () => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          reverse: () => [...text].reverse().join(''),
          trim: () => text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
          dedupe: () => [...new Set(text.split('\n').map((l) => l.trim()))].join('\n'),
        };
        if (!modes[mode]) throw new Error(`Unknown mode "${mode}"`);
        return { result: modes[mode]() };
      },
    },
    save_note: {
      id: 'save_note',
      title: 'Save note',
      icon: 'note',
      description: 'Save text to the device as a note (works offline, syncs nowhere).',
      mutates: true,
      params: { title: 'string', body: 'string' },
      run: async ({ title = 'Note', body = '' }) => {
        const note = notes.save({ title: A.util.truncate(title, 80), body });
        return { saved: true, id: note.id, title: note.title };
      },
    },
    list_notes: {
      id: 'list_notes',
      title: 'Read notes',
      icon: 'note',
      description: 'List or search notes saved on this device.',
      params: { query: 'string (optional)' },
      run: async ({ query = '' } = {}) => {
        const list = notes.find(query).slice(0, 20);
        return { count: list.length, notes: list.map((n) => ({ id: n.id, title: n.title, preview: A.util.truncate((n.body || '').replace(/\n/g, ' '), 120) })) };
      },
    },
    remember: {
      id: 'remember',
      title: 'Remember a fact',
      icon: 'memory',
      description: 'Store a preference or fact for future conversations (local only).',
      mutates: true,
      params: { fact: 'string' },
      run: async ({ fact }) => {
        if (!A.settings.get('memoryEnabled')) throw new Error('Memory is turned off in Settings');
        const item = memory.add(fact);
        return { stored: !!item, fact: item ? item.text : 'already known' };
      },
    },
    recall: {
      id: 'recall',
      title: 'Recall memories',
      icon: 'memory',
      description: 'Read stored facts and preferences.',
      params: { query: 'string (optional)' },
      run: async ({ query = '' } = {}) => {
        const q = String(query).toLowerCase();
        const list = memory.all().filter((m) => !q || m.text.toLowerCase().includes(q));
        return { count: list.length, facts: list.slice(0, 20).map((m) => m.text) };
      },
    },
    date_math: {
      id: 'date_math',
      title: 'Date maths',
      icon: 'calendar',
      description: 'Today, differences between dates, add/subtract days.',
      params: { op: 'today|diff|add', date: 'YYYY-MM-DD', date2: 'YYYY-MM-DD', days: 'number' },
      run: async ({ op = 'today', date, date2, days = 0 }) => {
        const now = new Date();
        if (op === 'today') {
          return {
            date: now.toISOString().slice(0, 10),
            pretty: now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            week: Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7),
          };
        }
        if (!date) throw new Error('date is required');
        const d1 = new Date(date + 'T00:00:00');
        if (op === 'diff') {
          const d2 = new Date((date2 || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
          const diffDays = Math.round((d2 - d1) / 86400000);
          return { days: diffDays, weeks: +(diffDays / 7).toFixed(2), from: date, to: date2 || 'today' };
        }
        d1.setDate(d1.getDate() + Number(days));
        return { date: d1.toISOString().slice(0, 10), pretty: d1.toDateString() };
      },
    },
    random: {
      id: 'random',
      title: 'Random picker',
      icon: 'dice',
      description: 'Random number in a range, dice roll, or choose from a list.',
      params: { min: 'number', max: 'number', choices: 'array (optional)' },
      run: async ({ min = 1, max = 100, choices } = {}) => {
        if (Array.isArray(choices) && choices.length) {
          return { pick: choices[Math.floor(Math.random() * choices.length)] };
        }
        const lo = Math.min(Number(min), Number(max));
        const hi = Math.max(Number(min), Number(max));
        return { value: lo + Math.floor(Math.random() * (hi - lo + 1)), min: lo, max: hi };
      },
    },
    knowledge: {
      id: 'knowledge',
      title: 'Offline library',
      icon: 'book',
      description: 'Search the built-in offline knowledge base (science, code, writing, life).',
      params: { query: 'string' },
      run: async ({ query }) => {
        const hits = A.knowledge.search(query, 3);
        if (!hits.length) return { found: false, topics: [] };
        return {
          found: true,
          topics: hits.map((h) => ({ id: h.topic.id, title: h.topic.title, excerpt: A.util.truncate(h.topic.answer.replace(/[#*`>]/g, '').replace(/\n+/g, ' '), 260) })),
        };
      },
    },
    checklist: {
      id: 'checklist',
      title: 'Make a checklist',
      icon: 'check',
      description: 'Turn a goal into an ordered, time-boxed checklist.',
      params: { goal: 'string', days: 'number (optional)' },
      run: async ({ goal = '', days = 7 }) => {
        const per = Math.max(1, Math.ceil(days / 4));
        const steps = [
          `Define "done" for: ${A.util.truncate(goal, 70)}`,
          'List the 5 things that must be true to finish',
          'Pick the smallest testable first version',
          'Do the hardest step first, one timeboxed block',
          'Review: what shipped, what slipped, next step',
        ];
        return { goal, days, checklist: steps.map((s, i) => ({ n: i + 1, task: s, due: `day ${Math.min(days, (i + 1) * per)}` })) };
      },
    },
  };

  /* ───────────────────────── network skills ───────────────────────── */

  const online = {
    web_fetch: {
      id: 'web_fetch',
      title: 'Fetch a web page',
      icon: 'globe',
      network: true,
      description: 'Download a URL and return clean text (HTML tags stripped).',
      params: { url: 'https://…' },
      run: async ({ url }) => {
        if (!/^https?:\/\//i.test(url || '')) throw new Error('A full http(s) URL is required');
        const res = await fetch(url, { mode: 'cors', headers: { Accept: 'text/html,application/json,text/plain' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const raw = await res.text();
        const isJson = (res.headers.get('content-type') || '').includes('json');
        if (isJson) {
          const json = JSON.parse(raw);
          return { url, type: 'json', preview: JSON.stringify(json, null, 2).slice(0, 4000), bytes: raw.length };
        }
        const text = raw
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        const title = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || url;
        return { url, title: title.trim().slice(0, 160), bytes: raw.length, text: text.slice(0, 6000) };
      },
    },
    json_api: {
      id: 'json_api',
      title: 'Call an API',
      icon: 'plug',
      network: true,
      description: 'GET/POST a JSON endpoint and return a trimmed response.',
      params: { url: 'https://…', method: 'GET|POST', body: 'object (optional)' },
      run: async ({ url, method = 'GET', body }) => {
        if (!/^https?:\/\//i.test(url || '')) throw new Error('A full http(s) URL is required');
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method === 'GET' ? undefined : JSON.stringify(body || {}),
        });
        const text = await res.text();
        return { status: res.status, ok: res.ok, body: text.slice(0, 6000) };
      },
    },
    timer_note: {
      id: 'timer_note',
      title: 'Schedule a reminder',
      icon: 'clock',
      description: 'Create an in-app reminder that shows a toast at a set time.',
      mutates: true,
      params: { minutes: 'number', text: 'string' },
      run: async ({ minutes = 5, text = 'Reminder' }) => {
        const list = KV.get('reminders', []);
        const at = Date.now() + Number(minutes) * 60000;
        const item = { id: A.util.uid('r_'), at, text };
        KV.set('reminders', [...list, item].slice(-30));
        A.skills.scheduleReminder(item);
        return { scheduled: true, at: new Date(at).toLocaleTimeString(), text };
      },
    },
  };

  const all = { ...local, ...online };

  /* reminders: checked by a 20s interval while the app is open */
  const timers = new Map();
  function scheduleReminder(item) {
    const delay = Math.max(0, item.at - Date.now());
    if (delay > 6 * 3600 * 1000) return; // long ones are picked up on next launch
    const t = setTimeout(() => {
      A.bus.emit('reminder', item);
      timers.delete(item.id);
    }, delay);
    timers.set(item.id, t);
  }
  function restoreReminders() {
    const list = KV.get('reminders', []);
    const due = list.filter((r) => r.at > Date.now());
    due.forEach(scheduleReminder);
    KV.set('reminders', due);
  }

  async function run(name, params = {}, { signal } = {}) {
    const skill = all[name];
    if (!skill) throw new Error(`Unknown skill "${name}"`);
    if (skill.network && !A.net.online) throw new Error(`"${skill.title}" needs a connection`);
    try {
      const output = await skill.run(params, { signal });
      logRun(name, params, JSON.stringify(output).slice(0, 300), true);
      return output;
    } catch (err) {
      logRun(name, params, err.message, false);
      throw err;
    }
  }

  A.skills = {
    local,
    online,
    all,
    run,
    notes,
    memory,
    history: HISTORY,
    scheduleReminder,
    restoreReminders,
    /** schemas for cloud models that support tool calling */
    toolSchemas() {
      return Object.values(all)
        .filter((s) => !s.network || true)
        .map((s) => ({
          type: 'function',
          function: {
            name: s.id,
            description: s.description,
            parameters: {
              type: 'object',
              properties: Object.fromEntries(Object.entries(s.params).map(([k, v]) => [k, { type: 'string', description: v }])),
              required: Object.keys(s.params).filter((k) => !/optional/.test(s.params[k])),
            },
          },
        }));
    },
  };
})();
