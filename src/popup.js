/* popup.js — saved searches and the two "forget what I've seen" buttons.
 *
 * Goes through BCStore rather than writing chrome.storage directly. Writing
 * directly used to mean the popup's resets bypassed the store's own bookkeeping
 * and the 40-item cap, and any Blocket tab left open kept dimming rows that had
 * just been reset.
 */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const S = window.BCStore;

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
      del.addEventListener('click', () => S.removeSearch(s.url));

      li.append(a, del);
      list.appendChild(li);
    }

    $('seen-count').textContent = Object.keys(state.seen || {}).length + ' annonser markerade som sedda';
    $('hidden-count').textContent = Object.keys(state.hidden || {}).length + ' annonser dolda';
  };

  $('reset-seen').addEventListener('click', () => S.resetSeen());
  $('reset-hidden').addEventListener('click', () => S.resetHidden());

  /* Repaint on every change rather than after each write: the store notifies
     through chrome.storage.onChanged, so this also picks up edits made from a
     Blocket tab while the popup is open. */
  S.onChange(paint);
  S.ready.then(paint);
})();
