/* ════════════════════════════════════════════════════════════════
   Ai'sHub · OpenAI-compatible client
   One implementation drives 23 providers because they all speak
   /chat/completions. Handles auth styles, streaming, tool calls and
   provider-specific quirks (Cloudflare account lanes, GitHub tokens…).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;

  function headersFor(provider) {
    const key = A.settings.key(provider.id);
    const h = {};
    if (key) h.Authorization = 'Bearer ' + key;
    if (provider.id === 'openrouter') {
      h['HTTP-Referer'] = location.origin || 'https://aishub.app';
      h['X-Title'] = "Ai'sHub";
    }
    if (provider.id === 'github') h['X-GitHub-Api-Version'] = '2022-11-28';
    return h;
  }

  function endpointFor(provider) {
    const overrides = A.settings.get('providerOverrides') || {};
    const o = overrides[provider.id] || {};
    let base = (o.baseUrl || provider.baseUrl || '').replace(/\/$/, '');
    if (provider.lanes) {
      const account = o.account || A.store.KV.get('cf:account', '');
      if (!account) throw new A.net.NetError('Add your Cloudflare account ID in Settings → API keys.', { provider: provider.name, kind: 'config' });
      base = base.replace('{account}', account);
    }
    if (!base) throw new A.net.NetError('Set a base URL for this provider in Settings.', { provider: provider.name, kind: 'config' });
    return base + '/chat/completions';
  }

  function transformMessages(provider, messages, system) {
    const out = [];
    if (system) out.push({ role: 'system', content: system });
    for (const m of messages) {
      if (m.role === 'tool') {
        out.push({ role: 'user', content: `[tool result: ${m.name || 'tool'}]\n${m.content}` });
        continue;
      }
      if (m.role === 'assistant' && m.tool_calls) {
        out.push({ role: 'assistant', content: m.content || '' });
        continue;
      }
      out.push({ role: m.role, content: m.content });
    }
    // Perplexity rejects a leading system message on some plans; merge instead
    if (provider.id === 'perplexity' && out[0]?.role === 'system') {
      const sys = out.shift();
      if (out[0]?.role === 'user') out[0].content = `[Instructions: ${sys.content}]\n\n${out[0].content}`;
      else out.unshift({ role: 'user', content: sys.content });
    }
    return out;
  }

  /**
   * @returns {Promise<{text:string, usage?:object, model?:string, provider:string}>}
   */
  async function complete({ provider, modelId, messages, system, signal, onDelta, temperature, maxTokens, jsonMode }) {
    const url = endpointFor(provider);
    const body = {
      model: modelId,
      messages: transformMessages(provider, messages, system),
      stream: Boolean(onDelta) && provider.stream !== false,
      temperature: typeof temperature === 'number' ? temperature : A.settings.get('temperature'),
    };
    if (maxTokens) body.max_tokens = maxTokens;
    if (jsonMode) body.response_format = { type: 'json_object' };

    if (!body.stream) {
      const json = await A.net.requestJson(url, {
        method: 'POST',
        headers: headersFor(provider),
        body,
        provider: provider.name,
        signal,
        timeout: 90000,
        retries: 1,
      });
      const text =
        json?.choices?.[0]?.message?.content ??
        json?.choices?.[0]?.text ??
        json?.output?.text ??
        (typeof json === 'string' ? json : '');
      return { text: String(text || ''), usage: json?.usage, model: json?.model, provider: provider.id };
    }

    const res = await A.net.streamChat({
      url,
      headers: headersFor(provider),
      body,
      provider: provider.name,
      signal,
      timeout: 180000,
      onDelta,
    });
    return { ...res, provider: provider.id };
  }

  /** Cheap connectivity + key validation. */
  async function check(provider) {
    try {
      const base = A.discovery.baseUrlFor(provider).replace(/\/$/, '');
      await A.net.requestJson(base + (provider.modelsPath || '/models'), {
        method: 'GET',
        headers: headersFor(provider),
        timeout: 12000,
        retries: 0,
        provider: provider.name,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: A.net.friendlyMessage(err, provider.name), status: err.status || 0 };
    }
  }

  A.providerClient = { complete, check, headersFor, endpointFor };
})();
