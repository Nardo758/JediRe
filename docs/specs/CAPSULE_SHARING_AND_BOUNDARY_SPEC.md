# CAPSULE SHARING AND BOUNDARY SPEC v1.1

**Status:** Draft v1.1 — updated for share:shortcode + DealDetailPage architecture
**Owner:** Leon / JEDI RE
**Module designation:** M41-M45
**Purpose:** Define how the platform interacts at its boundaries — between platform users, between platform and external recipients (capsule consumption with connect-your-API), between platform values and source documents (evidence linkage and downloads), and between platform-native analysis and exportable artifacts (Excel models, pitch decks).

**Key architectural update (v1.1):** Recipients consume shared deals through `DealDetailPage` in recipient mode, not a separate surface. The DealDetailPage reads `shortcode` from URL params when available and runs in authenticated (platform owner) or ephemeral (share shortcode) mode. The `/share/:shortcode` landing page (`ShareLandingPage`) presents the branded entry point; navigating into `/share/:shortcode/deal` renders the full Bloomberg-style F-key surface.

**Pairs with:**
- `SCENARIO_MANAGEMENT_SPEC.md` (forked workspaces inherit active scenario)
- `EVENT_PROPAGATION_AUDIT.md` (DealDetailPage cross-tab events in recipient mode)
- `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` (CIE flows into recipient context)
- `OTHER_INCOME_REASONING_METHOD_SPEC.md` (agent methods unchanged across boundaries)
- Existing Stripe Token Billing infrastructure
- Existing Deal Capsule infrastructure

---

## 1. PURPOSE AND UNIFYING THEME

The platform has been built primarily as a single-user-per-deal analytical workspace. Five gaps surface where the platform meets the outside world:

1. Users can't download the source documents they uploaded
2. Users can't trace platform values back to the specific document, page, and span the values came from
3. When a deal is shared to another platform user, that user can't apply their own data and reasoning — they just see the sender's analysis
4. When a deal is shared to a non-platform recipient (lender, LP, broker), the recipient gets a static artifact with no analytical capability
5. Sponsors need polished outputs (Excel models, pitch decks) for external distribution

The unifying theme is **the boundary** — between platform and user, platform and recipient, parsed value and source, native surface and exported artifact.

---

## 2. THE FIVE PIECES

### Piece 1 — Document Center download capability
Users can download files they previously uploaded; access logged for audit.

### Piece 2 — Evidence-to-source linkage
Every value in the Pro Forma traces to a specific document, page, and span. The evidence drawer surfaces this with one-click access to the raw source.

### Piece 3 — Platform-user forked workspace
When User A shares a deal with User B (also on the platform), B gets a forked workspace with A's deal context but B's platform data and B's agent reasoning. A's analysis stays with A.

### Piece 4 — Non-platform recipient with connect-your-API
External recipients (lender, LP, broker) receive a `/share/:shortcode` link. The landing page (`ShareLandingPage`) presents the deal capsule with preview fields; navigating to `/share/:shortcode/deal` renders `DealDetailPage` in recipient mode — the same Bloomberg-style F1-F11 tab surface platform owners use, scoped to the shared deal. Recipients connect their own API key to use the agent. Platform earns margin on every query.

### Piece 5 — Excel and pitch deck export
Sponsors generate downloadable Excel models and pitch decks. Recipients can also export from the share surface.

---

## 3. PIECE 1 — DOCUMENT CENTER DOWNLOAD

### 3.1 Scope

Users can download any source document they (or their organization) previously uploaded to a deal.

### 3.2 Functional requirements

**Download access:**
- Per-document download button in the Document Center UI
- Returns the original file as uploaded (no transformation)
- File format and filename preserved

**Bulk download:**
- "Download all documents for this deal" option
- Returns a ZIP archive with manifest CSV (filename, document type, upload date, uploaded_by)

**Audit trail:**
- Every download logged to `document_access_log` table
- Log captures: user_id, document_id, deal_id, access_timestamp, ip_address, access_type

### 3.3 Data model

```sql
CREATE TABLE document_access_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  capsule_id UUID REFERENCES deal_capsules(id),
  accessed_by_user_id UUID REFERENCES users(id),
  accessed_by_recipient_token TEXT,
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download_single', 'download_bulk')),
  access_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  CONSTRAINT doc_access_either_user_or_recipient
    CHECK (accessed_by_user_id IS NOT NULL OR accessed_by_recipient_token IS NOT NULL)
);
```

### 3.4 API surface

```
GET    /api/v1/deals/:dealId/documents                    → List documents
GET    /api/v1/deals/:dealId/documents/:docId/download    → Single download
GET    /api/v1/deals/:dealId/documents/bulk_download      → Bulk ZIP
GET    /api/v1/deals/:dealId/documents/access_log         → Audit log (owner only)
```

### 3.5 Permissions

- Deal owner: full access
- Forked workspace owner: access to inherited + self-uploaded documents
- Non-platform recipient: controlled by `allow_document_download` on the share

---

## 4. PIECE 2 — EVIDENCE-TO-SOURCE LINKAGE

### 4.1 Scope

Every Pro Forma value carries a source reference to the specific document, page, and span. The evidence drawer surfaces this with one-click access to the raw source.

### 4.2 Source reference structure

```typescript
interface SourceReference {
  document_id: string;
  document_type: 't12' | 'rent_roll' | 'om' | 'insurance' | 'tax_record' | 'manual_entry' | 'other';
  document_filename: string;
  location: {
    page_number?: number;
    sheet_name?: string;
    row_number?: number;
    column_letter?: string;
    span_start?: number;
    span_end?: number;
    bounding_box?: { x: number; y: number; width: number; height: number };
  };
  raw_text_at_location: string;
  parser_confidence: number;  // 0-1
  parsed_value_field: string;
  parsed_value: number | string;
  transformations_applied: string[];
}
```

### 4.3 Evidence drawer

When the user opens the evidence drawer on a Pro Forma field:
- Agent reasoning narrative (existing)
- Cohort comparison (existing)
- Source section: document name/type, "View in document" button, raw text, confidence indicator

**Document viewer:** renders the source document at the referenced location with highlighting. "Download original" button always available.

### 4.4 Special handling

- **Manual entry values:** `document_type: 'manual_entry'` with user attribution + timestamp
- **Agent-derived values:** references inputs used in derivation
- **Platform-default values:** `document_type: 'platform_default'` with config reference

### 4.5 Effort estimate

3-4 sessions. Parser layer changes are the heavy part.

---

## 5. PIECE 3 — PLATFORM-USER FORKED WORKSPACE

### 5.1 Scope

When User A shares a deal with User B (also on the platform), B gets a forked workspace. The fork carries A's deal context but applies B's platform data and agent reasoning.

**What forks carry forward:**
- All source documents
- Document parsing results (extraction capsules)
- Deal Capsule structure (property info, strategy, entity setup)
- Active scenario at fork time
- Source references

**What forks do NOT inherit:**
- Other scenarios beyond the active one
- A's agent runs and reasoning history
- A's CIE findings
- A's owned-portfolio context
- A's archive cohort match (recomputed for B)
- A's override values

### 5.2 Fork relationship model

```sql
CREATE TABLE deal_forks (
  fork_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_deal_id UUID NOT NULL REFERENCES deals(deal_id),
  forked_deal_id UUID NOT NULL REFERENCES deals(deal_id),
  forked_by_user_id UUID NOT NULL REFERENCES users(user_id),
  forked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  forked_from_scenario_id UUID REFERENCES deal_scenarios(scenario_id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

**Fork lifecycle:**
- A shares deal with B; B opens `/share/:shortcode` and clicks "Fork to my workspace"
- New deal record + `deal_forks` row created
- A's subsequent edits do NOT propagate to B's fork
- B can re-fork to refresh (creates new fork; previous fork preserved)

### 5.3 API surface

```
POST /api/v1/deals/:dealId/share         → Create platform-user share (shortcode generated)
POST /api/v1/shares/:shortcode/fork       → Recipient accepts; fork created
GET  /api/v1/deals/:dealId/forks          → Source deal owner sees forks
GET  /api/v1/deals/:dealId/source         → Fork owner sees source deal metadata
```

### 5.4 Effort estimate

3-4 sessions.

---

## 6. PIECE 4 — NON-PLATFORM RECIPIENT WITH CONNECT-YOUR-API

### 6.1 Scope

External recipients (lender, LP, broker, prospective user) receive a `/share/:shortcode` link. The flow:

1. **ShareLandingPage** (`/share/:shortcode`) — branded entry point, deal preview, quick metrics, "View Deal" CTA
2. **DealDetailPage** (`/share/:shortcode/deal`) — full Bloomberg-style F1-F11 tab surface in recipient mode
3. **RecipientConnectModal** — API key connection (Anthropic/OpenAI)
4. **RecipientAgentPanel** — agent Q&A using connected key

### 6.2 Routing architecture

```
/share/:shortcode           → ShareLandingPage (branded entry, preview, download)
/share/:shortcode/deal      → DealDetailPage in recipient mode (full F-key surface)
```

The `DealDetailPage` detects recipient mode via the `shortcode` URL param:
- `isRecipient` flag controls owner-only elements (share button, settings hidden)
- Data fetched via share-scoped endpoints, not platform auth
- `RecipientContext` provides share-scoped session state
- F-key screens render normally with recipient-scoped data
- Agent panel uses connected API key, not platform's key
- Branding attribution overlay appears

### 6.3 Deal-scoped agent access

**Recipient agent CAN access:**
- This deal's source documents (subject to share permissions)
- This deal's parsed values
- This deal's source references
- This deal's active scenario state
- This deal's CIE findings (sender's, active scenario only)
- Archive cohort distributions (filtered to this deal's comparables)
- Market trends for this submarket
- Comp set data

**Recipient agent CANNOT access:**
- Other deals
- Sender's owned-portfolio
- Sender's full scenario history
- Full Knowledge Graph beyond deal references
- Cross-deal patterns

### 6.4 Connect-your-API flow

1. Recipient opens `/share/:shortcode` → `ShareLandingPage` renders
2. Recipient navigates to `/share/:shortcode/deal` → `DealDetailPage` in recipient mode
3. To use agent, `RecipientAgentPanel` shows "Connect your API key"
4. `RecipientConnectModal` opens: choose provider, paste key
5. Platform validates and stores encrypted (AES-256-GCM)
6. Recipient asks questions; queries route through Stripe Token Billing wrapper
7. Usage logged to `recipient_query_log` (content NOT stored, only tokens + cost)

### 6.5 Pricing model

| Dimension | Subscriber | Recipient |
|---|---|---|
| Per-query cost basis | API provider's rate | API provider's rate |
| Platform margin | ~40% | ~100-150% |
| Commitment | Monthly subscription | Pay-as-you-go |

**Conversion triggers:** heavy usage (~$30+), cross-deal access, sophisticated queries → surface upgrade prompt.

### 6.6 Data model

```sql
-- Core external share table
CREATE TABLE capsule_external_shares (
    share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capsule_id UUID NOT NULL REFERENCES deal_capsules(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES users(id),
    share_type TEXT NOT NULL CHECK (share_type IN ('external_view', 'external_agent_enabled')),
    recipient_email TEXT,
    recipient_name TEXT,
    allow_document_download BOOLEAN NOT NULL DEFAULT TRUE,
    allow_agent_interaction BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    access_token TEXT UNIQUE,
    share_url TEXT,
    shortcode TEXT UNIQUE,
    preview_text TEXT CHECK (preview_text IS NULL OR length(preview_text) <= 500),
    preview_metadata JSONB CHECK (preview_metadata IS NULL OR jsonb_typeof(preview_metadata) = 'object'),
    show_attribution_override BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT external_share_requires_token
        CHECK (share_type NOT IN ('external_view', 'external_agent_enabled') OR access_token IS NOT NULL)
);

-- Recipient API connections (AES-256-GCM encrypted)
CREATE TABLE recipient_api_connections (
    connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES capsule_external_shares(share_id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'other')),
    api_key_encrypted TEXT NOT NULL,
    stripe_customer_id TEXT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    total_queries INTEGER NOT NULL DEFAULT 0,
    total_tokens_consumed BIGINT NOT NULL DEFAULT 0,
    total_charges_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    platform_margin_usd NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Query usage log (content NOT stored)
CREATE TABLE recipient_query_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES recipient_api_connections(connection_id) ON DELETE CASCADE,
    query_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tokens_input INTEGER,
    tokens_output INTEGER,
    cost_basis_usd NUMERIC(8,4),
    platform_margin_usd NUMERIC(8,4),
    total_charged_usd NUMERIC(8,4),
    query_category TEXT,
    response_status TEXT
);

-- Document access audit
CREATE TABLE document_access_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    capsule_id UUID REFERENCES deal_capsules(id),
    accessed_by_user_id UUID REFERENCES users(id),
    accessed_by_recipient_token TEXT,
    access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download_single', 'download_bulk')),
    access_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    CONSTRAINT doc_access_either_user_or_recipient
        CHECK (accessed_by_user_id IS NOT NULL OR accessed_by_recipient_token IS NOT NULL)
);
```

### 6.7 Agent runtime

```typescript
function buildRecipientDealContext(
  shareId: string,
  recipientConnectionId: string,
): RecipientDealContext {
  const share = await fetchExternalShare(shareId);
  const capsule = await fetchDealCapsule(share.capsule_id);
  const deal = await fetchDeal(capsule.deal_id);

  return {
    deal_info: capsule.public_metadata,
    documents: await fetchDocuments(capsule.id),
    scenario_state: capsule.scenario?.year1,
    source_references: await fetchSourceReferences(capsule.id, capsule.scenario?.scenario_id),
    ci_findings: await fetchCiFindings(capsule.scenario?.scenario_id),
    comparable_cohort: await fetchComparableCohort(deal),
    market_trends: await fetchMarketTrends(deal.submarket),
    comp_set: await fetchCompSet(deal),
    // Bypass prevention — explicitly excluded
    sender_owned_portfolio: null,
    other_scenarios: null,
    full_knowledge_graph: null,
    other_deals: null,
    recipient_provider: connection.provider,
    is_platform_subscriber: false,
  };
}
```

### 6.8 ShareLandingPage (`/share/:shortcode`)

Renders:
- **Header:** Sender's platform name (branding attribution), deal name, property image
- **Preview section:** `preview_text` and `preview_metadata` from share
- **Quick metrics badge row:** key financials from capsule data layer
- **Document access:** "Download Documents" button if `allow_document_download`
- **Agent prompt:** "View Deal & Connect API Key" CTA if `external_agent_enabled`
- **"View Deal" CTA:** navigates to `/share/:shortcode/deal`

### 6.9 DealDetailPage (`/share/:shortcode/deal`)

Full F1-F11 Bloomberg-style surface in recipient mode:

| Key | Tab | Behavior in recipient mode |
|---|---|---|
| F1 | Overview | Property summary, metrics, strategy |
| F2 | Pro Forma | Read-only model (overrides disabled unless explicitly allowed) |
| F3 | Rent Roll | Unit mix, rent schedule, concessions |
| F4 | Markets | Submarket data, comp set, trends |
| F5 | Charts | Performance visualizations |
| F6 | Documents | Document Center (permission-controlled) |
| F7 | CIE | Competitive intelligence findings |
| F8 | Comps | Comparable analysis |
| F9 | Financials | Deal underwriting engine (read-only) |
| F10 | Exports | Excel/PDF download buttons |
| F11 | Agent | RecipientAgentPanel: connect key + ask questions |

**Recipient-mode behaviors:**
- Share button/settings — owner-only, hidden
- Attribution overlay — sender branding shown
- Data fetched via share-scoped endpoints (not platform auth)
- Scenario editing restricted to view-only
- Agent uses connected API key, not platform's key

### 6.10 API surface

```
POST   /api/v1/deals/:dealId/share/external
  → Create external share
  → Body: { recipient_email, share_type, allow_document_download, allow_agent_interaction,
            expires_at?, preview_text?, preview_metadata?, show_attribution_override? }
  → Returns: { share_id, share_url (/share/:shortcode), shortcode, access_token }

GET    /api/v1/shares/:shortcode
  → Resolve share (no auth required)
  → Rate limited (5 req/10min per IP)
  → Returns: capsule metadata + preview + share settings
  → Bypass prevention: NO deal metadata returned (no deal_name, city, state, etc.)

POST   /api/v1/shares/:shortcode/connect_api
  → Body: { provider, api_key }
  → Key validated and stored AES-256-GCM encrypted

POST   /api/v1/shares/:shortcode/query
  → Body: { message }
  → Routes through Stripe + recipient's API key
  → Returns: agent response + token usage

POST   /api/v1/shares/:shortcode/fork
  → Platform user forks to workspace (requires auth)
  → Returns: new forked_deal_id

GET    /api/v1/shares/:shortcode/export/:format (excel|pdf)
  → Export as Excel or pitch deck PDF

DELETE /api/v1/shares/:shortcode/connect_api
  → Disconnect API key

POST   /api/v1/shares/:shortcode/upgrade
  → Upgrade CTA → sign-up with share context preserved

GET    /api/v1/shares/:shortcode/connection
  → Returns: { connected: true/false }

GET    /api/v1/capsule-links/:accessToken
  → Legacy URL → redirect to /share/:shortcode
```

### 6.11 Verification criteria

1. Sender creates external share; recipient gets `/share/:shortcode` link
2. `ShareLandingPage` renders preview, metrics, "View Deal" CTA
3. `/share/:shortcode/deal` → `DealDetailPage` renders all F-key tabs in recipient mode
4. Owner-only elements hidden (share button, settings)
5. Branding attribution shows sender's platform name
6. Recipient connects API key; encrypted and validated
7. Agent runs with deal-scoped context (no sender portfolio access)
8. Usage logged to `recipient_query_log`; content NOT stored
9. Rate limiting active (5 req/10min per IP on resolution)
10. Metadata-free resolution response (deal_name, city, state, property_type, units NOT returned)
11. Sender revokes share → recipient access returns 410

### 6.12 Effort estimate

4-5 sessions.

---

## 7. PIECE 5 — EXCEL AND PITCH DECK EXPORT

### 7.1 Scope

Sponsors and recipients generate downloadable artifacts: Excel models and pitch deck PDFs.

### 7.2 Excel model

- Full Pro Forma at active scenario state
- Assumptions tab with year1 values + resolution layers
- Supporting tabs: Sources & Uses, Sensitivities, Returns, Waterfall
- Formulas preserved (recipient can modify and recompute)
- Cell comments linking to source references
- Cover sheet: deal info, sender attribution, generation timestamp

### 7.3 Pitch deck

- Cover, investment summary, property overview, market analysis
- Financial summary, value creation, sensitivity, appendix
- Template-based PDF generation with chart rendering
- Sponsor branding configurable

### 7.4 API surface

```
POST /api/v1/deals/:dealId/generate_artifact
  → Body: { artifact_type, scenario_id?, template_id, customization? }
  → Async generation

POST /api/v1/shares/:shortcode/export/:format (excel|pdf)
  → Recipient-facing export (scoped by shortcode)

GET  /api/v1/artifacts/:generationId
GET  /api/v1/artifacts/:generationId/download
```

### 7.5 Effort estimate

3-4 sessions.

---

## 8. SHARE CREATION WORKFLOW (sender side)

Sender creates a share from `DealDetailPage`:

1. Click "Share" button in the pipeline (owner-only, hidden from recipients)
2. `ShareCapsuleModal` opens: selects share type (external/platform), recipient details, permissions
3. Optional: enter `preview_text` and `preview_metadata` for the recipient landing page
4. Optional: toggle `show_attribution_override` (show/hide sender platform name)
5. Submit → share created with shortcode, access token generated
6. Email sent to recipient via email service (Resend/SendGrid) with `/share/:shortcode` link
7. Share visible in `DealDetailPage` → Capsules/Shares tab (`DealSharesTab`)

**Share types (from `ShareCapsuleModal`):**
- `external_view` — recipient views the deal (documents + Pro Forma, no agent)
- `external_agent_enabled` — recipient can connect API key and ask questions
- `platform_user_fork` — platform user receives a forked workspace (Piece 3)

---

## 9. SHARE MANAGEMENT UI

**Sender view (DealSharesTab):**
- List of all shares for this deal: shortcode, recipient email, share type, status (active/expired/revoked)
- Each share shows: creation date, expiry, last accessed, query count (if agent-enabled)
- Actions: copy share URL, revoke share, extend expiry
- Preview column shows whether preview_text was set

**Sender insights:**
- "Recipient accessed the capsule X times"
- "Recipient asked Y queries"
- Aggregate query categories (not individual queries per privacy)

---

## 10. BYPASS PREVENTION

**Current measures:**
- **Metadata strip:** Resolution endpoint returns only share settings (no deal_name, city, state, property_type, units)
- **Rate limiting:** 5 requests per 10 minutes per IP on share resolution
- **Preview fields are sender-curated:** Stored on `capsule_external_shares`, never queried from `deals`
- **Agent context scoping:** No sender portfolio, no other deals, no full KG
- **Token-based auth:** Access token required; SHA-256 hash stored, raw token returned once

**Known residual risk (minimal preview recommendation):**
The minimal preview fields are sender-written, not auto-derived from deal data. Recipient without API key sees only what the sender chose to share. This is acceptable — the sender has agency over what's exposed.

---

## 11. SIGN-UP WITH SHARE CONTEXT

When an external recipient clicks upgrade/subscribe, the sign-up flow preserves the share context:

1. Recipient clicks "Upgrade" or "Subscribe" → routed to `/register?share=:shortcode`
2. Registration form includes hidden field with shortcode
3. On successful registration, the platform checks for pending share
4. Creates a platform-user fork (Piece 3) of the deal into the new user's workspace
5. The deal appears in their workspace immediately on first login
6. API key connection remains active in the new workspace

This ensures the conversion path is seamless: recipient gets the analytical experience → likes it → subscribes → their work from the share session carries forward.

---

## 12. PRIVACY AND DATA HANDLING

### 12.1 What the platform sees from recipient queries

- Token counts (for billing) — YES
- Response status — YES
- Query category (high-level taxonomy) — YES
- Query content (actual text) — NOT STORED beyond immediate response

### 12.2 What the platform does with recipient data

- **Used for:** aggregate product improvement, conversion optimization, error debugging
- **NOT used for:** individual query review, surveillance, competitive intelligence, marketing, third-party sharing

### 12.3 Recipient sovereignty

- Can disconnect API key at any time
- Can request full deletion of query log (GDPR)
- Cross-recipient isolation: each recipient's session is independent

### 12.4 Sender sovereignty

- Controls share settings (documents, agent, expiry)
- Can revoke at any time (immediate effect)
- Sees aggregate access metrics, not individual queries

---

## 13. IMPLEMENTATION STATUS (v1.1)

| Piece | Status | Notes |
|---|---|---|
| 1 — Document download | ✅ Shipped | Endpoints + access_log + UI download buttons |
| 2 — Evidence linkage | 🟡 Partial | Source pills on Pro Forma cells. Full per-span viewer TBD |
| 3 — Platform fork | ✅ Shipped | `/share/:shortcode/fork` endpoint + DealDetailPage fork flow |
| 4 — Non-platform recipient | ✅ Shipped | ShareLandingPage, DealDetailPage in recipient mode, connect-your-API, agent runtime, Stripe metering, export, email delivery |
| 5 — Export | ✅ Shipped | Excel + PDF generation from share surface |

### Campaign-level follow-ups (from bypass audit)
- $0-initial-request flow (try agent without connecting key)
- Per-token pricing model transparency
- Key rotation endpoint for connected API keys
- Per-connection rate limiting (beyond IP-based)
- Automated Stripe meter setup
- Multi-provider expansion beyond Anthropic/OpenAI
