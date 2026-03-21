#!/usr/bin/env python3
"""
Extra fetching pass to get more Irish events from Luma.
Merges results into existing events_v1.json
"""

import requests
import json
import time
from datetime import datetime, timezone

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://lu.ma/",
    "Origin": "https://lu.ma",
    "x-luma-web-url": "https://lu.ma/discover",
}

IRISH_COUNTIES = [
    "Dublin", "Cork", "Galway", "Limerick", "Waterford", "Kerry",
    "Tipperary", "Clare", "Mayo", "Donegal", "Sligo", "Leitrim",
    "Roscommon", "Longford", "Westmeath", "Offaly", "Laois", "Kildare",
    "Wicklow", "Wexford", "Carlow", "Kilkenny", "Meath", "Louth",
    "Monaghan", "Cavan", "Fermanagh", "Antrim", "Armagh", "Down",
    "Tyrone", "Derry",
]

CITY_TO_COUNTY = {
    "dublin": "Dublin", "dún laoghaire": "Dublin", "dun laoghaire": "Dublin",
    "swords": "Dublin", "tallaght": "Dublin", "blanchardstown": "Dublin",
    "dundrum": "Dublin", "stillorgan": "Dublin", "blackrock": "Dublin",
    "clontarf": "Dublin", "rathmines": "Dublin", "ranelagh": "Dublin",
    "ballsbridge": "Dublin", "sandyford": "Dublin", "leopardstown": "Dublin",
    "malahide": "Dublin", "howth": "Dublin", "lucan": "Dublin",
    "glasnevin": "Dublin", "drumcondra": "Dublin", "clondalkin": "Dublin",
    "santry": "Dublin", "templeogue": "Dublin", "terenure": "Dublin",
    "donnybrook": "Dublin", "rathgar": "Dublin", "milltown": "Dublin",
    "bray": "Wicklow", "greystones": "Wicklow", "wicklow": "Wicklow",
    "arklow": "Wicklow", "blessington": "Wicklow",
    "cork": "Cork", "cobh": "Cork", "mallow": "Cork", "midleton": "Cork",
    "bandon": "Cork", "skibbereen": "Cork", "kinsale": "Cork", "fermoy": "Cork",
    "youghal": "Cork", "bantry": "Cork", "clonakilty": "Cork",
    "galway": "Galway", "tuam": "Galway", "ballinasloe": "Galway",
    "oranmore": "Galway", "athenry": "Galway", "loughrea": "Galway",
    "limerick": "Limerick", "castletroy": "Limerick", "ennis road": "Limerick",
    "waterford": "Waterford", "dungarvan": "Waterford", "tramore": "Waterford",
    "tralee": "Kerry", "killarney": "Kerry", "listowel": "Kerry",
    "kenmare": "Kerry", "dingle": "Kerry",
    "tipperary": "Tipperary", "clonmel": "Tipperary", "thurles": "Tipperary",
    "nenagh": "Tipperary", "cashel": "Tipperary", "carrick-on-suir": "Tipperary",
    "ennis": "Clare", "shannon": "Clare", "kilrush": "Clare", "killaloe": "Clare",
    "castlebar": "Mayo", "ballina": "Mayo", "westport": "Mayo", "claremorris": "Mayo",
    "donegal": "Donegal", "letterkenny": "Donegal", "bundoran": "Donegal",
    "ballyshannon": "Donegal",
    "naas": "Kildare", "newbridge": "Kildare", "maynooth": "Kildare",
    "celbridge": "Kildare", "leixlip": "Kildare", "athy": "Kildare", "kildare": "Kildare",
    "navan": "Meath", "trim": "Meath", "dunboyne": "Meath", "kells": "Meath",
    "drogheda": "Louth", "dundalk": "Louth", "ardee": "Louth",
    "wexford": "Wexford", "enniscorthy": "Wexford", "gorey": "Wexford", "new ross": "Wexford",
    "kilkenny": "Kilkenny", "thomastown": "Kilkenny",
    "sligo": "Sligo", "ballymote": "Sligo",
    "cavan": "Cavan", "monaghan": "Monaghan",
    "longford": "Longford", "mullingar": "Westmeath", "athlone": "Westmeath",
    "tullamore": "Offaly", "birr": "Offaly",
    "roscommon": "Roscommon", "boyle": "Roscommon",
    "portlaoise": "Laois", "portarlington": "Laois", "abbeyleix": "Laois",
    "carlow": "Carlow", "muinebheag": "Carlow",
    "carrick-on-shannon": "Leitrim", "carrick on shannon": "Leitrim", "manorhamilton": "Leitrim",
    "belfast": "Antrim", "lisburn": "Antrim", "antrim": "Antrim",
    "derry": "Derry", "londonderry": "Derry",
    "armagh": "Armagh", "lurgan": "Armagh", "portadown": "Armagh",
    "newry": "Down", "bangor": "Down", "downpatrick": "Down",
    "omagh": "Tyrone", "strabane": "Tyrone", "cookstown": "Tyrone",
    "enniskillen": "Fermanagh",
}


def derive_county(geo_info, address_str=""):
    if not geo_info and not address_str:
        return None
    search_parts = []
    if geo_info:
        for field in ["city_state", "full_address", "city", "region", "description"]:
            val = geo_info.get(field, "")
            if val:
                search_parts.append(str(val))
    if address_str:
        search_parts.append(address_str)
    search_text = " | ".join(search_parts).lower()
    country = geo_info.get("country_code", "").upper() if geo_info else ""
    if country and country not in ("IE", "GB", ""):
        return None
    for county in IRISH_COUNTIES:
        if county.lower() in search_text:
            return county
    for city, county in CITY_TO_COUNTY.items():
        if city in search_text:
            return county
    if country == "IE":
        return "Ireland"
    return None


def fetch_paginated(lat, lon, radius_km=50, max_pages=10, label=""):
    base_url = "https://api.lu.ma/discover/get-paginated-events"
    events = []
    cursor = None

    for page in range(max_pages):
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
            print(f"  [{label}] Error page {page}: {e}")
            break
        entries = data.get("entries", [])
        events.extend(entries)
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
        if not cursor:
            break
        time.sleep(0.4)

    if events:
        print(f"  [{label}] {len(events)} entries")
    return events


def parse_entry(entry):
    event = entry.get("event", {})
    calendar = entry.get("calendar", {})
    hosts = entry.get("hosts", [])

    name = event.get("name", "")
    start_raw = event.get("start_at", "")
    date_str = ""
    time_str = ""
    if start_raw:
        try:
            dt = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            date_str = dt.strftime("%Y-%m-%d")
            time_str = dt.strftime("%H:%M UTC")
        except Exception:
            date_str = start_raw[:10]
            time_str = start_raw[11:16] if len(start_raw) > 10 else ""

    geo = event.get("geo_address_info", {}) or {}
    venue = geo.get("address", "") or geo.get("place_id", "")
    city = geo.get("city", "")
    city_state = geo.get("city_state", "")
    full_address = geo.get("full_address", "") or geo.get("description", "")
    country_code = geo.get("country_code", "")
    address_parts = [p for p in [full_address or venue, city_state or city, country_code] if p]
    address = ", ".join(address_parts)
    county = derive_county(geo)

    event_url = event.get("url", "")
    if event_url and not event_url.startswith("http"):
        event_url = f"https://lu.ma/{event_url}"

    description = event.get("description_md", "") or event.get("description", "") or ""
    if isinstance(description, dict):
        description = str(description)

    host_names = [h.get("name", "") for h in hosts if h.get("name")]
    host = ", ".join(host_names) if host_names else calendar.get("name", "")

    tags = event.get("tags", []) or []
    if isinstance(tags, list):
        tags = [t if isinstance(t, str) else t.get("name", "") for t in tags]
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


def main():
    # Lots of Irish locations to try
    locations = [
        # (label, lat, lon, radius_km)
        # Major cities (already done but re-try with bigger radius)
        ("Dublin-big", 53.3498, -6.2603, 80),
        ("Cork-big", 51.8985, -8.4756, 60),
        ("Galway-big", 53.2707, -9.0568, 60),
        ("Limerick-big", 52.6638, -8.6267, 60),
        ("Belfast-big", 54.5973, -5.9301, 60),
        # Other cities
        ("Waterford", 52.2593, -7.1101, 40),
        ("Kilkenny", 52.6541, -7.2448, 40),
        ("Tralee/Kerry", 52.2675, -9.7024, 60),
        ("Sligo", 54.2697, -8.4694, 40),
        ("Athlone/Midlands", 53.4239, -7.9407, 80),
        ("Dundalk/Louth", 53.9986, -6.4050, 40),
        ("Drogheda", 53.7179, -6.3596, 30),
        ("Wexford", 52.3369, -6.4633, 40),
        ("Carlow", 52.8408, -6.9261, 30),
        ("Navan/Meath", 53.6557, -6.6799, 40),
        ("Maynooth/Kildare", 53.3809, -6.5930, 30),
        ("Ennis/Clare", 52.8436, -8.9866, 40),
        ("Letterkenny/Donegal", 54.9558, -7.7342, 60),
        ("Castlebar/Mayo", 53.8571, -9.2976, 60),
        ("Mullingar/Westmeath", 53.5228, -7.3402, 40),
        ("Longford", 53.7278, -7.7965, 30),
        ("Tullamore/Offaly", 53.2773, -7.4892, 30),
        ("Portlaoise/Laois", 53.0329, -7.2990, 30),
        ("Cavan", 53.9897, -7.3633, 30),
        ("Monaghan", 54.2490, -6.9680, 30),
        ("Derry/NI-West", 54.9966, -7.3086, 40),
        ("Armagh/NI-South", 54.3503, -6.6528, 40),
        ("Newry/Down", 54.1751, -6.3402, 30),
        ("Enniskillen/Fermanagh", 54.3441, -7.6343, 40),
        ("Omagh/Tyrone", 54.5994, -7.2960, 40),
    ]

    all_raw = []
    for label, lat, lon, radius in locations:
        entries = fetch_paginated(lat, lon, radius, max_pages=10, label=label)
        all_raw.extend(entries)
        time.sleep(0.3)

    print(f"\nTotal raw entries: {len(all_raw)}")

    # Filter to Ireland/NI
    ireland_entries = []
    for entry in all_raw:
        event = entry.get("event", {})
        geo = event.get("geo_address_info", {}) or {}
        country = geo.get("country_code", "").upper()
        city_state = geo.get("city_state", "").lower()
        full_addr = geo.get("full_address", "").lower()

        is_ireland = (
            country == "IE"
            or "ireland" in city_state
            or "ireland" in full_addr
            or "northern ireland" in city_state
        )
        county = derive_county(geo)

        if is_ireland or (county and county != "Ireland"):
            ireland_entries.append(entry)

    print(f"Ireland-relevant: {len(ireland_entries)}")

    # Parse
    parsed = []
    for entry in ireland_entries:
        try:
            ev = parse_entry(entry)
            parsed.append(ev)
        except Exception as e:
            print(f"  Parse error: {e}")

    print(f"Parsed: {len(parsed)}")

    # Load existing events
    out_path = "/Users/helios/WHERES-DA-CRAIC/events_v1.json"
    try:
        with open(out_path) as f:
            existing = json.load(f)
        existing_events = existing.get("events", [])
    except Exception:
        existing_events = []

    print(f"Existing events: {len(existing_events)}")

    # Merge
    all_events = existing_events + parsed

    # Deduplicate
    seen_urls = set()
    seen_keys = set()
    unique = []
    for ev in all_events:
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

    unique.sort(key=lambda x: x.get("date", ""))
    print(f"Unique events after merge: {len(unique)}")

    output = {
        "scraped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
        "total": len(unique),
        "events": unique,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(unique)} events to {out_path}")

    # County breakdown
    counties = {}
    for ev in unique:
        c = ev.get("county") or "Unknown"
        counties[c] = counties.get(c, 0) + 1
    print("\nBy county:")
    for c, n in sorted(counties.items(), key=lambda x: -x[1]):
        print(f"  {c}: {n}")


if __name__ == "__main__":
    main()
