# F9 Financial Model — Agent Specification

This document is the authoritative specification for the F9 financial model. The agent reads this to understand how to reason about inputs, compute outputs, and format results. It is not a math reference for humans — it is the instruction set the agent executes.

---

## 1. Input Model

### 1.1 Hard User Inputs (12)

These are required fields the user must provide.

| # | Field | Type | Notes |
|---|-------|------|-------|
| 1 | purchasePrice | number | Total acquisition price ($) |
| 2 | capexBudget | number | Total capital expenditure budget ($) |
| 3 | loanAmount | number | Loan principal ($) — may be derived from LTV |
| 4 | ltv | number | Loan-to-value ratio (decimal, e.g. 0.65) |
| 5 | term | number | Loan term (months) |
| 6 | amort | number | Amortization period (months) |
| 7 | ioPeriod | number | Interest-only period (months) |
| 8 | holdYears | number | Hold period (years) |
| 9 | lpEquity | number | LP equity contribution ($) |
| 10 | gpEquity | number | GP equity contribution ($) |
| 11 | preferredReturn | number | LP preferred return rate (decimal, e.g. 0.08) |
| 12 | promote_t1 / t2 / t3 | number | Promote tier split rates (decimal) |

### 1.2 Soft User Overrides (13)

Optional overrides — if not provided, use defaults derived from market/document data.

| # | Field | Default | Notes |
|---|-------|---------|-------|
| 1 | marketRent | document-derived | Market rent per unit ($/mo) |
| 2 | vacancy_stab | 0.05 | Stabilized vacancy rate (decimal) |
| 3 | rentGrowth[Y1..Y10] | 0.03 | Annual rent growth per year (decimal) |
| 4 | otherIncomePerUnit | 0 | Other income per unit ($/mo) |
| 5 | expenseGrowth | 0.03 | Annual expense growth rate (decimal) |
| 6 | insurance | document-derived | Insurance per unit ($/yr) |
| 7 | managementFee | 0.04 | Management fee as % of EGI (decimal) |
| 8 | replacementReserves | 250 | Per-unit annual reserves ($/unit/yr) |
| 9 | exitCap | document-derived | Exit capitalization rate (decimal) |
| 10 | saleCosts | 0.02 | Selling costs as % of gross sale price (decimal) |
| 11 | rate | document-derived | Interest rate (decimal) |
| 12 | originationFee | 0.01 | Origination fee as % of loan (decimal) |
| 13 | collectionLoss | 0.015 | Collection/bad-debt loss rate (decimal) |

### 1.3 Document-Derived Inputs (8)

Extracted from deal documents (T-12, rent roll, tax bill). If unavailable, use defaults.

| # | Field | Default | Source |
|---|-------|---------|--------|
| 1 | units | 0 | Rent roll / OM |
| 2 | avgUnitSf | 0 | Rent roll / OM |
| 3 | inPlaceRent | 0 | Rent roll ($/mo) |
| 4 | lossToLease | 0.03 | Market rent vs in-place gap (decimal) |
| 5 | vacancy_y1 | 0.10 | Year-1 vacancy (decimal) |
| 6 | concessions | 0.02 | Concessions rate (decimal) |
| 7 | badDebt | 0.005 | Bad debt rate (decimal) |
| 8 | payroll, maint, contract, mktg, util, admin | per-unit costs | T-12 line items |

### 1.4 Fully Derived Inputs (5)

Computed from hard inputs using Florida-specific conventions.

| # | Field | Formula | Notes |
|---|-------|---------|-------|
| 1 | closingCosts | 0.01 × purchasePrice | 1% of purchase price |
| 2 | docStamps | 0.0070 × purchasePrice | Florida: 0.70% of purchase price |
| 3 | intangibleTax | 0.0020 × loanAmount | Florida: 0.20% of loan amount |
| 4 | titleInsurance | 0.0030 × purchasePrice | Florida: 0.30% of purchase price |
| 5 | propertyTax | FL schedule | See §3.2 |

---

## 2. Output Model

### 2.1 10-Year Operating Statement

Each year produces the following line items.

```
GPR              = units × marketRent × 12 × (1 + rentGrowth[yr])^(yr-1)
lossToLease      = GPR × lossToLease%
vacancy          = GPR × vacancyRate(yr)
concessions      = GPR × concessions%
badDebt          = GPR × badDebt%
baseRevenue      = GPR − lossToLease − vacancy − concessions − badDebt
otherIncome      = otherIncomePerUnit × units × 12 × (1 + expenseGrowth)^(yr-1)
EGR              = baseRevenue + otherIncome

payroll          = payrollPerUnit × units × (1 + expenseGrowth)^(yr-1)
maint            = maintPerUnit × units × (1 + expenseGrowth)^(yr-1)
contract         = contractPerUnit × units × (1 + expenseGrowth)^(yr-1)
mktg             = mktgPerUnit × units × (1 + expenseGrowth)^(yr-1)
util             = utilPerUnit × units × (1 + expenseGrowth)^(yr-1)
admin            = adminPerUnit × units × (1 + expenseGrowth)^(yr-1)
insurance        = insurancePerUnit × units × (1 + expenseGrowth)^(yr-1)
propTax          = propertyTax(yr)  [see §3.2]
mgmtFee          = EGR × managementFee%
reserves         = replacementReserves × units × (1 + expenseGrowth)^(yr-1)

totalExp         = sum of all expense lines above
NOI              = EGR − totalExp

annualInterest   = loanAmount × rate
principal        = PMT − interest (during amortization; 0 during IO period)
debtService      = IO period: annualInterest; amortizing: PMT
CF               = NOI − debtService
DSCR             = NOI / debtService
occupancy        = 1 − vacancyRate(yr)
```

### 2.2 Tax Schedule (Florida CNADR)

Property tax follows Florida's Save Our Homes / CNADR schedule:

- **Reassessment base**: 85% of purchase price (Florida just value methodology)
- **Annual cap**: 10% increase on the reassessment base (CNADR cap)
- **Millage rate**: 2.18% (0.0218) of assessed value

```
assessedValue(yr)  = min(reassessmentBase × (1.10)^(yr-1),
                         reassessmentBase × (1 + 0.10 × (yr-1)))
                   = reassessmentBase × 1.10^(yr-1) [cap always binds for first ~8 yrs]
propertyTax(yr)    = assessedValue(yr) × 0.0218
```

Where `reassessmentBase = purchasePrice × 0.85`.

### 2.3 Disposition / Sale

```
stabilizedNOI      = NOI at holdYear + 1 (forward year)
grossSalePrice     = stabilizedNOI / exitCapRate
saleCosts          = grossSalePrice × saleCosts%
netSaleProceeds    = grossSalePrice − saleCosts
loanBalance        = remaining principal at end of hold (amortization schedule)
equityProceeds     = netSaleProceeds − loanBalance
```

### 2.4 Aggregate Returns

```
totalEquity        = purchasePrice − loanAmount + closingCosts
                     + docStamps + intangibleTax + titleInsurance + capexBudget

cashFlows          = [−totalEquity, CF₁, CF₂, ..., CFₕ, CFₕ + equityProceeds]
                     where h = holdYears
                     Note: CFₕ is the final operating CF before sale proceeds are added.

IRR                = Newton-Raphson on cashFlows
                     30 iterations, initial guess 0.12
                     f(r)   = Σ CFᵢ / (1+r)ⁱ
                     f'(r)  = Σ −i × CFᵢ × (1+r)^(−i−1)
                     rₙ₊₁  = rₙ − f(rₙ) / f'(rₙ)

EquityMultiple     = Σ cashFlows / totalEquity
                     (sum of all undiscounted cash flows divided by equity)

avgCoC             = mean cash-on-cash return over hold years
                     = avg(CF₁ ... CFₕ) / totalEquity
```

### 2.5 Sensitivity Matrix

| | rentGrowth -1% | rentGrowth -0.5% | rentGrowth | rentGrowth +0.5% | rentGrowth +1% |
|---|---|---|---|---|---|
| **exitCap +1%** | IRR | IRR | IRR | IRR | IRR |
| **exitCap +0.5%** | IRR | IRR | IRR | IRR | IRR |
| **exitCap** | IRR | IRR | IRR | IRR | IRR |
| **exitCap -0.5%** | IRR | IRR | IRR | IRR | IRR |
| **exitCap -1%** | IRR | IRR | IRR | IRR | IRR |

Matrix: 5 exit cap rates × 6 rent growth rates = 30 cells. Each cell is the IRR under that combination.

### 2.6 Stress Scenarios

| Scenario | rentGrowth | vacancy | exitCap | expenseGrowth |
|----------|-----------|---------|---------|---------------|
| Base | user input | user input | user input | user input |
| Bear | −50% | +200bps | +100bps | +15% |
| Bull | +25% | −50bps | −50bps | −5% |
| Black Swan | −75% | +500bps | +300bps | +30% |

Each scenario produces IRR and Equity Multiple.

### 2.7 Waterfall

The waterfall distributes net sale proceeds after the loan is repaid. Four tiers:

**Tier 1 — Return of Capital (ROC)**
- LP receives LP equity pro rata
- GP receives GP equity pro rata
- Residual = equityProceeds − (LP_equity + GP_equity)

**Tier 2 — Preferred Return**
- LP receives preferredReturn × LP_equity × holdYears (cumulative)
- If residual < pref amount, LP gets what's available; skip to GP
- Residual after preference

**Tier 3 — Promote Tier 1 (80/20)**
- LP receives 80% of residual up to promote_t1 threshold
- GP receives 20%
- Residual after Tier 3

**Tier 4 — Promote Tier 2 (50/50)**
- LP receives 50% of residual up to promote_t2 threshold
- GP receives 50%
- Residual after Tier 4

**Tier 5 — Promote Tier 3 (GP heavy)**
- LP receives remaining % per promote_t3 split
- GP receives the rest

Output per tier:
- LP IRR and Equity Multiple (net of promote)
- GP IRR and Equity Multiple (including promote/carry)

---

## 3. Conventions & Edge Cases

### 3.1 Vacancy Schedule

If a year-by-year vacancy schedule is provided, use it. If only stabilized vacancy is provided:
- Year 1: `max(vacancy_y1, vacancy_stab)` — use document-derived Y1 vacancy if available
- Years 2+: `vacancy_stab`

Vacancy must be controllable but capped at market-based soft max via Σ covariance.

### 3.2 Florida Property Tax (CNADR)

Only applies to Florida deals. For non-FL deals, property tax = `propertyTaxBase × (1 + expenseGrowth)^(yr-1)`.

FL specific: 85% reassessment, 10% annual cap (indexed to CPI but cap always binds in early years), millage rate 0.0218.

### 3.3 Loan Amortization

```
monthlyRate     = rate / 12
pmt             = loan × [monthlyRate × (1 + monthlyRate)^amort]
                    / [(1 + monthlyRate)^amort − 1]
                (0 during IO period)

annualPayment   = pmt × 12
annualInterest  = beginningBalance × rate
annualPrincipal = annualPayment − annualInterest
endingBalance   = beginningBalance − annualPrincipal
```

During IO period: `annualPayment = annualInterest`, `annualPrincipal = 0`.

### 3.4 IRR Calculation

Newton-Raphson with 30 max iterations, convergence when |rₙ₊₁ − rₙ| < 1e-10.
If no convergence, return NaN.
First cash flow is always negative (equity outlay).

### 3.5 Cash Flow Convention

`cashFlows[0] = −totalEquity` (negative = outlay at time 0)
`cashFlows[1..holdYears]` = annual operating cash flows
`cashFlows[holdYears] += equityProceeds` (sale in final year)

### 3.6 Data Sources Priority

When multiple sources provide the same input, resolve in this order:
1. User override (highest priority)
2. Platform / M07 projection
3. Broker / OM data
4. T-12 historical
5. Market benchmark (lowest priority)

---

## 4. Response Format

The agent must return a JSON object matching this structure:

```json
{
  "summary": {
    "purchasePrice": number,
    "loanAmount": number,
    "totalEquity": number,
    "noiYear1": number,
    "goingInCapRate": number,
    "exitCapRate": number,
    "irr": number,
    "equityMultiple": number,
    "avgCoC": number,
    "loanBalanceAtExit": number,
    "cashOnCashByYear": [number],
    "noiByYear": [number],
    "debtServiceCoverageByYear": [number],
    "debtYieldByYear": [number],
    "effectiveGrossIncomeByYear": [number]
  },
  "annualCashFlow": [
    {
      "year": number,
      "grossPotentialRent": number,
      "lossToLease": number,
      "vacancy": number,
      "concessions": number,
      "badDebt": number,
      "baseRevenue": number,
      "otherIncome": number,
      "effectiveGrossIncome": number,
      "payroll": number,
      "maintenance": number,
      "contractServices": number,
      "marketing": number,
      "utilities": number,
      "admin": number,
      "insurance": number,
      "propertyTax": number,
      "managementFee": number,
      "replacementReserves": number,
      "totalExpenses": number,
      "noi": number,
      "annualInterest": number,
      "annualPrincipal": number,
      "debtService": number,
      "preTaxCashFlow": number,
      "dscr": number,
      "occupancy": number
    }
  ],
  "disposition": {
    "stabilizedNOI": number,
    "grossSalePrice": number,
    "saleCosts": number,
    "netSaleProceeds": number,
    "loanBalance": number,
    "equityProceeds": number
  },
  "sourcesAndUses": {
    "sources": { {label: string, amount: number}[] },
    "uses": { {label: string, amount: number}[] }
  },
  "sensitivityMatrix": {
    "rows": [
      { "exitCap": number, "rentGrowths": [number] }
    ]
  },
  "stressScenarios": [
    { "scenario": "base"|"bear"|"bull"|"black_swan",
      "irr": number, "equityMultiple": number }
  ],
  "waterfallDistributions": [
    { "tier": number, "tierName": string,
      "lpDistribution": number, "gpDistribution": number,
      "lpIrr": number, "gpIrr": number,
      "lpEquityMultiple": number, "gpEquityMultiple": number }
  ]
}
```
