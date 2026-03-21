import os
import csv
import json
from flask import Flask, jsonify, send_from_directory, request
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
=======
            
            # ONLY include places that are in the checkpoint
            if place_id not in enriched_data:
                continue
            try:
                culture = enriched_data[place_id]
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
=======
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    return jsonify(geojson)

@app.route('/search')
def search():
    """Search enriched places by name, Irish name, or county."""
    q = request.args.get('q', '').strip().lower()
    if not q or len(q) < 2:
        return jsonify([])

    if not os.path.exists(INPUT_CSV):
        return jsonify([])

    enriched_data = {}
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, 'r', encoding='utf-8') as f:
                enriched_data = json.load(f)
        except Exception as e:
            print(f"Error loading checkpoint: {e}")

    prefix_matches = []
    partial_matches = []

    with open(INPUT_CSV, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            place_id = f"{row['name']}_{row['lat']}_{row['lon']}"
            if place_id not in enriched_data:
                continue

            name = row['name'].lower()
            name_ga = (row.get('name_ga') or '').lower()
            county = (row.get('county') or '').lower()

            result = {
                "name": row['name'],
                "name_ga": row.get('name_ga', ''),
                "county": row.get('county', ''),
                "type": row.get('type', ''),
                "lat": float(row['lat']),
                "lon": float(row['lon']),
            }

            if name.startswith(q) or name_ga.startswith(q):
                prefix_matches.append(result)
            elif q in name or q in name_ga or q in county:
                partial_matches.append(result)

    results = (prefix_matches + partial_matches)[:10]
    return jsonify(results)


if __name__ == '__main__':
    # Use port 5001 to avoid potential conflicts with port 5000
    app.run(host='0.0.0.0', port=5001, debug=True)
