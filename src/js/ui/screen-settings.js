/* ════════════════════════════════════════════════════════════════
   Ai'sHub · Settings screen
   Appearance, model defaults, provider keys, agent behaviour,
   memory, data export/import, about.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { $, $$, el, icon, toast, openSheet } = A.ui;
  const esc = A.util.escapeHtml;

  function group(title, cardsHtml) {
    return `<div class="setting-group"><h3>${esc(title)}</h3><div class="setting-card">${cardsHtml}</div></div>`;
  }

  function render() {
    const s = A.settings;
    const host = $('#settings-body');
    const keyCount = A.catalog.providers.filter((p) => !p.keyless && !p.local && s.hasKey(p.id)).length;

    host.innerHTML = `
      ${group(
        'Model',
        `<div class="switch-row" id="row-model">
           <div><div class="label">Current model</div><div class="sub" id="cur-model">${esc(A.catalog.find(s.get('selectedModel'))?.name || 'Local engine')}</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-pick-model">Change</button>
         </div>
         <div class="switch-row">
           <div><div class="label">Sync models automatically</div><div class="sub">Pulls new model lists when online (every 6h).</div></div>
         </div>
         <div id="sw-autosync"></div>
         <div class="switch-row">
           <div><div class="label">Stream responses</div><div class="sub">Show text as it is generated.</div></div>
         </div>
         <div id="sw-stream"></div>`
      )}
      <div id="temp-host"></div>
      ${group(
        'Providers & keys',
        `<div class="switch-row" id="row-providers">
           <div><div class="label">API keys</div><div class="sub">${keyCount} provider${keyCount === 1 ? '' : 's'} connected · free keyless ready</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-providers">Manage</button>
         </div>
         <div class="switch-row">
           <div><div class="label">Test current model</div><div class="sub">Send a one-token ping.</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-test-model">Test</button>
         </div>`
      )}
      ${group(
        'Agent',
        `<div class="switch-row">
           <div><div class="label">Ask before changing data</div><div class="sub">Saving notes, reminders and similar steps wait for your tap.</div></div>
           <div id="sw-approval"></div>
         </div>
         <div id="steps-host"></div>`
      )}
      ${group(
        'Memory',
        `<div class="switch-row">
           <div><div class="label">Remember facts about me</div><div class="sub">Stored locally and added to cloud prompts. <span id="mem-count">${A.skills.memory.all().length}</span> saved.</div></div>
           <div id="sw-memory"></div>
         </div>
         <div class="switch-row">
           <div><div class="label">Manage memories</div><div class="sub">Review or delete what the app remembers.</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-memories">Open</button>
         </div>
         <div class="switch-row">
           <div><div class="label">Notes</div><div class="sub"><span id="notes-count">${A.skills.notes.all().length}</span> notes saved on this device.</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-notes">Open</button>
         </div>`
      )}
      ${group(
        'Persona',
        `<div class="switch-row">
           <div><div class="label">Custom instructions</div><div class="sub">Added to every cloud model prompt. Local engine ignores it.</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-persona">Edit</button>
         </div>
         <div class="switch-row">
           <div><div class="label">Haptic feedback</div><div class="sub">Short vibration on send and agent approval.</div></div>
           <div id="sw-haptics"></div>
         </div>`
      )}
      ${group(
        'Appearance',
        `<div class="switch-row">
           <div><div class="label">Theme</div><div class="sub">Dark, light, or follow the system.</div></div>
         </div>
         <div id="theme-host" style="padding:0 0 12px"></div>
         <div class="switch-row">
           <div><div class="label">Language</div><div class="sub">Interface language.</div></div>
         </div>
         <div id="locale-host" style="padding:0 0 12px"></div>`
      )}
      ${group(
        'Data',
        `<div class="switch-row">
      </section>

      <!-- ══ phone control ══ -->
      <section class="group">
        <h2 class="group-title">Phone control</h2>
        <div class="card" style="padding:14px">
          <div class="vstack" style="gap:10px">
            <div class="hstack" style="gap:10px">
              <span class="sg-ico" style="width:30px;height:30px;border-radius:10px;background:rgba(124,92,255,.16);color:#c4b5fd;display:grid;place-items:center">${icon('bolt')}</span>
              <div><div style="font-size:13px;font-weight:650">Let the assistant use this phone</div>
              <div class="small muted">Alarms, calendar, apps, flashlight, screen taps — free and on-device.</div></div>
            </div>
            <div class="small muted" id="phone-status">Checking…</div>
            <div class="hstack" style="gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" id="btn-phone-check">Run self-test</button>
              <button class="btn btn-ghost btn-sm" id="btn-phone-access">Screen control</button>
              <button class="btn btn-ghost btn-sm" id="btn-phone-log">Activity</button>
            </div>
            <div class="small muted">Try in Chat: “set an alarm for 7:30”, “open youtube”, “text 01712345678 I'm late”.</div>
          </div>
        </div>
      </section>

      <section class="group">
        <h2 class="group-title">Data</h2>
        <div class="switch-row">
           <div><div class="label">Export everything</div><div class="sub">Chats, settings and notes as JSON.</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-export">Export</button>
         </div>
         <div class="switch-row">
           <div><div class="label">Import backup</div><div class="sub">Merge a previous export.</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-import">Import</button>
         </div>
         <div class="switch-row">
           <div><div class="label">Install as app</div><div class="sub">Add Ai'sHub to your home screen.</div></div>
           <button class="btn btn-ghost btn-sm" id="btn-install">Install</button>
         </div>
         <div class="switch-row">
           <div><div class="label">Clear chats</div><div class="sub">Deletes all conversations. Settings stay.</div></div>
           <button class="btn btn-danger btn-sm" id="btn-clear-chats">Clear</button>
         </div>
         <div class="switch-row">
           <div><div class="label">Reset app</div><div class="sub">Everything back to factory defaults.</div></div>
           <button class="btn btn-danger btn-sm" id="btn-reset">Reset</button>
         </div>`
      )}
      <div class="card about-card">
        <img src="logo.png" width="64" height="64" alt="Ai'sHub logo" />
        <div style="font-weight:800;font-size:17px">Ai'sHub</div>
        <div class="small muted" style="margin-top:4px">Your free AI agent — 100+ models, offline engine.</div>
        <div class="ver" style="margin-top:8px">v${A.VERSION} · <span data-build>build ${A.BUILD}</span> · pkg com.aishub</div>
        <div class="about-links">
          <a class="btn btn-ghost btn-sm" href="https://github.com/spideycandy973-web/Ai-sHub" target="_blank" rel="noopener">GitHub</a>
          <button class="btn btn-ghost btn-sm" id="btn-about-more">How it works</button>
        </div>
        <div class="small muted" style="margin-top:12px">No accounts · no tracking · no subscription</div>
      </div>`;

    /* ── switches (rendered inline where their row lives) ── */
    const attachSwitch = (slotId, { ariaLabel, checked, onChange }) => {
      const slot = host.querySelector('#' + slotId);
      if (!slot) return;
      const sw = A.ui.el('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!checked), 'aria-label': ariaLabel });
      sw.addEventListener('click', () => {
        const next = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(next));
        onChange(next);
      });
      slot.replaceWith(sw);
    };
    attachSwitch('sw-autosync', {
      ariaLabel: 'Sync models automatically', checked: s.get('autoSyncModels'),
      onChange: (v) => { s.set('autoSyncModels', v); toast(v ? 'Auto sync on' : 'Auto sync off', '', 1400); },
    });
    attachSwitch('sw-stream', {
      ariaLabel: 'Stream responses', checked: s.get('streaming'),
      onChange: (v) => s.set('streaming', v),
    });
    attachSwitch('sw-approval', {
      ariaLabel: 'Ask before changing data', checked: s.get('agentApproval') === 'confirm',
      onChange: (v) => s.set('agentApproval', v ? 'confirm' : 'auto'),
    });
    attachSwitch('sw-memory', {
      ariaLabel: 'Remember facts about me', checked: s.get('memoryEnabled'),
      onChange: (v) => s.set('memoryEnabled', v),
    });

    attachSwitch('sw-haptics', {
      ariaLabel: 'Haptic feedback', checked: s.get('haptics'),
      onChange: (v) => s.set('haptics', v),
    });
    host.querySelector('#btn-persona').addEventListener('click', async () => {
      const value = await A.ui.promptDialog({
        title: 'Custom instructions',
        label: 'Tell every cloud model who you are',
        multiline: true,
        value: s.get('systemPrompt') || '',
        placeholder: 'e.g. I am a final-year CSE student in Chattogram. Answer in short bullet points. Use BDT for money.',
        hint: 'Leave empty to use the default Ai\'sHub personality.',
        okLabel: 'Save',
      });
      if (value !== null) {
        s.set('systemPrompt', value);
        toast(value ? 'Custom instructions saved' : 'Custom instructions cleared', 'ok');
      }
    });

    /* ── temperature slider ── */
    const tempHost = host.querySelector('#temp-host');
    tempHost.className = 'setting-group';
    tempHost.innerHTML = `<h3>Creativity</h3><div class="setting-card" id="temp-card"></div>`;
    tempHost.querySelector('#temp-card').appendChild(
      A.ui.sliderRow({
        label: 'Temperature', min: 0, max: 1.5, step: 0.1, value: s.get('temperature'),
        format: (v) => v.toFixed(1),
        onChange: (v) => s.set('temperature', v, { silent: true }),
      })
    );
    tempHost.querySelector('#temp-card').appendChild(
      A.ui.sliderRow({
        label: 'Max answer tokens', min: 256, max: 4096, step: 128, value: s.get('maxTokens'),
        format: (v) => String(v),
        onChange: (v) => s.set('maxTokens', v, { silent: true }),
      })
    );

    /* ── agent steps ── */
    const stepsHost = host.querySelector('#steps-host');
    stepsHost.className = 'setting-group';
    stepsHost.innerHTML = `<h3>Limits</h3><div class="setting-card" id="steps-card"></div>`;
    stepsHost.querySelector('#steps-card').appendChild(
      A.ui.sliderRow({
        label: 'Max agent steps', min: 2, max: 10, step: 1, value: s.get('agentMaxSteps'),
        format: (v) => String(v),
        onChange: (v) => s.set('agentMaxSteps', v, { silent: true }),
      })
    );

    /* ── theme ── */
    host.querySelector('#theme-host').appendChild(
      A.ui.segmented(
        [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }],
        s.get('theme') || 'system',
        (v) => {
          s.set('theme', v);
          A.app.applyTheme();
        }
      )
    );

    /* ── locale ── */
    host.querySelector('#locale-host').appendChild(
      A.ui.segmented(
        [{ value: 'auto', label: 'Auto' }, { value: 'en', label: 'English' }, { value: 'bn', label: 'বাংলা' }],
        s.get('locale'),
        (v) => {
          A.settings.set('locale', v);
          A.i18n.init();
        }
      )
    );

    /* ── handlers ── */
    host.querySelector('#btn-pick-model').addEventListener('click', () => A.app.go('models'));
    host.querySelector('#btn-providers').addEventListener('click', () => A.screens.models.providerSheet());
    host.querySelector('#btn-test-model').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.textContent = 'Testing…';
      const res = await A.ai.testModel(A.settings.get('selectedModel'));
      btn.textContent = 'Test';
      toast(res.ok ? `OK — ${res.text || 'connected'}` : res.message, res.ok ? 'ok' : 'err', 3600);
    });
    host.querySelector('#btn-memories').addEventListener('click', showMemories);
    host.querySelector('#btn-notes').addEventListener('click', showNotes);
    host.querySelector('#btn-export').addEventListener('click', exportAll);
    host.querySelector('#btn-import').addEventListener('click', importBackup);
    host.querySelector('#btn-install').addEventListener('click', () => A.app.installPrompt());

    /* ── phone control ── */
    const phoneStatus = host.querySelector('#phone-status');
    const describePhone = async () => {
      if (!phoneStatus) return;
      if (!A.phone.available()) {
        phoneStatus.innerHTML = 'Phone control needs the <strong>Android app</strong>. In this browser it stays read-only.';
        return;
      }
      const cap = await A.phone.capabilities();
      const on = Object.entries(cap.features || {}).filter(([, v]) => v).map(([k]) => k);
      phoneStatus.innerHTML = `${cap.model || 'This phone'} · Android ${cap.androidVersion || '?'} — <strong>${on.length} capabilities</strong> active${cap.features?.accessibilityClicks ? '' : ' · screen taps need the accessibility switch'}`;
    };
    describePhone();

    /* A self-test that names the exact failing step, so "it does not work" becomes
       "step 4 failed because of X" in one press. */
    const runSelfTest = async () => {
      const rows = [];
      const step = async (label, fn) => {
        try {
          const detail = await fn();
          rows.push({ ok: true, label, detail: detail || '' });
        } catch (err) {
          rows.push({ ok: false, label, detail: err && err.message ? err.message : String(err) });
        }
      };

      if (!A.phone.available()) {
        openSheet('Phone self-test', `<div class="card" style="padding:14px">
          <p class="small"><strong>This is the browser build.</strong> Phone control only exists inside the Android app.</p>
          <p class="small muted">Install <code>AisHub-1.0.0-release.apk</code> from the repo's <em>builds</em> release, then open Ai'sHub from your app drawer — not from Chrome.</p>
        </div>`);
        return;
      }

      await step('Native plugin loaded', async () => {
        if (!A.phone.available()) throw new Error('PhoneControl plugin is not registered in this build');
        return 'PhoneControl found';
      });
      await step('Plugin answers (capabilities)', async () => {
        const cap = await A.phone.capabilities();
        if (cap.error) throw new Error(cap.error);
        const on = Object.entries(cap.features || {}).filter(([, v]) => v).map(([k]) => k);
        if (!on.length) throw new Error('plugin replied but reports no capabilities');
        return `${cap.model || 'this phone'} · Android ${cap.androidVersion || '?'} · ${on.length} on`;
      });
      await step('Device status (battery / volume / storage)', async () => {
        const st = await A.phone.call('status', {});
        const bits = [];
        if (typeof st.battery === 'number') bits.push(`${st.battery}% battery`);
        if (st.storage) bits.push(`${st.storage}`);
        if (!bits.length) throw new Error('status returned nothing useful');
        return bits.join(' · ');
      });
      await step('Installed apps readable', async () => {
        const apps = await A.phone.call('listApps', {});
        const n = (apps.apps || []).length;
        if (!n) throw new Error('no launchable apps returned');
        return `${n} apps`;
      });
      await step('Alarm / timer intent reachable', async () => {
        const cap = await A.phone.capabilities();
        const ok = cap.features && (cap.features.alarms || cap.features.timers);
        if (!ok) throw new Error('no clock app on this phone accepts alarms');
        return 'a clock app will take them';
      });
      await step('Accessibility (screen taps)', async () => {
        const st = await A.phone.call('accessibilityStatus', {});
        if (!st.enabled) throw new Error('off — tap “Screen control” below to turn it on');
        return 'enabled';
      });
      await step('Last stored request', async () => {
        const h = A.phoneActions.history();
        if (!h.length) return 'none yet';
        const last = h[0];
        return `${last.action || '?'} — ${last.ok ? 'worked' : 'failed'}`;
      });

      const passed = rows.filter((r) => r.ok).length;
      const body = `<div class="card" style="padding:14px">
        <p class="small"><strong>${passed}/${rows.length} checks passed</strong></p>
        <div class="vstack" style="gap:10px">${rows.map((r) => `<div class="small">
          <span class="${r.ok ? 'ok' : 'warn'}">${r.ok ? '✓' : '✕'} ${esc(r.label)}</span>
          ${r.detail ? `<div class="muted">${esc(r.detail)}</div>` : ''}
        </div>`).join('')}</div>
        <p class="small muted" style="margin-top:12px">If something is ✕, tell me its exact line and I will fix that step.</p>
      </div>`;
      openSheet('Phone self-test', body);
      if (phoneStatus) phoneStatus.innerHTML = `<strong>${passed}/${rows.length}</strong> checks passed.`;
    };
    host.querySelector('#btn-phone-check')?.addEventListener('click', runSelfTest);
    host.querySelector('#btn-phone-access')?.addEventListener('click', async () => {
      try {
        if (!A.phone.available()) throw new Error('Install the Android app to control the phone.');
        const st = await A.phone.call('accessibilityStatus', {});
        if (st.enabled) { toast('Screen control is already on', 'ok'); return; }
        await A.phone.call('openAccessibilitySettings', {});
        toast('Enable “Ai\'sHub control” in the list', '', 5000);
      } catch (err) {
        toast(err.message, 'err', 4000);
      }
    });
    host.querySelector('#btn-phone-log')?.addEventListener('click', () => {
      const list = A.phoneActions.history();
      const body = list.length
        ? `<div class="vstack" style="gap:8px">${list.slice(0, 30).map((h) => `<div class="small"><span class="muted">${new Date(h.ts).toLocaleString()}</span><br><strong>${esc(h.action || '')}</strong> — ${esc(h.request || '')}${h.ok ? '' : `<br><span class="warn">${esc(h.message || 'failed')}</span>`}</div>`).join('')}</div>`
        : '<p class="small muted">Nothing yet. Ask me to set an alarm or open an app.</p>';
      openSheet('Phone activity', `<div class="card" style="padding:14px">${body}</div>`);
    });
    host.querySelector('#btn-clear-chats').addEventListener('click', async () => {
      const ok = await A.ui.confirmDialog('Clear all chats?', 'Every conversation on this device will be deleted. This cannot be undone.', { okLabel: 'Clear', danger: true });
      if (!ok) return;
      A.chatStore.clearAll();
      A.chat.newChat({ silent: true });
      toast('All chats cleared', 'ok');
    });
    host.querySelector('#btn-reset').addEventListener('click', async () => {
      const ok = await A.ui.confirmDialog('Reset Ai\'sHub?', 'Chats, keys, notes, memories and settings will be erased.', { okLabel: 'Reset everything', danger: true });
      if (!ok) return;
      A.chatStore.clearAll();
      await A.store.DB.wipe();
      Object.keys(localStorage).filter((k) => k.startsWith(A.store.PREFIX)).forEach((k) => localStorage.removeItem(k));
      A.settings.reset();
      A.discovery.reset();
      A.catalog.dropDiscovered();
      A.app.applyTheme();
      A.app.updateModelChip();
      A.chat.newChat({ silent: true });
      render();
      toast('App reset', 'ok');
    });
    host.querySelector('#btn-about-more').addEventListener('click', showAbout);
  }

  function showMemories() {
    const wrap = el('div');
    const renderList = () => {
      const list = A.skills.memory.all();
      wrap.innerHTML = list.length
        ? list
            .map(
              (m) => `<div class="switch-row"><div><div class="label" style="font-weight:500;font-size:13.5px">${esc(m.text)}</div>
              <div class="sub">${A.util.fmtRelative(m.created)} ago</div></div>
              <button class="icon-btn" data-del="${esc(m.id)}">${icon('trash')}</button></div>`
            )
            .join('')
        : `<div class="empty-state">${icon('memory')}<p>Nothing remembered yet. Say “remember that I prefer short answers” in chat.</p></div>`;
      wrap.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          A.skills.memory.remove(b.getAttribute('data-del'));
          renderList();
        })
      );
    };
    renderList();
    openSheet('Memories', wrap);
  }

  function showNotes() {
    const wrap = el('div');
    const renderList = () => {
      const list = A.skills.notes.all();
      wrap.innerHTML = list.length
        ? list
            .map(
              (n) => `<div class="card" style="padding:12px"><div class="hstack"><div style="flex:1;min-width:0">
                <div style="font-weight:650;font-size:13.5px">${esc(n.title)}</div>
                <div class="small muted" style="margin-top:3px">${A.util.fmtRelative(n.updated)} ago</div></div>
                <button class="icon-btn" data-del="${esc(n.id)}">${icon('trash')}</button></div>
                <pre class="mono" style="white-space:pre-wrap;margin-top:8px;max-height:120px;overflow:auto">${esc(n.body)}</pre></div>`
            )
            .join('')
        : `<div class="empty-state">${icon('note')}<p>No notes yet. Ask the agent to “save … as a note”.</p></div>`;
      wrap.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          A.skills.notes.remove(b.getAttribute('data-del'));
          renderList();
        })
      );
    };
    renderList();
    openSheet('Notes', wrap);
  }

  async function exportAll() {
    const data = await A.chatStore.exportAll();
    data.notes = A.skills.notes.all();
    data.memories = A.skills.memory.all();
    A.util.download(`aishub-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
    toast('Backup exported', 'ok');
  }

  function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await A.util.readFileAsText(file));
        if (data.settings) A.settings.patch(data.settings, { silent: true });
        if (Array.isArray(data.notes)) A.store.KV.set('notes', data.notes);
        if (Array.isArray(data.memories)) A.store.KV.set('memory', data.memories);
        let imported = 0;
        for (const chat of data.chats || []) {
          const { messages, ...meta } = chat;
          const chats = A.chatStore.list();
          if (!chats.some((c) => c.id === meta.id)) {
            A.store.KV.set('chats', [meta, ...chats]);
            await A.store.DB.putMessages(meta.id, messages || []);
            imported++;
          }
        }
        A.bus.emit('chats:changed');
        render();
        toast(`Imported ${imported} chat${imported === 1 ? '' : 's'}`, 'ok');
      } catch (err) {
        toast('Import failed: ' + err.message, 'err');
      }
    });
    input.click();
  }

  function showAbout() {
    const wrap = el('div');
    wrap.innerHTML = `
      <div class="prose">
        <h2>How Ai'sHub works</h2>
        <p>Ai'sHub is a single mobile app with three layers:</p>
        <ul>
          <li><strong>On-device engine</strong> — a local responder with exact maths, unit conversion, text tools, planners and a ${A.knowledge.topics.length}-topic knowledge base. No network, no key, no cost.</li>
          <li><strong>Keyless cloud models</strong> — Pollinations endpoints answer immediately without any signup.</li>
          <li><strong>Bring-your-own-key models</strong> — ${A.catalog.all().length} models across ${A.catalog.providers.length} providers. Keys stay in this device's storage and go straight to the provider.</li>
        </ul>
        <h2>Nothing is sent to us</h2>
        <p>There is no Ai'sHub server. Chats, keys, notes and agent logs are stored locally (localStorage + IndexedDB). Cloud calls go directly from your phone to the provider you picked.</p>
        <h2>Automatic model updates</h2>
        <p>On launch the app asks each connected provider for its <code>/models</code> list, merges anything new and marks it <strong>NEW</strong>. You can also point Settings → discovery feed at a JSON catalog URL.</p>
        <h2>Install</h2>
        <p>Browser menu → <em>Install app</em> / <em>Add to Home Screen</em>. On Android you can also build the bundled native project (package <code>com.aishub</code>).</p>
        <h2>Honest limits</h2>
        <ul>
          <li>Free cloud tiers have rate limits; the app shows them and offers another model.</li>
          <li>The on-device engine is not a frontier model — it is fast, private and unlimited, but narrower.</li>
          <li>Model names change; discovery keeps the list current.</li>
        </ul>
      </div>`;
    openSheet('About', wrap);
  }

  function mount() {
    render();
    A.bus.on('settings:changed', () => {
      if (A.app.currentScreen() === 'settings') render();
    });
    A.bus.on('model:changed', () => {
      if (A.app.currentScreen() === 'settings') render();
    });
  }

  A.screens = A.screens || {};
  A.screens.settings = { mount, render };
})();
