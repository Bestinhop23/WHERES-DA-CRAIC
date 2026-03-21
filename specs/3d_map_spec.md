# 3D Map Spec

---

## What does "3D" mean on a web map?

There are three distinct layers where 3D can live:

| Layer | What it means | Example |
|-------|---------------|---------|
| **Terrain** | The ground itself rises and falls — hills, mountains, valleys | You can see Croagh Patrick as a physical peak |
| **Buildings** | Structures are extruded upward from the ground plane | Dublin city centre has 3D block buildings |
| **Perspective** | The camera tilts so you look across the map at an angle rather than straight down | Like Google Maps in 3D mode |

All three require **perspective tilt** (pitch). Without pitch, terrain and buildings render flat even if the data is there.

---

## Where does 3D live in the stack?

Currently the map renders like this:

```
Browser
  └── Leaflet (2D canvas/SVG renderer)
        └── Stadia raster PNG tiles (pre-rendered images, no depth data)
              └── Our markers, polylines, polygons drawn on top
```

Raster tiles are flat images. **Leaflet has no concept of elevation, pitch, or 3D geometry.** You cannot add true 3D to the current stack without replacing the renderer.

A CSS `perspective` hack on the map container gives a skewed visual illusion but tiles stay flat — no terrain, no buildings, and the coordinate system breaks so markers don't align with roads.

---

## The three real options

### Option A — CSS Perspective Tilt (fake 3D)
Apply `transform: perspective(800px) rotateX(40deg)` to the map container.

**Pros:** Zero code changes to the map logic.
**Cons:** Tiles look stretched. Markers misalign. No terrain. No buildings. Looks bad. Not recommended.

---

### Option B — MapLibre GL JS (recommended)
Replace Leaflet with **MapLibre GL JS** — the open-source fork of Mapbox GL JS.

MapLibre is a WebGL renderer. It renders tiles as vector data, not images, which means the GPU can:
- Tilt the camera to any pitch (0° = top-down, 60° = steep angle)
- Rotate the map to any bearing
- Extrude building polygons upward using height data in the tiles
- Drape the map over a real elevation mesh (terrain)

**It is free, open source, no API key required.**

Stadia Maps — the tile provider we already use — provides the `alidade_smooth` style as **both raster AND vector**, and supports MapLibre natively. Switching to their vector endpoint gives us the 3D renderer for free.

For terrain elevation, Stadia also provides a `stadia-terrain-rgb` DEM tile source. This feeds the terrain mesh.

**Pros:** True 3D terrain. Building extrusion. Smooth pitch/bearing animation. Same `flyTo`/`fitBounds` API as Leaflet (near drop-in). Stadia already supports it.
**Cons:** Requires rewriting the marker/layer system (one-time effort). About 300 lines of map init code changes. All UI panels, search, routing logic, OSRM calls — unchanged.

---

### Option C — CesiumJS / deck.gl
Full globe 3D or advanced data visualisation layers.

**Pros:** Photorealistic terrain. Satellite imagery. Time-of-day lighting.
**Cons:** Massive library size. Completely different API. Overkill for this use case. Not recommended.

---

## Recommended: Option B — MapLibre GL JS

### What changes

| Area | Current (Leaflet) | New (MapLibre) |
|------|-------------------|----------------|
| Map init | `L.map('map')` | `new maplibregl.Map({ style, pitch, bearing })` |
| Tiles | Stadia raster PNG | Stadia vector style JSON |
| Terrain | None | `map.setTerrain({ source: 'stadia-dem', exaggeration: 1.5 })` |
| Markers | `L.geoJSON` + `pointToLayer` | `map.addSource` + `map.addLayer` (circle layer) |
| Marker click | `layer.on('click', ...)` | `map.on('click', 'towns-layer', ...)` |
| Highlight colour | `layer.setStyle({ fillColor })` | MapLibre filter expression on the layer |
| Route polyline | `L.polyline` | `map.addSource` + line layer |
| County border | `L.geoJSON` polygon | `map.addSource` + fill + outline layers |
| `flyTo` | `map.flyTo(latlng, zoom)` | `map.flyTo({ center, zoom, pitch, bearing })` — same shape |
| `fitBounds` | `map.fitBounds(bounds)` | `map.fitBounds(bounds)` — identical |
| Zoom controls | `L.control.zoom` | `maplibregl.NavigationControl` (includes compass + pitch reset) |

### What does NOT change

- All HTML panels (search, route, town panel, county panel) — untouched
- OSRM routing calls — untouched
- Nominatim county border fetch — untouched
- Tour animation logic — untouched
- `server.py` — untouched

---

## New UI elements

### Pitch toggle button
A button on the map (top-right, below zoom) that toggles between:
- **2D mode** — `pitch: 0`, `bearing: 0` (top-down, current look)
- **3D mode** — `pitch: 55`, `bearing: -10` (angled, terrain visible)

```
[ ⛰ 3D ]  ←→  [ ⊞ 2D ]
```

### NavigationControl (replaces Leaflet zoom buttons)
MapLibre's built-in control gives:
- `+` / `−` zoom
- Compass rose (rotates with bearing, click to reset north)
- Pitch reset

### Terrain exaggeration slider (optional)
Let the user adjust how dramatic the hills look. Default `1.5×`, range `1×`–`3×`.

---

## What 3D actually looks like for this app

- **Wicklow Mountains**, **MacGillycuddy's Reeks**, **Twelve Bens** — visible as real elevated terrain
- **Shannon River valley** — visibly lower than surrounding land
- **Dublin city centre** — building footprints extruded (height data in vector tiles)
- Flying to a town during the tour tilts the camera slightly so you see the landscape the town sits in
- Route polyline drapes over terrain rather than floating above flat tiles

---

## Terrain data

- **Source**: Stadia Maps `terrain-rgb` tiles (Mapzen elevation data, global coverage, free)
- **Format**: RGB-encoded elevation, decoded by MapLibre's terrain system
- **Exaggeration**: `1.5` — makes Irish terrain visible without being unrealistic (Ireland is not very mountainous, exaggeration helps)

---

## Files changed

| File | Change |
|------|--------|
| `index.html` | Replace Leaflet script/CSS with MapLibre GL JS. Rewrite map init, marker layer, highlight logic, polyline/polygon layers. Add pitch toggle button. All panels, search, routing JS — no changes. |
| `server.py` | No changes. |

---

## Out of scope

- Custom 3D models (e.g. 3D church icons for enriched towns)
- Animated sun/shadows (time of day lighting)
- Underground / subsurface layers
- First-person street-level view
- Offline tile caching
