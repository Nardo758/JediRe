-- Task #329: per-user news subscription connections (email forwarding, RSS, OAuth)
-- New tables only; no changes to existing schema.

CREATE TABLE IF NOT EXISTS user_news_connections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('email','rss','oauth')),
    label         TEXT NOT NULL,
    -- For type=email: the unique inbound address (e.g. <userId>+abcd@inbox.jedire.app)
    -- For type=rss : the personalized feed URL (HTTPS preferred)
    -- For type=oauth: the provider id (bloomberg|reuters|refinitiv)
    address       TEXT,
    -- Encrypted credentials (libsodium-style ciphertext "iv:ct" via utils/encryption.ts).
    -- Used by RSS auth (basic-auth or token in URL) and OAuth refresh tokens.
    encrypted_credentials TEXT,
    -- Free-form metadata: detected publications, last poll timestamp, last error, etc.
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','error','pending_oauth')),
    last_synced_at TIMESTAMPTZ,
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_news_connections_user
    ON user_news_connections(user_id, status);

-- Inbound email tokens are unique so the webhook can route forwards to the
-- right connection without leaking any other user's address.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_news_connections_address
    ON user_news_connections(address)
    WHERE address IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_news_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES user_news_connections(id) ON DELETE CASCADE,
    -- Stable dedupe key per (user, source url). Hash of canonical URL.
    dedupe_key    TEXT NOT NULL,
    source        TEXT NOT NULL,         -- e.g. 'wsj_realestate_daily', 'ft_personal_rss'
    publisher     TEXT,                  -- e.g. 'WSJ', 'FT', 'Bloomberg'
    url           TEXT NOT NULL,
    title         TEXT NOT NULL,
    summary       TEXT,
    author        TEXT,
    published_at  TIMESTAMPTZ,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Optional MSA/deal tagging for per-deal widgets later.
    relevant_msas  JSONB NOT NULL DEFAULT '[]'::jsonb,
    relevant_deals JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_news_items_dedupe
    ON user_news_items(user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_user_news_items_user_recent
    ON user_news_items(user_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_news_items_connection
    ON user_news_items(connection_id, fetched_at DESC);

-- GIN indexes so per-deal/per-msa widgets can filter quickly later.
CREATE INDEX IF NOT EXISTS idx_user_news_items_deals
    ON user_news_items USING GIN (relevant_deals);

CREATE INDEX IF NOT EXISTS idx_user_news_items_msas
    ON user_news_items USING GIN (relevant_msas);
