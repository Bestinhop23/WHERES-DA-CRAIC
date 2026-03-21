import os
import csv
import json
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

INPUT_CSV = "places_ireland.csv"
CHECKPOINT_FILE = "enrichment_checkpoint.json"

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/data')
def get_data():
    """Merges CSV and checkpoint data on the fly and returns GeoJSON."""
    if not os.path.exists(INPUT_CSV):
        return jsonify({"error": "CSV not found"}), 404
    
    enriched_data = {}
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, 'r', encoding='utf-8') as f:
                enriched_data = json.load(f)
        except Exception as e:
            print(f"Error loading checkpoint: {e}")
            return jsonify({"error": f"Checkpoint file corrupted: {str(e)}"}), 404

    features = []
    with open(INPUT_CSV, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            place_id = f"{row['name']}_{row['lat']}_{row['lon']}"
            
            # Include all places: enriched ones get full data, others get basic data
            try:
                if place_id in enriched_data:
                    culture = enriched_data[place_id]
                else:
                    # Basic fallback data for non-enriched places
                    culture = {
                        "etymology": "Data pending enrichment",
                        "folklore_myth": "Coming soon...",
                        "poetry_lit": "Coming soon...",
                        "history_landmarks": [],
                        "gaa_heritage": {"club_name": "TBD", "colors": "TBD"},
                        "famous_people": [],
                        "modern_culture": {},
                        "hidden_gem": "Coming soon...",
                        "seanfhocail": {"irish": "Ar scáth a chéile a mhaireann na daoine", "english": "People live in each other's shelter"},
                        "multimedia_query": row['name']
                    }
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row['lon']), float(row['lat'])]
                    },
                    "properties": {
                        "name": row['name'],
                        "name_ga": row['name_ga'] or row['name'],
                        "county": row['county'] or "Ireland",
                        "type": row['type'],
                        **culture
                    }
                }
                features.append(feature)
            except Exception as e:
                print(f"Error processing {row['name']}: {e}")
                continue
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    return jsonify(geojson)

if __name__ == '__main__':
    # Use port 5001 to avoid potential conflicts with port 5000
    app.run(host='0.0.0.0', port=5001, debug=True)
