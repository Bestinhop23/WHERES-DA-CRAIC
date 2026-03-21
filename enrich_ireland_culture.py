import os
import csv
import json
import time
import random
from tqdm import tqdm
from openai import OpenAI
from dotenv import load_dotenv

# 1. Setup & Data Handling
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

INPUT_CSV = "places_ireland.csv"
OUTPUT_GEOJSON = "ireland_culture.geojson"
CHECKPOINT_FILE = "enrichment_checkpoint.json"
SEANFHOCAIL_CSV = "seanfhocail_50.csv"

# Load seanfhocail (Irish proverbs) at startup
def load_seanfhocail():
    """Loads Irish proverbs from CSV."""
    proverbs = []
    if not os.path.exists(SEANFHOCAIL_CSV):
        print(f"Warning: {SEANFHOCAIL_CSV} not found. Using basic proverbs.")
        return [
            {"irish": "Ar scáth a chéile a mhaireann na daoine", "english": "People live in each other's shelter"},
            {"irish": "Is fearr Gaeilge briste ná Béarla cliste", "english": "Broken Irish is better than clever English"},
        ]
    
    with open(SEANFHOCAIL_CSV, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            proverbs.append({"irish": row['irish'], "english": row['english']})
    return proverbs

SEANFHOCAIL_LIST = load_seanfhocail()
print(f"Loaded {len(SEANFHOCAIL_LIST)} seanfhocail (Irish proverbs)")

def load_places():
    """Loads and filters towns, cities, and villages from the CSV."""
    places = []
    if not os.path.exists(INPUT_CSV):
        print(f"Error: {INPUT_CSV} not found. Please run get_ireland_places.py first.")
        return []
    
    with open(INPUT_CSV, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['type'] in ['town', 'city', 'village']:
                places.append(row)
    return places

def load_checkpoint():
    """Loads progress from the checkpoint file."""
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_checkpoint(data):
    """Saves progress to the checkpoint file."""
    with open(CHECKPOINT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 2. AI Enrichment Logic (The Storyteller)
def get_cultural_data(name, county):
    """Prompts OpenAI to get cultural enrichment data for a town."""
    prompt = f"""
    You are a local Irish seanchaí (storyteller). Provide a JSON object for {name}, County {county or 'Ireland'} with a warm, conversational tone.
    
    Include these specific keys:
    - 'etymology': The meaning of the Irish name and its origin.
    - 'folklore_myth': A local legend, ghost story, or mythological tale.
    - 'poetry_lit': A famous poet, writer, or specific verse associated with the area.
    - 'history_landmarks': The most important historical events or ancient ruins nearby.
    - 'gaa_heritage': The local GAA club, their colors, and any sporting legends.
    - 'famous_people': Iconic Irish-speaking figures or historical personalities from here.
    - 'modern_culture': Current famous residents, festivals, or filming locations.
    - 'hidden_gem': A secret spot (holy well, hidden beach) tourists usually miss.
    - 'multimedia_query': A specific string I can use to search YouTube/Spotify for a relevant local song.
    
    Return ONLY the raw JSON object.
    """
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                timeout=30
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"\nError fetching data for {name} (attempt {attempt+1}): {e}")
            time.sleep(5 * (attempt + 1))
    
    return None

def create_geojson(places, enriched_data):
    """Creates a GeoJSON FeatureCollection from the merged data."""
    features = []
    for place in places:
        place_id = f"{place['name']}_{place['lat']}_{place['lon']}"
        if place_id in enriched_data:
            culture = enriched_data[place_id]
            
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(place['lon']), float(place['lat'])]
                },
                "properties": {
                    "name": place['name'],
                    "name_ga": place['name_ga'],
                    "county": place['county'],
                    "type": place['type'],
                    **culture
                }
            }
            features.append(feature)
            
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(OUTPUT_GEOJSON, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    print(f"\nSuccessfully saved {len(features)} features to {OUTPUT_GEOJSON}")

# 5. Execution Block
if __name__ == "__main__":
    print("Loading places...")
    all_places = load_places()
    if not all_places:
        exit(1)
        
    enriched_data = load_checkpoint()
    print(f"Loaded {len(enriched_data)} already processed towns.")
    
    # Filter out already processed places
    to_process = []
    for p in all_places:
        p_id = f"{p['name']}_{p['lat']}_{p['lon']}"
        if p_id not in enriched_data:
            to_process.append(p)
    
    print(f"Total places to process: {len(to_process)}")
    
    # Process with progress bar
    try:
        count = 0
        for place in tqdm(to_process, desc="Enriching Culture"):
            place_id = f"{place['name']}_{place['lat']}_{place['lon']}"
            
            cultural_info = get_cultural_data(place['name'], place['county'])
            if cultural_info:
                # Add a random seanfhocail to each place
                random_seanfhocail = random.choice(SEANFHOCAIL_LIST)
                cultural_info['seanfhocail'] = random_seanfhocail
                enriched_data[place_id] = cultural_info
                count += 1
                
                # Checkpoint every 5 towns
                if count % 5 == 0:
                    save_checkpoint(enriched_data)
            
            # Rate limiting / politeness
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\nProcess interrupted by user. Saving progress...")
    finally:
        save_checkpoint(enriched_data)
        
    # Final Output
    print("\nMerging data and creating GeoJSON...")
    create_geojson(all_places, enriched_data)
