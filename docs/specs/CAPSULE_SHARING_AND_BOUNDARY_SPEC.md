# CAPSULE SHARING AND BOUNDARY SPEC v1.0

**Status:** Draft v1.0 — new platform spec
**Owner:** Leon / JEDI RE
**Module designation:** Spans multiple modules; suggest umbrella tag M41-M45 for the five pieces
**Purpose:** Define how the platform interacts at its boundaries — between platform users (capsule sharing within the platform), between platform and external recipients (capsule consumption with connect-your-API), between platform values and source documents (evidence linkage and downloads), and between platform-native analysis and exportable artifacts (Excel models, pitch decks).

**Pairs with:**
- `SCENARIO_MANAGEMENT_SPEC.md` v1.0 (forked workspaces inherit active scenario; non-platform recipients see active scenario)
- `JEDI_RE_MEMORY_ARCHITECTURE_MAP.md` (forks interact with all four layers; non-platform recipients get deal-scoped Layer 3 access)
- `COMPETITIVE_INTELLIGENCE_ENGINE_SPEC.md` v1.0.1 (CIE findings flow into forks; non-platform recipients see findings on active scenario)
- `OTHER_INCOME_REASONING_METHOD_SPEC.md` v1.2 (agent methods unchanged across boundaries; context source changes)
- `LANDS_DISCIPLINE_OPERATING_PLAN.md` (this spec follows the same verification discipline)
- Existing Stripe Token Billing infrastructure (`@stripe/token-meter` wrapping `@anthropic-ai/sdk`)
- Existing Deal Capsule infrastructure

---

## 1. PURPOSE AND UNIFYING THEME

The platform has been built primarily as a single-user-per-deal analytical workspace. Five gaps surface where the platform meets the outside world:

1. Users can't download the source documents they uploaded
2. Users can't trace platform values back to the specific document, page, and span the values came from
3. When a deal is shared to another platform user, that user can't apply their own data and reasoning — they just see the sender's analysis
4. When a deal is shared to a non-platform recipient (lender, LP, broker), the recipient gets a static artifact with no analytical capability
5. Sponsors need polished outputs (Excel models, pitch decks) for external distribution, and the platform doesn't produce them

These look like five separate features. They share a root cause: **the platform's data flows are inward-only, and the model assumes the platform-mediated analytical surface is the only consumption mode.**

This spec defines the outward-facing dimension of the platform: how data flows back out, how source documents stay accessible, how analytical capability is preserved for different recipient types, and how the platform earns from non-subscribers without compromising subscriber value.

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
External recipients (lender, LP, broker) receive a capsule link. To use the Opus agent, they connect their own API key through the platform's Stripe Token Billing wrapper. The platform earns margin on every query. Recipients get deal-scoped platform context; broader platform access requires subscription.

### Piece 5 — Excel and pitch deck export
Sponsors generate downloadable Excel underwriting models and pitch decks from a deal. Useful for traditional workflows and external distribution to recipients who don't want platform interaction.

---

## 3. PIECE 1 — DOCUMENT CENTER DOWNLOAD

### 3.1 Scope

Users can download any source document they (or their organization) previously uploaded to a deal. This includes T-12, rent roll, OM, jurisdiction tax records, insurance schedules, M22 monthly actuals exports, and any other file ingested through the platform's document parsing pipeline.

### 3.2 Functional requirements

**Download access:**
- Per-document download button in the Document Center UI
- Returns the original file as uploaded (no transformation, no parsing artifacts)
- File format preserved (PDF stays PDF, XLSX stays XLSX, etc.)
- Filename preserved with optional deal_id prefix for organization

**Bulk download:**
- "Download all documents for this deal" option
- Returns a ZIP archive with all source documents
- ZIP includes a manifest CSV: filename, document type, upload date, uploaded_by

**Audit trail:**
- Every download logged to `document_access_log` table
- Log captures: user_id, document_id, deal_id, access_timestamp, ip_address, access_type (single | bulk)
- Logs queryable by deal owner ("who has accessed my deal's documents?")

### 3.3 Data model

```sql
CREATE TABLE document_access_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(document_id),
  deal_id UUID NOT NULL REFERENCES deals(deal_id),
  accessed_by_user_id UUID REFERENCES users(user_id),
  accessed_by_recipient_token TEXT,   -- for non-platform recipients (see Piece 4)
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download_single', 'download_bulk')),
  access_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  CONSTRAINT either_user_or_recipient
    CHECK (accessed_by_user_id IS NOT NULL OR accessed_by_recipient_token IS NOT NULL)
);

CREATE INDEX idx_document_access_log_deal ON document_access_log(deal_id, access_timestamp DESC);
CREATE INDEX idx_document_access_log_user ON document_access_log(accessed_by_user_id, access_timestamp DESC);
```

### 3.4 API surface

```
GET    /api/v1/deals/:dealId/documents
  → List all documents for a deal with metadata

GET    /api/v1/deals/:dealId/documents/:documentId/download
  → Download single document
  → Logs to document_access_log
  → Returns: original file with Content-Disposition: attachment

GET    /api/v1/deals/:dealId/documents/bulk_download
  → ZIP all documents for the deal
  → Logs to document_access_log with access_type = 'download_bulk'
  → Returns: ZIP file with manifest

GET    /api/v1/deals/:dealId/documents/access_log
  → Returns audit log for deal owner
  → Filterable by user, date range, access type
```

### 3.5 Permissions

- Deal owner: full access to all documents and access log
- Forked workspace owner (Piece 3): access to documents inherited from the original deal at fork time; access to any documents they upload to their fork
- Non-platform recipient (Piece 4): access controlled by capsule share settings (sender chooses whether to include document download in the capsule)

### 3.6 Verification criteria

1. Upload a document; verify download returns identical bytes
2. Bulk download returns ZIP with all documents and correct manifest
3. Access log captures every download with correct metadata
4. Forked workspace can download inherited documents
5. Non-platform recipient access respects capsule share settings

### 3.7 Effort estimate

1-2 sessions. Most of the work is the audit log infrastructure; the download itself is straightforward.

---

## 4. PIECE 2 — EVIDENCE-TO-SOURCE LINKAGE

### 4.1 Scope

Every value in the Pro Forma carries evidence that links to the specific source: document, page, span (or row/column for spreadsheets). The evidence drawer surfaces this linkage with one-click access to the raw source positioned at the right location.

This is foundational trust infrastructure. Without it, users have to take the platform's parsed values on faith. With it, every value is auditable to its origin.

### 4.2 Functional requirements

**Source reference structure:**

Every evidence object on a Pro Forma field includes a `source_reference` block:

```typescript
interface SourceReference {
  document_id: string;
  document_type: 't12' | 'rent_roll' | 'om' | 'insurance' | 'tax_record' | 'manual_entry' | 'other';
  document_filename: string;

  // Location within the document
  location: {
    page_number?: number;        // for PDF documents
    sheet_name?: string;         // for spreadsheet documents
    row_number?: number;         // for spreadsheets and tabular PDFs
    column_letter?: string;      // for spreadsheets
    span_start?: number;         // character offset for text PDFs
    span_end?: number;
    bounding_box?: BoundingBox;  // pixel coordinates for visual highlight
  };

  // Extracted value at the source
  raw_text_at_location: string;   // the exact text the parser extracted
  parser_confidence: number;       // 0-1; how confident the parser was

  // Linkage to the parsed value
  parsed_value_field: string;     // canonical field name in Pro Forma
  parsed_value: number | string;  // the value as ingested
  transformations_applied: string[];  // any normalization steps
}
```

**Evidence drawer integration:**

When the user opens the evidence drawer on a Pro Forma field, it shows:
- The agent's reasoning narrative (existing)
- Cohort comparison (existing)
- A new "Source" section with:
  - Document name and type
  - "View in document" button — opens the source document in a viewer at the exact location
  - Raw text at location
  - Parser confidence indicator
  - "This value was extracted from..." linkage

**Document viewer:**

A new in-app viewer renders source documents with highlighting at the referenced location:
- PDFs: rendered with the referenced span/page highlighted
- Spreadsheets: rendered with the referenced cell highlighted
- The user can scroll, zoom, and navigate while the highlight remains
- "Download original" button always available in the viewer

### 4.3 Data model

The `source_reference` is stored on each Pro Forma field's evidence object:

```sql
-- Already exists conceptually in deal_underwriting_snapshots.snapshot JSONB
-- This spec adds the source_reference structure inside each field's evidence

-- Example shape inside snapshot.proforma_fields[i].evidence:
{
  "field_name": "vacancy_pct",
  "source": "t12",
  "narrative": "Vacancy at 5.2% per T-12 trailing twelve months...",
  "source_reference": {
    "document_id": "abc-123",
    "document_type": "t12",
    "document_filename": "464_Bishop_T12_2025.pdf",
    "location": {
      "page_number": 3,
      "row_number": 14,
      "span_start": 1247,
      "span_end": 1289,
      "bounding_box": { "x": 420, "y": 580, "width": 120, "height": 18 }
    },
    "raw_text_at_location": "Vacancy Loss      $124,832    5.2%",
    "parser_confidence": 0.94,
    "parsed_value_field": "vacancy_pct",
    "parsed_value": 0.052,
    "transformations_applied": ["percentage_string_to_decimal"]
  }
}
```

### 4.4 Backend infrastructure

**Document parsing pipeline updates:**

The existing parsers (Yardi-aware T12 parser, RentRoll parser, OM parser, etc.) must be extended to produce `source_reference` data for every extracted value. This is a non-trivial change to the parsing layer:

- Parsers track the source location of every extracted value during extraction
- Bounding boxes computed for visual document types
- Confidence scores attached per extraction
- Source references persisted alongside the parsed values

**Document storage:**

Source documents must remain accessible (not just parsed and discarded). The Document Center storage (likely S3 or equivalent) holds the original files. Document IDs link parsed values back to stored originals.

**Source reference resolution:**

A new service `source_reference_resolver` handles the mapping from a Pro Forma field's evidence back to the document location. Used by the document viewer to render the right page with the right highlight.

### 4.5 API surface

```
GET /api/v1/deals/:dealId/fields/:fieldName/source_reference
  → Returns source_reference for a specific field on the active scenario

GET /api/v1/deals/:dealId/documents/:documentId/view
  → Returns document for in-app viewing
  → Query params: highlight_location (JSON-encoded location object)
  → Returns: HTML or PDF with highlight markup

GET /api/v1/deals/:dealId/documents/:documentId/view/spans
  → Returns all source references that point into this document
  → Useful for "show me everything the platform extracted from this document"
```

### 4.6 Special handling

**Manual entry values:** When a user manually enters a value (override), the source_reference is `document_type: 'manual_entry'` with attribution to the user and timestamp instead of document location.

**Agent-derived values:** When the agent derives a value through reasoning rather than direct extraction (e.g., projected stabilized rent computed from comp ceiling), the source_reference points to the inputs used in the derivation. May reference multiple documents.

**Platform-default values:** Some values come from platform defaults (e.g., default capture rate when owned-portfolio data is absent). Source_reference is `document_type: 'platform_default'` with reference to the configuration that produced the default.

### 4.7 Verification criteria

1. Upload a T-12; open Pro Forma; click evidence on vacancy field; verify source_reference shows T-12 page/row
2. Click "View in document"; verify document viewer opens at correct page with correct highlight
3. Spreadsheet source: verify cell-level highlight works
4. Manual override: verify source_reference reflects manual entry attribution
5. Agent-derived value: verify source_reference points to inputs used
6. Parser confidence below threshold (e.g., 0.7) flagged in UI as low-confidence source

### 4.8 Effort estimate

3-4 sessions. Substantial because the parsing layer changes are real engineering work. The UI components are smaller.

---

## 5. PIECE 3 — PLATFORM-USER FORKED WORKSPACE

### 5.1 Scope

When User A shares a deal with User B (also on the platform), B gets a forked workspace. The fork carries A's deal context (source documents, parsed values, capsule structure) but applies B's platform data (B's owned-portfolio, B's archive cohort matching, B's preferences) and B's agent reasoning. A's analysis stays with A's workspace.

### 5.2 What forks carry forward

From User A's deal, the fork inherits:
- All source documents (T-12, rent roll, OM, etc.)
- Document parsing results (extraction capsules)
- Deal Capsule structure (property info, strategy classification, entity setup)
- Active scenario at fork time (the baseline state)
- Source references for all values

From User A's deal, the fork does NOT inherit:
- Other scenarios beyond the active one
- A's agent runs and reasoning history
- A's CIE findings and accept/decline state
- A's owned-portfolio context
- A's archive cohort match (recomputed for B)
- A's override values (these were A's reasoning; B starts fresh)

Note: A's overrides are not carried because they reflect A's analytical judgment. B starts with the agent layer values (or platform layer where agent hasn't run) and can apply B's own overrides.

### 5.3 What B's workspace adds

When B opens the forked deal:
- B's archive cohort match is computed against B's filtering preferences and the deal's parameters
- B's owned-portfolio context becomes available to B's agent runs
- B can run B's own agent on the deal — produces B's agent layer in B's active scenario
- B can create B's own scenarios (per Scenario Management spec)
- B's CIE pass runs against the deal with B's context
- B's overrides apply only to B's fork

### 5.4 Fork relationship model

The original deal and the fork are linked but independent. Both are full deals in the platform's data model.

```sql
-- Forks are tracked as a relationship between deals
CREATE TABLE deal_forks (
  fork_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_deal_id UUID NOT NULL REFERENCES deals(deal_id),
  forked_deal_id UUID NOT NULL REFERENCES deals(deal_id),

  -- Who forked
  forked_by_user_id UUID NOT NULL REFERENCES users(user_id),
  forked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  forked_from_scenario_id UUID REFERENCES deal_scenarios(scenario_id),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Optional metadata
  fork_reason TEXT,   -- optional note from User B about why they forked

  CONSTRAINT no_self_fork CHECK (source_deal_id != forked_deal_id)
);

CREATE INDEX idx_deal_forks_source ON deal_forks(source_deal_id);
CREATE INDEX idx_deal_forks_forked ON deal_forks(forked_deal_id);
CREATE INDEX idx_deal_forks_user ON deal_forks(forked_by_user_id);
```

### 5.5 Fork lifecycle

**Creation:**
- User A initiates share to User B from User A's deal
- User B accepts share (or share is automatic for organizations on the platform)
- Platform creates a new deal record owned by B
- Source documents copied to B's storage (or referenced with permission grant)
- Parsing artifacts copied to B's deal
- B's active scenario created from A's active scenario state
- `deal_forks` row records the relationship

**Updates after fork:**
- A's subsequent edits do NOT propagate to B's fork
- B's edits do NOT propagate to A's source deal
- If A re-runs agent, A's new agent runs do NOT appear in B's workspace
- If B wants to see A's updated analysis, B must explicitly re-fork (creates a new fork; previous fork remains as historical record)

**Visibility:**
- A sees who forked their deal in a "Shared with" list
- B sees the source deal owner in fork metadata
- Neither sees the other's analysis without explicit re-sharing in the opposite direction

### 5.6 Integration with scenarios

Per the Scenario Management spec, the fork inherits A's active scenario as B's initial scenario. Specifically:

- B's new deal has one scenario at fork time, named "Forked from <A's deal name> on <date>"
- B can rename this scenario
- B can create additional scenarios as normal
- B's agent runs create new agent-attributed scenarios per the standard pattern
- B's scenario history is B's own; A's full scenario history remains with A

### 5.7 Integration with KG (Layer 3)

The fork's relationship to Layer 3 (Knowledge Graph) is interesting:

- The deal's KG nodes (the property node, the submarket node, etc.) are shared — both A and B reference the same KG entities
- A and B may have different views of the KG based on their access tiers (Institutional tier may have access to additional KG content not visible to Operator tier)
- B's KG enrichment of the deal in B's workspace doesn't affect A's view

This works because the KG is platform-level institutional memory; deals reference KG nodes but don't own them. Both A and B's workspaces compose KG context per their tier into their respective DealContext.

### 5.8 API surface

```
POST /api/v1/deals/:dealId/share
  → Body: { recipient_user_id, share_type: 'platform_user_fork', message? }
  → Creates the share invitation

POST /api/v1/shares/:shareId/accept
  → Recipient accepts; fork created
  → Returns the new forked_deal_id in the recipient's workspace

GET /api/v1/deals/:dealId/forks
  → Source deal owner sees all forks of their deal

GET /api/v1/deals/:dealId/source
  → Forked deal owner sees source deal metadata
```

### 5.9 Verification criteria

1. User A shares deal with User B; B accepts; new deal exists in B's workspace
2. B's workspace shows A's active scenario as B's baseline
3. B runs agent on the fork; result appears as new scenario in B's workspace; A's workspace unchanged
4. B applies overrides; A's overrides unchanged
5. A re-runs agent on A's deal; B's workspace does not reflect A's new run
6. B's owned-portfolio is used by B's agent on the fork
7. B's archive cohort match is computed independently from A's
8. B's CIE findings are independent from A's
9. B can re-fork to refresh from A's current state (creates new fork; previous fork preserved)

### 5.10 Effort estimate

3-4 sessions. Most complexity is in the fork creation pipeline (document copying, parsing artifact copying, scenario inheritance) and the per-user data isolation (B's agent runs writing to B's deal, not A's).

---

## 6. PIECE 4 — NON-PLATFORM RECIPIENT WITH CONNECT-YOUR-API

### 6.1 Scope

External recipients (lender, LP, broker, prospective platform user) receive a capsule link. The recipient sees the deal in a constrained interface and can interact with the Opus agent by connecting their own LLM API key (Anthropic, OpenAI, others) through the platform's Stripe Token Billing wrapper. The platform earns margin on every query.

### 6.2 Design model — deal-scoped agent access

The recipient's agent gets context scoped to the deal they received:

**Recipient agent CAN access:**
- This deal's source documents (subject to sender's share permissions per Piece 1)
- This deal's parsed values
- This deal's source references (Piece 2)
- This deal's active scenario state
- This deal's CIE findings (sender's, on active scenario)
- Archive cohort distributions filtered to comparables of this deal
- Market trend data relevant to this deal's submarket
- Comp set data relevant to this deal

**Recipient agent CANNOT access:**
- Other deals beyond this one
- The sender's owned-portfolio (that's A's private data)
- The sender's full scenario history
- Cross-deal pattern recognition not specific to this deal
- The full Knowledge Graph beyond what this deal references

This is consistent with the capsule abstraction: the recipient is engaging with *this deal*, with intelligent agent capability *on this deal*. Anything broader requires platform subscription.

### 6.3 Connect-your-API flow

**Recipient onboarding:**

1. Recipient receives capsule link via email/Slack/whatever channel sender chose
2. Recipient clicks link; lands on the capsule's external view
3. Recipient sees the deal: documents, Pro Forma, evidence, scenario summary
4. To use the agent, recipient is prompted: "Connect your API key to start asking questions"
5. Recipient chooses provider (Anthropic, OpenAI, others as supported) and pastes their key
6. Platform validates the key and connects it to Stripe Token Billing wrapper
7. Recipient sees usage and pricing transparency: "Each query costs ~$X based on your provider's rates plus platform margin of Y%"
8. Recipient can now ask the agent questions

**During usage:**

- Every query routes through the platform's Stripe Token Billing wrapper
- The wrapper attributes token usage to the recipient's billing account
- Charges accrue to the recipient's API provider (Anthropic, OpenAI) plus platform margin
- Recipient sees running cost in real time
- Recipient can disconnect at any time

**Privacy and data handling:**

- Recipient queries are routed through the platform but not stored beyond what's needed for billing attribution and platform feature improvement
- The platform may aggregate query patterns (e.g., "lenders frequently ask about DSCR sensitivity") for product improvement purposes
- Individual queries are not logged for review, surveillance, or competitive intelligence
- This commitment is explicit in the recipient's onboarding terms

### 6.4 Pricing model

Non-platform recipient pricing is structured for higher margin than subscriber tiers:

| Tier | Subscriber margin | Recipient margin |
|---|---|---|
| Per-query cost basis | API provider's published rate | API provider's published rate |
| Platform margin | ~40% (per existing tier model) | ~100-150% on top of cost basis |
| Subscription required | Yes (Scout/Operator/Principal/Institutional) | No |
| Commitment | Monthly | Pay-as-you-go per query |

The higher recipient margin compensates for:
- No subscription commitment (recipients use occasionally)
- Platform-provided deal-specific context (the platform's asset)
- Operational overhead of supporting non-subscribers

Conversion trigger: when a recipient's cumulative spend approaches the subscription threshold, the UI surfaces: "You've spent $X this month. A Scout subscription is $49/month with broader platform access. Upgrade?"

### 6.5 Data model

```sql
CREATE TABLE capsule_shares (
  share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(deal_id),
  scenario_id UUID REFERENCES deal_scenarios(scenario_id),
  shared_by_user_id UUID NOT NULL REFERENCES users(user_id),

  -- Share configuration
  share_type TEXT NOT NULL CHECK (share_type IN ('platform_user_fork', 'external_view', 'external_agent_enabled')),
  recipient_email TEXT,
  recipient_name TEXT,

  -- Settings
  allow_document_download BOOLEAN NOT NULL DEFAULT TRUE,
  allow_agent_interaction BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,

  -- Status
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  -- Access token for non-platform recipients
  access_token TEXT UNIQUE,

  CONSTRAINT external_share_has_token
    CHECK (share_type != 'external_view' AND share_type != 'external_agent_enabled'
           OR access_token IS NOT NULL)
);

CREATE TABLE recipient_api_connections (
  connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES capsule_shares(share_id),

  -- Provider info
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'other')),
  api_key_encrypted TEXT NOT NULL,   -- encrypted at rest
  stripe_customer_id TEXT,

  -- Status
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,

  -- Usage
  total_queries INTEGER NOT NULL DEFAULT 0,
  total_tokens_consumed BIGINT NOT NULL DEFAULT 0,
  total_charges_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_margin_usd NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE recipient_query_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES recipient_api_connections(connection_id),
  query_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Aggregated only — query content not stored
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_basis_usd NUMERIC(8,4),
  platform_margin_usd NUMERIC(8,4),
  total_charged_usd NUMERIC(8,4),

  -- Categorization for product improvement
  query_category TEXT,   -- e.g., 'sensitivity_analysis', 'evidence_lookup', 'methodology_question'
  -- Note: this is a category, not the query text. The platform tracks WHAT KIND of question, not the question itself.

  response_status TEXT,   -- 'success', 'rate_limited', 'error'

  CONSTRAINT query_content_not_stored
    CHECK (TRUE)   -- Documentation of intent; enforced by code, not schema
);
```

### 6.6 Agent runtime for recipients

When a recipient asks a question, the agent run executes with constrained context:

```typescript
function buildRecipientDealContext(
  shareId: string,
  recipientConnectionId: string,
): RecipientDealContext {
  const share = await fetchCapsuleShare(shareId);
  const deal = await fetchDeal(share.deal_id);
  const scenario = share.scenario_id
    ? await fetchScenario(share.scenario_id)
    : await fetchActiveScenario(share.deal_id);

  return {
    // Deal-specific
    deal_info: deal.public_metadata,   // property info, strategy classification
    documents: await fetchDocuments(deal.deal_id),
    scenario_state: scenario.year1,
    source_references: await fetchSourceReferences(deal.deal_id, scenario.scenario_id),

    // CIE findings on the shared scenario
    ci_findings: await fetchCiFindings(scenario.scenario_id),

    // Deal-scoped Layer 3 access
    comparable_cohort: await fetchComparableCohort(deal),   // archive cohort filtered to this deal's comparables
    market_trends: await fetchMarketTrends(deal.submarket),
    comp_set: await fetchCompSet(deal),

    // Explicitly excluded
    sender_owned_portfolio: null,
    other_scenarios: null,
    full_knowledge_graph: null,
    other_deals: null,

    // Recipient context
    recipient_provider: connection.provider,
    is_platform_subscriber: false,
  };
}
```

The agent's prompt is adjusted slightly for non-platform recipients:
- Same reasoning patterns (Methods 1-4 for Other Income, etc.)
- Same output schema
- Different scope of available tools (no `fetch_owned_asset_actuals` for recipients; the sender's portfolio is private)
- Different surface in the response (formatted for recipient consumption, not for platform Pro Forma rendering)

### 6.7 Conversion funnel design

The recipient experience is designed to drive subscription conversion at the right moments:

**Trigger 1 — Heavy usage on one deal:**
After ~10 queries or ~$30 in charges on a single deal, surface: "You're getting real value from this deal's analysis. For ongoing access plus your own deals, consider a Scout subscription ($49/month)."

**Trigger 2 — Cross-deal interest:**
If a recipient receives multiple capsules from the platform (different senders), surface: "You have access to multiple deals on the platform. A Operator subscription ($199/month) lets you analyze your own portfolio alongside these."

**Trigger 3 — Sophisticated query patterns:**
If query categories show pattern indicating analytical sophistication (sensitivity analysis, scenario comparison, portfolio thinking), surface: "Your questions show you're doing serious analytical work. A Principal subscription gives you full platform access."

**Trigger 4 — Sender suggestion:**
Senders can include a "Try the platform" call-to-action in the capsule that surfaces at recipient onboarding.

### 6.8 API surface

```
POST /api/v1/deals/:dealId/share/external
  → Sender creates external share
  → Body: { recipient_email, share_type, allow_document_download, allow_agent_interaction, expires_at? }
  → Returns capsule URL with access token

GET  /api/v1/capsules/:accessToken
  → Recipient opens capsule
  → Returns deal data per share settings

POST /api/v1/capsules/:accessToken/connect_api
  → Recipient connects their API key
  → Body: { provider, api_key }
  → Validates key, sets up Stripe Token Billing wrapper

POST /api/v1/capsules/:accessToken/query
  → Recipient asks agent a question
  → Routes through Stripe Token Billing wrapper
  → Returns agent response
  → Logs to recipient_query_log

DELETE /api/v1/capsules/:accessToken/connect_api
  → Recipient disconnects their API key
  → Future queries blocked until reconnected

POST /api/v1/capsules/:accessToken/upgrade
  → Recipient clicks "subscribe to platform"
  → Routes to subscription onboarding flow
```

### 6.9 Verification criteria

1. Sender creates external share with agent enabled; recipient receives link
2. Recipient opens link; sees deal documents and Pro Forma
3. Recipient connects Anthropic API key; key validated
4. Recipient asks agent a question; response received; recipient billed correctly
5. Verify recipient agent does NOT access sender's owned-portfolio
6. Verify recipient agent does NOT see other deals
7. Verify recipient agent does access deal-specific cohort data
8. Sender's portfolio data integrity: query recipient_query_log; no sender data leaked into recipient context
9. Conversion trigger fires at correct usage threshold
10. Recipient can disconnect; subsequent queries blocked
11. Platform margin correctly attributed in Stripe accounting

### 6.10 Effort estimate

4-5 sessions. The largest piece in this spec. Components:
- Recipient identity and access token management (session 1)
- Recipient agent runtime with constrained context (session 2)
- Stripe Token Billing wrapper extension to non-subscribers (session 3)
- Conversion funnel UI and triggers (session 4)
- Privacy compliance, query logging discipline, audit trails (session 5)

---

## 7. PIECE 5 — EXCEL AND PITCH DECK EXPORT

### 7.1 Scope

Sponsors generate downloadable artifacts from a deal:
- Excel underwriting model (full Pro Forma with formulas, assumptions, supporting calculations)
- Pitch deck (PowerPoint or PDF for LP/investor distribution)

These are for recipients who don't want platform interaction — they want the deliverable in their familiar tool.

### 7.2 Excel model export

**Content:**
- Full Pro Forma at the active scenario's state
- Assumptions tab with all year1 values and their resolution layers
- Supporting tabs: Sources & Uses, Sensitivities, Hold Period Returns, IRR Waterfall
- Formulas preserved (recipient can change assumptions and recompute)
- Cell comments linking to source references where applicable
- Cover sheet with deal info, sender attribution, generation timestamp

**Generation:**
- Template-based: pre-built Excel template with placeholders
- Platform writes deal-specific values into placeholders
- Formulas remain Excel-native (recipient can verify the math)
- Generated on-demand; not stored long-term (regenerate as needed)

**Customization:**
- Sender chooses which scenario to export (defaults to active)
- Sender chooses whether to include assumption resolution metadata (for transparency) or just final values (for cleaner presentation)
- Sender can add custom cover note

### 7.3 Pitch deck export

**Content:**
- Cover slide with deal name, property image, sponsor branding
- Investment summary slide (key metrics, strategy)
- Property overview slide (location, unit mix, photos)
- Market analysis slide (submarket data, comp set)
- Financial summary slide (Pro Forma highlights, returns)
- Value creation slide (CIE findings sponsor has accepted; renovation premium reasoning)
- Sensitivity slide (key risk drivers)
- Sponsor track record slide (sender's prior deals if available)
- Appendix slides (full Pro Forma, assumptions, sources)

**Generation:**
- Template-based: PowerPoint or PDF template
- Platform composes deal data into the template
- Charts generated programmatically from year1 data
- Property images sourced from deal capsule
- Sponsor branding overlay configurable

**Customization:**
- Sender chooses which sections to include
- Sender chooses scenario to feature
- Sender adds custom branding
- Sender can add custom slides (free-form content)

### 7.4 Data model

```sql
CREATE TABLE artifact_generations (
  generation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(deal_id),
  scenario_id UUID REFERENCES deal_scenarios(scenario_id),
  generated_by_user_id UUID NOT NULL REFERENCES users(user_id),

  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('excel_model', 'pitch_deck_pdf', 'pitch_deck_pptx')),

  -- Configuration
  template_id TEXT NOT NULL,
  customization JSONB,   -- sender's customization choices

  -- Output
  output_file_url TEXT,   -- temporary signed URL (24h)
  output_file_size_bytes INTEGER,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);
```

### 7.5 API surface

```
POST /api/v1/deals/:dealId/generate_artifact
  → Body: { artifact_type, scenario_id?, template_id, customization? }
  → Returns generation_id; artifact generates asynchronously

GET  /api/v1/artifacts/:generationId
  → Returns generation status and download URL when ready

GET  /api/v1/artifacts/:generationId/download
  → Downloads the generated artifact
```

### 7.6 Verification criteria

1. Generate Excel model; verify all year1 values present
2. Verify Excel formulas recompute correctly when assumptions change
3. Verify source references appear as cell comments
4. Generate pitch deck PDF; verify all sections present with correct data
5. Generate pitch deck PPTX; verify editability in PowerPoint
6. Verify scenario selection works (export non-active scenario)
7. Verify branding customization applied

### 7.7 Effort estimate

3-4 sessions. Excel model generation is straightforward template population. Pitch deck generation is more design work (chart styling, layout, branding).

---

## 8. INTEGRATION ACROSS THE FIVE PIECES

The pieces are independent but mutually reinforcing.

**Piece 1 supports Piece 2:** Document downloads make Piece 2's evidence-to-source linkage truly useful — users can not only see the source location but also pull the file for offline review.

**Piece 2 supports Pieces 3, 4, 5:** Forked workspaces (Piece 3) inherit source references; non-platform recipients (Piece 4) see source references on values they review; Excel models (Piece 5) include source references as cell comments.

**Piece 3 supports Piece 4:** A non-platform recipient who experiences high-value agent interaction (Piece 4) is a strong conversion candidate for subscription. Upon subscribing, they receive their first deal as a fork (Piece 3) into their new workspace.

**Piece 4 supports Piece 5:** Non-platform recipients who prefer artifacts over interaction can request Excel or pitch deck exports (Piece 5) instead of using the agent.

**Piece 5 stands alone:** Excel and pitch deck exports work for any deal regardless of recipient type.

---

## 9. IMPLEMENTATION PHASES

Five pieces sequenced by dependency and value:

### Phase 1 — Document Center download (Piece 1)
- 1-2 sessions
- No dependencies
- Immediate trust win for existing users
- Should ship first

### Phase 2 — Evidence-to-source linkage (Piece 2)
- 3-4 sessions
- Depends on Phase 1 (download infrastructure)
- Foundational trust infrastructure
- Should ship before non-platform recipient experience (Piece 4 needs this for transparency)

### Phase 3 — Platform-user forked workspace (Piece 3)
- 3-4 sessions
- Depends on Scenario Management v1.0 (per separate spec)
- Enables team collaboration patterns

### Phase 4 — Non-platform recipient with connect-your-API (Piece 4)
- 4-5 sessions
- Depends on Phase 2 (evidence-to-source linkage)
- Highest strategic value (revenue + conversion + platform exposure)
- Largest engineering scope

### Phase 5 — Excel and pitch deck export (Piece 5)
- 3-4 sessions
- Depends on nothing else in this spec
- Can ship in parallel with other phases

**Total estimated effort: 14-19 sessions** across the five pieces. Substantial scope but executable in 8-12 weeks if sequenced well.

---

## 10. VERIFIABLE ACCEPTANCE CRITERIA

Following the lands-discipline operating plan, each piece has verifiable acceptance criteria. Summary table — individual criteria are in each piece's section above.

| Piece | Criteria count | Most critical verification |
|---|---|---|
| 1 — Document download | 5 | Audit log captures every download; bulk ZIP contains correct manifest |
| 2 — Evidence linkage | 6 | Every Pro Forma field has source_reference; viewer opens at correct location |
| 3 — Forked workspace | 9 | B's agent runs do not affect A's deal; A's overrides do not transfer to B |
| 4 — Non-platform recipient | 11 | Recipient agent CANNOT access sender's owned-portfolio (privacy verification) |
| 5 — Export artifacts | 7 | Excel formulas recompute correctly; pitch deck includes all selected sections |

---

## 11. PHASE VERIFICATION PROTOCOL

Each phase has a workflow that must complete before declaring done.

### Phase 1 Verification
Upload document → download single → verify byte-identical → download bulk → verify manifest correctness → check audit log.

### Phase 2 Verification
Upload T-12 → view Pro Forma → click evidence → click "View in document" → verify highlight at correct location → verify all extracted values have source_reference.

### Phase 3 Verification
User A shares deal with User B → B accepts → verify fork creation → B runs agent → verify B's agent results in B's workspace → verify A's workspace unchanged → A re-runs agent → verify B's workspace still unchanged.

### Phase 4 Verification
Sender creates external share → recipient opens link → recipient connects API key → recipient asks 5 queries → verify Stripe attribution correct → verify recipient cannot access sender's portfolio data (query the audit logs to confirm zero leakage) → trigger conversion prompt → verify upgrade path works.

### Phase 5 Verification
Generate Excel model → open in Excel → change one assumption → verify dependent values recompute → generate pitch deck → open in PowerPoint → verify all slides present with correct data → verify branding customization applied.

---

## 12. PRIVACY AND DATA HANDLING COMMITMENTS

Critical section for non-platform recipient model. The platform's privacy posture matters for adoption by institutional recipients (lenders, LP committees, etc.).

### 12.1 What the platform sees from recipient queries

The platform routes recipient queries through the agent runtime and the Stripe Token Billing wrapper. The platform sees:
- Token counts (for billing attribution) — yes
- Response status (success/error/rate-limited) — yes
- Query category (high-level taxonomy for product improvement) — yes
- Query content (the actual text of the question) — NO, not stored beyond the immediate response

### 12.2 What the platform does with recipient data

**Used for product improvement:**
- Aggregate patterns of query categories ("lenders frequently ask about DSCR sensitivity") used to inform product roadmap
- Frequency of conversion triggers used to optimize the conversion funnel
- Error rates and response quality used to debug agent behavior

**NOT used for:**
- Individual query review or surveillance
- Competitive intelligence on the recipient's analytical patterns
- Marketing or advertising targeting
- Sharing with third parties

### 12.3 Recipient's data sovereignty

- Recipient can disconnect their API key at any time
- Disconnection does not retroactively delete query log aggregates (these are platform performance data)
- Recipient can request full deletion of their query log under data sovereignty rights (e.g., GDPR for EU recipients)

### 12.4 Sender's data sovereignty

- Sender controls share settings (document download enabled/disabled, agent interaction enabled/disabled, expiration)
- Sender can revoke share at any time; immediate effect on recipient access
- Sender sees access log for their share (who opened it, when, how many queries — not the queries themselves)

### 12.5 Cross-recipient isolation

When two recipients receive capsules from the same sender:
- Their query logs are isolated
- Their agent context is independent
- Neither sees the other's existence

When two recipients receive capsules from different senders on the same property (theoretically possible for hot deals being shopped):
- The platform does not link their interactions
- Each recipient sees their respective sender's analysis
- The platform does not aggregate across recipients to inform either sender

---

## 13. RISKS AND MITIGATIONS

### Risk 1 — Source reference completeness gaps

Not every value in the Pro Forma will have a source reference at Phase 2 launch. Agent-derived values, platform defaults, and manual entries each have different source reference patterns. Some fields may be missing references initially.

**Mitigation:** progressive rollout. Phase 2 ships with source references on direct-extracted values (T-12, rent roll). Subsequent phases extend to agent-derived (Phase 2.1) and platform defaults (Phase 2.2). UI clearly indicates which fields have full traceability vs which don't yet.

### Risk 2 — Fork data ownership ambiguity

When User B forks User A's deal, what happens if A deletes their source deal? Should B's fork continue to function? Should the documents B inherited remain accessible?

**Mitigation:** at fork creation, documents are *copied* to B's storage (not referenced). B's fork is independent. A's deletion does not affect B's fork. This costs storage but provides predictable ownership semantics.

### Risk 3 — API key security

Recipients' API keys are sensitive credentials. Storage and handling must be secure.

**Mitigation:** keys encrypted at rest with platform's KMS. Never logged. Never displayed back to recipient (after initial entry, only obfuscated form shown). Standard credential handling practices apply.

### Risk 4 — Excel formula complexity

Real underwriting models have hundreds of formulas with interdependencies. Generating Excel that correctly preserves formulas is non-trivial.

**Mitigation:** Phase 5 ships with a constrained Excel template covering the core Pro Forma. Extensions for sensitivities and waterfall come later. Initial scope is "Pro Forma with editable assumptions," not "full institutional underwriting model."

### Risk 5 — Pitch deck design quality

Pitch decks have aesthetic standards. Programmatically generated decks risk looking auto-generated.

**Mitigation:** invest in template design upfront. Use the platform's existing Bloomberg Terminal design discipline as the aesthetic baseline. Allow sponsor customization to override defaults where they have brand preferences.

### Risk 6 — Recipient conversion may underperform

The connect-your-API model assumes recipients will convert to subscribers at meaningful rates. Actual conversion may be lower.

**Mitigation:** the model works financially even at low conversion rates because of higher margin on non-subscriber queries. Conversion is upside; non-subscriber revenue is the floor.

---

## 14. OPEN QUESTIONS

### Q1 — Which API providers should the platform support for recipients?

Anthropic and OpenAI are obvious. Should Google (Gemini), AWS Bedrock, Azure OpenAI also be supported? Each requires its own SDK integration, billing wrapper, and reliability work.

**Recommendation:** ship with Anthropic only at Phase 4 launch. Add OpenAI in v1.1 (most requested second provider). Other providers based on demand.

### Q2 — Should subscribers see anonymized recipient query patterns from their own shares?

Senders may want to know "what questions did the lender ask?" without seeing specific queries. Could surface as aggregate categories: "Recipient asked 3 sensitivity questions, 2 evidence lookups, 1 methodology question."

**Recommendation:** yes, but only at the aggregate category level (per privacy commitments). Senders see useful signal without query content.

### Q3 — What happens to recipient sessions when sender re-runs agent on the deal?

If the sender's agent run changes deal state during a recipient's session, what does the recipient see? Stale state? Forced refresh?

**Recommendation:** recipient sees the scenario state at the time the share was created (snapshot at share time). Sender's subsequent changes do NOT automatically propagate to recipient sessions. Sender can explicitly re-share if they want to update.

### Q4 — Should pitch decks be live (always reflecting current scenario) or static (snapshot at generation)?

Live decks change as the underlying deal changes. Static decks are stable but go stale.

**Recommendation:** static at generation. Each generation creates a new artifact. Sender can regenerate after material changes. This matches typical IC/LP workflow where decks are versioned artifacts, not living documents.

### Q5 — Multi-property capsules?

What about sharing a portfolio of deals to a recipient as a single capsule? Useful for institutional senders presenting multiple deals.

**Recommendation:** out of scope for v1.0. Each share is single-deal. Portfolio-level sharing is a separate feature, post-v1.0.

### Q6 — Recipient agent's knowledge of platform features

When the recipient agent answers questions, does it mention platform-specific concepts (CIE findings, scenario management, Method 3 reasoning) that the recipient hasn't been onboarded to?

**Recommendation:** the agent's responses should be self-contained explanations that don't require platform background. If the agent references CIE findings, it explains "the platform's competitive intelligence system identified..." rather than assuming familiarity. This treats the response as standalone, not as continuation of platform onboarding.

---

## 15. STRATEGIC POSITIONING

This spec, taken as a whole, transforms the platform's relationship to its non-subscribers from "potential users who get blocked at the paywall" to "active revenue contributors who experience platform value directly."

The connect-your-API model is genuinely novel. Most analytical platforms offer either subscription or static delivery. JEDI RE's model creates a third path: pay-per-use agent access tied to a specific shared artifact. This:

- Generates revenue from non-subscribers (new income line)
- Creates strongest possible conversion experience (recipient uses platform's actual capabilities before deciding to subscribe)
- Aligns sender incentives (sender shares more deals because recipients can really use them)
- Aligns recipient incentives (recipient gets useful tool without subscription commitment)
- Aligns platform incentives (margin on every query)

For the institutional segment (LP committees, institutional lenders), this is the model that matches their workflow. They don't subscribe to vendor platforms; they consume analytical artifacts. The platform meets them where they are.

For the conversion segment (smaller sponsors, individual investors, brokers), the experience drives sign-ups in a way no demo or trial could match.

This is the platform's primary external interface. Spec'd right and shipped well, it's structurally differentiating.

---

## 16. WHAT THIS SPEC DOES NOT COVER

- **Multi-party collaboration within a single deal:** several platform users editing the same deal simultaneously. Deferred to team collaboration spec (M29-M32).
- **Recipient-to-recipient sharing:** a recipient sharing the capsule with another non-platform user. Deferred; would require permission delegation infrastructure.
- **Custom branding for white-label scenarios:** institutional sponsors with their own brand requirements beyond the basic customization. Future enterprise feature.
- **Capsule analytics dashboard:** senders seeing engagement metrics across all their shares. Phase 6 or post-v1.0 feature.
- **Sender's portfolio-level sharing:** sharing all deals at once. Out of scope.
- **Public capsule URLs:** capsules accessible without authentication. Out of scope; all capsules require recipient identification.
