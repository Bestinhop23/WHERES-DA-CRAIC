#!/usr/bin/env python3
"""
Fetch Irish pubs from OpenStreetMap via the Overpass API and output:
  - galway_pubs.csv   (name, address, lat, lon, opening_hours, website)
  - cupan-caife-web/src/data/pubs.json  (app-ready format matching shops.json)

Usage:
  python fetch_pubs.py                  # Galway pubs (default)
  python fetch_pubs.py --city dublin
  python fetch_pubs.py --city cork
  python fetch_pubs.py --area ireland   # all Ireland (slow, ~3 000 results)
"""

import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Overpass API endpoint (public, no key required)
# ---------------------------------------------------------------------------
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding boxes [south, west, north, east]
AREAS = {
    "galway":  (53.25, -9.10, 53.32, -8.93),
    "dublin":  (53.29, -6.42, 53.42, -6.09),
    "cork":    (51.87, -8.57, 51.93, -8.42),
    "limerick": (52.64, -8.68, 52.68, -8.59),
    "ireland": (51.40, -10.60, 55.50, -5.40),
}

HEADERS = {
    "User-Agent": "cupan-caife-pub-fetcher/1.0 (https://github.com/wheres-da-craic)"
}


def build_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    bbox_str = f"{s},{w},{n},{e}"
    return f"""
[out:json][timeout:60];
(
  node["amenity"="pub"]({bbox_str});
  way["amenity"="pub"]({bbox_str});
  relation["amenity"="pub"]({bbox_str});
  node["amenity"="bar"]({bbox_str});
  way["amenity"="bar"]({bbox_str});
);
out center tags;
"""


def fetch_pubs(bbox: tuple[float, float, float, float]) -> list[dict]:
    query = build_query(bbox)
    print("Querying Overpass API …", flush=True)
    resp = requests.post(OVERPASS_URL, data={"data": query}, headers=HEADERS, timeout=90)
    resp.raise_for_status()
    elements = resp.json().get("elements", [])
    print(f"  → {len(elements)} raw elements returned")
    return elements


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:50]


def build_address(tags: dict) -> str:
    parts = [
        tags.get("addr:housenumber", ""),
        tags.get("addr:street", ""),
        tags.get("addr:city", "") or tags.get("addr:town", "") or tags.get("addr:village", ""),
    ]
    return ", ".join(p for p in parts if p) or tags.get("addr:full", "")


def parse_elements(elements: list[dict]) -> list[dict]:
    pubs = []
    seen_ids = set()

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        if not name:
            continue  # skip unnamed venues

        # Coordinates: nodes have lat/lon directly; ways/relations use centre
        if el["type"] == "node":
            lat = el.get("lat")
            lon = el.get("lon")
        else:
            centre = el.get("center", {})
            lat = centre.get("lat")
            lon = centre.get("lon")

        if lat is None or lon is None:
            continue

        uid = slugify(name)
        suffix = 0
        base_uid = uid
        while uid in seen_ids:
            suffix += 1
            uid = f"{base_uid}-{suffix}"
        seen_ids.add(uid)

        pubs.append({
            "name": name,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "address": build_address(tags),
            "hours": tags.get("opening_hours", ""),
            "website": tags.get("website", "") or tags.get("contact:website", ""),
            "phone": tags.get("phone", "") or tags.get("contact:phone", ""),
            "nfcTagId": uid,
            "amenity": tags.get("amenity", "pub"),
        })

    return pubs


def to_app_json(pubs: list[dict], start_id: int = 100) -> list[dict]:
    """Convert to the same schema as shops.json for the React app."""
    result = []
    for i, pub in enumerate(pubs):
        result.append({
            "id": str(start_id + i),
            "type": "pub",
            "name": pub["name"],
            "latitude": pub["latitude"],
            "longitude": pub["longitude"],
            "address": pub["address"] or "Galway, Ireland",
            "hours": pub["hours"] or "Check local listings",
            "nfcTagId": pub["nfcTagId"],
            "description": f"Traditional Irish pub in {pub['address'] or 'Galway'}.",
            "website": pub["website"],
            "phone": pub["phone"],
        })
    return result


def save_csv(pubs: list[dict], path: str) -> None:
    fieldnames = ["name", "address", "latitude", "longitude", "hours", "website", "phone"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(pubs)
    print(f"CSV saved → {path}")


def save_json(data: list[dict], path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"JSON saved → {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Irish pubs from OpenStreetMap")
    parser.add_argument(
        "--city",
        default="galway",
        choices=list(AREAS.keys()),
        help="City / region to query (default: galway)",
    )
    args = parser.parse_args()

    city = args.city
    bbox = AREAS[city]

    elements = fetch_pubs(bbox)
    time.sleep(1)  # be polite to the public Overpass instance

    pubs = parse_elements(elements)
    print(f"  → {len(pubs)} named pubs extracted")

    if not pubs:
        print("No pubs found — check the bounding box or try --city ireland", file=sys.stderr)
        sys.exit(1)

    # -----------------------------------------------------------------------
    # Outputs
    # -----------------------------------------------------------------------
    csv_path = f"{city}_pubs.csv"
    save_csv(pubs, csv_path)

    app_data = to_app_json(pubs)
    app_json_path = "cupan-caife-web/src/data/pubs.json"
    save_json(app_data, app_json_path)

    print(f"\nDone — {len(pubs)} pubs written to {csv_path} and {app_json_path}")


if __name__ == "__main__":
    main()
