/* ════════════════════════════════════════════════════════════════
   Ai'sHub · model catalog
   100+ presets across 24 providers. Everything here is a *seed*:
   discovery.js refreshes live lists from each provider on sync and
   merges new models automatically (so future releases show up by
   themselves). Flags: f=free, v=vision, t=tools, r=reasoning.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;

  const P = (id, name, opts = {}) => ({
    id,
    name,
    baseUrl: opts.baseUrl || '',
    docs: opts.docs || '',
    keysUrl: opts.keysUrl || '',
    keyless: !!opts.keyless,
    local: !!opts.local,
    lanes: !!opts.lanes, // provider needs an account id inside the URL
    modelsPath: opts.modelsPath === undefined ? '/models' : opts.modelsPath,
    stream: opts.stream !== false,
    note: opts.note || '',
    initials: opts.initials || name.slice(0, 2).toUpperCase(),
    accent: opts.accent || '#7c5cff',
    auth: opts.auth || 'bearer',
  });

  const providers = [
    P('local', "Ai'sHub Local", {
      local: true, keyless: true, modelsPath: '', accent: '#22d3ee',
      initials: 'AH',
      note: 'Runs 100% on this device. No account, no network, no limits.',
    }),
    P('pollinations', 'Pollinations', {
      baseUrl: 'https://text.pollinations.ai/openai', keyless: true, accent: '#f9a8d4',
      initials: 'PO', docs: 'https://pollinations.ai',
      note: 'Keyless free models. Works the moment you open the app.',
    }),
    P('openrouter', 'OpenRouter', {
      baseUrl: 'https://openrouter.ai/api/v1', accent: '#a78bfa',
      keysUrl: 'https://openrouter.ai/keys', initials: 'OR',
      note: 'One key, hundreds of models. Rows ending in :free cost nothing.',
    }),
    P('google', 'Google Gemini', {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', accent: '#60a5fa',
      keysUrl: 'https://aistudio.google.com/apikey', initials: 'GE',
      note: 'Generous free tier. Free-tier prompts may be used to improve Google models.',
    }),
    P('groq', 'Groq', {
      baseUrl: 'https://api.groq.com/openai/v1', accent: '#fb923c',
      keysUrl: 'https://console.groq.com/keys', initials: 'GQ',
      note: 'Extremely fast free tier (30 req/min).',
    }),
    P('cerebras', 'Cerebras', {
      baseUrl: 'https://api.cerebras.ai/v1', accent: '#fbbf24',
      keysUrl: 'https://cloud.cerebras.ai', initials: 'CB',
      note: 'Fastest open-model inference. Trial credit.',
    }),
    P('mistral', 'Mistral AI', {
      baseUrl: 'https://api.mistral.ai/v1', accent: '#f97316',
      keysUrl: 'https://console.mistral.ai/api-keys', initials: 'MI',
      note: 'Free experimental tier on most models.',
    }),
    P('nvidia', 'NVIDIA NIM', {
      baseUrl: 'https://integrate.api.nvidia.com/v1', accent: '#76b900',
      keysUrl: 'https://build.nvidia.com', initials: 'NV',
      note: 'Free developer access to large open models.',
    }),
    P('github', 'GitHub Models', {
      baseUrl: 'https://models.github.ai/inference', accent: '#e5e7eb',
      keysUrl: 'https://github.com/settings/tokens', initials: 'GH', auth: 'bearer',
      note: 'Uses a GitHub token. Free tier is included with your account.',
    }),
    P('together', 'Together AI', {
      baseUrl: 'https://api.together.xyz/v1', accent: '#38bdf8',
      keysUrl: 'https://api.together.ai/settings/api-keys', initials: 'TG',
    }),
    P('deepseek', 'DeepSeek', {
      baseUrl: 'https://api.deepseek.com/v1', accent: '#4d6bfe',
      keysUrl: 'https://platform.deepseek.com/api_keys', initials: 'DS',
      note: 'Very cheap reasoning models.',
    }),
    P('xai', 'xAI', {
      baseUrl: 'https://api.x.ai/v1', accent: '#e5e7eb',
      keysUrl: 'https://console.x.ai', initials: 'XA',
    }),
    P('fireworks', 'Fireworks AI', {
      baseUrl: 'https://api.fireworks.ai/inference/v1', accent: '#f472b6',
      keysUrl: 'https://fireworks.ai/account/api-keys', initials: 'FW',
    }),
    P('hyperbolic', 'Hyperbolic', {
      baseUrl: 'https://api.hyperbolic.xyz/v1', accent: '#34d399',
      keysUrl: 'https://app.hyperbolic.xyz/settings', initials: 'HY',
    }),
    P('sambanova', 'SambaNova', {
      baseUrl: 'https://api.sambanova.ai/v1', accent: '#f87171',
      keysUrl: 'https://cloud.sambanova.ai/apis', initials: 'SN',
    }),
    P('cohere', 'Cohere', {
      baseUrl: 'https://api.cohere.ai/compatibility/v1', accent: '#d946ef',
      keysUrl: 'https://dashboard.cohere.com/api-keys', initials: 'CO',
      note: 'Free trial keys include rate-limited generation.',
    }),
    P('perplexity', 'Perplexity', {
      baseUrl: 'https://api.perplexity.ai', accent: '#22d3ee',
      keysUrl: 'https://www.perplexity.ai/settings/api', initials: 'PP',
      note: 'Answers include live web results.',
    }),
    P('moonshot', 'Moonshot / Kimi', {
      baseUrl: 'https://api.moonshot.ai/v1', accent: '#a3e635',
      keysUrl: 'https://platform.moonshot.ai/console/api-keys', initials: 'MS',
    }),
    P('zhipu', 'Z.ai / GLM', {
      baseUrl: 'https://api.z.ai/api/paas/v4', accent: '#818cf8',
      keysUrl: 'https://z.ai/manage-apikey/apikey-list', initials: 'GL',
    }),
    P('cloudflare', 'Cloudflare Workers AI', {
      baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1',
      lanes: true, accent: '#f6821f', keysUrl: 'https://dash.cloudflare.com/profile/api-tokens',
      initials: 'CF', note: 'Needs your Cloudflare account ID plus an API token.',
    }),
    P('ollama', 'Ollama (your computer)', {
      baseUrl: 'http://localhost:11434/v1', accent: '#a3a3a3', keyless: true,
      initials: 'OL', note: 'Link Ai\'sHub to Ollama running on your PC or LAN.',
    }),
    P('lmstudio', 'LM Studio (your computer)', {
      baseUrl: 'http://localhost:1234/v1', accent: '#f472b6', keyless: true,
      initials: 'LM', note: 'Local server from LM Studio.',
    }),
    P('llamacpp', 'llama.cpp server', {
      baseUrl: 'http://localhost:8080/v1', accent: '#94a3b8', keyless: true,
      initials: 'LC', note: 'llama.cpp / KoboldCpp / vLLM compatible server.',
    }),
    P('custom', 'Custom endpoint', {
      baseUrl: '', accent: '#7c5cff', initials: 'CX', keyless: true,
      note: 'Any OpenAI-compatible URL.',
    }),
  ];

  const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

  /* compact model rows: [provider, id, display name, context, flags, note?] */
  const rows = [
    // ── offline, on-device ─────────────────────────────────────
    ['local', 'aishub-core-1', "Ai'sHub Core (on-device)", 128000, 'f', 'Balanced everyday assistant'],
    ['local', 'aishub-code-1', "Ai'sHub Code (on-device)", 128000, 'f', 'Programming focused'],
    ['local', 'aishub-write-1', "Ai'sHub Writer (on-device)", 128000, 'f', 'Drafting, editing, rewriting'],
    ['local', 'aishub-tutor-1', "Ai'sHub Tutor (on-device)", 128000, 'f', 'Explains step by step'],
    ['local', 'aishub-agent-1', "Ai'sHub Agent (on-device)", 128000, 'ft', 'Plans and uses built-in skills'],

    // ── Pollinations (keyless) ─────────────────────────────────
    ['pollinations', 'openai-fast', 'OpenAI Fast (Pollen)', 128000, 'f', 'Fastest keyless option'],
    ['pollinations', 'openai', 'OpenAI (Pollen)', 128000, 'f'],
    ['pollinations', 'openai-large', 'OpenAI Large (Pollen)', 128000, 'f'],
    ['pollinations', 'gemini', 'Gemini (Pollen)', 128000, 'f'],
    ['pollinations', 'gemini-fast', 'Gemini Fast (Pollen)', 128000, 'f'],
    ['pollinations', 'deepseek', 'DeepSeek (Pollen)', 128000, 'f'],
    ['pollinations', 'mistral', 'Mistral (Pollen)', 32000, 'f'],
    ['pollinations', 'qwen-coder', 'Qwen Coder (Pollen)', 32000, 'f'],
    ['pollinations', 'llama', 'Llama (Pollen)', 32000, 'f'],
    ['pollinations', 'grok', 'Grok (Pollen)', 128000, 'f'],
    ['pollinations', 'searchgpt', 'SearchGPT (Pollen, web)', 128000, 'f'],

    // ── OpenRouter ─────────────────────────────────────────────
    ['openrouter', 'deepseek/deepseek-chat-v3.1:free', 'DeepSeek V3.1', 163840, 'ft'],
    ['openrouter', 'deepseek/deepseek-r1:free', 'DeepSeek R1 (reasoning)', 163840, 'fr'],
    ['openrouter', 'qwen/qwen3-coder:free', 'Qwen3 Coder', 262144, 'ft'],
    ['openrouter', 'qwen/qwen3-235b-a22b:free', 'Qwen3 235B A22B', 131072, 'ftr'],
    ['openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B', 131072, 'f'],
    ['openrouter', 'meta-llama/llama-4-maverick:free', 'Llama 4 Maverick', 128000, 'fv'],
    ['openrouter', 'meta-llama/llama-4-scout:free', 'Llama 4 Scout', 328000, 'fv'],
    ['openrouter', 'google/gemma-3-27b-it:free', 'Gemma 3 27B', 96000, 'fv'],
    ['openrouter', 'google/gemini-2.0-flash-exp:free', 'Gemini 2.0 Flash Exp', 1048576, 'fv'],
    ['openrouter', 'mistralai/mistral-small-3.2-24b-instruct:free', 'Mistral Small 3.2', 128000, 'ftv'],
    ['openrouter', 'moonshotai/kimi-k2:free', 'Kimi K2', 131072, 'ft'],
    ['openrouter', 'z-ai/glm-4.5-air:free', 'GLM 4.5 Air', 131072, 'ft'],
    ['openrouter', 'openai/gpt-oss-20b:free', 'GPT-OSS 20B', 131072, 'ft'],
    ['openrouter', 'openai/gpt-oss-120b:free', 'GPT-OSS 120B', 131072, 'ftr'],
    ['openrouter', 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free', 'Nemotron Ultra 253B', 131072, 'fr'],
    ['openrouter', 'anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5', 200000, 'tvr'],
    ['openrouter', 'anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 200000, 'tvr'],
    ['openrouter', 'openai/gpt-5', 'GPT-5', 400000, 'tvr'],
    ['openrouter', 'openai/gpt-5-mini', 'GPT-5 mini', 400000, 'tvr'],
    ['openrouter', 'google/gemini-2.5-pro', 'Gemini 2.5 Pro', 1048576, 'tvr'],
    ['openrouter', 'google/gemini-2.5-flash', 'Gemini 2.5 Flash', 1048576, 'tvr'],
    ['openrouter', 'x-ai/grok-4', 'Grok 4', 256000, 'tvr'],
    ['openrouter', 'mistralai/mistral-large-2411', 'Mistral Large', 131072, 't'],
    ['openrouter', 'openrouter/auto', 'OpenRouter Auto', 2000000, 'ftv', 'Router picks the best free model'],

    // ── Google Gemini ──────────────────────────────────────────
    ['google', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 1048576, 'ftvr'],
    ['google', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 1048576, 'ftvr'],
    ['google', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', 1048576, 'ftv'],
    ['google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 1048576, 'ftv'],
    ['google', 'gemini-2.0-flash-lite', 'Gemini 2.0 Flash Lite', 1048576, 'ft'],
    ['google', 'gemma-3-27b-it', 'Gemma 3 27B', 131072, 'fv'],
    ['google', 'gemma-3-12b-it', 'Gemma 3 12B', 131072, 'fv'],

    // ── Groq ───────────────────────────────────────────────────
    ['groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile', 131072, 'ft'],
    ['groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B Instant', 131072, 'ft'],
    ['groq', 'openai/gpt-oss-120b', 'GPT-OSS 120B', 131072, 'ftr'],
    ['groq', 'openai/gpt-oss-20b', 'GPT-OSS 20B', 131072, 'ft'],
    ['groq', 'qwen/qwen3-32b', 'Qwen3 32B', 131072, 'ftr'],
    ['groq', 'moonshotai/kimi-k2-instruct', 'Kimi K2 Instruct', 131072, 'ft'],
    ['groq', 'meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout', 131072, 'ftv'],
    ['groq', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'Llama 4 Maverick', 131072, 'ftv'],
    ['groq', 'deepseek-r1-distill-llama-70b', 'DeepSeek R1 Distill 70B', 131072, 'fr'],

    // ── Cerebras ───────────────────────────────────────────────
    ['cerebras', 'llama-3.3-70b', 'Llama 3.3 70B', 131072, 'ft'],
    ['cerebras', 'llama3.1-8b', 'Llama 3.1 8B', 131072, 'ft'],
    ['cerebras', 'qwen-3-32b', 'Qwen3 32B', 131072, 'ft'],
    ['cerebras', 'gpt-oss-120b', 'GPT-OSS 120B', 131072, 'ftr'],

    // ── Mistral ────────────────────────────────────────────────
    ['mistral', 'mistral-large-latest', 'Mistral Large', 131072, 'ft'],
    ['mistral', 'mistral-small-latest', 'Mistral Small', 131072, 'ft'],
    ['mistral', 'ministral-8b-latest', 'Ministral 8B', 131072, 'ft'],
    ['mistral', 'codestral-latest', 'Codestral', 262144, 'ft'],
    ['mistral', 'devstral-medium-latest', 'Devstral (coding agent)', 131072, 'ft'],
    ['mistral', 'pixtral-large-latest', 'Pixtral Large (vision)', 131072, 'fv'],

    // ── NVIDIA NIM ─────────────────────────────────────────────
    ['nvidia', 'nvidia/llama-3.3-nemotron-super-49b-v1', 'Nemotron Super 49B', 131072, 'fr'],
    ['nvidia', 'meta/llama-3.3-70b-instruct', 'Llama 3.3 70B', 131072, 'f'],
    ['nvidia', 'deepseek-ai/deepseek-r1', 'DeepSeek R1', 131072, 'fr'],
    ['nvidia', 'qwen/qwen2.5-coder-32b-instruct', 'Qwen2.5 Coder 32B', 32768, 'f'],
    ['nvidia', 'mistralai/mistral-large-2-instruct', 'Mistral Large 2', 131072, 'f'],

    // ── GitHub Models ──────────────────────────────────────────
    ['github', 'openai/gpt-4.1', 'GPT-4.1 (GitHub)', 128000, 'ftv'],
    ['github', 'openai/gpt-4o', 'GPT-4o (GitHub)', 128000, 'ftv'],
    ['github', 'openai/gpt-4o-mini', 'GPT-4o mini (GitHub)', 128000, 'ftv'],
    ['github', 'meta/Llama-4-Scout-17B-16E-Instruct', 'Llama 4 Scout (GitHub)', 128000, 'fv'],
    ['github', 'mistral-ai/mistral-small-2503', 'Mistral Small 3.1 (GitHub)', 128000, 'ft'],

    // ── Together ───────────────────────────────────────────────
    ['together', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Llama 3.3 70B Turbo', 131072, 'ft'],
    ['together', 'Qwen/Qwen3-235B-A22B-fp8-tput', 'Qwen3 235B', 131072, 'ft'],
    ['together', 'deepseek-ai/DeepSeek-R1', 'DeepSeek R1', 131072, 'fr'],
    ['together', 'moonshotai/Kimi-K2-Instruct', 'Kimi K2', 131072, 'ft'],

    // ── DeepSeek ───────────────────────────────────────────────
    ['deepseek', 'deepseek-chat', 'DeepSeek Chat', 131072, 'ft'],
    ['deepseek', 'deepseek-reasoner', 'DeepSeek Reasoner', 131072, 'fr'],

    // ── xAI ────────────────────────────────────────────────────
    ['xai', 'grok-4', 'Grok 4', 256000, 'tvr'],
    ['xai', 'grok-3', 'Grok 3', 131072, 't'],
    ['xai', 'grok-3-mini', 'Grok 3 mini', 131072, 'tr'],
    ['xai', 'grok-2-vision-1212', 'Grok 2 Vision', 32768, 'v'],

    // ── Fireworks ──────────────────────────────────────────────
    ['fireworks', 'accounts/fireworks/models/llama-v3p3-70b-instruct', 'Llama 3.3 70B', 131072, 'ft'],
    ['fireworks', 'accounts/fireworks/models/deepseek-r1', 'DeepSeek R1', 131072, 'fr'],
    ['fireworks', 'accounts/fireworks/models/qwen3-235b-a22b', 'Qwen3 235B', 131072, 'fr'],

    // ── Hyperbolic ─────────────────────────────────────────────
    ['hyperbolic', 'meta-llama/Llama-3.3-70B-Instruct', 'Llama 3.3 70B', 131072, 'f'],
    ['hyperbolic', 'deepseek-ai/DeepSeek-R1', 'DeepSeek R1', 131072, 'fr'],
    ['hyperbolic', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen2.5 72B', 32768, 'f'],

    // ── SambaNova ──────────────────────────────────────────────
    ['sambanova', 'Meta-Llama-3.3-70B-Instruct', 'Llama 3.3 70B', 131072, 'f'],
    ['sambanova', 'DeepSeek-R1', 'DeepSeek R1', 131072, 'fr'],
    ['sambanova', 'Llama-4-Maverick-17B-128E-Instruct', 'Llama 4 Maverick', 131072, 'fv'],

    // ── Cohere ─────────────────────────────────────────────────
    ['cohere', 'command-a-03-2025', 'Command A', 256000, 'ft'],
    ['cohere', 'command-r-plus-08-2024', 'Command R+', 128000, 'ft'],
    ['cohere', 'command-r7b-12-2024', 'Command R7B', 128000, 'ft'],

    // ── Perplexity ─────────────────────────────────────────────
    ['perplexity', 'sonar', 'Sonar (web answers)', 127072, 'f'],
    ['perplexity', 'sonar-pro', 'Sonar Pro (web answers)', 200000, 'f'],
    ['perplexity', 'sonar-reasoning', 'Sonar Reasoning', 127072, 'fr'],

    // ── Moonshot / Kimi ────────────────────────────────────────
    ['moonshot', 'kimi-k2-0905-preview', 'Kimi K2', 131072, 'ft'],
    ['moonshot', 'moonshot-v1-128k', 'Moonshot 128k', 131072, 'f'],
    ['moonshot', 'moonshot-v1-8k', 'Moonshot 8k', 8192, 'f'],

    // ── Z.ai GLM ───────────────────────────────────────────────
    ['zhipu', 'glm-4.6', 'GLM-4.6', 200000, 'ftr'],
    ['zhipu', 'glm-4.5', 'GLM-4.5', 131072, 'ft'],
    ['zhipu', 'glm-4.5-air', 'GLM-4.5 Air', 131072, 'ft'],
    ['zhipu', 'glm-4-flash', 'GLM-4 Flash (free)', 131072, 'f'],

    // ── Cloudflare Workers AI ──────────────────────────────────
    ['cloudflare', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Llama 3.3 70B (CF)', 24000, 'f'],
    ['cloudflare', '@cf/qwen/qwen2.5-coder-32b-instruct', 'Qwen2.5 Coder 32B (CF)', 32000, 'f'],
    ['cloudflare', '@cf/mistralai/mistral-small-3.1-24b-instruct', 'Mistral Small 3.1 (CF)', 128000, 'f'],
    ['cloudflare', '@cf/google/gemma-3-12b-it', 'Gemma 3 12B (CF)', 80000, 'fv'],

    // ── self-hosted servers ────────────────────────────────────
    ['ollama', 'llama3.2', 'Llama 3.2 (Ollama)', 131072, 'f', 'Edit the model name to anything you pulled'],
    ['ollama', 'qwen2.5-coder', 'Qwen2.5 Coder (Ollama)', 32768, 'f'],
    ['ollama', 'mistral', 'Mistral (Ollama)', 32768, 'f'],
    ['ollama', 'phi4', 'Phi-4 (Ollama)', 16384, 'f'],
    ['lmstudio', 'local-model', 'Current LM Studio model', 32768, 'f'],
    ['llamacpp', 'local-model', 'Current llama.cpp model', 32768, 'f'],
  ];

  const models = rows.map(([provider, id, name, ctx, flags = '', note = '']) => ({
    id,
    provider,
    name: name || id,
    ctx: ctx || 0,
    free: flags.includes('f'),
    vision: flags.includes('v'),
    tools: flags.includes('t'),
    reasoning: flags.includes('r'),
    offline: provider === 'local',
    note,
    source: 'preset',
  }));

  /** Human label for a provider id. */
  const providerName = (id) => (byId[id] ? byId[id].name : id);
  const providerById = (id) => byId[id] || null;
  const keyFor = (model) => (model ? model.provider + ':' + model.id : '');

  A.catalog = {
    providers,
    providerById,
    providerName,
    keyFor,
    models,
    /** merged view: presets + discovered + custom, deduped by provider:id */
    all() {
      const S = A.settings;
      const seen = new Set();
      const out = [];
      const push = (m) => {
        const k = keyFor(m);
        if (seen.has(k)) return;
        seen.add(k);
        out.push(m);
      };
      for (const m of models) push(m);
      for (const m of (A.discovery && A.discovery.discovered()) || []) push(m);
      for (const m of S.get('customModels') || []) push(m);
      return out;
    },
    find(key) {
      return A.catalog.all().find((m) => keyFor(m) === key) || null;
    },
    /** Drop runtime-discovered rows (used by Settings → Reset). */
    dropDiscovered() {
      const onlyPresets = A.catalog.models.filter((m) => (m.source || 'preset') === 'preset');
      A.catalog.models.length = 0;
      A.catalog.models.push(...onlyPresets);
    },
  };
})();
