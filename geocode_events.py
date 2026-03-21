#!/usr/bin/env python3
"""Geocode events in events_v1.json using Nominatim API."""

import json
import time
import urllib.request
import urllib.parse

EVENTS_FILE = "/Users/helios/WHERES-DA-CRAIC/events_v1.json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "WheresDaCraic/1.0 (geocoding events for wheres-da-craic app)"}


def nominatim_search(query: str) -> tuple[float, float] | None:
    """Query Nominatim and return (lat, lon) or None if no result."""
    params = urllib.parse.urlencode({"q": query, "format": "json", "limit": "1"})
    url = f"{NOMINATIM_URL}?{params}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  [error] {query!r}: {e}")
    return None


def geocode_event(event: dict) -> tuple[float | None, float | None]:
    """Try three strategies to geocode an event. Returns (lat, lon) or (None, None)."""
    address = event.get("address", "").strip()
    venue = event.get("venue", "").strip()
    county = event.get("county", "").strip()

    # Strategy 1: full address
    if address:
        print(f"  Trying address: {address!r}")
        result = nominatim_search(address)
        if result:
            return result
        time.sleep(1)

    # Strategy 2: venue + ", Ireland"
    if venue:
        query = f"{venue}, Ireland"
        print(f"  Trying venue: {query!r}")
        result = nominatim_search(query)
        if result:
            return result
        time.sleep(1)

    # Strategy 3: county + ", Ireland"
    if county:
        query = f"{county}, Ireland"
        print(f"  Trying county: {query!r}")
        result = nominatim_search(query)
        if result:
            return result
        time.sleep(1)

    return None, None


def main():
    with open(EVENTS_FILE, "r") as f:
        data = json.load(f)

    events = data["events"]
    total = len(events)
    geocoded = 0
    null_count = 0

    for i, event in enumerate(events):
        name = event.get("name", f"event {i}")
        print(f"\n[{i+1}/{total}] {name}")
        lat, lon = geocode_event(event)
        event["lat"] = lat
        event["lon"] = lon
        if lat is not None and lon is not None:
            geocoded += 1
            print(f"  -> lat={lat}, lon={lon}")
        else:
            null_count += 1
            print(f"  -> null (could not geocode)")
        # Rate limit: 1 second between requests (already sleeping inside geocode_event,
        # but add a gap after success too so we never exceed 1 req/sec)
        time.sleep(1)

    with open(EVENTS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Done. {geocoded}/{total} events geocoded successfully.")
    print(f"{null_count}/{total} events got null coordinates.")


if __name__ == "__main__":
    main()
