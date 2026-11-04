/* ════════════════════════════════════════════════════════════════
   Ai'sHub · networking
   - JSON fetch with timeouts + retries + friendly errors
   - SSE streaming parser (OpenAI-compatible `data: {...}` chunks)
   - online/offline awareness
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { sleep } = A.util;

  class NetError extends Error {
    constructor(message, { status = 0, provider = '', retryable = false, kind = 'network' } = {}) {
      super(message);
      this.name = 'NetError';
      this.status = status;
      this.provider = provider;
      this.retryable = retryable;
      this.kind = kind;
    }
  }

  const friendlyMessage = (err, providerLabel = 'the provider') => {
    if (!navigator.onLine) return 'You are offline. Ai\'sHub switched to the on-device engine — or connect and retry.';
    if (err instanceof NetError) {
      if (err.status === 401 || err.status === 403) return `${providerLabel} rejected the API key. Open Settings → API keys to update it.`;
      if (err.status === 402) return `${providerLabel} says this account is out of credit. Try a free model or another provider.`;
      if (err.status === 404) return `${providerLabel} could not find that model. Try syncing models in the Models tab.`;
      if (err.status === 429) return `${providerLabel} rate limit reached (free tiers are limited). Retrying, or switch model.`;
      if (err.status >= 500) return `${providerLabel} is having trouble (HTTP ${err.status}). Retrying.`;
      if (err.kind === 'timeout') return `${providerLabel} took too long to answer. Check your connection and try again.`;
      return err.message;
    }
    if (err && err.name === 'AbortError') return 'Stopped.';
    return (err && err.message) || 'Something went wrong.';
  };

  /**
   * fetch JSON with timeout + retries.
   * @returns parsed JSON (or text when not JSON)
   */
  async function requestJson(url, options = {}) {
    const {
      method = 'POST',
      headers = {},
      body,
      timeout = 45000,
      retries = 1,
      provider = '',
      signal,
    } = options;

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(new NetError('timeout', { kind: 'timeout', provider })), timeout);
      const onAbort = () => ctrl.abort(signal.reason);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      try {
        const res = await fetch(url, {
          method,
          headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
          body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
          signal: ctrl.signal,
          cache: 'no-store',
          mode: 'cors',
          credentials: 'omit',
        });
        clearTimeout(timer);
        const text = await res.text();
        if (!res.ok) {
          let detail = '';
          try {
            const j = JSON.parse(text);
            detail = j.error?.message || j.message || j.error || '';
            if (typeof detail === 'object') detail = JSON.stringify(detail);
          } catch (_) {
            detail = text.slice(0, 220);
          }
          const err = new NetError(detail || `HTTP ${res.status}`, {
            status: res.status,
            provider,
            retryable: res.status === 429 || res.status >= 500,
          });
          if (err.retryable && attempt < retries) {
            lastErr = err;
            // free tiers rate-limit hard; 429 deserves a longer, respected pause
            await sleep((res.status === 429 ? 2500 : 800) * (attempt + 1));
            continue;
          }
          throw err;
        }
        try {
          return JSON.parse(text);
        } catch (_) {
          return text;
        }
      } catch (err) {
        clearTimeout(timer);
        if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const normalized =
          err instanceof NetError
            ? err
            : err.name === 'AbortError'
              ? new NetError('timeout', { kind: 'timeout', provider, retryable: true })
              : new NetError(err.message || 'Network request failed', { provider, retryable: true });
        if (attempt < retries && normalized.retryable) {
          lastErr = normalized;
          await sleep(700 * (attempt + 1));
          continue;
        }
        throw normalized;
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
    }
    throw lastErr || new NetError('Request failed', { provider });
  }

  /**
   * Streams an OpenAI-compatible chat completion.
   * Falls back to a normal (non-streamed) request when the server ignores `stream`.
   *
   * @param {object} opts
   * @param {(delta:string, full:string)=>void} opts.onDelta
   * @returns {Promise<{text:string, usage?:object, model?:string}>}
   */
  async function streamChat(opts) {
    const {
      url,
      headers = {},
      body,
      onDelta = () => {},
      timeout = 120000,
      provider = '',
      signal,
    } = opts;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new NetError('timeout', { kind: 'timeout', provider })), timeout);
    const onAbort = () => ctrl.abort(signal.reason);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }, headers),
        body: JSON.stringify(body),
        signal: ctrl.signal,
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let detail = '';
        try {
          const j = JSON.parse(text);
          detail = j.error?.message || j.message || j.error || '';
        } catch (_) {
          detail = text.slice(0, 240);
        }
        throw new NetError(detail || `HTTP ${res.status}`, { status: res.status, provider, retryable: res.status >= 500 || res.status === 429 });
      }

      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.body || ctype.includes('application/json') || (!ctype.includes('event-stream') && !ctype.includes('text/plain'))) {
        // non-streaming response
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (_) {}
        const full = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text ?? text;
        onDelta(full, full);
        return { text: full, usage: json?.usage, model: json?.model };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let usage = null;
      let model = null;

      const handleLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) return;
        if (!trimmed.startsWith('data:')) return;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        let json;
        try {
          json = JSON.parse(payload);
        } catch (_) {
          return;
        }
        if (json.error) throw new NetError(json.error.message || 'stream error', { provider, status: 502 });
        model = json.model || model;
        usage = json.usage || usage;
        const choice = json.choices?.[0];
        const delta = choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? '';
        if (delta) {
          full += delta;
          onDelta(delta, full);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          handleLine(line);
        }
      }
      if (buffer.trim()) handleLine(buffer);
      return { text: full, usage, model };
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  /** Quick reachability probe used to pick the fastest free provider. */
  async function probe(url, { timeout = 5000, headers = {} } = {}) {
    const started = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      await fetch(url, { method: 'GET', headers, signal: ctrl.signal, cache: 'no-store', mode: 'cors' });
      clearTimeout(timer);
      return { ok: true, ms: Math.round(performance.now() - started) };
    } catch (err) {
      return { ok: false, ms: Math.round(performance.now() - started), error: err.message };
    }
  }

  A.net = {
    NetError,
    requestJson,
    streamChat,
    probe,
    friendlyMessage,
    get online() {
      return navigator.onLine !== false;
    },
  };
})();
