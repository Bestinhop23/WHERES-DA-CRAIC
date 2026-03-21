# Routing System Spec

---

## Part 1 — Current Implementation (Reference)

### What it does

1. User picks **From** and **To** using the route panel typeahead inputs (reuses `/search` endpoint).
2. A single OSRM API call is made:
   ```
   GET https://router.project-osrm.org/route/v1/driving/{fromLon},{fromLat};{toLon},{toLat}
       ?overview=full&geometries=geojson
   ```
3. OSRM returns the **fastest driving route** as a GeoJSON LineString.
4. A dashed green polyline is drawn on the map.
5. Every enriched marker in `geoJsonLayer` is checked against the route geometry using a point-to-segment distance function (`distPointToSegmentKm`). Threshold: **5km**.
6. Towns within 5km of any segment are collected, sorted by their closest segment index (travel order), highlighted orange, and listed in the panel.
7. A **Play Town Tour** button animates through each town: `map.flyTo(zoom=12)` → popup opens → 15s pause → next town.

### Why it's not good enough

The OSRM call has **no knowledge of the enriched towns**. It picks the fastest road between A and B — typically a motorway or national primary. The towns are then found *near* that road after the fact.

Problems this creates:
- **Near ≠ through.** A town 4.9km from the M6 shows up in the list, but the route never enters it. The user sees it highlighted, tours it, then is confused because the road didn't go anywhere near the town centre.
- **Motorways skip everything.** The fastest Dublin → Galway route runs the full M6 — it bypasses Kinnegad, Tyrellspass, Horseleap, Moate, Athlone town centre, Ballinasloe town centre. All of those have enriched entries. None get driven through.
- **5km is an arbitrary fudge.** Tightening it misses real towns. Loosening it adds false positives. There's no clean value that works well across all routes.
- **The route doesn't adapt to the data.** The whole point of the app is cultural discovery. The routing should be in service of that, not the other way around.

---

## Part 2 — New Approach: Town-First Routing

### Core idea

Flip the logic. Instead of *"find the fastest route then see what towns are nearby"*, do *"find all enriched towns between A and B, then build a route that drives through them"*.

OSRM supports any number of intermediate waypoints:
```
/route/v1/driving/{lon1},{lat1};{lon2},{lat2};{lon3},{lat3};...;{lonN},{latN}
```
The route will actually drive into and through each waypoint location. If we inject enriched towns as waypoints, the route is forced to visit them — not pass 4km away.

---

### Step-by-step algorithm

#### Step 1 — Candidate corridor

Draw an **ellipse** around the straight line from A to B. All enriched towns whose coordinates fall within this ellipse are candidates.

The ellipse is defined by:
- **Centre**: midpoint of A→B
- **Major axis** (along A→B): `distance(A,B) / 2 + PADDING_KM` (default padding 25km)
- **Minor axis** (perpendicular): `distance(A,B) * 0.3` clamped to min 30km, max 80km

This gives a sausage-shaped zone that widens for longer journeys and stays tight for short ones. Towns completely off to the side are excluded.

Implementation: for each candidate town T, check:
```
distance(A, T) + distance(T, B) <= distance(A, B) + PADDING_KM * 2
```
This is the ellipse definition (sum of distances to foci ≤ constant) and is much simpler to compute than a true ellipse projection.

#### Step 2 — Order towns (nearest-neighbour from A to B)

Given N candidate towns, we need a sensible traversal order that doesn't backtrack across the island.

Use a simple **greedy nearest-neighbour** from A, with B as the forced endpoint:

```
remaining = all candidate towns
current = A
ordered = []

while remaining is not empty:
    next = town in remaining that minimises distance(current, town)
             BUT only if distance(town, B) < distance(current, B)
             (must be making progress toward B)
    if no such town exists: break  ← avoid getting stuck going backwards
    ordered.push(next)
    remaining.remove(next)
    current = next
```

The "making progress toward B" constraint prevents the route from zigzagging back on itself to pick up a town that's behind the current position.

#### Step 3 — Cap the waypoint count

OSRM's public demo server has a soft limit. Cap at **12 intermediate waypoints** (so 14 total including A and B). If more candidates exist, prefer towns with more cultural data (non-empty `folklore_myth` + `hidden_gem` + `gaa_heritage`).

Town scoring (higher = preferred when culling):
- +2 if `folklore_myth` is non-empty
- +1 if `hidden_gem` is non-empty
- +1 if `gaa_heritage` exists
- +1 if type is `town` or `city` (not hamlet/suburb)

Pick the top-scoring 12 from the ordered list.

#### Step 4 — OSRM call with waypoints

Build the URL:
```
https://router.project-osrm.org/route/v1/driving/
  {A.lon},{A.lat};
  {t1.lon},{t1.lat};
  {t2.lon},{t2.lat};
  ...
  {B.lon},{B.lat}
  ?overview=full&geometries=geojson
```

OSRM will snap each waypoint to the nearest driveable road node, so even if a town's coordinates are slightly off a road it will route correctly.

#### Step 5 — Render

Same as current: draw polyline, highlight town markers orange, populate the panel list, enable the tour. The difference is that `routeTownMatches` is now the ordered waypoint list built in Step 2-3, not a post-hoc proximity scan. No `findIntersectingTowns` needed — the towns ARE the route.

---

### UI Changes

**Route panel summary** changes from:
```
148 km · ~2h 10min  ·  3 towns along the way
```
to:
```
148 km · ~2h 10min  ·  8 towns  ·  scenic route
```

Add a small **"scenic"** badge to make clear this isn't the fastest route. Users should know upfront.

Optionally: show a loading state while OSRM calculates (can take a second with many waypoints):
```
Building your route through 8 towns...
```

---

### Files Changed

| File | Change |
|------|--------|
| `index.html` | Replace `drawRoute()` — new corridor + ordering logic before OSRM call. Remove `findIntersectingTowns()` and `distPointToSegmentKm()` (no longer needed). Update summary text. |
| `server.py` | No changes. |

---

### Out of Scope

- Letting the user manually add/remove waypoints
- Alternative route options (fastest vs scenic toggle)
- Route export / sharing
- OSRM self-hosting (public demo server is fine for current scale)
