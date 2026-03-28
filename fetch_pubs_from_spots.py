#!/usr/bin/env python3
"""
Build a pub dataset by scanning Irish spots from places_ireland.csv and finding pubs nearby.

Outputs:
  - spot_pubs.csv
  - cupan-caife-web/src/data/pubs.json (merged + deduplicated)

This script avoids duplicates using name+coordinates and stable nfcTagId checks.
"""

from __future__ import annotations

import csv
import json
import math
import re
import time
from pathlib import Path
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parent
SPOTS_CSV = ROOT / "places_ireland.csv"
PUBS_JSON = ROOT / "cupan-caife-web" / "src" / "data" / "pubs.json"
OUT_CSV = ROOT / "spot_pubs.csv"

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

IRELAND_BBOX = (51.40, -10.60, 55.50, -5.40)  # south, west, north, east

HEADERS = {
    "User-Agent": "wheres-da-craic-spot-pub-fetcher/1.0",
}


def build_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    bbox_str = f"{s},{w},{n},{e}"
    return f"""
[out:json][timeout:120];
(
  node["amenity"="pub"]({bbox_str});
  way["amenity"="pub"]({bbox_str});
  relation["amenity"="pub"]({bbox_str});
  node["amenity"="bar"]({bbox_str});
  way["amenity"="bar"]({bbox_str});
);
out center tags;
"""


def fetch_overpass_elements() -> list[dict]:
    query = build_query(IRELAND_BBOX)
    for endpoint in OVERPASS_URLS:
        for attempt in range(1, 4):
            try:
                print(f"Querying Overpass ({endpoint}, attempt {attempt}) …", flush=True)
                resp = requests.post(endpoint, data={"data": query}, headers=HEADERS, timeout=180)
                resp.raise_for_status()
                data = resp.json()
                elements = data.get("elements", [])
                print(f"  -> {len(elements)} raw pub/bar elements")
                return elements
            except Exception as exc:
                print(f"  ! {exc}")
                time.sleep(1.5 * attempt)
    raise RuntimeError("All Overpass endpoints failed")


def load_spots() -> list[dict]:
    spots: list[dict] = []
    with open(SPOTS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                lat = float(row.get("lat") or "")
                lon = float(row.get("lon") or "")
            except ValueError:
                continue
            spots.append(
                {
                    "name": (row.get("name") or "").strip(),
                    "county": (row.get("county") or "").strip(),
                    "lat": lat,
                    "lon": lon,
                }
            )
    print(f"Loaded {len(spots)} spots from places_ireland.csv")
    return spots


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:60]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_address(tags: dict) -> str:
    parts = [
        tags.get("addr:housenumber", ""),
        tags.get("addr:street", ""),
        tags.get("addr:city", "") or tags.get("addr:town", "") or tags.get("addr:village", ""),
    ]
    return ", ".join(p for p in parts if p) or tags.get("addr:full", "")


def parse_elements(elements: list[dict]) -> list[dict]:
    pubs: list[dict] = []
    for el in elements:
        tags = el.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name:
            continue

        if el.get("type") == "node":
            lat = el.get("lat")
            lon = el.get("lon")
        else:
            center = el.get("center", {})
            lat = center.get("lat")
            lon = center.get("lon")

        if lat is None or lon is None:
            continue

        pubs.append(
            {
                "name": name,
                "latitude": round(float(lat), 6),
                "longitude": round(float(lon), 6),
                "address": build_address(tags),
                "hours": tags.get("opening_hours", "") or "Check local listings",
                "website": tags.get("website", "") or tags.get("contact:website", ""),
                "phone": tags.get("phone", "") or tags.get("contact:phone", ""),
            }
        )
    print(f"Parsed {len(pubs)} named pubs/bars")
    return pubs


def nearest_spot(pub: dict, spots: list[dict]) -> tuple[Optional[dict], float]:
    best_spot = None
    best_dist = float("inf")
    for spot in spots:
        dist = haversine_km(pub["latitude"], pub["longitude"], spot["lat"], spot["lon"])
        if dist < best_dist:
            best_dist = dist
            best_spot = spot
    return best_spot, best_dist


def dedupe_key(name: str, lat: float, lon: float) -> tuple[str, float, float]:
    return (name.strip().lower(), round(lat, 4), round(lon, 4))


def load_existing_pubs() -> list[dict]:
    if not PUBS_JSON.exists():
        return []
    with open(PUBS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def assign_ids_and_tagids(merged: list[dict]) -> list[dict]:
    used_tagids = set()
    max_id = 99

    for pub in merged:
        try:
            max_id = max(max_id, int(str(pub.get("id", "0"))))
        except ValueError:
            pass
        tag = (pub.get("nfcTagId") or "").strip()
        if tag:
            used_tagids.add(tag)

    for pub in merged:
        if not pub.get("id"):
            max_id += 1
            pub["id"] = str(max_id)

        tag = (pub.get("nfcTagId") or "").strip()
        if not tag:
            base = slugify(pub.get("name") or f"pub-{pub['id']}")
            tag = base
            n = 1
            while tag in used_tagids:
                n += 1
                tag = f"{base}-{n}"
            pub["nfcTagId"] = tag
            used_tagids.add(tag)

        pub.setdefault("type", "pub")
        pub.setdefault("hours", "Check local listings")
        pub.setdefault("description", f"Traditional Irish pub in {pub.get('address') or 'Ireland'}.")
        pub.setdefault("website", "")
        pub.setdefault("phone", "")
        pub.setdefault("signedUp", False)

    return merged


def main() -> None:
    spots = load_spots()
    elements = fetch_overpass_elements()
    parsed = parse_elements(elements)

    # Keep pubs near known Irish spots.
    near_spot: list[dict] = []
    for pub in parsed:
        spot, dist_km = nearest_spot(pub, spots)
        if spot is None:
            continue
        if dist_km <= 8.0:
            pub["nearestSpot"] = spot["name"]
            pub["nearestSpotCounty"] = spot["county"]
            near_spot.append(pub)

    print(f"Kept {len(near_spot)} pubs within 8km of known spots")

    existing = load_existing_pubs()
    merged: list[dict] = []
    seen = set()

    for pub in existing:
        key = dedupe_key(pub.get("name", ""), float(pub.get("latitude", 0)), float(pub.get("longitude", 0)))
        if key in seen:
            continue
        seen.add(key)
        merged.append(pub)

    for pub in near_spot:
        key = dedupe_key(pub["name"], pub["latitude"], pub["longitude"])
        if key in seen:
            continue
        seen.add(key)
        merged.append(
            {
                "id": "",
                "type": "pub",
                "name": pub["name"],
                "latitude": pub["latitude"],
                "longitude": pub["longitude"],
                "address": pub.get("address") or "Ireland",
                "hours": pub.get("hours") or "Check local listings",
                "nfcTagId": "",
                "description": f"Traditional Irish pub near {pub.get('nearestSpot') or 'a known Irish spot' }.",
                "website": pub.get("website") or "",
                "phone": pub.get("phone") or "",
                "signedUp": False,
            }
        )

    merged = assign_ids_and_tagids(merged)

    with open(PUBS_JSON, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"Saved merged pub dataset -> {PUBS_JSON} ({len(merged)} pubs)")

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        fieldnames = ["name", "address", "latitude", "longitude", "hours", "website", "phone", "nearestSpot", "nearestSpotCounty"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for pub in near_spot:
            writer.writerow({k: pub.get(k, "") for k in fieldnames})
    print(f"Saved spot-level CSV -> {OUT_CSV} ({len(near_spot)} rows)")


if __name__ == "__main__":
    main()
