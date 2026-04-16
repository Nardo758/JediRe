CREATE TABLE IF NOT EXISTS deal_traffic_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  signing_velocity JSONB,
  seasonality_curve JSONB,
  expiration_waterfall JSONB,
  velocity_variance JSONB,
  lease_term_distribution JSONB,
  trade_out_analytics JSONB,
  mtm_exposure JSONB,
  conversion_funnel JSONB,
  summary JSONB,
  source_document_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_snap_deal ON deal_traffic_snapshots(deal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_snap_deal_date ON deal_traffic_snapshots(deal_id, snapshot_date);
