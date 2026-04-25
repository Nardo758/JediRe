-- ============================================================================
-- KNOWLEDGE GRAPH TABLES
-- Migration: 20260425_knowledge_graph.sql
-- 
-- Graph-based relationship tracking for the JediRe Neural Network.
-- Inspired by GitNexus architecture, adapted for real estate intelligence.
-- ============================================================================

-- Enable pgvector if not already
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- NODES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  properties JSONB DEFAULT '{}',
  embedding vector(384),  -- Snowflake arctic-embed-xs compatible
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Type index for filtering
CREATE INDEX idx_kg_nodes_type ON knowledge_graph_nodes(type);

-- Full-text search index
CREATE INDEX idx_kg_nodes_fts ON knowledge_graph_nodes 
  USING gin(to_tsvector('english', name || ' ' || COALESCE(properties->>'description', '')));

-- Vector similarity index (HNSW for fast approximate nearest neighbor)
CREATE INDEX idx_kg_nodes_embedding ON knowledge_graph_nodes 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Staleness queries
CREATE INDEX idx_kg_nodes_updated ON knowledge_graph_nodes(updated_at);

-- Properties JSON path indexes
CREATE INDEX idx_kg_nodes_city ON knowledge_graph_nodes((properties->>'city'));
CREATE INDEX idx_kg_nodes_state ON knowledge_graph_nodes((properties->>'state'));
CREATE INDEX idx_kg_nodes_market ON knowledge_graph_nodes((properties->>'market'));

-- ============================================================================
-- EDGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  
  source_id VARCHAR(255) NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  
  target_id VARCHAR(255) NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL,
  
  weight NUMERIC(5,4) NOT NULL DEFAULT 0.5,  -- 0-1 strength
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,  -- 0-1 confidence
  
  properties JSONB DEFAULT '{}',
  reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate edges
  CONSTRAINT uq_kg_edge_pair UNIQUE (source_id, target_id, type)
);

-- Traversal indexes
CREATE INDEX idx_kg_edges_source ON knowledge_graph_edges(source_id);
CREATE INDEX idx_kg_edges_target ON knowledge_graph_edges(target_id);
CREATE INDEX idx_kg_edges_type ON knowledge_graph_edges(type);

-- For weighted traversal
CREATE INDEX idx_kg_edges_weight ON knowledge_graph_edges(weight DESC);
CREATE INDEX idx_kg_edges_confidence ON knowledge_graph_edges(confidence DESC);

-- Composite for common query pattern
CREATE INDEX idx_kg_edges_source_type ON knowledge_graph_edges(source_id, type);
CREATE INDEX idx_kg_edges_target_type ON knowledge_graph_edges(target_id, type);

-- ============================================================================
-- COMMUNITIES TABLE (Detected Clusters)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_graph_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  
  node_type VARCHAR(50) NOT NULL,
  node_ids VARCHAR(255)[] NOT NULL,
  node_count INTEGER NOT NULL,
  
  centroid_id VARCHAR(255) REFERENCES knowledge_graph_nodes(id),
  cohesion NUMERIC(5,4),  -- 0-1 how tightly connected
  
  characteristics JSONB DEFAULT '{}',
  
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kg_communities_type ON knowledge_graph_communities(node_type);
CREATE INDEX idx_kg_communities_computed ON knowledge_graph_communities(computed_at);

-- ============================================================================
-- EMBEDDINGS CACHE (for incremental updates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_graph_embedding_cache (
  node_id VARCHAR(255) PRIMARY KEY REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL,  -- SHA256 of embedded content
  embedding vector(384) NOT NULL,
  model_id VARCHAR(100) DEFAULT 'arctic-embed-xs',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kg_embed_cache_hash ON knowledge_graph_embedding_cache(content_hash);

-- ============================================================================
-- NODE TYPE ENUM REFERENCE
-- ============================================================================

COMMENT ON TABLE knowledge_graph_nodes IS 'Knowledge graph nodes - Property, Deal, Market, Submarket, Owner, Event, Metric, Document, Agent, POI, Route, Employer, Permit, Sale';

COMMENT ON COLUMN knowledge_graph_nodes.type IS 'Node types:
- Property: Physical real estate asset
- Deal: Acquisition/development opportunity
- Market: MSA/Metro area
- Submarket: Neighborhood/submarket
- Owner: Property owner/investor
- Event: Market event (development, economic, etc.)
- Metric: Time series metric
- Document: Uploaded document (OM, T12, etc.)
- Agent: AI agent that analyzed something
- POI: Point of interest (school, hospital, etc.)
- Route: Transit route
- Employer: Major employer
- Permit: Building permit
- Sale: Transaction record';

-- ============================================================================
-- EDGE TYPE ENUM REFERENCE  
-- ============================================================================

COMMENT ON TABLE knowledge_graph_edges IS 'Knowledge graph edges - relationships between nodes';

COMMENT ON COLUMN knowledge_graph_edges.type IS 'Edge types:
- COMP_OF: Property is comparable to Deal
- NEAR: Property near POI/Transit (with distance in properties)
- AFFECTS: Event affects Property/Market
- OWNS: Owner owns Property
- IN_MARKET: Property/Deal located in Market
- IN_SUBMARKET: Property in Submarket
- CORRELATES_WITH: Metric correlates with Metric
- EXTRACTED_FROM: Data extracted from Document
- ANALYZED_BY: Deal analyzed by Agent
- EMPLOYS_IN: Employer operates in Market
- PERMITTED_FOR: Permit issued for Property
- SOLD_AS: Property sold in Sale transaction
- STEP_IN_PROCESS: Part of deal lifecycle process
- SIMILAR_TO: Embedding similarity (auto-computed)';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get node with staleness
CREATE OR REPLACE FUNCTION kg_get_node_with_staleness(p_node_id VARCHAR)
RETURNS TABLE (
  id VARCHAR,
  type VARCHAR,
  name VARCHAR,
  properties JSONB,
  embedding vector,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  staleness VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.type,
    n.name,
    n.properties,
    n.embedding,
    n.created_at,
    n.updated_at,
    CASE 
      WHEN n.updated_at > NOW() - INTERVAL '24 hours' THEN 'fresh'
      WHEN n.updated_at > NOW() - INTERVAL '7 days' THEN 'stale'
      ELSE 'expired'
    END::VARCHAR as staleness
  FROM knowledge_graph_nodes n
  WHERE n.id = p_node_id;
END;
$$ LANGUAGE plpgsql;

-- Get neighbors of a node
CREATE OR REPLACE FUNCTION kg_get_neighbors(
  p_node_id VARCHAR,
  p_edge_types VARCHAR[] DEFAULT NULL,
  p_direction VARCHAR DEFAULT 'both'
)
RETURNS TABLE (
  neighbor_id VARCHAR,
  neighbor_type VARCHAR,
  neighbor_name VARCHAR,
  edge_type VARCHAR,
  edge_weight NUMERIC,
  edge_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN e.source_id = p_node_id THEN e.target_id ELSE e.source_id END,
    CASE WHEN e.source_id = p_node_id THEN e.target_type ELSE e.source_type END,
    n.name,
    e.type,
    e.weight,
    e.reason
  FROM knowledge_graph_edges e
  JOIN knowledge_graph_nodes n ON n.id = CASE 
    WHEN e.source_id = p_node_id THEN e.target_id 
    ELSE e.source_id 
  END
  WHERE (
    (p_direction = 'both' AND (e.source_id = p_node_id OR e.target_id = p_node_id))
    OR (p_direction = 'outgoing' AND e.source_id = p_node_id)
    OR (p_direction = 'incoming' AND e.target_id = p_node_id)
  )
  AND (p_edge_types IS NULL OR e.type = ANY(p_edge_types))
  ORDER BY e.weight DESC;
END;
$$ LANGUAGE plpgsql;

-- Semantic search
CREATE OR REPLACE FUNCTION kg_semantic_search(
  p_embedding vector(384),
  p_node_types VARCHAR[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id VARCHAR,
  type VARCHAR,
  name VARCHAR,
  properties JSONB,
  similarity NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.type,
    n.name,
    n.properties,
    (1 - (n.embedding <=> p_embedding))::NUMERIC as similarity
  FROM knowledge_graph_nodes n
  WHERE n.embedding IS NOT NULL
    AND (p_node_types IS NULL OR n.type = ANY(p_node_types))
  ORDER BY n.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED MARKET NODES
-- ============================================================================

INSERT INTO knowledge_graph_nodes (id, type, name, properties) VALUES
  ('market:atlanta', 'Market', 'Atlanta, GA', '{"state": "GA", "msa": "Atlanta-Sandy Springs-Alpharetta"}'),
  ('market:tampa', 'Market', 'Tampa, FL', '{"state": "FL", "msa": "Tampa-St. Petersburg-Clearwater"}'),
  ('market:orlando', 'Market', 'Orlando, FL', '{"state": "FL", "msa": "Orlando-Kissimmee-Sanford"}'),
  ('market:miami', 'Market', 'Miami, FL', '{"state": "FL", "msa": "Miami-Fort Lauderdale-Pompano Beach"}'),
  ('market:jacksonville', 'Market', 'Jacksonville, FL', '{"state": "FL", "msa": "Jacksonville"}'),
  ('market:charlotte', 'Market', 'Charlotte, NC', '{"state": "NC", "msa": "Charlotte-Concord-Gastonia"}'),
  ('market:raleigh', 'Market', 'Raleigh, NC', '{"state": "NC", "msa": "Raleigh-Cary"}'),
  ('market:nashville', 'Market', 'Nashville, TN', '{"state": "TN", "msa": "Nashville-Davidson-Murfreesboro-Franklin"}'),
  ('market:dallas', 'Market', 'Dallas, TX', '{"state": "TX", "msa": "Dallas-Fort Worth-Arlington"}'),
  ('market:austin', 'Market', 'Austin, TX', '{"state": "TX", "msa": "Austin-Round Rock-Georgetown"}'),
  ('market:houston', 'Market', 'Houston, TX', '{"state": "TX", "msa": "Houston-The Woodlands-Sugar Land"}'),
  ('market:phoenix', 'Market', 'Phoenix, AZ', '{"state": "AZ", "msa": "Phoenix-Mesa-Chandler"}'),
  ('market:denver', 'Market', 'Denver, CO', '{"state": "CO", "msa": "Denver-Aurora-Lakewood"}')
ON CONFLICT (id) DO NOTHING;

-- Seed Atlanta submarkets
INSERT INTO knowledge_graph_nodes (id, type, name, properties) VALUES
  ('submarket:midtown', 'Submarket', 'Midtown', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:buckhead', 'Submarket', 'Buckhead', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:downtown-atlanta', 'Submarket', 'Downtown Atlanta', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:sandy-springs', 'Submarket', 'Sandy Springs', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:alpharetta', 'Submarket', 'Alpharetta', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:dunwoody', 'Submarket', 'Dunwoody', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:decatur', 'Submarket', 'Decatur', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:marietta', 'Submarket', 'Marietta', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:east-atlanta', 'Submarket', 'East Atlanta', '{"market": "atlanta", "state": "GA"}'),
  ('submarket:west-midtown', 'Submarket', 'West Midtown', '{"market": "atlanta", "state": "GA"}')
ON CONFLICT (id) DO NOTHING;

-- Create edges from submarkets to markets
INSERT INTO knowledge_graph_edges (type, source_id, source_type, target_id, target_type, weight, confidence, reason) VALUES
  ('IN_MARKET', 'submarket:midtown', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'Midtown is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:buckhead', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'Buckhead is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:downtown-atlanta', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'Downtown Atlanta is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:sandy-springs', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'Sandy Springs is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:alpharetta', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'Alpharetta is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:dunwoody', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'Dunwoody is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:decatur', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'Decatur is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:marietta', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'Marietta is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:east-atlanta', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'East Atlanta is a submarket of Atlanta'),
  ('IN_MARKET', 'submarket:west-midtown', 'Submarket', 'market:atlanta', 'Market', 1.0, 1.0, 'West Midtown is a submarket of Atlanta')
ON CONFLICT (source_id, target_id, type) DO NOTHING;
