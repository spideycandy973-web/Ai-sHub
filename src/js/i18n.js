/* ════════════════════════════════════════════════════════════════
   Ai'sHub · tiny i18n layer
   English ships complete; Bengali is included because the app targets
   Bangladesh first, and any missing key falls back to English.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;

  const en = {
    chat: 'Chat', agent: 'Agent', models: 'Models', prompts: 'Prompts', settings: 'Settings',
    chatMode: 'Chat', agentMode: 'Agent',
    menu: 'Menu', newChat: 'New chat', newChat2: 'New chat',
    agentTasks: 'Agent tasks', agentTasksSub: 'Give one goal — your agent plans, uses tools and reports back.',
    skills: 'Skills',
    modelsSub: 'models · auto-updated when new ones drop',
    syncModels: 'Sync', addCustom: 'Custom',
    all: 'All', free: 'Free', offline: 'Offline', vision: 'Vision', tools: 'Tools',
    promptsSub: 'One tap to start with an expert setup.',
    assistants: 'Assistants', library: 'Library',
    settingsSub: 'Keys never leave this device.',
    about: 'About Ai\'sHub',
  };

  const bn = {
    chat: 'চ্যাট', agent: 'এজেন্ট', models: 'মডেল', prompts: 'প্রম্পট', settings: 'সেটিংস',
    chatMode: 'চ্যাট', agentMode: 'এজেন্ট',
    menu: 'মেনু', newChat: 'নতুন চ্যাট', newChat2: 'নতুন চ্যাট',
    agentTasks: 'এজেন্ট কাজ', agentTasksSub: 'একটি লক্ষ্য দিন — এজেন্ট পরিকল্পনা করে, টুল ব্যবহার করে, ফিরে জানায়।',
    skills: 'স্কিল',
    modelsSub: 'মডেল · নতুন মডেল এলে নিজে থেকেই যোগ হয়',
    syncModels: 'সিঙ্ক', addCustom: 'কাস্টম',
    all: 'সব', free: 'ফ্রি', offline: 'অফলাইন', vision: 'ভিশন', tools: 'টুল',
    promptsSub: 'এক ট্যাপে বিশেষজ্ঞ সেটআপ দিয়ে শুরু করুন।',
    assistants: 'সহকারী', library: 'লাইব্রেরি',
    settingsSub: 'আপনার কী এই ডিভাইসেই থাকে।',
    about: 'Ai\'sHub সম্পর্কে',
  };

  const dicts = { en, bn };
  let current = 'en';

  function detect() {
    const pref = A.settings.get('locale');
    if (pref && pref !== 'auto' && dicts[pref]) return pref;
    const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return dicts[lang] ? lang : 'en';
  }

  function t(key, fallback) {
    return dicts[current]?.[key] ?? en[key] ?? fallback ?? key;
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'), el.textContent);
    });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'), el.getAttribute('aria-label') || ''));
    });
    document.documentElement.lang = current;
  }

  const I18n = {
    get lang() { return current; },
    get languages() { return Object.keys(dicts); },
    detect,
    init() { current = detect(); apply(); },
    set(lang) {
      current = dicts[lang] ? lang : 'en';
      A.settings.set('locale', lang);
      apply();
      A.bus.emit('locale:changed', current);
    },
    t,
    apply,
  };

  A.i18n = I18n;
})();
