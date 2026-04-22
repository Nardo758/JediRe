-- ============================================================================
-- 20260422_variance_items.sql
-- Variance line items extracted from BPI Variance Reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_variance_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  report_month    DATE NOT NULL,
  
  -- Line item details
  line_item       TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL, -- 'revenue', 'other_income', 'payroll', etc.
  
  -- Current month
  actual          NUMERIC(15,2),
  budget          NUMERIC(15,2),
  variance        NUMERIC(15,2),
  variance_pct    NUMERIC(8,4),
  variance_type   VARCHAR(20) DEFAULT 'neutral', -- 'favorable', 'unfavorable', 'neutral'
  
  -- Year to date
  ytd_actual      NUMERIC(15,2),
  ytd_budget      NUMERIC(15,2),
  ytd_variance    NUMERIC(15,2),
  ytd_variance_pct NUMERIC(8,4),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(deal_id, report_month, line_item)
);

CREATE INDEX idx_variance_deal ON deal_variance_items(deal_id);
CREATE INDEX idx_variance_month ON deal_variance_items(deal_id, report_month);
CREATE INDEX idx_variance_category ON deal_variance_items(category);

-- Variance summary view
CREATE OR REPLACE VIEW v_deal_variance_summary AS
SELECT 
  deal_id,
  report_month,
  
  -- Revenue variance
  SUM(CASE WHEN category IN ('revenue', 'other_income') THEN actual ELSE 0 END) AS revenue_actual,
  SUM(CASE WHEN category IN ('revenue', 'other_income') THEN budget ELSE 0 END) AS revenue_budget,
  SUM(CASE WHEN category IN ('revenue', 'other_income') THEN variance ELSE 0 END) AS revenue_variance,
  
  -- Expense variance
  SUM(CASE WHEN category NOT IN ('revenue', 'other_income', 'noi', 'cash_flow') THEN actual ELSE 0 END) AS expense_actual,
  SUM(CASE WHEN category NOT IN ('revenue', 'other_income', 'noi', 'cash_flow') THEN budget ELSE 0 END) AS expense_budget,
  SUM(CASE WHEN category NOT IN ('revenue', 'other_income', 'noi', 'cash_flow') THEN variance ELSE 0 END) AS expense_variance,
  
  -- Counts
  COUNT(*) FILTER (WHERE variance_type = 'favorable') AS favorable_count,
  COUNT(*) FILTER (WHERE variance_type = 'unfavorable') AS unfavorable_count,
  COUNT(*) FILTER (WHERE variance_type = 'neutral') AS neutral_count,
  
  -- Top variances
  (
    SELECT array_agg(line_item ORDER BY ABS(variance) DESC)
    FROM deal_variance_items dv2
    WHERE dv2.deal_id = deal_variance_items.deal_id 
      AND dv2.report_month = deal_variance_items.report_month
      AND dv2.variance_type = 'unfavorable'
    LIMIT 5
  ) AS top_unfavorable_items

FROM deal_variance_items
GROUP BY deal_id, report_month;
