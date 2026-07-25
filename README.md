# Blocket Bilar – Klassisk vy

A Chrome/Edge extension that replaces Blocket's car search results with a dense,
sortable table — the kind of list you could actually scan before the November 2025
redesign.

## Install (unpacked)

1. Unzip this folder somewhere permanent. Chrome loads it from disk on every
   start, so don't leave it in Downloads.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the unzipped folder.
5. Go to <https://www.blocket.se/mobility/search/car>.

No sign-in, no account, no server. Everything it stores stays in
`chrome.storage.local` on your machine.

## What it does

**Search results** are re-rendered as a table with sortable columns: car, year,
mileage, fuel, gearbox, price, location, seller and age. Three densities:

| Mode   | Row height | Cars visible on a 1440×900 laptop |
|--------|-----------:|----------------------------------:|
| Tät    | ~25 px     | ~14 |
| Normal | ~79 px     | ~5  |
| Bilder | ~127 px    | ~3  |

Blocket's current card layout shows about two.

**Sorting** — click any column header. This sorts the ~49 rows currently loaded,
instantly, with no round trip. Blank values always sink to the bottom rather than
sorting as zero.

**Seen / hidden** — clicking through to an ad marks it seen, and it stays dimmed
when you come back. The `✕` on a row hides that ad permanently. Both are reset
from the toolbar popup.

**Compare** — tick rows to collect them in a tray at the bottom; "Öppna alla"
opens them in tabs side by side.

**Saved searches** — "☆ Spara sökning" stores the current URL with a label you
choose. They're listed in the extension popup.

**Ad pages** get a spec strip (year, mileage, fuel, gearbox, power, drivetrain,
body, colour, owners, next inspection) inserted directly under the title, so the
facts are visible without scrolling past a half-screen hero image.

## Where the data comes from

The extension issues **no network requests of its own**. It reads the data the
page has already loaded, from two places:

1. The server-rendered payload — Blocket ships a dehydrated TanStack Query cache
   as base64 inside a `<script type="application/json">` tag.
2. The app's own `fetch`/`XHR` to `/mobility/search/api/search/…`, which
   `src/hook.js` tees by cloning the response. The page still receives an
   untouched body; nothing is modified in flight.

A side effect worth knowing: paid placements ("Betald placering") arrive from a
separate `pole-position` endpoint and are merged in by Blocket's own renderer.
Because this extension renders only the organic `docs` array, sponsored listings
don't appear in the table.

## Files

```
manifest.json      MV3 manifest; two content scripts, MAIN and ISOLATED worlds
src/hook.js        page world — observes the data Blocket loads, posts it across
src/store.js       chrome.storage wrapper: seen, hidden, compare, saved searches
src/format.js      Swedish number/date formatting, doc → row mapping
src/content.js     builds the table, the pager, the compare tray, the spec strip
src/classic.css    the whole visual design
src/popup.html/js  saved searches and the reset buttons
```

## Known limits

- **Column sorting is page-local.** It reorders the 49 loaded rows, not all
  143 000 cars. Sorting the full result set means changing Blocket's own sort
  control, which triggers their fetch. Wiring our headers to that is the obvious
  next step.
- **Filters are still Blocket's**, restyled tighter rather than rebuilt. They
  work; they're just not ours yet.
- **Tailwind class names will drift.** The layout-widening rules key off
  `.grid-cols-3` and `.col-span-2`, which are generated classes. The data hooks
  (`.sf-result-list`, `sf-search-ad`, the API path) look stable — they're
  semantic — but the layout overrides are the fragile part and will need a touch
  after a Blocket redesign.
- Firefox port is not done yet: `world: "MAIN"` content scripts need a different
  arrangement there.
