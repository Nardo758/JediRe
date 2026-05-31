# JEDI RE — REPLIT DISPATCH PACKAGE

**Produced:** 2026-05-31
**Trigger:** Owned/Portfolio + Correlation Engine Map audit (2026-05-31) plus operator framing: "Most of the architecture is in place, just needs refinement."

**Purpose:** Single consolidated dispatch giving Replit everything needed to plan tasks across two related workstreams — Pro Forma Window architecture corrections AND investor-returns capability mapping.

**What this package contains:**
1. Pro Forma Window corrections document (specific redlines to four existing documents)
2. Investor-returns capability mapping audit prompt (new audit, same discipline as the just-completed one)
3. Tactical fixes from the prior audit (can ship now, independent of either workstream)
4. Operator decisions surfaced for explicit action
5. Sequencing recommendation across all in-flight work

---

## §1 — TWO DELIVERABLES FOR REPLIT

### Deliverable A — Pro Forma Window Architecture Corrections

**File:** `JEDI_RE_PROFORMA_WINDOW_CORRECTIONS.md`

**What it does:** Specifies redlines to four architecture documents drafted earlier this session (Surface Map, Lifecycle State Machine, Math Spec, Data Flow Spec) based on grounded findings from the owned-portfolio + correlation engine audit.

**Why it exists:** The four documents made claims that the audit revealed as either inferred-not-verified or wrong (notably: the owned-portfolio composition, the correlation engine's scope, Phase 1B's true blockers).

**What Replit does with it:**
- Reviews the redlines for accuracy against current code
- Either applies redlines inline to the original four documents, OR pairs the corrections document with the originals as a companion
- Updates the reconciliation document per §7 of the corrections doc
- Adds Decision Item F (stabilization outcome tracking schema) to the open architectural decisions list

**Effort estimate:** 1-2 days of careful document work, no code changes.

### Deliverable B — Investor Returns Capability Mapping Audit

**File:** `investor-returns-capability-mapping-prompt.md`

**What it does:** Comprehensive read-only audit of the platform's existing investor-returns capability across seven layers (ingestion, debt service, waterfall structure, capital accounts, cash flow chain, waterfall execution, reporting surfaces).

**Why it exists:** Operator framing was "most of the architecture is in place, just needs refinement." This audit grounds that claim. Produces gap analysis that informs refinement plans rather than greenfield architecture.

**What Replit does with it:**
- Performs the seven-layer mapping audit
- Produces `docs/operations/INVESTOR_RETURNS_CAPABILITY_MAP.md` per the prompt's §4 output structure
- Surfaces tactical fixes, new build items, data infrastructure items, and architectural commitments separately
- Pairs findings with the existing Deal Details audit (Pattern 3 found `investor-capital.routes.ts` unmounted) to identify the unblocking items

**Effort estimate:** 4-6 days of thorough investigation + writeup.

---

## §2 — TACTICAL FIXES READY TO SHIP NOW

These items emerged from the just-completed audit and don't depend on either deliverable above. They can become individual Replit tasks immediately.

### Fix T-PFC-1: Submarket-matching gap in fetch_owned_asset_actuals

**Location:** `backend/src/agents/tools/fetch_owned_asset_actuals.ts:218`

**Problem:** Tool uses `NULL::text AS submarket` in its query, causing the submarket-match scorer (40 pts of comparability score) to fall back to the non-submarket case for ALL comparisons. Silently inflates comparability scores across all assets.

**Resolution options:**
1. Add `submarket` column to `deal_monthly_actuals` populated at upload time
2. Join `properties` to a submarket lookup at query time
3. Both (column for historical accuracy + lookup for current properties)

**Priority:** Medium. Misleading comparability scores but no crash. Worth fixing before Phase 1B because Phase 1B's correlation queries will also need submarket alignment.

**Effort estimate:** 2-3 days depending on option chosen.

### Fix T-PFC-2: Deduplicate owned-portfolio identification

**Locations:**
- `backend/src/db/schema/propertyEntity.ts:77` — `property_operating_data.is_owned BOOLEAN` (schema-defined, 0 rows populated, NOT used by agent tooling)
- Active convention: `deal_monthly_actuals.deal_id IS NULL` + implicit UUID prefix `a1000001-0000-0000-0000-` (used by agent tooling)

**Problem:** Two parallel mechanisms for identifying owned-portfolio assets. The unused mechanism creates confusion and risks divergence.

**Resolution options:**
1. Adopt `deal_id IS NULL` + add explicit `is_portfolio_asset BOOLEAN` to `deal_monthly_actuals`
2. Use `property_operating_data.is_owned` consistently (requires migration + agent tooling updates)
3. Document the current convention explicitly and deprecate the unused mechanism

**Priority:** Low. Doesn't block any in-flight work.

**Effort estimate:** 1-2 days for documentation + deprecation; 3-5 days if migrating to a new canonical mechanism.

### Fix T-PFC-3: Surface owned-portfolio composition correction

**Problem:** Session memory and prior architectural documents described owned portfolio as "Jacksonville + Atlanta A + Atlanta B." Audit verified it's actually "Frisco TX + McKinney TX + Duluth GA." Multiple downstream artifacts may reference the incorrect composition.

**Resolution:** Grep the architectural corpus (the documents in `/docs/architecture/`, `/docs/operations/`, plus any specs in the repo) for references to:
- "Jacksonville" in owned-portfolio context
- "Atlanta Property A" or "Atlanta Property B" or "Atlanta A" / "Atlanta B"
- "2018+" or "2020+" or "2022+" in owned-portfolio context

Replace with accurate composition. This is a corpus hygiene task.

**Priority:** Low. Doesn't break code; affects documentation accuracy.

**Effort estimate:** 1 day.

---

## §3 — OPERATOR DECISIONS SURFACED

The just-completed audit named four data infrastructure items requiring operator decisions, not engineering tasks. Surfacing them explicitly so they can be tracked:

### Decision D-1: historical_observations vendor feed scaling

**Question:** Does the platform commit to expanding CoStar coverage (or partnership with another data vendor) to populate `historical_observations` at the scale needed for Phase 1B correlation queries (~200+ Atlanta property-quarters)?

**Current state:** 36 CoStar rows exist via Task #1476 infrastructure. Pipeline works but hasn't been fed at scale.

**What's blocked without this:** Phase 1B empirical concession-velocity reasoning. The query functions are 1-2 days of code each; the data is the blocker.

### Decision D-2: Stabilization outcome tracking schema

**Question:** Should the platform add `stabilization_achieved_date` per deal? Three options: column on `deal_assumptions`, column on `deals`, or new `deal_outcomes` table.

**Recommendation in the corrections doc:** Option 3 (new `deal_outcomes` table) because outcome tracking has broader implications (exit timing, realized returns, post-close intelligence, realized-vs-underwritten variance).

**What's blocked without this:** Phase 1B time-to-stabilization correlation queries. Also blocks any "actual vs. underwritten" analytical surface.

### Decision D-3: Owned portfolio expansion in target submarkets

**Question:** Does the platform actively pursue adding 2-3 Atlanta urban comparables (manual upload or Yardi feed), or accept fallback to archive P50 for Atlanta urban deals until organic deal flow fills the gap?

**Current state:** Owned portfolio has 0 Atlanta Midtown comparables. `fetch_owned_asset_actuals` falls back to archive P50 = 0.80 for capture rate.

**What's blocked without this:** Tier 2 evidence quality for Atlanta urban deals (464 Bishop and similar) remains limited.

### Decision D-4: costar_market_metrics activation

**Question:** Does the platform's CoStar contract scope include market metrics, and can the import be scoped?

**Current state:** Table exists with 0 rows. COR-22 always returns `confidence: 'insufficient'`.

**What's blocked without this:** COR-22 signal stays inactive. Multiple downstream correlations are limited.

---

## §4 — RECOMMENDED SEQUENCING

Given everything in flight, the recommended order:

### Track 1 — Architectural corrections (sequential, fast)

**Week 1:** Replit applies Pro Forma Window corrections (Deliverable A). Updates the four documents and the reconciliation document. Adds Decision Item F.

**Week 1-2:** Replit performs investor-returns capability mapping audit (Deliverable B). Produces `INVESTOR_RETURNS_CAPABILITY_MAP.md`.

**Week 3:** Operator reviews investor-returns map. Decides which gaps merit task creation. Tasks added to queue.

### Track 2 — Tactical fixes (parallel, independent)

**Week 1-2:** Fixes T-PFC-1, T-PFC-2, T-PFC-3 enter Replit's queue. These don't depend on either deliverable above; they ship as bandwidth allows.

### Track 3 — Operator decisions (asynchronous)

Operator considers Decisions D-1 through D-4 on their own timeline. Each decision unlocks specific downstream work but doesn't gate either Track 1 or Track 2.

### Track 4 — Existing in-flight work

Whatever Replit currently has in queue (Phase 1A follow-ups, vendor architecture tasks T-A1/T-A2/T-B1, conflation tasks #1605-1607, etc.) continues independently. This package doesn't disrupt that work.

---

## §5 — WHAT'S NOT IN THIS PACKAGE

To be explicit:

- **No new architectural document.** The eight-document investor-returns plan was held in favor of the mapping audit. After the audit returns, refinement plans (not greenfield architecture) become the right artifact.

- **No new task batch for investor returns capability.** Tasks emerge from the audit's findings, not pre-emptively.

- **No Phase 1B activation.** Phase 1B remains data-blocked. The decisions in §3 above are the operator-side path to eventual activation.

- **No changes to existing in-flight work.** Phase 1A is shipped (per audit); vendor architecture work continues; conflation tasks proceed.

---

## §6 — CONTEXT FOR REPLIT'S TASK PLANNING

Replit's task creation discipline this session has been consistently good at producing grounded, scoped, file:line-referenced task descriptions. The package above gives Replit four sources for task creation:

1. **Corrections document § 5** (tactical fixes) — direct task source
2. **Audit findings § 4** (recommended follow-up work) — already-grounded task material
3. **Investor-returns mapping audit findings** (after audit completes) — task source for next workstream
4. **Operator decisions § 3 above** (track separately, not engineering tasks)

The corpus is now grounded enough that task planning should produce specs that match implementation reality from the start, reducing the audit-correction cycle that's been the rhythm of this session.

---

## §7 — FILES IN THIS DELIVERABLE PACKAGE

Three documents at `/mnt/user-data/outputs/`:

1. `JEDI_RE_PROFORMA_WINDOW_CORRECTIONS.md` — the redlines to apply to the four Pro Forma Window documents
2. `investor-returns-capability-mapping-prompt.md` — the audit prompt for the next mapping audit
3. `JEDI_RE_REPLIT_DISPATCH_PACKAGE.md` (this document) — the consolidated framing for Replit

All three should travel together when sent to Replit.

---

*Move forward.*
