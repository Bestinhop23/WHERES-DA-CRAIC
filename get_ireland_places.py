import requests
import csv
import time
import sys

# Constants for Overpass API
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding box for the island of Ireland (comprehensive)
# format: (south, west, north, east)
IRELAND_BBOX = (51.3, -10.7, 55.6, -5.3)

def fetch_populated_places():
    """
    Fetches cities, towns, villages, and hamlets in Ireland using the Overpass API.
    Uses a bounding box and extracts Irish names and county tags.
    """
    # Expanded query to include more place types and comprehensive tags
    # Includes hamlet and suburb to increase the count as requested.
    query = f"""
    [out:json][timeout:300];
    (
      node["place"~"city|town|village|hamlet|suburb"]{IRELAND_BBOX};
      way["place"~"city|town|village|hamlet|suburb"]{IRELAND_BBOX};
      rel["place"~"city|town|village|hamlet|suburb"]{IRELAND_BBOX};
    );
    out center;
    """
    
    max_retries = 3
    retry_delay = 10
    
    for attempt in range(max_retries):
        try:
            print(f"Fetching data from Overpass API (attempt {attempt + 1})...")
            response = requests.post(OVERPASS_URL, data={'data': query}, timeout=180)
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse JSON response
            data = response.json()
            return data.get('elements', [])
            
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:
                print("Error: Too many requests. Waiting to retry...")
                time.sleep(retry_delay * (attempt + 2))
            else:
                print(f"HTTP Error occurred: {e}")
                break
        except requests.exceptions.RequestException as e:
            print(f"Request Error occurred: {e}")
            time.sleep(retry_delay)
            
    return None

def process_and_save_data(elements):
    """
    Processes the API results and saves them to a CSV file.
    Includes columns: name, name_ga, county, lat, lon, type
    """
    if not elements:
        print("No data retrieved.")
        return

    output_file = "places_ireland.csv"
    
    try:
        with open(output_file, mode='w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['name', 'name_ga', 'county', 'lat', 'lon', 'type']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            count = 0
            for element in elements:
                tags = element.get('tags', {})
                name = tags.get('name')
                
                # Only include entries that have a name
                if not name:
                    continue
                
                # Extract Irish name
                name_ga = tags.get('name:ga')
                
                # Extract County from various possible tags
                # is_in:county, addr:county, and tiger:county are common.
                # Sometimes it's in a list in the 'is_in' tag.
                county = (tags.get('addr:county') or 
                         tags.get('is_in:county') or 
                         tags.get('is_in:state') or
                         tags.get('tiger:county'))
                
                if not county and 'is_in' in tags:
                    # Look for county in the 'is_in' string (e.g., "Ireland, County Meath")
                    is_in_parts = [p.strip() for p in tags['is_in'].split(',')]
                    for part in is_in_parts:
                        if 'County' in part or 'Co.' in part:
                            county = part
                            break

                # Clean up county name
                if county:
                    county = county.replace('County ', '').replace(' Co.', '').replace('county ', '').strip()

                place_type = tags.get('place')
                
                # Overpass 'out center' provides 'lat' and 'lon' for nodes
                # and 'center' dict for ways/relations.
                lat = element.get('lat') or element.get('center', {}).get('lat')
                lon = element.get('lon') or element.get('center', {}).get('lon')
                
                if lat and lon:
                    writer.writerow({
                        'name': name,
                        'name_ga': name_ga or '',
                        'county': county or '',
                        'lat': lat,
                        'lon': lon,
                        'type': place_type
                    })
                    count += 1
            
            print(f"Successfully saved {count} places to {output_file}")
            
    except IOError as e:
        print(f"Error writing to file: {e}")

if __name__ == "__main__":
    # Fetch data
    places = fetch_populated_places()
    
    if places:
        # Process and save to CSV
        process_and_save_data(places)
    else:
        print("Failed to retrieve data after retries.")
        sys.exit(1)
