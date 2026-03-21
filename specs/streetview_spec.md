# Google Street View Integration Spec

---

## What It Does

When a town is selected (marker click, search result, or tour stop), show a live Street View panorama of that town's centre inside the town panel. The user literally sees the street they'd be standing on in that town.

---

## How It Works

Google's Street View Embed API accepts coordinates and returns the nearest available 360° street-level panorama:

```
https://www.google.com/maps/embed/v1/streetview
  ?key=YOUR_API_KEY
  &location={lat},{lon}
  &heading=0
  &pitch=0
  &fov=90
```

Google finds the closest panorama to the given coordinates. If no imagery exists within ~50m, the embed shows an error state (grey screen + "No imagery here" message) — we handle this gracefully.

---

## API Key

- Requires a **Google Maps JavaScript API / Embed API key**
- Free tier: **$200/month credit** (~28,000 Street View embed loads per month — more than enough)
- Key is restricted to the `maps.googleapis.com` Embed API endpoint
- Key stored as a `const GOOGLE_MAPS_KEY = 'YOUR_KEY_HERE'` at the top of `index.html` — user replaces the placeholder

---

## Where It Lives in the Panel

Street View sits **above the Lore section** — it's the first thing you see after the header. It acts as a visual "you are here" before you read the cultural content.

```
┌─────────────────────────────────┐
│  KILLALOE                        │  ← header (name, Irish, county)
│  Cill Dalua · County Clare       │
│ ─────────────────────────────── │
│                                  │
│  ┌──────────────────────────┐   │  ← Street View iframe (160px tall)
│  │  [Street View panorama]  │   │
│  └──────────────────────────┘   │
│                                  │
│  LORE                            │  ← existing sections below
│  ...                             │
│  ROOTS                           │
│  ...                             │
│  GAA                             │
│  ...                             │
│  HIDDEN GEM                      │
│  ...                             │
└─────────────────────────────────┘
```

---

## Fallback — No Street View Imagery

Rural Irish towns sometimes have no Street View coverage. Two fallback layers:

1. **Metadata check first** (optional, cleaner): Call the Street View Static API's metadata endpoint before embedding — it returns `status: "OK"` or `status: "ZERO_RESULTS"` without counting against quota. If `ZERO_RESULTS`, skip the iframe and show the fallback.

2. **Simple approach** (no extra API call): Always embed the iframe. If no imagery exists, Google shows a plain grey box. Overlay a fallback div that hides if the iframe loads successfully. If the iframe errors (no key, quota exceeded, no coverage) the fallback div stays visible.

**Fallback display:**
```
┌──────────────────────────────┐
│                              │
│   📍 Killaloe, Co. Clare     │
│   No street imagery          │
│                              │
└──────────────────────────────┘
```
Styled the same dimensions as the iframe (160px tall), muted background `#f0f0f0`, centred text.

---

## Implementation

### HTML (add to `#town-panel`)

```html
<!-- Street View block, inserted after .tp-header, before .tp-body -->
<div id="tp-streetview-wrap">
  <div id="tp-streetview-fallback">
    <span id="tp-streetview-fallback-name"></span>
    <span class="tp-sv-no-imagery">No street imagery available</span>
  </div>
  <iframe id="tp-streetview-iframe"
    frameborder="0"
    allowfullscreen
    referrerpolicy="no-referrer-when-downgrade"
    style="display:none">
  </iframe>
</div>
```

### CSS

```css
#tp-streetview-wrap {
    width: 100%;
    height: 160px;
    background: #e8e8e8;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
}
#tp-streetview-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
}
#tp-streetview-fallback {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: #999; font-size: 0.82rem; text-align: center;
    gap: 4px;
}
#tp-streetview-fallback-name {
    color: #555; font-weight: 600; font-size: 0.9rem;
}
.tp-sv-no-imagery { color: #aaa; }
```

### JS (in `openPanel`)

```js
const GOOGLE_MAPS_KEY = 'YOUR_KEY_HERE';

function updateStreetView(lat, lon, townName) {
    const wrap = document.getElementById('tp-streetview-wrap');
    const iframe = document.getElementById('tp-streetview-iframe');
    const fallback = document.getElementById('tp-streetview-fallback');
    const fallbackName = document.getElementById('tp-streetview-fallback-name');

    if (!GOOGLE_MAPS_KEY || GOOGLE_MAPS_KEY === 'YOUR_KEY_HERE') {
        // No key — hide the whole block
        wrap.style.display = 'none';
        return;
    }

    wrap.style.display = 'block';
    fallbackName.textContent = townName;

    // Check metadata first (no quota impact)
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata`
        + `?location=${lat},${lon}&key=${GOOGLE_MAPS_KEY}`;

    fetch(metaUrl)
        .then(r => r.json())
        .then(data => {
            if (data.status === 'OK') {
                const embedUrl = `https://www.google.com/maps/embed/v1/streetview`
                    + `?key=${GOOGLE_MAPS_KEY}&location=${lat},${lon}&fov=90`;
                iframe.src = embedUrl;
                iframe.style.display = 'block';
                fallback.style.display = 'none';
            } else {
                iframe.src = '';
                iframe.style.display = 'none';
                fallback.style.display = 'flex';
            }
        })
        .catch(() => {
            iframe.src = '';
            iframe.style.display = 'none';
            fallback.style.display = 'flex';
        });
}
```

Called inside `openPanel(layer)`:
```js
const coords = layer.getLatLng();
updateStreetView(coords.lat, coords.lng, props.name);
```

And on panel close, clear the iframe src to stop the video/audio:
```js
document.getElementById('tp-streetview-iframe').src = '';
```

---

## API Key Setup (for user)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → enable **Maps Embed API** and **Street View Static API**
3. Create an API key → restrict it to those two APIs
4. Replace `'YOUR_KEY_HERE'` in `index.html`

Cost: well within the $200/month free credit for personal/demo use.

---

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Add `#tp-streetview-wrap` HTML block after `.tp-header`. Add CSS. Add `updateStreetView()` function + call in `openPanel()`. Clear iframe src in `closePanel()`. |
| `server.py` | No changes. |

---

## Out of Scope

- Street View in the route tour (tour focuses on the map flyTo, not the panel embed)
- Letting the user spin/navigate the Street View panorama full-screen
- Caching panorama availability results
- Falling back to a static Google Maps satellite image when Street View is unavailable
