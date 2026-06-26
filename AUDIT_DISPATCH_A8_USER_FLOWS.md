# A8 Audit — User-Flow Audits (Per Journey)

> **Audit domain:** End-to-end user journeys — can a user complete critical flows without hitting dead ends, errors, or missing data?
> **Status:** Dispatch written
> **Date:** 2026-06-25
> **Auditor:** Agent
> **Rule:** Read-only. Findings → fix backlog.

---

## Scope

Trace the 3 critical user journeys from start to finish:
1. **J1: Deal Creation Flow** — new user creates a deal, seeds proforma, views results
2. **J2: Chat → Agent Run Flow** — user sends message, agent executes, results display
3. **J3: Asset Hub Data Exploration** — user navigates to owned asset, views performance/capital data

---

## Method

For each journey:
1. **Start point:** Identify the entry (URL, button, message)
2. **Step trace:** Follow every network call, state transition, and conditional render
3. **Dead-end check:** At each step, verify the next step exists and works
4. **Error handling:** Check if failures show meaningful messages or silent blanks

---

## Journey 1: Deal Creation

**Steps:**
1. User clicks "Create Deal" → frontend route?
2. Frontend shows CreateDealPage.tsx → form submission?
3. POST /api/v1/deals (inline-deals.routes.ts:372) → validation?
4. Backend inserts deal, seeds proforma → response?
5. Frontend redirects to DealDetailPage.tsx → F1 tab loads?
6. F1 shows deal data → any gaps?
7. User presses F9 → ProForma loads → data seeded?

**Key check:** Does the deal creation endpoint properly seed `deal_assumptions.year1`? The seeder is called but was `forceReseed` required in some paths.

---

## Journey 2: Chat → Agent Run

**Steps:**
1. User sends WhatsApp/Telegram/Web message → MessageRouter
2. MessageRouter routes to Unified Orchestrator
3. Orchestrator dispatches to appropriate agent (research, zoning, etc.)
4. Agent runs (Inngest or direct)
5. Results written to DB (deal_context_fields, agent_runs)
6. Results returned to user via same channel

**Key check:** S1-01 was the Zod crash. Post-fix, do agents actually run and produce output?

---

## Journey 3: Asset Hub Navigation

**Steps:**
1. User navigates to /asset-hub/:dealId
2. AssetHubPage loads → fetches deal data
3. User clicks Revenue → RevenueScreen fetches correlations, rent roll, etc.
4. User clicks Performance → PerformanceScreen fetches PVA, variances
5. User clicks Capital → CapitalScreen fetches debt, waterfall

**Key check:** Now that A6-F1/F2/F3 added refresh, does the data load correctly? Are there still 404s on any endpoint?

---

## Report Template

| Journey | Step | Expected | Actual | Status | Finding |
|---------|------|----------|--------|--------|---------|
| ... | ... | ... | ... | ... | ... |

---

*END OF A8 DISPATCH. Halting for triage.*
