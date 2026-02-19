-- Migration 035: Add user preferences columns for onboarding
-- These columns support the preferences/onboarding system

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_markets TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS property_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_market VARCHAR(100),
  ADD COLUMN IF NOT EXISTS primary_use_case VARCHAR(100),
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferences_set_at TIMESTAMP;
