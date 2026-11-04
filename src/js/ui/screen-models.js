/* ════════════════════════════════════════════════════════════════
   Ai'sHub · Models screen
   Live catalog (presets + discovered + custom), filters, search,
   provider key management, model picker sheet, sync.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { $, el, icon, toast, openSheet, closeSheet } = A.ui;
  const esc = A.util.escapeHtml;

  const ui = { filter: 'all', query: '', syncing: false };

  const badge = (m) => {
    const flags = [];
    if (m.offline) flags.push('<span class="model-flag offline">offline</span>');
    else if (m.free) flags.push('<span class="model-flag free">free</span>');
    return flags.join('');
  };

  const ctxLabel = (ctx) => (ctx >= 1e6 ? (ctx / 1e6).toFixed(1) + 'M' : ctx >= 1000 ? Math.round(ctx / 1000) + 'k' : ctx ? String(ctx) : '—');

  function providerInitials(providerId) {
    const p = A.catalog.providerById(providerId);
    return p ? p.initials : providerId.slice(0, 2).toUpperCase();
  }

  function matches(m) {
    if (ui.query) {
      const q = ui.query.toLowerCase();
      const pname = A.catalog.providerName(m.provider).toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q) && !pname.includes(q)) return false;
    }
    switch (ui.filter) {
      case 'free': return m.free;
      case 'offline': return m.offline;
      case 'vision': return m.vision;
      case 'tools': return m.tools;
      default: return true;
    }
  }

  function render() {
    const wrap = $('#models-list');
    const all = A.catalog.all();
    const selectedKey = A.settings.get('selectedModel');
    $('#models-count').textContent = String(all.length);
    const newKeys = A.discovery.newBadgeKeys();
    const visible = all.filter(matches);

    if (!visible.length) {
      wrap.innerHTML = `<div class="empty-state">${icon('layers')}<p>No models match that filter.<br/>Try “All”, or sync to pull fresh lists.</p></div>`;
      return;
    }

    // group: local → keyless → connected → needs key → custom
    const groups = [
      { id: 'local', label: 'On-device · works offline', test: (m) => m.provider === 'local' },
      { id: 'keyless', label: 'Free · no key needed', test: (m) => { const p = A.catalog.providerById(m.provider); return p && p.keyless && !p.local; } },
      { id: 'connected', label: 'Connected providers', test: (m) => A.settings.hasKey(m.provider) },
      { id: 'available', label: 'Add a free key to unlock', test: (m) => { const p = A.catalog.providerById(m.provider); return p && !p.keyless && !p.local && !A.settings.hasKey(m.provider); } },
    ];

    const seen = new Set();
    let html = '';
    for (const g of groups) {
      const list = visible.filter((m) => !seen.has(A.catalog.keyFor(m)) && g.test(m));
      list.forEach((m) => seen.add(A.catalog.keyFor(m)));
      if (!list.length) continue;
      html += `<div class="model-group-head">${esc(g.label)}<span class="badge">${list.length}</span></div>`;
      html += list
        .map((m) => {
          const key = A.catalog.keyFor(m);
          const isSel = key === selectedKey;
          const isNew = newKeys.has(key) && m.source !== 'preset';
          return `<button class="model-row ${isSel ? 'is-selected' : ''}" data-model="${esc(key)}">
            <span class="model-logo ${m.offline ? 'local' : ''}">${esc(providerInitials(m.provider))}</span>
            <span class="model-main">
              <span class="model-name">${esc(m.name)}${isNew ? '<span class="tag">NEW</span>' : ''}</span>
              <span class="model-sub">
                <span>${esc(A.catalog.providerName(m.provider))}</span>
                ${m.ctx ? `<span class="sep">·</span><span>${ctxLabel(m.ctx)} ctx</span>` : ''}
                ${m.vision ? '<span class="sep">·</span><span>vision</span>' : ''}
                ${m.tools ? '<span class="sep">·</span><span>tools</span>' : ''}
                ${m.reasoning ? '<span class="sep">·</span><span>reasoning</span>' : ''}
                ${badge(m)}
              </span>
            </span>
            ${isSel ? `<span class="model-check">${icon('check')}</span>` : ''}
          </button>`;
        })
        .join('');
    }
    // leftovers (shouldn't happen, but never hide a model)
    const leftovers = visible.filter((m) => !seen.has(A.catalog.keyFor(m)));
    if (leftovers.length) {
      html += `<div class="model-group-head">More<span class="badge">${leftovers.length}</span></div>`;
      html += leftovers.map((m) => `<button class="model-row" data-model="${esc(A.catalog.keyFor(m))}"><span class="model-logo">${esc(providerInitials(m.provider))}</span><span class="model-main"><span class="model-name">${esc(m.name)}</span><span class="model-sub">${esc(A.catalog.providerName(m.provider))}</span></span></button>`).join('');
    }

    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-model]').forEach((btn) => {
      btn.addEventListener('click', () => selectModel(btn.getAttribute('data-model')));
    });
  }

  function selectModel(key) {
    const model = A.catalog.find(key);
    if (!model) return;
    const ready = A.ai.readiness(model);
    A.settings.set('selectedModel', key);
    A.bus.emit('model:changed', model);
    A.app.updateModelChip();
    A.chat.updateComposerHint();
    render();
    if (ready.ready) {
      toast(`${model.name} selected`, 'ok', 1600);
    } else if (ready.needsKey) {
      const provider = A.catalog.providerById(ready.needsKey);
      askProviderKey(provider).then((saved) => {
        if (saved) {
          toast('Key saved — syncing models', 'ok');
          syncModels({ force: true });
        }
        A.app.updateModelChip();
        A.chat.updateComposerHint();
        render();
      });
    } else {
      toast(ready.reason, '', 2600);
    }
    if (A.ui.isSheetOpen()) closeSheet();
  }

  /* ─────────────── provider key sheet ─────────────── */
  function providerRow(provider) {
    const connected = provider.keyless || A.settings.hasKey(provider.id);
    const row = el('button', { class: 'provider-row', style: 'width:100%;text-align:left' });
    row.innerHTML = `
      <span class="model-logo" style="background:${provider.accent}22;color:${provider.accent}">${esc(provider.initials)}</span>
      <span class="pv-main">
        <span class="pv-name">${esc(provider.name)}</span>
        <span class="pv-sub">${esc(provider.note || (provider.keyless ? 'No key needed' : 'OpenAI-compatible'))}</span>
      </span>
      <span class="pv-state ${connected ? 'ok' : 'no'}">${connected ? (provider.keyless ? 'ready' : 'key set') : 'add key'}</span>`;
    row.addEventListener('click', () => {
      if (provider.local) return toast('This one runs on your device — always ready', '', 1800);
      if (provider.id === 'custom') return customModelDialog();
      askProviderKey(provider).then((saved) => {
        if (saved) {
          syncModels({ force: true });
          render();
        }
        A.app.updateModelChip();
        A.chat.updateComposerHint();
      });
    });
    return row;
  }

  function askProviderKey(provider) {
    return new Promise((resolve) => {
      const wrap = el('div');
      const has = A.settings.hasKey(provider.id);
      const override = A.settings.get('providerOverrides')[provider.id] || {};
      wrap.innerHTML = `
        <div class="hstack" style="margin-bottom:14px">
          <span class="model-logo" style="width:42px;height:42px;background:${provider.accent}22;color:${provider.accent}">${esc(provider.initials)}</span>
          <div><div style="font-weight:700">${esc(provider.name)}</div><div class="small muted">${esc(provider.note || 'OpenAI-compatible API')}</div></div>
        </div>
        ${provider.keyless ? `<div class="card" style="padding:12px;margin-bottom:14px"><div class="small">This provider needs <strong>no key</strong>. Free models work right away — nothing to configure.</div></div>` : ''}
        ${provider.keysUrl ? `<a class="btn btn-ghost btn-block" style="margin-bottom:14px" href="${esc(provider.keysUrl)}" target="_blank" rel="noopener">${icon('key')} Get a free key</a>` : ''}
        <div class="field">
          <label>API key</label>
          <input class="input" id="pk" type="password" autocomplete="off" spellcheck="false" placeholder="${has ? '•••••••••••• (saved)' : 'paste your key'}" />
          <div class="hint">Stored only on this device. Sent directly to ${esc(provider.name)} — never to Ai'sHub servers (there are none).</div>
        </div>
        ${provider.lanes ? `<div class="field"><label>Account ID</label><input class="input" id="pk-account" value="${esc(override.account || A.store.KV.get('cf:account', ''))}" placeholder="Cloudflare account id" /></div>` : ''}
        <div class="field">
          <label>Base URL ${provider.baseUrl ? '(optional override)' : ''}</label>
          <input class="input" id="pk-url" value="${esc(override.baseUrl || '')}" placeholder="${esc(provider.baseUrl || 'https://api.example.com/v1')}" />
        </div>
        <div class="hstack" style="margin-top:16px;gap:8px">
          ${has ? `<button class="btn btn-danger btn-sm" id="pk-clear">Remove</button>` : ''}
          <div class="spacer"></div>
          <button class="btn btn-ghost" id="pk-cancel">Cancel</button>
          <button class="btn btn-primary" id="pk-save">Save &amp; test</button>
        </div>
        <div id="pk-status" class="small" style="margin-top:12px"></div>`;

      openSheet(`${provider.name}`, wrap);
      const status = wrap.querySelector('#pk-status');
      wrap.querySelector('#pk-cancel').addEventListener('click', () => {
        closeSheet();
        resolve(false);
      });
      wrap.querySelector('#pk-clear')?.addEventListener('click', () => {
        A.settings.setKey(provider.id, '');
        toast('Key removed', '', 1600);
        closeSheet();
        resolve(false);
        render();
      });
      wrap.querySelector('#pk-save').addEventListener('click', async () => {
        const key = wrap.querySelector('#pk').value.trim();
        const url = wrap.querySelector('#pk-url').value.trim();
        const account = wrap.querySelector('#pk-account')?.value.trim();
        if (account !== undefined) A.store.KV.set('cf:account', account);
        if (url) A.settings.get('providerOverrides')[provider.id] = { ...(A.settings.get('providerOverrides')[provider.id] || {}), baseUrl: url, account };
        A.settings.set('providerOverrides', A.settings.get('providerOverrides'));
        if (key) A.settings.setKey(provider.id, key);
        status.innerHTML = '<span class="muted">Testing…</span>';
        const res = await A.providerClient.check(provider);
        status.innerHTML = res.ok
          ? '<span style="color:var(--ok)">Connected ✓</span>'
          : `<span style="color:var(--err)">${esc(res.message)}</span>`;
        if (res.ok) {
          toast(`${provider.name} connected`, 'ok');
          setTimeout(() => closeSheet(), 600);
          resolve(true);
        } else if (key) {
          resolve(true); // keep the key even if the test failed (CORS / rate limits)
        }
      });
    });
  }

  function providerSheet() {
    const wrap = el('div');
    wrap.innerHTML = `<div class="setting-group"><h3>Free, no key</h3><div id="pg-free"></div></div>
      <div class="setting-group"><h3>Add your own free key</h3><div id="pg-key"></div></div>
      <div class="setting-group"><h3>Your own server</h3><div id="pg-self"></div></div>`;
    const free = wrap.querySelector('#pg-free');
    const keyed = wrap.querySelector('#pg-key');
    const self = wrap.querySelector('#pg-self');
    A.catalog.providers.forEach((p) => {
      if (p.local) return;
      const row = providerRow(p);
      if (p.keyless && ['pollinations', 'custom'].includes(p.id)) free.appendChild(row);
      else if (['ollama', 'lmstudio', 'llamacpp'].includes(p.id)) self.appendChild(row);
      else keyed.appendChild(row);
    });
    const customRow = providerRow(A.catalog.providerById('custom'));
    free.appendChild(customRow);
    openSheet('Providers & API keys', wrap);
  }

  function customModelDialog() {
    const wrap = el('div');
    wrap.innerHTML = `
      <div class="field"><label>Model name</label><input class="input" id="cm-name" placeholder="e.g. my-finetune-v2" /></div>
      <div class="field"><label>Base URL</label><input class="input" id="cm-url" placeholder="https://api.example.com/v1" /></div>
      <div class="field"><label>API key</label><input class="input" id="cm-key" type="password" placeholder="optional for local servers" /></div>
      <div class="field"><label>Context window (optional)</label><input class="input" id="cm-ctx" inputmode="numeric" placeholder="32000" /></div>
      <div class="hstack" style="margin-top:14px"><div class="spacer"></div>
        <button class="btn btn-ghost" id="cm-cancel">Cancel</button>
        <button class="btn btn-primary" id="cm-save">Add model</button></div>`;
    openSheet('Add a custom model', wrap);
    wrap.querySelector('#cm-cancel').addEventListener('click', closeSheet);
    wrap.querySelector('#cm-save').addEventListener('click', () => {
      const name = wrap.querySelector('#cm-name').value.trim();
      const url = wrap.querySelector('#cm-url').value.trim();
      const key = wrap.querySelector('#cm-key').value.trim();
      const ctx = Number(wrap.querySelector('#cm-ctx').value) || 0;
      if (!name || !url) return toast('Model name and base URL are required', 'err');
      const overrides = A.settings.get('providerOverrides');
      overrides.custom = { baseUrl: url };
      A.settings.set('providerOverrides', overrides);
      if (key) A.settings.setKey('custom', key);
      const list = A.settings.get('customModels') || [];
      list.push({ id: name, provider: 'custom', name, ctx, free: false, vision: false, tools: true, reasoning: false, offline: false, source: 'custom' });
      A.settings.set('customModels', list);
      closeSheet();
      render();
      toast('Custom model added', 'ok');
    });
  }

  /* ─────────────── sync ─────────────── */
  async function syncModels({ force = false } = {}) {
    if (ui.syncing) return;
    if (!A.net.online) return toast('You are offline — using the built-in catalog', '', 2400);
    ui.syncing = true;
    const btn = $('#btn-sync-models');
    btn?.classList.add('is-loading');
    toast('Syncing model lists…', '', 1600);
    try {
      const res = await A.discovery.syncAll({ force });
      await A.discovery.syncFeed({});
      const total = res.added || 0;
      toast(total ? `${total} new model${total > 1 ? 's' : ''} added` : `Catalog refreshed · ${A.catalog.all().length} models`, 'ok', 2600);
      render();
      A.app.updateModelChip();
    } catch (err) {
      toast('Sync failed: ' + err.message, 'err');
    } finally {
      ui.syncing = false;
      btn?.classList.remove('is-loading');
    }
  }

  function mount() {
    $('#btn-sync-models').addEventListener('click', () => syncModels({ force: true }));
    $('#btn-add-model').addEventListener('click', customModelDialog);
    $('#models-filter').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      ui.filter = btn.getAttribute('data-filter');
      A.ui.$$('#models-filter button').forEach((b) => b.classList.toggle('is-active', b === btn));
      render();
    });
    const search = $('#models-search');
    search.addEventListener('input', A.util.debounce(() => {
      ui.query = search.value;
      render();
    }, 140));
    A.bus.on('models:synced', render);
    A.bus.on('keys:changed', render);
    A.bus.on('settings:changed', () => {
      if (A.app.currentScreen() === 'models') render();
    });
  }

  A.screens = A.screens || {};
  A.screens.models = { mount, render, providerSheet, selectModel, syncModels, askProviderKey, customModelDialog };
})();
