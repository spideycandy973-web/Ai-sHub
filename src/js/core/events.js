/* ════════════════════════════════════════════════════════════════
   Ai'sHub · event bus + settings schema with safe defaults
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { KV } = A.store;

  /* ---------------- tiny pub/sub ---------------- */
  const handlers = new Map();
  const Bus = {
    on(evt, fn) {
      if (!handlers.has(evt)) handlers.set(evt, new Set());
      handlers.get(evt).add(fn);
      return () => Bus.off(evt, fn);
    },
    off(evt, fn) {
      handlers.get(evt)?.delete(fn);
    },
    emit(evt, payload) {
      handlers.get(evt)?.forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.warn('[bus]', evt, err);
        }
      });
    },
  };

  /* ---------------- settings ---------------- */
  const DEFAULTS = {
    theme: 'dark', // dark | light | system
    locale: 'auto',
    mode: 'chat', // chat | agent
    selectedModel: 'aishub-local-1',
    temperature: 0.7,
    maxTokens: 1200,
    systemPrompt: '',
    streaming: true,
    haptics: true,
    sendOnEnter: true,
    keepScreenOn: false,
    autoSyncModels: true,
    lastSync: 0,
    seenModels: [],
    favorites: [],
    agentApproval: 'confirm', // confirm | auto
    agentMaxSteps: 7,
    memoryEnabled: true,
    onboardingDone: false,
    lastChatId: null,
    installedHintShown: false,
    providerKeys: {}, // providerId -> key
    providerOverrides: {}, // providerId -> { baseUrl }
    customModels: [],
    discoveryFeeds: [],
    thinking: false,
  };

  let settings = Object.assign({}, DEFAULTS, KV.get('settings', {}));
  settings.providerKeys = Object.assign({}, settings.providerKeys);
  settings.providerOverrides = Object.assign({}, settings.providerOverrides);

  const Settings = {
    DEFAULTS,
    get all() {
      return settings;
    },
    get(key) {
      return settings[key];
    },
    set(key, value, { silent = false } = {}) {
      settings[key] = value;
      KV.set('settings', settings);
      if (!silent) Bus.emit('settings:changed', { key, value });
      return value;
    },
    patch(obj, opts) {
      Object.assign(settings, obj);
      KV.set('settings', settings);
      if (!opts || !opts.silent) Bus.emit('settings:changed', { key: '*', value: settings });
    },
    reset() {
      settings = Object.assign({}, DEFAULTS, {
        providerKeys: {},
        providerOverrides: {},
        customModels: [],
        discoveryFeeds: [],
        onboardingDone: true,
      });
      KV.set('settings', settings);
      Bus.emit('settings:changed', { key: '*', value: settings });
    },
    key(providerId) {
      const k = settings.providerKeys[providerId];
      // allow a build-time injected key (window.AISHUB_KEY_<PROVIDER>) for private builds
      const injected = window['AISHUB_KEY_' + String(providerId).toUpperCase()];
      return (k && k.trim()) || injected || '';
    },
    setKey(providerId, key) {
      settings.providerKeys[providerId] = String(key || '').trim();
      KV.set('settings', settings);
      Bus.emit('keys:changed', providerId);
    },
    hasKey(providerId) {
      return Boolean(Settings.key(providerId));
    },
  };

  A.bus = Bus;
  A.settings = Settings;
})();
