-- Migration 046: Context Tracker Tables
-- Comprehensive deal context tracking: notes, activity, contacts, documents, decisions, risks

-- 1. Notes Table
CREATE TABLE IF NOT EXISTS deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_name VARCHAR(255),
  
  -- Content
  title VARCHAR(500),
  content TEXT NOT NULL,
  content_html TEXT, -- Rich text HTML
  
  -- Organization
  tags TEXT[],
  pinned BOOLEAN DEFAULT FALSE,
  category VARCHAR(100),
  
  -- Attachments & Links
  attachments JSONB DEFAULT '[]'::jsonb, -- [{name, url, size, type}]
  linked_modules TEXT[], -- References to other modules
  
  -- Mentions
  mentioned_user_ids UUID[],
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- 2. Activity Feed Table
CREATE TABLE IF NOT EXISTS deal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Activity Details
  activity_type VARCHAR(100) NOT NULL, -- note_added, module_updated, document_uploaded, etc.
  module_name VARCHAR(100), -- Which module was affected
  user_id UUID,
  user_name VARCHAR(255),
  
  -- Description
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Changes
  changes JSONB, -- {field: {old, new}}
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Contacts Table
CREATE TABLE IF NOT EXISTS deal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Contact Info
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL, -- seller, broker, lender, engineer, etc.
  company VARCHAR(255),
  
  -- Contact Methods
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url VARCHAR(500),
  website VARCHAR(500),
  
  -- Additional Info
  notes TEXT,
  tags TEXT[],
  
  -- Status
  is_primary BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, archived
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Documents Metadata Table (file storage handled separately)
CREATE TABLE IF NOT EXISTS deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  deleted_at TIMESTAMP
);

-- 5. Key Dates Table
CREATE TABLE IF NOT EXISTS deal_key_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Date Details
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  date_type VARCHAR(100) NOT NULL, -- deadline, milestone, scheduled
  
  -- Status
  status VARCHAR(50) DEFAULT 'upcoming', -- upcoming, completed, missed, cancelled
  completed_at TIMESTAMP,
  
  -- Notifications
  reminder_days_before INTEGER[], -- [7, 3, 1] days before to send reminder
  
  -- Context
  description TEXT,
  related_contacts UUID[], -- References to deal_contacts
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Decisions Table
CREATE TABLE IF NOT EXISTS deal_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Decision Details
  title VARCHAR(500) NOT NULL,
  decision_type VARCHAR(100), -- go-no-go, budget, design, strategy, vendor
  status VARCHAR(50) NOT NULL, -- approved, rejected, pending, tabled
  
  -- Decision Context
  rationale TEXT,
  alternatives_considered TEXT,
  impact_description TEXT,
  
  -- Financial Impact
  budget_impact DECIMAL(15, 2),
  timeline_impact_days INTEGER,
  
  -- Decision Makers
  decided_by TEXT[], -- Names or IDs of decision makers
  decision_date DATE,
  
  -- Next Actions
  next_actions TEXT[],
  next_review_date DATE,
  
  -- Attachments
  supporting_docs UUID[], -- References to deal_documents
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Risks Table
CREATE TABLE IF NOT EXISTS deal_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Risk Details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- financial, legal, environmental, construction, market
  
  -- Risk Assessment
  impact VARCHAR(50) NOT NULL, -- low, medium, high
  likelihood VARCHAR(50) NOT NULL, -- low, medium, high
  severity VARCHAR(50), -- Calculated: low, medium, high (from impact + likelihood)
  
  -- Mitigation
  mitigation_strategy TEXT,
  contingency_plan TEXT,
  budget_contingency DECIMAL(15, 2),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, monitoring, mitigated, realized
  
  -- Assignment
  assigned_to_id UUID,
  assigned_to_name VARCHAR(255),
  
  -- Timeline
  identified_date DATE DEFAULT CURRENT_DATE,
  review_date DATE,
  closed_date DATE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deal_notes_deal_id ON deal_notes(deal_id);
CREATE INDEX idx_deal_notes_tags ON deal_notes USING GIN(tags);
CREATE INDEX idx_deal_notes_pinned ON deal_notes(deal_id, pinned);

CREATE INDEX idx_deal_activity_deal_id ON deal_activity(deal_id);
CREATE INDEX idx_deal_activity_type ON deal_activity(activity_type);
CREATE INDEX idx_deal_activity_created ON deal_activity(created_at DESC);

CREATE INDEX idx_deal_contacts_deal_id ON deal_contacts(deal_id);
CREATE INDEX idx_deal_contacts_role ON deal_contacts(role);

CREATE INDEX idx_deal_documents_deal_id ON deal_documents(deal_id);
CREATE INDEX idx_deal_documents_category ON deal_documents(category);

CREATE INDEX idx_deal_key_dates_deal_id ON deal_key_dates(deal_id);
CREATE INDEX idx_deal_key_dates_date ON deal_key_dates(date);
CREATE INDEX idx_deal_key_dates_status ON deal_key_dates(status);

CREATE INDEX idx_deal_decisions_deal_id ON deal_decisions(deal_id);
CREATE INDEX idx_deal_decisions_status ON deal_decisions(status);

CREATE INDEX idx_deal_risks_deal_id ON deal_risks(deal_id);
CREATE INDEX idx_deal_risks_severity ON deal_risks(severity);
CREATE INDEX idx_deal_risks_status ON deal_risks(status);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_context_tracker_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deal_notes_updated_at
  BEFORE UPDATE ON deal_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_context_tracker_timestamp();

CREATE TRIGGER deal_contacts_updated_at
  BEFORE UPDATE ON deal_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_context_tracker_timestamp();

CREATE TRIGGER deal_documents_updated_at
  BEFORE UPDATE ON deal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_context_tracker_timestamp();

CREATE TRIGGER deal_key_dates_updated_at
  BEFORE UPDATE ON deal_key_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_context_tracker_timestamp();

CREATE TRIGGER deal_decisions_updated_at
  BEFORE UPDATE ON deal_decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_context_tracker_timestamp();

CREATE TRIGGER deal_risks_updated_at
  BEFORE UPDATE ON deal_risks
  FOR EACH ROW
  EXECUTE FUNCTION update_context_tracker_timestamp();

-- Function to calculate risk severity
CREATE OR REPLACE FUNCTION calculate_risk_severity(p_impact VARCHAR, p_likelihood VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  -- High impact + High likelihood = High severity
  IF p_impact = 'high' AND p_likelihood = 'high' THEN
    RETURN 'high';
  -- High impact + Medium likelihood = High severity
  ELSIF p_impact = 'high' AND p_likelihood = 'medium' THEN
    RETURN 'high';
  -- Medium impact + High likelihood = High severity
  ELSIF p_impact = 'medium' AND p_likelihood = 'high' THEN
    RETURN 'high';
  -- High impact + Low likelihood = Medium severity
  ELSIF p_impact = 'high' AND p_likelihood = 'low' THEN
    RETURN 'medium';
  -- Low impact + High likelihood = Medium severity
  ELSIF p_impact = 'low' AND p_likelihood = 'high' THEN
    RETURN 'medium';
  -- Medium + Medium = Medium
  ELSIF p_impact = 'medium' AND p_likelihood = 'medium' THEN
    RETURN 'medium';
  -- Everything else = Low
  ELSE
    RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Auto-calculate severity on insert/update
CREATE OR REPLACE FUNCTION auto_calculate_risk_severity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.severity = calculate_risk_severity(NEW.impact, NEW.likelihood);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deal_risks_calculate_severity
  BEFORE INSERT OR UPDATE OF impact, likelihood ON deal_risks
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_risk_severity();

COMMENT ON TABLE deal_notes IS 'Rich text notes with tags, attachments, and mentions';
COMMENT ON TABLE deal_activity IS 'Auto-tracked activity feed across all modules';
COMMENT ON TABLE deal_contacts IS 'Contact management for deals (sellers, brokers, team, etc.)';
COMMENT ON TABLE deal_documents IS 'Document metadata and organization';
COMMENT ON TABLE deal_key_dates IS 'Important dates, deadlines, and milestones';
COMMENT ON TABLE deal_decisions IS 'Decision log with rationale and impact tracking';
COMMENT ON TABLE deal_risks IS 'Risk register with mitigation strategies';
