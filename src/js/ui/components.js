/* ════════════════════════════════════════════════════════════════
   Ai'sHub · UI primitives
   Icons, toasts, sheets, modals, switches, prompt dialogs.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, attrs = {}, html = '') => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    });
    if (html) node.innerHTML = html;
    return node;
  };

  /* ─────────────── icons (24px stroke set) ─────────────── */
  const ICONS = {
    spark: '<path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/><circle cx="12" cy="12" r="3.2"/>',
    calc: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4"/>',
    swap: '<path d="M7 8h11l-3-3m3 11H7l3 3"/>',
    text: '<path d="M4 6h16M4 12h10M4 18h7"/>',
    note: '<path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M14 4v5h5"/>',
    memory: '<path d="M12 3a4 4 0 0 1 4 4v10a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4Z"/><path d="M9 9h6M9 13h6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4m8-4v4M3.5 10h17"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01M12 12h.01"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/>',
    check: '<path d="m5 13 4 4L19 7"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5S14.4 18.2 12 20.5C9.6 18.2 8.4 15.2 8.4 12S9.6 5.8 12 3.5Z"/>',
    plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a3 3 0 0 0-3 3v6.5A2.5 2.5 0 0 0 5.5 15"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h10l1-13"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/>',
    warn: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 10v5m0 3h.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5m0-8h.01"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-3 0 3 3m-6 0 3 3"/>',
    shield: '<path d="M12 3.5 5 6v6c0 4.2 3 7.6 7 8.5 4-.9 7-4.3 7-8.5V6l-7-2.5Z"/><path d="m9 12 2 2 4-4"/>',
    download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"/>',
    upload: '<path d="M12 20V9m0 0 4 4M12 9 8 13M5 5h14"/>',
    share: '<path d="M12 4v10m0-10 3.5 3.5M12 4 8.5 7.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>',
    pencil: '<path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z"/>',
    thumbUp: '<path d="M7 10v10H4V10h3Zm0 0 4-7a2 2 0 0 1 3 1.8V9h4.5a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.2 19H7"/>',
    thumbDown: '<path d="M17 14V4h3v10h-3Zm0 0-4 7a2 2 0 0 1-3-1.8V15H5.5a2 2 0 0 1-2-2.4l1.3-6A2 2 0 0 1 6.8 5H17"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3.5"/><path d="M12 4v4M8.5 14h.01M15.5 14h.01M9.5 17.5h5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm9 9-9 5-9-5m18 4.5-9 5-9-5"/>',
    wifiOff: '<path d="m3 3 18 18M8.5 15a5 5 0 0 1 7 0M5 11.5a10 10 0 0 1 3-1.7M19 11.5a10 10 0 0 0-4-2M2 8.5a15 15 0 0 1 4-2.2M22 8.5a15 15 0 0 0-6-2.6M12 19h.01"/>',
    dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5m0 14v2.5M2.5 12h2.5m14 0h2.5M5.2 5.2l1.8 1.8m10 10 1.8 1.8M5.2 18.8l1.8-1.8m10-10 1.8-1.8"/>',
    code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M13.5 4l-3 16"/>',
    quote: '<path d="M9 7H5.5A2.5 2.5 0 0 0 3 9.5v2A2.5 2.5 0 0 0 5.5 14H7v1.5A2.5 2.5 0 0 1 4.5 18M20 7h-3.5A2.5 2.5 0 0 0 14 9.5v2A2.5 2.5 0 0 0 16.5 14h1.5v1.5A2.5 2.5 0 0 1 15.5 18"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    route: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h5a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 0 0 7h6.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    translate: '<path d="M4 6h9M8.5 6v-2m0 2c0 4-2 6.5-4.5 8M6 9.5c1 2 3 3.5 5 4M13 20l4-11 4 11M14.5 16.5h5"/>',
    rocket: '<path d="M5 15c-1 2-1 4-1 5 1 0 3 0 5-1m-4-4 3 3M9 12c1-5 5-9 11-9 0 6-4 10-9 11l-2-2Z"/><circle cx="15" cy="9" r="1.6"/>',
  };

  const icon = (name, size) => {
    const path = ICONS[name] || ICONS.spark;
    const style = size ? ` style="width:${size}px;height:${size}px"` : '';
    return `<svg viewBox="0 0 24 24" aria-hidden="true"${style}>${path}</svg>`;
  };

  /* ─────────────── toast ─────────────── */
  let toastTimer;
  function toast(message, kind = '', ms = 2600) {
    const host = $('#toast-host');
    if (!host) return;
    const node = el('div', { class: `toast ${kind}` }, A.util.escapeHtml(message));
    host.appendChild(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 240);
    }, ms);
    while (host.children.length > 3) host.firstChild.remove();
    clearTimeout(toastTimer);
  }

  /* ─────────────── sheet ─────────────── */
  let sheetOpen = false;
  function openSheet(title, contentNodeOrHtml, { onClose } = {}) {
    const sheet = $('#sheet');
    const backdrop = $('#sheet-backdrop');
    $('#sheet-title').textContent = title;
    const body = $('#sheet-body');
    body.innerHTML = '';
    if (typeof contentNodeOrHtml === 'string') body.innerHTML = contentNodeOrHtml;
    else if (contentNodeOrHtml) body.appendChild(contentNodeOrHtml);
    sheet.hidden = false;
    backdrop.hidden = false;
    sheetOpen = true;
    sheet.__onClose = onClose;
    A.markdown.bindCopy(body);
  }

  function closeSheet() {
    const sheet = $('#sheet');
    const backdrop = $('#sheet-backdrop');
    if (!sheetOpen) return;
    sheet.hidden = true;
    backdrop.hidden = true;
    sheetOpen = false;
    const cb = sheet.__onClose;
    sheet.__onClose = null;
    if (cb) cb();
  }

  /* ─────────────── modal / confirm ─────────────── */
  function modal({ title, body, actions = [], dismissible = true }) {
    return new Promise((resolve) => {
      const m = $('#modal');
      const bd = $('#modal-backdrop');
      $('#modal-title').textContent = title || '';
      const bodyEl = $('#modal-body');
      bodyEl.innerHTML = '';
      if (typeof body === 'string') bodyEl.innerHTML = body;
      else if (body) bodyEl.appendChild(body);
      const actionsEl = $('#modal-actions');
      actionsEl.innerHTML = '';
      const finish = (value) => {
        m.hidden = true;
        bd.hidden = true;
        m.__finish = null;
        resolve(value);
      };
      m.__finish = dismissible ? () => finish(null) : null;
      actions.forEach((a) => {
        const btn = el('button', { class: `btn ${a.class || 'btn-ghost'}` }, A.util.escapeHtml(a.label));
        btn.addEventListener('click', async () => {
          if (a.onClick) {
            const res = await a.onClick();
            if (res === false) return;
          }
          finish(a.value !== undefined ? a.value : a.label);
        });
        actionsEl.appendChild(btn);
      });
      m.hidden = false;
      bd.hidden = false;
      const firstInput = bodyEl.querySelector('input, textarea, select');
      if (firstInput) setTimeout(() => firstInput.focus(), 80);
    });
  }

  const confirmDialog = (title, message, { okLabel = 'Confirm', danger = false } = {}) =>
    modal({
      title,
      body: `<p>${A.util.escapeHtml(message)}</p>`,
      actions: [
        { label: 'Cancel', value: false },
        { label: okLabel, class: danger ? 'btn-danger' : 'btn-primary', value: true },
      ],
    });

  function promptDialog({ title, label = '', placeholder = '', value = '', multiline = false, okLabel = 'Save', hint = '' }) {
    const wrap = el('div');
    wrap.innerHTML = `
      ${label ? `<div class="field"><label>${A.util.escapeHtml(label)}</label></div>` : ''}
      ${multiline
        ? `<textarea class="input" id="dlg-input" rows="4" placeholder="${A.util.escapeAttr(placeholder)}">${A.util.escapeHtml(value)}</textarea>`
        : `<input class="input" id="dlg-input" value="${A.util.escapeAttr(value)}" placeholder="${A.util.escapeAttr(placeholder)}" />`}
      ${hint ? `<div class="hint" style="margin-top:8px">${A.util.escapeHtml(hint)}</div>` : ''}`;
    return modal({
      title,
      body: wrap,
      actions: [
        { label: 'Cancel', value: null },
        {
          label: okLabel,
          class: 'btn-primary',
          onClick: () => {
            const input = wrap.querySelector('#dlg-input');
            return input.value.trim() ? input.value.trim() : false;
          },
          value: '__input__',
        },
      ],
    }).then((res) => {
      const input = wrap.querySelector('#dlg-input');
      return res === '__input__' || res ? input.value.trim() : null;
    });
  }

  /* ─────────────── form controls ─────────────── */
  function switchRow({ label, sub, checked, onChange, id }) {
    const row = el('div', { class: 'switch-row' });
    row.innerHTML = `<div><div class="label">${A.util.escapeHtml(label)}</div>${sub ? `<div class="sub">${A.util.escapeHtml(sub)}</div>` : ''}</div>`;
    const sw = el('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!checked), 'aria-label': label, id });
    sw.addEventListener('click', () => {
      const next = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(next));
      onChange(next);
    });
    row.appendChild(sw);
    return row;
  }

  function sliderRow({ label, min, max, step = 1, value, format = (v) => v, onChange }) {
    const row = el('div', { class: 'slider-row' });
    row.innerHTML = `<div class="label"><span>${A.util.escapeHtml(label)}</span><output>${format(value)}</output></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" />`;
    const input = row.querySelector('input');
    const out = row.querySelector('output');
    input.addEventListener('input', () => {
      out.textContent = format(+input.value);
      onChange(+input.value);
    });
    return row;
  }

  function segmented(items, active, onPick) {
    const wrap = el('div', { class: 'segmented' });
    items.forEach((item) => {
      const b = el('button', { class: item.value === active ? 'is-active' : '' }, A.util.escapeHtml(item.label));
      b.addEventListener('click', () => {
        [...wrap.children].forEach((c) => c.classList.remove('is-active'));
        b.classList.add('is-active');
        onPick(item.value);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  /** Full-screen confirm for destructive or agent actions. */
  function approveStep(step) {
    return modal({
      title: 'Agent wants to run a step',
      body: `<p><strong>${A.util.escapeHtml(step.skill)}</strong></p>
        <p class="small muted" style="margin-top:6px">${A.util.escapeHtml(step.why || '')}</p>
        <pre class="mono" style="margin-top:10px;padding:10px;border-radius:10px;background:var(--surface-2);overflow:auto;max-height:140px">${A.util.escapeHtml(JSON.stringify(step.input, null, 2))}</pre>`,
      actions: [
        { label: 'Skip', value: false },
        { label: 'Run step', class: 'btn-primary', value: true },
      ],
    }).then((v) => v === true);
  }

  A.ui = {
    $, $$, el, icon, toast,
    openSheet, closeSheet, isSheetOpen: () => sheetOpen,
    modal, confirmDialog, promptDialog, switchRow, sliderRow, segmented, approveStep,
    ICONS,
  };
})();
