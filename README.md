# Blocket Bilar – Klassisk vy

A Chrome/Edge extension that replaces Blocket's car search results with a dense,
sortable table — the kind of list you could actually scan before the November 2025
redesign.

That date is from the archive rather than from memory: `/mobility/search/car` has
no Wayback snapshot before 18 November 2025, and the URL it replaced was still
being captured on 5 November. The chrome here — the filter chip row, the list
dates — follows the design that ran until then. The dense table does not; no
Blocket ever had one. That part is the point of the extension.

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

**Filters** are the chip row that sat above the results until November 2025,
rather than the current sidebar: a search box, `Visa alla filter`, then eight
dropdown chips — Märke & modell, Drivmedel, Biltyp, Pris, Modellår, Miltal,
Växellåda, Säljare. Labels and order are taken from the archived DOM. Each
option shows its hit count (`Bensin 49 309`, `Företag 119 849`), so you can
read the shape of the market before clicking anything, and brand and location
drill down through their sub-levels.

`Visa alla filter` reveals Blocket's own sidebar rather than duplicating it, so
the fourteen filters the chip row doesn't surface — including the map ones —
stay reachable.

The row is built from the `filters` array the page already ships, so there's
nothing to scrape. Applying a filter rewrites the URL and lets Blocket's own
search run. `STANDARD_FILTER` goes over as `name=value` and repeats for
multiple values; `RANGE_FILTER` carries its own parameter names in the payload
(`price_from`, `price_to`). Worth knowing if you ever hand-edit a URL: the page
honours `?fuel=1` but silently ignores several others, so the parameters here
were checked against the search API rather than inferred.

**Search results** are re-rendered as a table with sortable columns: car, year,
mileage, fuel, gearbox, price, location, seller and date. Three densities:

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

**Paid placements** ("Betald placering") are shown, pinned above the organic
results and marked, with a switch in the toolbar for anyone who'd rather not see
them. They're deliberately on by default: sponsored listings are how Blocket
pays for the page, and silently dropping them is the thing that would turn a
reading aid into something they'd have cause to object to. They never take part
in sorting — a sponsored row that sorts like an ordinary one is a sponsored row
in disguise — and they're excluded from the result count, which reports
Blocket's own figure for the organic set.

**Dates** read the way the list used to: `Idag 14:32`, `Igår 23:48`, then
`12 jun 09:15` — a wall-clock time you can compare against the ad above it
instead of a `3 tim` that has to be decoded. The exact timestamp is on hover,
and the column still sorts on the underlying value.

**Ad pages** get a spec strip inserted under the price, so the facts are visible
without scrolling past a half-screen hero image. The gallery is capped, and
whichever facts Blocket already prints between the title and the price are left
out of the strip rather than repeated a few centimetres lower.

## Where the data comes from

The extension issues **no network requests of its own**. It reads the data the
page has already loaded, from two places:

1. The server-rendered payload — Blocket ships a dehydrated TanStack Query cache
   as base64 inside a `<script type="application/json">` tag.
2. The app's own `fetch`/`XHR` under `/mobility/search/api/…`, which
   `src/hook.js` tees by cloning the response. The page still receives an
   untouched body; nothing is modified in flight. Both the organic
   `search/<KEY>` endpoint and `pole-position/<KEY>` come through here; they're
   told apart by the shape of the response (`docs` versus `results`) rather
   than by path, so a rename doesn't break the tee.

## Files

```
manifest.json      MV3 manifest; two content scripts, MAIN and ISOLATED worlds
src/hook.js        page world — observes the data Blocket loads, posts it across
src/store.js       chrome.storage wrapper: seen, hidden, compare, saved searches
src/format.js      Swedish number/date formatting, doc → row mapping
src/content.js     builds the filter row, table, pager, compare tray, spec strip
src/classic.css    the whole visual design
src/popup.html/js  saved searches and the reset buttons
test/store.test.js storage-layer regression tests
```

Run the tests with plain node, no dependencies and no build step:

```bash
node test/store.test.js
```

## Known limits

- **Five columns sort the whole result, four sort only this page.** Bil, År,
  Mil, Pris and Inlagd hand the sort to Blocket via `?sort=`, so they reorder
  all 143 000 cars. Drivmedel, Låda, Ort and Säljare have no server equivalent
  and still reorder just the fifty rows in front of you; those headers carry a
  dotted underline to say so, and a tooltip that spells it out.
- **Tailwind class names will drift.** The layout rules key off `.grid-cols-3`
  and `.col-span-2`, which are generated classes, and the sidebar reveal depends
  on the first grid child being the filter column. The data hooks
  (`.sf-result-list`, the API path, the payload's own field names) look stable —
  they're semantic — but the layout overrides are the fragile part and will need
  a touch after a Blocket redesign.
- **Several hooks are found by text**, not by class: the sort/map toolbar via a
  "Visa på kartan" button, Blocket's active-filter row via "Rensa alla filter",
  and their result count by matching "N resultat". Deliberate — the surrounding
  classes are generated and worse — but it means a copy change moves them.
  Where a semantic element name exists it is preferred instead, as with
  `w-pagination` and `search-sorting-info-podlet-isolated`.
- **Ad impressions aren't counted.** A pole-position result can carry
  `viewUrls` for impression tracking, and firing those would mean the extension
  making requests of its own — the one property that keeps it clearly a reading
  aid rather than a client. So sponsored rows are displayed but not counted as
  seen. `clickUrls` are honoured, since following one is the user's own
  navigation. Both arrays have been empty in everything observed so far.
- Firefox port is not done yet: `world: "MAIN"` content scripts need a different
  arrangement there.
