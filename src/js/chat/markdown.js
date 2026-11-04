/* ════════════════════════════════════════════════════════════════
   Ai'sHub · markdown renderer
   Safe-by-default (escapes HTML first), supports headings, lists,
   tables, quotes, fenced code with copy buttons, links, task lists.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const esc = A.util.escapeHtml;

  const LANGS = {
    js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
    py: 'Python', python: 'Python', sh: 'Shell', bash: 'Shell', zsh: 'Shell', shell: 'Shell',
    json: 'JSON', html: 'HTML', css: 'CSS', sql: 'SQL', java: 'Java', kotlin: 'Kotlin',
    swift: 'Swift', go: 'Go', rust: 'Rust', c: 'C', cpp: 'C++', 'c++': 'C++', cs: 'C#',
    php: 'PHP', ruby: 'Ruby', yaml: 'YAML', yml: 'YAML', md: 'Markdown', text: 'Text',
    diff: 'Diff', xml: 'XML', dockerfile: 'Dockerfile', dart: 'Dart',
  };

  function inline(text) {
    let s = esc(text);
    // inline code first so its content isn't processed
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (_, code) => {
      codes.push(code);
      return `\u0000C${codes.length - 1}\u0000`;
    });
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
    return s;
  }

  function tableBlock(lines) {
    const rows = lines.map((l) =>
      l
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim())
    );
    const header = rows[0];
    const body = rows.slice(2); // skip separator
    const align = rows[1].map((c) => (/^:?-+:$/.test(c) ? (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left') : 'left'));
    return (
      '<table><thead><tr>' +
      header.map((h, i) => `<th style="text-align:${align[i] || 'left'}">${inline(h)}</th>`).join('') +
      '</tr></thead><tbody>' +
      body
        .map((r) => '<tr>' + r.map((c, i) => `<td style="text-align:${align[i] || 'left'}">${inline(c)}</td>`).join('') + '</tr>')
        .join('') +
      '</tbody></table>'
    );
  }

  function codeBlock(lang, code) {
    const label = LANGS[lang] || (lang ? lang.toUpperCase() : 'Code');
    return `<div class="code-block"><div class="code-head"><span>${esc(label)}</span><button class="code-copy" data-copy="${encodeURIComponent(code)}">Copy</button></div><pre><code>${esc(code)}</code></pre></div>`;
  }

  function render(md = '') {
    const src = String(md).replace(/\r\n/g, '\n');
    const lines = src.split('\n');
    const out = [];
    let i = 0;
    let listStack = [];
    let inQuote = false;

    const closeLists = () => {
      while (listStack.length) out.push(`</${listStack.pop()}>`);
    };

    while (i < lines.length) {
      const line = lines[i];

      // fenced code
      const fence = line.match(/^\s*(```|~~~)\s*([\w+#-]*)\s*$/);
      if (fence) {
        closeLists();
        const marker = fence[1];
        const lang = (fence[2] || '').toLowerCase();
        const buf = [];
        i++;
        while (i < lines.length && !new RegExp('^\\s*' + marker).test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        out.push(codeBlock(lang, buf.join('\n')));
        continue;
      }

      // blank line
      if (!line.trim()) {
        closeLists();
        i++;
        continue;
      }

      // horizontal rule
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        closeLists();
        out.push('<hr />');
        i++;
        continue;
      }

      // heading
      const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (h) {
        closeLists();
        const level = Math.min(6, h[1].length);
        out.push(`<h${level}>${inline(h[2])}</h${level}>`);
        i++;
        continue;
      }

      // table (header row + separator)
      if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:-]*\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        closeLists();
        const buf = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
          buf.push(lines[i]);
          i++;
        }
        out.push(tableBlock(buf));
        continue;
      }

      // blockquote
      if (/^\s*>\s?/.test(line)) {
        closeLists();
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push(`<blockquote>${render(buf.join('\n'))}</blockquote>`);
        continue;
      }

      // lists
      const ul = line.match(/^\s*([-*+])\s+(.*)$/);
      const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (ul || ol) {
        const type = ul ? 'ul' : 'ol';
        if (!listStack.length || listStack[listStack.length - 1] !== type) {
          closeLists();
          out.push(`<${type}>`);
          listStack.push(type);
        }
        let content = (ul ? ul[2] : ol[2]).trim();
        if (/^\[[ xX]\]\s+/.test(content)) {
          const done = /^\[[xX]\]/.test(content);
          content = `<span class="task-box ${done ? 'done' : ''}">${done ? '✓' : ''}</span> ` + content.replace(/^\[[ xX]\]\s+/, '');
        }
        out.push(`<li>${inline(content)}</li>`);
        i++;
        continue;
      }

      // paragraph
      closeLists();
      const buf = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^\s*(```|~~~|#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s)/.test(lines[i]) &&
        !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])
      ) {
        buf.push(lines[i]);
        i++;
      }
      if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
      else i++;
    }
    closeLists();
    return out.join('');
  }

  /** binds copy buttons inside a container (event delegation) */
  function bindCopy(container) {
    if (container.__copyBound) return;
    container.__copyBound = true;
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-copy]');
      if (!btn) return;
      const text = decodeURIComponent(btn.getAttribute('data-copy'));
      const ok = await A.util.copyText(text);
      const original = btn.textContent;
      btn.textContent = ok ? 'Copied' : 'Failed';
      setTimeout(() => (btn.textContent = original), 1400);
    });
  }

  A.markdown = { render, inline, bindCopy };
})();
