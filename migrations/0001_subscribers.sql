-- Migration number: 0001 	 newsletter subscribers + per-IP rate limit
-- Apply: npx wrangler d1 migrations apply nicholascharriere-subscribers --remote

CREATE TABLE IF NOT EXISTS subscribers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL UNIQUE,           -- trimmed + lowercased by the function
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),  -- UTC, "YYYY-MM-DD HH:MM:SS"
  source_path TEXT,                              -- page the form was submitted from, e.g. /blog/foo
  user_agent  TEXT,                              -- truncated to 512 chars
  country     TEXT                               -- CF-IPCountry, e.g. US
);

-- Fixed-window request counter for POST /api/subscribe.
-- ip_hash is SHA-256 of the client IP (no raw IPs stored); bucket = floor(unix_seconds / 600).
-- Rows older than the previous bucket are deleted on each request.
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT    NOT NULL,
  bucket  INTEGER NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, bucket)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS rate_limits_bucket ON rate_limits (bucket);
