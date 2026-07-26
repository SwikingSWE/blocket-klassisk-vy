/* Exercise src/store.js against a mock chrome.storage.local.
 * Focus: the merge bug (deletions were lost from the in-memory mirror), the
 * double-notify, and write-failure reporting.
 */
const fs = require('fs');
const vm = require('vm');

const SRC = process.env.STORE_SRC || require('path').join(__dirname, '..', 'src', 'store.js');

function makeChrome({ failWrites = false } = {}) {
  const disk = {};
  const listeners = [];
  return {
    disk,
    lastError: null,
    api: {
      runtime: { get lastError() { return this._e; }, _e: null },
      storage: {
        local: {
          get(_, cb) { cb(JSON.parse(JSON.stringify(disk))); },
          set(patch, cb) {
            const changes = {};
            if (failWrites) {
              this._owner.api.runtime._e = { message: 'QUOTA_BYTES quota exceeded' };
              if (cb) cb();
              this._owner.api.runtime._e = null;
              return;
            }
            for (const k of Object.keys(patch)) {
              changes[k] = { oldValue: disk[k], newValue: patch[k] };
              disk[k] = JSON.parse(JSON.stringify(patch[k]));
            }
            if (cb) cb();
            // onChanged is delivered asynchronously by Chrome
            setTimeout(() => listeners.forEach(fn => fn(changes, 'local')), 0);
          },
        },
        onChanged: { addListener(fn) { listeners.push(fn); } },
      },
    },
  };
}

function load(mock) {
  const win = {};
  const ctx = {
    chrome: mock.api, window: win, console,
    setTimeout, clearTimeout, Date, JSON, Object, Array, Promise, URL,
  };
  mock.api.storage.local._owner = mock;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx);
  return win.BCStore;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
};

(async () => {
  console.log('\n— the bug: un-hiding must clear the in-memory mirror —');
  {
    const m = makeChrome();
    const S = load(m);
    await S.ready;
    S.toggleHidden('123');
    await wait(5);
    check('hidden after first toggle', S.isHidden('123') === true);
    check('written to disk', m.disk.hidden && m.disk.hidden['123'] === true);
    S.toggleHidden('123');           // un-hide
    check('mirror cleared immediately', S.isHidden('123') === false,
      'isHidden still ' + S.isHidden('123'));
    await wait(5);
    check('still cleared after onChanged echo', S.isHidden('123') === false,
      'onChanged re-applied the stale value');
    check('disk cleared too', !m.disk.hidden['123']);
  }

  console.log('\n— resetSeen / resetHidden clear the mirror —');
  {
    const m = makeChrome();
    const S = load(m);
    await S.ready;
    S.markSeen(['a', 'b']); await wait(5);
    check('two seen', S.isSeen('a') && S.isSeen('b'));
    S.resetSeen(); await wait(5);
    check('resetSeen clears mirror', !S.isSeen('a') && !S.isSeen('b'));
    S.toggleHidden('z'); await wait(5);
    S.resetHidden(); await wait(5);
    check('resetHidden clears mirror', !S.isHidden('z'));
  }

  console.log('\n— exactly one notification per write —');
  {
    const m = makeChrome();
    const S = load(m);
    await S.ready;
    let n = 0;
    S.onChange(() => n++);
    S.toggleHidden('q');
    await wait(10);
    check('one notify, not two', n === 1, 'got ' + n);
  }

  console.log('\n— prefs still deep-merge —');
  {
    const m = makeChrome();
    const S = load(m);
    await S.ready;
    S.setPref('density', 'compact'); await wait(5);
    S.setPref('columns.milPerYear', true); await wait(5);
    check('density kept', S.state.prefs.density === 'compact');
    check('sibling prefs survive', S.state.prefs.theme === 'light');
    check('nested column set', S.state.prefs.columns.milPerYear === true);
    check('sibling column survives', S.state.prefs.columns.year === true);
  }

  console.log('\n— saved searches key stably —');
  {
    const m = makeChrome();
    const S = load(m);
    await S.ready;
    const base = 'https://www.blocket.se/mobility/search/car?fuel=1&transmission=2';
    S.saveSearch('Bensin aut', base); await wait(5);
    S.saveSearch('Bensin aut', base + '&page=3'); await wait(5);
    check('page= does not create a second entry', S.state.savedSearches.length === 1,
      'got ' + S.state.savedSearches.length);
    S.saveSearch('Reordered', 'https://www.blocket.se/mobility/search/car?transmission=2&fuel=1');
    await wait(5);
    check('param order does not either', S.state.savedSearches.length === 1,
      'got ' + S.state.savedSearches.length);
    S.removeSearch(base + '&page=9'); await wait(5);
    check('removeSearch matches on the stable key', S.state.savedSearches.length === 0,
      'got ' + S.state.savedSearches.length);
  }

  console.log('\n— a failed write is reported, not swallowed —');
  {
    const m = makeChrome({ failWrites: true });
    const warns = [];
    const orig = console.warn;
    console.warn = (...a) => warns.push(a.join(' '));
    const S = load(m);
    await S.ready;
    S.toggleHidden('x');
    await wait(5);
    console.warn = orig;
    check('quota failure warned', warns.some(w => /kunde inte spara/.test(w)),
      JSON.stringify(warns));
  }

  console.log('\n%d passed, %d failed\n', pass, fail);
  process.exit(fail ? 1 : 0);
})();
