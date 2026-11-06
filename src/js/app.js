/* ════════════════════════════════════════════════════════════════
   Ai'sHub · bootstrap
   Wire the shell, restore the last chat, register the service worker,
   handle online/offline transitions and first-run setup.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { $, $$, toast } = A.ui;

  let screen = 'chat';
  let installEvent = null;

  const SCREENS = ['chat', 'agent', 'models', 'prompts', 'settings'];

  function go(name) {
    if (!SCREENS.includes(name)) return;
    screen = name;
    $$('.screen').forEach((s) => s.classList.toggle('is-active', s.getAttribute('data-screen') === name));
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.getAttribute('data-screen') === name));
    A.ui.closeSheet();
    A.ui.$$('#drawer').forEach((d) => (d.hidden = true));
    $('#drawer-backdrop').hidden = true;
    if (name === 'models') {
      A.screens.models.render();
      A.discovery.markAllSeen();
    }
    if (name === 'agent') A.screens.agent.render();
    if (name === 'settings') A.screens.settings.render();
    if (name === 'chat') setTimeout(() => A.chat.scrollToBottom(false), 30);
    window.scrollTo(0, 0);
  }

  const media = (query) => (typeof window.matchMedia === 'function' ? window.matchMedia(query) : { matches: false, addEventListener() {}, addListener() {} });

  function applyTheme() {
    const pref = A.settings.get('theme') || 'system';
    const dark = pref === 'dark' || (pref === 'system' && media('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#07070B' : '#f6f6fb');
  }

  /** short vibration when the device supports it */
  function haptic(ms = 8) {
    if (!A.settings.get('haptics')) return;
    try {
      navigator.vibrate?.(ms);
    } catch (_) {}
  }

  function updateModelChip() {
    const model = A.ai.resolveSelected();
    const ready = A.ai.readiness(model);
    const chip = $('#model-chip');
    const dot = $('#brand-dot');
    if (!model) {
      chip.textContent = 'Choose a model';
      return;
    }
    chip.textContent = model.name + (model.free && !model.offline ? ' · free' : '');
    dot.style.background = model.offline
      ? 'linear-gradient(135deg,#0e7490,#22d3ee)'
      : ready.ready
        ? 'var(--brand-grad)'
        : 'linear-gradient(135deg,#7a3b3b,#b45309)';
  }

  function updateNetLabel() {
    const online = A.net.online;
    $('#net-dot').classList.toggle('off', !online);
    const model = A.ai.resolveSelected();
    $('#net-label').textContent = online
      ? `Online · ${A.catalog.all().length} models`
      : `Offline · on-device engine`;
    A.chat.updateComposerHint();
    void model;
  }

  /* ─────────────── drawer ─────────────── */
  function renderChats(filter = '') {
    const host = $('#chats-list');
    const chats = A.chatStore.search(filter);
    const currentId = A.chat.state.chatId;
    if (!chats.length) {
      host.innerHTML = `<div class="empty-state" style="padding:28px 10px">${A.ui.icon('list')}<p>No chats yet.<br/>Start one from the composer.</p></div>`;
      return;
    }
    const today = new Date().setHours(0, 0, 0, 0);
    const buckets = [
      { label: 'Today', test: (c) => c.updated >= today },
      { label: 'Yesterday', test: (c) => c.updated >= today - 864e5 && c.updated < today },
      { label: 'Earlier', test: (c) => c.updated < today - 864e5 },
    ];
    let html = '';
    const shown = new Set();
    for (const b of buckets) {
      const list = chats.filter((c) => !shown.has(c.id) && b.test(c));
      list.forEach((c) => shown.add(c.id));
      if (!list.length) continue;
      html += `<div class="drawer-section">${b.label}</div>`;
      html += list
        .map(
          (c) => `<div class="chat-item ${c.id === currentId ? 'is-active' : ''}" data-chat="${A.util.escapeAttr(c.id)}" role="button" tabindex="0">
            <span class="ci-main">
              <span class="ci-title">${A.util.escapeHtml(c.title)}</span>
              <span class="ci-sub">${c.messageCount || 0} messages · ${A.util.fmtRelative(c.updated)} · ${c.mode === 'agent' ? 'agent' : 'chat'}</span>
            </span>
            <button class="ci-del" data-del="${A.util.escapeAttr(c.id)}" aria-label="Delete chat">${A.ui.icon('trash')}</button>
          </div>`
        )
        .join('');
    }
    host.innerHTML = html;
    host.querySelectorAll('[data-chat]').forEach((node) => {
      node.addEventListener('click', async (e) => {
        if (e.target.closest('[data-del]')) return;
        await A.chat.openChat(node.getAttribute('data-chat'));
        closeDrawer();
        go('chat');
      });
    });
    host.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del');
        const chat = A.chatStore.get(id);
        const ok = await A.ui.confirmDialog('Delete chat?', `"${chat?.title || 'This chat'}" will be removed from this device.`, { okLabel: 'Delete', danger: true });
        if (!ok) return;
        await A.chatStore.remove(id);
        if (A.chat.state.chatId === id) await A.chat.newChat({ silent: true });
        renderChats($('#chats-search').value);
      });
    });
  }

  function openDrawer() {
    renderChats($('#chats-search').value);
    $('#drawer').hidden = false;
    $('#drawer-backdrop').hidden = false;
    updateNetLabel();
  }
  function closeDrawer() {
    $('#drawer').hidden = true;
    $('#drawer-backdrop').hidden = true;
  }

  /* ─────────────── install ─────────────── */
  function installPrompt() {
    if (installEvent) {
      installEvent.prompt();
      installEvent.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') toast('Installing Ai\'sHub…', 'ok');
        installEvent = null;
      });
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = media('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone) return toast('Ai\'sHub is already installed', 'ok');
    A.ui.modal({
      title: 'Install Ai\'sHub',
      body: `<p>${isIOS ? 'Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.' : 'Open the browser menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.'}</p>
        <p style="margin-top:10px">After installing, the app opens full-screen, keeps your chats and works offline.</p>`,
      actions: [{ label: 'Got it', class: 'btn-primary', value: true }],
    });
  }

  /* ─────────────── first run ─────────────── */
  function firstRun() {
    if (A.settings.get('onboardingDone')) return;
    A.settings.set('onboardingDone', true);
    const body = `<div class="prose">
      <p><strong>Welcome to Ai'sHub.</strong> Three things worth knowing:</p>
      <ul>
        <li><strong>It already works.</strong> The on-device engine answers without internet or keys.</li>
        <li><strong>Free cloud models are on.</strong> Pollinations needs no signup — pick one in the model chip.</li>
        <li><strong>More models, still free.</strong> Add a Gemini, Groq or OpenRouter key in Settings for 100+.</li>
      </ul>
      <p class="small muted">Keys stay on this device. There is no account and no subscription.</p>
    </div>`;
    A.ui.modal({
      title: "You're set up",
      body,
      actions: [
        { label: 'Connect a key', class: 'btn-ghost', onClick: () => { go('settings'); A.screens.models.providerSheet(); }, value: false },
        { label: 'Start chatting', class: 'btn-primary', value: true },
      ],
    });
  }

  /* ─────────────── service worker ─────────────── */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    if (!/^https?:$/.test(location.protocol) && !location.hostname) return;

    // Inside the Android app the shell is packaged in the APK, so a service
    // worker can only serve a STALE copy of it. Unregister and clear caches so
    // an installed app always runs the build that shipped with it.
    const nativeShell = /^https?:$/.test(location.protocol) && Boolean(window.Capacitor);
    if (nativeShell) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
      if (window.caches?.keys) {
        caches.keys().then((keys) => keys.filter((k) => k.startsWith('aishub-')).forEach((k) => caches.delete(k))).catch(() => {});
      }
      return;
    }

    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              toast('Update ready — reopen the app to apply', '', 4000);
            }
          });
        });
        // A build that changes the cache name should land immediately; otherwise a
        // stale shell keeps being served and fixes appear not to have any effect.
        reg.update?.().catch(() => {});
      })
      .catch((err) => console.warn('[sw]', err.message));
  }

  /* Show which build is running, so it is obvious when an old copy is cached. */
  function stampBuild() {
    const el = document.querySelector('[data-build]');
    if (!el) return;
    const build = document.querySelector('meta[name="build"]')?.content || '';
    el.textContent = build ? `build ${build}` : '';
  }

  /* ─────────────── reminders ─────────────── */
  function initReminders() {
    A.skills.restoreReminders();
    A.bus.on('reminder', (item) => toast(`⏰ ${item.text}`, 'ok', 6000));
    setInterval(() => {
      const list = A.store.KV.get('reminders', []);
      const due = list.filter((r) => r.at <= Date.now() && !r.fired);
      due.forEach((r) => {
        A.bus.emit('reminder', r);
        r.fired = true;
      });
      if (due.length) A.store.KV.set('reminders', list);
    }, 20000);
  }

  /* ─────────────── wire UI ─────────────── */
  function wire() {
    // tabs
    $('#tabbar').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (btn) go(btn.getAttribute('data-screen'));
    });
    // drawer
    $('#btn-menu').addEventListener('click', openDrawer);
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#drawer-backdrop').addEventListener('click', closeDrawer);
    $('#drawer-new').addEventListener('click', async () => {
      await A.chat.newChat({ silent: true });
      go('chat');
      closeDrawer();
      $('#input').focus();
    });
    $('#chats-search').addEventListener('input', A.util.debounce((e) => renderChats(e.target.value), 120));
    $('#drawer-about').addEventListener('click', () => {
      closeDrawer();
      A.screens.settings.render();
      go('settings');
      setTimeout(() => A.screens.settings && document.querySelector('#btn-about-more')?.click(), 120);
    });
    // header
    $('#btn-new-chat').addEventListener('click', async () => {
      await A.chat.newChat();
      go('chat');
    });
    $('#btn-model-chip').addEventListener('click', () => {
      A.app.go('models');
    });
    // sheet + modal close
    $('#sheet-close').addEventListener('click', () => A.ui.closeSheet());
    $('#sheet-backdrop').addEventListener('click', () => A.ui.closeSheet());
    $('#modal-backdrop').addEventListener('click', () => $('#modal').__finish && $('#modal').__finish());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (A.ui.isSheetOpen()) A.ui.closeSheet();
        else if (!$('#modal').hidden) $('#modal').__finish?.();
        else if (!$('#drawer').hidden) closeDrawer();
      }
    });
    // composer
    const input = $('#input');
    const composer = $('#composer');
    input.addEventListener('input', A.chat.autosize);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.innerWidth > 720) {
        e.preventDefault();
        if (A.chat.state.busy) A.chat.stop();
        else A.chat.send();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        A.chat.send();
      }
    });
    composer.addEventListener('click', (e) => {
      if (e.target.closest('#btn-send')) {
        if (A.chat.state.busy) A.chat.stop();
        else A.chat.send();
      }
    });
    $$('.mode-tab').forEach((b) => b.addEventListener('click', () => A.chat.setMode(b.getAttribute('data-mode'))));
    // attach
    $('#btn-attach').addEventListener('click', () => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = 'image/*,.txt,.md,.csv,.json,.js,.py,.kt,.java,.html,.css,.log';
      picker.addEventListener('change', () => A.chat.attachFile(picker.files[0]));
      picker.click();
    });
    // drag & drop (desktop)
    ['dragover', 'drop'].forEach((evt) =>
      document.addEventListener(evt, (e) => {
        e.preventDefault();
        if (evt === 'drop' && e.dataTransfer?.files?.[0]) A.chat.attachFile(e.dataTransfer.files[0]);
      })
    );
    // scroll to bottom button
    $('#chat-scroll').addEventListener('scroll', A.util.throttle(() => {
      const s = $('#chat-scroll');
      const near = s.scrollHeight - s.scrollTop - s.clientHeight < 200;
      $('#btn-scroll-down').classList.toggle('show', !near);
    }, 120));
    $('#btn-scroll-down').addEventListener('click', () => A.chat.scrollToBottom());
    // paste image
    input.addEventListener('paste', (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          A.chat.attachFile(file);
        }
      }
    });
  }

  /* ─────────────── start ─────────────── */
  /* ── boot resilience ────────────────────────────────────────────────
     The shell must ALWAYS appear. Every stage is isolated, the splash is hidden
     on a deadline, and a watchdog declares the app ready: previously one
     hanging mount() or a stalled IndexedDB read kept the splash up forever and
     left a blank screen with no explanation. */
  const bootErrors = [];
  window.AIHUB_BOOT_LOG = bootErrors;

  function note(name, err) {
    const msg = `${name}: ${(err && err.message) || err}`;
    bootErrors.push(msg);
    console.error('[boot]', msg);
  }
  function stage(name, fn) {
    window.AIHUB_STAGE = name;
    try {
      return fn();
    } catch (err) {
      note(name, err);
      return undefined;
    }
  }
  async function stageAsync(name, fn) {
    window.AIHUB_STAGE = name;
    try {
      return await fn();
    } catch (err) {
      note(name, err);
      return undefined;
    }
  }
  function hideSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('is-gone');
    setTimeout(() => {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, 700);
  }

  let bootWatchdog = null;

  async function start() {
    // Hide the shell even if a stage hangs: a splash that never leaves is
    // indistinguishable from a frozen app.
    const splashDeadline = setTimeout(() => {
      hideSplash();
      if (!window.AIHUB_BOOTED) window.AIHUB_STAGE = `${window.AIHUB_STAGE || 'start'} (slow)`;
    }, 2200);

    // Last resort: if the app has not finished by now, show what we have.
    bootWatchdog = setTimeout(() => {
      hideSplash();
      stage('watchdog-render', () => go('chat'));
      if (!window.AIHUB_BOOTED && document.querySelector('.composer-wrap')) {
        window.AIHUB_BOOTED = true;
        document.documentElement.setAttribute('data-boot', 'ready');
      }
    }, 6000);

    stage('theme', applyTheme);
    stage('i18n', () => A.i18n.init());
    stage('chat-cache', () => A.chat.cache());
    stage('wire', wire);
    stage('mount-models', () => A.screens.models.mount());
    stage('mount-agent', () => A.screens.agent.mount());
    stage('mount-prompts', () => A.screens.prompts.mount());
    stage('mount-settings', () => A.screens.settings.mount());

    // restore last chat — never fatal, a broken store must not hide the app
    await stageAsync('restore-chat', async () => {
      const lastId = A.settings.get('lastChatId');
      if (lastId && A.chatStore.get(lastId)) await A.chat.openChat(lastId);
      else await A.chat.newChat({ silent: true });
    });

    stage('home', () => go('chat'));
    stage('chip', () => updateModelChip());
    stage('net', () => updateNetLabel());
    stage('reminders', () => initReminders());
    stage('service-worker', () => registerSW());
    stage('stamp', () => stampBuild());

    clearTimeout(splashDeadline);
    hideSplash();

    // first-run + auto sync
    setTimeout(() => firstRun(), 700);
    if (A.discovery.shouldAutoSync()) {
      A.discovery
        .syncAll({})
        .then((res) => {
          if (res && res.added) {
            A.screens.models.render();
            updateModelChip();
          }
        })
        .catch(() => {});
    }

    // deep links: ?action=new-chat | ?action=agent
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    if (action === 'new-chat') A.chat.newChat({ silent: true });
    if (action === 'agent') {
      A.chat.setMode('agent');
      go('chat');
    }

    window.addEventListener('online', () => {
      updateNetLabel();
      A.chat.updateComposerHint();
      toast('Back online', 'ok', 1600);
      if (A.discovery.shouldAutoSync()) A.discovery.syncAll({}).then(() => A.app.updateModelChip()).catch(() => {});
    });
    window.addEventListener('offline', () => {
      updateNetLabel();
      A.chat.updateComposerHint();
      toast('Offline — switched to the on-device engine', '', 3200);
    });
    const mql = media('(prefers-color-scheme: dark)');
    (mql.addEventListener ? mql.addEventListener.bind(mql) : mql.addListener.bind(mql))('change', () => {
      if (A.settings.get('theme') === 'system') applyTheme();
    });
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installEvent = e;
    });
    A.bus.on('model:changed', updateModelChip);
    A.bus.on('chats:changed', () => {
      if (!$('#drawer').hidden) renderChats($('#chats-search').value);
    });
    A.bus.on('models:new', (models) => {
      if (!models || !models.length) return;
      toast(`${models.length} new model${models.length > 1 ? 's' : ''} added automatically`, 'ok', 3200);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && A.discovery.shouldAutoSync()) A.discovery.syncAll({}).catch(() => {});
    });
    // Boot finished: the guard in index.html stops watching for a blank screen.
    if (bootWatchdog) clearTimeout(bootWatchdog);
    if (bootErrors.length) console.warn('[boot] finished with problems:', bootErrors.join(' | '));
    window.AIHUB_BOOTED = true;
    document.documentElement.setAttribute('data-boot', 'ready');
  }

  A.app = {
    go,
    haptic,
    start,
    applyTheme,
    updateModelChip,
    updateNetLabel,
    installPrompt,
    renderChats,
    openDrawer,
    closeDrawer,
    currentScreen: () => screen,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
