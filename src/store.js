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
      /* Paid placements are shown by default. They are how Blocket makes its
         money on this page, and quietly dropping them is the thing that would
         turn a reading aid into something they had cause to object to. The
         switch is there for anyone who would rather not see them. */
      showAds: true,
      columns: {
        year: true, mileage: true, milPerYear: false, fuel: true,
        transmission: true, price: true, location: true, seller: true, age: true,
      },
    },
  };

  let cache = JSON.parse(JSON.stringify(DEFAULTS));
  const listeners = new Set();

  /* Deep merge, used for `prefs` only.
   *
   * It walks the patch's keys, never the base's, so it cannot remove a key.
   * That is fine for prefs — every pref has a default and none is ever deleted
   * — but it is wrong for the collections. `hidden` and `seen` are maps whose
   * whole point is that entries come out again: merging an un-hide would keep
   * the id in the mirror while the shrunken map went to disk, and the tab
   * would go on hiding an ad the user had just restored. Those keys are always
   * written whole by their callers, so they are assigned outright below. */
  const mergePrefs = (base, patch) => {
    const out = Object.assign({}, base);
    for (const k of Object.keys(patch || {})) {
      const v = patch[k];
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object'
        ? mergePrefs(base[k], v)
        : v;
    }
    return out;
  };

  /* Apply a patch of top-level keys: `prefs` merges, everything else replaces. */
  const apply = (base, patch) => {
    const out = Object.assign({}, base);
    for (const k of Object.keys(patch || {})) {
      const v = patch[k];
      if (v === undefined) continue;   // a cleared key from onChanged
      out[k] = k === 'prefs' ? mergePrefs(base.prefs, v) : v;
    }
    return out;
  };

  const notify = () => listeners.forEach((fn) => { try { fn(cache); } catch (_) {} });

  const ready = new Promise((resolve) => {
    try {
      chrome.storage.local.get(null, (stored) => {
        cache = apply(DEFAULTS, stored || {});
        resolve(cache);
      });
    } catch (_) {
      resolve(cache);
    }
  });

  /* onChanged is the only place listeners are notified.
   *
   * It fires in the writing context as well as in other tabs, so notifying
   * from persist() too meant every change rebuilt the whole table twice, a
   * frame apart. Nothing is lost by dropping the synchronous call: each of
   * content.js's own mutation handlers already calls render() directly, so
   * the acting tab repaints immediately either way, and listeners exist to
   * carry changes *between* contexts — another tab, or the popup. */
  const listenerAttached = (() => {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const patch = {};
        for (const k of Object.keys(changes)) patch[k] = changes[k].newValue;
        cache = apply(cache, patch);
        notify();
      });
      return true;
    } catch (_) {
      return false;
    }
  })();

  const persist = (patch) => {
    cache = apply(cache, patch);
    let wrote = false;
    try {
      chrome.storage.local.set(patch, () => {
        /* A rejected write — quota, most likely — otherwise fails silently
           while the mirror keeps the value, so the tab behaves as though it
           saved and the data is gone on the next load. */
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) console.warn('[Blocket klassisk vy] kunde inte spara:', err.message);
      });
      wrote = true;
    } catch (_) {}
    /* With no storage to echo back through, fall back to notifying directly. */
    if (!wrote || !listenerAttached) notify();
  };

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

    /* Saved searches are keyed by URL, so the URL has to be stable: the same
       search saved from page 3, or with its parameters typed in a different
       order, must not become a second entry. Drop the page and sort the rest.
       Diffing a saved search against what it returned last time will need this
       key to hold still too. */
    searchKey(url) {
      try {
        const u = new URL(url);
        u.searchParams.delete('page');
        const pairs = [...u.searchParams.entries()].sort(
          (a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : (a[0] < b[0] ? -1 : 1))
        );
        u.search = '';
        for (const [k, v] of pairs) u.searchParams.append(k, v);
        return u.toString();
      } catch (_) {
        return url;
      }
    },

    saveSearch(label, url) {
      const key = this.searchKey(url);
      const list = cache.savedSearches.filter((s) => this.searchKey(s.url) !== key);
      list.unshift({ label, url: key, savedAt: Date.now() });
      persist({ savedSearches: list.slice(0, 40) });
    },

    removeSearch(url) {
      const key = this.searchKey(url);
      persist({ savedSearches: cache.savedSearches.filter((s) => this.searchKey(s.url) !== key) });
    },

    resetHidden() { persist({ hidden: {} }); },

    setPref(path, value) {
      const parts = path.split('.');
      const patch = {};
      let node = patch;
      for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] = {};
      node[parts[parts.length - 1]] = value;
      /* Write the whole merged prefs object, not just the changed leaf: a
         `set` replaces the top-level key outright, so a partial write would
         drop every other preference from disk. */
      persist({ prefs: mergePrefs(cache.prefs, patch) });
    },

    resetSeen() { persist({ seen: {} }); },
  };
})();
