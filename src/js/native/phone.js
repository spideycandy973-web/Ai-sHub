/* ════════════════════════════════════════════════════════════════
   Ai'sHub · phone bridge
   Talks to the native PhoneControl plugin inside the Android app and
   exposes one promise-based API for the agent. On the web build every
   call fails gracefully so the rest of the app keeps working.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.A;

  const native = () => {
    const cap = window.Capacitor;
    if (!cap) return null;
    if (cap.isNativePlatform && !cap.isNativePlatform()) return null;
    const plugin = cap.Plugins?.PhoneControl;
    return plugin || null;
  };

  const available = () => Boolean(native());

  /** Call a native method; resolves to {ok, ...} or throws a readable error. */
  async function call(method, args = {}) {
    const plugin = native();
    if (!plugin) throw new Error('Phone control needs the Ai\'sHub Android app. On the web this is not available.');
    if (typeof plugin[method] !== 'function') throw new Error(`This build does not expose "${method}". Update the app.`);
    return plugin[method](args);
  }

  async function capabilities() {
    if (!available()) {
      return { platform: 'web', features: {}, webLimitations: true };
    }
    try {
      return await call('capabilities');
    } catch (err) {
      return { platform: 'android', features: {}, error: err.message };
    }
  }

  A.phone = { available, call, capabilities, native };
})();
