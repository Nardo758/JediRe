-- Phase 8: Research Agent Enrichment
-- Adds photos, reviews, sentiment_summary, and recent_events columns
-- to property_descriptions for Google Places + web search output.

ALTER TABLE property_descriptions
  ADD COLUMN IF NOT EXISTS photos            jsonb,
  ADD COLUMN IF NOT EXISTS reviews           jsonb,
  ADD COLUMN IF NOT EXISTS sentiment_summary jsonb,
  ADD COLUMN IF NOT EXISTS recent_events     jsonb;
