/* ════════════════════════════════════════════════════════════════
   Ai'sHub · unified AI client
   Routes a completion to the right place, and when a cloud call fails
   for a recoverable reason it silently tries the next best free model
   (same provider key → keyless free → other connected providers) and
   finally the on-device engine. The chat shows which brain answered.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;

  const LOCAL_PREFIX = 'aishub-';

  const isLocal = (model) => !model || model.provider === 'local' || String(model.id).startsWith(LOCAL_PREFIX);

  function resolveSelected() {
    const key = A.settings.get('selectedModel');
    const model = A.catalog.find(key);
    if (model) return model;
    const fallback = A.catalog.all().find((m) => m.provider === 'local');
    return fallback;
  }

  /** Is this model usable right now (network + key)? */
  function readiness(model) {
    if (!model) return { ready: false, reason: 'No model selected' };
    if (isLocal(model)) return { ready: true };
    const provider = A.catalog.providerById(model.provider);
    if (!provider) return { ready: false, reason: 'Unknown provider' };
    if (!A.net.online) return { ready: false, reason: 'Offline — on-device engine will answer' };
    if (!provider.keyless && !provider.local && !A.settings.hasKey(provider.id)) {
      return { ready: false, reason: `Add a ${provider.name} API key in Settings`, needsKey: provider.id };
    }
    return { ready: true };
  }

  /** Build a fallback ladder for a failed model. */
  function fallbackChain(failedModel) {
    const all = A.catalog.all();
    const chain = [];
    const pushUnique = (m) => {
      if (!m || chain.some((c) => A.catalog.keyFor(c) === A.catalog.keyFor(m))) return;
      if (failedModel && A.catalog.keyFor(m) === A.catalog.keyFor(failedModel)) return;
      if (!readiness(m).ready) return;
      chain.push(m);
    };

    // 1. same provider, free models first
    if (failedModel) {
      all.filter((m) => m.provider === failedModel.provider && m.free).slice(0, 2).forEach(pushUnique);
    }
    // 2. keyless free providers
    all.filter((m) => m.provider === 'pollinations').slice(0, 3).forEach(pushUnique);
    // 3. any connected provider's free models
    all.filter((m) => m.free && !isLocal(m)).slice(0, 4).forEach(pushUnique);
    // 4. whatever provider has a key (cheap models first)
    all.filter((m) => !isLocal(m)).slice(0, 3).forEach(pushUnique);
    // 5. on-device last resort — always kept, never sliced away
    const ladder = chain.slice(0, 4);
    const localModel = all.find(isLocal);
    if (localModel && !ladder.some((m) => A.catalog.keyFor(m) === A.catalog.keyFor(localModel))) {
      ladder.push(localModel);
    }
    return ladder;
  }

  /** Models worth trying before the on-device engine when the phone is online. */
  function cloudLadder(exclude) {
    const all = A.catalog.all().filter((m) => !isLocal(m) && readiness(m).ready);
    const rank = (m) => (m.provider === 'pollinations' ? 0 : m.free ? 1 : 2);
    return all
      .filter((m) => !exclude || A.catalog.keyFor(m) !== A.catalog.keyFor(exclude))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 4);
  }

  /** Cloud first: an LLM answer beats the local engine whenever a network exists. */
  function wantsCloud() {
    if (!A.net.online) return false;
    return A.settings.get('autoCloud') !== false;
  }

  /**
   * Complete a chat turn.
   * @param {object} opts
   * @param {Array} opts.messages   full message list ({role, content})
   * @param {object} [opts.model]   catalog model
   * @param {string} [opts.system]  system prompt
   * @param {Function} [opts.onDelta] streaming callback
   * @param {AbortSignal} [opts.signal]
   * @param {boolean} [opts.noFallback]
   * @param {Function} [opts.onFallback] called with {from,to,reason}
   */
  async function chat({ messages, model, system, onDelta, signal, noFallback = false, onFallback, temperature, maxTokens }) {
    const target = model || resolveSelected();
    const sys = system !== undefined ? system : buildSystemPrompt();

    if (isLocal(target)) {
      // The on-device engine is a fallback, not the default brain. With a network,
      // try a real model first so the app behaves like a proper agent.
      if (wantsCloud() && !noFallback) {
        for (const alt of cloudLadder(null)) {
          if (signal?.aborted) break;
          try {
            onFallback?.({ from: target, to: alt, reason: 'Using a cloud model' });
            const altProvider = A.catalog.providerById(alt.provider);
            const res = await A.providerClient.complete({
              provider: altProvider,
              modelId: alt.id,
              messages,
              system: sys,
              signal,
              onDelta,
              temperature,
              maxTokens,
            });
            if (res.text && res.text.trim()) {
              return { ...res, model: alt.id, provider: alt.provider, usedFallback: true, autoCloud: true, fallbackFrom: target };
            }
          } catch (e) {
            if (signal?.aborted) return Promise.reject(e);
            continue;
          }
        }
      }
      const res = await A.offlineEngine.chat({ messages, model: target?.id || 'aishub-core-1', onDelta, signal });
      return { ...res, model: target?.id || 'aishub-core-1', provider: 'local', usedFallback: false };
    }

    const provider = A.catalog.providerById(target.provider);
    try {
      const res = await A.providerClient.complete({
        provider,
        modelId: target.id,
        messages,
        system: sys,
        signal,
        onDelta,
        temperature,
        maxTokens,
      });
      if (!res.text || !res.text.trim()) throw new A.net.NetError('Empty response from provider', { provider: provider.name });
      return { ...res, model: target.id, provider: target.provider, usedFallback: false };
    } catch (err) {
      if (signal?.aborted) throw err;
      const recoverable = !(err && err.kind === 'config') && !(err.status === 401 || err.status === 403);
      if (noFallback || !recoverable) throw err;

      const chain = fallbackChain(target);
      for (const alt of chain) {
        if (signal?.aborted) throw err;
        onFallback?.({ from: target, to: alt, reason: A.net.friendlyMessage(err, provider?.name) });
        try {
          if (isLocal(alt)) {
            const res = await A.offlineEngine.chat({ messages, model: alt.id, onDelta, signal });
            return { ...res, model: alt.id, provider: 'local', usedFallback: true, fallbackFrom: target };
          }
          const altProvider = A.catalog.providerById(alt.provider);
          const res = await A.providerClient.complete({
            provider: altProvider,
            modelId: alt.id,
            messages,
            system: sys,
            signal,
            onDelta,
            temperature,
            maxTokens,
          });
          if (!res.text || !res.text.trim()) throw new A.net.NetError('Empty response', { provider: altProvider.name });
          return { ...res, model: alt.id, provider: alt.provider, usedFallback: true, fallbackFrom: target };
        } catch (e2) {
          if (signal?.aborted) throw err;
          continue;
        }
      }
      throw err;
    }
  }

  function buildSystemPrompt() {
    const custom = (A.settings.get('systemPrompt') || '').trim();
    const memories = A.settings.get('memoryEnabled') ? A.skills.memory.all().slice(0, 12) : [];
    const now = new Date();
    const parts = [
      "You are Ai'sHub, the user's personal AI assistant inside the Ai'sHub app (package com.aishub).",
      'Be direct, warm and useful. Prefer concrete steps, short paragraphs and Markdown formatting.',
      'When writing code, always use fenced blocks with the language tag.',
      'If something is uncertain, say so plainly instead of inventing details.',
      `Local time: ${now.toLocaleString()}.`,
    ];
    if (memories.length) parts.push('Things you remember about the user:\n' + memories.map((m) => '- ' + m.text).join('\n'));
    if (custom) parts.push('User instructions:\n' + custom);
    return parts.join('\n\n');
  }

  /** Quick "test connection" used by Settings. */
  async function testModel(modelKey) {
    const model = A.catalog.find(modelKey);
    const r = readiness(model);
    if (!r.ready && !isLocal(model)) return { ok: false, message: r.reason };
    try {
      const res = await chat({
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        model,
        onDelta: null,
        noFallback: true,
        maxTokens: 12,
        temperature: 0,
        signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined,
      });
      return { ok: true, text: res.text.trim().slice(0, 60), provider: res.provider, model: res.model };
    } catch (err) {
      return { ok: false, message: A.net.friendlyMessage(err, A.catalog.providerName(model.provider)) };
    }
  }

  A.ai = { chat, readiness, resolveSelected, isLocal, fallbackChain, buildSystemPrompt, testModel, LOCAL_PREFIX };
})();
