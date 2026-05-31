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

# BPI annual ingest — deal_monthly_actuals pattern (p2122)

## Owned portfolio — single property
As of 2026-05-31, the owned portfolio is exactly ONE property: Highlands at Sweetwater Creek.
"Parkway 290 Apartments" and "Cedar Hills at McKinney" were placeholder seeds — deleted.

## Completed years
- 2022: 13 rows (Dec 2021–Dec 2022), Yardi base + BPI enrichment
- 2023: 12 rows (Jan–Dec 2023)
- 2024: 12 rows (Jan–Dec 2024)
- 2025: 12 rows (Jan–Dec 2025)
- 2026 YTD: 4 rows (Jan–Apr 2026)
- Total: 65 monthly rows (Dec 2021–Apr 2026)

## deal_data annual capsule keys
`annual_2022`, `annual_2023`, `annual_2024`, `annual_2025` — each has `income_statement`, `occupancy`, `balance_sheet_dec31`, `capital_activity_<year>`, `cash_flow_dec`, `rent_roll_dec31`, `notes`.
`ytd_2026` — partial year; uses `income_statement_ytd`, `monthly_detail`, `balance_sheet_apr30`, `cash_flow_apr`, `rent_roll_apr30`, `alerts`, `positive_indicators`.

## Field name inconsistency (2022–2024 vs 2025)
- 2022–2024 use `net_income` and `interest_expense` in income_statement
- 2025 uses `net_income_bpi`, `net_income_gaap`, `interest_expense_bpi` (GAAP adoption)
- Do NOT change 2022–2024 for consistency; just handle both in consumers.

## GAAP adoption in 2025
- Balance sheet now includes accumulated depreciation -$8,609,291 (retroactive)
- Equity dropped from $29.9M (2024) to $18.6M (2025) — NOT operationally comparable
- BPI income statement figures remain pre-depreciation, comparable across all years
- 2025 has both `net_income_bpi` (operating, -$657K) and `net_income_gaap` (-$3.05M)

## 2025 loan refinance
- September 2025: $51M → $53.85M; deferred fees $1,087,726; interest dropped ~38%
- Monthly interest pre-refi ~$366K, post-refi ~$241K (Sep–Dec avg)
- $2.85M cash-out proceeds → largely distributed to investors ($1.97M new distributions)

## Occupancy estimation from vacancy loss
When per-month occupancy is not directly stated: `occ = 1 - (vacancy_loss / monthly_GPR)`.
Use ending-year GPR for Dec column; prior-year ending for Jan–Aug if rent increase happened mid-year.
