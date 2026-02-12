-- Migration: Seed Module Definitions
-- Description: Populate module definitions with initial module catalog
-- Date: 2026-02-09

INSERT INTO module_definitions (slug, name, category, description, price_monthly, is_free, bundles, icon, enhances, sort_order) VALUES

-- FREE MODULES
('basic-financial', 'Basic Financial Modeling', 'Free', 'Simple financial calculations and metrics', 0, true, ARRAY['flipper', 'developer', 'portfolio'], '💵', ARRAY['Financial Analysis section'], 1),
('comp-basic', 'Comp Analysis (Basic)', 'Free', 'Basic comparable property analysis', 0, true, ARRAY['flipper', 'developer', 'portfolio'], '📊', ARRAY['Market Analysis section'], 2),

-- STRATEGY & ARBITRAGE
('strategy-arbitrage', 'Strategy Arbitrage Engine', 'Strategy & Arbitrage', '39 pre-loaded strategies plus custom strategy builder', 3900, false, ARRAY['flipper', 'developer', 'portfolio'], '🎯', ARRAY['Strategy section'], 10),

-- FINANCIAL & ANALYSIS
('financial-modeling-pro', 'Financial Modeling Pro', 'Financial & Analysis', 'Component-based pro-forma builder with 13 blocks, sensitivity analysis, and Monte Carlo simulations', 3400, false, ARRAY['flipper', 'developer', 'portfolio'], '💰', ARRAY['Financial Analysis section'], 20),
('financial-analysis-pro', 'Financial Analysis Pro', 'Financial & Analysis', 'Advanced metrics, waterfall distribution models, and investor returns', 3400, false, ARRAY['flipper', 'developer', 'portfolio'], '📈', ARRAY['Financial Analysis section'], 21),
('sensitivity-tester', 'Sensitivity Tester', 'Financial & Analysis', 'Multi-variable stress testing and scenario analysis', 2400, false, ARRAY['developer', 'portfolio'], '🔬', ARRAY['Financial Analysis section'], 22),

-- DEVELOPMENT
('dev-budget', 'Dev Budget Tracker', 'Development', 'Construction budget tracking with variance analysis', 2900, false, ARRAY['developer', 'portfolio'], '💲', ARRAY['Development section'], 30),
('development-tracker', 'Development Tracker', 'Development', 'Gantt charts, timeline management, and permit tracking', 3900, false, ARRAY['developer', 'portfolio'], '🏗️', ARRAY['Development section'], 31),
('zoning-interpreter', 'Zoning Interpreter', 'Development', 'AI-powered zoning code analysis and compliance checking', 5400, false, ARRAY['developer', 'portfolio'], '📋', ARRAY['Development section'], 32),
('site-plan-analyzer', 'Site Plan Analyzer', 'Development', 'Site plan optimization and capacity analysis', 3900, false, ARRAY['developer', 'portfolio'], '🗺️', ARRAY['Development section'], 33),

-- DUE DILIGENCE
('dd-suite', 'Due Diligence Suite', 'Due Diligence', 'Smart checklists with risk scoring and automated document review', 3900, false, ARRAY['flipper', 'developer', 'portfolio'], '✅', ARRAY['Due Diligence section'], 40),
('property-condition', 'Property Condition', 'Due Diligence', 'Inspection tracking, maintenance estimates, and CapEx planning', 2900, false, ARRAY['flipper', 'developer', 'portfolio'], '🔧', ARRAY['Due Diligence section'], 41),

-- MARKET INTELLIGENCE
('market-signals', 'Market Signals', 'Market Intelligence', 'Supply pipeline monitoring, competitor tracking, and early warning alerts', 3900, false, ARRAY['flipper', 'developer', 'portfolio'], '📡', ARRAY['Market Analysis section'], 50),
('supply-pipeline', 'Supply Pipeline Monitor', 'Market Intelligence', 'Track new development pipeline and absorption rates', 4900, false, ARRAY['developer', 'portfolio'], '🏢', ARRAY['Market Analysis section'], 51),
('traffic-intel', 'Traffic Intelligence', 'Market Intelligence', 'Location analytics, foot traffic data, and visitor patterns', 5900, false, ARRAY['developer', 'portfolio'], '🚶', ARRAY['Market Analysis section'], 52),
('deal-intelligence', 'Deal Intelligence', 'Market Intelligence', 'AI-powered deal recommendations and opportunity scoring', 4400, false, ARRAY['flipper', 'developer', 'portfolio'], '🧠', ARRAY['Market Analysis section'], 53),

-- COLLABORATION
('deal-room', 'Deal Room', 'Collaboration', 'Virtual data room with Q&A management and access controls', 2400, false, ARRAY['portfolio'], '🔐', ARRAY['Collaboration section'], 60),
('investor-portal', 'Investor Portal', 'Collaboration', 'White-label investor portal with reporting and distributions', 2400, false, ARRAY['portfolio'], '👥', ARRAY['Collaboration section'], 61),

-- PORTFOLIO MANAGEMENT
('rent-roll', 'Rent Roll Manager', 'Portfolio Management', 'Lease tracking, expirations, renewals, and tenant analytics', 2900, false, ARRAY['portfolio'], '📄', ARRAY['Properties section'], 70),
('budget-vs-actual', 'Budget vs Actual', 'Portfolio Management', 'Real-time budget variance tracking and alerts', 3400, false, ARRAY['portfolio'], '💹', ARRAY['Financial Analysis section'], 71),
('value-add-tracker', 'Value-Add Tracker', 'Portfolio Management', 'Track renovations, rent growth, and value creation', 2900, false, ARRAY['portfolio'], '📊', ARRAY['Properties section'], 72),
('portfolio-dashboard', 'Portfolio Dashboard', 'Portfolio Management', 'Executive dashboard with KPIs and performance metrics', 3900, false, ARRAY['portfolio'], '📊', ARRAY['Overview section'], 73),
('investor-reporting', 'Investor Reporting', 'Portfolio Management', 'Automated investor reports, K-1s, and distributions', 4900, false, ARRAY['portfolio'], '📈', ARRAY['Collaboration section'], 74),
('asset-strategy', 'Asset Strategy', 'Portfolio Management', 'Hold/sell analysis, disposition timing, and exit planning', 3400, false, ARRAY['portfolio'], '🎯', ARRAY['Strategy section'], 75),

-- EXECUTION
('deal-execution', 'Deal Execution', 'Execution', 'Closing timeline, task management, and coordination tools', 3400, false, ARRAY['flipper', 'developer', 'portfolio'], '⚡', ARRAY['Overview section'], 80)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  is_free = EXCLUDED.is_free,
  bundles = EXCLUDED.bundles,
  icon = EXCLUDED.icon,
  enhances = EXCLUDED.enhances,
  sort_order = EXCLUDED.sort_order;
