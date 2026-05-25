SUPERSESSION RECORD (added post-implementation)
═══════════════════════════════════════════════════════════════════

Task-1040 said: "DQ recalculator called after enrichment completes."
Task-1041 supersedes this: enrichment writes to pending_web (excluded
from resolved). DQ must not change at enrichment time -- only at Apply,
when pending_web is promoted to web and resolved is updated.

Reviewer objections that were fabricated (absent from both dispatches):
  - "Enrich endpoint should return property_descriptions row"
  - "Backfill should queue via intake_jobs"
  - Field names enriching/job_id (spec uses status/jobId)

Items closed by final gap closure dispatch (task-1042):
  - Step 3.4 intake_jobs awaiting_review -- implemented
  - Photo attribution null fallback (c Google Places) -- implemented
  - Response shape status: processing -- was already correct
  - This supersession section -- added

═══════════════════════════════════════════════════════════════════
PHASE 8 COMPLETION — DQ CANONICAL PATH + APPLY/DISCARD STAGING

CONTEXT
Phase 8 is in a partial-complete state with three outstanding 
items identified during code review:

1. DQ scoring has two formulas in the system (100-pt client save 
   vs 130-pt server display). Three downstream consumers have hard 
   thresholds calibrated against the old formula. Silent semantic 
   drift in benchmark aggregation.

2. The Apply/Discard staging workflow specified in original 
   dispatch Step 9 was incorrectly marked out of scope. Code 
   exists but is unwired. Phase 8 currently writes enrichment 
   directly to the DB without user confirmation.

3. The dispatch text isn't accessible to future bot sessions, 
   leading to reconstruction errors and bad handoff inheritance.

This dispatch closes all three.

═══════════════════════════════════════════════════════════════════
PRINCIPLES
═══════════════════════════════════════════════════════════════════

1. SINGLE CANONICAL DQ FORMULA. After this dispatch, exactly one 
   DQ computation function exists. Client never computes DQ. Save 
   path doesn't accept DQ in payload. Server recomputes on every 
   write to property_descriptions.

2. THRESHOLD RECALIBRATION IS A SEPARATE EXPLICIT CHANGE. Don't 
   bundle threshold changes with the formula change. Document 
   before-state, change formula, measure delta, propose new 
   thresholds, get Leon's approval on the threshold value, then 
   apply.

3. APPLY/DISCARD IS THE DEFAULT. Enrichment writes to a staging 
   layer (not directly to the property_descriptions resolved 
   value). User reviews via modal, Apply commits or Discard 
   rejects. No "skip review for power users" toggle in this 
   dispatch — that's a future scope question.

4. STANDING PRINCIPLES APPLY:
   - Producer/reader: server recompute means every reader sees 
     the same DQ. Verify.
   - Schema errors surface; no .catch(logger.warn) swallowing
   - Stale-reference sweep: when changing DQ field semantics, 
     grep for every reader
   - Paired-read verification before complete
   - Investigation first

═══════════════════════════════════════════════════════════════════
PART 1 — DISPATCH ACCESS INFRASTRUCTURE (do this first)
═══════════════════════════════════════════════════════════════════

STEP 1.1 — Create docs/dispatches/ directory

   mkdir -p docs/dispatches/
   
   Add a README.md explaining:
   - Purpose: canonical source of dispatch text for bot sessions
   - Format: one file per task, named task-<number>.md
   - Convention: dispatch text pasted verbatim at file creation
   - This file is read by bots before executing any task

STEP 1.2 — Backfill recent dispatches

   For the dispatches identified in recent session transcripts, 
   create files:
   - docs/dispatches/task-1040-phase-8-research-agent.md 
     (reconstruct from transcript; flag any uncertain sections)
   - docs/dispatches/task-1037-column-rename-fixes.md (if 
     reconstructable)
   
   For each, paste the dispatch text as faithfully as possible.
   Mark any reconstructed sections with "[reconstructed]" so it's 
   clear what's authoritative vs inferred.

STEP 1.3 — This dispatch goes in docs/dispatches/ first

   Before executing any of Parts 2 or 3, save the text of THIS 
   dispatch as docs/dispatches/task-<assigned-number>-phase-8-
   completion.md. That way it's accessible to the reviewer and 
   to any session that picks up the work.

═══════════════════════════════════════════════════════════════════
PART 2 — DQ CANONICAL PATH (server recompute)
═══════════════════════════════════════════════════════════════════

STEP 2.1 — INVESTIGATION (no code changes yet)

   A. Document the CURRENT DQ data flow end-to-end:
      - Client compute paths: where calculateDQScore() is called, 
        what it computes, when result is sent in payload
      - Server compute paths: where dq-recalculator.service.ts is 
        invoked, what triggers it, what writes to DB
      - DB state: what column stores DQ, what scale (0-100? 0-130? 
        normalized?)
      - All readers: every place that reads data_quality_score, 
        including the three known threshold consumers:
        * archive-benchmark-aggregator.ts:86 (>= 50)
        * archive-benchmark-aggregator.ts:579 (>= 40)
        * auto-enrichment.service.ts:601 (caller-passed)
      - Any other readers found via grep

   B. Document the CURRENT field weights:
      - 10 base operational/financial fields × 10 pts = 100
      - Phase 8 fields (narrative, amenities, photos, reviews, 
        sentiment, regulatory) — what weight each is currently 
        getting in dq-recalculator
      - Document point totals for each scenario:
        * 0 fields populated: ?
        * Only operational complete: ?  
        * Only enrichment complete: ?
        * Both complete: ?

   REPORT FINDINGS BEFORE WRITING CODE. STOP GATE.

STEP 2.2 — UPDATE FORMULA TO 0-100 NORMALIZED

   A. Modify the canonical DQ computation function in 
      dq-recalculator.service.ts:
      - Calculate raw score with all fields (operational + 
        Phase 8) at their current weights
      - Normalize to 0-100: round((raw / max_possible) * 100)
      - This way, both old (operational-only) and new (enriched) 
        properties produce 0-100 scores comparable to historical 
        threshold semantics

   B. Remove calculateDQScore() from the client save path:
      - Strip data_quality_score from the save payload before 
        sending to API
      - Backend ignores any DQ value sent by client (defense in 
        depth)
      - Display continues to render data_quality_score from the 
        property's DB record (which is now server-recomputed)

   C. Wire DQ recompute into every save path:
      - After any UPDATE to property_descriptions that could 
        affect DQ, call dq-recalculator
      - Apply to: modal save endpoint, orchestrator write-back, 
        Apply staging commit (Part 3), any bulk-update endpoints
      - Use a transaction wrapper: field write + DQ recompute 
        happen atomically

   D. Backfill DQ across all existing properties using the new 
      formula:
      - SELECT all property_descriptions rows
      - Recompute DQ via dq-recalculator
      - UPDATE data_quality_score for each
      - Run in batches with progress logging
      - Report: total recomputed, mean before, mean after, 
        distribution shift

STEP 2.3 — THRESHOLD RECALIBRATION (separate change, with report)

   A. With the new formula in place, generate a recalibration 
      analysis:

      For each threshold consumer:
      | Consumer | Current threshold | Old formula: N rows pass | New formula: N rows pass |
      | archive-benchmark-aggregator.ts:86 | >= 50 | ? | ? |
      | archive-benchmark-aggregator.ts:579 | >= 40 | ? | ? |
      | auto-enrichment.service.ts:601 | caller | ? | ? |

      For each consumer where the pass-rate changed meaningfully, 
      compute what threshold value in the new formula would 
      preserve the OLD pass rate.

   B. Generate proposed new thresholds:
      - archive-benchmark-aggregator.ts:86: 50 → ?
      - archive-benchmark-aggregator.ts:579: 40 → ?
      - auto-enrichment.service.ts:601: keep caller-controlled, 
        document recommended value

   C. STOP — do NOT apply the recalibration yet. Report the 
      before/after analysis to Leon for approval of the proposed 
      threshold values. The formula change can ship without the 
      threshold changes; only after Leon approves do the 
      thresholds get updated.

═══════════════════════════════════════════════════════════════════
PART 3 — APPLY/DISCARD STAGING WORKFLOW
═══════════════════════════════════════════════════════════════════

STEP 3.1 — INVESTIGATION

   A. Locate the existing Apply/Discard code in the modal:
      - Document the existing handleApply / handleDiscard 
        functions
      - Document the existing endpoint 
        /api/v1/property-discovery/enrichment-log/:logId/resolve
        (is it still mounted? what does it do?)
      - Identify what UI states the modal had during Apply/Discard 
        flow (badges, buttons, etc.)

   B. Document the CURRENT Phase 8 direct-write path:
      - When AUTO-ENRICH fires, where do values land?
      - Currently writing to property_descriptions.<field>.layers.web?
      - Where is the resolved value computed and stored?

   C. Identify the staging layer:
      - Per spec §4 (LayeredValue): each mutable field has layers 
        with priority order
      - The 'manual_override' layer wins when present
      - Recommended: use a new 'pending_web' layer for enrichment 
        results that haven't been Applied yet
      - resolved value computation: skip 'pending_web' layer until 
        Applied

   REPORT FINDINGS. STOP GATE.

STEP 3.2 — STAGING LAYER WIRING

   A. Update the orchestrator's enrichment write path:
      - Currently writes Research Agent output to 
        property_descriptions.<field>.layers.web
      - Change to write to property_descriptions.<field>.layers.pending_web
      - The 'pending_web' layer is excluded from resolved value 
        computation
      - This means: enrichment runs, data lands in pending_web, 
        resolved value remains what it was before enrichment

   B. Add 'pending_web' to the LayeredValue type definition. 
      Document that this layer is the staging area for 
      not-yet-Applied enrichment results.

   C. UI indicator:
      - When property_descriptions.<field>.layers.pending_web 
        exists for any field, the property has pending enrichment
      - Modal shows "Enrichment pending review" banner
      - Per-property page (which renders Phase 8 fields) shows 
        the pending values in a "Pending" state with visual 
        distinction (e.g., dotted border, "Awaiting review" badge)

STEP 3.3 — REACTIVATE APPLY/DISCARD UI

   A. Wire the modal's existing handleApply function:
      - When user clicks Apply:
        * For each field with a pending_web layer: promote 
          pending_web → web layer
        * Delete the pending_web layer
        * Recompute resolved value (now includes the web layer)
        * Trigger DQ recompute (Part 2)
        * Refresh modal display
      - Endpoint: 
        POST /api/v1/properties/by-parcel/:parcelId/enrichment/apply

   B. Wire the modal's existing handleDiscard function:
      - When user clicks Discard:
        * For each field with a pending_web layer: delete it
        * resolved value reverts to whatever it was pre-enrichment
        * DQ recompute (Part 2) reflects the reverted state
        * Refresh modal display
      - Endpoint: 
        POST /api/v1/properties/by-parcel/:parcelId/enrichment/discard

   C. AUTO-ENRICH button behavior update:
      - Click → run Research Agent → results land in pending_web 
        layer
      - Modal updates to show pending values + Apply/Discard 
        buttons available
      - Existing sync/async hybrid behavior preserved
      - User must click Apply or Discard before commit

   D. Visual indicators on the per-property page:
      - Pending enrichment fields show with visual distinction 
        (dotted border, gray tone, or "Pending" badge)
      - A property with any pending enrichment shows a banner: 
        "Pending review — open in modal to Apply or Discard"
      - After Apply: all fields render normally
      - After Discard: pending values disappear; property looks 
        as it did before enrichment

STEP 3.4 — REVIEW WORKFLOW FOR NEW ASSETS

   A. When a new asset enters via Apartment Locator scrape or 
      Data Library upload:
      - Orchestrator runs Research Agent
      - Results land in pending_web layer (not committed)
      - Asset appears in the Intake Inbox tab with "Awaiting review" 
        status
      - User opens modal from Intake Inbox → reviews enrichment 
        results → Apply or Discard

   B. The Intake Inbox view (Data Library → Inbox tab) shows 
      pending-review properties with clear indication of why 
      they're in the queue.

═══════════════════════════════════════════════════════════════════
PART 4 — PAIRED-READ VERIFICATION (the gate)
═══════════════════════════════════════════════════════════════════

A. DQ FORMULA VERIFICATION

   For 5 sample properties:
   - Show data_quality_score in the DB
   - Show display value in modal
   - Show display value on per-property page
   - Show value read by archive-benchmark-aggregator.ts
   - Confirm: ALL THE SAME VALUE
   
   If any differ, STOP. Two formulas still in the system.

B. THRESHOLD RECALIBRATION REPORT

   Generate the before/after pass-rate analysis (per Step 2.3A).
   Generate proposed new threshold values (per Step 2.3B).
   This is for Leon's review — do NOT apply threshold changes 
   without explicit approval.

C. APPLY/DISCARD WORKFLOW VERIFICATION

   For 3 sample properties (mix of high/low DQ before enrichment):
   
   1. Reset their enrichment state (delete any web/pending_web 
      layers)
   2. Click AUTO-ENRICH in the modal
   3. Verify: pending_web layer populated with Research Agent 
      output
   4. Verify: resolved values UNCHANGED at this point (pending_web 
      doesn't promote yet)
   5. Verify: modal shows "Pending review" banner + Apply/Discard 
      buttons
   6. Verify: per-property page shows pending fields with visual 
      distinction
   
   Apply test (on 1 property):
   7. Click Apply
   8. Verify: pending_web layer deleted, web layer populated
   9. Verify: resolved values updated to include enrichment data
   10. Verify: DQ score recomputes and rises
   11. Verify: modal banner disappears
   
   Discard test (on 1 property):
   12. Click Discard
   13. Verify: pending_web layer deleted, web layer NOT created
   14. Verify: resolved values revert to pre-enrichment state
   15. Verify: DQ score reflects pre-enrichment state
   16. Verify: per-property page no longer shows pending fields
   
   Cancel-then-Apply test (on 1 property):
   17. Click AUTO-ENRICH → pending_web populated
   18. Close modal without clicking Apply or Discard
   19. Reopen modal
   20. Verify: pending state preserved (pending_web layer still 
       present)
   21. Click Apply
   22. Verify: works correctly

D. INTAKE INBOX VERIFICATION

   Trigger an enrichment via Apartment Locator scrape:
   - Verify: pending_web layer populated
   - Verify: property appears in Intake Inbox tab with "Awaiting 
     review" status
   - From Intake Inbox: open modal → Apply
   - Verify: property removes from Inbox, enrichment commits

   Any failure in A/B/C/D means STOP and report.

═══════════════════════════════════════════════════════════════════
STEP 5 — UPDATE CLAUDE.md STANDING PRINCIPLES
═══════════════════════════════════════════════════════════════════

Add these to the CLAUDE.md file (or equivalent persistent context 
location) as standing principles: