import csv
import json
import os
import random

SEANFHOCAIL_CSV = "seanfhocail_50.csv"
PLACES_CSV = "places_ireland.csv"
OUTPUT_JSON = "seanfhocail_town_map.json"

# Load seanfhocail
with open(SEANFHOCAIL_CSV, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    seanfhocail_list = list(reader)

# Load towns (filter for type town/city/village)
towns = []
with open(PLACES_CSV, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row["type"] in ("town", "city", "village"):
            towns.append(row)

# Shuffle and assign seanfhocail (repeat if not enough)
random.shuffle(seanfhocail_list)
assigned = {}
for i, town in enumerate(towns):
    proverb = seanfhocail_list[i % len(seanfhocail_list)]
    key = f"{town['name']}|{town['lat']}|{town['lon']}"
    assigned[key] = {
        "town": town["name"],
        "name_ga": town["name_ga"],
        "county": town["county"],
        "lat": town["lat"],
        "lon": town["lon"],
        "type": town["type"],
        "seanfhocal_irish": proverb["irish"],
        "seanfhocal_english": proverb["english"]
    }

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(assigned, f, ensure_ascii=False, indent=2)

print(f"Assigned {len(assigned)} towns a seanfhocal. Saved to {OUTPUT_JSON}")
