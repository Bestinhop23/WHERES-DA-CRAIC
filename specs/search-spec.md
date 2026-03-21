# Search Feature Spec

## Goal

A Google Maps-style search bar that lets users type a place name (or keyword) and jump to it on the map, opening its popup.

---

## UX Behaviour

- Search bar sits in the **top-left** of the map (below the header title bar).
- User types a place name (e.g. "Carrick", "Rosslare", "Cork").
- A **dropdown suggestion list** appears beneath the input as they type (typeahead, no submit needed).
- Suggestions show: **Place name** + county badge (e.g. `Carrick-on-Shannon — Leitrim`).
- Clicking a suggestion:
  1. Flies the map to that marker (`map.flyTo`, zoom level 13).
  2. Opens the marker's popup.
  3. Closes the dropdown.
- Pressing **Escape** clears and closes the dropdown.
- Pressing **Enter** selects the first suggestion.
- If no results match, show a "No results found" message in the dropdown.

---

## Search Fields

Search is performed client-side against the already-loaded GeoJSON. The query string is matched (case-insensitive, partial) against:

1. `name` — English place name (primary)
2. `name_ga` — Irish language name
3. `county` — e.g. "Galway", "Clare"
4. `folklore_myth` — keyword search (secondary, shown with lower priority)
5. `hidden_gem` — text content

Results ranked: exact prefix match on `name` first, then partial matches, then secondary field matches. Max **8 suggestions** shown.

---

## Implementation Plan

### 1. Backend — `/search` endpoint (server.py)

Add a new Flask route:

```
GET /search?q=carrick
```

Returns a JSON array of matches:

```json
[
  {
    "name": "Carrick-on-Shannon",
    "name_ga": "Cora Droma Rúisc",
    "county": "Leitrim",
    "type": "town",
    "lat": 53.9441,
    "lon": -8.0953
  },
  ...
]
```

The endpoint reuses the same CSV + checkpoint merge logic already in `/data`. It filters and ranks results server-side, returning max 10 matches. This keeps the client simple and avoids re-searching the full dataset on every keystroke.

**Why server-side?** The dataset could grow large. Server-side search also allows future upgrades (fuzzy matching, full-text index) without touching the frontend.

### 2. Frontend — Search bar UI (index.html)

**HTML** — add a search container div inside `<body>`, positioned absolutely over the map (top-left, below the header):

```html
<div id="search-container">
  <input id="search-input" type="text" placeholder="Search places...">
  <ul id="search-results"></ul>
</div>
```

**CSS** — styled to match the existing green/white palette:
- White rounded input, subtle shadow, green focus ring.
- Dropdown list below input, white bg, green hover highlight.
- `z-index: 1000` to float above tiles.
- Mobile-friendly width (min 240px, max 320px).

**JS** — search logic:
- `input` event listener with **200ms debounce** to avoid hammering the server on every keypress.
- `fetch('/search?q=...')` on each debounced input.
- Render suggestion list from response.
- On suggestion click: call `flyToPlace(lat, lon, name)` which uses the existing `geoJsonLayer` reference to find the matching layer and open its popup.
- Keyboard navigation: `ArrowUp` / `ArrowDown` to move through suggestions, `Enter` to select, `Escape` to close.

### 3. Layer Reference

Currently the GeoJSON layer is created but not stored in a variable. We need to save it:

```js
// Before:
L.geoJSON(data, { ... }).addTo(map);

// After:
geoJsonLayer = L.geoJSON(data, { ... }).addTo(map);
```

Then `flyToPlace` iterates `geoJsonLayer.getLayers()` to find the matching feature by name and call `layer.openPopup()`.

---

## Files Changed

| File | Change |
|------|--------|
| `server.py` | Add `GET /search?q=` route |
| `index.html` | Add search bar HTML + CSS + JS |

No new files needed.

---

## Out of Scope (for now)

- Fuzzy / typo-tolerant matching (e.g. "Corck" → "Cork")
- Searching by folklore/hidden gem content (keyword deep search)
- Search history / recent searches
- Mobile keyboard "Search" button behaviour
