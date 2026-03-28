-- Craic demo schema (Postgres-flavored SQL)
-- Use this as the production migration baseline.

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  coins INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_redeem_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pubs (
  pub_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nfc_url TEXT UNIQUE,
  photo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  discount_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  phrase_ga TEXT,
  phrase_en TEXT,
  pronunciation TEXT,
  events_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  badges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rewards_log (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL REFERENCES pubs(pub_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coins_awarded INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'NFC_REDEEM',
  device_fingerprint TEXT,
  fraud_flag BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS checkins (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  pub_id TEXT NOT NULL REFERENCES pubs(pub_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_rewards_log_user_pub_time
  ON rewards_log (user_id, pub_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_user_time
  ON checkins (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_rewards_log_pub_time
  ON rewards_log (pub_id, timestamp DESC);
