-- ========================================
-- Migration 012: Microsoft Integration
-- ========================================
-- Adds support for Microsoft Outlook/Office 365 integration
-- Stores OAuth tokens and email metadata

-- ========================================
-- Microsoft Account Connections
-- ========================================
-- Store OAuth tokens for Microsoft Graph API access

CREATE TABLE IF NOT EXISTS microsoft_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    microsoft_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id) -- One Microsoft account per user for now
);

-- Index for querying by user
CREATE INDEX idx_microsoft_accounts_user ON microsoft_accounts(user_id);

-- Index for querying by Microsoft user ID
CREATE INDEX idx_microsoft_accounts_microsoft_user ON microsoft_accounts(microsoft_user_id);

-- Index for token expiration checks
CREATE INDEX idx_microsoft_accounts_expires ON microsoft_accounts(token_expires_at) WHERE is_active = true;

-- ========================================
-- Email Metadata
-- ========================================
-- Store email metadata for search and linking to properties

CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    microsoft_account_id UUID NOT NULL REFERENCES microsoft_accounts(id) ON DELETE CASCADE,
    microsoft_message_id VARCHAR(255) NOT NULL, -- Microsoft Graph message ID
    subject TEXT,
    from_name VARCHAR(255),
    from_email VARCHAR(255),
    to_emails TEXT[], -- Array of recipient emails
    cc_emails TEXT[],
    received_at TIMESTAMPTZ NOT NULL,
    body_preview TEXT,
    has_attachments BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    folder_name VARCHAR(100),
    categories TEXT[],
    -- Property linking
    linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    -- Search
    search_vector tsvector,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(microsoft_account_id, microsoft_message_id)
);

-- Index for querying by user
CREATE INDEX idx_emails_user ON emails(user_id, received_at DESC);

-- Index for querying by Microsoft account
CREATE INDEX idx_emails_microsoft_account ON emails(microsoft_account_id, received_at DESC);

-- Index for querying by Microsoft message ID
CREATE INDEX idx_emails_microsoft_message ON emails(microsoft_message_id);

-- Index for querying by property
CREATE INDEX idx_emails_property ON emails(linked_property_id) WHERE linked_property_id IS NOT NULL;

-- Full-text search index
CREATE INDEX idx_emails_search ON emails USING gin(search_vector);

-- Index for unread emails
CREATE INDEX idx_emails_unread ON emails(user_id, is_read, received_at DESC) WHERE is_read = false;

-- ========================================
-- Email Attachments
-- ========================================
-- Store metadata for email attachments

CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    microsoft_attachment_id VARCHAR(255) NOT NULL,
    filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(100),
    size_bytes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by email
CREATE INDEX idx_email_attachments_email ON email_attachments(email_id);

-- ========================================
-- Calendar Events
-- ========================================
-- Store calendar events from Outlook

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    microsoft_account_id UUID NOT NULL REFERENCES microsoft_accounts(id) ON DELETE CASCADE,
    microsoft_event_id VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location VARCHAR(500),
    body_preview TEXT,
    is_all_day BOOLEAN DEFAULT false,
    -- Property linking
    linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(microsoft_account_id, microsoft_event_id)
);

-- Index for querying by user
CREATE INDEX idx_calendar_events_user ON calendar_events(user_id, start_time DESC);

-- Index for querying by date range
CREATE INDEX idx_calendar_events_timerange ON calendar_events(start_time, end_time);

-- Index for querying by property
CREATE INDEX idx_calendar_events_property ON calendar_events(linked_property_id) WHERE linked_property_id IS NOT NULL;

-- ========================================
-- Property Email Links
-- ========================================
-- Track which emails are related to which properties

CREATE TABLE IF NOT EXISTS property_email_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    linked_by UUID NOT NULL REFERENCES users(id),
    link_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'auto_detected', 'ai_suggested'
    confidence_score FLOAT, -- For AI-suggested links
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, email_id)
);

-- Index for querying by property
CREATE INDEX idx_property_email_links_property ON property_email_links(property_id, created_at DESC);

-- Index for querying by email
CREATE INDEX idx_property_email_links_email ON property_email_links(email_id);

-- ========================================
-- Functions
-- ========================================

-- Function: Update search vector for emails
CREATE OR REPLACE FUNCTION update_email_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.body_preview, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.from_name, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.from_email, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update search vector on insert/update
CREATE TRIGGER update_email_search_vector_trigger
    BEFORE INSERT OR UPDATE OF subject, body_preview, from_name, from_email
    ON emails
    FOR EACH ROW
    EXECUTE FUNCTION update_email_search_vector();

-- Function: Update timestamp on microsoft_accounts
CREATE OR REPLACE FUNCTION update_microsoft_accounts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update timestamp
CREATE TRIGGER update_microsoft_accounts_timestamp_trigger
    BEFORE UPDATE ON microsoft_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_microsoft_accounts_timestamp();

-- Function: Update timestamp on emails
CREATE OR REPLACE FUNCTION update_emails_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update timestamp
CREATE TRIGGER update_emails_timestamp_trigger
    BEFORE UPDATE ON emails
    FOR EACH ROW
    EXECUTE FUNCTION update_emails_timestamp();

-- ========================================
-- Views
-- ========================================

-- View: Emails with property information
CREATE OR REPLACE VIEW emails_with_properties AS
SELECT 
    e.*,
    p.address_line1,
    p.city,
    p.state_code,
    p.property_type
FROM emails e
LEFT JOIN properties p ON e.linked_property_id = p.id;

-- View: Property email summary
CREATE OR REPLACE VIEW property_email_summary AS
SELECT 
    p.id as property_id,
    p.address_line1,
    p.city,
    p.state_code,
    COUNT(DISTINCT e.id) as total_emails,
    COUNT(DISTINCT e.id) FILTER (WHERE e.is_read = false) as unread_emails,
    MAX(e.received_at) as last_email_at
FROM properties p
LEFT JOIN emails e ON e.linked_property_id = p.id
GROUP BY p.id, p.address_line1, p.city, p.state_code;

-- View: User email statistics
CREATE OR REPLACE VIEW user_email_stats AS
SELECT 
    u.id as user_id,
    u.email as user_email,
    COUNT(DISTINCT e.id) as total_emails,
    COUNT(DISTINCT e.id) FILTER (WHERE e.is_read = false) as unread_emails,
    COUNT(DISTINCT e.linked_property_id) FILTER (WHERE e.linked_property_id IS NOT NULL) as linked_emails,
    MAX(e.received_at) as last_email_at,
    ma.email as microsoft_email,
    ma.is_active as microsoft_connected
FROM users u
LEFT JOIN microsoft_accounts ma ON u.id = ma.user_id
LEFT JOIN emails e ON u.id = e.user_id
GROUP BY u.id, u.email, ma.email, ma.is_active;

-- ========================================
-- Comments
-- ========================================

COMMENT ON TABLE microsoft_accounts IS 'Stores OAuth tokens for Microsoft Graph API access';
COMMENT ON TABLE emails IS 'Email metadata with full-text search and property linking';
COMMENT ON TABLE email_attachments IS 'Metadata for email attachments';
COMMENT ON TABLE calendar_events IS 'Calendar events from Outlook';
COMMENT ON TABLE property_email_links IS 'Links between properties and emails';

COMMENT ON COLUMN microsoft_accounts.scopes IS 'OAuth scopes granted';
COMMENT ON COLUMN emails.search_vector IS 'Full-text search vector (auto-updated)';
COMMENT ON COLUMN emails.linked_property_id IS 'Property this email relates to';
COMMENT ON COLUMN property_email_links.link_type IS 'How the link was created: manual, auto_detected, or ai_suggested';
COMMENT ON COLUMN property_email_links.confidence_score IS 'AI confidence score for suggested links (0-1)';

-- ========================================
-- Row-Level Security
-- ========================================

ALTER TABLE microsoft_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_email_links ENABLE ROW LEVEL SECURITY;

-- Users can only access their own Microsoft accounts
CREATE POLICY microsoft_accounts_user_policy ON microsoft_accounts
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Users can only access their own emails
CREATE POLICY emails_user_policy ON emails
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Users can only access attachments from their own emails
CREATE POLICY email_attachments_user_policy ON email_attachments
    FOR ALL
    USING (
        email_id IN (
            SELECT id FROM emails WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Users can only access their own calendar events
CREATE POLICY calendar_events_user_policy ON calendar_events
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Users can only access property links for properties they can see
CREATE POLICY property_email_links_user_policy ON property_email_links
    FOR ALL
    USING (
        email_id IN (
            SELECT id FROM emails WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- ========================================
-- Sample Functions
-- ========================================

-- Function: Search emails by full-text query
CREATE OR REPLACE FUNCTION search_emails(
    p_user_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    subject TEXT,
    from_name VARCHAR,
    from_email VARCHAR,
    received_at TIMESTAMPTZ,
    body_preview TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.subject,
        e.from_name,
        e.from_email,
        e.received_at,
        e.body_preview,
        ts_rank(e.search_vector, plainto_tsquery('english', p_query)) as rank
    FROM emails e
    WHERE e.user_id = p_user_id
        AND e.search_vector @@ plainto_tsquery('english', p_query)
    ORDER BY rank DESC, e.received_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-link emails to properties by address matching
CREATE OR REPLACE FUNCTION auto_link_emails_to_properties()
RETURNS INTEGER AS $$
DECLARE
    link_count INTEGER := 0;
BEGIN
    -- Link emails that mention property addresses in subject or body
    INSERT INTO property_email_links (property_id, email_id, linked_by, link_type, confidence_score)
    SELECT DISTINCT
        p.id,
        e.id,
        e.user_id,
        'auto_detected',
        0.8 -- High confidence for address matches
    FROM emails e
    CROSS JOIN properties p
    WHERE e.linked_property_id IS NULL
        AND (
            e.subject ILIKE '%' || p.address_line1 || '%'
            OR e.body_preview ILIKE '%' || p.address_line1 || '%'
        )
        AND NOT EXISTS (
            SELECT 1 FROM property_email_links pel
            WHERE pel.property_id = p.id AND pel.email_id = e.id
        );
    
    GET DIAGNOSTICS link_count = ROW_COUNT;
    
    -- Update linked_property_id for newly linked emails
    UPDATE emails e
    SET linked_property_id = pel.property_id
    FROM property_email_links pel
    WHERE e.id = pel.email_id
        AND e.linked_property_id IS NULL
        AND pel.link_type = 'auto_detected';
    
    RETURN link_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Migration Complete
-- ========================================

COMMENT ON SCHEMA public IS 'JediRe Microsoft Integration - Migration 012 Complete';
