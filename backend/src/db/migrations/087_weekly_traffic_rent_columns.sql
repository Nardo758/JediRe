ALTER TABLE weekly_traffic_snapshots
  ADD COLUMN IF NOT EXISTS avg_market_rent DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS gross_market_rent DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS gross_rent_psf DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS effective_rent DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS effective_rent_psf DECIMAL(6,2);
