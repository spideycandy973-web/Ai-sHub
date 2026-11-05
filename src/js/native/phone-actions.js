/* ════════════════════════════════════════════════════════════════
   Ai'sHub · phone actions (agent skills that act on the device)
   Parses what the user asks for in plain language and performs it through
   the native bridge: alarms, timers, calendar, contacts, calls, texts,
   apps, settings, flashlight, volume, clipboard, screen control.
   Every action is user-initiated; nothing happens in the background.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { KV } = A.store;

  const history = () => KV.get('phone:history', []);
  function log(entry) {
    const list = history();
    list.unshift({ ts: Date.now(), ...entry });
    KV.set('phone:history', list.slice(0, 80));
  }

  /* ───────────── parsing helpers ───────────── */

  const NUM_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45,
    fifty: 50, sixty: 60, ninety: 90,
  };

  function toNumber(raw) {
    if (raw == null) return NaN;
    const s = String(raw).trim().toLowerCase();
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
    if (NUM_WORDS[s.replace(/[\s-]/g, '')]) return NUM_WORDS[s.replace(/[\s-]/g, '')];
    return NaN;
  }

  /** "7:30 am", "7.30pm", "19:45" → {hour, minute} in 24h. */
  function parseTime(text) {
    const m = text.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i) || text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    if (!m) return null;
    let hour = Number(m[1]);
    const minute = m[3] !== undefined && m[2] && /^\d{1,2}$/.test(m[2]) ? Number(m[2]) : 0;
    const suffix = (m[3] || (m[2] && /^(am|pm)$/i.test(m[2]) ? m[2] : '') || '').toLowerCase();
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }

  /** "in 10 minutes", "for 5 min", "25 minutes" → seconds. */
  function parseDuration(text) {
    const m = text.match(/\b(\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fifty|sixty|ninety)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i);
    if (!m) return null;
    const n = toNumber(m[1]);
    if (!Number.isFinite(n)) return null;
    const unit = m[2].toLowerCase();
    if (unit.startsWith('sec')) return n;
    if (unit.startsWith('min')) return n * 60;
    return n * 3600;
  }

  const APP_ALIASES = {
    youtube: 'com.google.android.youtube',
    whatsapp: 'com.whatsapp',
    facebook: 'com.facebook.katana',
    instagram: 'com.instagram.android',
    messenger: 'com.facebook.orca',
    telegram: 'org.telegram.messenger',
    gmail: 'com.google.android.gm',
    maps: 'com.google.android.apps.maps',
    'google maps': 'com.google.android.apps.maps',
    chrome: 'com.android.chrome',
    camera: 'com.android.camera',
    gallery: 'com.google.android.apps.photos',
    photos: 'com.google.android.apps.photos',
    spotify: 'com.spotify.music',
    tiktok: 'com.zhiliaoapp.musically',
    twitter: 'com.twitter.android',
    x: 'com.twitter.android',
    playstore: 'com.android.vending',
    'play store': 'com.android.vending',
    calculator: 'com.google.android.calculator',
    clock: 'com.google.android.deskclock',
    alarm: 'com.google.android.deskclock',
    settings: 'com.android.settings',
    phone: 'com.android.dialer',
    dialer: 'com.android.dialer',
    messages: 'com.google.android.apps.messaging',
    sms: 'com.google.android.apps.messaging',
    files: 'com.android.documentsui',
    email: 'com.google.android.gm',
  };

  /* ───────────── intent detection ───────────── */

  const ACTIONS = [
    ['alarm', /\b(set|wake|create|make)\b.*\balarm\b|\balarm\b.*\b(at|for)\b|\bwake me (up )?(at|by)\b/i],
    ['timer', /\b(set|start|create)\b.*\btimer\b|\btimer\b.*\bfor\b|\bremind me in\b|\bin \d+ (minutes?|seconds?|hours?)\b/i],
    ['agenda', /\b(what('s| is) on (my )?(calendar|schedule)|my calendar|my schedule|upcoming|when is my|agenda)\b/i],
    ['event', /\b(add|create|schedule|put)\b.*\b(meeting|event|appointment)\b|\b(calendar)\b.*\b(add|create|schedule)\b/i],
    ['contact', /\b(find|look ?up|search|get)\b.*\b(contact|number|phone number)\b|\bwhat('s| is) .*(number|contact)\b/i],
    ['call', /\b(call|dial|phone)\b\s+(.+)/i],
    ['sms', /\b(text|sms|message|whatsapp)\b\s+(.+)/i],
    ['openApp', /\b(open|launch|start|go to|run)\b\s+(?:the\s+)?([a-z0-9 .'’]+?)\s*(app)?$/i],
    ['settings', /\b(open|turn on|turn off|enable|disable|go to)\b.*\b(wifi|bluetooth|airplane|location|display|sound|battery|accessibility|settings)\b/i],
    ['torchOn', /\b(turn on|enable|activate|switch on)\b.*\b(flash ?light|torch)\b|\b(flash ?light|torch)\s+on\b/i],
    ['torchOff', /\b(turn off|disable|deactivate|switch off)\b.*\b(flash ?light|torch)\b|\b(flash ?light|torch)\s+off\b/i],
    ['volume', /\b(volume|louder|quieter|turn it (up|down)|mute|unmute)\b/i],
    ['brightness', /\b(brightness|brighter|dimmer|screen light)\b/i],
    ['clipboard', /\b(copy|clipboard|paste)\b/i],
    ['battery', /\b(battery|charge level|how much charge)\b/i],
    ['storage', /\b(storage|disk space|free space)\b/i],
    ['status', /\b(device info|phone status|what phone|system info)\b/i],
    ['share', /\b(share|send to)\b/i],
    ['search', /\b(search|google|look up)\b/i],
    ['screenBack', /\b(go back|press back|back button)\b/i],
    ['screenHome', /\b(go home|press home|home screen)\b/i],
    ['screenRead', /\b(read (the )?screen|what('s| is) on (the )?screen|read (this|it))\b/i],
    ['screenTap', /\b(tap|click|press)\b\s+(?:on\s+)?"?([^"]+?)"?\s*$/i],
    ['screenType', /\b(type|enter)\b\s+(.+?)(?:\s+in(to)?\s+(the\s+)?(field|box|search))?$|\bwrite\b\s+(.+?)\s+in(to)?\s+(the\s+)?(field|box|search)/i],
    ['vibrate', /\b(vibrate|buzz)\b/i],
  ];

  function detect(text) {
    for (const [name, re] of ACTIONS) {
      const m = text.match(re);
      if (m) return { name, match: m };
    }
    return null;
  }

  const looksLikePhoneRequest = (text) =>
    Boolean(detect(text)) || /\b(phone|device|android|app)\b.*\b(control|use|open)\b/i.test(text);

  /* ───────────── executors ───────────── */

  const reply = (text) => ({ text, ok: true });

  async function perform(name, match, text) {
    switch (name) {
      case 'alarm': {
        const time = parseTime(text);
        if (!time) return { ok: false, text: 'Tell me the time, like “set an alarm for 7:30 am”.' };
        const label = (text.match(/\b(?:labell?ed|called|for)\s+([a-z0-9 '\-]{2,40})$/i) || [])[1];
        const res = await A.phone.call('setAlarm', { hour: time.hour, minute: time.minute, label: label?.trim() || "Ai'sHub alarm" });
        return reply(`Alarm set for ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')} — ${res.message}.`);
      }
      case 'timer': {
        const seconds = parseDuration(text);
        if (!seconds) return { ok: false, text: 'How long? Try “set a timer for 10 minutes”.' };
        const res = await A.phone.call('setTimer', { seconds, label: "Ai'sHub timer" });
        return reply(`Timer started — ${res.message}.`);
      }
      case 'event': {
        const title = (text.match(/\b(?:add|create|schedule|put)\s+(?:a\s+)?(?:meeting|event|appointment)\s*(?:called|for|titled|:)?\s*([^,.]+)/i) || [])[1];
        const time = parseTime(text);
        const begin = time ? nextOccurrence(time) : Date.now() + 3600_000;
        const res = await A.phone.call('createEvent', {
          title: (title || 'Ai\'sHub event').trim(),
          begin,
          end: begin + 3600_000,
        });
        const when = new Date(begin).toLocaleString();
        return reply(`Opening your calendar to add “${(title || 'Ai\'sHub event').trim()}” for ${when}. ${res.message}`);
      }
      case 'agenda': {
        const res = await A.phone.call('readEvents', {});
        if (!res.events || !res.events.length) return reply('Your calendar has nothing scheduled from now on.');
        const lines = res.events
          .slice(0, 8)
          .map((e) => `- **${e.title || 'Untitled'}** — ${new Date(e.start).toLocaleString()}${e.location ? ` · ${e.location}` : ''}`)
          .join('\n');
        return reply(`Here is what is coming up:\n\n${lines}`);
      }
      case 'contact': {
        const q = (text.match(/\b(?:contact|number|phone number)\s+(?:of|for|is)?\s*([a-z .'\-]{2,40})/i) || [])[1] || '';
        const res = await A.phone.call('findContact', { query: q.trim() });
        if (!res.contacts || !res.contacts.length) return reply(`I could not find a contact matching “${q.trim()}” on this phone.`);
        const lines = res.contacts.map((c) => `- **${c.name}** — ${c.number}`).join('\n');
        return reply(`Found ${res.count} match${res.count === 1 ? '' : 'es'}:\n\n${lines}`);
      }
      case 'call': {
        const number = extractNumber(text) || (text.match(/\bcall\s+(?:the\s+)?([a-z0-9 .'\-]{2,40})/i) || [])[1];
        if (!number) return { ok: false, text: 'Who should I call? Give me a name or a number.' };
        const res = await A.phone.call('call', { number: String(number).trim() });
        return reply(`${res.message}.`);
      }
      case 'sms': {
        const body = (text.match(/\b(?:saying|that says|with (?:the )?message)\s+(.+)$/i) || [])[1];
        const target = (text.match(/\b(?:text|sms|message|whatsapp)\s+(?:to\s+)?([+()\d][\d\s()\-]{5,}|\d{5,})/i) || [])[1];
        if (!target) return { ok: false, text: 'Give me the number to text, like “text 01712345678 that I will be late”.' };
        const res = await A.phone.call('sms', { number: String(target).trim(), body: body || '' });
        return reply(`${res.message}${body ? ' Your message is filled in.' : ''}`);
      }
      case 'openApp': {
        const raw = (match[2] || '').trim().toLowerCase();
        const pkg = APP_ALIASES[raw] || (raw.includes('.') ? raw : null);
        if (!pkg) {
          const apps = await A.phone.call('listApps', {});
          const hit = (apps.apps || []).find((a) => a.label.toLowerCase() === raw || a.label.toLowerCase().includes(raw));
          if (!hit) return { ok: false, text: `I could not find an app called “${raw}” on this phone.` };
          const res = await A.phone.call('openApp', { package: hit.package });
          return reply(`Opened **${hit.label}**. ${res.message}`);
        }
        const res = await A.phone.call('openApp', { package: pkg });
        return reply(`Opened **${raw}**.`);
      }
      case 'settings': {
        const which = (text.match(/\b(wifi|bluetooth|airplane|location|display|sound|battery|accessibility|data)\b/i) || [, 'settings'])[1].toLowerCase();
        if (/^(turn on|enable|turn off|disable)/i.test(text) && (which === 'wifi' || which === 'bluetooth')) {
          const res = await A.phone.call('openSettings', { which });
          return reply(`Android does not let apps flip ${which} directly, so I opened the ${which} settings for you — one tap there and it is on.`);
        }
        const res = await A.phone.call('openSettings', { which });
        return reply(`${res.message}.`);
      }
      case 'torchOn': {
        const res = await A.phone.call('torch', { on: true });
        return reply(`Flashlight on. ${res.message}`);
      }
      case 'torchOff': {
        await A.phone.call('torch', { on: false });
        return reply('Flashlight off.');
      }
      case 'volume': {
        const level = (text.match(/\b(?:volume|set)\D{0,8}(\d{1,2})\s*%?/i) || [])[1];
        if (level) {
          const max = (await A.phone.call('status', {})).volumeMax || 15;
          const target = Math.round((Number(level) / 100) * max);
          const res = await A.phone.call('volume', { level: Math.max(0, Math.min(max, target)) });
          return reply(`Volume set to about ${level}%. ${res.message}`);
        }
        const dir = /\b(down|lower|quieter|decrease|reduce)\b/i.test(text) ? 'down' : /\b(mute|silent)\b/i.test(text) ? 'mute' : 'up';
        const res = await A.phone.call('volume', { direction: dir });
        return reply(`${res.message}.`);
      }
      case 'brightness': {
        const pct = (text.match(/(\d{1,3})\s*%/i) || [])[1];
        if (!pct) return reply('Say a level, like “set brightness to 40%”.');
        const res = await A.phone.call('brightness', { level: Math.round((Number(pct) / 100) * 255) });
        return reply(`${res.message}.`);
      }
      case 'clipboard': {
        if (/\bcopy\b/i.test(text)) {
          const what = text.replace(/^.*?\bcopy\b\s*/i, '').trim() || text;
          await A.phone.call('clipboard', { text: what });
          return reply(`Copied to your clipboard: “${what.slice(0, 80)}”.`);
        }
        const res = await A.phone.call('clipboard', {});
        return reply(res.text ? `Your clipboard says:\n\n> ${res.text.slice(0, 500)}` : 'Your clipboard is empty.');
      }
      case 'battery': {
        const s = await A.phone.call('status', {});
        return reply(`Battery is at **${s.battery}%**.`);
      }
      case 'storage': {
        const s = await A.phone.call('status', {});
        return reply(`You have **${s.storageFree}** free of ${s.storageTotal}.`);
      }
      case 'status': {
        const s = await A.phone.call('status', {});
        const cap = await A.phone.capabilities();
        return reply(
          `**${cap.model || 'This phone'}** · Android ${cap.androidVersion}\n\n` +
            `- Battery: ${s.battery}%\n- Volume: ${s.volume}/${s.volumeMax} (${s.ringerMode})\n` +
            `- Storage free: ${s.storageFree} of ${s.storageTotal}\n- Network: ${s.operator || 'unknown'}${s.wifi ? ' · Wi-Fi on' : ''}\n- Time: ${s.time}`
        );
      }
      case 'share': {
        const body = text.replace(/^.*?\bshare\b\s*/i, '').trim();
        await A.phone.call('share', { text: body || text, title: 'Share from Ai\'sHub' });
        return reply('Opened the share sheet.');
      }
      case 'screenBack': {
        await A.phone.call('screenAction', { action: 'back' });
        return reply('Went back.');
      }
      case 'screenHome': {
        await A.phone.call('screenAction', { action: 'home' });
        return reply('Home.');
      }
      case 'screenRead': {
        const res = await A.phone.call('screenAction', { action: 'readScreen' });
        return reply(res.text ? `On screen right now:\n\n${res.text}` : 'The screen looks empty to me.');
      }
      case 'screenTap': {
        const label = (match[2] || '').trim();
        await A.phone.call('screenAction', { action: 'tapText', text: label });
        return reply(`Tapped “${label}”.`);
      }
      case 'screenType': {
        const value = (match[2] || '').trim().replace(/^["']|["']$/g, '');
        await A.phone.call('screenAction', { action: 'type', text: value });
        return reply(`Typed “${value.slice(0, 60)}”.`);
      }
      case 'vibrate': {
        await A.phone.call('vibrate', { ms: 220 });
        return reply('Buzzed.');
      }
      default:
        return { ok: false, text: 'I am not sure which phone action you meant.' };
    }
  }

  function extractNumber(text) {
    const m = text.match(/(\+?\d[\d\s()\-]{6,}\d)/);
    return m ? m[1].trim() : null;
  }

  function nextOccurrence(time) {
    const d = new Date();
    d.setHours(time.hour, time.minute, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  /* ───────────── public API ───────────── */

  /** Try to handle a phone request. Returns null when it is not one. */
  async function tryHandle(text) {
    const hit = detect(text);
    if (!hit) return null;
    if (!A.phone.available()) {
      return {
        ok: false,
        text:
          '**Phone control needs the Ai\'sHub Android app.** In the browser I can chat with you, but I cannot touch the phone itself.\n\n' +
          'Install the APK from your repo, then ask me again — alarms, calendar, apps, flashlight and taps all work there.',
      };
    }
    try {
      const result = await perform(hit.name, hit.match, text);
      log({ request: text, action: hit.name, ok: Boolean(result.ok), message: result.text?.slice(0, 200) });
      return result;
    } catch (err) {
      log({ request: text, action: hit.name, ok: false, message: err.message });
      return {
        ok: false,
        text: `I could not do that: ${err.message}`,
      };
    }
  }

  A.phoneActions = { tryHandle, detect, looksLikePhoneRequest, parseTime, parseDuration, history, APP_ALIASES };
})();
