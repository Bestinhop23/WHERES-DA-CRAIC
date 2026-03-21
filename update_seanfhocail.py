#!/usr/bin/env python3
import json
import csv
import random

# Load seanfhocail
seanfhocail_list = []
with open('seanfhocail_50.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        seanfhocail_list.append({
            "irish": row['irish'],
            "english": row['english']
        })

print(f"✓ Loaded {len(seanfhocail_list)} proverbs")

# Load existing checkpoint
with open('enrichment_checkpoint.json', 'r', encoding='utf-8') as f:
    checkpoint = json.load(f)

print(f"✓ Loaded {len(checkpoint)} enriched places")

# Load all places from CSV
all_places = {}
with open('places_ireland.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        place_id = f"{row['name']}_{row['lat']}_{row['lon']}"
        all_places[place_id] = row

print(f"✓ Loaded {len(all_places)} total places from CSV")

# Assign seanfhocail to ALL places (enriched or not)
updated_count = 0
for place_id in all_places:
    if place_id not in checkpoint:
        # Create entry for non-enriched place with just seanfhocail
        checkpoint[place_id] = {}
    
    # Assign random seanfhocail to every place
    checkpoint[place_id]['seanfhocail'] = random.choice(seanfhocail_list)
    updated_count += 1

# Save updated checkpoint
with open('enrichment_checkpoint.json', 'w', encoding='utf-8') as f:
    json.dump(checkpoint, f, ensure_ascii=False, indent=2)

print(f"✓ Assigned seanfhocail to {updated_count} places")
print(f"✓ Total places in checkpoint: {len(checkpoint)}")
print("✓ Dataset updated! Every place now has a proverb.")
