CREATE TABLE IF NOT EXISTS saved_colleges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, college_id)
);

CREATE INDEX IF NOT EXISTS saved_colleges_user_idx ON saved_colleges(user_id);
