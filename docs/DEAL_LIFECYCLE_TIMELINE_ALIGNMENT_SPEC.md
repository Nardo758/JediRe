# Deal Lifecycle ↔ Timeline Alignment Spec

**Status:** Design overlay — aligns the deal lifecycle state machine with the proforma data timeline
**Pairs with:** `PROFORMA_TIMELINE_MODEL_SPEC.md` (the data timeline), `DC31_RESOLUTION_SPEC.md` (agent write-back)
**Purpose:** make the timeline's boundary movements *triggered and meaningful* by binding them to deal lifecycle transitions — from deal creation through monitoring to sale and immutable historical record.

---

## 0. Core principle (non-negotiable)

**Lifecycle stage CONFIGURES the timeline. It NEVER gates it.**

The launch product is address-driven analysis — most deals enter as an address, get underwritten, and are never owned. A deal at the earliest stage, with nothing but an address and maybe a T12, must still produce a valid timeline (mostly projection). Ownership stages *add* real actuals, monitoring, and reconciliation; they are never a prerequisite for the timeline to exist.

Practically: the timeline's three input classes (immutable actuals, versioned assumptions, period overrides — see timeline spec §6) are populated *to the extent the lifecycle stage provides them*. Early stages = thin/no actuals, heavy projection. Later stages = thick actuals, shrinking projection. Same model throughout; only the fill changes.

---

## 1. The state machine

```
                    ┌─────────────► PASSED ◄──────────┐
                    │              (terminal-ish)      │
                    │                                  │
  PROSPECT ──► UNDERWRITING ──► UNDER CONTRACT ──► CLOSED/OWNED
  (created)    (diligence)      (firm close)      (ownership starts)
                    ▲                  │                  │
                    └──── fell through─┘                  ▼
                                                     MONITORING
                                                     (live hold)
                                                          │
                                                          ▼
                                                   DISPOSITION
                                                   (sale contracted)
                                                          │
                                                          ▼
                                                       SOLD
                                                          │
                                                          ▼
                                                  HISTORICAL RECORD
                                                   (archived, immutable)
```

**Non-linear paths (must be supported):**
- **Prospect/Underwriting → Passed:** most deals die here. A passed deal still archives a *thin* record (the underwriting at time of pass + the pass reason) — useful calibration data ("what did we project, why did we walk").
- **Under Contract → Fell Through → Underwriting/Passed:** deals fall out of contract.
- **Passed → re-engaged:** a passed deal can re-enter Underwriting later (new cycle; prior underwriting is a versioned input, not overwritten).

---

## 2. Per-phase outline

For each phase: **trigger**, **boundaries**, **zone composition**, **data inflow**, **agent role**, **reconciliation/notify**, **historical-record contribution**.

### Phase A — PROSPECT (deal created)
- **Trigger:** address entered (chat) or deal created (terminal). May be address-only.
- **Boundaries:** actuals boundary = T12-end *if a T12 exists*, else none (no history zone). Closing boundary = hypothetical/assumed close date.
- **Zones:** thin-or-empty history; gap = T12-end → assumed close; projection = full 10yr forward.
- **Data inflow:** address, platform comps, whatever public/RentCast/ATTOM data resolves from the address. Often no T12 yet.
- **Agent role:** projects the entire forward zone from platform/market defaults. This is pure forward estimate — lowest-confidence state.
- **Reconciliation:** none (no incoming actuals).
- **Historical contribution:** none yet (unless it dies here → thin Passed record).
- **Launch relevance:** ✅ this is the chat launch surface. Works on current single-value tooling today; upgrades to periodic timeline later.

### Phase B — UNDERWRITING / DILIGENCE
- **Trigger:** active pursuit; documents acquired.
- **Boundaries:** actuals boundary firms up at real T12-end once a T12 is parsed. Closing boundary = target close date.
- **Zones:** history = parsed T12 (1–5yr if multiple statements); gap = real T12-end → target close; projection = forward from close.
- **Data inflow:** T12, rent roll, OM, tax bill, PCA. **Per-month T12 actuals should be captured here** (timeline spec Phase 0) — this is where history first becomes real and granular.
- **Agent role:** projects forward from *real* last-actual + refined assumptions. Confidence rises as inputs thicken. Agent values land in projection-zone periods (via the DC-31 write-back path; they do **not** contend with T12 — different periods).
- **Reconciliation:** none (still no owned actuals).
- **Historical contribution:** none yet; on Pass → archives underwriting snapshot + pass reason.
- **Launch relevance:** ✅ launch surface (the richer analysis path).

### Phase C — UNDER CONTRACT
- **Trigger:** PSA executed; close date firm.
- **Boundaries:** closing boundary becomes a **firm date**; the gap (T12-end → close) is now concrete in months.
- **Zones:** unchanged shape; gap is now precise.
- **Data inflow:** final diligence, updated T12 closer to close (gap shrinks as fresher actuals arrive).
- **Agent role:** projection finalized against the firm close. Exit assumptions (hold, cap rate) firm up.
- **Reconciliation:** if a fresher T12 arrives, the actuals boundary advances within history (still pre-ownership) — minor, notify if material.
- **Historical contribution:** none; on Fell-Through → archives the contracted-then-dead record.

### Phase D — CLOSED / OWNED  ← **the pivotal transition**
- **Trigger:** close completes. Ownership begins.
- **Boundaries:** closing boundary becomes "now / acquisition date." The **actuals boundary will now advance past the closing boundary** for the first time — projection starts converting to actuals.
- **Zones:** history (pre-acquisition T12) + a now-fixed acquisition point; projection from acquisition forward. The gap closes (close has happened).
- **Data inflow:** ownership data systems come online (the deal flips to live monitoring).
- **Agent role:** the underwriting projection is now the **baseline of record** — the thing realized performance will be measured against (calibration anchor).
- **Reconciliation:** begins next month.
- **Historical contribution:** the as-underwritten projection is **frozen as the baseline** for later projected-vs-realized comparison.
- **Launch relevance:** ⚠️ post-acquisition — requires timeline infrastructure (Phases 1–5). Not launch-gating.

### Phase E — MONITORING / HOLD  ← **the production process running live**
- **Trigger:** each new month of owned operating data.
- **Boundaries:** actuals boundary **advances monthly**, eating into the projection zone.
- **Zones:** growing actuals (acquisition → month M), shrinking projection (M → exit).
- **Data inflow:** monthly operating statements, rent roll, occupancy. **This is where lease-up trajectory data is generated** — the data the owned portfolio (Frisco/McKinney/Duluth) currently lacks.
- **Agent role:** re-projects the shrinking forward zone from the advancing boundary; produces the running projected-vs-actual variance.
- **Reconciliation/notify:** **this is timeline spec §5 executing repeatedly** — boundary advance → overlap variance (projected M vs actual M) → re-base → **notify user** (no silent re-base). Material-threshold notification applies.
- **Historical contribution:** each reconciled month is a permanent actual + a variance datum (the agent's calibration record accrues here). Sub-states *lease-up* vs *stabilized* are the trajectory the correlation engine needs.
- **Launch relevance:** ⚠️ post-acquisition.

### Phase F — DISPOSITION (sale contracted)
- **Trigger:** decision to sell; sale date set.
- **Boundaries:** a **sale boundary** appears at the planned disposition date. Projection beyond the sale boundary **truncates** (no value in projecting past exit).
- **Zones:** actuals (acquisition → now) + short remaining projection (now → sale) + realized-exit assumptions at the boundary.
- **Data inflow:** broker pricing, exit cap, sale comps.
- **Agent role:** finalizes the exit segment; projection collapses to the exit point.
- **Reconciliation/notify:** monitoring continues until sale closes; notify on exit-assumption changes.
- **Historical contribution:** exit terms finalize; realized-return frame assembles.

### Phase G — SOLD
- **Trigger:** sale closes.
- **Boundaries:** sale boundary becomes a fixed disposition date. **The entire hold (acquisition → disposition) is now actuals.** Projection zone = empty.
- **Zones:** all actuals; no projection.
- **Data inflow:** final settlement.
- **Agent role:** none forward; the agent's *original* projection is now scored end-to-end against realized.
- **Reconciliation:** final — full-hold projected-vs-realized computed.
- **Historical contribution:** complete owned-asset actuals series, acquisition to exit.

### Phase H — HISTORICAL RECORD (archived, immutable)
- **Trigger:** post-sale archival (or Pass/Fell-Through → thin archive).
- **Boundaries:** all frozen.
- **Zones:** immutable actuals series (full hold) + the frozen as-underwritten baseline.
- **Data inflow:** none — **immutable**.
- **Agent role:** the deal is now training/calibration *input*, not subject.
- **Reconciliation:** n/a.
- **Historical contribution:** **this is the payoff.** A clean, non-CoStar historical observation that feeds: (1) agent calibration (projected-vs-realized, per market/strategy), (2) Correlation Engine outcome tracking (the stabilization-trajectory rows Phase 1B is blocked on — currently zero), (3) comps for future underwriting. **The loop closes: sold deals underwrite the next deals.**

---

## 3. The calibration loop (why archive matters)

```
UNDERWRITING: agent projects baseline X
      │
MONITORING: actuals reconcile vs X each month  ──► running variance (calibration record)
      │
SOLD: realized vs originally-projected, full hold
      │
ARCHIVED: immutable record ──┐
      │                       │ feeds
      └──────────────────────►│  • agent calibration (is the agent any good? per market/strategy)
                              │  • Correlation Engine outcome tracking (Phase 1B substrate)
                              │  • comps for the NEXT deal's underwriting
                              ▼
                    NEXT DEAL'S PROSPECT/UNDERWRITING
```

The archived actuals are **versioned immutable inputs** (version inputs, not outputs — at deal-lifecycle scale). They are your own owned-asset operating data → **CoStar-firewall clean** by construction.

---

## 4. Launch relevance vs. post-acquisition (honest phasing)

| Phases | States | Launch-relevant? | Tooling |
|---|---|---|---|
| A–C | Prospect, Underwriting, Under Contract | ✅ Yes — the chat analysis product | Works on current single-value proforma today; upgrades to periodic timeline later (timeline spec Phases 1–5) |
| D–H | Closed, Monitoring, Disposition, Sold, Archived | ⚠️ Post-acquisition | Requires timeline infrastructure (Phases 1–5). Aligns with Correlation Engine Phase 1B. Not launch-gating. |

**This overlay is a target-state design frame, not a build order.** The current product implements A–C with existing tooling. D–H come online as the timeline infrastructure is built and as you actually own and monitor deals in-platform. Do **not** read this as "build the full lifecycle now." *(Note: the D–H back-half storage — `deal_monthly_actuals`, `dispositions` with variance columns, `deal_lifecycle_events`, `archive_deals` — already exists in schema. The remaining work is wiring these existing stores to lifecycle-stage triggers, not building from scratch.)*

---

## 5. Connection to parked work

- **Timeline spec Phase 0 (per-month T12 persistence)** is triggered in **Phase B (Underwriting)** — that's where history first becomes real and granular. Capturing it there is the now-cost item; everything downstream (Monitoring reconciliation, archived trajectory) depends on per-month actuals existing from the start.
- **Correlation Engine Phase 1B** (blocked on zero stabilization rows + no outcome schema) is *fed* by Phases E→H. The lifecycle overlay is the data source that unblocks it — but only for deals that run the full lifecycle in-platform. Existing owned portfolio (Frisco/McKinney/Duluth) predates this and lacks the trajectory; new in-platform deals generate it.

---

## DECISIONS (open)

1. **State granularity:** is the 8-state machine right, or do Monitoring sub-states (lease-up / stabilized) need to be first-class states rather than tags? (Affects how trajectory is queried.)
2. **Pass/Fell-Through record depth:** how thin is a thin archive? Minimum = underwriting snapshot + reason. Worth more? (Lost-deal data has analytical value but costs storage/discipline.)
3. **Baseline immutability at close:** is the as-underwritten projection frozen exactly at close (Phase D), or at a later "final underwriting" checkpoint? Determines the calibration anchor.
4. **Re-engagement versioning:** when a Passed deal re-enters Underwriting, is the prior cycle a sibling version or a new deal linked to the old? (Affects the historical record's identity model.)
