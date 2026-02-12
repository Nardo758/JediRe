-- ========================================
-- Migration 014: Account Structure
-- ========================================
-- Support for Individual, Organization, Enterprise, and Partner accounts
-- Multi-user organizations with role-based access

-- ========================================
-- ACCOUNTS
-- ========================================

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('individual', 'organization', 'enterprise', 'partner')),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255), -- For organizations
    slug VARCHAR(100) UNIQUE, -- URL-friendly identifier for orgs
    owner_id UUID NOT NULL REFERENCES users(id),
    -- Organization details
    company_size VARCHAR(20), -- 'small', 'medium', 'large'
    industry VARCHAR(100),
    website VARCHAR(255),
    -- Subscription
    subscription_tier VARCHAR(20) DEFAULT 'free', -- 'free', 'basic', 'pro', 'team', 'enterprise'
    subscription_status VARCHAR(20) DEFAULT 'active', -- 'active', 'cancelled', 'suspended'
    trial_ends_at TIMESTAMPTZ,
    subscription_starts_at TIMESTAMPTZ,
    -- Limits
    max_users INTEGER DEFAULT 1, -- Based on subscription
    max_maps INTEGER DEFAULT 5, -- Based on subscription
    max_properties INTEGER DEFAULT 100, -- Based on subscription
    -- Settings
    settings JSONB DEFAULT '{
        "branding": {},
        "notifications": {},
        "integrations": {},
        "billing": {}
    }'::jsonb,
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_owner ON accounts(owner_id);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_slug ON accounts(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_accounts_subscription ON accounts(subscription_tier, subscription_status);

-- ========================================
-- UPDATE USERS TABLE
-- ========================================

-- Add account relationship to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'custom'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
    "can_create_maps": true,
    "can_delete_maps": false,
    "can_invite_users": false,
    "can_manage_billing": false,
    "can_export_data": true,
    "can_use_ai": true,
    "can_access_api": false
}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE INDEX idx_users_account ON users(account_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- ========================================
-- ACCOUNT INVITATIONS
-- ========================================

CREATE TABLE IF NOT EXISTS account_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    permissions JSONB DEFAULT '{}'::jsonb,
    invited_by UUID NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_invitations_account ON account_invitations(account_id);
CREATE INDEX idx_account_invitations_email ON account_invitations(email);
CREATE INDEX idx_account_invitations_token ON account_invitations(token);
CREATE INDEX idx_account_invitations_pending ON account_invitations(expires_at) 
    WHERE accepted_at IS NULL AND expires_at > NOW();

-- ========================================
-- ROLE TEMPLATES
-- ========================================

CREATE TABLE IF NOT EXISTS role_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE, -- NULL = system template
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL,
    is_system BOOLEAN DEFAULT false, -- System roles can't be deleted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_role_templates_account ON role_templates(account_id);

-- ========================================
-- ACCOUNT USAGE TRACKING
-- ========================================

CREATE TABLE IF NOT EXISTS account_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    -- Usage metrics
    active_users INTEGER DEFAULT 0,
    maps_created INTEGER DEFAULT 0,
    properties_added INTEGER DEFAULT 0,
    emails_processed INTEGER DEFAULT 0,
    news_articles_added INTEGER DEFAULT 0,
    ai_requests INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    storage_mb INTEGER DEFAULT 0,
    -- Computed metrics
    total_users INTEGER DEFAULT 0,
    total_maps INTEGER DEFAULT 0,
    total_properties INTEGER DEFAULT 0,
    -- Billing
    amount_due DECIMAL(10, 2) DEFAULT 0.00,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, period_start)
);

CREATE INDEX idx_account_usage_account ON account_usage(account_id, period_start DESC);
CREATE INDEX idx_account_usage_period ON account_usage(period_start, period_end);
CREATE INDEX idx_account_usage_unpaid ON account_usage(paid_at) WHERE paid_at IS NULL;

-- ========================================
-- PARTNER CLIENT RELATIONSHIPS
-- ========================================

CREATE TABLE IF NOT EXISTS partner_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    client_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) DEFAULT 'consulting', -- 'consulting', 'brokerage', 'advisory'
    commission_rate DECIMAL(5, 2), -- Percentage
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'ended'
    notes TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(partner_account_id, client_account_id)
);

CREATE INDEX idx_partner_clients_partner ON partner_clients(partner_account_id);
CREATE INDEX idx_partner_clients_client ON partner_clients(client_account_id);
CREATE INDEX idx_partner_clients_status ON partner_clients(status);

-- ========================================
-- FUNCTIONS
-- ========================================

-- Create individual account for new user
CREATE OR REPLACE FUNCTION create_individual_account_for_user()
RETURNS TRIGGER AS $$
DECLARE
    new_account_id UUID;
BEGIN
    -- Only create account if user doesn't have one
    IF NEW.account_id IS NULL THEN
        INSERT INTO accounts (type, name, owner_id, max_users, max_maps, max_properties)
        VALUES ('individual', NEW.full_name || '''s Account', NEW.id, 1, 5, 100)
        RETURNING id INTO new_account_id;
        
        NEW.account_id := new_account_id;
        NEW.role := 'owner';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_account_for_user_trigger
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_individual_account_for_user();

-- Update account timestamp
CREATE OR REPLACE FUNCTION update_account_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accounts_timestamp
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_account_timestamp();

-- Check account limits before creating resources
CREATE OR REPLACE FUNCTION check_account_limits()
RETURNS TRIGGER AS $$
DECLARE
    account_record RECORD;
    current_count INTEGER;
BEGIN
    -- Get account details
    SELECT * INTO account_record 
    FROM accounts 
    WHERE id = (SELECT account_id FROM users WHERE id = NEW.owner_id OR id = NEW.created_by LIMIT 1);
    
    -- Check map limit
    IF TG_TABLE_NAME = 'maps' THEN
        SELECT COUNT(*) INTO current_count FROM maps WHERE owner_id = NEW.owner_id;
        IF current_count >= account_record.max_maps THEN
            RAISE EXCEPTION 'Map limit reached for this account (% of %)', current_count, account_record.max_maps;
        END IF;
    END IF;
    
    -- Check property limit
    IF TG_TABLE_NAME = 'property_pins' THEN
        SELECT COUNT(*) INTO current_count 
        FROM property_pins pp
        JOIN map_pins mp ON pp.map_pin_id = mp.id
        JOIN maps m ON mp.map_id = m.id
        JOIN users u ON m.owner_id = u.id
        WHERE u.account_id = account_record.id;
        
        IF current_count >= account_record.max_properties THEN
            RAISE EXCEPTION 'Property limit reached for this account (% of %)', current_count, account_record.max_properties;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply limit checks (commented out initially, enable when ready)
-- CREATE TRIGGER check_map_limits_trigger
--     BEFORE INSERT ON maps
--     FOR EACH ROW
--     EXECUTE FUNCTION check_account_limits();

-- CREATE TRIGGER check_property_limits_trigger
--     BEFORE INSERT ON property_pins
--     FOR EACH ROW
--     EXECUTE FUNCTION check_account_limits();

-- ========================================
-- VIEWS
-- ========================================

-- Account overview with usage
CREATE OR REPLACE VIEW account_overview AS
SELECT 
    a.id as account_id,
    a.type,
    a.name,
    a.subscription_tier,
    a.subscription_status,
    a.max_users,
    a.max_maps,
    a.max_properties,
    COUNT(DISTINCT u.id) as current_users,
    COUNT(DISTINCT m.id) as current_maps,
    COUNT(DISTINCT pp.id) as current_properties,
    a.created_at
FROM accounts a
LEFT JOIN users u ON a.id = u.account_id AND u.is_active = true
LEFT JOIN maps m ON u.id = m.owner_id
LEFT JOIN map_pins mp ON m.id = mp.map_id AND mp.type = 'property'
LEFT JOIN property_pins pp ON mp.id = pp.map_pin_id
GROUP BY a.id, a.type, a.name, a.subscription_tier, a.subscription_status, 
         a.max_users, a.max_maps, a.max_properties, a.created_at;

-- Team members for organizations
CREATE OR REPLACE VIEW team_members AS
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.account_id,
    u.role,
    u.permissions,
    u.is_active,
    u.last_active_at,
    u.created_at as joined_at,
    a.name as account_name,
    a.type as account_type
FROM users u
JOIN accounts a ON u.account_id = a.id
WHERE a.type IN ('organization', 'enterprise', 'partner');

-- ========================================
-- ROW-LEVEL SECURITY
-- ========================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_usage ENABLE ROW LEVEL SECURITY;

-- Users can see their own account
CREATE POLICY accounts_access_policy ON accounts
    FOR ALL
    USING (
        owner_id = current_setting('app.current_user_id')::UUID
        OR id IN (
            SELECT account_id FROM users WHERE id = current_setting('app.current_user_id')::UUID
        )
    );

-- Users can see invitations for their account
CREATE POLICY account_invitations_policy ON account_invitations
    FOR ALL
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = current_setting('app.current_user_id')::UUID
        )
        OR email IN (
            SELECT email FROM users WHERE id = current_setting('app.current_user_id')::UUID
        )
    );

-- ========================================
-- SEED DATA (System Role Templates)
-- ========================================

INSERT INTO role_templates (role_name, description, permissions, is_system) VALUES
('Owner', 'Full access to everything', '{
    "can_create_maps": true,
    "can_delete_maps": true,
    "can_invite_users": true,
    "can_remove_users": true,
    "can_manage_billing": true,
    "can_export_data": true,
    "can_use_ai": true,
    "can_access_api": true,
    "can_delete_account": true
}'::jsonb, true),

('Admin', 'Manage users and settings', '{
    "can_create_maps": true,
    "can_delete_maps": true,
    "can_invite_users": true,
    "can_remove_users": true,
    "can_manage_billing": false,
    "can_export_data": true,
    "can_use_ai": true,
    "can_access_api": true,
    "can_delete_account": false
}'::jsonb, true),

('Member', 'Standard user access', '{
    "can_create_maps": true,
    "can_delete_maps": false,
    "can_invite_users": false,
    "can_remove_users": false,
    "can_manage_billing": false,
    "can_export_data": true,
    "can_use_ai": true,
    "can_access_api": false,
    "can_delete_account": false
}'::jsonb, true),

('Viewer', 'Read-only access', '{
    "can_create_maps": false,
    "can_delete_maps": false,
    "can_invite_users": false,
    "can_remove_users": false,
    "can_manage_billing": false,
    "can_export_data": false,
    "can_use_ai": false,
    "can_access_api": false,
    "can_delete_account": false
}'::jsonb, true);

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE accounts IS 'Organizations and individual accounts';
COMMENT ON TABLE account_invitations IS 'Pending invitations to join an account';
COMMENT ON TABLE role_templates IS 'Reusable permission templates';
COMMENT ON TABLE account_usage IS 'Track usage for billing and limits';
COMMENT ON TABLE partner_clients IS 'Partner-client relationships for consultants/brokers';

COMMENT ON COLUMN accounts.type IS 'Account type: individual, organization, enterprise, partner';
COMMENT ON COLUMN accounts.subscription_tier IS 'Subscription plan level';
COMMENT ON COLUMN accounts.max_users IS 'Maximum users allowed on this account';
COMMENT ON COLUMN accounts.max_maps IS 'Maximum maps allowed on this account';
COMMENT ON COLUMN accounts.max_properties IS 'Maximum properties allowed on this account';

-- ========================================
-- Migration Complete
-- ========================================

COMMENT ON SCHEMA public IS 'JediRe Account Structure - Migration 014 Complete';
