/*
 * hook.js — runs in the PAGE's own JavaScript world at document_start.
 *
 * Its only job is to observe data that Blocket's own code already loads, and
 * hand it to the extension's content script. It never issues a network request
 * of its own and never alters a response before the page sees it.
 *
 * Two sources:
 *   1. The server-rendered payload. Blocket ships a dehydrated TanStack Query
 *      cache as base64 inside <script type="application/json">. That is the
 *      data for the first page you land on.
 *   2. Client-side navigation. Changing a filter, a page or a sort makes the
 *      app call /mobility/search/api/search/<KEY>?...  We tee the response.
 */
(() => {
  'use strict';

  /* Both endpoints we care about live under this prefix — search/<KEY> for the
     organic results and pole-position/<KEY> for the paid placements — so match
     the prefix and tell them apart by the shape of what comes back. A renamed
     path still gets picked up that way; a changed response shape would not,
     but the field names have been the stable part. */
  const SEARCH_API = '/mobility/search/api/';

  /* postMessage rather than CustomEvent: it structured-clones cleanly across
     the page world / extension world boundary, with no shared object identity. */
  const post = (kind, source, payload, url) => {
    try {
      window.postMessage(
        { __blocketClassic: true, kind, source, url: url || location.href, payload },
        location.origin
      );
    } catch (_) {
      /* a payload that cannot be structured-cloned is not worth crashing over */
    }
  };

  const emit = (source, payload, url) => post('data', source, payload, url);
  const emitAds = (source, results, url) => post('ads', source, results, url);

  /* `docs` is the organic result set, `results` the paid placements. */
  const dispatchBody = (source, body, url) => {
    if (!body) return;
    if (Array.isArray(body.docs)) emit(source, body, url);
    else if (Array.isArray(body.results)) emitAds(source, body.results, url);
  };

  /* ---------------------------------------------------------------- *
   * 1. The server-rendered dehydrated cache                          *
   * ---------------------------------------------------------------- */

  const decodeMaybeBase64 = (text) => {
    const raw = text.trim();
    if (!raw) return null;
    // Fast path: already plain JSON.
    if (raw[0] === '{' || raw[0] === '[') {
      try { return JSON.parse(raw); } catch (_) { return null; }
    }
    // Blocket base64-encodes the big one.
    try {
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) {
      return null;
    }
  };

  const seenScripts = new WeakSet();

  const harvestScript = (el) => {
    if (!el || el.tagName !== 'SCRIPT') return;
    if (el.type !== 'application/json') return;
    if (seenScripts.has(el)) return;
    seenScripts.add(el);

    const data = decodeMaybeBase64(el.textContent || '');
    if (!data || !Array.isArray(data.queries)) return;

    for (const q of data.queries) {
      const key = Array.isArray(q.queryKey) ? q.queryKey[0] : null;
      const scope = key && key.scope;
      const body = q.state && q.state.data;
      if (!body) continue;
      if (scope === 'search' && Array.isArray(body.docs)) {
        emit('ssr', body);
      } else if (scope === 'poleposition' && Array.isArray(body.results)) {
        /* The paid placements ride along in the same dehydrated cache and were
           previously dropped on the floor here, which is why sponsored rows
           never reached the table. */
        emitAds('ssr', body.results);
      }
    }
  };

  const scanExisting = () => {
    document.querySelectorAll('script[type="application/json"]').forEach(harvestScript);
  };

  // Scripts stream in during parse, so watch as well as scan.
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'SCRIPT') harvestScript(node);
        else if (node.querySelectorAll) node.querySelectorAll('script[type="application/json"]').forEach(harvestScript);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => { scanExisting(); }, { once: true });
  scanExisting();

  /* ---------------------------------------------------------------- *
   * 2. Tee the app's own search XHR / fetch                          *
   * ---------------------------------------------------------------- */

  const isSearchCall = (url) => {
    try {
      const u = new URL(url, location.origin);
      return u.origin === location.origin && u.pathname.includes(SEARCH_API);
    } catch (_) {
      return false;
    }
  };

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const p = nativeFetch.apply(this, arguments);
      if (!isSearchCall(url)) return p;
      return p.then((res) => {
        // clone() so the page still gets an unread body
        try {
          res.clone().json().then((body) => {
            dispatchBody('xhr', body, url);
          }).catch(() => {});
        } catch (_) {}
        return res;
      });
    };
  }

  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      this.__bcUrl = url;
      return open.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      if (isSearchCall(this.__bcUrl || '')) {
        this.addEventListener('load', () => {
          try {
            const body = typeof this.response === 'string' ? JSON.parse(this.response) : this.response;
            dispatchBody('xhr', body, this.__bcUrl);
          } catch (_) {}
        });
      }
      return send.apply(this, arguments);
    };
  }

  /* ---------------------------------------------------------------- *
   * 3. Tell the content script when the app navigates client-side    *
   * ---------------------------------------------------------------- */

  const announceRoute = () => {
    try {
      window.postMessage({ __blocketClassic: true, kind: 'route', url: location.href }, location.origin);
    } catch (_) {}
  };
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      queueMicrotask(announceRoute);
      return r;
    };
  }
  window.addEventListener('popstate', announceRoute);
})();
