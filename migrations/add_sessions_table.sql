-- Refresh-token sessions. Safe to run on a new database.
CREATE TABLE IF NOT EXISTS sessions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  refresh_token_hash TEXT NOT NULL UNIQUE,
  device_info        TEXT NOT NULL DEFAULT '',
  ip_address         TEXT NOT NULL DEFAULT '',
  expires_at         DATETIME NOT NULL,
  is_active          INTEGER NOT NULL DEFAULT 1,
  last_activity      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active, expires_at);
