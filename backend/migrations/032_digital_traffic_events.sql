-- Migration 032: Digital Traffic Events Infrastructure
-- Created: 2025-01-15
-- Purpose: Establish database schema for tracking user engagement with properties
--          and calculating digital traffic scores for enhanced property insights.
--
-- Part of Week 1 (Events Infrastructure) of the 8-week traffic engine roadmap.
--
-- This migration creates:
-- 1. property_events: Raw event tracking for all user interactions
-- 2. property_engagement_daily: Daily aggregations for performance analysis
-- 3. digital_traffic_scores: Calculated engagement scores (0-100 scale)
--
-- These tables enable:
-- - Real-time event capture (views, saves, shares, analysis runs)
-- - Historical trend analysis via daily aggregations
-- - Traffic scoring algorithm for property ranking
-- - Institutional interest detection

-- ============================================================================
-- TABLE 1: property_events
-- Raw event tracking for all user interactions with properties
-- ============================================================================

CREATE TABLE property_events (
  id SERIAL PRIMARY KEY,
  property_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'search_impression', 'map_click', 'detail_view', 'analysis_run', 'saved', 'shared'
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  session_id VARCHAR(100),
  referrer VARCHAR(500)
);

-- Indexes for fast querying by property, time, and event type
CREATE INDEX idx_property_events_property ON property_events(property_id);
CREATE INDEX idx_property_events_timestamp ON property_events(timestamp DESC);
CREATE INDEX idx_property_events_type ON property_events(event_type);

-- ============================================================================
-- TABLE 2: property_engagement_daily
-- Daily aggregations of engagement metrics per property
-- ============================================================================

CREATE TABLE property_engagement_daily (
  id SERIAL PRIMARY KEY,
  property_id UUID NOT NULL,
  date DATE NOT NULL,
  views INT DEFAULT 0,
  saves INT DEFAULT 0,
  shares INT DEFAULT 0,
  analysis_runs INT DEFAULT 0,
  unique_users INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(property_id, date)
);

-- Indexes for efficient daily rollup queries
CREATE INDEX idx_engagement_property ON property_engagement_daily(property_id);
CREATE INDEX idx_engagement_date ON property_engagement_daily(date DESC);

-- ============================================================================
-- TABLE 3: digital_traffic_scores
-- Calculated engagement scores for property ranking and insights
-- ============================================================================

CREATE TABLE digital_traffic_scores (
  id SERIAL PRIMARY KEY,
  property_id UUID NOT NULL,
  calculated_at TIMESTAMP DEFAULT NOW(),
  score INT CHECK (score >= 0 AND score <= 100),
  weekly_views INT,
  weekly_saves INT,
  trending_velocity DECIMAL(5,2),
  institutional_interest_flag BOOLEAN DEFAULT FALSE,
  unique_users_7d INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for score queries and time-series analysis
CREATE INDEX idx_digital_scores_property ON digital_traffic_scores(property_id);
CREATE INDEX idx_digital_scores_date ON digital_traffic_scores(calculated_at DESC);

-- ============================================================================
-- NOTES FOR DEVELOPERS
-- ============================================================================
-- 
-- Event Types (property_events.event_type):
-- - 'search_impression': Property appeared in search results
-- - 'map_click': User clicked property marker on map
-- - 'detail_view': User viewed full property details
-- - 'analysis_run': User ran analysis on property
-- - 'saved': User saved/bookmarked property
-- - 'shared': User shared property link
--
-- Metadata field (JSONB) can store:
-- - Search query context
-- - Map zoom level and bounds
-- - Analysis parameters
-- - Share destination (email, social, etc.)
--
-- Daily aggregations should be computed via scheduled job (cron/background worker)
-- Traffic scores should be recalculated weekly or on-demand
