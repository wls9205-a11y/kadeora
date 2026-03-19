-- #14 apt_cache table
CREATE TABLE IF NOT EXISTS apt_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_type text NOT NULL,
  data jsonb NOT NULL,
  refreshed_at timestamptz DEFAULT now(),
  refreshed_by uuid REFERENCES profiles(id)
);

CREATE UNIQUE INDEX idx_apt_cache_type ON apt_cache(cache_type);
