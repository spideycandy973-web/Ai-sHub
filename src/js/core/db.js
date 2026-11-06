/* ════════════════════════════════════════════════════════════════
   Ai'sHub · storage
   Two layers, both 100% on-device:
     KV   – localStorage (settings, keys, chats index, model prefs)
     IDB  – IndexedDB for message history + agent task logs (unlimited-ish)
   Every write is mirrored into an in-memory map so the app still works
   when storage is blocked (private mode, file://, etc.).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;
  const PREFIX = 'aishub:';
  const mem = new Map();
  let lsOK = true;

  try {
    const probe = PREFIX + 'probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch (_) {
    lsOK = false;
  }

  const KV = {
    get(key, fallback = null) {
      try {
        const raw = lsOK ? localStorage.getItem(PREFIX + key) : mem.get(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      mem.set(key, raw);
      if (!lsOK) return false;
      try {
        localStorage.setItem(PREFIX + key, raw);
        return true;
      } catch (err) {
        // quota exceeded: drop caches, retry once
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith(PREFIX + 'cache:'))
            .forEach((k) => localStorage.removeItem(k));
          localStorage.setItem(PREFIX + key, raw);
          return true;
        } catch (_) {
          return false;
        }
      }
    },
    remove(key) {
      mem.delete(key);
      try {
        if (lsOK) localStorage.removeItem(PREFIX + key);
      } catch (_) {}
    },
    keys() {
      try {
        return lsOK
          ? Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length))
          : [...mem.keys()];
      } catch (_) {
        return [...mem.keys()];
      }
    },
    rawSize() {
      try {
        if (!lsOK) return [...mem.values()].reduce((n, v) => n + v.length, 0);
        return Object.keys(localStorage)
          .filter((k) => k.startsWith(PREFIX))
          .reduce((n, k) => n + (localStorage.getItem(k) || '').length, 0);
      } catch (_) {
        return 0;
      }
    },
    get available() {
      return lsOK;
    },
    exportAll() {
      const out = {};
      KV.keys().forEach((k) => {
        out[k] = KV.get(k);
      });
      return out;
    },
    importAll(obj) {
      Object.entries(obj || {}).forEach(([k, v]) => KV.set(k, v));
    },
  };

  /* ---------------- IndexedDB (messages) ---------------- */
  const DB_NAME = 'aishub-db';
  const DB_VERSION = 1;
  let dbPromise = null;
  let idbOK = typeof indexedDB !== 'undefined';

  function open() {
    if (!idbOK) return Promise.reject(new Error('IndexedDB unavailable'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      // A wedged open() (another tab holding an upgrade, a killed WebView) would
      // otherwise block every read and write forever, freezing the UI mid-send.
      const timer = setTimeout(() => {
        idbOK = false;
        reject(new Error('IndexedDB open timed out'));
      }, 5000);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('chatId', 'chatId', { unique: false });
        }
        if (!db.objectStoreNames.contains('tasks')) {
          const store = db.createObjectStore('tasks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'k' });
        }
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        resolve(req.result);
      };
      req.onerror = () => {
        clearTimeout(timer);
        idbOK = false;
        reject(req.error || new Error('IndexedDB open failed'));
      };
      req.onblocked = () => {
        clearTimeout(timer);
        idbOK = false;
        reject(new Error('IndexedDB blocked'));
      };
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }

  function tx(storeName, mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const guard = setTimeout(() => reject(new Error('IndexedDB transaction timed out')), 5000);
          const done = (fn, arg) => { clearTimeout(guard); fn(arg); };
          const t = db.transaction(storeName, mode);
          const store = t.objectStore(storeName);
          let result;
          try {
            result = fn(store);
          } catch (err) {
            reject(err);
            return;
          }
          t.oncomplete = () => done(resolve, result && result.__req ? result.__req.result : result);
          t.onerror = () => done(reject, t.error || new Error('transaction failed'));
          t.onabort = () => done(reject, t.error || new Error('transaction aborted'));
        })
    );
  }

  const DB = {
    get available() {
      return idbOK;
    },
    async putMessages(chatId, messages) {
      try {
        return await tx('messages', 'readwrite', (store) => {
          for (const m of messages) store.put({ ...m, chatId });
          return { __req: { result: true } };
        });
      } catch (_) {
        // storage blocked (private mode, file://, quota): keep the KV mirror
        const existing = KV.get('msgs:' + chatId, []);
        const byId = new Map(existing.map((m) => [m.id, m]));
        for (const m of messages) byId.set(m.id, { ...m, chatId });
        KV.set('msgs:' + chatId, [...byId.values()].sort((a, b) => a.ts - b.ts).slice(-400));
        return true;
      }
    },
    async putMessage(chatId, message) {
      return DB.putMessages(chatId, [message]);
    },
    async deleteMessage(chatId, messageId) {
      try {
        return await tx('messages', 'readwrite', (store) => {
          store.delete(messageId);
          return { __req: { result: true } };
        });
      } catch (_) {
        const mirror = KV.get('msgs:' + chatId, []).filter((m) => m.id !== messageId);
        KV.set('msgs:' + chatId, mirror);
        return true;
      }
    },
    async getMessages(chatId) {
      try {
        const list = await tx('messages', 'readonly', (store) =>
          ({ __req: store.index('chatId').getAll(IDBKeyRange.only(chatId)) })
        );
        return (list || []).sort((a, b) => a.ts - b.ts);
      } catch (_) {
        return KV.get('msgs:' + chatId, []);
      }
    },
    async deleteChat(chatId) {
      try {
        await tx('messages', 'readwrite', (store) => {
          const idx = store.index('chatId');
          const req = idx.openCursor(IDBKeyRange.only(chatId));
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
          return { __req: { result: true } };
        });
      } catch (_) {}
      KV.remove('msgs:' + chatId);
    },
    async putTask(task) {
      try {
        return await tx('tasks', 'readwrite', (store) => {
          store.put(task);
          return { __req: { result: true } };
        });
      } catch (_) {
        const tasks = KV.get('tasks', {});
        tasks[task.id] = task;
        KV.set('tasks', tasks);
        return true;
      }
    },
    async getTasks() {
      try {
        const list = await tx('tasks', 'readonly', (store) => ({ __req: store.getAll() }));
        return list || [];
      } catch (_) {
        return Object.values(KV.get('tasks', {}));
      }
    },
    async deleteTask(id) {
      try {
        await tx('tasks', 'readwrite', (store) => {
          store.delete(id);
          return { __req: { result: true } };
        });
      } catch (_) {
        const tasks = KV.get('tasks', {});
        delete tasks[id];
        KV.set('tasks', tasks);
      }
    },
    async wipe() {
      try {
        await tx('messages', 'readwrite', (store) => {
          store.clear();
          return { __req: { result: true } };
        });
        await tx('tasks', 'readwrite', (store) => {
          store.clear();
          return { __req: { result: true } };
        });
      } catch (_) {}
    },
  };

  A.store = { KV, DB, PREFIX };
})();
