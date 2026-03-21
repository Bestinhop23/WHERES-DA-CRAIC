# Town Information Popup — UI/UX Redesign Spec

## What's Wrong Now

- Feels like a data dump. Every field gets equal visual weight — etymology sits next to GAA colours, nothing breathes.
- Scrolling a tiny 300×400 box inside a map popup is unpleasant. Users rarely scroll past the first two sections.
- The section headers (📜 Etymology, 👻 Folklore...) are all uppercase and visually repetitive. Nothing draws the eye to the interesting stuff.
- The popup is anchored to the map marker — on mobile or small screens it covers the very place you're looking at.
- No clear hierarchy. There's no "lead" — no single thing that hooks you into the place.
- The YouTube button was bolted on and feels out of place. **Removed from this design.**

---

## Design Direction

**Card-style side panel, not a map bubble.**

Instead of a Leaflet popup anchored to the marker, slide in a fixed panel from the right side of the screen. This:
- Doesn't obscure the map
- Gives enough space to breathe without scrolling
- Works well on mobile (bottom sheet)
- Feels native, like a Google Maps place card

The map marker gets a **highlight ring** when the panel is open so you still know what you're looking at.

---

## Layout

```
┌─────────────────────────────────┐
│  ← [close]                      │  ← thin top bar, green
│                                  │
│  KILLALOE                        │  ← large place name
│  Cill Dalua  ·  County Clare     │  ← Irish name + county, muted
│  ────────────────────────────── │
│                                  │
│  [LORE]  [HISTORY]  [GAA]  [GEM] │  ← tab row
│                                  │
│  ┌──────────────────────────┐   │
│  │  Tab content area        │   │
│  │  (no inner scroll bar,   │   │
│  │   panel itself scrolls)  │   │
│  └──────────────────────────┘   │
│                                  │
│  "Phrase of the place"           │  ← always-visible footer
│  ────────────────────────────── │
└─────────────────────────────────┘
```

**Desktop**: slides in from the right, ~360px wide, full viewport height
**Mobile**: slides up from the bottom as a sheet, ~65vh tall, swipe-down to dismiss

---

## Sections & Tabs

Four tabs. Each tab is a single focused chunk of content — no more than 4–5 lines. No scrolling needed within a tab.

### Tab 1 — LORE (default open)
The folklore/myth entry. This is the most evocative content in the dataset and should be the first thing people read. Lead with it. Display as a single atmospheric paragraph, slightly larger font, with a subtle quote-mark treatment.

### Tab 2 — ROOTS
Etymology block:
- Irish name large, prominent
- Meaning below it, as a short sentence
- A one-liner on word origin if available

This replaces the old combined Etymology section and makes the Irish language feel like a feature, not a footnote.

### Tab 3 — GAA
Club name, colours displayed as actual colour swatches (small circles) not text. Any notable legends listed below as a short sentence. Keep it punchy — GAA is tribal, the visual should match.

### Tab 4 — GEM
The hidden gem entry, displayed as a single highlighted callout block — slightly indented, italic, distinct background. Treat it like a secret being shared.

---

## Header

Always visible regardless of tab. Contains:
- **Place name** — large, bold, Irish green
- **Irish name · County** — small, muted grey, one line
- A subtle **type badge** (Town / Village / City) top-right corner

---

## Footer

Always visible at the bottom of the panel:

> *"Slán go fóill"* — Goodbye for now.

The local phrase, styled as a quote. Doesn't need its own tab — it's a nice send-off as you close the panel.

---

## Interactions

| Action | Behaviour |
|--------|-----------|
| Click marker | Panel slides in, marker gets highlight ring |
| Click close (×) or press Escape | Panel slides out, ring removed |
| Click outside panel on map | Panel closes |
| Switch tab | Content cross-fades (100ms), no full re-render |
| During tour | Panel opens automatically, close button replaced with "Next →" skip button |

---

## Visual Style

Staying consistent with the existing palette:

| Element | Value |
|---------|-------|
| Panel background | `#ffffff` |
| Header background | `#1a5e3c` (Irish green) |
| Place name | white, 1.6rem, bold |
| Irish name / county | `rgba(255,255,255,0.7)`, 0.85rem |
| Active tab indicator | `#e67e22` (amber) underline |
| Lore text | `#222`, 0.95rem, line-height 1.6 |
| Gem callout bg | `#f0f7f4` |
| Footer bg | `#fafafa`, border-top |
| Shadow | `box-shadow: -4px 0 20px rgba(0,0,0,0.12)` |

Fonts: inherit existing stack (Segoe UI, Tahoma, Verdana, sans-serif). No new font imports.

---

## Marker Highlight Ring

When a panel is open, the corresponding circle marker gets:
```
color: '#e67e22'
weight: 3
radius: +2 (e.g. town → 8, city → 10)
```
Reset to default on panel close.

---

## Files Changed

| File | Change |
|------|--------|
| `index.html` | Replace `createPopup()` + `.popup-content` CSS with panel HTML/CSS/JS |

No backend changes. All data is already in `feature.properties`.

---

## Out of Scope

- Favouriting / saving places
- Sharing a place card
- Image/photo support
- "Hear the Sound" YouTube link (removed)
- History & Landmarks tab (data is too inconsistent across entries to display reliably — defer until data is cleaned up)
