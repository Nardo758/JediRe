-- Migration: Module System
-- Description: Add tables for user module settings and module definitions
-- Date: 2026-02-09

-- User module settings (global per user)
CREATE TABLE IF NOT EXISTS user_module_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_slug     TEXT NOT NULL,
  enabled         BOOLEAN DEFAULT true,
  subscribed      BOOLEAN DEFAULT false,
  bundle_id       TEXT,
  activated_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, module_slug)
);

CREATE INDEX idx_user_module_settings_user ON user_module_settings(user_id);
CREATE INDEX idx_user_module_settings_enabled ON user_module_settings(user_id, enabled) WHERE enabled = true;

-- Module definitions (static config)
CREATE TABLE IF NOT EXISTS module_definitions (
  slug            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  description     TEXT,
  price_monthly   INTEGER,  -- cents (e.g., 3400 = $34.00)
  is_free         BOOLEAN DEFAULT false,
  bundles         TEXT[],   -- e.g., ARRAY['flipper', 'developer', 'portfolio']
  icon            TEXT,
  enhances        TEXT[],   -- e.g., ARRAY['Financial Analysis section']
  sort_order      INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_module_definitions_category ON module_definitions(category);
CREATE INDEX idx_module_definitions_bundles ON module_definitions USING GIN(bundles);

-- Deal module suggestions (auto-suggested on deal creation)
CREATE TABLE IF NOT EXISTS deal_module_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  module_slug     TEXT NOT NULL,
  suggested_at    TIMESTAMP DEFAULT NOW(),
  activated       BOOLEAN DEFAULT false,
  activated_at    TIMESTAMP,
  dismissed       BOOLEAN DEFAULT false,
  UNIQUE(deal_id, module_slug)
);

CREATE INDEX idx_deal_module_suggestions_deal ON deal_module_suggestions(deal_id);

-- Module-specific data tables

-- Financial Modeling Pro
CREATE TABLE IF NOT EXISTS financial_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  name            TEXT,
  version         INTEGER DEFAULT 1,
  components      JSONB DEFAULT '[]'::jsonb,
  assumptions     JSONB DEFAULT '{}'::jsonb,
  results         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_financial_models_deal ON financial_models(deal_id);
CREATE INDEX idx_financial_models_user ON financial_models(user_id);

-- Strategy Arbitrage
CREATE TABLE IF NOT EXISTS strategy_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  strategy_slug   TEXT NOT NULL,
  assumptions     JSONB DEFAULT '{}'::jsonb,
  roi_metrics     JSONB DEFAULT '{}'::jsonb,
  risk_score      DECIMAL(3,2),
  recommended     BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strategy_analyses_deal ON strategy_analyses(deal_id);

-- Due Diligence Suite
CREATE TABLE IF NOT EXISTS dd_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  checklist_type  TEXT NOT NULL,
  tasks           JSONB DEFAULT '[]'::jsonb,
  completion_pct  DECIMAL(5,2) DEFAULT 0,
  risk_score      DECIMAL(3,2),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dd_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES dd_checklists(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  category        TEXT,
  priority        TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status          TEXT CHECK (status IN ('pending', 'in_progress', 'complete', 'blocked')),
  due_date        DATE,
  assigned_to     UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  completed_at    TIMESTAMP
);

CREATE INDEX idx_dd_checklists_deal ON dd_checklists(deal_id);
CREATE INDEX idx_dd_tasks_checklist ON dd_tasks(checklist_id);
CREATE INDEX idx_dd_tasks_assigned ON dd_tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_module_settings_updated_at
  BEFORE UPDATE ON user_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_models_updated_at
  BEFORE UPDATE ON financial_models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_analyses_updated_at
  BEFORE UPDATE ON strategy_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dd_checklists_updated_at
  BEFORE UPDATE ON dd_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
