-- =====================================================
-- Migration 001: Core Extensions & Setup
-- =====================================================
-- Description: Install PostgreSQL extensions for GIS, time-series, and UUID support
-- Created: 2026-01-31
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable PostGIS for geospatial operations
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enable TimescaleDB for time-series data
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable vector operations for embeddings (if using pgvector)
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- Custom Types
-- =====================================================

-- User role types
CREATE TYPE user_role AS ENUM (
    'developer',
    'investor',
    'flipper',
    'broker',
    'landlord',
    'commercial',
    'admin'
);

-- Subscription tier types
CREATE TYPE subscription_tier AS ENUM (
    'free',
    'professional',
    'team',
    'enterprise'
);

-- Property types
CREATE TYPE property_type AS ENUM (
    'single_family',
    'multi_family',
    'commercial',
    'industrial',
    'land',
    'mixed_use',
    'other'
);

-- Module types (12 agents)
CREATE TYPE module_type AS ENUM (
    'zoning',
    'supply',
    'demand',
    'price',
    'news',
    'event',
    'sf_strategy',
    'development',
    'cash_flow',
    'debt',
    'network',
    'financial_model'
);

-- Opportunity score levels
CREATE TYPE opportunity_level AS ENUM (
    'high',
    'medium',
    'low',
    'unknown'
);

-- Alert priority levels
CREATE TYPE alert_priority AS ENUM (
    'critical',
    'high',
    'medium',
    'low',
    'info'
);

-- Analysis status
CREATE TYPE analysis_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'expired'
);

COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';
COMMENT ON EXTENSION "postgis" IS 'Geospatial database functionality';
COMMENT ON EXTENSION "timescaledb" IS 'Time-series database functionality';
COMMENT ON EXTENSION "pg_trgm" IS 'Fuzzy text matching';
COMMENT ON EXTENSION "vector" IS 'Vector similarity search for embeddings';
