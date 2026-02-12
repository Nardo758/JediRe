-- =====================================================
-- AGENT DASHBOARD DATABASE SCHEMA - ROLLBACK
-- Migration: 001_agent_dashboard_schema_rollback
-- Created: 2024-02-04
-- Description: Rollback script for Agent CRM Dashboard schema
-- =====================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS update_agent_clients_updated_at ON agent_clients;
DROP TRIGGER IF EXISTS update_agent_deals_updated_at ON agent_deals;
DROP TRIGGER IF EXISTS update_agent_leads_updated_at ON agent_leads;
DROP TRIGGER IF EXISTS update_agent_activities_updated_at ON agent_activities;
DROP TRIGGER IF EXISTS update_agent_commission_templates_updated_at ON agent_commission_templates;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order of creation (respecting foreign keys)
DROP TABLE IF EXISTS agent_activities CASCADE;
DROP TABLE IF EXISTS agent_leads CASCADE;
DROP TABLE IF EXISTS agent_deals CASCADE;
DROP TABLE IF EXISTS agent_commission_templates CASCADE;
DROP TABLE IF EXISTS agent_clients CASCADE;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================
