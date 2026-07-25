/* content.js — builds the classic list view out of the data the page loaded. */
(() => {
  'use strict';

  const F = () => window.BCFormat;
  const S = () => window.BCStore;

  const state = {
    docs: [],
    filters: [],
    metadata: null,
    sortKey: null,
    sortDir: 1,
    mounted: false,
  };

  /* ------------------------------------------------------------------ *
   * Data in                                                            *
   * ------------------------------------------------------------------ */

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__blocketClassic !== true) return;

    if (d.kind === 'data' && d.payload && Array.isArray(d.payload.docs)) {
      state.docs = d.payload.docs;
      state.filters = d.payload.filters || [];
      state.metadata = d.payload.metadata || null;
      state.sortKey = null; // a fresh server result wins over a local column sort
      scheduleRender();
    } else if (d.kind === 'route') {
      scheduleRender();
    }
  });

  let raf = null;
  const scheduleRender = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; render(); });
  };

  /* ------------------------------------------------------------------ *
   * Small DOM helpers                                                  *
   * ------------------------------------------------------------------ */

  const el = (tag, attrs, children) => {
    const n = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children || [])) {
      if (c == null || c === false) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  };

  /* ------------------------------------------------------------------ *
   * Columns                                                            *
   * ------------------------------------------------------------------ */

  const COLUMNS = [
    { key: 'title', label: 'Bil', cls: 'bc-c-title', sort: (r) => (r.title + ' ' + r.spec).toLowerCase() },
    { key: 'year', label: 'År', cls: 'bc-c-num', sort: (r) => r.year },
    { key: 'mileage', label: 'Mil', cls: 'bc-c-num', sort: (r) => r.mileage },
    { key: 'milPerYear', label: 'Mil/år', cls: 'bc-c-num', sort: (r) => r.milPerYear },
    { key: 'fuel', label: 'Drivmedel', cls: 'bc-c-txt', sort: (r) => r.fuel },
    { key: 'transmission', label: 'Låda', cls: 'bc-c-txt', sort: (r) => r.transmission },
    { key: 'price', label: 'Pris', cls: 'bc-c-num bc-c-price', sort: (r) => r.priceAmount },
    { key: 'location', label: 'Ort', cls: 'bc-c-txt', sort: (r) => r.location },
    { key: 'seller', label: 'Säljare', cls: 'bc-c-txt', sort: (r) => r.seller },
    { key: 'age', label: 'Lagd', cls: 'bc-c-num bc-c-age', sort: (r) => -(r.timestamp || 0) },
  ];

  /* Server-side sorts Blocket itself supports, mapped to our column keys. */
  const SERVER_SORT = {
    price: ['PRICE_ASC', 'PRICE_DESC'],
    mileage: ['MILEAGE_ASC', 'MILEAGE_DESC'],
    year: ['YEAR_DESC', 'YEAR_ASC'],
    age: ['PUBLISHED_DESC', null],
  };

  /* ------------------------------------------------------------------ *
   * Render                                                             *
   * ------------------------------------------------------------------ */

  const isSearchPage = () => location.pathname.startsWith('/mobility/search');
  const isItemPage = () => location.pathname.startsWith('/mobility/item');

  const rowsFromDocs = () => {
    const prefs = S().state.prefs;
    let rows = state.docs.map(F().toRow);
    if (prefs.hideHidden) rows = rows.filter((r) => !S().isHidden(r.id));

    if (state.sortKey) {
      const col = COLUMNS.find((c) => c.key === state.sortKey);
      if (col) {
        rows.sort((a, b) => {
          const av = col.sort(a), bv = col.sort(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;   // blanks always sink
          if (bv == null) return -1;
          if (av < bv) return -1 * state.sortDir;
          if (av > bv) return 1 * state.sortDir;
          return 0;
        });
      }
    }
    return rows;
  };

  const setUrlParam = (patch) => {
    const u = new URL(location.href);
    for (const k of Object.keys(patch)) {
      if (patch[k] == null) u.searchParams.delete(k);
      else u.searchParams.set(k, patch[k]);
    }
    location.href = u.toString();
  };

  const buildToolbar = (rows) => {
    const prefs = S().state.prefs;
    const total = state.metadata && state.metadata.result_size ? state.metadata.result_size.match_count : null;
    const hiddenCount = state.docs.filter((d) => S().isHidden(String(d.ad_id))).length;

    const densityBtn = (value, label) =>
      el('button', {
        class: 'bc-seg' + (prefs.density === value ? ' bc-seg-on' : ''),
        type: 'button',
        text: label,
        onclick: () => { S().setPref('density', value); render(); },
      });

    return el('div', { class: 'bc-toolbar' }, [
      el('div', { class: 'bc-count' }, [
        el('strong', { text: total != null ? F().num(total) : String(rows.length) }),
        ' träffar',
        rows.length < state.docs.length
          ? el('span', { class: 'bc-muted', text: ` · ${hiddenCount} dolda` })
          : null,
      ]),

      el('div', { class: 'bc-tools' }, [
        el('div', { class: 'bc-segs' }, [
          densityBtn('compact', 'Tät'),
          densityBtn('normal', 'Normal'),
          densityBtn('photos', 'Bilder'),
        ]),

        el('label', { class: 'bc-check' }, [
          el('input', {
            type: 'checkbox', ...(prefs.dimSeen ? { checked: true } : {}),
            onchange: (e) => { S().setPref('dimSeen', e.target.checked); render(); },
          }),
          ' Tona sedda',
        ]),

        el('button', {
          class: 'bc-btn bc-btn-quiet', type: 'button',
          title: 'Växla mellan ljust och mörkt',
          text: prefs.theme === 'dark' ? '☀' : '☾',
          onclick: () => { S().setPref('theme', prefs.theme === 'dark' ? 'light' : 'dark'); render(); },
        }),

        el('button', {
          class: 'bc-btn', type: 'button', text: '☆ Spara sökning',
          onclick: () => {
            const label = prompt('Namn på sökningen:', document.title.replace(' | Blocket', ''));
            if (label) S().saveSearch(label, location.href);
          },
        }),

        hiddenCount
          ? el('button', {
              class: 'bc-btn bc-btn-quiet', type: 'button',
              text: prefs.hideHidden ? 'Visa dolda' : 'Göm dolda',
              onclick: () => { S().setPref('hideHidden', !prefs.hideHidden); render(); },
            })
          : null,
      ]),
    ]);
  };

  const buildHead = () => {
    const prefs = S().state.prefs;
    const cells = [el('th', { class: 'bc-c-pick', title: 'Jämför' }, '')];

    if (prefs.density === 'photos' || prefs.density === 'normal') {
      cells.push(el('th', { class: 'bc-c-thumb' }, ''));
    }

    for (const col of COLUMNS) {
      if (col.key !== 'title' && prefs.columns[col.key] === false) continue;
      const active = state.sortKey === col.key;
      cells.push(
        el('th', {
          class: col.cls + ' bc-col-' + col.key + (active ? ' bc-sorted' : ''),
          scope: 'col',
          onclick: () => {
            if (state.sortKey === col.key) state.sortDir *= -1;
            else { state.sortKey = col.key; state.sortDir = col.key === 'price' || col.key === 'mileage' ? 1 : -1; }
            render();
          },
        }, [
          col.label,
          el('span', { class: 'bc-arrow', text: active ? (state.sortDir === 1 ? '▲' : '▼') : '' }),
        ])
      );
    }
    cells.push(el('th', { class: 'bc-c-act' }, ''));
    return el('thead', {}, el('tr', {}, cells));
  };

  const buildRow = (r) => {
    const prefs = S().state.prefs;
    const seen = S().isSeen(r.id);
    const inCompare = S().state.compare.includes(r.id);

    const cells = [
      el('td', { class: 'bc-c-pick' },
        el('input', {
          type: 'checkbox', 'aria-label': 'Jämför', ...(inCompare ? { checked: true } : {}),
          onclick: (e) => { e.stopPropagation(); S().toggleCompare(r.id); render(); },
        })
      ),
    ];

    if (prefs.density === 'photos' || prefs.density === 'normal') {
      cells.push(
        el('td', { class: 'bc-c-thumb' },
          r.image
            ? el('img', { src: r.image, loading: 'lazy', alt: '', width: 96, height: 72 })
            : el('div', { class: 'bc-nothumb', text: '—' })
        )
      );
    }

    const titleCell = el('td', { class: 'bc-c-title bc-col-title' }, [
      el('a', { class: 'bc-title', href: r.url, text: r.title }),
      r.spec ? el('span', { class: 'bc-spec', text: r.spec }) : null,
    ]);
    cells.push(titleCell);

    const push = (key, cls, content, titleAttr) => {
      if (prefs.columns[key] === false) return;
      cells.push(el('td', { class: cls + ' bc-col-' + key, title: titleAttr || null }, content));
    };

    push('year', 'bc-c-num', r.year != null ? String(r.year) : '—');
    push('mileage', 'bc-c-num', r.mileage != null ? F().mil(r.mileage) : '—');
    push('milPerYear', 'bc-c-num', r.milPerYear != null ? F().num(r.milPerYear) : '—');
    push('fuel', 'bc-c-txt', r.fuelShort || '—', r.fuel);
    push('transmission', 'bc-c-txt', r.transmissionShort || '—', r.transmission);
    push('price', 'bc-c-num bc-c-price', r.priceText || '—');
    push('location', 'bc-c-txt', r.location || '—');
    push('seller', 'bc-c-txt',
      el('span', { class: r.isDealer ? 'bc-dealer' : 'bc-private', text: r.seller || '—' }),
      r.isDealer ? 'Bilhandlare' : 'Privatperson');
    push('age', 'bc-c-num bc-c-age', F().age(r.timestamp) || '—');

    cells.push(
      el('td', { class: 'bc-c-act' },
        el('button', {
          class: 'bc-x', type: 'button', title: 'Dölj den här annonsen', text: '✕',
          onclick: (e) => { e.stopPropagation(); S().toggleHidden(r.id); render(); },
        })
      )
    );

    return el('tr', {
      class: 'bc-row' + (seen && prefs.dimSeen ? ' bc-seen' : '') + (inCompare ? ' bc-picked' : ''),
      dataset: { id: r.id },
      onclick: (e) => {
        if (e.target.closest('button, input, a')) return;
        S().markSeen(r.id);
        window.open(r.url, e.metaKey || e.ctrlKey ? '_blank' : '_self');
      },
    }, cells);
  };

  const buildPager = () => {
    const p = state.metadata && state.metadata.paging;
    if (!p || !p.last || p.last < 2) return null;
    const cur = p.current || 1;
    const param = p.param || 'page';
    const mk = (n, label) =>
      el('button', {
        class: 'bc-page' + (n === cur ? ' bc-page-on' : ''), type: 'button',
        text: label || String(n),
        onclick: () => setUrlParam({ [param]: n === 1 ? null : n }),
      });

    const nums = [];
    const from = Math.max(1, cur - 3), to = Math.min(p.last, cur + 3);
    if (from > 1) { nums.push(mk(1)); if (from > 2) nums.push(el('span', { class: 'bc-gap', text: '…' })); }
    for (let i = from; i <= to; i++) nums.push(mk(i));
    if (to < p.last) { if (to < p.last - 1) nums.push(el('span', { class: 'bc-gap', text: '…' })); nums.push(mk(p.last)); }

    return el('nav', { class: 'bc-pager' }, [
      cur > 1 ? mk(cur - 1, '‹ Föregående') : null,
      el('div', { class: 'bc-pagenums' }, nums),
      cur < p.last ? mk(cur + 1, 'Nästa ›') : null,
    ]);
  };

  const buildCompareTray = () => {
    const ids = S().state.compare;
    if (!ids.length) return null;
    const byId = new Map(state.docs.map((d) => [String(d.ad_id), F().toRow(d)]));
    const chips = ids.map((id) => {
      const r = byId.get(id);
      return el('span', { class: 'bc-chip' }, [
        r ? r.title : 'Annons ' + id,
        el('button', { class: 'bc-chip-x', type: 'button', text: '✕', onclick: () => { S().toggleCompare(id); render(); } }),
      ]);
    });
    return el('div', { class: 'bc-tray' }, [
      el('strong', { text: `Jämför (${ids.length})` }),
      el('div', { class: 'bc-chips' }, chips),
      el('button', { class: 'bc-btn', type: 'button', text: 'Öppna alla', onclick: () => ids.forEach((id) => { const r = byId.get(id); if (r) window.open(r.url, '_blank'); }) }),
      el('button', { class: 'bc-btn bc-btn-quiet', type: 'button', text: 'Rensa', onclick: () => { S().clearCompare(); render(); } }),
    ]);
  };

  const render = () => {
    if (!isSearchPage()) { renderItemPage(); return; }
    const host = document.querySelector('.sf-result-list');
    if (!host || !state.docs.length) return;

    document.documentElement.classList.add('bc-on');
    document.documentElement.dataset.bcDensity = S().state.prefs.density;
    document.documentElement.dataset.bcTheme = S().state.prefs.theme || 'light';

    const rows = rowsFromDocs();

    let root = document.getElementById('bc-root');
    if (!root) {
      root = el('div', { id: 'bc-root' });
      host.parentNode.insertBefore(root, host);
      state.mounted = true;
    }
    root.textContent = '';

    root.appendChild(buildToolbar(rows));
    root.appendChild(
      el('table', { class: 'bc-table' }, [
        buildHead(),
        el('tbody', {}, rows.map(buildRow)),
      ])
    );
    const pager = buildPager();
    if (pager) root.appendChild(pager);

    let tray = document.getElementById('bc-tray');
    if (tray) tray.remove();
    const t = buildCompareTray();
    if (t) { t.id = 'bc-tray'; document.body.appendChild(t); }
  };

  /* ------------------------------------------------------------------ *
   * Ad detail page: pull the facts above the fold                      *
   * ------------------------------------------------------------------ */

  const renderItemPage = () => {
    if (!isItemPage()) return;
    document.documentElement.classList.add('bc-on', 'bc-item');
    if (document.getElementById('bc-specbar')) return;

    const dts = [...document.querySelectorAll('dt')];
    if (!dts.length) return;

    const WANT = ['Modellår', 'Miltal', 'Drivmedel', 'Växellåda', 'Effekt', 'Drivhjul', 'Biltyp', 'Färg', 'Antal ägare', 'Nästa besiktningsdatum'];
    const pairs = [];
    for (const dt of dts) {
      const label = dt.textContent.trim().split(/(?<=[a-zåäö])(?=[A-ZÅÄÖ])/)[0];
      const dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== 'DD') continue;
      if (WANT.some((w) => label.startsWith(w))) pairs.push([label, dd.textContent.trim()]);
    }
    if (!pairs.length) return;

    const bar = el('div', { id: 'bc-specbar', class: 'bc-specbar' },
      pairs.map(([k, v]) => el('div', { class: 'bc-specitem' }, [
        el('span', { class: 'bc-speck', text: k }),
        el('span', { class: 'bc-specv', text: v }),
      ]))
    );

    const h1 = document.querySelector('h1');
    const anchor = h1 && h1.parentElement ? h1.parentElement : document.querySelector('main');
    if (anchor) anchor.insertAdjacentElement('afterend', bar);
  };

  /* ------------------------------------------------------------------ *
   * Boot                                                               *
   * ------------------------------------------------------------------ */

  const boot = () => {
    S().ready.then(() => {
      S().onChange(scheduleRender);
      scheduleRender();
      // Blocket re-renders its own list on navigation; keep ours alive.
      const mo = new MutationObserver(() => {
        if (isSearchPage() && state.docs.length && !document.getElementById('bc-root')) scheduleRender();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
