-- Migration: deal_monthly_assumptions
-- Date: 2026-05-05
-- Description: Per-field, per-absolute-month user override table for deals.
-- Backs Section 5A (M07 traffic signals) and the LEASING sub-tab monthly
-- schedule editor — both spanning the full hold period at monthly granularity.
-- abs_month is 1-based (Month 1 = first month after close).

CREATE TABLE IF NOT EXISTS deal_monthly_assumptions (
  id           BIGSERIAL   PRIMARY KEY,
  deal_id      UUID        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_key    TEXT        NOT NULL,
  abs_month    INTEGER     NOT NULL CHECK (abs_month >= 1 AND abs_month <= 120),
  value        TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dma UNIQUE (deal_id, field_key, abs_month)
);

CREATE INDEX IF NOT EXISTS idx_dma_deal ON deal_monthly_assumptions (deal_id);
CREATE INDEX IF NOT EXISTS idx_dma_deal_field ON deal_monthly_assumptions (deal_id, field_key);
