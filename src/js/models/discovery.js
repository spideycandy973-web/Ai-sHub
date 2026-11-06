/* ════════════════════════════════════════════════════════════════
   Ai'sHub · auto model discovery
   Pulls the live /models list from every provider that has a key (or is
   keyless), merges anything new into the catalog and flags it as "NEW".
   Runs automatically on launch / reconnect, and rides along on the
   GitHub JS bundle feed so newly announced models appear even before a
   provider exposes them.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { KV } = A.store;
  const { requestJson, NetError, online } = A.net;

  const DISCOVERED_KEY = 'discovered';
  const SYNC_TTL = 6 * 3600 * 1000; // 6h
  let syncing = false;

  const load = () => KV.get(DISCOVERED_KEY, { models: [], byProvider: {}, lastSync: 0 });
  let state = load();

  function save() {
    KV.set(DISCOVERED_KEY, state);
  }

  class ModelError extends Error {}

  const headersFor = (provider) => {
    const key = A.settings.key(provider.id);
    const h = {};
    if (key) h.Authorization = 'Bearer ' + key;
    if (provider.auth === 'x-api-key' && key) {
      h['x-api-key'] = key;
      delete h.Authorization;
    }
    if (provider.id === 'openrouter') {
      h['HTTP-Referer'] = location.origin || 'https://aishub.app';
      h['X-Title'] = "Ai'sHub";
    }
    if (provider.id === 'github') h.Accept = 'application/vnd.github+json';
    return h;
  };

  function baseUrlFor(provider) {
    const override = A.settings.get('providerOverrides')[provider.id];
    let url = (override && override.baseUrl) || provider.baseUrl;
    if (provider.lanes) {
      const lane = (override && override.account) || A.settings.get('providerOverrides')[provider.id]?.account || '';
      url = url.replace('{account}', lane || KV.get('cf:account', ''));
    }
    return url;
  }

  function deriveFlags(id = '') {
    const s = id.toLowerCase();
    return {
      free: /:free$|\bfree\b|-free\b/.test(s) || /flash|mini|nano|lite|tiny|small|instant/.test(s),
      vision: /vision|vl\b|-v\b|image|omni|pixtral|maverick|scout|gemma|gpt-4o|pixtral|llava|multimodal/.test(s),
      tools: !/embed|rerank|whisper|tts|stable-|flux|sdxl|dall|audio|guard|moderation/.test(s),
      reasoning: /reason|r1\b|thinking|think|o[134]|qwq|deepseek-r|grok-4|glm-4\.6|sonnet-4\.5/.test(s),
    };
  }

  const prettify = (id) =>
    id
      .split('/')
      .pop()
      .replace(/:free$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b(\w)/g, (m) => m.toUpperCase())
      .replace(/\bGpt\b/g, 'GPT')
      .replace(/\bGlm\b/g, 'GLM')
      .replace(/\bLlm\b/g, 'LLM')
      .replace(/\bQwen/g, 'Qwen')
      .trim();

  /** Map a provider /models payload to our model shape. */
  function normalize(provider, payload) {
    const entries = Array.isArray(payload)
      ? payload
      : payload?.data || payload?.models || payload?.result || [];
    const out = [];
    for (const entry of entries) {
      if (!entry) continue;
      if (typeof entry === 'string') {
        out.push(mk(provider, entry, entry, 0, {}));
        continue;
      }
      // Google's native shape uses name: "models/gemini-2.5-pro"
      const rawId = entry.id || entry.name || entry.model || '';
      if (!rawId) continue;
      const id = String(rawId).replace(/^models\//, '');
      if (/embed|rerank|whisper|tts|tts-|moderation|dall-e|guard|stable-diffusion|sdxl|flux|audio/i.test(id)) continue;
      const ctx =
        entry.context_length ||
        entry.context_window ||
        entry.input_token_limit ||
        entry.max_context_length ||
        entry.top_provider?.context_length ||
        entry.limits?.max_context_window_tokens ||
        0;
      const flags = deriveFlags(id);
      if (Array.isArray(entry.architecture?.input_modalities) && entry.architecture.input_modalities.includes('image')) flags.vision = true;
      if (Array.isArray(entry.supported_parameters) && entry.supported_parameters.includes('tools')) flags.tools = true;
      if (entry.capabilities?.function_calling) flags.tools = true;
      out.push(mk(provider, id, prettify(id), ctx, flags));
    }
    return out;
  }

  const mk = (provider, id, name, ctx = 0, flags = {}) => ({
    id,
    provider: provider.id,
    name,
    ctx,
    free: provider.local || provider.keyless || !!flags.free,
    vision: !!flags.vision,
    tools: !!flags.tools,
    reasoning: !!flags.reasoning,
    offline: !!provider.local,
    note: '',
    source: 'discovered',
  });

  async function discoverProvider(provider, { signal } = {}) {
    if (provider.local || !provider.modelsPath) return [];
    const url = baseUrlFor(provider).replace(/\/$/, '') + provider.modelsPath;
    const payload = await requestJson(url, {
      method: 'GET',
      headers: headersFor(provider),
      timeout: 15000,
      retries: 0,
      provider: provider.name,
      signal,
    });
    return normalize(provider, payload);
  }

  /**
   * Sync every eligible provider. Returns a summary.
   * New models are persisted and emitted on `models:new` for a toast.
   */
  async function syncAll({ force = false, signal, onProgress } = {}) {
    if (syncing) return { skipped: true };
    if (!online) return { offline: true, added: 0 };
    syncing = true;
    const summary = { added: 0, providers: {}, failures: [], newModels: [] };
    try {
      const known = new Set(A.catalog.models.map(A.catalog.keyFor));
      const eligible = A.catalog.providers.filter(
        (p) => !p.local && p.modelsPath && (p.keyless || A.settings.hasKey(p.id))
      );
      for (const provider of eligible) {
        if (signal?.aborted) break;
        onProgress?.(provider.name);
        try {
          const list = await discoverProvider(provider, { signal });
          if (!list.length) continue;
          state.byProvider[provider.id] = list;
          summary.providers[provider.id] = list.length;
          for (const m of list) {
            if (!known.has(A.catalog.keyFor(m))) {
              known.add(A.catalog.keyFor(m));
              summary.newModels.push(m);
            } else {
              // refresh metadata for existing rows so flags stay accurate
              const existing = A.catalog.find(A.catalog.keyFor(m));
              if (existing && !existing.source_meta) {
                existing.ctx = existing.ctx || m.ctx;
                existing.free = existing.free || m.free;
                existing.vision = existing.vision || m.vision;
                existing.tools = existing.tools || m.tools;
                existing.reasoning = existing.reasoning || m.reasoning;
              }
            }
          }
        } catch (err) {
          summary.failures.push({ provider: provider.id, message: err.message });
        }
      }
      summary.added = summary.newModels.length;
      // discovered models must be part of the merged catalog, not only of state
      state.models = Object.values(state.byProvider).flat();
      mergeIntoCatalog(summary.newModels);
      state.lastSync = Date.now();
      save();

      if (summary.newModels.length) {
        const seen = new Set(A.settings.get('seenModels') || []);
        const fresh = summary.newModels.filter((m) => !seen.has(A.catalog.keyFor(m)));
        const firstEver = !(A.settings.get('lastSync') || 0);
        // On the very first sync everything is "new"; don't badge the world.
        if (!firstEver) {
          A.settings.set('seenModels', [...seen, ...summary.newModels.map(A.catalog.keyFor)]);
          A.bus.emit('models:new', fresh.slice(0, 5));
        } else {
          markAllSeen();
        }
      }
      A.settings.set('lastSync', Date.now());
      A.bus.emit('models:synced', summary);
      return summary;
    } finally {
      syncing = false;
    }
  }

  /** Repo-driven catalog feed (optional). Accepts a JSON file with {models:[...]}. */
  async function syncFeed({ signal } = {}) {
    const feeds = A.settings.get('discoveryFeeds') || [];
    let added = 0;
    for (const url of feeds) {
      try {
        const data = await requestJson(url, { method: 'GET', timeout: 12000, retries: 0, signal });
        const rows = Array.isArray(data) ? data : data?.models || [];
        for (const row of rows) {
          if (!row?.provider || !row?.id) continue;
          if (!A.catalog.find(row.provider + ':' + row.id)) {
            state.models.push({
              id: row.id,
              provider: row.provider,
              name: row.name || prettify(row.id),
              ctx: row.ctx || 0,
              free: row.free !== false,
              vision: !!row.vision,
              tools: !!row.tools,
              reasoning: !!row.reasoning,
              offline: !!row.offline,
              note: row.note || '',
              source: 'feed',
            });
            added++;
          }
        }
      } catch (err) {
        console.warn('[discovery] feed failed', url, err.message);
      }
    }
    if (added) {
      state.lastSync = Date.now();
      save();
      A.bus.emit('models:synced', { added, feed: true });
    }
    return added;
  }

  /**
   * Newly discovered rows are appended to the in-memory preset list so
   * `A.catalog.all()` (used by the UI, picker and fallback ladder) sees them
   * without waiting for a reload. Deduped by provider:id.
   */
  function mergeIntoCatalog(models) {
    if (!Array.isArray(models) || !models.length) return;
    const known = new Set(A.catalog.models.map(A.catalog.keyFor));
    for (const m of models) {
      const key = A.catalog.keyFor(m);
      if (known.has(key)) continue;
      known.add(key);
      A.catalog.models.push(m);
    }
  }

  /** Mark every currently-known model as seen (clears NEW badges). */
  function markAllSeen() {
    A.settings.set('seenModels', A.catalog.all().map(A.catalog.keyFor));
  }

  const shouldAutoSync = () =>
    A.settings.get('autoSyncModels') && online && Date.now() - (A.settings.get('lastSync') || 0) > SYNC_TTL;

  A.discovery = {
    discovered: () => state.models || [],
    byProvider: () => state.byProvider,
    lastSync: () => state.lastSync,
    discoverProvider,
    syncAll,
    syncFeed,
    shouldAutoSync,
    mergeIntoCatalog,
    markAllSeen,
    normalize,
    deriveFlags,
    headersFor,
    baseUrlFor,
    prettify,
    ModelError,
    newBadgeKeys() {
      const seen = new Set(A.settings.get('seenModels') || []);
      return new Set(state.models.filter((m) => !seen.has(A.catalog.keyFor(m))).map(A.catalog.keyFor));
    },
    reset() {
      state = { models: [], byProvider: {}, lastSync: 0 };
      save();
    },
  };
})();
