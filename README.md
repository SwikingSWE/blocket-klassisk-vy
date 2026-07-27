# Blocket Bilar – Klassisk vy

Reverts the visual changes Blocket made in 2025 — but only for cars. The rest
of the site is left alone.

A Chrome/Edge extension: no account, no server, no tracking.

## Install

**From a release** — download `dist.zip` from
[Releases](../../releases), unzip it somewhere permanent (Chrome reloads it
from disk at every start, so not Downloads), then:

1. Open `chrome://extensions`
2. Turn on **Developer mode**, top right
3. **Load unpacked**, and pick the unzipped folder
4. Go to [blocket.se/mobility/search/car](https://www.blocket.se/mobility/search/car)

**From source** — clone the repo and load the folder directly. There's no build
step; what's in `src/` is what runs.

## What it does

**A table instead of cards.** Ten columns — car, year, mileage, fuel, gearbox,
price, location, seller, listed — in three densities:

| Mode   | Height per car |
|--------|---------------:|
| Tät    | 25 px |
| Normal | 79 px |
| Bilder | 127 px |

Blocket's card layout is about 198 px per car.

**Sorting.** *Bil*, *År*, *Mil*, *Pris* and *Inlagd* reorder the whole result
set through Blocket's own sort. *Drivmedel*, *Låda*, *Ort* and *Säljare* have no
equivalent on their side and sort only the current page; the headers mark which
is which.

**Filters above the list, not beside it.** A search box, then chips for brand,
fuel, body, price, year, mileage, gearbox and seller, each option showing its
hit count. Brand expands into models once a make is picked. *Visa alla filter*
reveals Blocket's own panel for the fourteen filters the chips don't cover.

**Seen and hidden.** Ads clicked through to are dimmed on return. `✕` hides one
for good. Both reset from the toolbar popup.

**Compare.** Ticked rows collect in a tray; *Öppna alla* opens them side by side.

**Saved searches.** *☆ Spara sökning* keeps the current filters under a name.

**Dates** as `Idag 14:32`, `Igår 23:48`, then `12 jun 09:15`. Exact timestamp on
hover; the column sorts on the underlying value.

**Ad pages** get a spec strip under the price, and the gallery is capped.

**Sponsored listings are shown**, pinned at the top and labelled, with a switch
to hide them. On by default — see below.

## Privacy

The extension makes **no network requests of its own**. It reads what Blocket
has already sent to your browser and redraws it.

No account, no server, no analytics, no cookies, no third-party scripts. What
you mark as seen or hidden, your compare list and your saved searches stay in
`chrome.storage.local` on your machine and are sent nowhere.

It asks for two permissions: `storage`, and access to `blocket.se`. It does
nothing on any other site. Full text in [PRIVACY.md](PRIVACY.md).

**On sponsored listings.** Shown by default, and switchable off. Paid placements
are how Blocket pays for the page, so the default leaves them in — marked, never
mixed into the sort, never counted in the result total.

## How it works

Blocket's page already contains everything the table needs. The extension reads
it from two places and never asks for more:

1. **The server-rendered payload** — a dehydrated TanStack Query cache, base64
   inside a `<script type="application/json">` tag.
2. **The app's own `fetch`/`XHR`** under `/mobility/search/api/…`, which
   `src/hook.js` tees by cloning the response. The page still gets an untouched
   body; nothing is altered in flight. Organic results and paid placements both
   arrive this way and are told apart by response shape (`docs` vs `results`)
   rather than by path, so a renamed endpoint doesn't break it.

Filters and sorting work by rewriting the URL and letting Blocket's own search
run. The parameter names were verified against their API rather than guessed —
the page honours `?fuel=1` but silently ignores several plausible-looking
others, so `STANDARD_FILTER` goes over as `name=value` (repeated for multiple
values) and `RANGE_FILTER` uses the `_from`/`_to` names carried in the payload.

### Why "klassisk"

The redesign is dated from the archive, not from memory: `/mobility/search/car`
has no Wayback snapshot before **18 November 2025**, and the URL it replaced was
still being captured on 5 November. The chrome here — the filter chip row, the
list dates — follows the design that ran until then. The dense table doesn't; no
Blocket ever had one. That part is the point.

## Known limits

- **Blocket's markup will drift.** Layout rules key off `.grid-cols-3` and
  `.col-span-2`, which are generated class names, and a few hooks are found by
  matching Swedish button text. The data hooks are semantic and have held; the
  layout overrides are the fragile part and will want a touch after any
  redesign.
- **Ad impressions aren't counted.** A paid placement can carry `viewUrls`, and
  firing those would mean the extension making requests of its own — the one
  property worth protecting. So sponsored rows are shown but not counted as
  seen. `clickUrls` are followed, since that's the user's own navigation.
- **`Mil/år` is computed but has no way to turn it on.** The column exists and
  is off by default, and nothing in the UI toggles columns yet.
- **Firefox isn't supported yet.** `world: "MAIN"` content scripts need a
  different arrangement there.

## Development

```
manifest.json        MV3 manifest; two content scripts, MAIN and ISOLATED worlds
src/hook.js          page world — observes the data Blocket loads, posts it across
src/store.js         chrome.storage wrapper: seen, hidden, compare, saved searches
src/format.js        Swedish number/date formatting, doc → row mapping
src/content.js       filter row, table, pager, compare tray, spec strip
src/classic.css      the whole visual design
src/popup.html/js    saved searches and the reset buttons
test/store.test.js   storage-layer regression tests
icons/icon-source.png  master artwork; the three sizes are downscaled from it
```

Tests are plain node — no dependencies, no build step:

```bash
node test/store.test.js
```

Packaging for the store, and the listing copy, are in [STORE.md](STORE.md).

## Not affiliated

An independent extension, with no connection to Blocket or Schibsted.
