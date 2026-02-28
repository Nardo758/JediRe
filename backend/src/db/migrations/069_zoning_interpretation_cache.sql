CREATE TABLE IF NOT EXISTS zoning_code_interpretations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zoning_code VARCHAR(50) NOT NULL,
  municipality VARCHAR(255) NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'GA',
  constraints JSONB NOT NULL DEFAULT '{}',
  ai_insight TEXT,
  source VARCHAR(50),
  confidence VARCHAR(20) DEFAULT 'medium',
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zoning_interpretations_unique
  ON zoning_code_interpretations (UPPER(zoning_code), UPPER(municipality), UPPER(state));

CREATE INDEX IF NOT EXISTS idx_zoning_interpretations_lookup
  ON zoning_code_interpretations (UPPER(zoning_code), UPPER(municipality));

CREATE INDEX IF NOT EXISTS idx_zoning_interpretations_expires
  ON zoning_code_interpretations (expires_at);

CREATE TABLE IF NOT EXISTS zoning_ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_set_key VARCHAR(500) NOT NULL,
  municipality VARCHAR(255) NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'GA',
  insights JSONB NOT NULL DEFAULT '{}',
  summary TEXT,
  extra_rows JSONB DEFAULT '[]',
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analysis_cache_unique
  ON zoning_ai_analysis_cache (code_set_key, UPPER(municipality), UPPER(state));

CREATE INDEX IF NOT EXISTS idx_ai_analysis_cache_expires
  ON zoning_ai_analysis_cache (expires_at);
