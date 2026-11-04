/* ════════════════════════════════════════════════════════════════
   Ai'sHub · Prompts & Assistants screen
   Expert setups (assistants carry a system prompt + suggested model)
   and a curated prompt library. One tap starts a chat.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { $, icon, toast } = A.ui;
  const esc = A.util.escapeHtml;

  const assistants = [
    {
      id: 'general', emoji: '✨', title: "Ai'sHub Assistant", cat: 'Everyday',
      desc: 'Balanced helper for questions, writing and planning.',
      system: '', starter: 'What can you help me with today?', model: 'local',
    },
    {
      id: 'coder', emoji: '👩‍💻', title: 'Senior Engineer', cat: 'Code',
      desc: 'Reviews code, explains errors, writes tests. Asks for context first.',
      system: 'You are a senior software engineer. Be precise and pragmatic. Ask for the exact error and the smallest relevant code when missing. Always give runnable code in fenced blocks with a language tag, then explain the change in 2-3 sentences. Prefer standard library solutions and note trade-offs.',
      starter: 'Here is my code — find the bug and fix it:', model: 'aishub-code-1',
    },
    {
      id: 'tutor', emoji: '🎓', title: 'Study Tutor', cat: 'Study',
      desc: 'Explains at your level, quizzes you, tracks weak spots.',
      system: 'You are a patient tutor. Explain with a simple analogy first, then the precise version. End each reply with one short check-your-understanding question. Never dump a wall of text; use headings and examples.',
      starter: 'Teach me photosynthesis at a 10th-grade level.', model: 'aishub-tutor-1',
    },
    {
      id: 'writer', emoji: '✍️', title: 'Writing Coach', cat: 'Writing',
      desc: 'Drafts, edits, and tightens everything you write.',
      system: 'You are an expert editor. Cut filler, prefer concrete nouns and strong verbs, keep sentences under 20 words on average. When editing, show a short before/after and explain the single most important change.',
      starter: 'Tighten this paragraph without losing meaning:', model: 'aishub-write-1',
    },
    {
      id: 'translator', emoji: '🌐', title: 'Translator', cat: 'Language',
      desc: 'English ⇄ Bengali, Hindi, Arabic and more, with tone control.',
      system: 'You are a professional translator. Translate faithfully, keep names and numbers unchanged, match the requested register (formal/neutral/casual), and give a short note on idioms that do not map directly. If the target language is not stated, ask once.',
      starter: 'Translate to Bengali, formal tone: "We regret to inform you that the delivery is delayed."', model: 'local',
    },
    {
      id: 'analyst', emoji: '📊', title: 'Data Analyst', cat: 'Work',
      desc: 'Turns numbers and messy data into decisions.',
      system: 'You are a data analyst. Ask what decision the data supports. Show calculations step by step. Present findings as a short table, then 3 bullet insights, then one recommended action. Flag assumptions and sample-size issues.',
      starter: 'Here is my monthly sales data — what should I do next?', model: 'local',
    },
    {
      id: 'business', emoji: '🚀', title: 'Founder Copilot', cat: 'Work',
      desc: 'Validates ideas, prices products, plans launches.',
      system: 'You are a pragmatic startup advisor. Ask about the customer and the problem before the solution. Give concrete, cheap next experiments with success metrics and deadlines. Be blunt about what will not work.',
      starter: 'I want to build a subscription app for exam prep in Bangladesh. Where do I start?', model: 'local',
    },
    {
      id: 'health', emoji: '🩺', title: 'Wellness Guide', cat: 'Life',
      desc: 'Evidence-based habits, with clear safety limits.',
      system: 'You give general wellness information (sleep, movement, food, stress). Never diagnose. Always include a short safety note for red-flag symptoms and recommend a clinician for anything medical. Prefer small sustainable habits over plans.',
      starter: 'Build me a realistic 20-minute daily routine for energy.', model: 'local',
    },
    {
      id: 'travel', emoji: '🧭', title: 'Trip Planner', cat: 'Life',
      desc: 'Day-by-day itineraries that fit a real budget.',
      system: 'You are a travel planner. Ask for city, dates, budget currency and pace. Produce a day-by-day plan with one anchor per day, transit notes, food suggestions and a cost estimate line. Flag visa/season risks.',
      starter: 'Plan 3 days in Cox\'s Bazar for two people under 20,000 taka.', model: 'local',
    },
    {
      id: 'agent', emoji: '🤖', title: 'Agent Operator', cat: 'Agent',
      desc: 'Executes multi-step goals with skills and reports back.',
      system: 'You plan and execute multi-step tasks. Break the goal into the fewest steps, use available skills, verify results and report concisely with what changed.',
      starter: 'Plan my week from these three goals and save it as a note:', model: 'aishub-agent-1', agent: true,
    },
  ];

  const prompts = [
    { e: '📧', t: 'Email that gets replies', c: 'Writing', p: 'Write a short professional email. One clear ask, deadline in the body, numbered action items. Context: ' },
    { e: '🐛', t: 'Find the bug', c: 'Code', p: 'Here is my code and the exact error. Find the root cause, explain in 3 sentences, then give the fixed version with a diff: ' },
    { e: '📝', t: 'Summarise an article', c: 'Writing', p: 'Summarise the following into: 1-sentence thesis, 5 bullets of evidence, and one caveat. Text: ' },
    { e: '💰', t: 'Budget check', c: 'Life', p: 'Make a monthly budget. Income, fixed costs, then 50/30/20 split with exact amounts and two savings levers. My numbers: ' },
    { e: '🎤', t: 'Prepare for an interview', c: 'Career', p: 'I have an interview for this role. Generate 10 likely questions with STAR-style answer outlines based on my background: ' },
    { e: '🧠', t: 'Explain it 3 ways', c: 'Study', p: 'Explain this concept three ways: to a 10-year-old, to a student, and to an expert (2 sentences each): ' },
    { e: '📱', t: 'App idea stress test', c: 'Business', p: 'Stress-test this app idea: who pays, why now, the first 10 users, the biggest risk, and the cheapest 1-week test. Idea: ' },
    { e: '🗺️', t: 'Trip itinerary', c: 'Life', p: 'Build a day-by-day itinerary. One anchor per day, transit notes, food spots, cost estimate. Destination and days: ' },
    { e: '⚙️', t: 'Shell command', c: 'Code', p: 'Give me the exact terminal command (Linux/macOS) and explain each flag. Task: ' },
    { e: '📊', t: 'Data to decisions', c: 'Work', p: 'Here is my data. Give a table of findings, 3 insights, and one recommended action with the assumption list: ' },
    { e: '🌙', t: 'Sleep & energy reset', c: 'Life', p: 'Design a 7-day sleep and energy reset plan with morning light, caffeine cutoff, wind-down routine and a checkoff list.' },
    { e: '📚', t: 'Study plan generator', c: 'Study', p: 'Build a 21-day study plan with daily 90-minute blocks, active recall, spaced review (day 1/3/7/21) and mock tests. Subject and deadline: ' },
    { e: '🧾', t: 'Rewrite for clarity', c: 'Writing', p: 'Rewrite the following so a busy person understands it in one read. Keep facts identical. Text: ' },
    { e: '🔐', t: 'Security review', c: 'Code', p: 'Review this code for security issues: injection, auth, secrets, input validation. Give severity, evidence and a fix for each: ' },
    { e: '🎯', t: 'Weekly plan', c: 'Productivity', p: 'Turn these goals into a weekly plan with 3 outcomes, timeboxes and a Friday review. Goals: ' },
    { e: '🧪', t: 'Explain a physics idea', c: 'Study', p: 'Explain this physics concept with the formula, a real example and one common misconception: ' },
  ];

  let tab = 'assistants';

  function render() {
    const host = $('#prompts-list');
    const items = tab === 'assistants' ? assistants : prompts;
    host.innerHTML =
      `<div class="section-label">${tab === 'assistants' ? 'Assistants' : 'Prompt library'} · ${items.length}</div>` +
      items
        .map((item, i) =>
          tab === 'assistants'
            ? `<button class="prompt-card" data-kind="assistant" data-i="${i}">
                <span class="prompt-top"><span class="prompt-emoji">${item.emoji}</span>
                <span><span class="prompt-title" style="display:block">${esc(item.title)}</span><span class="prompt-cat">${esc(item.cat)} · ${item.agent ? 'agent mode' : 'chat mode'}</span></span></span>
                <span class="prompt-desc">${esc(item.desc)}</span>
              </button>`
            : `<button class="prompt-card" data-kind="prompt" data-i="${i}">
                <span class="prompt-top"><span class="prompt-emoji">${item.e}</span>
                <span><span class="prompt-title" style="display:block">${esc(item.t)}</span><span class="prompt-cat">${esc(item.c)}</span></span></span>
                <span class="prompt-desc">${esc(A.util.truncate(item.p, 90))}</span>
              </button>`
        )
        .join('');

    host.querySelectorAll('[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-i'));
        if (btn.getAttribute('data-kind') === 'assistant') startAssistant(assistants[i]);
        else startPrompt(prompts[i]);
      });
    });
  }

  function startAssistant(a) {
    A.settings.set('systemPrompt', a.system || '');
    if (a.model) {
      const model = A.catalog.find(a.model) || A.catalog.all().find((m) => m.id === a.model);
      if (model) {
        A.settings.set('selectedModel', A.catalog.keyFor(model));
        A.app.updateModelChip();
      }
    }
    A.chat.setMode(a.agent ? 'agent' : 'chat');
    A.chat.newChat({ silent: true });
    A.app.go('chat');
    const input = $('#input');
    input.value = a.starter;
    A.chat.autosize();
    input.focus();
    toast(`${a.title} ready — press send`, 'ok', 2200);
  }

  function startPrompt(p) {
    A.chat.setMode('chat');
    A.app.go('chat');
    const input = $('#input');
    input.value = p.p;
    A.chat.autosize();
    input.focus();
    toast('Prompt inserted — add your details', '', 2000);
  }

  function mount() {
    $('#prompt-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      tab = btn.getAttribute('data-tab');
      A.ui.$$('#prompt-tabs button').forEach((b) => b.classList.toggle('is-active', b === btn));
      render();
    });
    render();
  }

  A.screens = A.screens || {};
  A.screens.prompts = { mount, render };
})();
