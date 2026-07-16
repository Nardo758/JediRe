-- Migration: loan_quotes table
-- Org-scoped loan quote storage with JSONB for matrix/adjustments.
-- Lane B privacy: quotes never cross orgs.
--
-- Depends on: organizations table (for org_id FK)

CREATE TABLE IF NOT EXISTS loan_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lender VARCHAR(255) NOT NULL,
  program VARCHAR(255) NOT NULL,
  quote_date DATE NOT NULL,
  expires DATE NOT NULL,
  index_basis VARCHAR(50) NOT NULL,
  rate_type VARCHAR(10) NOT NULL CHECK (rate_type IN ('fixed', 'floating')),
  spread_matrix JSONB NOT NULL DEFAULT '{}',
  adjustments JSONB NOT NULL DEFAULT '[]',
  prepay_structure JSONB NOT NULL DEFAULT '{}',
  broker_claims JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for org-scoped queries and stale-quote sweep
CREATE INDEX IF NOT EXISTS idx_loan_quotes_org_id ON loan_quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_loan_quotes_org_lender ON loan_quotes(org_id, lender);
CREATE INDEX IF NOT EXISTS idx_loan_quotes_org_program ON loan_quotes(org_id, program);
CREATE INDEX IF NOT EXISTS idx_loan_quotes_expires ON loan_quotes(expires);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_loan_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loan_quotes_updated_at ON loan_quotes;
CREATE TRIGGER trg_loan_quotes_updated_at
  BEFORE UPDATE ON loan_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_loan_quotes_updated_at();
