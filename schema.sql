-- Referencia. El Worker crea y completa estas tablas solo la primera vez que se usa el panel,
-- no hace falta ejecutar este archivo a mano.
CREATE TABLE IF NOT EXISTS sc_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'facebook',
  destination_type TEXT NOT NULL DEFAULT 'group',
  destination_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sc_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT,
  end_date TEXT
);

CREATE TABLE IF NOT EXISTS sc_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  destination_id INTEGER,
  scheduled_at TEXT,               -- UTC ISO-8601
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | ready | running | done | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TEXT,
  finished_at TEXT,
  post_note TEXT
);

CREATE TABLE IF NOT EXISTS sc_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,              -- base64
  thumb TEXT,
  size INTEGER
);

CREATE TABLE IF NOT EXISTS sc_kv (k TEXT PRIMARY KEY, v TEXT);
