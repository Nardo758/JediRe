-- ═══════════════════════════════════════════════════════════════
-- JEDI RE — Archive Deals Storage
-- Migration 085: Archived Deal Management & Historical Intelligence
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- Archived Deals
-- Stores closed/passed deals with outcome data for learning
-- ───────────────────────────────────────────────────────────────

CREATE TABLE archived_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Original deal reference
  original_deal_id UUID,  -- Reference to deal_capsules if still exists
  deal_name VARCHAR(255) NOT NULL,
  property_address TEXT,
  property_city VARCHAR(255),
  property_state VARCHAR(2),
  property_type VARCHAR(100),
  
  -- Archive details
  archive_reason VARCHAR(50) NOT NULL CHECK (archive_reason IN (
    'closed_purchased',
    'closed_sold',
    'passed_pricing',
    'passed_zoning',
    'passed_market',
    'passed_timeline',
    'passed_other',
    'lost_to_competition'
  )),
  
  archive_date TIMESTAMPTZ DEFAULT NOW(),
  archived_by_user_id UUID,
  
  -- Outcome data (for closed deals)
  actual_purchase_price NUMERIC(15, 2),
  actual_close_date DATE,
  actual_timeline_days INTEGER,
  
  -- Projections vs Actuals (for learning)
  projected_noi NUMERIC(15, 2),
  actual_noi NUMERIC(15, 2),
  projected_cap_rate FLOAT,
  actual_cap_rate FLOAT,
  projected_irr FLOAT,
  actual_irr FLOAT,
  
  -- What we learned
  lessons_learned TEXT,
  what_worked TEXT,
  what_didnt_work TEXT,
  would_we_do_again BOOLEAN,
  
  -- Archive metadata
  snapshot_data JSONB,
  -- Complete deal data at time of archive
  
  documents_archived INTEGER DEFAULT 0,
  document_storage_path TEXT,
  -- S3/storage path for archived docs
  
  -- Intelligence flags
  use_for_training BOOLEAN DEFAULT true,
  -- Should this deal be used to train agents?
  
  comparable_to_future_deals BOOLEAN DEFAULT true,
  -- Can this be used as a comp?
  
  retention_expires_at TIMESTAMPTZ,
  -- When to permanently delete (e.g., 7 years for compliance)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_archived_deals_city ON archived_deals (property_city);
CREATE INDEX idx_archived_deals_type ON archived_deals (property_type);
CREATE INDEX idx_archived_deals_reason ON archived_deals (archive_reason);
CREATE INDEX idx_archived_deals_date ON archived_deals (archive_date DESC);
CREATE INDEX idx_archived_deals_training ON archived_deals (use_for_training) WHERE use_for_training = true;
CREATE INDEX idx_archived_deals_comparable ON archived_deals (comparable_to_future_deals) WHERE comparable_to_future_deals = true;

-- ───────────────────────────────────────────────────────────────
-- Archive Deal Documents
-- Links archived deals to their documents in unified_documents
-- ───────────────────────────────────────────────────────────────

ALTER TABLE unified_documents
  ADD COLUMN archived_deal_id UUID REFERENCES archived_deals(id);

CREATE INDEX idx_unified_docs_archived_deal ON unified_documents (archived_deal_id) WHERE archived_deal_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────
-- Archive Statistics
-- Track what documents were preserved with each archive
-- ───────────────────────────────────────────────────────────────

CREATE TABLE archive_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_deal_id UUID NOT NULL REFERENCES archived_deals(id) ON DELETE CASCADE,
  
  -- Document counts by category
  documents_by_category JSONB DEFAULT '{}',
  -- { "OM": 1, "T12": 1, "RENT_ROLL": 2, "APPRAISAL": 1, ... }
  
  -- Intelligence value
  total_embeddings INTEGER DEFAULT 0,
  total_relationships INTEGER DEFAULT 0,
  total_agent_tasks INTEGER DEFAULT 0,
  
  -- Storage info
  total_storage_mb NUMERIC(10, 2),
  compressed_storage_mb NUMERIC(10, 2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(archived_deal_id)
);

-- ───────────────────────────────────────────────────────────────
-- Historical Outcomes (for agent learning)
-- Stores deal outcomes for pattern learning
-- ───────────────────────────────────────────────────────────────

CREATE TABLE deal_historical_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  archived_deal_id UUID NOT NULL REFERENCES archived_deals(id) ON DELETE CASCADE,
  
  -- Original predictions (from agents)
  predicted_outcome VARCHAR(50),
  predicted_confidence FLOAT,
  predicted_by_agent VARCHAR(100),
  predicted_at TIMESTAMPTZ,
  
  -- Actual outcome
  actual_outcome VARCHAR(50) NOT NULL,
  outcome_date DATE NOT NULL,
  
  -- Variance analysis
  prediction_accuracy FLOAT,
  -- 0-1 score: how accurate was the prediction?
  
  variance_factors JSONB,
  -- { "market_shift": true, "zoning_delay": false, "competition": true }
  
  -- Learning data
  key_factors TEXT[],
  -- Factors that influenced outcome
  
  recommended_model_adjustments JSONB,
  -- Suggested improvements to agent models
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outcomes_archived_deal ON deal_historical_outcomes (archived_deal_id);
CREATE INDEX idx_outcomes_agent ON deal_historical_outcomes (predicted_by_agent);
CREATE INDEX idx_outcomes_accuracy ON deal_historical_outcomes (prediction_accuracy DESC);

-- ───────────────────────────────────────────────────────────────
-- Archive Helper Functions
-- ───────────────────────────────────────────────────────────────

-- Function to count documents by category for an archived deal
CREATE OR REPLACE FUNCTION count_archived_deal_documents(p_archived_deal_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_object_agg(category_code, doc_count)
  INTO result
  FROM (
    SELECT 
      COALESCE(category_code, 'uncategorized') as category_code,
      COUNT(*) as doc_count
    FROM unified_documents
    WHERE archived_deal_id = p_archived_deal_id
    GROUP BY category_code
  ) counts;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to find comparable archived deals
CREATE OR REPLACE FUNCTION find_comparable_archived_deals(
  p_property_city VARCHAR,
  p_property_type VARCHAR,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  deal_name VARCHAR,
  property_address TEXT,
  archive_reason VARCHAR,
  actual_purchase_price NUMERIC,
  actual_cap_rate FLOAT,
  archive_date TIMESTAMPTZ,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ad.id,
    ad.deal_name,
    ad.property_address,
    ad.archive_reason,
    ad.actual_purchase_price,
    ad.actual_cap_rate,
    ad.archive_date,
    -- Simple similarity: city match = 0.5, type match = 0.5
    (CASE WHEN ad.property_city ILIKE p_property_city THEN 0.5 ELSE 0 END +
     CASE WHEN ad.property_type ILIKE p_property_type THEN 0.5 ELSE 0 END) as similarity_score
  FROM archived_deals ad
  WHERE ad.comparable_to_future_deals = true
    AND (ad.property_city ILIKE p_property_city OR ad.property_type ILIKE p_property_type)
  ORDER BY similarity_score DESC, archive_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────
-- Trigger: Auto-update archive statistics
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_archive_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats for the new archived deal
  IF NEW.archived_deal_id IS NOT NULL THEN
    UPDATE archived_deals
    SET documents_archived = (
      SELECT COUNT(*) 
      FROM unified_documents 
      WHERE archived_deal_id = NEW.archived_deal_id
    )
    WHERE id = NEW.archived_deal_id;
    
    INSERT INTO archive_statistics (archived_deal_id, documents_by_category, total_embeddings)
    SELECT 
      NEW.archived_deal_id,
      count_archived_deal_documents(NEW.archived_deal_id),
      COUNT(content_embedding)
    FROM unified_documents
    WHERE archived_deal_id = NEW.archived_deal_id
    ON CONFLICT (archived_deal_id) DO UPDATE SET
      documents_by_category = EXCLUDED.documents_by_category,
      total_embeddings = EXCLUDED.total_embeddings;
  END IF;

  -- Recalculate stats for the old archived deal when document is moved or unarchived
  IF TG_OP = 'UPDATE' 
    AND OLD.archived_deal_id IS NOT NULL 
    AND OLD.archived_deal_id IS DISTINCT FROM NEW.archived_deal_id THEN
    UPDATE archived_deals
    SET documents_archived = (
      SELECT COUNT(*) 
      FROM unified_documents 
      WHERE archived_deal_id = OLD.archived_deal_id
    )
    WHERE id = OLD.archived_deal_id;
    
    UPDATE archive_statistics
    SET 
      documents_by_category = count_archived_deal_documents(OLD.archived_deal_id),
      total_embeddings = (
        SELECT COUNT(content_embedding) 
        FROM unified_documents 
        WHERE archived_deal_id = OLD.archived_deal_id
      )
    WHERE archived_deal_id = OLD.archived_deal_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_archive_stats
  AFTER INSERT OR UPDATE ON unified_documents
  FOR EACH ROW
  WHEN (NEW.archived_deal_id IS NOT NULL 
    OR (OLD IS NOT NULL AND OLD.archived_deal_id IS NOT NULL))
  EXECUTE FUNCTION update_archive_statistics();

COMMENT ON TABLE archived_deals IS 'Closed or passed deals with outcome data for historical intelligence';
COMMENT ON TABLE deal_historical_outcomes IS 'Prediction vs actual outcomes for agent learning';
COMMENT ON COLUMN archived_deals.use_for_training IS 'Include in agent training datasets';
COMMENT ON COLUMN archived_deals.snapshot_data IS 'Complete deal state at time of archive (JSONB)';
COMMENT ON FUNCTION find_comparable_archived_deals IS 'Find similar past deals for comparison';
