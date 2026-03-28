# WHERES-DA-CRAIC 🗺️

A deep culture map of Ireland that fetches Irish towns, cities, and villages, enriches them with cultural information using AI, and displays them on an interactive web map. It's cool.

## Overview

This project combines geographic data from OpenStreetMap with AI-powered cultural enrichment to create an interactive map of Irish places. The three main components are:

1. **get_ireland_places.py** - Fetches Irish populated places from Overpass API
2. **enrich_ireland_culture.py** - Enriches place data with cultural information using OpenAI's API
3. **server.py** - Flask web server that serves the data and hosts the interactive map

## Prerequisites

- Python 3.7+
- An OpenAI API key

## Installation

### 1. Clone/Setup the Repository
```bash
cd /Users/johnathan/WHERES-DA-CRAIC
```

### 2. Create a Virtual Environment (Recommended)
```bash
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or on Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install flask flask-cors requests tqdm openai python-dotenv
```

## Running the Project

## Where's The Craic Pub Demo (new)

Run backend and frontend together in separate terminals:

```bash
# Terminal 1 - backend API (Flask + SQLite)
cd /Users/johnathan/Downloads/untitled\ folder/WHERES-DA-CRAIC
source .venv/bin/activate
python server.py
```

```bash
# Terminal 2 - frontend app (Vite)
cd /Users/johnathan/Downloads/untitled\ folder/WHERES-DA-CRAIC/cupan-caife-web
npm install
npm run dev -- --host --port 5173
```

Open `http://localhost:5173`.

NFC simulation URL format:

`http://localhost:5173/redeem?pubID=padraigs`

Backend API smoke test:

```bash
curl http://localhost:5001/api/health
curl http://localhost:5001/api/pubs
curl -X POST http://localhost:5001/api/redeem \
	-H 'Content-Type: application/json' \
	-d '{"userID":"demo-user","pubID":"padraigs","deviceFingerprint":"test"}'
```

### Step 1: Fetch Irish Places
Fetch Irish towns, cities, villages from OpenStreetMap:

```bash
python3 get_ireland_places.py
```

This creates `places_ireland.csv` with Irish place names, coordinates, and types. It uses the Overpass API, so it may take a few minutes.

### Step 2: Enrich Data with Cultural Information
Enrich the places with cultural information using OpenAI:

```bash
# Set your OpenAI API key first
export OPENAI_API_KEY="your-api-key-here"

python3 enrich_ireland_culture.py
```

This script:
- Reads from `places_ireland.csv`
- Queries OpenAI for cultural details about each place
- Saves progress in `enrichment_checkpoint.json` (can resume if interrupted)
- Creates the enriched dataset for the map

### Step 3: Start the Web Server
```bash
python3 server.py
```

The server will start on `http://localhost:5001`

Open your browser and navigate to `http://localhost:5001` to view the interactive map.

## Project Files

- **server.py** - Flask web server with `/` (map UI) and `/data` (GeoJSON API) endpoints
- **index.html** - Interactive Leaflet-based map UI
- **get_ireland_places.py** - Overpass API fetcher for Irish places
- **enrich_ireland_culture.py** - OpenAI enrichment script with checkpoint recovery
- **places_ireland.csv** - CSV file with fetched Irish places (generated)
- **enrichment_checkpoint.json** - Checkpoint file for enrichment progress (generated)

## Environment Variables

Create a `.env` file in the project root:
```
OPENAI_API_KEY=your-api-key-here
```

Or set it directly in your terminal:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

## Troubleshooting

- **ModuleNotFoundError**: Make sure all dependencies are installed with `pip install -r requirements.txt`
- **CSV not found**: Run `get_ireland_places.py` first
- **OpenAI API errors**: Verify your API key is correct and has sufficient credits
- **Port 5001 already in use**: Modify the port in `server.py` line with `app.run()`

## License

[Add license information if applicable]
