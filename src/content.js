/* content.js — builds the classic list view out of the data the page loaded. */
(() => {
  'use strict';

  const F = () => window.BCFormat;
  const S = () => window.BCStore;

  const state = {
    docs: [],
    ads: [],           // pole-position results, pinned above the organic rows
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
    } else if (d.kind === 'ads' && Array.isArray(d.payload)) {
      state.ads = d.payload;
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

  /* Read the server-rendered payload straight out of the DOM.
   *
   * hook.js broadcasts the same data, but it runs in the page world while this
   * runs in the extension world, and Chrome does not guarantee which of the two
   * document_start injections executes first. When the hook wins the race it
   * posts the payload before this listener exists and the message is lost —
   * leaving state.docs empty and nothing rendered. The script tag is still
   * sitting in the DOM either way, so read it directly rather than depending on
   * the timing. The hook is still what catches later filter/page changes.
   */
  const decodeMaybeBase64 = (text) => {
    const raw = (text || '').trim();
    if (!raw) return null;
    if (raw[0] === '{' || raw[0] === '[') {
      try { return JSON.parse(raw); } catch (_) { return null; }
    }
    try {
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) {
      return null;
    }
  };

  const harvestSsr = () => {
    if (state.docs.length) return true;
    let got = false;
    for (const s of document.querySelectorAll('script[type="application/json"]')) {
      const data = decodeMaybeBase64(s.textContent);
      if (!data || !Array.isArray(data.queries)) continue;
      for (const q of data.queries) {
        const key = Array.isArray(q.queryKey) ? q.queryKey[0] : null;
        const scope = key && key.scope;
        const body = q.state && q.state.data;
        if (!body) continue;
        if (scope === 'search' && Array.isArray(body.docs) && body.docs.length) {
          state.docs = body.docs;
          state.filters = body.filters || [];
          state.metadata = body.metadata || null;
          got = true;
        } else if (scope === 'poleposition' && Array.isArray(body.results)) {
          /* Same cache, same pass — the paid placements sit right beside the
             organic results and were being skipped over. */
          state.ads = body.results;
        }
      }
      /* Keep scanning the rest of this script's queries so the ads in it are
         not missed, but stop once a script has yielded the organic set. */
      if (got) return true;
    }
    return got;
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
    { key: 'age', label: 'Inlagd', cls: 'bc-c-num bc-c-age', sort: (r) => -(r.timestamp || 0) },
  ];

  /* Blocket's own sorts, mapped to our column keys as [ascending, descending].
   *
   * Where a column has one, clicking its header hands the sort to the server
   * via ?sort= and it applies to the whole result set. Columns with no server
   * equivalent — drivmedel, låda, ort, säljare, mil/år — still sort locally,
   * which only reorders the fifty rows on this page.
   *
   * Values come from the payload's `sort` scope; `null` means Blocket offers no
   * sort in that direction, so that click falls back to the local sort. */
  const SERVER_SORT = {
    title: ['MODEL', null],
    year: ['YEAR_ASC', 'YEAR_DESC'],
    mileage: ['MILEAGE_ASC', 'MILEAGE_DESC'],
    price: ['PRICE_ASC', 'PRICE_DESC'],
    age: [null, 'PUBLISHED_DESC'],
  };

  /* Which column, if any, the server's current sort corresponds to — so the
     arrow reflects what actually happened rather than what we last clicked. */
  const serverSortState = () => {
    const cur = new URL(location.href).searchParams.get('sort')
      || (state.metadata && state.metadata.sort);
    if (!cur) return null;
    for (const key of Object.keys(SERVER_SORT)) {
      const [asc, desc] = SERVER_SORT[key];
      if (cur === asc) return { key, dir: 1 };
      if (cur === desc) return { key, dir: -1 };
    }
    return null;
  };

  /* ------------------------------------------------------------------ *
   * Render                                                             *
   * ------------------------------------------------------------------ */

  const isSearchPage = () => location.pathname.startsWith('/mobility/search');
  const isItemPage = () => location.pathname.startsWith('/mobility/item');

  /* Paid placements as rows.
   *
   * A pole-position result wraps a `searchEntry` carrying every field an
   * organic doc has, so toRow maps it unchanged. They stay pinned at the top
   * and keep their "Betald placering" marker rather than being sorted in
   * among the organic rows, because a sponsored listing that sorts like an
   * ordinary one is a sponsored listing in disguise. */
  const adRows = () => {
    const prefs = S().state.prefs;
    if (prefs.showAds === false) return [];
    return state.ads.map((r) => {
      const entry = r && r.searchEntry;
      if (!entry) return null;
      const row = F().toRow(entry);
      row.isAd = true;
      row.adLabel = (Array.isArray(entry.labels) && entry.labels.length && entry.labels[0].text)
        || (Array.isArray(r.labels) && r.labels[0])
        || 'Betald placering';
      /* Follow their click-tracking URL when there is one, so the advertiser
         still gets the click attributed. Navigating on a click the user made
         is their request, not one of ours. */
      if (Array.isArray(r.clickUrls) && r.clickUrls.length) row.url = r.clickUrls[0];
      return row;
    }).filter(Boolean);
  };

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

  /* ------------------------------------------------------------------ *
   * Filter chip row — the pre-Nov-2025 arrangement                     *
   *                                                                    *
   * The old /bilar/sok put eight dropdown chips in a row above the      *
   * results, with everything else behind "Visa alla filter". Labels and *
   * order below are taken verbatim from the archived DOM (Wayback,      *
   * 2025-09-16). The current site instead stacks all 22 filters in a    *
   * 10 349px sidebar.                                                   *
   * ------------------------------------------------------------------ */

  const CHIPS = [
    { label: 'Märke & modell', name: 'variant' },
    { label: 'Drivmedel', name: 'fuel' },
    { label: 'Biltyp', name: 'body_type' },
    { label: 'Pris', name: 'price' },
    { label: 'Modellår', name: 'year' },
    { label: 'Miltal', name: 'mileage' },
    { label: 'Växellåda', name: 'transmission' },
    { label: 'Säljare', name: 'dealer_segment' },
  ];

  const findFilter = (name) => (state.filters || []).find((f) => f.name === name);

  const currentParams = () => new URL(location.href).searchParams;

  const applyParams = (mutate) => {
    const u = new URL(location.href);
    mutate(u.searchParams);
    u.searchParams.delete('page'); // a new filter always means page 1
    location.href = u.toString();
  };

  /* How many values are active for a chip, so it can show "Pris (1)". */
  const activeCount = (f) => {
    if (!f) return 0;
    const p = currentParams();
    if (f.type === 'RANGE_FILTER') {
      return (p.has(f.name_from) || p.has(f.name_to)) ? 1 : 0;
    }
    return p.getAll(f.name).length;
  };

  const closePanels = () => {
    document.querySelectorAll('.bc-chip-panel').forEach((n) => n.remove());
    document.querySelectorAll('.bc-fchip.bc-fchip-open').forEach((n) => n.classList.remove('bc-fchip-open'));
  };

  const buildRangePanel = (f) => {
    const p = currentParams();
    const from = el('input', {
      class: 'bc-range', type: 'number', placeholder: 'Från',
      value: p.get(f.name_from) || '', inputmode: 'numeric',
    });
    const to = el('input', {
      class: 'bc-range', type: 'number', placeholder: 'Till',
      value: p.get(f.name_to) || '', inputmode: 'numeric',
    });
    return el('div', { class: 'bc-chip-panel bc-chip-panel-range' }, [
      el('div', { class: 'bc-rangerow' }, [from, el('span', { class: 'bc-rangedash', text: '–' }), to]),
      f.unit ? el('div', { class: 'bc-rangeunit', text: f.unit }) : null,
      el('div', { class: 'bc-panelfoot' }, [
        el('button', {
          class: 'bc-btn bc-btn-quiet', type: 'button', text: 'Rensa',
          onclick: () => applyParams((q) => { q.delete(f.name_from); q.delete(f.name_to); }),
        }),
        el('button', {
          class: 'bc-btn bc-btn-primary', type: 'button', text: 'Visa',
          onclick: () => applyParams((q) => {
            q.delete(f.name_from); q.delete(f.name_to);
            if (from.value) q.set(f.name_from, from.value);
            if (to.value) q.set(f.name_to, to.value);
          }),
        }),
      ]),
    ]);
  };

  const buildListPanel = (f) => {
    const selected = new Set(currentParams().getAll(f.name));

    /* Sub-levels stay folded away until their parent is ticked. These lists
       nest — 145 brands, each with models, each with variants; 21 regions,
       each with municipalities — so drawing the whole tree at once buries the
       top level under thousands of rows nobody asked for. Pick Audi and its
       models appear, which is how the old panel behaved. Seeded from the URL
       so an already-applied brand comes back open. */
    const expanded = new Set(selected);

    /* Unticking a parent takes its descendants with it, otherwise a model
       stays applied while the brand that revealed it is gone. */
    const descendantsOf = (item, out) => {
      for (const kid of item.filter_items || []) {
        out.push(String(kid.value));
        descendantsOf(kid, out);
      }
      return out;
    };

    const body = el('div', { class: 'bc-panelbody' });

    const paint = () => {
      body.textContent = '';
      const addItem = (item, depth) => {
        const val = String(item.value);
        const kids = item.filter_items || [];
        const id = 'bc-f-' + f.name + '-' + val;
        body.appendChild(
          el('label', { class: 'bc-fitem' + (depth ? ' bc-fitem-sub' : ''), for: id }, [
            el('input', {
              type: 'checkbox', id, value: val,
              ...(selected.has(val) ? { checked: true } : {}),
              onchange: (e) => {
                if (e.target.checked) {
                  selected.add(val);
                  if (kids.length) expanded.add(val);
                } else {
                  selected.delete(val);
                  expanded.delete(val);
                  for (const d of descendantsOf(item, [])) { selected.delete(d); expanded.delete(d); }
                }
                paint();
              },
            }),
            el('span', { class: 'bc-fname', text: item.display_name }),
            typeof item.hits === 'number'
              ? el('span', { class: 'bc-fhits', text: F().num(item.hits) })
              : null,
          ])
        );
        if (expanded.has(val)) for (const kid of kids) addItem(kid, (depth || 0) + 1);
      };
      for (const item of f.filter_items || []) addItem(item, 0);
    };
    paint();

    const panel = el('div', { class: 'bc-chip-panel' }, [
      body,
      el('div', { class: 'bc-panelfoot' }, [
        el('button', {
          class: 'bc-btn bc-btn-quiet', type: 'button', text: 'Rensa',
          onclick: () => applyParams((q) => q.delete(f.name)),
        }),
        el('button', {
          class: 'bc-btn bc-btn-primary', type: 'button', text: 'Visa',
          /* Read the set, not the DOM: a collapsed branch has no inputs to
             query, and its selections would be silently dropped. */
          onclick: () => applyParams((q) => {
            q.delete(f.name);
            selected.forEach((v) => q.append(f.name, v));
          }),
        }),
      ]),
    ]);
    return panel;
  };

  const buildFilterBar = () => {
    const p = currentParams();
    const chips = CHIPS.map((spec) => {
      const f = findFilter(spec.name);
      const n = activeCount(f);
      const chip = el('button', {
        class: 'bc-fchip' + (n ? ' bc-fchip-active' : ''),
        type: 'button',
        disabled: !f,
        text: spec.label + (n ? ` (${n})` : ''),
        onclick: (e) => {
          e.stopPropagation();
          const wasOpen = chip.classList.contains('bc-fchip-open');
          closePanels();
          if (wasOpen || !f) return;
          chip.classList.add('bc-fchip-open');
          const panel = f.type === 'RANGE_FILTER' ? buildRangePanel(f) : buildListPanel(f);
          panel.addEventListener('click', (ev) => ev.stopPropagation());
          chip.parentElement.appendChild(panel);
          panel.style.left = Math.max(0, chip.offsetLeft) + 'px';
        },
      });
      return el('span', { class: 'bc-fchipwrap' }, chip);
    });

    /* "Visa alla filter" reveals Blocket's own sidebar, which holds the
       fourteen filters the old chip row did not surface. */
    const allBtn = el('button', {
      class: 'bc-fchip bc-fchip-all', type: 'button', text: '☰ Visa alla filter',
      onclick: () => {
        document.documentElement.classList.toggle('bc-sidebar-open');
        render();
      },
    });

    /* Active filters, listed the way the old page did, with Rensa (n). */
    const active = [];
    for (const spec of CHIPS) {
      const f = findFilter(spec.name);
      if (!f) continue;
      if (f.type === 'RANGE_FILTER') {
        const lo = p.get(f.name_from), hi = p.get(f.name_to);
        if (lo || hi) {
          active.push({
            text: `${spec.label}: ${lo || ''}–${hi || ''} ${f.unit || ''}`.trim(),
            clear: (q) => { q.delete(f.name_from); q.delete(f.name_to); },
          });
        }
      } else {
        for (const v of p.getAll(f.name)) {
          const label = (function find(items) {
            for (const it of items || []) {
              if (String(it.value) === v) return it.display_name;
              const deeper = find(it.filter_items);
              if (deeper) return deeper;
            }
            return null;
          })(f.filter_items) || v;
          active.push({
            text: label,
            clear: (q) => {
              const keep = q.getAll(f.name).filter((x) => x !== v);
              q.delete(f.name);
              keep.forEach((x) => q.append(f.name, x));
            },
          });
        }
      }
    }

    const activeEls = active.map((a) =>
      el('span', { class: 'bc-activechip' }, [
        a.text,
        el('button', { class: 'bc-activechip-x', type: 'button', text: '✕', onclick: () => applyParams(a.clear) }),
      ])
    );

    /* Free-text search. The old page had "Sök inom Bilar" with a Sök button
       above the chips; on the current site the only search box lives inside
       the sidebar, which we hide — so without this you lose text search
       entirely. Maps to the QUERY_FILTER named q. */
    const qInput = el('input', {
      class: 'bc-qinput', type: 'search', placeholder: 'Sök inom Bilar',
      value: p.get('q') || '',
      onkeydown: (e) => { if (e.key === 'Enter') runSearch(); },
    });
    const runSearch = () => applyParams((q) => {
      const v = qInput.value.trim();
      if (v) q.set('q', v); else q.delete('q');
    });

    return el('div', { class: 'bc-filterbar' }, [
      el('div', { class: 'bc-searchrow' }, [
        qInput,
        el('button', { class: 'bc-btn bc-btn-primary', type: 'button', text: 'Sök', onclick: runSearch }),
      ]),
      el('div', { class: 'bc-chiprow' }, [allBtn, ...chips]),
      active.length
        ? el('div', { class: 'bc-activerow' }, [
            ...activeEls,
            el('button', {
              class: 'bc-btn bc-btn-quiet', type: 'button', text: `Rensa (${active.length})`,
              onclick: () => applyParams((q) => {
                for (const spec of CHIPS) {
                  const f = findFilter(spec.name);
                  if (!f) continue;
                  if (f.type === 'RANGE_FILTER') { q.delete(f.name_from); q.delete(f.name_to); }
                  else q.delete(f.name);
                }
              }),
            }),
          ])
        : null,
    ]);
  };

  document.addEventListener('click', () => closePanels());

  /* Blocket prints its own active-filter chips above the results. We render
     the old "Rensa (n)" row instead, so tag theirs for hiding rather than
     showing the same filters twice. Located by its clear-all button, since
     the surrounding classes are generated and unstable. */
  /* Old running order was: heading, result count, filter chips, sort, results.
     Blocket's sort/map toolbar sits between the count and the list, so the bar
     goes immediately before that toolbar rather than inside our own container
     (which would put it below the sort control). */
  const mountFilterBar = () => {
    const existing = document.getElementById('bc-filterbar');
    const bar = buildFilterBar();
    bar.id = 'bc-filterbar';

    if (existing) { existing.replaceWith(bar); return; }

    const mapBtn = [...document.querySelectorAll('button, a')]
      .find((b) => /Visa på kartan?$/i.test(b.textContent.trim()));
    const heading = document.getElementById('results-heading');
    const list = document.querySelector('.sf-result-list');

    /* The sort/map toolbar and the result list live in different branches, so
       find their nearest common ancestor and insert before whichever of its
       children holds the toolbar. Derived at runtime rather than assuming a
       fixed depth, because the nesting is generated markup. */
    let anchor = null;
    if (mapBtn && list) {
      let column = list;
      while (column && !column.contains(mapBtn)) column = column.parentElement;
      if (column) {
        let n = mapBtn;
        while (n && n.parentElement && n.parentElement !== column) n = n.parentElement;
        if (n && n.parentElement === column) anchor = n;
      }
    }
    if (anchor) anchor.parentElement.insertBefore(bar, anchor);
    else if (heading && heading.parentElement) heading.parentElement.insertAdjacentElement('afterend', bar);
    else {
      /* Last resort, once both anchors are gone. Aim at our own container
         rather than the list: #bc-root is itself inserted before the list, so
         anchoring on the list puts the filters underneath the table. */
      const fallback = document.getElementById('bc-root') || list;
      if (fallback && fallback.parentElement) fallback.parentElement.insertBefore(bar, fallback);
    }
  };

  /* Blocket's result count and sort dropdown sit outside the result list, so
     hiding the list leaves both behind next to our own. The count is merely
     duplicated; the sort actively conflicts, because theirs orders all 143 000
     rows while our headers used to reorder only the fifty on the page, with
     nothing to say which was in charge. Now that the headers drive ?sort=,
     theirs is redundant and can go.

     Both are found by content rather than class name — the classes around them
     are generated. Each tags the narrowest element that holds it and nothing
     else, so neighbours like "Visa på karta" survive. */
  const hideNativeChrome = () => {
    if (!document.querySelector('.bc-native-count')) {
      /* "143 583 resultat" is a span wrapping another span plus a bare text
         node, so it has element children — and there is a screen-reader copy
         of the same string elsewhere. Match on collapsed text, take the
         deepest hit, and require real width to skip the clipped sr-only one. */
      const isCount = (e) =>
        /^[\d\s]+resultat$/i.test((e.textContent || '').replace(/\s+/g, ' ').trim())
        && e.getBoundingClientRect().width > 4;
      const hits = [...document.querySelectorAll('span, p, div, h2')].filter(isCount);
      const count = hits.find((e) => !hits.some((o) => o !== e && e.contains(o)));
      if (count) count.classList.add('bc-native-count');
    }

    if (!document.querySelector('.bc-native-sort')) {
      const sel = document.querySelector('select');
      if (sel) {
        /* Climb only while the wrapper still contains nothing but the select —
           one step too far takes the map button with it. */
        let box = sel;
        while (box.parentElement
               && box.parentElement.querySelectorAll('select').length === 1
               && box.parentElement.querySelectorAll('a, button').length === 0) {
          box = box.parentElement;
        }
        box.classList.add('bc-native-sort');
      }
      /* The "så här sorteras sökträffarna" explainer is not reachable from
         here — it lives inside a podlet's shadow root. classic.css hides that
         podlet by element name instead. */
    }
  };

  const hideNativeFilterChips = () => {
    hideNativeChrome();
    if (document.querySelector('.bc-native-chips')) return;
    const clearAll = [...document.querySelectorAll('button')]
      .find((b) => /^Rensa alla filter$/i.test(b.textContent.trim()));
    const row = clearAll && clearAll.parentElement;
    if (row && row.children.length <= 12) row.classList.add('bc-native-chips');
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
      /* "Bilar, 143 589 träffar" — category then count on one line, the way
         the old breadcrumb read it. */
      el('div', { class: 'bc-count' }, [
        el('span', { class: 'bc-h2', text: 'Bilar' }),
        el('span', { class: 'bc-hits' }, [
          ', ',
          el('strong', { class: 'bc-numhits', text: total != null ? F().num(total) : String(rows.length) }),
          ' träffar',
        ]),
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

        /* Only worth a switch when there is something to switch off. */
        state.ads.length
          ? el('label', { class: 'bc-check', title: 'Betalda placeringar visas överst i listan' }, [
              el('input', {
                type: 'checkbox', ...(prefs.showAds !== false ? { checked: true } : {}),
                onchange: (e) => { S().setPref('showAds', e.target.checked); render(); },
              }),
              ' Visa annonser',
            ])
          : null,

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

    const server = serverSortState();

    for (const col of COLUMNS) {
      if (col.key !== 'title' && prefs.columns[col.key] === false) continue;

      /* The server's sort wins the indicator when there is one: it describes
         all 143 000 rows, not just the fifty in front of you. */
      const active = server ? server.key === col.key : state.sortKey === col.key;
      const dir = server && server.key === col.key ? server.dir : state.sortDir;
      const wide = !!SERVER_SORT[col.key];

      cells.push(
        el('th', {
          class: col.cls + ' bc-col-' + col.key + (active ? ' bc-sorted' : '')
            + (wide ? ' bc-sortable-all' : ' bc-sortable-page'),
          scope: 'col',
          title: wide
            ? 'Sortera hela sökresultatet'
            : 'Sorterar bara annonserna på den här sidan',
          onclick: () => {
            /* Next direction: flip if this column is already the active one,
               otherwise start with the sensible end — cheapest, fewest mil,
               newest — rather than always ascending. */
            const nextDir = active ? -dir : (col.key === 'age' || col.key === 'year' ? -1 : 1);
            const pair = SERVER_SORT[col.key];
            const wanted = pair && (nextDir === 1 ? pair[0] : pair[1]);
            if (wanted) { setUrlParam({ sort: wanted, page: null }); return; }
            state.sortKey = col.key;
            state.sortDir = nextDir;
            render();
          },
        }, [
          col.label,
          el('span', { class: 'bc-arrow', text: active ? (dir === 1 ? '▲' : '▼') : '' }),
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
      /* The marker goes before the title and stays with it in every density,
         so a sponsored row never reads as an ordinary one. */
      r.isAd ? el('span', { class: 'bc-adtag', text: r.adLabel }) : null,
      el('a', { class: 'bc-title', href: r.url, text: r.title }),
      r.spec ? el('span', { class: 'bc-spec', text: r.spec }) : null,
    ]);
    cells.push(titleCell);

    const push = (key, cls, content, titleAttr) => {
      if (prefs.columns[key] === false) return;
      cells.push(el('td', { class: cls + ' bc-col-' + key, title: titleAttr || null }, content));
    };

    push('year', 'bc-c-num', r.year != null ? String(r.year) : '—');
    /* Mileage is the one number with no sane upper bound — sellers enter
       genuine high figures and slipped decimals alike — so carry the full
       value on hover in case the column still has to clip it. */
    push('mileage', 'bc-c-num', r.mileage != null ? F().mil(r.mileage) : '—',
      r.mileage != null ? F().mil(r.mileage) + ' mil' : null);
    push('milPerYear', 'bc-c-num', r.milPerYear != null ? F().num(r.milPerYear) : '—');
    push('fuel', 'bc-c-txt', r.fuelShort || '—', r.fuel);
    push('transmission', 'bc-c-txt', r.transmissionShort || '—', r.transmission);
    push('price', 'bc-c-num bc-c-price', r.priceText || '—');
    push('location', 'bc-c-txt', r.location || '—');
    push('seller', 'bc-c-txt',
      el('span', { class: r.isDealer ? 'bc-dealer' : 'bc-private', text: r.seller || '—' }),
      r.isDealer ? 'Bilhandlare' : 'Privatperson');
    push('age', 'bc-c-num bc-c-age', F().listDate(r.timestamp) || '—',
      r.timestamp ? new Date(r.timestamp).toLocaleString('sv-SE') + ' (' + F().age(r.timestamp) + ' sedan)' : null);

    cells.push(
      el('td', { class: 'bc-c-act' },
        el('button', {
          class: 'bc-x', type: 'button', title: 'Dölj den här annonsen', text: '✕',
          onclick: (e) => { e.stopPropagation(); S().toggleHidden(r.id); render(); },
        })
      )
    );

    return el('tr', {
      class: 'bc-row' + (seen && prefs.dimSeen ? ' bc-seen' : '') + (inCompare ? ' bc-picked' : '')
        + (r.isAd ? ' bc-adrow' : ''),
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
      cur > 1 ? mk(cur - 1, '‹ Föregående sida') : null,
      el('div', { class: 'bc-pagenums' }, nums),
      cur < p.last ? mk(cur + 1, 'Nästa sida ›') : null,
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

    hideNativeFilterChips();
    mountFilterBar();
    root.appendChild(buildToolbar(rows));
    root.appendChild(
      el('table', { class: 'bc-table' }, [
        buildHead(),
        /* Sponsored rows first and unsorted, the way Blocket places them. They
           are excluded from `rows`, so column sorting never mixes them in. */
        el('tbody', {}, adRows().concat(rows).map(buildRow)),
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

  /* The order the old ad page used, which is also the order you actually ask
     questions in: what does it run on, how has it been driven, how old is it. */
  const SPEC_ORDER = [
    'Drivmedel', 'Växellåda', 'Miltal', 'Modellår',
    'Biltyp', 'Drivhjul', 'Effekt', 'Färg',
    'Antal ägare', 'Nästa besiktningsdatum',
  ];

  const collectSpecs = () => {
    const found = new Map();
    for (const dt of document.querySelectorAll('dt')) {
      const dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== 'DD') continue;
      /* Some labels have a tooltip paragraph glued on with no separator, e.g.
         "Bränsleförbrukning (NEDC)NEDC var den officiella…". Cut at the seam
         where a lowercase letter is immediately followed by an uppercase one. */
      const label = dt.textContent.trim().split(/(?<=[a-zåäö)])(?=[A-ZÅÄÖ])/)[0].trim();
      if (!found.has(label)) found.set(label, dd.textContent.trim());
    }
    const pairs = [];
    for (const want of SPEC_ORDER) {
      for (const [k, v] of found) {
        if (k.startsWith(want) && v) { pairs.push([want, v]); break; }
      }
    }
    return pairs;
  };

  /* Tag the gallery <section> so the stylesheet can cap its height.
     Identified structurally — the first section holding an image that sits
     above the title — rather than by measuring rendered height, because at
     document-ready the images have not loaded and every height is still 0. */
  const tagGallery = () => {
    if (document.querySelector('.bc-gallery')) return true;
    const h1 = document.querySelector('h1');
    const section = [...document.querySelectorAll('section')].find((s) => {
      if (!s.querySelector('img')) return false;
      if (!h1) return true;
      return s.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    if (!section) return false;
    section.classList.add('bc-gallery');
    return true;
  };

  /* Blocket already prints four facts between the title and the price
     (currently Modellår, Miltal, Växellåda, Drivmedel). Repeating them two
     centimetres lower would be noise, so read whatever is up there and show
     only what it leaves out. Detected rather than hardcoded, because which
     four they choose is exactly the kind of thing that changes. */
  const labelsAlreadyShown = () => {
    const h1 = document.querySelector('h1');
    const price = [...document.querySelectorAll('h2')].find((h) => /\d\s*kr\s*$/.test(h.textContent.trim()));
    if (!h1 || !price) return new Set();
    try {
      const range = document.createRange();
      range.setStartAfter(h1);
      range.setEndBefore(price);
      const text = range.toString();
      return new Set(SPEC_ORDER.filter((label) => text.includes(label)));
    } catch (_) {
      return new Set();
    }
  };

  const buildSpecBar = () => {
    if (document.getElementById('bc-specbar')) return true;
    const shown = labelsAlreadyShown();
    const pairs = collectSpecs().filter(([label]) => !shown.has(label));
    if (!pairs.length) return false;

    const bar = el('div', { id: 'bc-specbar', class: 'bc-specbar' },
      pairs.map(([k, v]) => el('div', { class: 'bc-specitem' }, [
        el('span', { class: 'bc-speck', text: k }),
        el('span', { class: 'bc-specv', text: v }),
      ]))
    );

    /* Sit directly under the price, the way the old page did — title, price,
       facts, then everything else. Fall back to the heading if the price
       heading cannot be identified. */
    const price = [...document.querySelectorAll('h2')].find((h) => /\d\s*kr\s*$/.test(h.textContent.trim()));
    const h1 = document.querySelector('h1');
    const anchor = (price && price.parentElement) || (h1 && h1.parentElement);
    if (!anchor) return false;
    anchor.insertAdjacentElement('afterend', bar);
    return true;
  };

  const ensureItemUi = () => {
    if (!document.querySelector('.bc-gallery')) tagGallery();
    if (!document.getElementById('bc-specbar')) buildSpecBar();
  };

  const renderItemPage = () => {
    if (!isItemPage()) return;
    document.documentElement.classList.add('bc-on', 'bc-item');
    document.documentElement.dataset.bcTheme = S().state.prefs.theme || 'light';

    ensureItemUi();
    if (renderItemPage._watching) return;
    renderItemPage._watching = true;

    /* Keep watching for the life of the page rather than stopping at first
       success. The podlets hydrate after first paint and replace the subtree
       the spec bar was inserted into, silently removing it — so the job is to
       keep it present, not to insert it once. Both checks bail out cheaply
       when the elements are already there, including for the mutations our
       own insertion causes. */
    let queued = false;
    const kick = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; ensureItemUi(); });
    };

    new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', ensureItemUi);
    const poll = setInterval(ensureItemUi, 500);
    setTimeout(() => clearInterval(poll), 20000);
  };

  /* ------------------------------------------------------------------ *
   * Boot                                                               *
   * ------------------------------------------------------------------ */

  const boot = () => {
    S().ready.then(() => {
      S().onChange(scheduleRender);
      if (harvestSsr()) scheduleRender();
      else scheduleRender(); // item pages have no docs and render on their own

      /* The payload script may still be streaming in at DOMContentLoaded, so
         keep looking briefly before giving up on the first paint. */
      if (!state.docs.length && isSearchPage()) {
        let tries = 0;
        const poll = setInterval(() => {
          if (harvestSsr() || ++tries > 20) {
            clearInterval(poll);
            scheduleRender();
          }
        }, 150);
      }

      // Blocket re-renders its own list on navigation; keep ours alive.
      const mo = new MutationObserver(() => {
        if (!isSearchPage()) return;
        if (!state.docs.length) harvestSsr();
        if (state.docs.length && !document.getElementById('bc-root')) scheduleRender();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
