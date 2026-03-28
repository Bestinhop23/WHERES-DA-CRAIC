import csv
import json
import os
import math
import sqlite3
import time
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "craic_demo.db"
INPUT_CSV = ROOT / "places_ireland.csv"
CHECKPOINT_FILE = ROOT / "enrichment_checkpoint.json"
EVENTS_FILE = ROOT / "events_v1.json"
PUBS_FILE = ROOT / "cupan-caife-web" / "src" / "data" / "pubs.json"
LUMA_DISCOVER_URL = "https://api.lu.ma/discover/get-paginated-events"
LUMA_REFRESH_INTERVAL_SECONDS = int(os.getenv("LUMA_REFRESH_INTERVAL_SECONDS", "900"))
LUMA_MAX_PAGES = int(os.getenv("LUMA_MAX_PAGES", "6"))

DB_LOCK = threading.Lock()
REDEEM_COOLDOWN_MINUTES = 30
BASE_REWARD = 20

LUMA_HEADERS = {
	"User-Agent": "Mozilla/5.0",
	"Accept": "application/json, text/plain, */*",
	"Referer": "https://lu.ma/",
	"Origin": "https://lu.ma",
}

IRISH_COUNTIES = {
	"Antrim", "Armagh", "Carlow", "Cavan", "Clare", "Cork", "Derry", "Donegal",
	"Down", "Dublin", "Fermanagh", "Galway", "Kerry", "Kildare", "Kilkenny",
	"Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath",
	"Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Tyrone",
	"Waterford", "Westmeath", "Wexford", "Wicklow",
}

COUNTY_CENTROIDS = {
	"Dublin": (53.3498, -6.2603),
	"Cork": (51.8985, -8.4756),
	"Galway": (53.2707, -9.0568),
	"Limerick": (52.6638, -8.6267),
	"Waterford": (52.2593, -7.1101),
	"Kerry": (52.1545, -9.5669),
	"Tipperary": (52.4736, -8.1619),
	"Clare": (52.9047, -8.9805),
	"Mayo": (53.8578, -9.2972),
	"Donegal": (54.6549, -8.1096),
	"Sligo": (54.2697, -8.4694),
	"Leitrim": (54.1161, -8.0785),
	"Roscommon": (53.6279, -8.1894),
	"Longford": (53.7278, -7.7965),
	"Westmeath": (53.5333, -7.35),
	"Offaly": (53.2734, -7.7783),
	"Laois": (53.0329, -7.2990),
	"Kildare": (53.1589, -6.9094),
	"Wicklow": (52.9806, -6.0440),
	"Wexford": (52.3369, -6.4633),
	"Carlow": (52.8408, -6.9261),
	"Kilkenny": (52.6541, -7.2448),
	"Meath": (53.6538, -6.6873),
	"Louth": (53.95, -6.54),
	"Monaghan": (54.2490, -6.9680),
	"Cavan": (53.9897, -7.3633),
	"Fermanagh": (54.3441, -7.6343),
	"Antrim": (54.7195, -6.2072),
	"Armagh": (54.3503, -6.6528),
	"Down": (54.3281, -5.7167),
	"Tyrone": (54.5994, -7.2960),
	"Derry": (54.9966, -7.3086),
}

EVENTS_LOCK = threading.Lock()
EVENTS_CACHE: list[dict] = []
EVENTS_LAST_REFRESH: Optional[str] = None
EVENTS_LAST_ERROR: Optional[str] = None
EVENTS_REFRESH_IN_PROGRESS = False


def now_iso() -> str:
	return datetime.now(timezone.utc).isoformat()


def parse_iso_datetime(value: str) -> Optional[datetime]:
	if not value:
		return None
	try:
		return datetime.fromisoformat(value.replace("Z", "+00:00"))
	except ValueError:
		return None


def parse_event_datetime(event: dict) -> Optional[datetime]:
	date_raw = (event.get("date") or "").strip()
	time_raw = (event.get("time") or "").strip().replace(" UTC", "")
	if not date_raw:
		return None
	if not time_raw:
		time_raw = "00:00"
	try:
		return datetime.fromisoformat(f"{date_raw}T{time_raw}:00+00:00")
	except ValueError:
		return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
	r = 6371.0
	dlat = math.radians(lat2 - lat1)
	dlon = math.radians(lon2 - lon1)
	a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
	return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def to_float(value) -> Optional[float]:
	try:
		if value is None:
			return None
		return float(value)
	except (TypeError, ValueError):
		return None


def is_irish_focused_event(event: dict) -> bool:
	text = " ".join([
		str(event.get("name") or ""),
		str(event.get("description") or ""),
		str(event.get("host") or ""),
		" ".join(event.get("tags") or []),
	]).lower()
	keywords = [
		"gaeilge", "gaeilge", "irish language", "as gaeilge", "gaeltacht", "sean-nos", "trad",
		"ceili", "céilí", "irish class", "learn irish", "comhra", "seisiun", "seisiún", "gael",
	]
	return any(k in text for k in keywords)


def derive_county_from_text(geo: dict, address_text: str) -> str:
	search_text = " ".join([
		str(geo.get("city_state") or ""),
		str(geo.get("full_address") or ""),
		str(geo.get("city") or ""),
		str(geo.get("region") or ""),
		address_text,
	]).lower()
	for county in IRISH_COUNTIES:
		if county.lower() in search_text:
			return county
	return ""


def normalise_luma_entry(entry: dict) -> Optional[dict]:
	event = entry.get("event", {}) or {}
	calendar = entry.get("calendar", {}) or {}
	hosts = entry.get("hosts", []) or []
	geo = event.get("geo_address_info", {}) or {}

	name = (event.get("name") or "").strip()
	if not name:
		return None

	start_raw = event.get("start_at") or ""
	start_dt = parse_iso_datetime(start_raw)
	date_str = start_dt.strftime("%Y-%m-%d") if start_dt else ""
	time_str = start_dt.strftime("%H:%M UTC") if start_dt else ""

	venue = (geo.get("address") or geo.get("place_id") or "").strip()
	address_parts = [
		geo.get("full_address") or geo.get("description") or venue,
		geo.get("city_state") or geo.get("city") or "",
		geo.get("country_code") or "",
	]
	address = ", ".join([str(p).strip() for p in address_parts if p])
	county = derive_county_from_text(geo, address)

	event_url = (event.get("url") or "").strip()
	if event_url and not event_url.startswith("http"):
		event_url = f"https://lu.ma/{event_url}"

	description = event.get("description_md") or event.get("description") or ""
	if isinstance(description, dict):
		description = json.dumps(description)

	host_names = [h.get("name", "") for h in hosts if h.get("name")]
	host = ", ".join(host_names) if host_names else (calendar.get("name") or "")

	tags = event.get("tags", []) or []
	if isinstance(tags, list):
		tags = [t if isinstance(t, str) else t.get("name", "") for t in tags]
	tags = [t for t in tags if t]
	category = event.get("category") or ""
	if category and category not in tags:
		tags.insert(0, category)

	lat = to_float(event.get("geo_latitude") or geo.get("latitude") or geo.get("lat"))
	lon = to_float(event.get("geo_longitude") or geo.get("longitude") or geo.get("lon"))

	return {
		"name": name,
		"date": date_str,
		"time": time_str,
		"venue": venue,
		"address": address,
		"county": county,
		"url": event_url,
		"description": str(description)[:500] if description else "",
		"host": host,
		"tags": tags,
		"lat": lat,
		"lon": lon,
	}


def deduplicate_events(events: list[dict]) -> list[dict]:
	seen_urls = set()
	seen_keys = set()
	unique = []
	for event in events:
		url = (event.get("url") or "").strip()
		key = ((event.get("name") or "").lower().strip(), event.get("date") or "")
		if url and url in seen_urls:
			continue
		if key in seen_keys:
			continue
		if url:
			seen_urls.add(url)
		seen_keys.add(key)
		unique.append(event)
	return unique


def load_events_from_disk() -> list[dict]:
	if not EVENTS_FILE.exists():
		return []
	with open(EVENTS_FILE, "r", encoding="utf-8") as f:
		data = json.load(f)
	return data.get("events", [])


def save_events_to_disk(events: list[dict]) -> None:
	payload = {
		"scraped_at": now_iso(),
		"total": len(events),
		"events": events,
	}
	with open(EVENTS_FILE, "w", encoding="utf-8") as f:
		json.dump(payload, f, ensure_ascii=False, indent=2)


def fetch_luma_events_for_ireland(max_pages: int = LUMA_MAX_PAGES) -> list[dict]:
	lat, lon = 53.3498, -7.2604
	cursor = None
	entries = []
	for _ in range(max_pages):
		params = {
			"pagination_limit": 100,
			"geo_latitude": lat,
			"geo_longitude": lon,
			"geo_radius_km": 500,
		}
		if cursor:
			params["pagination_cursor"] = cursor
		response = requests.get(LUMA_DISCOVER_URL, params=params, headers=LUMA_HEADERS, timeout=30)
		response.raise_for_status()
		data = response.json()
		entries.extend(data.get("entries", []))
		if not data.get("has_more"):
			break
		cursor = data.get("next_cursor")
		if not cursor:
			break
		time.sleep(0.25)

	parsed = []
	for entry in entries:
		normalized = normalise_luma_entry(entry)
		if not normalized:
			continue
		country_code = ((entry.get("event", {}).get("geo_address_info", {}) or {}).get("country_code") or "").upper()
		if country_code and country_code not in ("IE", "GB"):
			continue
		parsed.append(normalized)

	return deduplicate_events(parsed)


def refresh_events_from_luma(force: bool = False) -> bool:
	global EVENTS_LAST_REFRESH, EVENTS_LAST_ERROR, EVENTS_CACHE, EVENTS_REFRESH_IN_PROGRESS
	with EVENTS_LOCK:
		if EVENTS_REFRESH_IN_PROGRESS:
			return False
		if not force and EVENTS_LAST_REFRESH:
			last = parse_iso_datetime(EVENTS_LAST_REFRESH)
			if last and (datetime.now(timezone.utc) - last).total_seconds() < LUMA_REFRESH_INTERVAL_SECONDS:
				return False
		EVENTS_REFRESH_IN_PROGRESS = True

	try:
		luma_events = fetch_luma_events_for_ireland()
		disk_events = load_events_from_disk()
		merged = deduplicate_events(disk_events + luma_events)
		merged.sort(key=lambda e: ((e.get("date") or "9999-12-31"), e.get("time") or "23:59 UTC", e.get("name") or ""))
		save_events_to_disk(merged)
		with EVENTS_LOCK:
			EVENTS_CACHE = merged
			EVENTS_LAST_REFRESH = now_iso()
			EVENTS_LAST_ERROR = None
		return True
	except Exception as exc:
		with EVENTS_LOCK:
			EVENTS_LAST_ERROR = str(exc)
		return False
	finally:
		with EVENTS_LOCK:
			EVENTS_REFRESH_IN_PROGRESS = False


def events_refresh_loop() -> None:
	while True:
		refresh_events_from_luma(force=True)
		time.sleep(LUMA_REFRESH_INTERVAL_SECONDS)


def event_distance_km(event: dict, user_lat: Optional[float], user_lon: Optional[float]) -> Optional[float]:
	if user_lat is None or user_lon is None:
		return None
	lat = to_float(event.get("lat"))
	lon = to_float(event.get("lon"))
	if lat is None or lon is None:
		county = (event.get("county") or "").strip()
		if county in COUNTY_CENTROIDS:
			lat, lon = COUNTY_CENTROIDS[county]
		else:
			return None
	return round(haversine_km(user_lat, user_lon, lat, lon), 2)


def get_db() -> sqlite3.Connection:
	conn = sqlite3.connect(DB_PATH)
	conn.row_factory = sqlite3.Row
	return conn


def init_db() -> None:
	with DB_LOCK, get_db() as conn:
		conn.executescript(
			"""
			CREATE TABLE IF NOT EXISTS users (
				user_id TEXT PRIMARY KEY,
				coins INTEGER NOT NULL DEFAULT 0,
				streak INTEGER NOT NULL DEFAULT 0,
				last_redeem_date TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS pubs (
				pub_id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				nfc_url TEXT,
				photo_url TEXT,
				latitude REAL,
				longitude REAL,
				address TEXT,
				discount_rules TEXT,
				phrase_ga TEXT,
				phrase_en TEXT,
				pronunciation TEXT,
				events_json TEXT,
				badges_json TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS rewards_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL,
				pub_id TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				coins_awarded INTEGER NOT NULL,
				reason TEXT NOT NULL,
				device_fingerprint TEXT,
				fraud_flag INTEGER NOT NULL DEFAULT 0,
				FOREIGN KEY(user_id) REFERENCES users(user_id),
				FOREIGN KEY(pub_id) REFERENCES pubs(pub_id)
			);

			CREATE TABLE IF NOT EXISTS checkins (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL,
				pub_id TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				note TEXT,
				FOREIGN KEY(user_id) REFERENCES users(user_id),
				FOREIGN KEY(pub_id) REFERENCES pubs(pub_id)
			);

			CREATE INDEX IF NOT EXISTS idx_rewards_user_pub_time
				ON rewards_log(user_id, pub_id, timestamp DESC);
			CREATE INDEX IF NOT EXISTS idx_checkins_user_time
				ON checkins(user_id, timestamp DESC);
			"""
		)


def seed_pubs_if_missing() -> None:
	if not PUBS_FILE.exists():
		return

	with open(PUBS_FILE, "r", encoding="utf-8") as f:
		pubs = json.load(f)

	with DB_LOCK, get_db() as conn:
		existing = conn.execute("SELECT COUNT(*) AS count FROM pubs").fetchone()["count"]
		if existing > 0:
			return

		for idx, pub in enumerate(pubs):
			pub_id = pub.get("nfcTagId") or f"pub-{pub.get('id', idx)}"
			phrase_ga = "Pionta Guinness, le do thoil."
			phrase_en = "A pint of Guinness, please."
			pronunciation = "PUNT-ah GIN-iss, leh duh hull"
			events = [
				"Traditional music session tonight",
				"Live local folk on Fridays",
			]
			badges = ["Trad Session", "Craic Friendly"]
			created = now_iso()

			conn.execute(
				"""
				INSERT INTO pubs (
					pub_id, name, nfc_url, photo_url, latitude, longitude, address,
					discount_rules, phrase_ga, phrase_en, pronunciation, events_json,
					badges_json, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				""",
				(
					pub_id,
					pub.get("name", "Unnamed Pub"),
					f"https://wheresthecraic.app/redeem?pubID={pub_id}",
					pub.get("photoUrl") or "",
					pub.get("latitude"),
					pub.get("longitude"),
					pub.get("address") or "",
					json.dumps({"baseReward": BASE_REWARD, "cooldownMinutes": REDEEM_COOLDOWN_MINUTES}),
					phrase_ga,
					phrase_en,
					pronunciation,
					json.dumps(events),
					json.dumps(badges),
					created,
					created,
				),
			)


def ensure_user(conn: sqlite3.Connection, user_id: str) -> None:
	now = now_iso()
	conn.execute(
		"""
		INSERT INTO users (user_id, coins, streak, last_redeem_date, created_at, updated_at)
		VALUES (?, 0, 0, NULL, ?, ?)
		ON CONFLICT(user_id) DO NOTHING
		""",
		(user_id, now, now),
	)


def parse_json_field(raw: Optional[str], fallback):
	if not raw:
		return fallback
	try:
		return json.loads(raw)
	except json.JSONDecodeError:
		return fallback


def get_pub_or_404(conn: sqlite3.Connection, pub_id: str):
	row = conn.execute("SELECT * FROM pubs WHERE pub_id = ?", (pub_id,)).fetchone()
	if not row:
		return None
	return row


def calculate_streak(last_redeem_date: Optional[str]) -> tuple[int, str]:
	today = datetime.now(timezone.utc).date()
	today_str = today.isoformat()
	if not last_redeem_date:
		return 1, today_str

	try:
		last = datetime.fromisoformat(last_redeem_date).date()
	except ValueError:
		return 1, today_str

	if last == today:
		return -1, today_str
	if last == (today - timedelta(days=1)):
		return 2, today_str
	return 1, today_str


def validate_redeem(conn: sqlite3.Connection, user_id: str, pub_id: str):
	cutoff = (datetime.now(timezone.utc) - timedelta(minutes=REDEEM_COOLDOWN_MINUTES)).isoformat()
	recent = conn.execute(
		"""
		SELECT timestamp FROM rewards_log
		WHERE user_id = ? AND pub_id = ? AND reason = 'NFC_REDEEM' AND timestamp >= ?
		ORDER BY timestamp DESC LIMIT 1
		""",
		(user_id, pub_id, cutoff),
	).fetchone()
	if recent:
		return False, f"Cooldown active. Try again in {REDEEM_COOLDOWN_MINUTES} minutes."
	return True, ""


@app.route("/")
def index():
	return send_from_directory(str(ROOT), "index.html")


@app.route("/api/health")
def health():
	return jsonify({"ok": True, "time": now_iso()})


@app.route("/api/pubs", methods=["GET"])
def list_pubs():
	with get_db() as conn:
		rows = conn.execute(
			"SELECT pub_id, name, photo_url, latitude, longitude, address, nfc_url, badges_json FROM pubs ORDER BY name"
		).fetchall()

	pubs = [
		{
			"pubID": r["pub_id"],
			"name": r["name"],
			"photo": r["photo_url"],
			"latitude": r["latitude"],
			"longitude": r["longitude"],
			"address": r["address"],
			"nfcUrl": r["nfc_url"],
			"badges": parse_json_field(r["badges_json"], []),
		}
		for r in rows
	]
	return jsonify({"pubs": pubs})


@app.route("/api/pubs/<pub_id>", methods=["GET"])
def get_pub(pub_id: str):
	with get_db() as conn:
		row = get_pub_or_404(conn, pub_id)
		if not row:
			return jsonify({"error": "Pub not found"}), 404

		payload = {
			"pubID": row["pub_id"],
			"name": row["name"],
			"photo": row["photo_url"],
			"latitude": row["latitude"],
			"longitude": row["longitude"],
			"address": row["address"],
			"nfcUrl": row["nfc_url"],
			"discountRules": parse_json_field(row["discount_rules"], {}),
			"phrase": {
				"ga": row["phrase_ga"],
				"en": row["phrase_en"],
				"pronunciation": row["pronunciation"],
			},
			"events": parse_json_field(row["events_json"], []),
			"badges": parse_json_field(row["badges_json"], []),
		}
	return jsonify(payload)


@app.route("/api/checkins", methods=["POST"])
def create_checkin():
	body = request.get_json(silent=True) or {}
	user_id = (body.get("userID") or "demo-user").strip()
	pub_id = (body.get("pubID") or "").strip()
	note = (body.get("note") or "").strip()[:180]

	if not pub_id:
		return jsonify({"error": "pubID is required"}), 400

	with DB_LOCK, get_db() as conn:
		ensure_user(conn, user_id)
		pub = get_pub_or_404(conn, pub_id)
		if not pub:
			return jsonify({"error": "Pub not found"}), 404

		ts = now_iso()
		conn.execute(
			"INSERT INTO checkins (user_id, pub_id, timestamp, note) VALUES (?, ?, ?, ?)",
			(user_id, pub_id, ts, note),
		)

	return jsonify({"ok": True, "userID": user_id, "pubID": pub_id, "timestamp": ts})


@app.route("/api/redeem", methods=["POST"])
def redeem():
	body = request.get_json(silent=True) or {}
	user_id = (body.get("userID") or "demo-user").strip()
	pub_id = (body.get("pubID") or "").strip()
	device_fingerprint = (body.get("deviceFingerprint") or "").strip()[:120]

	if not pub_id:
		return jsonify({"error": "pubID is required"}), 400

	with DB_LOCK, get_db() as conn:
		ensure_user(conn, user_id)
		pub = get_pub_or_404(conn, pub_id)
		if not pub:
			return jsonify({"error": "Pub not found"}), 404

		allowed, reason = validate_redeem(conn, user_id, pub_id)
		if not allowed:
			return jsonify({"ok": False, "error": reason, "awarded": 0}), 429

		user = conn.execute(
			"SELECT coins, streak, last_redeem_date FROM users WHERE user_id = ?",
			(user_id,),
		).fetchone()

		streak_delta, today_str = calculate_streak(user["last_redeem_date"])
		streak = user["streak"]
		if streak_delta == -1:
			streak = max(1, streak)
		elif streak_delta == 2:
			streak = streak + 1 if streak > 0 else 2
		else:
			streak = 1

		new_coins = user["coins"] + BASE_REWARD
		ts = now_iso()
		conn.execute(
			"""
			INSERT INTO rewards_log (user_id, pub_id, timestamp, coins_awarded, reason, device_fingerprint, fraud_flag)
			VALUES (?, ?, ?, ?, 'NFC_REDEEM', ?, 0)
			""",
			(user_id, pub_id, ts, BASE_REWARD, device_fingerprint),
		)
		conn.execute(
			"""
			UPDATE users
			SET coins = ?, streak = ?, last_redeem_date = ?, updated_at = ?
			WHERE user_id = ?
			""",
			(new_coins, streak, today_str, ts, user_id),
		)

	return jsonify(
		{
			"ok": True,
			"userID": user_id,
			"pub": {"pubID": pub["pub_id"], "name": pub["name"]},
			"awarded": BASE_REWARD,
			"balance": new_coins,
			"streak": streak,
			"message": "CraicCoins awarded",
			"fraud": {
				"status": "placeholder",
				"notes": "Rate-limit and device/IP scoring hooks are ready for production logic.",
			},
		}
	)


@app.route("/api/wallet/<user_id>", methods=["GET"])
def wallet(user_id: str):
	with get_db() as conn:
		ensure_user(conn, user_id)
		user = conn.execute(
			"SELECT user_id, coins, streak FROM users WHERE user_id = ?",
			(user_id,),
		).fetchone()
		rewards = conn.execute(
			"""
			SELECT r.timestamp, r.coins_awarded, p.name AS pub_name, r.pub_id
			FROM rewards_log r
			JOIN pubs p ON p.pub_id = r.pub_id
			WHERE r.user_id = ?
			ORDER BY r.timestamp DESC
			LIMIT 50
			""",
			(user_id,),
		).fetchall()
		checkins = conn.execute(
			"""
			SELECT c.timestamp, c.pub_id, p.name AS pub_name
			FROM checkins c
			JOIN pubs p ON p.pub_id = c.pub_id
			WHERE c.user_id = ?
			ORDER BY c.timestamp DESC
			LIMIT 50
			""",
			(user_id,),
		).fetchall()

	return jsonify(
		{
			"userID": user["user_id"],
			"coins": user["coins"],
			"streak": user["streak"],
			"history": [
				{
					"timestamp": row["timestamp"],
					"pubID": row["pub_id"],
					"pubName": row["pub_name"],
					"coinsAwarded": row["coins_awarded"],
				}
				for row in rewards
			],
			"checkins": [
				{
					"timestamp": row["timestamp"],
					"pubID": row["pub_id"],
					"pubName": row["pub_name"],
				}
				for row in checkins
			],
		}
	)


@app.route("/api/dashboard/pub/<pub_id>/metrics", methods=["GET"])
def pub_dashboard(pub_id: str):
	with get_db() as conn:
		pub = get_pub_or_404(conn, pub_id)
		if not pub:
			return jsonify({"error": "Pub not found"}), 404

		summary = conn.execute(
			"""
			SELECT
			  COUNT(*) AS redemptions,
			  COALESCE(SUM(coins_awarded), 0) AS total_coins,
			  COUNT(DISTINCT user_id) AS unique_users
			FROM rewards_log
			WHERE pub_id = ?
			""",
			(pub_id,),
		).fetchone()

		checkin_count = conn.execute(
			"SELECT COUNT(*) AS count FROM checkins WHERE pub_id = ?",
			(pub_id,),
		).fetchone()["count"]

	return jsonify(
		{
			"pubID": pub_id,
			"name": pub["name"],
			"metrics": {
				"redemptions": summary["redemptions"],
				"totalCoinsAwarded": summary["total_coins"],
				"uniqueUsers": summary["unique_users"],
				"checkins": checkin_count,
			},
		}
	)


@app.route("/data")
def get_data():
	if not INPUT_CSV.exists():
		return jsonify({"type": "FeatureCollection", "features": []})

	enriched = {}
	if CHECKPOINT_FILE.exists():
		with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
			try:
				enriched = json.load(f)
			except json.JSONDecodeError:
				enriched = {}

	features = []
	with open(INPUT_CSV, mode="r", encoding="utf-8") as f:
		reader = csv.DictReader(f)
		for row in reader:
			place_id = f"{row['name']}_{row['lat']}_{row['lon']}"
			if place_id not in enriched:
				continue
			culture = enriched[place_id]
			features.append(
				{
					"type": "Feature",
					"geometry": {
						"type": "Point",
						"coordinates": [float(row["lon"]), float(row["lat"])],
					},
					"properties": {
						"name": row["name"],
						"name_ga": row.get("name_ga") or row["name"],
						"county": row.get("county") or "Ireland",
						"type": row.get("type") or "place",
						**culture,
					},
				}
			)
	return jsonify({"type": "FeatureCollection", "features": features})


@app.route("/events")
def get_events():
	global EVENTS_CACHE
	lat = to_float(request.args.get("lat"))
	lon = to_float(request.args.get("lon"))
	limit = int(request.args.get("limit", "50"))
	limit = max(1, min(limit, 300))
	irish_only = (request.args.get("irish_only", "0").strip().lower() in {"1", "true", "yes", "on"})
	force_refresh = (request.args.get("refresh", "0").strip().lower() in {"1", "true", "yes", "on"})

	with EVENTS_LOCK:
		cached = list(EVENTS_CACHE)
		last_refresh = EVENTS_LAST_REFRESH
		last_error = EVENTS_LAST_ERROR
		in_progress = EVENTS_REFRESH_IN_PROGRESS

	if not cached:
		cached = load_events_from_disk()
		with EVENTS_LOCK:
			EVENTS_CACHE = list(cached)

	# Opportunistic refresh trigger if stale; do not block requests.
	if not in_progress:
		threading.Thread(target=refresh_events_from_luma, kwargs={"force": force_refresh}, daemon=True).start()

	now = datetime.now(timezone.utc)
	filtered = []
	for event in cached:
		if irish_only and not is_irish_focused_event(event):
			continue
		event_dt = parse_event_datetime(event)
		if event_dt and event_dt < (now - timedelta(days=1)):
			continue
		distance_km = event_distance_km(event, lat, lon)
		item = dict(event)
		item["distance_km"] = distance_km
		item["irish_focus"] = is_irish_focused_event(event)
		filtered.append(item)

	def rank_key(event: dict):
		event_dt = parse_event_datetime(event)
		is_upcoming = event_dt is None or event_dt >= now
		distance = event.get("distance_km")
		return (
			0 if is_upcoming else 1,
			distance if distance is not None else 999999.0,
			event_dt or datetime.max.replace(tzinfo=timezone.utc),
			event.get("name") or "",
		)

	filtered.sort(key=rank_key)
	result = filtered[:limit]

	return jsonify(
		{
			"scraped_at": last_refresh or now_iso(),
			"total": len(result),
			"available_total": len(filtered),
			"events": result,
			"meta": {
				"lat": lat,
				"lon": lon,
				"irish_only": irish_only,
				"force_refresh_requested": force_refresh,
				"refresh_in_progress": in_progress,
				"last_error": last_error,
			},
		}
	)


if __name__ == "__main__":
	init_db()
	seed_pubs_if_missing()
	try:
		EVENTS_CACHE = load_events_from_disk()
	except Exception:
		EVENTS_CACHE = []
	threading.Thread(target=events_refresh_loop, daemon=True).start()
	app.run(host="0.0.0.0", port=5001, debug=True)
