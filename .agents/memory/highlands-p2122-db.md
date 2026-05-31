---
name: Highlands p2122 DB write patterns
description: Constraint gotchas discovered when populating investors, capital_calls, deal_waterfalls from source documents for the Highlands at Sweetwater Creek deal (p2122).
---

# DB write patterns — F8 investor/capital tables

## Key constraints

### investors
- `user_id` is NOT NULL FK → users. Must always supply.
- `type` enum: 'lp','gp','co_invest','fund_of_funds','other'
- `entity_type` enum: 'individual','trust','llc','lp','corporation','fund','other'
- `kyc_status` enum: 'pending','in_review','approved','rejected'

### capital_calls
- `status` enum: 'draft','sent','partially_paid','fully_paid','defaulted' (NOT 'fulfilled')
- `allocation_method` enum: 'pro_rata','commitment_pct','custom'

### deal_waterfalls
- UNIQUE constraint on `deal_id` — only ONE row per deal.
- Use a single unified row for both operating and capital event waterfalls; encode the operating stack in `notes`.
- Capital event tiers live in `waterfall_tiers` referencing the single waterfall row.

### deal_waterfall_config
- `preferred_return_type` enum: 'cumulative','non_cumulative','compounding'
- UUID IDs must use valid hex only (0-9, a-f). Characters like 'g' will fail UUID validation.

**Why:** Silent failures (INSERT 0 0 or rollback) caused by check constraints are hard to debug when stderr is suppressed. Always run without `2>/dev/null` on first attempt.
