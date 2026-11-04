/* ════════════════════════════════════════════════════════════════
   Ai'sHub · on-device engine
   A genuinely local responder: intent classification → local tools
   (maths, converters, text tools, planners, knowledge base) →
   structured Markdown answer. No network path exists in this file.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { escapeHtml, sleep, pick, fmtDate, fmtTime } = A.util;

  /* ───────────────────────── maths ───────────────────────── */
  const MATH_WORDS = [
    [/\bplus\b/g, '+'], [/\bminus\b/g, '-'], [/\btimes\b|\bmultiplied by\b/g, '*'],
    [/\bdivided by\b|\bover\b/g, '/'], [/\bpower of\b|\braised to\b/g, '^'],
    [/×/g, '*'], [/÷/g, '/'], [/−/g, '-'], [/²/g, '^2'], [/³/g, '^3'],
  ];

  const FN = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor,
    ceil: Math.ceil, sin: (x) => Math.sin(x), cos: Math.cos, tan: Math.tan,
    log: Math.log10, ln: Math.log, exp: Math.exp, min: Math.min, max: Math.max,
    pow: Math.pow, fact: (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  };
  const CONST = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

  /** Tokenizer + shunting-yard evaluator (no eval, no Function). */
  function evalMath(expr) {
    const src = String(expr).toLowerCase();
    const tokens = src.match(/\d+\.?\d*|\.\d+|[a-z]+|[+\-*/%^()!,]/g) || [];
    const out = [];
    const ops = [];
    const prec = { '+': 2, '-': 2, '*': 3, '/': 3, '%': 3, '^': 4, '!': 5, ',': 0, '(': 0 };
    const rightAssoc = { '^': true, '!': true };
    let prev = null;
    let unary = true;
    for (const tok of tokens) {
      if (/^\d/.test(tok) || /^\.\d/.test(tok)) {
        out.push(parseFloat(tok));
        unary = false;
      } else if (tok in CONST) {
        out.push(CONST[tok]);
        unary = false;
      } else if (tok in FN) {
        ops.push(tok);
        unary = true;
        prev = tok;
        continue;
      } else if (tok === '(') {
        ops.push('(');
        unary = true;
      } else if (tok === ')') {
        while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
        if (!ops.length) throw new Error('unbalanced )');
        ops.pop();
        if (ops.length && ops[ops.length - 1] in FN) out.push(ops.pop());
        unary = false;
      } else if (tok === ',') {
        while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
        unary = false;
      } else if (tok in prec) {
        let op = tok;
        if (op === '-' && unary) op = 'neg';
        if (op === '+' && unary) { prev = tok; continue; }
        const p = op === 'neg' ? 4 : prec[tok];
        while (
          ops.length &&
          ops[ops.length - 1] !== '(' &&
          !(ops[ops.length - 1] in FN) &&
          ((prec[ops[ops.length - 1]] > p) ||
            (prec[ops[ops.length - 1]] === p && !rightAssoc[op]))
        ) {
          out.push(ops.pop());
        }
        ops.push(op);
        unary = true;
      }
      prev = tok;
    }
    while (ops.length) {
      const op = ops.pop();
      if (op === '(') throw new Error('unbalanced (');
      out.push(op);
    }

    const stack = [];
    for (const tok of out) {
      if (typeof tok === 'number') {
        stack.push(tok);
      } else if (tok in FN) {
        const a = stack.pop();
        if (a === undefined) throw new Error('missing argument');
        stack.push(FN[tok](a));
      } else if (tok === 'neg') {
        stack.push(-stack.pop());
      } else if (tok === '!') {
        stack.push(FN.fact(stack.pop()));
      } else {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) throw new Error('incomplete expression');
        switch (tok) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(a / b); break;
          case '%': stack.push(a % b); break;
          case '^': stack.push(Math.pow(a, b)); break;
          default: throw new Error('unknown operator ' + tok);
        }
      }
    }
    if (stack.length !== 1 || !isFinite(stack[0])) {
      if (stack.length === 1 && !isFinite(stack[0])) throw new Error('result is not a finite number');
      throw new Error('could not evaluate');
    }
    return stack[0];
  }

  const fmtNum = (n) => {
    if (Number.isInteger(n)) return n.toLocaleString('en-US');
    const abs = Math.abs(n);
    if (abs !== 0 && (abs < 1e-6 || abs >= 1e12)) return n.toExponential(4);
    return parseFloat(n.toFixed(8)).toLocaleString('en-US', { maximumFractionDigits: 8 });
  };

  /* ───────────────────────── units ───────────────────────── */
  const UNITS = {
    length: { base: 'm', m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, mile: 1609.344, miles: 1609.344, ft: 0.3048, foot: 0.3048, feet: 0.3048, in: 0.0254, inch: 0.0254, inches: 0.0254, yd: 0.9144, yard: 0.9144, nmi: 1852 },
    mass: { base: 'kg', kg: 1, g: 0.001, mg: 0.000001, t: 1000, tonne: 1000, lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237, oz: 0.028349523125, ounce: 0.028349523125, stone: 6.35029318 },
    volume: { base: 'l', l: 1, litre: 1, liter: 1, ml: 0.001, cl: 0.01, dl: 0.1, m3: 1000, gal: 3.785411784, gallon: 3.785411784, qt: 0.946352946, pt: 0.473176473, cup: 0.2365882365, floz: 0.0295735296, tbsp: 0.0147867648, tsp: 0.00492892159 },
    time: { base: 's', s: 1, sec: 1, second: 1, min: 60, minute: 60, h: 3600, hr: 3600, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 },
    data: { base: 'byte', byte: 1, bytes: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776 },
    speed: { base: 'mps', mps: 1, kmh: 1 / 3.6, mph: 0.44704, knot: 0.514444, knots: 0.514444, fps: 0.3048 },
  };

  function convertUnits(value, from, to) {
    const f = from.toLowerCase().replace(/\./g, '');
    const t = to.toLowerCase().replace(/\./g, '');
    if (['c', 'celsius', 'f', 'fahrenheit', 'k', 'kelvin'].includes(f) && ['c', 'celsius', 'f', 'fahrenheit', 'k', 'kelvin'].includes(t)) {
      const toC = (v) => (f.startsWith('f') ? (v - 32) * 5 / 9 : f.startsWith('k') ? v - 273.15 : v);
      const c = toC(value);
      const out = t.startsWith('f') ? c * 9 / 5 + 32 : t.startsWith('k') ? c + 273.15 : c;
      return { value: out, kind: 'temperature', from: f, to: t };
    }
    for (const [kind, table] of Object.entries(UNITS)) {
      if (table[f] !== undefined && table[t] !== undefined) {
        return { value: (value * table[f]) / table[t], kind, from: f, to: t };
      }
    }
    return null;
  }

  /* ───────────────────────── intent ───────────────────────── */
  const INTENTS = [
    ['greet', /^(hi|hey|hello|yo|sup|hola|salam|assalam|hiya|good (morning|afternoon|evening))\b/i],
    ['identity', /(who are you|what are you|your name|are you (chatgpt|gpt|claude|gemini|human|real|ai)|introduce yourself|what can you do|what do you do)/i],
    ['thanks', /(thank|thanks|thx|appreciate)/i],
    ['bye', /^(bye|goodbye|see you|good night|ok bye)/i],
    ['capacity', /(are you (free|online|offline)|do you work offline|is (it|this|the app) free|how much do (you|it) cost|unlimited|no subscription|really free)/i],
    ['keyhelp', /(api key|apikey|connect (a )?(model|provider)|provider|add key|gemini key|groq key|openrouter key)/i],
    ['math', /^[\d\s().+\-*/%^!]+$|(\d[\d\s.,]*\s*[+\-*/^%]\s*\d)|(\bcalculate\b|\bcompute\b|\bevaluate\b|\bwhat is\s+\d|\bsolve\b.*\d|% of |\bsquare root\b|\bsqrt\b)/i],
    ['convert', /(convert|how many (cm|mm|km|miles|feet|inches|kg|grams|pounds|lbs|liters|gallons|celsius|fahrenheit)|\b\d+\s*(km|cm|mm|mi|miles|feet|ft|inches|in|kg|g|lbs?|oz|liters?|gallons?|celsius|fahrenheit)\s*(to|in)\b)/i],
    ['datetime', /(what(?:'s| is) the (time|date)|today'?s date|what day is it|current time)/i],
    ['random', /(roll|dice|coin flip|flip a coin|random number|pick a number|password|generate.*(password|uuid))/i],
    ['wordcount', /(word count|count words|how many words|character count|letter count)/i],
    ['casemorph', /(uppercase|lowercase|capitalize|title case|reverse (the )?(text|string)|slugify)/i],
    ['code', /(code|function|script|program|class|bug|error|exception|javascript|typescript|python|java\b|kotlin|swift|c\+\+|html|css|sql|regex|api|algorithm|react|node|git|bash|docker|syntax|compile)/i],
    ['write', /(write|draft|compose|email|letter|essay|article|blog|post|caption|story|poem|resume|cv|cover letter|speech|script|summary|summarize)/i],
    ['plan', /(plan|itinerary|schedule|roadmap|checklist|routine|budget|workout|study plan|trip)/i],
    ['translate', /(translate|in (bengali|bangla|hindi|arabic|spanish|french|german|urdu|chinese|japanese)|how do you say)/i],
    ['brainstorm', /(brainstorm|ideas|name ideas|suggest|give me \d+|list of|examples of)/i],
    ['decide', /(should i|pros and cons|decide|choose between|which is better|compare)/i],
    ['joke', /(joke|funny|make me laugh|riddle|pun)/i],
    ['explain', /(explain|what is|what are|how does|how do|why is|why do|define|meaning of|tell me about)/i],
  ];

  function classify(text) {
    const t = text.trim();
    // unit conversions are detected structurally (both units must be known)
    if (parseConversion(t)) return 'convert';
    for (const [name, re] of INTENTS) {
      if (re.test(t)) return name;
    }
    return 'general';
  }

  /* ───────────────────────── helpers ───────────────────────── */
  const bullets = (items) => items.map((s) => '- ' + s).join('\n');
  const numbered = (items) => items.map((s, i) => `${i + 1}. ${s}`).join('\n');

  function extractExpression(text) {
    let t = ' ' + text.toLowerCase() + ' ';
    for (const [re, rep] of MATH_WORDS) t = t.replace(re, rep);
    // "15% of 240" → (15/100*240)
    t = t.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100*$2)');
    // strip polite framing
    t = t.replace(/\b(what is|what's|whats|calculate|compute|evaluate|solve|please|the value of|how much is|equals?|answer|result|tell me|find|get)\b/g, ' ');
    t = t.replace(/(\d),(\d{3})/g, '$1$2');
    // drop ordinary words, keep function names and constants
    t = t.replace(/[a-z]{2,}/g, (w) => (w in FN || w in CONST ? w : ' '));
    // keep only math characters, normalise spacing
    let expr = t.replace(/[^0-9a-z.+\-*/%^()!,]/g, '').replace(/\s+/g, '');
    if (!expr || !/\d/.test(expr)) return null;
    const hasOperator = /[-+*/%^!]/.test(expr);
    const hasFn = /(sqrt|cbrt|abs|round|floor|ceil|sin|cos|tan|log|ln|exp|min|max|pow|fact)\(/.test(expr);
    if (!hasOperator && !hasFn) return null;
    if (expr.length > 160) return null;
    return expr;
  }

  function parseConversion(text) {
    const t = text.toLowerCase().replace(/,/g, '');
    const m =
      t.match(/(-?\d+(?:\.\d+)?)\s*°?\s*([a-z]{1,8})\s*(?:to|in|into|=)\s*°?\s*([a-z]{1,8})\b/) ||
      t.match(/(?:convert|change)\s+(-?\d+(?:\.\d+)?)\s*°?\s*([a-z]{1,8})\s*(?:to|into|in)\s*°?\s*([a-z]{1,8})\b/);
    if (!m) {
      const q = t.match(/how many ([a-z]+)\s+(?:are\s+)?in\s+(-?\d+(?:\.\d+)?)\s*([a-z]+)/);
      if (q) return convertUnits(parseFloat(q[2]), q[3], q[1]);
      return null;
    }
    const value = parseFloat(m[1]);
    const from = m[2].replace(/°/g, '');
    const to = m[3].replace(/°/g, '');
    return convertUnits(value, from, to);
  }

  function extractCodeLanguage(text) {
    const t = text.toLowerCase();
    const langs = ['python', 'javascript', 'typescript', 'html', 'css', 'sql', 'java', 'kotlin', 'swift', 'go', 'rust', 'c++', 'c#', 'php', 'ruby', 'bash', 'dart', 'react'];
    return langs.find((l) => t.includes(l)) || (t.includes('py') ? 'python' : 'javascript');
  }

  /* ───────────────────────── answer builders ───────────────────────── */

  const CODE_SNIPPETS = {
    python: `\`\`\`python
"""Starter module — replace the TODOs with your logic."""
from dataclasses import dataclass


@dataclass
class Item:
    name: str
    qty: int = 1


def total(items: list[Item]) -> int:
    return sum(i.qty for i in items)


def main() -> None:
    items = [Item("notebook", 2), Item("pen")]
    print(f"items: {len(items)}, total qty: {total(items)}")


if __name__ == "__main__":
    main()
\`\`\`

Run it with \`python main.py\`. Add type hints as you go — they catch most mistakes before runtime.`,
    javascript: `\`\`\`js
// Starter module — swap the TODOs for your logic.
export function createStore(initial = {}) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const store = createStore({ count: 0 });
store.subscribe((s) => console.log('state', s));
store.set({ count: 1 });
\`\`\`

Debug tip: log objects (\`console.log({ yourVar })\`) so the key names travel with the values.`,
    html: `\`\`\`html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Page</title>
  <style>
    body { font-family: system-ui; margin: 0; display: grid; place-items: center; min-height: 100dvh; }
    .card { padding: 24px; border-radius: 16px; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="card"><h1>Hello</h1><p>Replace this with your content.</p></div>
</body>
</html>
\`\`\``,
    css: `\`\`\`css
/* Responsive card grid */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.card {
  padding: 16px;
  border-radius: 16px;
  background: var(--surface, #fff);
  box-shadow: 0 8px 24px -16px rgba(0,0,0,.5);
}
@media (max-width: 480px) {
  .card { border-radius: 12px; }
}
\`\`\``,
    sql: `\`\`\`sql
-- Parameterised, safe query
SELECT u.id, u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= ?
GROUP BY u.id, u.name
HAVING COUNT(o.id) > ?
ORDER BY orders DESC
LIMIT 50;
\`\`\``,
    bash: `\`\`\`bash
#!/usr/bin/env bash
set -euo pipefail

target="\${1:-.}"
echo "scanning $target"
find "$target" -type f -name '*.log' -mtime +7 -print -delete
echo "done"
\`\`\``,
    java: `\`\`\`java
public final class Main {
    public static void main(String[] args) {
        var greeter = new Greeter("Ai'sHub");
        System.out.println(greeter.greet());
    }
}

record Greeter(String name) {
    String greet() { return "Hello from " + name; }
}
\`\`\``,
    kotlin: `\`\`\`kotlin
fun main() {
    val items = listOf("a", "b", "c")
    items.map { it.uppercase() }
        .forEach(::println)
}
\`\`\``,
    typescript: `\`\`\`ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parseNumber(input: string): Result<number> {
  const n = Number(input);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: 'not a number' };
}

const r = parseNumber('42');
if (r.ok) console.log(r.value * 2);
\`\`\``,
  };

  function codeAnswer(text) {
    const lang = extractCodeLanguage(text);
    const isDebug = /(bug|error|exception|not working|fix|crash|fail)/i.test(text);
    const snippet = CODE_SNIPPETS[lang] || CODE_SNIPPETS.javascript;
    if (isDebug) {
      return `## Debugging plan

I can't see your code yet — paste it (plus the exact error text) and I'll go line by line. Meanwhile, this sequence finds most bugs:

${numbered([
  '**Reproduce** the smallest failing case and note the exact input.',
  '**Read the first error line** — the deepest frame *in your own files* is where it broke.',
  '**Log the real values** before the failure: `console.log({ input, ids })`.',
  '**Bisect** — disable half the code path, test, repeat.',
  '**Rebuild the block** in 5 lines; mismatched types/null/empty are the usual suspects.',
  '**Re-test** the failing case plus one that must stay working.',
])}

### Logging template
\`\`\`
TRACE  start        input=…
TRACE  step 1       value=…
ERROR  step 2       reason=…
\`\`\`

Paste the snippet and error and I'll pinpoint it.`;
    }
    return `## ${lang[0].toUpperCase() + lang.slice(1)} starter

${snippet}

### How to take it further
${bullets([
  'Name the single outcome the code must produce, then write one test for it.',
  'Keep functions under ~20 lines and one job each.',
  'Handle the error path first — failures teach you the real shape of the data.',
  'Commit small: one change, one message.',
])}

For repo-specific help, connect a cloud model (Models tab) — bigger models read whole files and explain trade-offs well. I can still help offline with syntax, structure and logic.`;
  }

  function greetAnswer() {
    const h = new Date().getHours();
    const time = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return `${time}! I'm **Ai'sHub**, running **on your device right now** — no internet, no API key, no limits.

${bullets([
  '**Chat mode** for questions, writing, code and study help.',
  '**Agent mode** for goals — I plan, use built-in skills and report back.',
  '**Models tab** to reach 118+ cloud models, including free keyless ones.',
])}

What are we working on?`;
  }

  function identityAnswer() {
    return `## Ai'sHub — built to be yours

I'm the **on-device engine** of Ai'sHub, answering you locally. I'm not ChatGPT or Claude: I'm a compact, offline-first assistant with real local tools (maths, converters, text tools, planners, a knowledge base) and a clean handoff to 118+ cloud models when you want deeper reasoning.

**Right now I can**
${bullets([
  'Do arithmetic, unit conversion, dates, random picks and passwords — exactly.',
  'Explain a solid set of science, maths, coding, writing and life topics.',
  'Draft emails, letters, plans, checklists and study routines.',
  'Count words, change case, summarise pasted text.',
  'Plan and run agent tasks with built-in skills, fully offline.',
])}

**When you need more**, tap the model chip at the top: free keyless models work immediately, or add a free API key for Gemini, Groq, OpenRouter and others.

Readiness: **offline-ready** · **no account** · **no tracking**.`;
  }

  function mathAnswer(text) {
    const expr = extractExpression(text);
    if (!expr) return null;
    let value;
    try {
      value = evalMath(expr);
    } catch (_) {
      return null;
    }
    const pretty = expr.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ').replace(/\^/g, ' ^ ');
    let extra = '';
    if (Number.isInteger(value) && Math.abs(value) < 1e9) {
      extra = `\n\n- ${Math.abs(value) % 2 === 0 ? 'Even' : 'Odd'}${value > 1 ? ` · Prime check: ${isPrime(value) ? 'prime' : 'not prime'}` : ''}`;
    }
    return `## Result

\`\`\`
${pretty.trim()} = ${fmtNum(value)}
\`\`\`

**Answer: ${fmtNum(value)}**${extra}

Want the working shown step by step, or the same sum with different numbers? Just say so.`;
  }

  function isPrime(n) {
    if (!Number.isInteger(n) || n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
    return true;
  }

  function convertAnswer(text) {
    const parsed = parseConversion(text);
    if (!parsed) return null;
    const kindLabel = parsed.kind === 'temperature' ? 'Temperature' : parsed.kind[0].toUpperCase() + parsed.kind.slice(1);
    return `## Conversion

\`\`\`
${parsed.from} → ${parsed.to}: ${fmtNum(parsed.value)}
\`\`\`

**${kindLabel}:** the result is **${fmtNum(parsed.value)} ${parsed.to}**.

${parsed.kind === 'data' ? 'Note: I treat KB/MB/GB as decimal (1000-based). Use KiB/MiB/GiB for 1024-based.' : 'Ask for another unit and I\'ll convert it instantly — this runs on-device.'}`;
  }

  function datetimeAnswer() {
    const now = new Date();
    return `## Right now

- **Date:** ${fmtDate(now.getTime())}
- **Time:** ${fmtTime(now.getTime())}
- **Day:** ${now.toLocaleDateString(undefined, { weekday: 'long' })}
- **Timezone:** ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'device local'}
- **Week number:** ${Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)}`;
  }

  function randomAnswer(text) {
    const t = text.toLowerCase();
    if (/password/.test(t)) {
      const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+';
      const bytes = new Uint32Array(20);
      crypto.getRandomValues(bytes);
      const pw = Array.from(bytes, (b) => chars[b % chars.length]).join('');
      return `## Fresh password (generated on-device)

\`\`\`
${pw}
\`\`\`

Strength: **20 characters**, mixed case + digits + symbols (~131 bits of entropy). Generated with \`crypto.getRandomValues\`, never sent anywhere.

Store it in a real password manager — not in chat history.`;
    }
    if (/uuid/.test(t)) {
      const id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
      return `## UUID v4\n\n\`\`\`\n${id}\n\`\`\`\n\nGenerated locally.`;
    }
    if (/coin/.test(t)) {
      return `## Coin flip\n\n**${pick(['Heads', 'Tails'])}** 🪙\n\n(Random from your device's CSPRNG.)`;
    }
    const m = t.match(/(\d+)\s*(?:to|-|and)\s*(\d+)/);
    if (m) {
      const lo = Math.min(+m[1], +m[2]);
      const hi = Math.max(+m[1], +m[2]);
      return `## Random number\n\n**${lo + Math.floor(Math.random() * (hi - lo + 1))}** (between ${lo} and ${hi}, inclusive)`;
    }
    if (/dice|roll/.test(t)) {
      const sides = +(t.match(/d(\d+)/)?.[1] || t.match(/(\d+)\s*-?\s*sided/)?.[1] || 6);
      const n = +(t.match(/(\d+)d\d/)?.[1] || 1);
      const rolls = Array.from({ length: Math.min(n, 20) }, () => 1 + Math.floor(Math.random() * sides));
      return `## Dice roll\n\n${rolls.map((r) => `**${r}**`).join(' · ')}\n\nTotal: **${rolls.reduce((a, b) => a + b, 0)}** (${n}d${sides})`;
    }
    const n = 100;
    return `## Random pick\n\n**${1 + Math.floor(Math.random() * n)}** (1–${n}). Tell me a range like "1 to 6" for a specific one.`;
  }

  function wordCountAnswer(text) {
    const body = text.replace(/^(word count|count words|how many words).*?[:]\s*/i, '').replace(/^(word count|count words|how many words.*)$/i, '');
    const sample = body.length > 3 ? body : text;
    const words = (sample.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    const chars = sample.length;
    const charsNoSpace = sample.replace(/\s/g, '').length;
    const sentences = (sample.match(/[.!?]+(?:\s|$)/g) || []).length || (sample.trim() ? 1 : 0);
    const paragraphs = sample.split(/\n{2,}/).filter((p) => p.trim()).length || (sample.trim() ? 1 : 0);
    const readingMin = Math.max(1, Math.round(words / 220));
    const speakingMin = Math.max(1, Math.round(words / 130));
    return `## Text statistics

| Metric | Value |
| --- | --- |
| Words | **${words}** |
| Characters | ${chars} (${charsNoSpace} without spaces) |
| Sentences | ${sentences} |
| Paragraphs | ${paragraphs} |
| Reading time | ~${readingMin} min |
| Speaking time | ~${speakingMin} min |
| Avg words/sentence | ${sentences ? (words / sentences).toFixed(1) : '—'} |

Paste the text after "count words:" and I'll measure that instead.`;
  }

  function caseAnswer(text) {
    const t = text.toLowerCase();
    const quoted = text.match(/["“']([^"”']{2,})["”']/);
    const sample = quoted ? quoted[1] : text.replace(/^(convert|make|change|turn)?.*?(uppercase|lowercase|title case|capitalize|reverse|slugify)[: ]*/i, '').trim();
    const body = sample || 'Ai\'sHub offline engine';
    const rows = [
      ['UPPERCASE', body.toUpperCase()],
      ['lowercase', body.toLowerCase()],
      ['Title Case', body.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())],
      ['Sentence case', body.charAt(0).toUpperCase() + body.slice(1).toLowerCase()],
      ['slug', body.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')],
      ['reversed', [...body].reverse().join('')],
    ];
    return `## Text transformations

${rows.map(([k, v]) => `**${k}**\n\`\`\`\n${v}\n\`\`\``).join('\n')}

${/uppercase/.test(t) ? 'Tap copy on any block to grab it.' : 'Quote the text you want transformed and I\'ll redo all six.'}`;
  }

  function planAnswer(text) {
    const t = text.toLowerCase();
    if (/budget|money|save|expense/.test(t)) {
      const amount = +(t.match(/(\d[\d,]{2,})/)?.[1] || '').toString().replace(/,/g, '') || 30000;
      const needs = amount * 0.5, wants = amount * 0.3, save = amount * 0.2;
      return `## Budget for ${fmtNum(amount)}

| Bucket | Share | Amount |
| --- | --- | --- |
| Needs (rent, food, transport, utilities) | 50% | **${fmtNum(needs)}** |
| Wants (eating out, subscriptions, fun) | 30% | ${fmtNum(wants)} |
| Savings + debt payoff | 20% | ${fmtNum(save)} |

### Make it survive the month
${numbered([
  'Move the savings amount out on payday, automatically.',
  'Track only the *wants* bucket daily — that is where leakage lives.',
  'Cancel one subscription you did not use in 30 days.',
  'Build a 3-month essentials buffer before investing.',
])}

Adjust the split in Settings-free form: tell me your monthly income and fixed costs and I'll re-run it.`;
    }
    if (/workout|gym|fitness|exercise|training/.test(t)) {
      return `## 3-day full-body plan (repeat weekly)

**Day A**
${bullets(['Squat 3×8', 'Push-up (or bench) 3×10', 'Row 3×10', 'Plank 3×30 s'])}
**Day B**
${bullets(['Hinge / Romanian deadlift 3×8', 'Overhead press 3×8', 'Lat pulldown 3×10', 'Walk 20 min'])}
**Day C**
${bullets(['Lunge 3×10/leg', 'Incline press 3×10', 'Curl + triceps 2×12 each', 'Dead bug 3×10'])}
**Rules:** add 2.5 kg or 1 rep per week when all sets feel ≤ RPE 8. Warm up 5 min. Sleep 7–9 h.

*General information, not medical advice — check with a professional if you have injuries or conditions.*`;
    }
    if (/study|exam|revision|learn/.test(t)) {
      return `## 21-day study plan

**Days 1–7 — Map:** split the syllabus into 12 chunks, 2 per day. For each: read once, close the book, write what you remember, check gaps.

**Days 8–14 — Drill:** one past paper every 2 days, timed. After each, list only the *types* you lost marks on. Fix those types, not the whole subject.

**Days 15–21 — Simulate:** full papers at exam time, no interruptions. Day 21: light review + sleep early.

**Daily 90 minutes**
${numbered(['25 min active recall of yesterday', '25 min new chunk', '20 min practice problems', '10 min write 5 questions you still cannot answer', '10 min plan tomorrow'])}
**Non-negotiables:** 7–9 h sleep, phone in another room, review at day 1 / 3 / 7 / 21.`;
    }
    if (/trip|travel|itinerary|vacation|holiday/.test(t)) {
      return `## Trip plan template

**Anchor per day** beats a crowded list. One must-do, one neighbourhood, one food stop.

### Before you go
${bullets(['Passport valid 6+ months; check visa rules for your nationality.', 'Accommodation near transit, not the airport.', 'Download offline maps + this app (works offline).', 'Travel insurance; copies of documents stored offline.', 'Notify your bank; set up an eSIM or roaming pack.'])}
### Budget skeleton
\`\`\`
transport + stay + food(3×day) + local transit + tickets + 15% buffer
\`\`\`
### Daily rhythm
${numbered(['Morning: the anchor sight before crowds', 'Midday: local lunch + rest during heat', 'Afternoon: neighbourhood walk', 'Evening: one good meal, plan tomorrow for 5 min'])}
Tell me the city, days and budget and I'll draft the day-by-day version.`;
    }
    // generic project plan
    return `## Plan: ${A.util.truncate(text.replace(/^.*?(plan|checklist)\s*(for|of)?\s*/i, '').trim() || 'your goal', 60)}

**1. Define done** — write the outcome in one sentence with a number and a date: *"Ship X to N users by DATE."*

**2. Break into 3 phases**
${bullets(['**Foundation** — the smallest thing that proves the idea (1 week).', '**Build** — the main path only; no edge cases yet (2–3 weeks).', '**Polish** — checks, docs, launch (1 week).'])}

**3. Weekly loop**
${numbered(['Monday: pick 3 outcomes for the week.', 'Daily: 1 block of deep work on the hardest one.', 'Friday: 20-min review — shipped / slipped / next.'])}

**4. Risks to name now**
${bullets(['What must be true for this to work? Test the riskiest assumption first.', 'What will you cut if time runs out? Decide before you need to.'])}

Give me the specifics (deadline, constraints, resources) and I'll turn this into a dated checklist.`;
  }

  function writeAnswer(text) {
    const t = text.toLowerCase();
    if (/email/.test(t)) {
      return `## Email draft

\`\`\`
Subject: [Action] + [topic] — by [date]

Hi [Name],

[One sentence: why you're writing.]

[Two sentences of context, or one bullet list if there are steps.]

My ask: [specific request] by [specific date].

Thanks,
[Your name]
\`\`\`

**Fill in five things:** recipient, one goal, the deadline, the smallest ask, and your sign-off tone.

### Rules that get replies
${bullets(['One email = one ask.', 'Deadline in the body.', 'Numbered lists for anything actionable.', 'Reply within 24 h even if it is "answer by Friday".'])}
Tell me who it's for and what you need — I'll write the full version.`;
    }
    if (/cover letter|cv|resume/.test(t)) {
      return `## Resume + cover letter kit

**Resume bullets: outcome first, verb second, number last**
\`\`\`
• Cut checkout failures 32% by adding retries + idempotency keys (Node, Redis)
• Led 4-person migration to Postgres 16 with zero downtime over 3 weekends
• Wrote onboarding docs that reduced new-hire questions 41%
\`\`\`

**Cover letter skeleton (200–250 words)**
${numbered(['Hook: the role + one proof you already did this kind of work.', 'Evidence: two achievements with numbers, mapped to their needs.', 'Fit: why this company — product, market or mission detail.', 'Close: availability + one clear ask (a conversation).'])}

**Interview prep:** write 6 STAR stories (conflict, failure, leadership, ambiguity, deadline, technical depth). Rehearse once out loud.

Send me the job ad text and your two best achievements and I'll draft both documents.`;
    }
    if (/story|poem|fiction|creative/.test(t)) {
      return `## Scene starter

> The rain had stopped twenty minutes ago, but the street still argued about it — puddles refusing to drain, gutters talking in ticks. Amina counted the windows with lights on. Eleven. Yesterday it was nine.
>
> The eleventh one had been dark for a year.

**Keep going with the spine**
${numbered(['**Goal** — what does she want in this scene?', '**Obstacle** — the neighbour, the memory, the locked door?', '**Decision** — she chooses something irreversible.', '**Consequence** — the street answers.'])}
**Three rules:** no adverb where a verb will do · one sensory detail per paragraph · end the scene one beat earlier than feels comfortable.

Tell me the genre and length and I'll write the next 300 words.`;
    }
    if (/summar/.test(t) && text.length > 400) {
      const body = text.split(/\n/).filter((l) => l.trim()).join(' ');
      const sentences = body.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30);
      const top = sentences.slice(0, 3).map((s) => s.trim());
      return `## Quick summary

**Thesis:** ${top[0] || 'Paste the text after "summarise:" and I\'ll extract it.'}

**Key points**
${top.map((s) => '- ' + A.util.truncate(s, 150)).join('\n') || '- (no long sentences detected)'}

**Caveat:** this is an extractive summary — I shortened by selecting the strongest sentences offline. For an abstractive summary, switch to a cloud model.

Length: ${wordCountAnswer(body).match(/Words \| \*\*(\d+)\*\*/)?.[1] || '?'} words in, ${top.length} points out.`;
    }
    // generic drafting help
    return `## Drafting help

Give me these four and I'll write it:
${numbered(['**Who reads it** (friend, manager, examiner, customer).', '**Goal** (inform, persuade, apologise, apply).', '**Length** (tweet, paragraph, one page).', '**Tone** (warm, neutral, formal).'])}

Meanwhile, a structure that works for almost anything:
\`\`\`
Hook — a specific fact, question or scene (1 sentence)
Point — what you want them to know (1 sentence)
Proof — one number, example or story (2–3 sentences)
Ask — the exact next action (1 sentence)
\`\`\`
Paste your raw notes and I'll turn them into that shape.`;
  }

  function brainstormAnswer(text) {
    const topic = text.replace(/^.*?(brainstorm|ideas|suggest|give me|list of|examples of)\s*/i, '').replace(/[?.!]+$/, '').trim() || 'the topic';
    return `## Ideas for **${A.util.truncate(topic, 60)}**

**Ten starting angles**
${numbered([
  '**Simplest version** — what does the 1-minute version look like?',
  '**Invert it** — what would make this fail? Build the opposite.',
  '**Remove a constraint** — what if it had to be free? offline? one tap?',
  '**Audience shift** — students, night-shift workers, parents, seniors.',
  '**Combine** — merge it with something unrelated you use daily.',
  '**Service → product** — everywhere someone helps you manually, there is a product.',
  '**Data angle** — what could be measured, then improved automatically?',
  '**Community angle** — where do these people already gather? Start there.',
  '**Local first** — what changes if it only serves your city?',
  '**10× cheaper** — what would pricing look like at a tenth?',
])}

**Score them:** Impact (1–5) × Ease (1–5). Anything ≥ 16 gets a 1-week test: hypothesis, smallest build, metric, deadline.

Tell me the domain and constraints (budget, time, skills) and I'll generate 20 more, scored.`;
  }

  function decideAnswer(text) {
    return `## Decide in six steps

**1. Frame** — "${A.util.truncate(text.replace(/^(should i|decide|choose between|compare)\s*/i, ''), 90)}"
Write the choice as a question with two clear answers and a deadline. A decision past its date becomes a default.

**2. Criteria** (weight 1–5): money · time · risk · learning · people · joy

**3. Score** each option 1–5 per criterion, multiply by weight, sum. Disagreements are the useful output, not the number.

**4. Reversibility** — cheap to undo? Decide fast, learn. Permanent? Gather one more piece of evidence.

**5. Pre-mortem** — imagine it failed in a year. Write the two likeliest causes, add one mitigation each.

**6. 10/10/10** — how will this feel in 10 minutes, 10 months, 10 years?

\`\`\`
Option A: ____  score __/100   biggest risk: ____
Option B: ____  score __/100   biggest risk: ____
Cheapest test before committing: ____
\`\`\`
Tell me the actual options and I'll score them with you.`;
  }

  function jokeAnswer() {
    const jokes = [
      'Why do programmers prefer dark mode? Because light attracts bugs.',
      'I told my AI to be more human. It replied "sounds good, let\'s circle back" and booked a meeting.',
      'There are two hard things in computer science: cache invalidation, naming things, and off-by-one errors.',
      'My code doesn\'t have bugs — it has randomly generated features.',
      'Why did the developer go broke? Because he used up all his cache.',
      'A SQL query walks into a bar, approaches two tables and asks: "May I join you?"',
    ];
    const riddles = [
      ['The more you take, the more you leave behind. What am I?', 'Footsteps.'],
      ['What has keys but opens no locks?', 'A keyboard (or a map).'],
      ['I speak without a mouth and hear without ears. What am I?', 'An echo.'],
    ];
    if (/riddle/.test(jokeAnswer.lastText || '')) {
      const [q, a] = pick(riddles);
      return `## Riddle\n\n> ${q}\n\n<details>Answer: **${a}**</details>`;
    }
    return `## ${pick(jokes)}\n\nWant another? Ask for a theme — programmer, science, wordplay — or "roast my code".`;
  }

  function explainAnswer(text, hits) {
    if (hits.length && hits[0].score >= 7) {
      return hits[0].topic.answer;
    }
    const topic = text
      .replace(/^(what is|what are|whats|what's|explain|define|tell me about|how does|how do|why is|why do|meaning of)\s*/i, '')
      .replace(/[?.!]+$/, '')
      .trim();
    if (!topic) return null;
    const related = hits.map((h) => h.topic.title).slice(0, 3);
    return `## ${A.util.truncate(topic[0].toUpperCase() + topic.slice(1), 70)}

I'm the **offline engine**, so I answer this from a local knowledge base rather than a frontier model. Here's the honest state:

**What I can give you right now**
${bullets([
  'A structure for thinking about it: definition → why it matters → how it works → examples → pitfalls.',
  'Exact arithmetic, conversions and text processing — those are always reliable.',
  'Everything from my built-in library on science, maths, code, writing and life skills.',
])}
${related.length ? `\n**Related topics I do cover fully:** ${related.join(' · ')}\n` : ''}
**Fastest route to a deep answer:** tap the model chip at the top and pick a free cloud model (no key needed for the Pollen ones, or add a free Gemini/Groq key). Then ask the same question — a large model will handle it properly.

**Meanwhile, a solid way to break the question down**
${numbered([
  `What exactly does **${A.util.truncate(topic, 40)}** mean in your context? Write one sentence.`,
  'What do you already know for certain? List 3 facts.',
  'What is the specific decision or output you need? That narrows it 80%.',
  'Which part is uncertain? Ask me that narrow part — local tools often cover it.',
])}
Send me the narrower version and I'll go deeper.`;
  }

  function translateAnswer(text, hits) {
    const langMap = {
      bengali: 'Bengali (বাংলা)', bangla: 'Bengali (বাংলা)', hindi: 'Hindi (हिन्दी)', arabic: 'Arabic (العربية)',
      spanish: 'Spanish (Español)', french: 'French (Français)', german: 'German (Deutsch)', urdu: 'Urdu (اردو)',
    };
    const target = Object.keys(langMap).find((k) => text.toLowerCase().includes(k));
    if (hits.length && hits[0].topic.id === 'language') return hits[0].topic.answer;
    return `## Translation

**Target:** ${target ? langMap[target] : 'not specified — tell me the language'}

The on-device engine has a **phrase glossary** and word-level coverage, not a neural translator. So:

**Reliable offline:** single words and standard phrases (hello, thank you, how much, water, help, directions).
**Not reliable offline:** full sentences, idioms, formal documents.

**Best quality:** switch to a cloud model (model chip → any Gemini/Groq/OpenRouter free model) and send:
\`\`\`
Translate to ${target ? langMap[target] : '<language>'}, keep names unchanged, formal tone:
<your text>
\`\`\`

**Quick glossary**

| English | Bengali | Hindi | Arabic | Spanish |
| --- | --- | --- | --- | --- |
| hello | নমস্কার | नमस्ते | السلام عليكم | hola |
| thank you | ধন্যবাদ | धन्यवाद | شكراً | gracias |
| how much? | কত? | कितना? | كم؟ | ¿cuánto? |
| water | পানি | पानी | ماء | agua |
| help | সাহায্য | मदद | مساعدة | ayuda |

Paste the exact text and I'll do what this engine can, or hand off cleanly.`;
  }

  function generalAnswer(text, hits) {
    if (hits.length) {
      const best = hits[0].topic.answer;
      const more = hits.slice(1).map((h) => h.topic.title);
      return best + (more.length ? `\n\n---\n**Also in my offline library:** ${more.join(' · ')}` : '');
    }
    const words = A.knowledge.tokens(text);
    const q = A.util.truncate(text.replace(/[?.!]+$/, '').trim(), 90);
    return `## Let's work this out

You asked: *${q}*

I'm answering **on-device** right now, so no network was used. Here's the most useful thing I can do without a cloud model:

**1. Sharpen the question**
${bullets([
  'What output do you actually need — a decision, a draft, a number, an explanation?',
  'What constraints matter (time, budget, tools you have)?',
  'What have you already tried?',
])}

**2. What I can do immediately, offline**
${bullets([
  '**Numbers** — arithmetic, percentages, unit conversion, dates.',
  '**Text** — drafts, emails, summaries, word counts, restructuring your notes.',
  '**Plans** — study, budget, workout, trip, project checklists.',
  '**Knowledge** — ' + A.knowledge.topics.length + ' full topics across science, code, writing and life.',
  '**Agent skills** — switch to Agent mode and I can run these as steps and save the result to a note.',
])}

**3. For deep or very specific questions**
Tap the model chip at the top → choose a cloud model. Keyless ones work instantly; a free Gemini/Groq key unlocks more. Then ask again — same chat, better brain.

${words.length > 4 ? `\n**Keywords I picked up:** ${words.slice(0, 8).join(', ')} — if any of those is the real topic, say it and I'll go straight there.` : ''}`;
  }

  /* ───────────────────────── main entry ───────────────────────── */
  function composeReply({ messages, model = 'aishub-core-1' }) {
    const last = [...messages].reverse().find((m) => m.role === 'user');
    const text = (last && typeof last.content === 'string' ? last.content : '') || '';
    if (!text.trim()) return 'Ask me anything — I work offline.';

    const intent = classify(text);
    const hits = A.knowledge.search(text, 3);
    const flavour = model.includes('code') ? 'code' : model.includes('write') ? 'write' : model.includes('tutor') ? 'tutor' : model.includes('agent') ? 'agent' : 'core';

    let reply = null;
    switch (intent) {
      case 'greet': reply = greetAnswer(); break;
      case 'identity': reply = identityAnswer(); break;
      case 'thanks': reply = `Anytime. Anything else — writing, numbers, code or a plan?\n\n*Tip: this answer used zero network. Tap the model chip if you ever want a cloud model instead.*`; break;
      case 'bye': reply = `See you. Your chats and agent tasks are saved on this device — pick up where you left off whenever.`; break;
      case 'capacity': reply = `**Yes — free, and offline works.**\n\n${bullets(['The on-device engine (me) needs no key, no account, no network.', 'Keyless cloud models add speed and depth when you are online.', 'Your own free keys (Gemini, Groq, OpenRouter…) unlock 100+ more.', 'No subscription, no ads, no expiry — it is your app.'])}\n\nOpen **Models** to see what is connected right now.`; break;
      case 'keyhelp': reply = A.knowledge.search('api key', 1)[0]?.topic.answer || null; break;
      case 'math': reply = mathAnswer(text) || generalAnswer(text, hits); break;
      case 'convert': reply = convertAnswer(text) || generalAnswer(text, hits); break;
      case 'datetime': reply = datetimeAnswer(); break;
      case 'random': jokeAnswer.lastText = text; reply = randomAnswer(text); break;
      case 'wordcount': reply = wordCountAnswer(text); break;
      case 'casemorph': reply = caseAnswer(text); break;
      case 'code': reply = codeAnswer(text); break;
      case 'write': reply = writeAnswer(text); break;
      case 'plan': reply = planAnswer(text); break;
      case 'translate': reply = translateAnswer(text, hits); break;
      case 'brainstorm': reply = brainstormAnswer(text); break;
      case 'decide': reply = decideAnswer(text); break;
      case 'joke': jokeAnswer.lastText = text; reply = jokeAnswer(); break;
      case 'explain': reply = explainAnswer(text, hits); break;
      default:
        reply = generalAnswer(text, hits);
    }

    // offline "model" personas: light presentation tweaks, same reliable core
    if (flavour === 'tutor' && !/^## (Result|Conversion|Text statistics|Right now)/.test(reply)) {
      reply = reply + `\n\n---\n**Tutor note:** try to restate the key idea in your own words, then test yourself with one question. If you can teach it, you know it.`;
    } else if (flavour === 'write' && intent === 'general') {
      reply = reply + `\n\n**Writer's nudge:** give me a paragraph of raw notes and I'll shape it — I work offline, so your draft never leaves the phone.`;
    } else if (flavour === 'code' && intent === 'general') {
      reply = reply + `\n\n**Engineer's nudge:** paste the code or error text and I'll work on the actual problem.`;
    }

    return reply;
  }

  /**
   * Streams a local reply with natural pacing. Respects AbortSignal.
   * @returns {Promise<{text:string}>}
   */
  async function chat({ messages, model = 'aishub-core-1', onDelta = () => {}, signal, web }) {
    const reply = composeReply({ messages, model });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // small "thinking" pause for realism
    await sleep(180 + Math.random() * 260);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    let out = '';
    const chunks = reply.match(/[\s\S]{1,26}(\s|$)/g) || [reply];
    for (const chunk of chunks) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      out += chunk;
      onDelta(chunk, out);
      // keep it snappy for long answers, gentle for short ones
      await sleep(reply.length > 900 ? 8 : 14);
    }
    return { text: out };
  }

  A.offlineEngine = {
    chat,
    composeReply,
    classify,
    evalMath,
    convertUnits,
    models: [
      { id: 'aishub-core-1' },
      { id: 'aishub-code-1' },
      { id: 'aishub-write-1' },
      { id: 'aishub-tutor-1' },
      { id: 'aishub-agent-1' },
    ],
  };
})();
