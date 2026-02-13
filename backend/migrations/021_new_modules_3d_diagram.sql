-- ============================================================================
-- Migration 021: New Module Skeletons + 3D Building Diagram
-- Adds 9 new coming-soon modules and updates Property module with 3D feature
-- ============================================================================

-- ============================================================================
-- 1. Module Definitions Table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS module_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  category VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active', -- active, coming-soon, beta, deprecated
  tier_requirement VARCHAR(20) DEFAULT 'all', -- all, premium, enterprise
  features JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. Insert 9 New Module Skeletons (Coming Soon)
-- ============================================================================

-- Financial Modeling Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'financial-modeling',
  'Advanced Financial Modeling',
  'Pro forma scenario builder with sensitivity analysis and stress testing',
  '📊',
  'financial',
  'coming-soon',
  'premium',
  '["Multi-Scenario Builder", "Sensitivity Analysis", "Stress Testing", "Tornado Charts", "Monte Carlo Simulation", "Compare Side-by-Side"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Zoning & Entitlements Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'zoning-entitlements',
  'Zoning & Entitlements',
  'Track zoning compliance, variance applications, and density calculations',
  '🏛️',
  'legal',
  'coming-soon',
  'premium',
  '["Zoning Lookup", "Compliance Checker", "Variance Tracker", "Density Calculator", "Permit Timeline", "Municipality Database"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Environmental & ESG Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'environmental-esg',
  'Environmental & ESG',
  'Environmental assessments, compliance tracking, and ESG performance metrics',
  '🌍',
  'compliance',
  'coming-soon',
  'premium',
  '["Phase I/II Tracker", "Risk Scoring", "ESG Metrics", "Green Certification", "Carbon Footprint", "Compliance Alerts"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Capital Events Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'capital-events',
  'Capital Events',
  'Manage refinancing, recapitalizations, and property dispositions',
  '💼',
  'financial',
  'coming-soon',
  'premium',
  '["Refinancing Dashboard", "Lender Comparison", "1031 Exchange Tracker", "Recapitalization Manager", "Sale Process Workflow", "Marketing Analytics"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Risk Management Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'risk-management',
  'Risk Management',
  'Insurance tracking, claims management, and comprehensive risk assessment',
  '🛡️',
  'risk',
  'coming-soon',
  'premium',
  '["Insurance Tracker", "Claims Management", "Risk Heat Map", "Coverage Gap Analysis", "Premium Benchmarking", "Loss History Reports"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Vendor Management Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'vendor-management',
  'Vendor Management',
  'Contractor database, bid comparison, and performance tracking',
  '👷',
  'operations',
  'coming-soon',
  'all',
  '["Contractor Database", "Bid Comparison Tool", "Performance Tracking", "RFP Generator", "Compliance Tracker", "Preferred Vendor Lists"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Marketing & Leasing Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'marketing-leasing',
  'Marketing & Leasing',
  'Campaign management, lead tracking, and tour scheduling',
  '📢',
  'operations',
  'coming-soon',
  'all',
  '["Campaign Manager", "Lead Tracking", "Tour Scheduling", "Listing Syndication", "Email Templates", "Analytics Dashboard"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Legal & Compliance Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'legal-compliance',
  'Legal & Compliance',
  'Track legal issues, compliance requirements, and regulatory deadlines',
  '⚖️',
  'legal',
  'coming-soon',
  'premium',
  '["Legal Issue Tracker", "Compliance Calendar", "Document Vault", "Attorney Directory", "Fair Housing Toolkit", "Litigation Cost Tracker"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Construction Management Module
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'construction-management',
  'Construction Management',
  'Track draw schedules, punch lists, change orders, and inspections',
  '🏗️',
  'operations',
  'coming-soon',
  'all',
  '["Draw Schedule", "Punch List Manager", "Change Order Tracking", "Inspection Calendar", "Progress Photos", "Budget Variance Reports"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================================================
-- 3. Update Property Information Module with 3D Diagram Feature
-- ============================================================================
INSERT INTO module_definitions (name, display_name, description, icon, category, status, tier_requirement, features)
VALUES (
  'property-information',
  'Property Information',
  'Detailed property data with interactive 3D building visualization',
  '🏢',
  'property',
  'active',
  'all',
  '["Property List", "Unit Mix", "3D Building Diagram", "Rent Roll", "Floor Plans", "Amenities", "Comps Analysis"]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  updated_at = NOW();

-- ============================================================================
-- 4. Create Module Feature Flags Table (for granular control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS module_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name VARCHAR(100) NOT NULL REFERENCES module_definitions(name) ON DELETE CASCADE,
  feature_name VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  tier_requirement VARCHAR(20) DEFAULT 'all',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(module_name, feature_name)
);

-- Insert 3D Diagram as a feature of Property Information
INSERT INTO module_features (module_name, feature_name, is_enabled, tier_requirement, description)
VALUES (
  'property-information',
  '3d-building-diagram',
  true,
  'all',
  'Interactive 3D building visualization with floor-by-floor unit details'
) ON CONFLICT (module_name, feature_name) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

-- ============================================================================
-- 5. Create Building 3D Data Table (for storing unit geometries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS building_3d_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  floors INTEGER NOT NULL,
  building_data JSONB NOT NULL, -- Stores units array, amenities, etc.
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(property_id)
);

CREATE INDEX idx_building_3d_property_id ON building_3d_models(property_id);

-- ============================================================================
-- 6. Grant Permissions
-- ============================================================================
-- Grant read access to module_definitions for all authenticated users
-- (Adjust based on your RLS policies)

COMMENT ON TABLE module_definitions IS 'Catalog of all platform modules with metadata and feature lists';
COMMENT ON TABLE module_features IS 'Granular feature flags for module capabilities';
COMMENT ON TABLE building_3d_models IS 'Stores 3D building model data for interactive visualization';

-- ============================================================================
-- Migration Complete
-- ============================================================================
