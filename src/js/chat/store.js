/* ════════════════════════════════════════════════════════════════
   Ai'sHub · chat store
   Chat index lives in localStorage (fast lists); messages live in
   IndexedDB (unbounded) with a localStorage mirror for blocked storage.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const { KV, DB } = A.store;
  const { uid, titleFrom } = A.util;

  const INDEX_KEY = 'chats';

  const list = () => KV.get(INDEX_KEY, []);
  const saveIndex = (chats) => KV.set(INDEX_KEY, chats);

  function create({ title = 'New chat', model = null, mode = 'chat' } = {}) {
    const chat = {
      id: uid('c_'),
      title,
      created: Date.now(),
      updated: Date.now(),
      model: model || A.settings.get('selectedModel'),
      mode,
      messageCount: 0,
      pinned: false,
    };
    const chats = list();
    chats.unshift(chat);
    saveIndex(chats);
    A.bus.emit('chats:changed', chats);
    return chat;
  }

  function get(id) {
    return list().find((c) => c.id === id) || null;
  }

  function touch(id, patch = {}) {
    const chats = list();
    const idx = chats.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    chats[idx] = { ...chats[idx], ...patch, updated: Date.now() };
    // keep pinned chats on top, then most recent
    chats.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
    saveIndex(chats);
    A.bus.emit('chats:changed', chats);
    return chats.find((c) => c.id === id);
  }

  async function messages(chatId) {
    const all = await DB.getMessages(chatId);
    return all.filter((m) => !m.deleted);
  }

  /** Permanently remove one message from a chat. */
  async function deleteFrom(chatId, fromTs) {
    const all = await DB.getMessages(chatId);
    for (const m of all.filter((x) => x.ts >= fromTs)) {
      await DB.deleteMessage(chatId, m.id);
      await DB.putMessage(chatId, { id: m.id, chatId, deleted: true, ts: m.ts, role: 'system', content: '' }).catch(() => {});
    }
    const mirror = KV.get('msgs:' + chatId, []).filter((m) => m.ts < fromTs);
    KV.set('msgs:' + chatId, mirror);
  }

  async function append(chatId, message) {
    const msg = { id: message.id || uid('m_'), ts: message.ts || Date.now(), ...message };
    const existing = await DB.getMessages(chatId);
    await DB.putMessage(chatId, msg);
    // mirror without heavy attachment payloads (localStorage is small)
    const light = (m) => ({
      ...m,
      attachments: m.attachments ? m.attachments.map((a) => ({ kind: a.kind, name: a.name })) : undefined,
    });
    KV.set('msgs:' + chatId, [...existing, msg].slice(-200).map(light));
    const chat = get(chatId);
    const patch = { messageCount: existing.length + 1 };
    if (chat && (chat.messageCount || 0) === 0 && msg.role === 'user') {
      patch.title = titleFrom(typeof msg.content === 'string' ? msg.content : 'New chat');
    }
    touch(chatId, patch);
    return msg;
  }

  async function update(chatId, messageId, patch) {
    const list_ = await DB.getMessages(chatId);
    const idx = list_.findIndex((m) => m.id === messageId);
    if (idx < 0) return null;
    const updated = { ...list_[idx], ...patch };
    await DB.putMessage(chatId, updated);
    list_[idx] = updated;
    KV.set('msgs:' + chatId, list_.slice(-200));
    return updated;
  }

  async function remove(chatId) {
    await DB.deleteChat(chatId);
    saveIndex(list().filter((c) => c.id !== chatId));
    A.bus.emit('chats:changed', list());
  }

  function clearAll() {
    saveIndex([]);
    DB.wipe();
    KV.keys().filter((k) => k.startsWith('msgs:')).forEach((k) => KV.remove(k));
    A.bus.emit('chats:changed', []);
  }

  function search(query = '') {
    const q = query.toLowerCase().trim();
    const chats = list();
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }

  async function exportChat(chatId) {
    const chat = get(chatId);
    const msgs = await messages(chatId);
    return { chat, messages: msgs, exportedAt: new Date().toISOString(), app: "Ai'sHub " + A.VERSION };
  }

  async function exportAll() {
    const chats = list();
    const out = { app: "Ai'sHub", version: A.VERSION, exportedAt: new Date().toISOString(), settings: A.settings.all, chats: [] };
    for (const c of chats) out.chats.push({ ...c, messages: await messages(c.id) });
    return out;
  }

  function toMarkdown(chat, msgs) {
    const lines = [`# ${chat.title}`, '', `*${new Date(chat.created).toLocaleString()} · ${msgs.length} messages · Ai'sHub*`, ''];
    for (const m of msgs) {
      const who = m.role === 'user' ? 'You' : m.role === 'assistant' ? `Ai'sHub${m.model ? ` (${m.model.split(':').pop()})` : ''}` : 'Tool';
      lines.push(`### ${who}`, '', typeof m.content === 'string' ? m.content : JSON.stringify(m.content), '');
    }
    return lines.join('\n');
  }

  A.chatStore = {
    list,
    create,
    get,
    touch,
    messages,
    append,
    update,
    deleteFrom,
    remove,
    clearAll,
    search,
    exportChat,
    exportAll,
    toMarkdown,
  };
})();
