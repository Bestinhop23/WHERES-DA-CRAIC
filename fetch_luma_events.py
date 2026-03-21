#!/usr/bin/env python3
"""
Fetch events from Luma (lu.ma) for Ireland and save to events_v1.json
"""

import requests
import json
import time
from datetime import datetime, timezone

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://lu.ma/",
    "Origin": "https://lu.ma",
}

IRISH_COUNTIES = [
    "Dublin", "Cork", "Galway", "Limerick", "Waterford", "Kerry",
    "Tipperary", "Clare", "Mayo", "Donegal", "Sligo", "Leitrim",
    "Roscommon", "Longford", "Westmeath", "Offaly", "Laois", "Kildare",
    "Wicklow", "Wexford", "Carlow", "Kilkenny", "Meath", "Louth",
    "Monaghan", "Cavan", "Fermanagh", "Antrim", "Armagh", "Down",
    "Tyrone", "Derry",
]

# City/town → County mapping for common Irish cities
CITY_TO_COUNTY = {
    # Dublin
    "dublin": "Dublin",
    "dún laoghaire": "Dublin",
    "dun laoghaire": "Dublin",
    "swords": "Dublin",
    "tallaght": "Dublin",
    "blanchardstown": "Dublin",
    "dundrum": "Dublin",
    "stillorgan": "Dublin",
    "bray": "Wicklow",  # technically Wicklow
    "blackrock": "Dublin",
    "clontarf": "Dublin",
    "rathmines": "Dublin",
    "ranelagh": "Dublin",
    "ballsbridge": "Dublin",
    "sandyford": "Dublin",
    "leopardstown": "Dublin",
    "malahide": "Dublin",
    "howth": "Dublin",
    "lucan": "Dublin",
    # Cork
    "cork": "Cork",
    "cobh": "Cork",
    "mallow": "Cork",
    "midleton": "Cork",
    "bandon": "Cork",
    "skibbereen": "Cork",
    "kinsale": "Cork",
    "fermoy": "Cork",
    # Galway
    "galway": "Galway",
    "tuam": "Galway",
    "ballinasloe": "Galway",
    "oranmore": "Galway",
    "athenry": "Galway",
    # Limerick
    "limerick": "Limerick",
    "ennis road": "Limerick",
    "castletroy": "Limerick",
    # Waterford
    "waterford": "Waterford",
    "dungarvan": "Waterford",
    # Kerry
    "tralee": "Kerry",
    "killarney": "Kerry",
    "listowel": "Kerry",
    "kenmare": "Kerry",
    "dingle": "Kerry",
    # Tipperary
    "tipperary": "Tipperary",
    "clonmel": "Tipperary",
    "thurles": "Tipperary",
    "nenagh": "Tipperary",
    "cashel": "Tipperary",
    # Clare
    "ennis": "Clare",
    "shannon": "Clare",
    "kilrush": "Clare",
    # Mayo
    "castlebar": "Mayo",
    "ballina": "Mayo",
    "westport": "Mayo",
    # Donegal
    "donegal": "Donegal",
    "letterkenny": "Donegal",
    "bundoran": "Donegal",
    # Kildare
    "naas": "Kildare",
    "newbridge": "Kildare",
    "maynooth": "Kildare",
    "celbridge": "Kildare",
    "leixlip": "Kildare",
    "athy": "Kildare",
    "kildare": "Kildare",
    # Meath
    "navan": "Meath",
    "drogheda": "Louth",  # technically Louth
    "trim": "Meath",
    "dunboyne": "Meath",
    # Louth
    "dundalk": "Louth",
    # Wicklow
    "wicklow": "Wicklow",
    "arklow": "Wicklow",
    "greystones": "Wicklow",
    "blessington": "Wicklow",
    # Wexford
    "wexford": "Wexford",
    "enniscorthy": "Wexford",
    "gorey": "Wexford",
    # Kilkenny
    "kilkenny": "Kilkenny",
    # Sligo
    "sligo": "Sligo",
    # Cavan
    "cavan": "Cavan",
    # Monaghan
    "monaghan": "Monaghan",
    # Longford
    "longford": "Longford",
    # Westmeath
    "mullingar": "Westmeath",
    "athlone": "Westmeath",
    # Offaly
    "tullamore": "Offaly",
    "birr": "Offaly",
    # Roscommon
    "roscommon": "Roscommon",
    # Laois
    "portlaoise": "Laois",
    "portarlington": "Laois",
    # Carlow
    "carlow": "Carlow",
    # Leitrim
    "carrick-on-shannon": "Leitrim",
    "carrick on shannon": "Leitrim",
    # Northern Ireland
    "belfast": "Antrim",
    "lisburn": "Antrim",
    "derry": "Derry",
    "londonderry": "Derry",
    "armagh": "Armagh",
    "newry": "Down",
    "bangor": "Down",
    "omagh": "Tyrone",
    "enniskillen": "Fermanagh",
}


def derive_county(geo_info, address_str=""):
    """Derive Irish county from geo address info."""
    if not geo_info and not address_str:
        return None

    # Build search text
    search_parts = []
    if geo_info:
        for field in ["city_state", "full_address", "city", "region", "country_code"]:
            val = geo_info.get(field, "")
            if val:
                search_parts.append(str(val))
    if address_str:
        search_parts.append(address_str)

    search_text = " | ".join(search_parts).lower()

    # Check country code — only Ireland (IE) and GB (for NI)
    country = geo_info.get("country_code", "").upper() if geo_info else ""
    if country and country not in ("IE", "GB", ""):
        return None

    # Direct county match in text
    for county in IRISH_COUNTIES:
        if county.lower() in search_text:
            return county

    # City → county lookup
    for city, county in CITY_TO_COUNTY.items():
        if city in search_text:
            return county

    # If country is IE, at least return "Ireland"
    if country == "IE":
        return "Ireland"

    return None


def fetch_paginated_events(lat, lon, radius_km=300, max_pages=10):
    """Fetch events from the Luma paginated API."""
    base_url = "https://api.lu.ma/discover/get-paginated-events"
    events = []
    cursor = None
    page = 0

    while page < max_pages:
        params = {
            "pagination_limit": 100,
            "geo_latitude": lat,
            "geo_longitude": lon,
            "geo_radius_km": radius_km,
        }
        if cursor:
            params["pagination_cursor"] = cursor

        try:
            resp = requests.get(base_url, params=params, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  Error fetching page {page}: {e}")
            break

        entries = data.get("entries", [])
        print(f"  Page {page+1}: got {len(entries)} entries")
        events.extend(entries)

        if not data.get("has_more"):
            break

        cursor = data.get("next_cursor")
        if not cursor:
            break

        page += 1
        time.sleep(0.5)

    return events


def fetch_city_events(city_slug, max_pages=5):
    """Fetch events for a specific city via Luma's city API."""
    # Try the city discover endpoint
    base_url = "https://api.lu.ma/discover/get-paginated-events"
    events = []
    cursor = None
    page = 0

    # City coordinates
    city_coords = {
        "dublin": (53.3498, -6.2603),
        "cork": (51.8985, -8.4756),
        "galway": (53.2707, -9.0568),
        "limerick": (52.6638, -8.6267),
        "belfast": (54.5973, -5.9301),
        "waterford": (52.2593, -7.1101),
        "kilkenny": (52.6541, -7.2448),
        "tralee": (52.2675, -9.7024),
        "sligo": (54.2697, -8.4694),
        "athlone": (53.4239, -7.9407),
    }

    if city_slug not in city_coords:
        return []

    lat, lon = city_coords[city_slug]

    while page < max_pages:
        params = {
            "pagination_limit": 100,
            "geo_latitude": lat,
            "geo_longitude": lon,
            "geo_radius_km": 50,
        }
        if cursor:
            params["pagination_cursor"] = cursor

        try:
            resp = requests.get(base_url, params=params, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  Error fetching {city_slug} page {page}: {e}")
            break

        entries = data.get("entries", [])
        print(f"  {city_slug} page {page+1}: got {len(entries)} entries")
        events.extend(entries)

        if not data.get("has_more"):
            break

        cursor = data.get("next_cursor")
        if not cursor:
            break

        page += 1
        time.sleep(0.5)

    return events


def try_discover_api():
    """Try Luma's discover API with different parameters."""
    all_events = []

    # Try with Ireland center (broad search)
    print("\n[1] Fetching with Ireland center (broad geo)...")
    events = fetch_paginated_events(53.3498, -7.2604, radius_km=500, max_pages=20)
    all_events.extend(events)
    print(f"  Total so far: {len(all_events)}")

    # Try each major city with smaller radius
    cities = ["dublin", "cork", "galway", "limerick", "belfast", "waterford",
              "kilkenny", "tralee", "sligo", "athlone"]

    for city in cities:
        print(f"\n[2] Fetching for {city}...")
        events = fetch_city_events(city, max_pages=10)
        all_events.extend(events)
        time.sleep(0.3)

    return all_events


def try_calendar_api():
    """Try Luma's calendar/community endpoints for Ireland."""
    all_events = []

    # Try known Irish community slugs on Luma
    community_slugs = ["ireland", "dublin", "cork", "galway", "limerick"]
    base_url = "https://api.lu.ma/calendar/get-by-slug"

    for slug in community_slugs:
        try:
            resp = requests.get(
                base_url,
                params={"calendar_slug": slug},
                headers=HEADERS,
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"  Found calendar for slug '{slug}': {json.dumps(data)[:200]}")
            else:
                print(f"  Calendar slug '{slug}': HTTP {resp.status_code}")
        except Exception as e:
            print(f"  Error for slug '{slug}': {e}")
        time.sleep(0.3)

    return all_events


def try_public_api():
    """Try Luma's public v1 API."""
    endpoints = [
        "https://api.lu.ma/public/v1/discover/events?country=IE",
        "https://api.lu.ma/public/v1/event/list?country=IE",
    ]
    all_events = []
    for url in endpoints:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            print(f"  {url}: HTTP {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"  Response: {json.dumps(data)[:500]}")
                entries = data.get("entries", data.get("events", []))
                all_events.extend(entries)
        except Exception as e:
            print(f"  Error: {e}")
    return all_events


def parse_entry(entry):
    """Parse a raw Luma API entry into our standardised format."""
    event = entry.get("event", {})
    calendar = entry.get("calendar", {})
    hosts = entry.get("hosts", [])
    ticket_info = entry.get("ticket_info", {})

    # Name
    name = event.get("name", "")

    # Dates
    start_raw = event.get("start_at", "")
    end_raw = event.get("end_at", "")
    tz = event.get("timezone", "UTC")

    date_str = ""
    time_str = ""
    if start_raw:
        try:
            # Parse ISO datetime
            dt = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            date_str = dt.strftime("%Y-%m-%d")
            time_str = dt.strftime("%H:%M UTC")
        except Exception:
            date_str = start_raw[:10]
            time_str = start_raw[11:16] if len(start_raw) > 10 else ""

    # Location
    geo = event.get("geo_address_info", {}) or {}
    venue = geo.get("address", "") or geo.get("place_id", "")
    city = geo.get("city", "")
    city_state = geo.get("city_state", "")
    full_address = geo.get("full_address", "") or geo.get("description", "")
    country_code = geo.get("country_code", "")

    # Build address string
    address_parts = [p for p in [full_address or venue, city_state or city, country_code] if p]
    address = ", ".join(address_parts) if address_parts else ""

    # County
    county = derive_county(geo)

    # URL
    event_url = event.get("url", "")
    if event_url and not event_url.startswith("http"):
        event_url = f"https://lu.ma/{event_url}"

    # Description
    description = event.get("description_md", "") or event.get("description", "") or ""
    if isinstance(description, dict):
        description = str(description)

    # Host
    host_names = [h.get("name", "") for h in hosts if h.get("name")]
    host = ", ".join(host_names) if host_names else calendar.get("name", "")

    # Tags
    tags = event.get("tags", []) or []
    if isinstance(tags, list):
        tags = [t if isinstance(t, str) else t.get("name", "") for t in tags]

    # Category
    category = event.get("category", "")
    if category and category not in tags:
        tags.insert(0, category)

    return {
        "name": name,
        "date": date_str,
        "time": time_str,
        "venue": venue or city,
        "address": address,
        "county": county or "",
        "url": event_url,
        "description": description[:500] if description else "",
        "host": host,
        "tags": [t for t in tags if t],
    }


def deduplicate(events):
    """Remove duplicate events by URL or (name + date)."""
    seen_urls = set()
    seen_keys = set()
    unique = []
    for ev in events:
        url = ev.get("url", "")
        key = (ev.get("name", "").lower().strip(), ev.get("date", ""))
        if url and url in seen_urls:
            continue
        if key in seen_keys:
            continue
        if url:
            seen_urls.add(url)
        seen_keys.add(key)
        unique.append(ev)
    return unique


def main():
    print("=" * 60)
    print("Fetching Luma events for Ireland")
    print("=" * 60)

    all_raw_entries = []

    # Method 1: Geo-based paginated API
    print("\n--- Method 1: Geo-based paginated API ---")
    entries = try_discover_api()
    print(f"  Got {len(entries)} raw entries")
    all_raw_entries.extend(entries)

    # Method 2: Calendar/community slugs
    print("\n--- Method 2: Calendar/community slugs ---")
    try_calendar_api()

    # Method 3: Public API
    print("\n--- Method 3: Public API ---")
    pub_entries = try_public_api()
    all_raw_entries.extend(pub_entries)

    print(f"\nTotal raw entries before dedup: {len(all_raw_entries)}")

    # Filter to Ireland/NI only
    ireland_entries = []
    for entry in all_raw_entries:
        event = entry.get("event", {})
        geo = event.get("geo_address_info", {}) or {}
        country = geo.get("country_code", "").upper()
        city_state = geo.get("city_state", "").lower()
        full_addr = geo.get("full_address", "").lower()
        city = geo.get("city", "").lower()

        # Keep if country is IE or if it mentions Ireland/Northern Ireland
        is_ireland = (
            country == "IE"
            or "ireland" in city_state
            or "ireland" in full_addr
            or "northern ireland" in city_state
            or "northern ireland" in full_addr
        )

        # Also keep if county match found (covers NI)
        county = derive_county(geo)

        # Keep if online (for Irish-organised events) — skip for now, focus on in-person
        location_type = event.get("location_type", "")

        if is_ireland or (county and county != "Ireland"):
            ireland_entries.append(entry)
        elif not country and not city and location_type == "offline":
            # Unknown location — skip
            pass

    print(f"Ireland-relevant entries: {len(ireland_entries)}")

    # Parse events
    parsed = []
    for entry in ireland_entries:
        try:
            ev = parse_entry(entry)
            parsed.append(ev)
        except Exception as e:
            print(f"  Parse error: {e}")

    # Deduplicate
    unique_events = deduplicate(parsed)
    print(f"Unique events after dedup: {len(unique_events)}")

    # Sort by date
    unique_events.sort(key=lambda x: x.get("date", ""))

    # Build output
    output = {
        "scraped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
        "total": len(unique_events),
        "events": unique_events,
    }

    out_path = "/Users/helios/WHERES-DA-CRAIC/events_v1.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(unique_events)} events to {out_path}")
    print("\nSample events:")
    for ev in unique_events[:5]:
        print(f"  - {ev['name']} | {ev['date']} | {ev['county']} | {ev['url']}")


if __name__ == "__main__":
    main()
