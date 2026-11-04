/* ════════════════════════════════════════════════════════════════
   Ai'sHub · agent
   Plan → act (skills) → observe → repeat → report.
   The planner works three ways, best available first:
     1. cloud model with tool calling → returns a JSON step plan
     2. cloud model without tools → returns JSON plan (parsed leniently)
     3. offline planner → heuristic plan built from the goal text
   Steps that change data (notes, reminders) can require approval.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { uid } = A.util;

  const PLANNER_SYSTEM = `You are the planner inside Ai'sHub, a mobile AI agent.
Return ONLY valid JSON, no prose, no markdown fences.
Schema:
{"plan":["short step description", "..."],"steps":[{"skill":"skill_id","input":{...},"why":"short reason"}]}

Rules:
- Use at most 6 steps. Prefer local skills. Only use network skills when the goal truly needs the web.
- If the goal is just a question, return one step using the "knowledge" skill, or an empty steps array with a plan describing what to answer.
- Never invent skill ids. Available skills: {{SKILLS}}
- Inputs must be JSON objects matching the skill params.
- Keep "why" under 12 words.`;

  const MAX_STEPS = 7;

  /* ─────────────── offline planner ─────────────── */
  function offlinePlan(goal) {
    const g = goal.toLowerCase();
    const plan = [];
    const steps = [];

    // percentages ("18% of 45000") first, then plain arithmetic
    const pct = goal.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*([\d,]+(?:\.\d+)?)/i);
    if (pct) {
      const expr = `(${pct[1]}/100*${pct[2].replace(/,/g, '')})`;
      plan.push(`Calculate ${pct[1]}% of ${pct[2]}`);
      steps.push({ skill: 'calculator', input: { expression: expr }, why: 'percentage of an amount' });
    }
    const mathHits = goal.match(/[-+]?\d[\d.,]*(?:\s*[-+*/^]\s*[-+]?\d[\d.,]*)+/g);
    if (!pct && mathHits) {
      const expr = mathHits[0].replace(/,/g, '');
      plan.push('Calculate ' + expr);
      steps.push({ skill: 'calculator', input: { expression: expr }, why: 'exact arithmetic' });
    }

    // conversions
    const conv = goal.match(/(-?\d+(?:\.\d+)?)\s*([a-z]{1,8})\s*(?:to|in|into)\s*([a-z]{1,8})\b/i);
    if (conv) {
      plan.push(`Convert ${conv[1]} ${conv[2]} → ${conv[3]}`);
      steps.push({ skill: 'convert', input: { value: Number(conv[1]), from: conv[2], to: conv[3] }, why: 'unit conversion' });
    }

    // notes — deferred so the note body gets the finished report
    const wantsNote = /\b(note|save|write down|jot|record|store)\b/i.test(g);
    if (wantsNote) {
      const title =
        goal
          .replace(/\b(and\s+)?(save|write)\s+(it|this|that)?\s*(as|to|in|into)?\s*(a\s+)?note\b/gi, '')
          .replace(/^(make|create|save|write|jot down|record)\s+(a\s+)?/i, '')
          .replace(/\s+/g, ' ')
          .trim() || 'Agent note';
      plan.push('Save the result as a note');
      steps.push({
        skill: 'save_note',
        input: { title: A.util.truncate(title, 70), body: '' },
        why: 'persist on device',
        mutates: true,
        deferred: true,
      });
    }

    // notes reading
    if (/\b(read|list|show|find)\b.*\bnotes?\b/i.test(g) || /\bmy notes\b/i.test(g)) {
      plan.push('Search saved notes');
      steps.push({ skill: 'list_notes', input: { query: '' }, why: 'read local notes' });
    }

    // memory
    if (/\b(remember|don't forget|keep in mind)\b/i.test(g) && !/\bnotes?\b/i.test(g)) {
      plan.push('Remember this for later');
      steps.push({ skill: 'remember', input: { fact: A.util.truncate(goal.replace(/^.*?(remember|don't forget|keep in mind)\s*(that)?\s*/i, ''), 160) }, why: 'long-term preference', mutates: true });
    }

    // date maths
    const days = goal.match(/(\d+)\s*[\s-]days?\s*(from|after|before|later)/i);
    if (days) {
      plan.push('Work out the date');
      steps.push({ skill: 'date_math', input: { op: 'add', date: new Date().toISOString().slice(0, 10), days: Number(days[1]) }, why: 'date arithmetic' });
    }

    // text stats
    if (/\b(word count|how many words|character count)\b/i.test(g)) {
      plan.push('Measure the text');
      steps.push({ skill: 'text_stats', input: { text: goal }, why: 'exact counts' });
    }

    // checklist / plan goals
    if (/\b(checklist|plan|routine|schedule|roadmap|steps?)\b/i.test(g) && steps.length < 2) {
      const dayMatch = goal.match(/(\d+)\s*[-\s]days?/i);
      plan.push('Build a checklist');
      steps.push({ skill: 'checklist', input: { goal, days: dayMatch ? Number(dayMatch[1]) : 7 }, why: 'turn goal into steps' });
    }

    // knowledge lookup
    if (steps.length < 2) {
      plan.push('Search the offline library');
      steps.push({ skill: 'knowledge', input: { query: goal }, why: 'local knowledge base' });
    }

    // web (needs network)
    const url = goal.match(/https?:\/\/[^\s"']+/);
    if (url) {
      plan.push('Read the page at ' + url[0].slice(0, 60));
      steps.push({ skill: 'web_fetch', input: { url: url[0] }, why: 'fetch live content' });
    }

    return { plan, steps: steps.slice(0, MAX_STEPS), source: 'offline' };
  }

  /* ─────────────── cloud planner ─────────────── */
  async function cloudPlan(goal, { signal } = {}) {
    const model = A.ai.resolveSelected();
    if (A.ai.isLocal(model)) return null;
    const skillList = Object.values(A.skills.all)
      .map((s) => `${s.id}(${Object.keys(s.params).join(', ')})${s.network ? ' [net]' : ''}`)
      .join(' ');
    const system = PLANNER_SYSTEM.replace('{{SKILLS}}', skillList);
    try {
      const res = await A.ai.chat({
        messages: [{ role: 'user', content: `Goal: ${goal}` }],
        model,
        system,
        onDelta: null,
        signal,
        noFallback: true,
        maxTokens: 700,
        temperature: 0.2,
      });
      const parsed = A.util.sanitizeJsonParse(A.util.stripFences(res.text), null);
      if (!parsed) return null;
      const steps = (parsed.steps || [])
        .filter((s) => s && A.skills.all[s.skill])
        .slice(0, MAX_STEPS)
        .map((s) => ({ skill: s.skill, input: s.input || {}, why: s.why || '', mutates: !!A.skills.all[s.skill].mutates }));
      const plan = Array.isArray(parsed.plan) ? parsed.plan.map(String).slice(0, MAX_STEPS) : steps.map((s) => s.why || s.skill);
      return { plan, steps, source: 'cloud', model: res.model };
    } catch (err) {
      if (signal?.aborted) throw err;
      return null;
    }
  }

  /* ─────────────── runner ─────────────── */
  /**
   * @param {string} goal
   * @param {object} opts
   * @param {Function} opts.onStep   (step, state) => void  ('start'|'ok'|'err'|'skip')
   * @param {Function} opts.approve  async (step) => boolean
   * @param {AbortSignal} opts.signal
   */
  async function run(goal, { onStep = () => {}, approve, signal, onPlan = () => {} } = {}) {
    const task = {
      id: uid('task_'),
      goal,
      created: Date.now(),
      finished: null,
      state: 'running',
      steps: [],
      plan: [],
      result: '',
      source: '',
    };
    A.bus.emit('task:start', task);

    let planData = null;
    try {
      planData = await cloudPlan(goal, { signal });
    } catch (err) {
      if (signal?.aborted) throw err;
    }
    if (!planData) planData = offlinePlan(goal);
    task.plan = planData.plan;
    task.source = planData.source;
    onPlan(planData);

    const results = [];
    for (let i = 0; i < planData.steps.length; i++) {
      if (signal?.aborted) {
        task.state = 'cancelled';
        break;
      }
      const step = planData.steps[i];
      if (step.deferred) continue; // handled after the report is composed
      const record = { n: i + 1, skill: step.skill, input: step.input, why: step.why, state: 'running', started: Date.now() };
      task.steps.push(record);
      onStep(record, 'start');

      const skill = A.skills.all[step.skill];
      if (step.mutates && A.settings.get('agentApproval') === 'confirm' && approve) {
        const ok = await approve(record);
        if (!ok) {
          record.state = 'skipped';
          record.output = 'Skipped by user';
          onStep(record, 'skip');
          continue;
        }
      }
      if (skill.network && !A.net.online) {
        record.state = 'error';
        record.output = 'Needs internet — skipped offline';
        onStep(record, 'err');
        continue;
      }

      try {
        const output = await A.skills.run(step.skill, step.input, { signal });
        record.state = 'ok';
        record.output = output;
        record.finished = Date.now();
        results.push({ skill: step.skill, output });
        onStep(record, 'ok');
      } catch (err) {
        record.state = 'error';
        record.output = err.message;
        record.finished = Date.now();
        onStep(record, 'err');
      }
    }

    task.finished = Date.now();
    if (task.state !== 'cancelled') {
      task.state = task.steps.some((s) => s.state === 'ok') || !task.steps.length ? 'done' : 'failed';
    }
    task.result = await composeReport(goal, task, results, { signal });

    // deferred steps (e.g. save_note) receive the finished report as their body
    for (const step of planData.steps.filter((s) => s.deferred)) {
      if (signal?.aborted) break;
      const record = task.steps.find((r) => r.skill === step.skill && r.state === 'skipped_pending');
      if (record) continue;
      const input = { ...step.input, body: step.input.body || task.result };
      try {
        const output = await A.skills.run(step.skill, input, { signal });
        task.steps.push({ n: task.steps.length + 1, skill: step.skill, input, why: step.why, state: 'ok', output, started: Date.now(), finished: Date.now() });
        results.push({ skill: step.skill, output });
        onStep(task.steps[task.steps.length - 1], 'ok');
      } catch (err) {
        task.steps.push({ n: task.steps.length + 1, skill: step.skill, input, why: step.why, state: 'error', output: err.message });
        onStep(task.steps[task.steps.length - 1], 'err');
      }
    }
    await A.store.DB.putTask(task);
    A.bus.emit('task:done', task);
    return task;
  }

  /** Turn raw step outputs into a readable report (cloud if possible). */
  async function composeReport(goal, task, results, { signal } = {}) {
    const facts = results
      .map((r) => `- ${r.skill}: ${JSON.stringify(r.output).slice(0, 600)}`)
      .join('\n');
    if (!results.length) {
      return `I looked at "${A.util.truncate(goal, 80)}" but no skill could act on it offline. Try Chat mode for an answer, or connect a cloud model so the agent can reason across steps.`;
    }

    const model = A.ai.resolveSelected();
    if (!A.ai.isLocal(model) && A.net.online) {
      try {
        const res = await A.ai.chat({
          messages: [
            {
              role: 'user',
              content: `Goal: ${goal}\n\nStep results:\n${facts}\n\nWrite a short final report for the user (max 180 words, Markdown, no preamble). Include the concrete results and any next action.`,
            },
          ],
          model,
          onDelta: null,
          signal,
          noFallback: true,
          maxTokens: 500,
          temperature: 0.4,
        });
        if (res.text && res.text.trim()) return res.text.trim();
      } catch (_) {
        /* fall through to local composition */
      }
    }

    // local composition
    const lines = [`## Done: ${A.util.truncate(goal, 70)}`, ''];
    for (const r of results) {
      const o = r.output || {};
      switch (r.skill) {
        case 'calculator':
          lines.push(`**Result:** ${o.formatted ?? o.value}`);
          break;
        case 'convert':
          lines.push(`**Conversion:** ${o.label || `${o.result} ${o.unit}`}`);
          break;
        case 'checklist':
          lines.push(`**Plan (${o.days} days)**`);
          (o.checklist || []).forEach((c) => lines.push(`${c.n}. ${c.task} — _${c.due}_`));
          break;
        case 'list_notes':
          lines.push(`**Notes found:** ${o.count}`);
          (o.notes || []).forEach((n) => lines.push(`- **${n.title}** — ${n.preview}`));
          break;
        case 'save_note':
          lines.push(`**Saved note:** ${o.title}`);
          break;
        case 'knowledge':
          if (o.found) (o.topics || []).forEach((t) => lines.push(`**${t.title}**\n${t.excerpt}`));
          else lines.push('No matching offline topic — ask me in Chat mode for a full answer.');
          break;
        case 'text_stats':
          lines.push(`**Text:** ${o.words} words · ${o.characters} chars · ~${o.readingMinutes} min read`);
          break;
        case 'remember':
          lines.push(`**Remembered:** ${o.fact}`);
          break;
        case 'date_math':
          lines.push(`**Date:** ${o.pretty || o.date}`);
          break;
        default:
          lines.push(`**${r.skill}:** \`${JSON.stringify(o).slice(0, 200)}\``);
      }
    }
    lines.push('', `_Ran ${results.length} step${results.length > 1 ? 's' : ''} ${task.source === 'offline' ? 'on-device' : 'with ' + task.source}._`);
    return lines.join('\n');
  }

  A.agent = { run, offlinePlan, cloudPlan, MAX_STEPS };
})();
