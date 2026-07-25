/* popup.js — saved searches and the two "forget what I've seen" buttons. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const paint = (state) => {
    const list = $('searches');
    list.textContent = '';
    const saved = state.savedSearches || [];

    if (!saved.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Inga sparade sökningar än.';
      list.appendChild(li);
    }

    for (const s of saved) {
      const li = document.createElement('li');

      const a = document.createElement('a');
      a.href = s.url;
      a.textContent = s.label;
      a.title = s.url;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: s.url });
      });

      const del = document.createElement('button');
      del.textContent = '✕';
      del.title = 'Ta bort';
      del.addEventListener('click', () => {
        const next = (state.savedSearches || []).filter((x) => x.url !== s.url);
        chrome.storage.local.set({ savedSearches: next }, load);
      });

      li.append(a, del);
      list.appendChild(li);
    }

    $('seen-count').textContent = Object.keys(state.seen || {}).length + ' annonser markerade som sedda';
    $('hidden-count').textContent = Object.keys(state.hidden || {}).length + ' annonser dolda';
  };

  const load = () => chrome.storage.local.get(null, (s) => paint(s || {}));

  $('reset-seen').addEventListener('click', () => chrome.storage.local.set({ seen: {} }, load));
  $('reset-hidden').addEventListener('click', () => chrome.storage.local.set({ hidden: {} }, load));

  load();
})();
