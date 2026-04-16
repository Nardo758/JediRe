-- TASKS DATABASE MIGRATION
-- Replace in-memory task storage with proper database table
-- 
-- Run in Replit: psql $DATABASE_URL < this_file.sql

-- ============================================================================
-- Tasks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  
  -- Relationships
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  email_id VARCHAR(255),  -- Gmail message ID
  
  -- Assignment
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  source VARCHAR(50) DEFAULT 'manual', -- manual, email_ai, stage_transition, agent, system
  source_ref VARCHAR(255), -- Reference to source (email ID, agent code, etc.)
  blocked_reason TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Stage automation
  stage_id VARCHAR(50), -- Deal stage that triggered this task
  is_stage_required BOOLEAN DEFAULT FALSE, -- Must complete to advance stage
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage_id) WHERE stage_id IS NOT NULL;

-- ============================================================================
-- Stage Task Templates
-- ============================================================================
-- Define required tasks per deal stage

CREATE TABLE IF NOT EXISTS stage_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  stage_id VARCHAR(50) NOT NULL, -- SOURCING, QUALIFICATION, LOI, DUE_DILIGENCE, CONTRACT, CLOSING
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  
  -- Timing
  days_from_stage_start INTEGER DEFAULT 0, -- Due date = stage start + this many days
  is_required BOOLEAN DEFAULT TRUE, -- Blocks stage advancement
  
  -- Ordering
  sequence INTEGER DEFAULT 0,
  
  -- Property type specific (optional)
  property_type VARCHAR(50), -- NULL = all types
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint per stage + title
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_templates_unique 
  ON stage_task_templates(stage_id, title) WHERE property_type IS NULL;

-- ============================================================================
-- Seed Default Stage Templates
-- ============================================================================

INSERT INTO stage_task_templates (stage_id, title, description, category, priority, days_from_stage_start, is_required, sequence) VALUES
-- QUALIFICATION Stage
('QUALIFICATION', 'Initial site visit', 'Schedule and complete first property walkthrough', 'due_diligence', 'high', 3, true, 1),
('QUALIFICATION', 'Review rent roll', 'Analyze current rent roll for income verification', 'analysis', 'high', 5, true, 2),
('QUALIFICATION', 'Preliminary market analysis', 'Assess submarket fundamentals and competition', 'analysis', 'medium', 7, true, 3),
('QUALIFICATION', 'Confirm zoning compliance', 'Verify current use is permitted under zoning', 'legal', 'high', 5, true, 4),

-- LOI Stage
('LOI', 'Draft LOI terms', 'Prepare Letter of Intent with proposed terms', 'legal', 'high', 2, true, 1),
('LOI', 'Internal investment committee review', 'Present deal to IC for approval', 'approval', 'high', 5, true, 2),
('LOI', 'Submit LOI to seller', 'Deliver executed LOI to seller/broker', 'legal', 'high', 7, true, 3),

-- DUE_DILIGENCE Stage
('DUE_DILIGENCE', 'Order Phase I Environmental', 'Engage environmental consultant for Phase I ESA', 'environmental', 'urgent', 1, true, 1),
('DUE_DILIGENCE', 'Order property condition assessment', 'Engage engineer for PCA/building inspection', 'engineering', 'high', 1, true, 2),
('DUE_DILIGENCE', 'Order survey', 'Commission ALTA/NSPS survey', 'legal', 'high', 3, true, 3),
('DUE_DILIGENCE', 'Title review', 'Review preliminary title commitment for issues', 'legal', 'high', 5, true, 4),
('DUE_DILIGENCE', 'Review financial statements', 'Analyze T-12, T-3 operating statements', 'analysis', 'high', 7, true, 5),
('DUE_DILIGENCE', 'Tenant estoppels', 'Send estoppel certificates to tenants', 'legal', 'medium', 10, true, 6),
('DUE_DILIGENCE', 'Insurance quotes', 'Obtain property insurance quotes', 'finance', 'medium', 14, false, 7),
('DUE_DILIGENCE', 'Finalize pro forma', 'Complete underwriting model with DD findings', 'analysis', 'high', 20, true, 8),

-- CONTRACT Stage
('CONTRACT', 'Negotiate PSA', 'Finalize Purchase & Sale Agreement terms', 'legal', 'urgent', 3, true, 1),
('CONTRACT', 'Execute PSA', 'Sign PSA and deliver earnest money', 'legal', 'urgent', 5, true, 2),
('CONTRACT', 'Finalize financing', 'Lock loan terms with lender', 'finance', 'high', 7, true, 3),

-- CLOSING Stage
('CLOSING', 'Closing statement review', 'Review preliminary closing statement', 'finance', 'high', 3, true, 1),
('CLOSING', 'Wire funds', 'Initiate wire transfer for closing funds', 'finance', 'urgent', 1, true, 2),
('CLOSING', 'Execute closing documents', 'Sign all closing documents', 'legal', 'urgent', 0, true, 3),
('CLOSING', 'Record deed', 'Confirm deed recording with title company', 'legal', 'high', 0, true, 4)

ON CONFLICT DO NOTHING;

-- ============================================================================
-- Function: Generate Tasks on Stage Transition
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_stage_tasks(
  p_deal_id UUID,
  p_new_stage VARCHAR(50),
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_property_type VARCHAR(50);
  v_task_count INTEGER := 0;
  v_template RECORD;
  v_due_date TIMESTAMPTZ;
BEGIN
  -- Get deal's property type
  SELECT property_type INTO v_property_type
  FROM deals WHERE id = p_deal_id;
  
  -- Generate tasks from templates
  FOR v_template IN 
    SELECT * FROM stage_task_templates
    WHERE stage_id = p_new_stage
      AND (property_type IS NULL OR property_type = v_property_type)
    ORDER BY sequence
  LOOP
    v_due_date := NOW() + (v_template.days_from_stage_start || ' days')::INTERVAL;
    
    INSERT INTO tasks (
      title, description, category, priority, status,
      deal_id, assigned_to_id, created_by_id,
      due_date, source, stage_id, is_stage_required
    ) VALUES (
      v_template.title,
      v_template.description,
      v_template.category,
      v_template.priority,
      'todo',
      p_deal_id,
      p_user_id, -- Assign to deal owner by default
      NULL, -- System generated
      v_due_date,
      'stage_transition',
      p_new_stage,
      v_template.is_required
    );
    
    v_task_count := v_task_count + 1;
  END LOOP;
  
  RETURN v_task_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Updated timestamp trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tasks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_timestamp();
