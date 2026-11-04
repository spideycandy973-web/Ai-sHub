/* ════════════════════════════════════════════════════════════════
   Ai'sHub · Agent screen
   New goal box, live task list, step traces, re-run, delete, skills.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { $, el, icon, toast, openSheet, closeSheet } = A.ui;
  const esc = A.util.escapeHtml;

  let tasks = [];
  let currentRun = null;

  async function load() {
    tasks = (await A.store.DB.getTasks()).sort((a, b) => b.created - a.created);
    render();
  }

  function render() {
    const host = $('#agent-tasks');
    const goal = el('div', { class: 'card' });
    goal.innerHTML = `
      <h3>${icon('target')} New agent task</h3>
      <div class="field" style="margin-bottom:10px">
        <textarea class="input" id="agent-goal" rows="2" placeholder="e.g. Plan a 3-day Dhaka trip under 15000 taka and save it as a note"></textarea>
      </div>
      <div class="hstack">
        <button class="btn btn-ghost btn-sm" id="agent-suggest">${icon('bolt')} Suggest a goal</button>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="agent-run">${icon('play')} Run</button>
      </div>
      <div class="card-sub">${A.net.online ? 'Planning with your selected model, falling back to on-device steps.' : 'Offline — planning on-device with built-in skills.'}</div>`;

    const listWrap = el('div');
    if (!tasks.length) {
      listWrap.innerHTML = `<div class="empty-state">${icon('route')}<p>No agent runs yet.<br/>Give one goal and the agent will plan it, run the steps and report back.</p></div>`;
    } else {
      listWrap.innerHTML = `<div class="section-label" style="margin-top:6px">Recent runs</div>`;
      tasks.slice(0, 25).forEach((t) => listWrap.appendChild(taskCard(t)));
    }

    host.innerHTML = '';
    host.append(goal, listWrap);

    goal.querySelector('#agent-run').addEventListener('click', () => runFromScreen());
    goal.querySelector('#agent-goal').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runFromScreen();
    });
    goal.querySelector('#agent-suggest').addEventListener('click', () => {
      const ideas = [
        'Plan a 3-day Dhaka trip under 15000 taka and save it as a note',
        'Calculate 18% VAT on 45000 and convert 250 km to miles',
        'Make a 21-day study checklist for my final exams',
        'Remember that I prefer short, direct answers',
        'What is today\'s date and how many days until 31 December?',
      ];
      goal.querySelector('#agent-goal').value = A.util.pick(ideas);
    });
  }

  function taskCard(t) {
    const card = el('div', { class: 'task-card' });
    const stateClass = t.state === 'done' ? 'done' : t.state === 'failed' ? 'failed' : t.state === 'running' ? 'running' : 'cancelled';
    card.innerHTML = `
      <div class="task-top">
        <div class="task-goal">${esc(A.util.truncate(t.goal, 110))}</div>
        <span class="task-state ${stateClass}">${esc(t.state)}</span>
      </div>
      <div class="task-steps">
        ${(t.steps || [])
          .map(
            (s) => `<div class="task-step ${s.state === 'ok' ? 'ok' : s.state === 'error' ? 'err' : ''}">
              ${icon(s.state === 'ok' ? 'check' : s.state === 'error' ? 'warn' : s.state === 'skipped' ? 'stop' : 'dots')}
              <span>${esc(s.skill)}${s.why ? ' · ' + esc(s.why) : ''}</span></div>`
          )
          .join('')}
      </div>
      <div class="task-foot">
        <button class="btn btn-ghost btn-sm" data-open>${icon('list')} Details</button>
        <button class="btn btn-ghost btn-sm" data-chat>${icon('spark')} Ask follow-up</button>
        <div class="spacer"></div>
        <button class="icon-btn" data-del aria-label="Delete">${icon('trash')}</button>
      </div>`;
    card.querySelector('[data-open]').addEventListener('click', () => showTask(t));
    card.querySelector('[data-chat]').addEventListener('click', () => {
      A.app.go('chat');
      A.chat.setMode('chat');
      const input = $('#input');
      input.value = `About the agent task "${A.util.truncate(t.goal, 60)}": `;
      A.chat.autosize();
      input.focus();
    });
    card.querySelector('[data-del]').addEventListener('click', async () => {
      const ok = await A.ui.confirmDialog('Delete this run?', 'The task and its step log will be removed from this device.', { okLabel: 'Delete', danger: true });
      if (!ok) return;
      await A.store.DB.deleteTask(t.id);
      tasks = tasks.filter((x) => x.id !== t.id);
      render();
    });
    return card;
  }

  function showTask(t) {
    const wrap = el('div');
    wrap.innerHTML = `
      <div class="card" style="padding:13px">
        <div class="small muted">Goal</div>
        <div style="font-weight:650;margin-top:3px">${esc(t.goal)}</div>
        <div class="small muted" style="margin-top:8px">${new Date(t.created).toLocaleString()} · ${esc(t.source || 'offline')} plan · ${t.steps?.length || 0} steps</div>
      </div>
      ${(t.steps || [])
        .map(
          (s) => `<div class="step-detail">
            <div class="sd-head">${icon(s.state === 'ok' ? 'check' : s.state === 'error' ? 'warn' : 'dots')}
              <span>${esc(s.skill)}</span>
              <span class="task-state ${s.state === 'ok' ? 'done' : s.state === 'error' ? 'failed' : 'cancelled'}" style="margin-left:auto">${esc(s.state)}</span>
            </div>
            <pre>${esc(JSON.stringify(s.input, null, 2))}\n\n→ ${esc(typeof s.output === 'string' ? s.output : JSON.stringify(s.output, null, 2))}</pre>
          </div>`
        )
        .join('')}
      ${t.result ? `<div class="divider"></div><div class="prose">${A.markdown.render(t.result)}</div>` : ''}`;
    openSheet('Agent run', wrap);
    A.markdown.bindCopy(wrap);
  }

  async function runFromScreen() {
    const input = $('#agent-goal');
    const goal = input.value.trim();
    if (!goal) return toast('Type a goal first', '', 1600);
    input.value = '';
    A.app.go('chat');
    A.chat.setMode('agent');
    await A.chat.send(goal);
    load();
  }

  function mount() {
    render();
    load();
    A.bus.on('tasks:changed', load);
    A.bus.on('task:done', load);
    A.bus.on('settings:changed', () => {
      if (A.app.currentScreen() === 'agent') renderSkills();
    });
    renderSkills();
  }

  function renderSkills() {
    const grid = document.getElementById('skills-grid');
    if (!grid) return;
    const skills = Object.values(A.skills.all);
    grid.innerHTML = skills
      .slice(0, 14)
      .map(
        (s) => `<button class="chip ${s.network ? 'offline' : ''}" data-skill="${esc(s.id)}" title="${esc(s.description)}">
          ${icon(s.icon || 'spark')} ${esc(s.title)}${s.network ? ' ·net' : ''}
        </button>`
      )
      .join('');
    grid.querySelectorAll('[data-skill]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skill = A.skills.all[btn.getAttribute('data-skill')];
        const wrap = el('div');
        wrap.innerHTML = `<div class="card" style="padding:13px">
            <div style="font-weight:650">${esc(skill.title)}</div>
            <div class="small muted" style="margin-top:5px">${esc(skill.description)}</div>
            <div class="small muted" style="margin-top:8px">${skill.network ? 'Needs internet' : 'Works offline'} · ${skill.mutates ? 'changes data' : 'read-only'}</div>
          </div>
          <div class="field"><label>Try it with input (JSON)</label>
            <textarea class="input" id="skill-input" rows="3">${esc(JSON.stringify(Object.fromEntries(Object.keys(skill.params).map((k) => [k, ''])), null, 2))}</textarea>
          </div>
          <button class="btn btn-primary btn-block" id="skill-run">${icon('play')} Run skill</button>
          <pre id="skill-out" class="mono" style="margin-top:12px;white-space:pre-wrap;max-height:220px;overflow:auto"></pre>`;
        openSheet(skill.title, wrap);
        wrap.querySelector('#skill-run').addEventListener('click', async () => {
          const out = wrap.querySelector('#skill-out');
          let input = {};
          try {
            input = JSON.parse(wrap.querySelector('#skill-input').value || '{}');
          } catch (_) {
            out.textContent = 'Input must be valid JSON';
            return;
          }
          out.textContent = 'Running…';
          try {
            const res = await A.skills.run(skill.id, input);
            out.textContent = JSON.stringify(res, null, 2);
          } catch (err) {
            out.textContent = 'Error: ' + err.message;
          }
        });
      });
    });
  }

  A.screens = A.screens || {};
  A.screens.agent = { mount, render, load, renderSkills };
})();
