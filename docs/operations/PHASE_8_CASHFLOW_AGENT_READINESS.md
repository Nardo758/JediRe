# Phase 8 — Cashflow Agent Readiness Assessment

**Task:** #1040
**Status:** No changes required to Cashflow Agent for Phase 8 delivery

---

## Phase 8 Fields and Cashflow Agent Impact

### Fields added in Phase 8

| Field | Location | Cashflow Agent relevance |
|---|---|---|
| `narrative` | `property_descriptions.narrative.resolved` (string) | None — qualitative description only |
| `photos` | `property_descriptions.photos.resolved` (array) | None — UI display only |
| `reviews` | `property_descriptions.reviews.resolved` (array) | None — qualitative text |
| `sentiment_summary` | `property_descriptions.sentiment_summary.resolved` (object) | **Potential future risk signal** |
| `recent_events` | `property_descriptions.recent_events.resolved` (array) | **Potential future ownership/capex signal** |

### Conclusion: Cashflow Agent is NOT affected by Phase 8

The Cashflow Agent prompt builder reads from:
- `deal_assumptions` (underwriting inputs)
- `data_library_assets` (property metadata: units, rent, occupancy, cap rate)
- `operator_stance` (modulation rules)
- `deals` (deal context: address, hold period, purchase price)

None of these tables receive Phase 8 writes. Phase 8 writes exclusively to `property_descriptions` (qualitative research data) and `data_library_assets.data_quality_score` (score only, not an underwriting input).

**Zero reads of Phase 8 fields exist in the Cashflow Agent today.** Null cannot reach it.

---

## Future Integration Opportunities

### Sentiment hazard flags → Risk alert
`property_descriptions.sentiment_summary.resolved.hazard_flags` contains categories like `crime`, `noise`, `pests`, `management`. These could be surfaced as:
- Qualitative risk commentary in Cashflow Agent output
- Standalone risk alerts in the JediAlerts system

**Proposed approach:** A new `fetch_property_risk` tool in `backend/src/agents/tools/` reads sentiment data and injects a risk section into the Cashflow Agent context when hazard flags exist.

### Recent events → Underwriting trigger
`property_descriptions.recent_events` with `type: 'renovation' | 'capex'` could trigger conservative expense growth assumptions in OperatorStance or alert the agent to pending capex that may not be captured in the T-12.

**Proposed approach:** The OperatorStance reblend logic checks for recent capex events and applies a higher `expense_growth_posture` if recent major capex is detected.

---

## Verification

Audit of all Cashflow Agent prompt construction paths confirms zero Phase 8 field reads:
- `backend/src/agents/tools/fetch_operator_stance.ts` — reads `deals.operator_stance` only
- `backend/src/services/agents/` — reads DLA + deal_assumptions
- `backend/src/services/correlationEngine.service.ts` — reads market data, not property_descriptions Phase 8 fields

Phase 8 delivery is safe to ship without Cashflow Agent changes.
