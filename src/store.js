/* store.js — thin wrapper over chrome.storage.local with an in-memory mirror.
 *
 * Everything here stays on the machine. Nothing is sent anywhere.
 */
(() => {
  'use strict';

  const DEFAULTS = {
    seen: {},          // adId -> timestamp first seen
    hidden: {},        // adId -> true
    compare: [],       // [adId]
    savedSearches: [], // [{label, url, savedAt}]
    prefs: {
      density: 'normal',   // 'compact' | 'normal' | 'photos'
      /* light by default: Blocket's page is white whatever the OS says */
      theme: 'light',      // 'light' | 'dark'
      dimSeen: true,
      hideHidden: true,
      columns: {
        year: true, mileage: true, milPerYear: false, fuel: true,
        transmission: true, price: true, location: true, seller: true, age: true,
      },
    },
  };

  let cache = JSON.parse(JSON.stringify(DEFAULTS));
  const listeners = new Set();

  const merge = (base, patch) => {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (const k of Object.keys(patch || {})) {
      const v = patch[k];
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object'
        ? merge(base[k], v)
        : v;
    }
    return out;
  };

  const ready = new Promise((resolve) => {
    try {
      chrome.storage.local.get(null, (stored) => {
        cache = merge(DEFAULTS, stored || {});
        resolve(cache);
      });
    } catch (_) {
      resolve(cache);
    }
  });

  const persist = (patch) => {
    cache = merge(cache, patch);
    try { chrome.storage.local.set(patch); } catch (_) {}
    listeners.forEach((fn) => { try { fn(cache); } catch (_) {} });
  };

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const patch = {};
      for (const k of Object.keys(changes)) patch[k] = changes[k].newValue;
      cache = merge(cache, patch);
      listeners.forEach((fn) => { try { fn(cache); } catch (_) {} });
    });
  } catch (_) {}

  window.BCStore = {
    ready,
    get state() { return cache; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    markSeen(ids) {
      const now = Date.now();
      const seen = Object.assign({}, cache.seen);
      let touched = false;
      for (const id of [].concat(ids)) {
        if (!seen[id]) { seen[id] = now; touched = true; }
      }
      if (touched) persist({ seen });
    },

    isSeen(id) { return !!cache.seen[id]; },

    toggleHidden(id) {
      const hidden = Object.assign({}, cache.hidden);
      if (hidden[id]) delete hidden[id]; else hidden[id] = true;
      persist({ hidden });
    },

    isHidden(id) { return !!cache.hidden[id]; },

    toggleCompare(id) {
      const list = cache.compare.slice();
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
      else if (list.length < 6) list.push(id);
      persist({ compare: list });
      return list;
    },

    clearCompare() { persist({ compare: [] }); },

    saveSearch(label, url) {
      const list = cache.savedSearches.filter((s) => s.url !== url);
      list.unshift({ label, url, savedAt: Date.now() });
      persist({ savedSearches: list.slice(0, 40) });
    },

    removeSearch(url) {
      persist({ savedSearches: cache.savedSearches.filter((s) => s.url !== url) });
    },

    setPref(path, value) {
      const parts = path.split('.');
      const patch = {};
      let node = patch;
      for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] = {};
      node[parts[parts.length - 1]] = value;
      persist({ prefs: merge(cache.prefs, patch.prefs || patch) });
    },

    resetSeen() { persist({ seen: {} }); },
  };
})();
