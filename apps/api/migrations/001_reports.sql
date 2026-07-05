CREATE TABLE IF NOT EXISTS sentinel_reports (
  id text PRIMARY KEY,
  user_address text,
  created_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS sentinel_reports_created_at_idx
  ON sentinel_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS sentinel_reports_user_address_idx
  ON sentinel_reports (user_address, created_at DESC);
