-- ═══════════════════════════════════════════════════════════════
-- JEDI RE — Intelligence Context Engine
-- Migration 084: Document Categorization & Module Routing
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- Document Categories
-- Maps documents to their purpose and target modules
-- ───────────────────────────────────────────────────────────────

CREATE TABLE document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  category_code VARCHAR(50) UNIQUE NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Module routing
  target_modules TEXT[] DEFAULT '{}',
  -- Array of module codes: ['M01', 'M09', 'M15']
  
  -- Data purpose
  purpose_tags TEXT[] DEFAULT '{}',
  -- ['financial', 'zoning', 'market', 'competitive', 'operational']
  
  -- Deal stage relevance
  deal_stages TEXT[] DEFAULT '{}',
  -- ['lead', 'analysis', 'underwriting', 'due_diligence', 'closing', 'asset_management']
  
  -- Priority for agents
  agent_priority INTEGER DEFAULT 5,
  -- 1=critical, 5=normal, 10=low
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- Insert Default Categories
-- ───────────────────────────────────────────────────────────────

-- Financial Documents
INSERT INTO document_categories (category_code, category_name, description, target_modules, purpose_tags, deal_stages, agent_priority) VALUES
  ('OM', 'Offering Memorandum', 'Broker package with property overview, financials, and market info', 
   '{"M01", "M09", "M15", "M22"}', '{"financial", "market", "property_profile"}', 
   '{"lead", "analysis", "underwriting"}', 1),
  
  ('T12', 'Trailing 12 Months', 'Historical operating statement showing revenue and expenses',
   '{"M09", "M22"}', '{"financial", "operational"}',
   '{"underwriting", "due_diligence"}', 1),
  
  ('RENT_ROLL', 'Rent Roll', 'Unit-by-unit breakdown of tenants, rents, lease terms',
   '{"M09", "M22"}', '{"financial", "operational"}',
   '{"underwriting", "due_diligence"}', 1),
  
  ('PROFORMA', 'Pro Forma', 'Forward-looking financial projections',
   '{"M09"}', '{"financial", "projections"}',
   '{"analysis", "underwriting"}', 2);

-- Property Documents
INSERT INTO document_categories (category_code, category_name, description, target_modules, purpose_tags, deal_stages, agent_priority) VALUES
  ('APPRAISAL', 'Appraisal Report', 'Third-party property valuation',
   '{"M01", "M15"}', '{"valuation", "market"}',
   '{"due_diligence", "closing"}', 2),
  
  ('SURVEY', 'Property Survey', 'Land survey with boundaries and easements',
   '{"M01", "M03"}', '{"property_profile", "legal"}',
   '{"due_diligence"}', 3),
  
  ('INSPECTION', 'Property Inspection', 'Physical condition assessment',
   '{"M22"}', '{"operational", "capex"}',
   '{"due_diligence"}', 3),
  
  ('ENV_REPORT', 'Environmental Report', 'Phase I/II environmental assessment',
   '{"M01"}', '{"risk", "legal"}',
   '{"due_diligence"}', 2);

-- Zoning & Entitlement
INSERT INTO document_categories (category_code, category_name, description, target_modules, purpose_tags, deal_stages, agent_priority) VALUES
  ('ZONING_CODE', 'Zoning Code', 'Municipal zoning ordinance or code section',
   '{"M03", "M48"}', '{"zoning", "regulatory"}',
   '{"analysis", "underwriting", "due_diligence"}', 1),
  
  ('ZONING_LETTER', 'Zoning Letter', 'Official zoning determination from municipality',
   '{"M03"}', '{"zoning", "legal"}',
   '{"analysis", "due_diligence"}', 1),
  
  ('SITE_PLAN', 'Site Plan', 'Proposed development site plan',
   '{"M03", "M04"}', '{"development", "zoning"}',
   '{"analysis", "underwriting"}', 2),
  
  ('ENTITLEMENT_APP', 'Entitlement Application', 'Variance, rezoning, or entitlement application',
   '{"M03"}', '{"zoning", "regulatory"}',
   '{"analysis"}', 2);

-- Market Intelligence
INSERT INTO document_categories (category_code, category_name, description, target_modules, purpose_tags, deal_stages, agent_priority) VALUES
  ('MARKET_REPORT', 'Market Report', 'Submarket analysis, trends, forecasts',
   '{"M05", "M06", "M15"}', '{"market", "competitive"}',
   '{"lead", "analysis"}', 2),
  
  ('COMP_SHEET', 'Comparable Sales', 'Sale comps for valuation',
   '{"M15"}', '{"market", "valuation"}',
   '{"analysis", "underwriting"}', 1),
  
  ('RENT_SURVEY', 'Rent Survey', 'Market rent data by unit type',
   '{"M05", "M09"}', '{"market", "financial"}',
   '{"analysis", "underwriting"}', 1),
  
  ('DEMO_REPORT', 'Demographics Report', 'Population, income, employment data',
   '{"M05", "M06"}', '{"market", "demand"}',
   '{"analysis"}', 3);

-- Construction & Development
INSERT INTO document_categories (category_code, category_name, description, target_modules, purpose_tags, deal_stages, agent_priority) VALUES
  ('COST_ESTIMATE', 'Construction Cost Estimate', 'Itemized construction budget',
   '{"M04", "M09"}', '{"financial", "development"}',
   '{"analysis", "underwriting"}', 2),
  
  ('IMPACT_FEES', 'Impact Fee Schedule', 'Municipal impact fees for development',
   '{"M04", "M09"}', '{"financial", "regulatory"}',
   '{"analysis"}', 2),
  
  ('PERMIT_TIMELINE', 'Permit Timeline', 'Historical permit approval timelines',
   '{"M03", "M04"}', '{"regulatory", "timeline"}',
   '{"analysis"}', 3),
  
  ('PLANS_SPECS', 'Plans & Specifications', 'Architectural or engineering drawings',
   '{"M04"}', '{"development", "technical"}',
   '{"due_diligence"}', 4);

-- Legal & Closing
INSERT INTO document_categories (category_code, category_name, description, target_modules, purpose_tags, deal_stages, agent_priority) VALUES
  ('PSA', 'Purchase & Sale Agreement', 'Contract to purchase property',
   '{"M01", "M22"}', '{"legal", "transaction"}',
   '{"underwriting", "closing"}', 1),
  
  ('TITLE_REPORT', 'Title Report', 'Title insurance commitment with exceptions',
   '{"M01"}', '{"legal", "risk"}',
   '{"due_diligence", "closing"}', 2),
  
  ('LEASE_ABSTRACT', 'Lease Abstract', 'Summary of key lease terms',
   '{"M09", "M22"}', '{"legal", "operational"}',
   '{"due_diligence"}', 3);

-- Asset Management (for archived deals)
INSERT INTO document_categories (category_code, category_name, description, target_modules, purpose_tags, deal_stages, agent_priority) VALUES
  ('BUDGET', 'Operating Budget', 'Annual operating budget',
   '{"M22", "M09"}', '{"financial", "operational"}',
   '{"asset_management"}', 2),
  
  ('VARIANCE_REPORT', 'Budget Variance Report', 'Actual vs budget performance',
   '{"M22"}', '{"financial", "operational"}',
   '{"asset_management"}', 3),
  
  ('CAPEX_PLAN', 'Capital Expenditure Plan', 'Planned capital improvements',
   '{"M22"}', '{"financial", "capex"}',
   '{"asset_management"}', 3),
  
  ('TENANT_LEDGER', 'Tenant Ledger', 'Rent payments and arrears',
   '{"M22"}', '{"operational", "financial"}',
   '{"asset_management"}', 4);

-- ───────────────────────────────────────────────────────────────
-- Link Documents to Categories
-- ───────────────────────────────────────────────────────────────

ALTER TABLE unified_documents 
  ADD COLUMN category_code VARCHAR(50) REFERENCES document_categories(category_code);

CREATE INDEX idx_unified_docs_category ON unified_documents (category_code);

-- ───────────────────────────────────────────────────────────────
-- Module Data Requirements
-- Defines what data each module needs
-- ───────────────────────────────────────────────────────────────

CREATE TABLE module_data_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  module_code VARCHAR(10) NOT NULL,
  module_name VARCHAR(100) NOT NULL,
  
  -- Required document categories
  required_categories TEXT[] DEFAULT '{}',
  
  -- Optional but helpful categories
  optional_categories TEXT[] DEFAULT '{}',
  
  -- Data quality thresholds
  min_confidence_score FLOAT DEFAULT 0.6,
  require_embeddings BOOLEAN DEFAULT false,
  
  is_active BOOLEAN DEFAULT true
);

-- Insert module requirements
INSERT INTO module_data_requirements (module_code, module_name, required_categories, optional_categories, min_confidence_score, require_embeddings) VALUES
  ('M01', 'JEDI Score', '{"OM"}', '{"APPRAISAL", "MARKET_REPORT", "PSA"}', 0.7, true),
  ('M03', 'Zoning Analysis', '{"ZONING_CODE"}', '{"SITE_PLAN", "ENTITLEMENT_APP", "ZONING_LETTER"}', 0.8, true),
  ('M04', 'Supply Analysis', '{"ZONING_CODE"}', '{"COST_ESTIMATE", "IMPACT_FEES", "PERMIT_TIMELINE"}', 0.7, true),
  ('M05', 'Market Intelligence', '{}', '{"MARKET_REPORT", "DEMO_REPORT", "RENT_SURVEY"}', 0.6, true),
  ('M06', 'Demand Analysis', '{}', '{"DEMO_REPORT", "MARKET_REPORT", "RENT_SURVEY"}', 0.6, true),
  ('M09', 'ProForma', '{"T12", "RENT_ROLL"}', '{"OM", "PROFORMA", "COST_ESTIMATE", "BUDGET"}', 0.7, false),
  ('M15', 'Sale Comps', '{"COMP_SHEET"}', '{"APPRAISAL", "MARKET_REPORT"}', 0.6, true),
  ('M22', 'Deal Bible', '{}', '{"OM", "T12", "RENT_ROLL", "PSA", "INSPECTION", "LEASE_ABSTRACT"}', 0.5, false),
  ('M48', 'Zoning Database', '{"ZONING_CODE"}', '{"ZONING_LETTER"}', 0.8, false);

COMMENT ON TABLE document_categories IS 'Document classification system for routing to modules and agents';
COMMENT ON TABLE module_data_requirements IS 'Defines what data each module needs to function';
COMMENT ON COLUMN document_categories.target_modules IS 'Array of module codes that can consume this document type';
COMMENT ON COLUMN document_categories.agent_priority IS '1=critical, 5=normal, 10=low priority for agent context';
