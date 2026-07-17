# Loan Quote Management — Full Implementation Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOAN QUOTE MANAGEMENT                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │  Org-scoped  │  │  Forward     │  │  Term Optimizer  │  │ Exit Window │  │
│  │  quotes DB   │  │  curve (FRED)│  │  (optimal term)  │  │ Calculator  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  └──────┬──────┘  │
│         │                 │                    │                   │         │
│         └─────────────────┼────────────────────┼───────────────────┘         │
│                           │                    │                             │
│              ┌────────────┴────────────────────┴────────────┐                │
│              │           compareQuotes()                    │                │
│              │  rank by: total cost + rate cycle alignment   │                │
│              └────────────────────┬──────────────────────────┘                │
│                                   │                                          │
│         ┌─────────────────────────┼─────────────────────────┐                │
│         ▼                         ▼                         ▼                │
│  ┌────────────┐   ┌──────────────────────┐   ┌──────────────────────┐       │
│  │ F9 DebtTab │   │ M11 DebtAdvisorTab   │   │ DealSection DebtTab  │       │
│  │ (config)   │   │ (strategy narrative) │   │ (capital overview)   │       │
│  └────────────┘   └──────────────────────┘   └──────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components to Build

### Backend (Parallel)
1. **LQ-1: Database migration** — `loan_quotes` table (org-scoped, JSONB for matrix/adjustments)
2. **LQ-2: Store implementation** — PostgreSQL-backed `LoanQuoteStore` with CRUD + list + findStale
3. **LQ-3: API routes** — `GET/POST/PATCH/DELETE /api/v1/org/:orgId/quotes` + `POST /api/v1/org/:orgId/quotes/compare`
4. **LQ-4: Term Optimizer** — Compute optimal loan term from forward curve + hold period + quote spreads
5. **LQ-5: Exit Window Calculator** — Project best refi months from curve troughs + M35 events

### Frontend (Parallel, after backend)
6. **LQ-6: F9 DebtTab integration** — Live quotes in ADD LOAN menu, replace `LOAN_PRESETS`
7. **LQ-7: M11 Advisor enhancement** — Show "optimal refi window" from curve analysis
8. **LQ-8: DealSection DebtTab** — Quote comparison ranking panel

## Key Design Decisions

- **Org-scoped privacy**: Lane B — quotes never cross orgs
- **Forward curve**: 25-year window (10yr back, 15yr forward) from FRED + M35 events overlay
- **Term optimizer**: Minimizes total cost = interest + refi cost (if term < hold) + early payoff (if term > hold)
- **Exit window**: Finds curve troughs where refi DSCR improvement > refi cost
- **Honest absence**: If curve stale/missing, return null with reason — never fabricate

## File Locations

| Component | Path |
|-----------|------|
| Migration | `backend/src/database/migrations/20260716_loan_quotes.sql` |
| Store | `backend/src/services/loan-quotes/loan-quote-store.ts` |
| API routes | `backend/src/api/rest/loan-quotes.routes.ts` |
| Term optimizer | `backend/src/services/debt-advisor/term-optimizer.ts` |
| Exit window | `backend/src/services/debt-advisor/exit-window-calculator.ts` |
| DebtTab integration | `frontend/src/pages/development/financial-engine/DebtTab.tsx` |
| M11 enhancement | `frontend/src/components/m35/M11DebtAdvisorTab.tsx` |
| DealSection panel | `frontend/src/components/deal/sections/DebtTab.tsx` |
