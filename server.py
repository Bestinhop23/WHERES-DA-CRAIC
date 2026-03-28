import csv
import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

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

DB_LOCK = threading.Lock()
REDEEM_COOLDOWN_MINUTES = 30
BASE_REWARD = 20


def now_iso() -> str:
	return datetime.now(timezone.utc).isoformat()


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
	if not EVENTS_FILE.exists():
		return jsonify({"events": []})
	with open(EVENTS_FILE, "r", encoding="utf-8") as f:
		return jsonify(json.load(f))


if __name__ == "__main__":
	init_db()
	seed_pubs_if_missing()
	app.run(host="0.0.0.0", port=5001, debug=True)
