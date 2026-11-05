/* ════════════════════════════════════════════════════════════════
   Ai'sHub · core utilities
   Small dependency-free helpers shared by every module.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = (window.A = window.A || {});

  A.VERSION = '__APP_VERSION__';
  A.BUILD = '__BUILD_ID__';

  const uid = (prefix = '') =>
    prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const escapeHtml = (s = '') =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const escapeAttr = (s = '') => escapeHtml(s).replace(/`/g, '&#96;');

  function debounce(fn, ms = 200) {
    let t;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  function throttle(fn, ms = 100) {
    let last = 0;
    let timer = null;
    return (...args) => {
      const now = Date.now();
      const wait = Math.max(0, ms - (now - last));
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, wait);
    };
  }

  /** Rough token estimate (~4 chars/token for latin, ~1.6 for CJK). */
  function estimateTokens(text = '') {
    if (!text) return 0;
    const cjk = (text.match(/[\u3000-\u9fff\uac00-\ud7af]/g) || []).length;
    const rest = text.length - cjk;
    return Math.ceil(cjk / 1.6 + rest / 4);
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function fmtRelative(ts) {
    const diff = Date.now() - ts;
    if (diff < 60e3) return 'now';
    if (diff < 3600e3) return Math.floor(diff / 60e3) + 'm';
    if (diff < 86400e3) return Math.floor(diff / 3600e3) + 'h';
    if (diff < 7 * 86400e3) return Math.floor(diff / 86400e3) + 'd';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtCount(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  /** tiny stable string hash (for cache-busting / dedupe) */
  function hash(str = '') {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function truncate(str = '', n = 120) {
    return str.length > n ? str.slice(0, n - 1).trimEnd() + '…' : str;
  }

  function slugify(str = '') {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'item';
  }

  function titleFrom(text = '') {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return 'New chat';
    return truncate(clean.replace(/^(hi|hey|hello)[,!.\s]+/i, ''), 52) || 'New chat';
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function groupBy(list, keyFn) {
    return list.reduce((acc, item) => {
      const key = keyFn(item);
      (acc[key] = acc[key] || []).push(item);
      return acc;
    }, {});
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  function download(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** Reads a File into a data: URL (used for images / small text attachments). */
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('read failed'));
      fr.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('read failed'));
      fr.readAsText(file);
    });
  }

  function sanitizeJsonParse(text, fallback = null) {
    try {
      return JSON.parse(text);
    } catch (_) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch (__) {}
      }
      return fallback;
    }
  }

  function stripFences(text = '') {
    return text.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '').replace(/\n```\s*$/, '');
  }

  function isBlank(v) {
    return v === undefined || v === null || (typeof v === 'string' && !v.trim());
  }

  /* Unicode-aware word matchers. A \p{...} REGEX LITERAL is a parse error on an Android
     WebView older than Chrome 64 — and a parse error blanks the entire app, so the pattern
     is built at runtime and degrades to ASCII where the engine cannot do better. */
  let wordReCache = null;
  let notWordReCache = null;
  function wordRe() {
    if (!wordReCache) {
      try { wordReCache = new RegExp("[\\p{L}\\p{N}'\u2019-]+", 'gu'); }
      catch (e) { wordReCache = /[A-Za-z0-9'\u2019-]+/g; }
    }
    return wordReCache;
  }
  function notWordRe() {
    if (!notWordReCache) {
      try { notWordReCache = new RegExp('[^\\p{L}\\p{N}\\s+#]', 'gu'); }
      catch (e) { notWordReCache = /[^A-Za-z0-9\s+#]/g; }
    }
    return notWordReCache;
  }

  A.util = {
    uid, clamp, sleep, escapeHtml, escapeAttr, debounce, throttle, estimateTokens,
    fmtTime, fmtRelative, fmtDate, fmtCount, hash, truncate, slugify, titleFrom, pick,
    groupBy, copyText, download, readFileAsDataUrl, readFileAsText, sanitizeJsonParse,
    stripFences, isBlank, wordRe, notWordRe,
  };
})();
