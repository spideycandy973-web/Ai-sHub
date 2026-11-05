/* ════════════════════════════════════════════════════════════════
   Ai'sHub · chat controller
   Owns the conversation state machine: send → stream → persist,
   stop, regenerate, edit, copy, feedback, attachments, agent runs.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { $, el, icon, toast } = A.ui;
  const esc = A.util.escapeHtml;

  const state = {
    chatId: null,
    messages: [],
    busy: false,
    abort: null,
    mode: 'chat',
    draftAttachments: [],
    task: null,
  };

  const dom = {};
  function cache() {
    dom.scroll = $('#chat-scroll');
    dom.inner = $('#chat-inner');
    dom.messages = $('#messages');
    dom.welcome = $('#welcome');
    dom.input = $('#input');
    dom.send = $('#btn-send');
    dom.composer = $('#composer');
    dom.hint = $('#composer-hint');
    dom.modeSwitch = $('#mode-switch');
    dom.scrollDown = $('#btn-scroll-down');
  }

  const nearBottom = () => {
    const s = dom.scroll;
    return s.scrollHeight - s.scrollTop - s.clientHeight < 120;
  };
  function scrollToBottom(smooth = true) {
    const target = dom.scroll;
    if (!target) return;
    if (typeof target.scrollTo === 'function') {
      try {
        target.scrollTo({ top: target.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
        return;
      } catch (_) { /* fall through to plain assignment */ }
    }
    target.scrollTop = target.scrollHeight;
  }

  /* ─────────────── chat lifecycle ─────────────── */
  async function openChat(chatId) {
    stop();
    const chat = chatId ? A.chatStore.get(chatId) : null;
    state.chatId = chat ? chat.id : null;
    state.messages = chat ? await A.chatStore.messages(chat.id) : [];
    state.mode = chat?.mode || A.settings.get('mode') || 'chat';
    A.settings.set('lastChatId', state.chatId, { silent: true });
    syncModeUI();
    renderAll();
    A.bus.emit('chat:opened', state.chatId);
  }

  async function newChat({ silent = false } = {}) {
    stop();
    state.chatId = null;
    state.messages = [];
    state.draftAttachments = [];
    A.settings.set('lastChatId', null, { silent: true });
    renderAll();
    updateComposerHint();
    if (!silent) dom.input.focus();
    A.bus.emit('chat:opened', null);
  }

  function ensureChat() {
    if (state.chatId) return state.chatId;
    const chat = A.chatStore.create({
      model: A.settings.get('selectedModel'),
      mode: state.mode,
    });
    state.chatId = chat.id;
    A.settings.set('lastChatId', chat.id, { silent: true });
    A.bus.emit('chat:opened', chat.id);
    return chat.id;
  }

  /* ─────────────── rendering ─────────────── */
  function aiAvatar() {
    return `<span class="ai-avatar">${icon('spark')}</span>`;
  }

  function renderAll() {
    dom.messages.innerHTML = '';
    dom.welcome.innerHTML = '';
    if (!state.messages.length) {
      renderWelcome();
    } else {
      dom.welcome.hidden = true;
      for (const m of state.messages) dom.messages.appendChild(messageNode(m));
      A.markdown.bindCopy(dom.messages);
      requestAnimationFrame(() => scrollToBottom(false));
    }
    updateComposerHint();
  }

  function renderWelcome() {
    dom.welcome.hidden = false;
    const model = A.ai.resolveSelected();
    const online = A.net.online;
    const localOnly = A.ai.isLocal(model);
    const ready = A.ai.readiness(model);
    const modelLabel = model ? model.name : 'Local engine';
    const pills = [
      `<span class="status-pill ${localOnly ? 'off' : online ? '' : 'warn'}"><i></i>${localOnly ? 'On-device engine' : online ? modelLabel : 'Offline mode'}</span>`,
      `<span class="status-pill"><i></i>${A.catalog.all().length} models</span>`,
      `<span class="status-pill ${ready.ready ? '' : 'warn'}"><i></i>${ready.ready ? 'Ready' : 'Needs key'}</span>`,
    ];
    const suggestions = [
      { icon: 'note', t: 'Draft a message', s: 'An email that actually gets replied to', prompt: 'Write a short, polite email to my landlord asking to fix the water heater this week.' },
      { icon: 'code', t: 'Fix my code', s: 'Explain an error and patch it', prompt: 'My React component re-renders infinitely. Explain why and show the fix.' },
      { icon: 'book', t: 'Explain something', s: 'Science, maths, ideas', prompt: 'Explain photosynthesis like I am 15, with the equation.' },
      { icon: 'calc', t: 'Do the numbers', s: 'Exact maths, offline', prompt: '15% of 240 plus 36, then convert 12 km to miles' },
      { icon: 'route', t: 'Run an agent', s: 'One goal, many steps', prompt: 'agent: plan a 3-day Dhaka trip under 15000 taka and save it as a note', agent: true },
      { icon: 'shuffle', t: 'Translate', s: 'Into Bengali or any language', prompt: 'Translate "Where is the nearest pharmacy?" to Bengali.' },
    ];
    dom.welcome.innerHTML = `
      <div class="welcome-hero">
        <div class="welcome-mark">${icon('spark')}</div>
        <div>
          <h1>Hi, I'm Ai'sHub</h1>
          <p>Your own AI — free, unlimited, and it works offline.</p>
        </div>
      </div>
      <div class="welcome-status">${pills.join('')}</div>
      <div class="section-label">Start with</div>
      <div class="suggestions">
        ${suggestions
          .map(
            (s, i) => `<button class="suggestion" data-prompt="${esc(s.prompt)}" data-agent="${s.agent ? '1' : ''}">
              <span class="sg-ico">${icon(s.icon === 'shuffle' ? 'translate' : s.icon)}</span>
              <span class="sg-t">${esc(s.t)}</span>
              <span class="sg-s">${esc(s.s)}</span>
            </button>`
          )
          .join('')}
      </div>
      <div class="section-label">How Ai'sHub works</div>
      <div class="card" style="padding:14px">
        <div class="vstack" style="gap:12px">
          <div class="hstack"><span class="sg-ico" style="width:28px;height:28px;border-radius:9px;background:rgba(34,211,238,.14);color:#67e8f9;display:grid;place-items:center">${icon('bolt')}</span>
            <div><div style="font-size:13px;font-weight:650">On-device engine</div><div class="small muted">No key, no network, no limits — answers right now.</div></div></div>
          <div class="hstack"><span class="sg-ico" style="width:28px;height:28px;border-radius:9px;background:rgba(124,92,255,.16);color:#c4b5fd;display:grid;place-items:center">${icon('layers')}</span>
            <div><div style="font-size:13px;font-weight:650">${A.catalog.all().length} models, auto-updated</div><div class="small muted">Free keyless models work immediately. Add a free key for more.</div></div></div>
          <div class="hstack"><span class="sg-ico" style="width:28px;height:28px;border-radius:9px;background:rgba(255,122,182,.14);color:#f9a8d4;display:grid;place-items:center">${icon('shield')}</span>
            <div><div style="font-size:13px;font-weight:650">Private by default</div><div class="small muted">Chats and keys stay on this device.</div></div></div>
        </div>
      </div>`;

    dom.welcome.querySelectorAll('.suggestion').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        const wantAgent = btn.getAttribute('data-agent') === '1';
        if (wantAgent) {
          setMode('agent');
          const clean = prompt.replace(/^agent:\s*/i, '');
          dom.input.value = clean;
          autosize();
          A.ui.toast('Agent mode on — press send', '', 1800);
          dom.input.focus();
        } else {
          dom.input.value = prompt;
          autosize();
          dom.input.focus();
        }
      });
    });
    A.markdown.bindCopy(dom.welcome);
  }

  function traceNode(trace) {
    const wrap = el('div', { class: 'trace' });
    const head = el('button', { class: 'trace-head' });
    head.innerHTML = `${icon('route')}<span>Agent run</span><span class="badge">${trace.steps.length}</span>`;
    const body = el('div', { class: 'trace-steps' });
    wrap.append(head, body);
    head.addEventListener('click', () => (body.hidden = !body.hidden));
    const refresh = () => {
      body.innerHTML = trace.steps
        .map((s) => {
          const ico = s.state === 'ok' ? 'check' : s.state === 'error' ? 'warn' : s.state === 'skipped' ? 'stop' : 'dots';
          const detail = s.state === 'ok' ? JSON.stringify(s.output).slice(0, 220) : s.state === 'error' ? s.output : s.why || '';
          return `<div class="trace-step ${s.state === 'ok' ? 'ok' : s.state === 'error' ? 'err' : s.state === 'running' ? 'running' : ''}">
            <span class="ts-ico">${icon(ico)}</span>
            <div class="ts-body"><div class="ts-title">${esc(s.skill)}${s.why ? ` · <span style="font-weight:500;color:var(--text-3)">${esc(s.why)}</span>` : ''}</div>
            ${detail ? `<div class="ts-detail">${esc(String(detail))}</div>` : ''}</div></div>`;
        })
        .join('');
      head.querySelector('.badge').textContent = String(trace.steps.length);
    };
    refresh();
    return { node: wrap, refresh };
  }

  function messageNode(m) {
    if (m.role === 'user') {
      const wrap = el('div', { class: 'msg msg-user' });
      const bubble = el('div', { class: 'bubble' });
      bubble.textContent = m.content;
      wrap.appendChild(bubble);
      if (m.attachments && m.attachments.length) {
        const chips = el('div', { class: 'hstack', style: 'flex-wrap:wrap;gap:6px;justify-content:flex-end;margin-top:2px' });
        m.attachments.forEach((a) => {
          if (a.kind === 'image') {
            const img = el('img', { src: a.data, style: 'max-width:180px;border-radius:12px;border:1px solid var(--line)' });
            chips.appendChild(img);
          } else {
            chips.appendChild(el('span', { class: 'chip' }, esc(a.name)));
          }
        });
        wrap.appendChild(chips);
      }
      const meta = el('div', { class: 'msg-meta' }, `<span>${A.util.fmtTime(m.ts)}</span><span class="dot"></span><span>You</span>`);
      wrap.appendChild(meta);
      return wrap;
    }

    const wrap = el('div', { class: 'msg msg-ai' });
    wrap.dataset.id = m.id;
    const modelLabel = m.fallbackFrom ? `${m.modelName || m.model} · auto-switched` : m.modelName || m.model || 'Ai\'sHub';
    const head = el('div', { class: 'ai-head' }, `${aiAvatar()}<span class="ai-name">Ai'sHub</span><span class="ai-model">${esc(A.util.truncate(modelLabel.split(':').pop(), 34))}</span>`);
    const bodyWrap = el('div', { class: 'ai-body' });
    if (m.trace && m.trace.steps && m.trace.steps.length) {
      const t = traceNode(m.trace);
      bodyWrap.appendChild(t.node);
    }
    const prose = el('div', { class: 'prose' });
    prose.innerHTML = A.markdown.render(m.content || '');
    bodyWrap.appendChild(prose);

    if (m.error) {
      const errBox = el('div', { class: 'error-bubble', style: 'margin-top:10px' });
      errBox.innerHTML = `${icon('warn')}<div>${esc(m.error)}${m.errorAction ? `<a href="#" class="fix-link" data-action="${esc(m.errorAction)}">${esc(m.errorActionLabel || 'Fix this')}</a>` : ''}</div>`;
      bodyWrap.appendChild(errBox);
    }
    wrap.append(head, bodyWrap);

    // actions
    const actions = el('div', { class: 'msg-actions' });
    const mk = (iconName, label, handler, on) => {
      const b = el('button', { class: 'act' + (on ? ' is-on' : '') }, `${icon(iconName)}<span>${label}</span>`);
      b.addEventListener('click', handler);
      return b;
    };
    actions.appendChild(mk('copy', 'Copy', async () => {
      const ok = await A.util.copyText(m.content || '');
      toast(ok ? 'Copied' : 'Copy failed', ok ? 'ok' : 'err', 1400);
    }));
    actions.appendChild(mk('refresh', 'Retry', () => regenerate(m.id)));
    actions.appendChild(mk('pencil', 'Edit', () => editLast(m.id)));
    actions.appendChild(mk('trash', '', () => deleteFrom(m.id)));
    if (m.role === 'assistant') {
      actions.appendChild(mk('thumbUp', '', () => {
        A.store.KV.set('feedback:' + m.id, 'up');
        toast('Thanks — noted locally', 'ok', 1500);
      }, A.store.KV.get('feedback:' + m.id) === 'up'));
      actions.appendChild(mk('share', 'Export', () => exportChatMarkdown()));
    }
    if (m.usage && (m.usage.total_tokens || m.ms)) {
      actions.appendChild(el('span', { class: 'stats' }, m.ms ? `${(m.ms / 1000).toFixed(1)}s${m.usage?.total_tokens ? ` · ${m.usage.total_tokens} tok` : ''}` : `${m.usage.total_tokens} tok`));
    }
    wrap.appendChild(actions);
    return wrap;
  }

  function updateComposerHint() {
    const model = A.ai.resolveSelected();
    const ready = A.ai.readiness(model);
    const provider = model ? A.catalog.providerById(model.provider) : null;
    if (state.mode === 'agent') {
      dom.hint.innerHTML = `Agent mode · ${A.settings.get('agentApproval') === 'auto' ? 'runs steps automatically' : 'asks before saving anything'} · <span class="warn">max ${A.settings.get('agentMaxSteps')} steps</span>`;
      return;
    }
    if (!A.net.online) {
      dom.hint.innerHTML = `<span class="warn">Offline</span> · answering with the on-device engine`;
    } else if (!ready.ready) {
      dom.hint.innerHTML = `<span class="warn">${esc(ready.reason)}</span>`;
    } else {
      dom.hint.textContent = `${provider ? provider.name + ' · ' : ''}${model?.name || 'Local engine'}${model?.free ? ' · free' : ''}`;
    }
  }

  /* ─────────────── sending ─────────────── */
  function autosize() {
    const t = dom.input;
    t.style.height = 'auto';
    t.style.height = Math.min(148, t.scrollHeight) + 'px';
  }

  function setBusy(busy) {
    state.busy = busy;
    dom.composer.classList.toggle('is-busy', busy);
  }

  function stop() {
    if (state.abort) {
      try {
        state.abort.abort(new DOMException('Stopped by user', 'AbortError'));
      } catch (_) {
        state.abort.abort();
      }
      state.abort = null;
    }
    setBusy(false);
  }

  async function send(rawText) {
    const text = (rawText !== undefined ? rawText : dom.input.value).trim();
    if (!text || state.busy) return;
    const mode = state.mode;
    A.app.haptic?.(9);
    dom.input.value = '';
    autosize();

    ensureChat();
    const userMsg = { role: 'user', content: text, ts: Date.now(), attachments: state.draftAttachments };
    state.draftAttachments = [];
    state.messages.push(userMsg);

    // Paint the user's message BEFORE touching storage. Persisting through a
    // wedged IndexedDB used to happen first, so the text vanished and nothing
    // on screen ever changed — the app looked frozen and "not responding".
    dom.welcome.hidden = true;
    dom.messages.appendChild(messageNode(userMsg));
    scrollToBottom();
    updateComposerHint();
    await A.chatStore.append(state.chatId, userMsg).catch((err) => {
      console.warn('[chat] could not persist message', err);
    });

    if (mode === 'agent') return runAgentTurn(text);

    // ── normal chat turn ──
    setBusy(true);
    state.abort = new AbortController();
    const model = A.ai.resolveSelected();
    const started = Date.now();

    const placeholder = { id: A.util.uid('m_'), role: 'assistant', content: '', ts: Date.now(), model: model ? A.catalog.keyFor(model) : 'local', modelName: model?.name, streaming: true };
    const node = messageNode(placeholder);
    const prose = node.querySelector('.prose');
    prose.innerHTML = `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span>${A.ai.isLocal(model) ? 'Thinking on-device…' : 'Thinking with ' + esc(model?.name || 'model') + '…'}</span></div>`;
    dom.messages.appendChild(node);
    scrollToBottom();

    let full = '';
    const deltas = [];
    let renderQueued = false;
    const paint = () => {
      renderQueued = false;
      prose.innerHTML = A.markdown.render(full) + '<span class="stream-caret"></span>';
      if (nearBottom()) scrollToBottom(false);
    };

    try {
      const supportsVision = Boolean(model && model.vision);
      const history = state.messages
        .filter((m) => !m.error)
        .map((m) => {
          const images = (m.attachments || []).filter((a) => a.kind === 'image');
          if (m.role === 'user' && supportsVision && images.length) {
            return {
              role: 'user',
              content: [
                { type: 'text', text: m.content || 'What is in this image?' },
                ...images.map((a) => ({ type: 'image_url', image_url: { url: a.data } })),
              ],
            };
          }
          return { role: m.role, content: m.content };
        })
        .slice(-24);
      const droppedImages = !supportsVision && state.messages.slice(-1)[0]?.attachments?.some((a) => a.kind === 'image');
      if (droppedImages) {
        toast(`${model?.name || 'This model'} cannot see images — answer uses text only`, '', 3200);
        history[history.length - 1] = {
          role: 'user',
          content: (state.messages.slice(-1)[0].content || '') + '\n\n(An image was attached but this model cannot view images.)',
        };
      }

      const res = await A.ai.chat({
        messages: history,
        model,
        signal: state.abort.signal,
        onDelta: (delta, whole) => {
          full = whole;
          if (!renderQueued) {
            renderQueued = true;
            requestAnimationFrame(paint);
          }
        },
        onFallback: ({ to, reason }) => {
          toast(`${model?.name || 'Model'} unavailable → switched to ${to.name}`, '', 3000);
          deltas.push(reason);
        },
      });

      full = (res.text || full || '').trim();
      const saved = {
        ...placeholder,
        content: full,
        model: res.provider === 'local' ? res.model : A.catalog.keyFor({ provider: res.provider, id: res.model }),
        modelName: A.catalog.find(A.catalog.keyFor({ provider: res.provider, id: res.model }))?.name || res.model,
        usage: res.usage,
        ms: Date.now() - started,
        usedFallback: res.usedFallback,
        fallbackFrom: res.fallbackFrom ? A.catalog.keyFor(res.fallbackFrom) : null,
        streaming: false,
      };
      state.messages.push(saved);
      await A.chatStore.append(state.chatId, saved);
      const fresh = messageNode(saved);
      node.replaceWith(fresh);
      A.markdown.bindCopy(fresh);
      if (nearBottom()) scrollToBottom();
    } catch (err) {
      const aborted = err.name === 'AbortError' || state.abort?.signal.aborted;
      if (aborted) {
        if (full.trim()) {
          const saved = { ...placeholder, content: full.trim() + '\n\n_(stopped)_', streaming: false, ms: Date.now() - started };
          state.messages.push(saved);
          await A.chatStore.append(state.chatId, saved);
          node.replaceWith(messageNode(saved));
        } else {
          node.remove();
        }
      } else {
        const message = A.net.friendlyMessage(err, A.catalog.providerName(model?.provider));
        const errorMsg = {
          ...placeholder,
          content: '',
          error: message,
          errorAction: !A.ai.isLocal(model) && !A.settings.hasKey(model.provider) ? 'models' : A.net.online ? '' : '',
          errorActionLabel: 'Open Models',
          streaming: false,
        };
        state.messages.push(errorMsg);
        await A.chatStore.append(state.chatId, errorMsg);
        const fresh = messageNode(errorMsg);
        node.replaceWith(fresh);
        fresh.querySelector('.fix-link')?.addEventListener('click', (e) => {
          e.preventDefault();
          A.app.go('models');
        });
      }
    } finally {
      setBusy(false);
      state.abort = null;
      autosize();
      updateComposerHint();
    }
  }

  /* ─────────────── agent turn ─────────────── */
  async function runAgentTurn(goal) {
    setBusy(true);
    state.abort = new AbortController();
    const started = Date.now();
    const model = A.ai.resolveSelected();
    const placeholder = {
      id: A.util.uid('m_'),
      role: 'assistant',
      content: '',
      ts: Date.now(),
      model: A.catalog.keyFor(model),
      modelName: model?.name,
      trace: { steps: [], plan: [] },
      streaming: true,
    };
    const node = messageNode(placeholder);
    const bodyWrap = node.querySelector('.ai-body');
    const prose = node.querySelector('.prose');
    const trace = traceNode(placeholder.trace);
    bodyWrap.insertBefore(trace.node, prose);
    prose.innerHTML = `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span>Planning…</span></div>`;
    dom.messages.appendChild(node);
    scrollToBottom();

    let approved = true;
    try {
      const task = await A.agent.run(goal, {
        signal: state.abort.signal,
        onPlan: (p) => {
          placeholder.trace.plan = p.plan;
          prose.innerHTML = `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span>${p.source === 'cloud' ? 'Planned with ' + esc(model?.name || 'model') : 'Planned on-device'} · ${p.steps.length} steps</span></div>`;
        },
        onStep: (step, kind) => {
          const idx = placeholder.trace.steps.findIndex((s) => s.skill === step.skill && s.n === step.n);
          const record = { ...step, state: kind === 'start' ? 'running' : kind === 'ok' ? 'ok' : kind === 'err' ? 'error' : 'skipped' };
          if (idx >= 0) placeholder.trace.steps[idx] = record;
          else placeholder.trace.steps.push(record);
          trace.refresh();
          if (kind === 'start') prose.innerHTML = `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span>Running ${esc(step.skill)}…</span></div>`;
          if (nearBottom()) scrollToBottom(false);
        },
        approve: async (step) => {
          setBusy(false);
          const ok = await A.ui.approveStep(step);
          setBusy(true);
          approved = approved && ok;
          return ok;
        },
      });

      placeholder.content = task.result;
      placeholder.trace = { steps: task.steps, plan: task.plan, source: task.source };
      placeholder.ms = Date.now() - started;
      placeholder.streaming = false;
      state.messages.push(placeholder);
      await A.chatStore.append(state.chatId, placeholder);
      const fresh = messageNode(placeholder);
      node.replaceWith(fresh);
      A.markdown.bindCopy(fresh);
      A.bus.emit('tasks:changed');
      if (nearBottom()) scrollToBottom();
    } catch (err) {
      if (err.name === 'AbortError' || state.abort?.signal.aborted) {
        placeholder.content = '_(agent stopped)_';
      } else {
        placeholder.error = A.net.friendlyMessage(err);
        placeholder.content = '';
      }
      placeholder.streaming = false;
      state.messages.push(placeholder);
      await A.chatStore.append(state.chatId, placeholder);
      node.replaceWith(messageNode(placeholder));
    } finally {
      setBusy(false);
      state.abort = null;
      updateComposerHint();
    }
  }

  /* ─────────────── message actions ─────────────── */
  async function regenerate(messageId) {
    if (state.busy) return;
    const idx = state.messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    // find the user message before it
    let userIdx = idx - 1;
    while (userIdx >= 0 && state.messages[userIdx].role !== 'user') userIdx--;
    if (userIdx < 0) return;
    const userText = state.messages[userIdx].content;
    // drop everything after the user message and resend
    const dropped = state.messages.splice(userIdx + 1);
    for (const d of dropped) {
      await A.chatStore.deleteFrom(state.chatId, d.ts);
      const node = dom.messages.querySelector(`.msg-ai[data-id="${d.id}"]`);
      if (node) node.remove();
    }
    dom.input.value = '';
    await send(userText);
  }

  async function editLast(messageId) {
    const idx = state.messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    // walk back to the user message that produced this answer
    let userIdx = idx;
    while (userIdx >= 0 && state.messages[userIdx].role !== 'user') userIdx--;
    const target = state.messages[userIdx >= 0 ? userIdx : idx];
    if (!target || target.role !== 'user') return;
    dom.input.value = target.content;
    autosize();
    dom.input.focus();
    state.messages = state.messages.slice(0, userIdx);
    if (state.chatId) A.chatStore.deleteFrom(state.chatId, target.ts);
    renderAll();
    toast('Editing — press send to resend', '', 1800);
  }

  async function deleteFrom(messageId) {
    if (state.busy) return;
    const target = state.messages.find((m) => m.id === messageId);
    if (!target) return;
    const ok = await A.ui.confirmDialog('Delete from here?', 'This message and everything after it will be removed.', { okLabel: 'Delete', danger: true });
    if (!ok) return;
    state.messages = state.messages.filter((m) => m.ts < target.ts);
    if (state.chatId) await A.chatStore.deleteFrom(state.chatId, target.ts);
    renderAll();
    toast('Deleted', '', 1500);
  }

  function exportChatMarkdown() {
    if (!state.chatId) return;
    const chat = A.chatStore.get(state.chatId) || { title: 'Chat', created: Date.now() };
    const md = A.chatStore.toMarkdown(chat, state.messages);
    A.util.download(`${A.util.slugify(chat.title)}.md`, md, 'text/markdown;charset=utf-8');
    toast('Chat exported', 'ok');
  }

  /* ─────────────── mode ─────────────── */
  function setMode(mode) {
    state.mode = mode;
    A.settings.set('mode', mode);
    if (state.chatId) A.chatStore.touch(state.chatId, { mode });
    syncModeUI();
    updateComposerHint();
  }

  function syncModeUI() {
    A.ui.$$('.mode-tab', dom.modeSwitch).forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === state.mode);
    });
    dom.input.placeholder = state.mode === 'agent'
      ? 'Describe the goal — I will plan and run it…'
      : 'Ask anything…';
  }

  /* ─────────────── attachments ─────────────── */
  async function attachFile(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast('File too large (max 4 MB)', 'err');
      return;
    }
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const data = await A.util.readFileAsDataUrl(file);
      state.draftAttachments.push({ kind: 'image', name: file.name, data });
      toast('Image attached — ask about it', 'ok');
    } else {
      let text = '';
      try {
        text = await A.util.readFileAsText(file);
      } catch (_) {
        toast('Could not read that file', 'err');
        return;
      }
      if (text.length > 20000) text = text.slice(0, 20000) + '\n…(truncated)';
      state.draftAttachments.push({ kind: 'text', name: file.name, text });
      dom.input.value = `${dom.input.value}${dom.input.value ? '\n\n' : ''}File "${file.name}":\n${text}`.slice(0, 26000);
      autosize();
      toast('File contents added to the message', 'ok');
    }
    updateComposerHint();
  }

  A.chat = {
    state,
    cache,
    openChat,
    newChat,
    send,
    stop,
    setMode,
    renderAll,
    scrollToBottom,
    autosize,
    attachFile,
    exportChatMarkdown,
    deleteFrom,
    updateComposerHint,
    ensureChat,
  };
})();
