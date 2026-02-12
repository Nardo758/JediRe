-- ============================================================================
-- Migration 031: Kafka Event Bus Infrastructure
-- ============================================================================
-- Description: Event tracking, consumer offsets, processing status, and
--              cascading event trace for full observability
-- Version: 1.0.0
-- Date: 2026-02-11
-- ============================================================================

BEGIN;

-- ============================================================================
-- Table: kafka_events_log
-- Purpose: Audit trail of all published events across the platform
-- ============================================================================

CREATE TABLE IF NOT EXISTS kafka_events_log (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    
    -- Event metadata
    topic VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    
    -- Event payload
    payload JSONB NOT NULL,
    
    -- Geographic context (for filtering/analysis)
    trade_area_ids TEXT[],
    submarket_ids TEXT[],
    msa_ids TEXT[],
    
    -- Deal context (if applicable)
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    
    -- Publishing metadata
    published_by VARCHAR(100) NOT NULL, -- Service name that published
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Kafka metadata
    partition INTEGER,
    offset BIGINT,
    
    -- Event characteristics
    magnitude NUMERIC(10, 2), -- Impact magnitude (if applicable)
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Indexing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_events_log_topic ON kafka_events_log(topic);
CREATE INDEX idx_events_log_event_type ON kafka_events_log(event_type);
CREATE INDEX idx_events_log_published_at ON kafka_events_log(published_at DESC);
CREATE INDEX idx_events_log_deal_id ON kafka_events_log(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_events_log_trade_area_ids ON kafka_events_log USING GIN(trade_area_ids);
CREATE INDEX idx_events_log_event_id ON kafka_events_log(event_id);

-- Composite index for cascade tracing
CREATE INDEX idx_events_log_cascade ON kafka_events_log(topic, published_at DESC);

COMMENT ON TABLE kafka_events_log IS 'Audit trail of all Kafka events published across the platform';
COMMENT ON COLUMN kafka_events_log.magnitude IS 'Numeric impact magnitude (e.g., housing units, job count)';
COMMENT ON COLUMN kafka_events_log.confidence_score IS 'Confidence in event accuracy (0-100)';

-- ============================================================================
-- Table: kafka_consumer_offsets
-- Purpose: Track consumer position for manual offset management
-- ============================================================================

CREATE TABLE IF NOT EXISTS kafka_consumer_offsets (
    id SERIAL PRIMARY KEY,
    
    consumer_group VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    partition INTEGER NOT NULL,
    
    offset BIGINT NOT NULL,
    metadata JSONB,
    
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(consumer_group, topic, partition)
);

CREATE INDEX idx_consumer_offsets_group ON kafka_consumer_offsets(consumer_group);
CREATE INDEX idx_consumer_offsets_topic ON kafka_consumer_offsets(topic);

COMMENT ON TABLE kafka_consumer_offsets IS 'Manual tracking of Kafka consumer offsets for observability';

-- ============================================================================
-- Table: event_processing_status
-- Purpose: Track success/failure of event processing by consumers
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_processing_status (
    id BIGSERIAL PRIMARY KEY,
    
    -- Event reference
    event_id UUID NOT NULL,
    event_log_id BIGINT REFERENCES kafka_events_log(id) ON DELETE CASCADE,
    
    -- Processing metadata
    consumer_group VARCHAR(255) NOT NULL,
    consumer_name VARCHAR(255) NOT NULL,
    
    -- Status
    status VARCHAR(50) NOT NULL CHECK (status IN ('processing', 'success', 'failed', 'retrying')),
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
    ) STORED,
    
    -- Error handling
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Result
    result JSONB,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_processing_status_event_id ON event_processing_status(event_id);
CREATE INDEX idx_processing_status_consumer ON event_processing_status(consumer_group, consumer_name);
CREATE INDEX idx_processing_status_status ON event_processing_status(status);
CREATE INDEX idx_processing_status_retry ON event_processing_status(next_retry_at) 
    WHERE status = 'retrying' AND next_retry_at IS NOT NULL;

COMMENT ON TABLE event_processing_status IS 'Tracks processing status of events by each consumer';
COMMENT ON COLUMN event_processing_status.duration_ms IS 'Processing time in milliseconds';

-- ============================================================================
-- Table: event_cascade_trace
-- Purpose: Track cascading event propagation (Event A → Event B → Event C)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_cascade_trace (
    id BIGSERIAL PRIMARY KEY,
    
    -- Root event (the original trigger)
    root_event_id UUID NOT NULL,
    
    -- Current event in cascade
    event_id UUID NOT NULL REFERENCES kafka_events_log(event_id) ON DELETE CASCADE,
    
    -- Parent event (what triggered this event)
    parent_event_id UUID REFERENCES kafka_events_log(event_id) ON DELETE CASCADE,
    
    -- Cascade depth (0 = root, 1 = first derivative, etc.)
    depth INTEGER NOT NULL DEFAULT 0,
    
    -- Path from root to current (array of event IDs)
    cascade_path UUID[] NOT NULL,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cascade_trace_root ON event_cascade_trace(root_event_id);
CREATE INDEX idx_cascade_trace_event ON event_cascade_trace(event_id);
CREATE INDEX idx_cascade_trace_parent ON event_cascade_trace(parent_event_id);
CREATE INDEX idx_cascade_trace_depth ON event_cascade_trace(depth);

COMMENT ON TABLE event_cascade_trace IS 'Tracks cascading event propagation through the system';
COMMENT ON COLUMN event_cascade_trace.cascade_path IS 'Array of event IDs showing full path from root';

-- ============================================================================
-- Table: consumer_health_status
-- Purpose: Track health and lag of each consumer
-- ============================================================================

CREATE TABLE IF NOT EXISTS consumer_health_status (
    id SERIAL PRIMARY KEY,
    
    consumer_group VARCHAR(255) NOT NULL,
    consumer_name VARCHAR(255) NOT NULL,
    
    -- Health metrics
    status VARCHAR(50) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'offline')),
    
    -- Lag metrics
    topic VARCHAR(255) NOT NULL,
    partition INTEGER NOT NULL,
    current_offset BIGINT,
    latest_offset BIGINT,
    lag BIGINT GENERATED ALWAYS AS (latest_offset - current_offset) STORED,
    
    -- Performance
    messages_processed_last_minute INTEGER DEFAULT 0,
    avg_processing_time_ms NUMERIC(10, 2),
    error_rate_percent NUMERIC(5, 2),
    
    -- Heartbeat
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(consumer_group, consumer_name, topic, partition)
);

CREATE INDEX idx_consumer_health_group ON consumer_health_status(consumer_group);
CREATE INDEX idx_consumer_health_status ON consumer_health_status(status);
CREATE INDEX idx_consumer_health_lag ON consumer_health_status(lag) WHERE lag > 100;
CREATE INDEX idx_consumer_health_heartbeat ON consumer_health_status(last_heartbeat);

COMMENT ON TABLE consumer_health_status IS 'Real-time health monitoring for Kafka consumers';
COMMENT ON COLUMN consumer_health_status.lag IS 'Number of messages behind the latest offset';

-- ============================================================================
-- Function: Update event processing timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_event_processing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_processing_timestamp
    BEFORE UPDATE ON event_processing_status
    FOR EACH ROW
    EXECUTE FUNCTION update_event_processing_timestamp();

-- ============================================================================
-- Function: Update consumer health timestamp
-- ============================================================================

CREATE TRIGGER trigger_update_consumer_health_timestamp
    BEFORE UPDATE ON consumer_health_status
    FOR EACH ROW
    EXECUTE FUNCTION update_event_processing_timestamp();

-- ============================================================================
-- Views: Event Analytics
-- ============================================================================

-- Recent events by topic
CREATE OR REPLACE VIEW v_recent_events_by_topic AS
SELECT 
    topic,
    COUNT(*) as event_count,
    MAX(published_at) as latest_event,
    AVG(CASE WHEN confidence_score IS NOT NULL THEN confidence_score END) as avg_confidence
FROM kafka_events_log
WHERE published_at > NOW() - INTERVAL '24 hours'
GROUP BY topic
ORDER BY event_count DESC;

-- Consumer performance summary
CREATE OR REPLACE VIEW v_consumer_performance AS
SELECT 
    consumer_group,
    consumer_name,
    COUNT(*) FILTER (WHERE status = 'success') as success_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    AVG(duration_ms) as avg_duration_ms,
    MAX(completed_at) as last_processed
FROM event_processing_status
WHERE completed_at > NOW() - INTERVAL '1 hour'
GROUP BY consumer_group, consumer_name;

-- Failed events requiring retry
CREATE OR REPLACE VIEW v_failed_events_retry_queue AS
SELECT 
    eps.id,
    eps.event_id,
    eps.consumer_group,
    eps.consumer_name,
    eps.retry_count,
    eps.max_retries,
    eps.next_retry_at,
    eps.error_message,
    kel.topic,
    kel.event_type,
    kel.published_at
FROM event_processing_status eps
JOIN kafka_events_log kel ON eps.event_id = kel.event_id
WHERE eps.status = 'retrying'
  AND eps.next_retry_at <= NOW()
  AND eps.retry_count < eps.max_retries
ORDER BY eps.next_retry_at;

COMMENT ON VIEW v_recent_events_by_topic IS 'Event counts by topic in last 24 hours';
COMMENT ON VIEW v_consumer_performance IS 'Consumer performance metrics for last hour';
COMMENT ON VIEW v_failed_events_retry_queue IS 'Failed events ready for retry';

-- ============================================================================
-- Grants
-- ============================================================================

-- Grant permissions (adjust based on your user setup)
GRANT SELECT, INSERT ON kafka_events_log TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON kafka_consumer_offsets TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON event_processing_status TO PUBLIC;
GRANT SELECT, INSERT ON event_cascade_trace TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON consumer_health_status TO PUBLIC;

GRANT USAGE, SELECT ON SEQUENCE kafka_events_log_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE event_processing_status_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE event_cascade_trace_id_seq TO PUBLIC;

COMMIT;

-- ============================================================================
-- End Migration 031
-- ============================================================================
