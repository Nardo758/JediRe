# CONCESSION AMORTIZATION SPEC

**Status:** Draft v1.0
**Owner:** F9 ProForma engine ↔ Lease Velocity Engine
**Depends on:**
  - `LEASE_VELOCITY_ENGINE_SPEC.md` — produces concession-earned dollars per lease event
  - `CONCESSION_ENVIRONMENT_SUB_ENGINE_SPEC.md` — produces per-unit concession amounts
  - `LEASING_ASSUMPTIONS_UI_SPEC.md` — `leasing_cost_treatment` toggle drives behavior
  - `M07_SUBJECT_HISTORY_AND_DIFF_EXTRACTOR_SPEC.md` — historical concession data from rent rolls

**Unblocks:** The "Current year (YYYY) Concessions" row visible in F9 Projections that doesn't currently have a documented spec. Closes the last documentation gap in the Leasing/Lease Velocity workstream.

**Estimated implementation:** 3–4 days. Algorithmic complexity is moderate; complexity comes from edge cases.

---

## 1. PURPOSE & THE PROBLEM IT SOLVES

In F9 Projections, two rows show concession dollars at different aggregations:

- **TOTAL CONCESSIONS** (per-period earned) — the dollars associated with lease events occurring in that period
- **Current year (YYYY) Concessions** (per-calendar-year recognized) — the dollars actually hitting the calendar-year P&L

These differ because:
1. A concession given in November amortizes across November and December calendar P&L — and into January if it crosses years
2. Onetime concessions are typically straight-line amortized over the lease term as a contra-revenue (ASC 842)
3. Lease commencement date may differ from sign date, which differs from move-in date
4. Cash basis ("when given") differs from accrual basis ("when applicable") differs from operating basis ("when burned off")

Today the platform computes the per-period earned line via the Concession Environment Sub-Engine but does NOT have a spec for the recognition layer. The result: the calendar-year row exists in some models with opaque logic and not in others. This spec fixes that.

---

## 2. THE FUNDAMENTAL CONCEPT

A **concession** is a dollar amount associated with a specific lease event. It has temporal attributes that determine recognition timing:

```typescript
interface ConcessionRecord {
  id: string;
  lease_id: string;
  concession_type: ConcessionType;
  amount_total: number;                  // total dollar value
  amount_currency: 'USD';

  // Temporal attributes
  sign_date: ISODate;                     // when concession was agreed
  commencement_date: ISODate;             // lease commencement (typically = move-in)
  amortization_period_months: number;     // over how many months it's recognized
  amortization_method: AmortizationMethod;

  // Lease context
  lease_start_date: ISODate;
  lease_end_date: ISODate;
  lease_term_months: number;

  // Burn-off specific (when applicable)
  burn_off_months: number | null;         // months of full free rent
  burn_off_pattern: 'FRONT_LOADED' | 'SPREAD' | null;
}

type ConcessionType =
  | 'NEW_LEASE_ONETIME'      // e.g., "first month free"
  | 'NEW_LEASE_ONGOING'      // e.g., "$200/mo abatement for 12 months"
  | 'RENEWAL_ONETIME'        // smaller, at renewal
  | 'RENEWAL_ONGOING'        // rare; recovery-mode retention
  | 'LEASE_UP_INCENTIVE'     // structured lease-up promotion
  | 'PRE_LEASE_BONUS';       // pre-CO signing bonus

type AmortizationMethod =
  | 'CASH_AT_COMMENCEMENT'   // recognized lump-sum at commencement
  | 'STRAIGHT_LINE_GAAP'     // amortized straight-line over lease term (default)
  | 'BURN_OFF'               // recognized in months of actual application
  | 'FRONT_LOADED'           // weighted toward early months;
  | 'CUSTOM';                // user-defined schedule
```

The Amortization Engine takes a stream of `ConcessionRecord` objects and produces:

1. **Per-month recognition schedule** — what amount hits P&L each operating month
2. **Per-calendar-year aggregate** — what amount hits each calendar year P&L
3. **Per-fiscal-year aggregate** — same, but on the deal's fiscal calendar (if different)

---

## 3. THREE AMORTIZATION METHODS

### 3.1 STRAIGHT_LINE_GAAP (default, ASC 842 standard)

Concession amount distributed evenly across the lease term. Most common institutional treatment because it matches GAAP requirements for lease incentives.

```
monthly_recognition = amount_total / lease_term_months

For each month m in [commencement_month, commencement_month + lease_term_months − 1]:
    concession_recognized[m] += monthly_recognition
```

**Example:** $2,000 concession on a 12-month lease starting June 2026:
- $166.67 recognized per month from June 2026 through May 2027
- Calendar 2026 portion: 7 months × $166.67 = $1,166.69
- Calendar 2027 portion: 5 months × $166.67 = $833.33

**When to use:** institutional reporting, LP-presented financials, lender packages, most underwriting scenarios.

### 3.2 CASH_AT_COMMENCEMENT

Full concession amount recognized in the commencement month. Reflects when cash is actually given (or rent forgiven).

```
For commencement_month:
    concession_recognized[commencement_month] = amount_total
For all other months:
    concession_recognized[m] = 0
```

**Example:** Same $2,000 concession:
- $2,000 recognized June 2026
- Calendar 2026: $2,000
- Calendar 2027: $0

**When to use:** sponsor cash-basis underwriting, deal-level liquidity analysis, simple stress modeling. Common in less-sophisticated proformas. Generally NOT institutional standard.

### 3.3 BURN_OFF

Concession recognized only in the months where it's actually applied. For "X months free" structures, this means full monthly_rent is "given" in those months and zero in subsequent months.

```
For each month m in [commencement_month, commencement_month + burn_off_months − 1]:
    concession_recognized[m] = monthly_rent_at_lease_commencement
For all other months in lease term:
    concession_recognized[m] = 0
```

**Example:** $2,000 concession structured as "1 month free" on a $1,925/mo lease starting June 2026 (burn_off_months = 1):
- $1,925 recognized June 2026
- $0 thereafter
- Calendar 2026: $1,925
- Calendar 2027: $0
- Note: $2,000 ≠ $1,925 — there's a $75 reconciling difference. The concession amount and the burn-off rent rarely match exactly. The engine chooses one as authoritative (default: amount_total wins; difference becomes a reconciliation line)

**When to use:** when modeling actual cash flow timing for property-level operations. More accurate than CASH_AT_COMMENCEMENT for "X months free" structures because it shows the rent decrement in the actual months. Common in property-management reporting.

### 3.4 FRONT_LOADED (extension)

Concession amortized with weighted distribution favoring early months. Used when lease incentives are structured as "burn down" rather than even amortization.

```typescript
const FRONT_LOADED_CURVE_12MO = [
  0.20, 0.18, 0.15, 0.12, 0.10, 0.08,
  0.06, 0.05, 0.03, 0.02, 0.01, 0.00
];
// Custom curve per lease_term_months — admin-tunable

For each month m offset from commencement:
    concession_recognized[m] = amount_total × curve[m] × scaling_factor
```

**When to use:** structured lease-up incentives where the concession economically "burns off" as the property reaches stabilization. Less common; available as expert option.

### 3.5 CUSTOM

Power-user method: user supplies a custom amortization schedule per concession.

```typescript
custom_schedule: { month_offset: number, amount: number }[]
// Must sum to amount_total
```

**When to use:** non-standard lease structures (e.g., free rent in months 6-7 instead of 1-2; mid-term incentives; structured holdback).

---

## 4. PER-CONCESSION-TYPE DEFAULT METHODS

The default amortization method varies by concession type. Specified in platform config.

| Concession Type | Default Method | Justification |
|---|---|---|
| `NEW_LEASE_ONETIME` | `STRAIGHT_LINE_GAAP` | ASC 842 requires straight-line for lease incentives |
| `NEW_LEASE_ONGOING` | `STRAIGHT_LINE_GAAP` | Same |
| `RENEWAL_ONETIME` | `STRAIGHT_LINE_GAAP` | Same |
| `RENEWAL_ONGOING` | `STRAIGHT_LINE_GAAP` | Same |
| `LEASE_UP_INCENTIVE` | `FRONT_LOADED` | Reflects economic burn-off |
| `PRE_LEASE_BONUS` | `CASH_AT_COMMENCEMENT` | Often a one-time signing bonus |

These are platform defaults. Per-deal overrides available. Per-concession overrides available (Expert tier).

---

## 5. THE AMORTIZATION ENGINE

### 5.1 Inputs

```typescript
interface AmortizationEngineInput {
  // Concession event stream — past, present, future
  concession_records: ConcessionRecord[];

  // Time horizon
  analysis_start_month: ISODate;
  analysis_end_month: ISODate;

  // Treatment context
  leasing_cost_treatment: 'OPERATING' | 'CAPITALIZED' | 'HYBRID';

  // Calendar
  fiscal_year_start_month: number;       // 1=Jan default; 4=Apr for some funds
}
```

### 5.2 Processing

```typescript
function amortizeConcessions(input: AmortizationEngineInput): AmortizationOutput {
  const monthlyRecognition: Map<string, number> = new Map();  // YYYY-MM key
  const writeOffs: WriteOff[] = [];

  for (const record of input.concession_records) {
    if (input.leasing_cost_treatment === 'CAPITALIZED'
        && isLeaseUpPeriodConcession(record)) {
      // Lease-up period concessions in CAPITALIZED treatment don't hit P&L
      // They appear as S&U line item only
      continue;
    }

    const schedule = computeSchedule(record, input);
    for (const { month, amount } of schedule) {
      const key = formatMonthKey(month);
      monthlyRecognition.set(key, (monthlyRecognition.get(key) ?? 0) + amount);
    }
  }

  // Aggregate to calendar/fiscal year
  const calendarYearAggregate = aggregateByCalendarYear(monthlyRecognition);
  const fiscalYearAggregate = aggregateByFiscalYear(monthlyRecognition,
                                                    input.fiscal_year_start_month);

  return {
    monthly_recognition: monthlyRecognition,
    calendar_year_recognition: calendarYearAggregate,
    fiscal_year_recognition: fiscalYearAggregate,
    write_offs: writeOffs,
    method_summary: summarizeMethodsUsed(input.concession_records)
  };
}
```

### 5.3 Schedule computation per record

```typescript
function computeSchedule(
  record: ConcessionRecord,
  context: AmortizationEngineInput
): { month: ISODate, amount: number }[] {
  switch (record.amortization_method) {
    case 'CASH_AT_COMMENCEMENT':
      return [{
        month: record.commencement_date,
        amount: record.amount_total
      }];

    case 'STRAIGHT_LINE_GAAP':
      return generateStraightLineSchedule(record);

    case 'BURN_OFF':
      return generateBurnOffSchedule(record);

    case 'FRONT_LOADED':
      return generateFrontLoadedSchedule(record);

    case 'CUSTOM':
      return record.custom_schedule!.map(entry => ({
        month: addMonths(record.commencement_date, entry.month_offset),
        amount: entry.amount
      }));
  }
}

function generateStraightLineSchedule(record: ConcessionRecord) {
  const monthly = record.amount_total / record.lease_term_months;
  const schedule = [];
  for (let i = 0; i < record.lease_term_months; i++) {
    schedule.push({
      month: addMonths(record.commencement_date, i),
      amount: monthly
    });
  }
  return schedule;
}
```

### 5.4 Output structure

```typescript
interface AmortizationOutput {
  // Per operating month, total concession recognition
  monthly_recognition: Map<YYYYMM, number>;

  // Aggregated per calendar year
  calendar_year_recognition: Map<YYYY, number>;

  // Aggregated per fiscal year
  fiscal_year_recognition: Map<YYYY, number>;

  // Early-termination write-offs detected
  write_offs: WriteOff[];

  // Summary of methods used
  method_summary: {
    [method in AmortizationMethod]: number  // count
  };
}
```

### 5.5 Storage in dealContext

```typescript
dealContext.concession_recognition = {
  monthly: { '2026-01': -1234.56, '2026-02': -1408.22, ... },
  by_calendar_year: { '2025': -98765, '2026': -134890, '2027': -156234 },
  by_fiscal_year: { '2025': -89432, '2026': -124567, '2027': -149832 },
  method_used_per_concession_type: {
    NEW_LEASE_ONETIME: 'STRAIGHT_LINE_GAAP',
    NEW_LEASE_ONGOING: 'STRAIGHT_LINE_GAAP',
    // etc.
  },
  write_offs_year_to_date: -3450,      // current YTD write-offs
  last_recomputed: ISODateString
};
```

Cached per existing 24h DealContext rules. Recomputed on:
- New Lease Velocity Engine output (concession_records change)
- `leasing_cost_treatment` change
- Subject history update (rebuilds historical concession schedule from rent rolls)
- `fiscal_year_start_month` change

---

## 6. CONNECTION TO `leasing_cost_treatment` TOGGLE

The toggle determines WHETHER concessions hit P&L at all, and HOW. The amortization method determines WHEN within the P&L.

| Treatment | Lease-up period concessions | Stabilized period concessions | Marketing | Reserve |
|---|---|---|---|---|
| `OPERATING` | hits P&L per amortization method | hits P&L per amortization method | OpEx as incurred | n/a |
| `CAPITALIZED` | S&U capital line; does NOT hit P&L | hits P&L per amortization method | S&U for lease-up portion; OpEx after | S&U capital |
| `HYBRID` | hits P&L as effective-rent reduction (straight-line over lease term) | hits P&L per amortization method | OpEx throughout | S&U capital (cumulative shortfall only) |

### 6.1 What "lease-up period concessions" means

For mode `LEASE_UP_NEW_CONSTRUCTION`:
- Lease-up period = months from `delivery_month` until `stabilization_achieved_month`
- Concessions on leases commencing during this window are flagged `is_lease_up_period = true`
- Under `CAPITALIZED` treatment, these are stripped from P&L recognition and aggregated into the lease-up reserve calculation

For modes `STABILIZED_MAINTENANCE` and `OCCUPANCY_RECOVERY`:
- No lease-up period exists
- All concessions hit P&L per amortization method (subject to treatment rules above)

### 6.2 Treatment-toggle invariant

**Total cash spent on concessions across the analysis horizon must be identical regardless of `leasing_cost_treatment`.** Only presentation changes.

```typescript
// Runtime assertion
const cashTotal_Operating = computeCashTotal(records, 'OPERATING');
const cashTotal_Capitalized = computeCashTotal(records, 'CAPITALIZED');
const cashTotal_Hybrid = computeCashTotal(records, 'HYBRID');
assert(cashTotal_Operating === cashTotal_Capitalized);
assert(cashTotal_Capitalized === cashTotal_Hybrid);
```

Failure = engine bug, fail loud.

---

## 7. EDGE CASES (REQUIRED HANDLING)

### 7.1 Early lease termination

When a tenant terminates a lease early (eviction, skip, voluntary buyout):
- Unamortized concession portion becomes a write-off
- Hits P&L in the termination month as a contra-revenue spike

```
unamortized_remaining = amount_total − cumulative_recognized_to_termination_month
write_off_recognized_in_termination_month = unamortized_remaining
```

**Example:** $2,000 concession, 12-month STRAIGHT_LINE_GAAP, terminated month 7:
- Recognized months 1-6: $166.67 × 6 = $1,000
- Termination month 7: $1,000 write-off (the remaining 6 months × $166.67)
- Total recognized = $2,000 (unchanged)

Detected via M07 diff extractor (`EVT_EVICTION_DETECTED` or premature lease end). Subject to source flagging — eviction-driven write-offs flagged separately from voluntary terminations.

### 7.2 Lease renewal mid-amortization

When a lease that's still amortizing a concession renews, the renewal lease has its OWN concession schedule. The original concession continues amortizing through its scheduled end:

- Original concession amortizes through original lease_end_date (no acceleration)
- New renewal concession amortizes from renewal lease_start_date over renewal_lease_term_months
- Both can overlap in months — engine sums all overlapping recognition

**Example:** Original $2,400 / 12-month / Jan 2026 commencement. Tenant renews Jan 2027 with $1,200 / 12-month renewal concession:
- Calendar 2026: $200/mo × 12 = $2,400
- Calendar 2027: $0 (original done) + $100/mo × 12 = $1,200
- Total over both years: $3,600 (the original $2,400 + renewal $1,200)

### 7.3 Lease-end with NO renewal (move-out at expiration)

No write-off. Original schedule completed at lease_end_date. Standard.

### 7.4 Holdover (month-to-month after expiration)

Original concession schedule completes at original lease_end_date. Holdover months have no concession recognition unless a new concession is granted (which would be a new ConcessionRecord).

### 7.5 Concession on subsequently-terminated month-to-month

If a one-month-free concession was given but the tenant only stays 2 weeks before termination:
- Under BURN_OFF method: the full concession was already recognized in month 1 (the free month). No write-off.
- Under STRAIGHT_LINE_GAAP: only the proportional portion of the concession was recognized; remainder is written off.

### 7.6 Concession on a lease that crosses the analysis horizon end

If lease commences month 30 of a 36-month analysis with 12-month term:
- Months 30-36 of the analysis: monthly_recognition included
- Months 37-41 (post-analysis): NOT included in analysis output
- The truncated portion is recorded in `truncated_recognition_post_horizon` for full transparency

### 7.7 Multiple concessions per lease

Common in lease-up: $2,000 onetime + $100/month ongoing. Two separate `ConcessionRecord` entries:
```
Record 1: NEW_LEASE_ONETIME, amount=$2,000, STRAIGHT_LINE_GAAP, 12mo
Record 2: NEW_LEASE_ONGOING, amount=$1,200, STRAIGHT_LINE_GAAP, 12mo
```

Both amortize independently; engine sums per month.

### 7.8 Concession on a unit that goes structural/down

Mid-amortization, the unit is taken out of service for renovation:
- Remaining unamortized concession → write-off in the down month
- Flagged as `STRUCTURAL_WRITE_OFF` (separate from eviction write-offs)
- Visible in `write_offs` array with reason

### 7.9 Subject historical concessions from rent roll snapshots

When subject_history has rent roll snapshots, the diff extractor identifies past concessions. These have:
- Known commencement_date (from lease_start_date in rent roll)
- Known amount (from concessions field)
- Method = inferred or platform default

Past concessions still amortizing at analysis_start contribute to monthly_recognition for analysis months they cover.

**Example:** Property acquisition closes Jan 2026. Rent roll shows lease commenced Jul 2025 with $1,800 / 12-month concession STRAIGHT_LINE_GAAP. As of Jan 2026:
- 6 months already amortized (pre-acquisition; not in current owner's P&L)
- 6 months remaining (Jan-Jun 2026, IN current owner's P&L)
- Engine recognizes $150/mo Jan-Jun 2026 from this lease

### 7.10 Concession record discovery from rent rolls without explicit concession field

Some rent rolls don't track concessions in a structured field. Two heuristics:
- Detect rent below market_rent column → infer concession value
- Detect lease "starting rent" lower than "stabilized rent" via lease abstract

Both are imprecise. When uncertain, flag the concession as `inferred = true` with low confidence. Engine still amortizes but downstream UI shows lower confidence indicator.

---

## 8. CALENDAR YEAR vs FISCAL YEAR

### 8.1 Calendar year (default)

Calendar year = January 1 through December 31. Used in all default reporting.

```typescript
function aggregateByCalendarYear(monthly: Map<YYYYMM, number>): Map<YYYY, number> {
  const byYear = new Map<string, number>();
  for (const [yyyymm, amount] of monthly) {
    const year = yyyymm.substring(0, 4);
    byYear.set(year, (byYear.get(year) ?? 0) + amount);
  }
  return byYear;
}
```

### 8.2 Fiscal year (configurable)

Some institutional funds use fiscal years differing from calendar:
- Apr-Mar (common in real estate funds)
- Jul-Jun (common in pensions)
- Custom per fund

```typescript
deal.fiscal_year_start_month: number  // 1 = Jan (default), 4 = Apr, etc.
```

```typescript
function aggregateByFiscalYear(
  monthly: Map<YYYYMM, number>,
  fiscalStart: number
): Map<YYYY, number> {
  const byFiscal = new Map<string, number>();
  for (const [yyyymm, amount] of monthly) {
    const fiscalYear = computeFiscalYear(yyyymm, fiscalStart);
    byFiscal.set(fiscalYear, (byFiscal.get(fiscalYear) ?? 0) + amount);
  }
  return byFiscal;
}

function computeFiscalYear(yyyymm: string, fiscalStart: number): string {
  const [year, month] = yyyymm.split('-').map(Number);
  // Apr-Mar fiscal year: Apr 2026 - Mar 2027 = "FY2027"
  if (month >= fiscalStart) return String(year + 1);
  return String(year);
}
```

### 8.3 Dual presentation in F9

The Projections tab shows both rows:
- `Total Concessions (calendar)` — calendar-year aggregation
- `Total Concessions (fiscal)` — fiscal-year aggregation (visible only when `fiscal_year_start_month != 1`)

Default view = calendar. User toggle in F9 top bar to switch to fiscal-year-only view.

---

## 9. UI PRESENTATION

### 9.1 The "Current Year (YYYY) Concessions" row

Renders in F9 Projections immediately below "TOTAL CONCESSIONS" row when `current_calendar_year` falls within the analysis horizon. Per-period values show the **calendar-year-portion** of recognized concessions in that period.

**Reading the row:**
- A negative number = concession contra-revenue for the current year recognized in that period
- An empty cell = the period falls outside the current calendar year
- The sum across all periods in the current year = current year's total concession recognition

### 9.2 Method drilldown

Click any cell in the concessions row → drilldown modal showing:

```
┌─ MAR 2026 — TOTAL CONCESSIONS BREAKDOWN ───────────────────────────┐
│                                                                      │
│ Concession recognition this period:           $-29,116               │
│                                                                      │
│ Source breakdown:                                                    │
│   • New leases signed Mar 2026 (8)            $-15,400               │
│     - Method: STRAIGHT_LINE_GAAP (default for NEW_LEASE_ONETIME)    │
│   • Renewals signed Mar 2026 (4)              $-3,200                │
│   • Continuing amortization from prior leases (24)   $-10,516       │
│     - Earliest concession: Aug 2025 commencement                    │
│     - Latest applicable: Feb 2027                                    │
│                                                                      │
│ Calendar 2026 portion of this period:         $-29,116               │
│ (period entirely within calendar 2026)                               │
│                                                                      │
│ Fiscal 2026 portion (Apr-Mar):                $0                    │
│ Fiscal 2027 portion:                          $-29,116               │
│                                                                      │
│ View options:                                                        │
│   ⊙ Per-period earned     ○ Per-period recognized (current)         │
│   ○ Calendar year         ○ Fiscal year                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.3 Recognition method display in Inline Assumption Block

The Concessions Inline Assumption Block (per `LEASING_ASSUMPTIONS_UI_SPEC §7.2`) shows a small badge indicating the dominant amortization method:

```
┌─ CONCESSIONS — ASSUMPTIONS ───────────────────────────────────────┐
│  METHOD: STRAIGHT-LINE GAAP (default, ASC 842)        [edit]      │
│                                                                    │
│  Concession Strategy            MARKET                            │
│  New Lease — Onetime ($/unit)    $1,925                           │
│  Renewal — Onetime ($/unit)      $750                             │
│  ...                                                               │
└────────────────────────────────────────────────────────────────────┘
```

Click "[edit]" → opens method selection modal letting Expert-tier users override the default per concession type.

---

## 10. INTEGRATION POINTS

### 10.1 Lease Velocity Engine output → Amortization Engine input

Lease Velocity produces `concessions_per_month_earned` per lease event. Each lease event becomes a `ConcessionRecord`:

```typescript
// In Lease Velocity Engine output
for each new lease in month n:
  for each concession_type that applies:
    create_concession_record({
      lease_id: lease.id,
      concession_type: type,
      amount_total: count × per_unit_amount,
      sign_date: lease.sign_date,
      commencement_date: lease.commencement_date (= move_in_date typically),
      lease_term_months: lease.term,
      lease_start_date: lease.start,
      lease_end_date: lease.end,
      amortization_method: platform_default_for_type
    });
```

These records flow into `dealContext.concession_records` array, which the Amortization Engine reads.

### 10.2 Subject history → past ConcessionRecords

When `subject_traffic_history` has rent roll snapshots, the diff extractor produces historical lease events. For leases visible in rent rolls with concession data:

```typescript
// In diff extractor
for each lease in current rent roll snapshot with concession data:
  if lease was NOT in prior snapshot OR lease changed:
    create_concession_record({
      lease_id: lease.id,
      concession_type: inferred from amount and pattern,
      amount_total: from rent roll concession field,
      sign_date: lease.lease_start_date (proxy),
      commencement_date: lease.lease_start_date,
      lease_term_months: derived,
      amortization_method: STRAIGHT_LINE_GAAP (default for past)
    });
```

These flow into the same `dealContext.concession_records` array. Past + projected unified.

### 10.3 F9 Projections rendering

The "TOTAL CONCESSIONS" row reads from `dealContext.concession_recognition.monthly` directly. The "Current Year (YYYY) Concessions" row reads from the calendar-year aggregate.

### 10.4 Lease-Up Reserve calculation

When `leasing_cost_treatment = CAPITALIZED`, lease-up-period concessions don't hit P&L. Instead they roll into the lease-up reserve calc:

```typescript
const leaseUpPeriodConcessions = concession_records
  .filter(r => isLeaseUpPeriod(r))
  .reduce((sum, r) => sum + r.amount_total, 0);

dealContext.lease_velocity.lease_up_reserve_required +=
  leaseUpPeriodConcessions;
```

Visible as a S&U line: "Lease-up concession reserve $X".

---

## 11. WORKED EXAMPLE — THE BOTTOM ROW OF THE SCREENSHOT

Reconciling the original screenshot's mysterious values: TOTAL CONCESSIONS row vs "Current year (2025) Concessions" row.

### Setup

Multifamily property, monthly columns Jan-Sep 2026 visible. Existing leases (commenced before Jan 2026) plus new leases signed in 2026.

### Per-period earned (TOTAL CONCESSIONS)

These are the dollars associated with **lease events in each shown period**:

| Period | New Leases (events) | Onetime/lease | Renewals | Renewal $/event | TOTAL EARNED |
|---|---|---|---|---|---|
| Jan 2026 | 7 | $2,742 | 9 | $500 | -$23,694 |
| Feb 2026 | 5 | $2,742 | 6 | $500 | -$16,710 |
| Mar 2026 | 11 | $2,056 | 13 | $500 | -$29,116 |
| Apr 2026 | 8 | $2,056 | 10 | $500 | -$21,448 |
| May 2026 | 9 | $2,056 | 10 | $750 | -$26,004 |
| Jun 2026 | 15 | $1,371 | 19 | $750 | -$34,815 |
| Jul 2026 | 18 | $1,371 | 22 | $750 | -$41,178 |
| Aug 2026 | 22 | $1,371 | 26 | $750 | -$49,662 |
| Sep 2026 | 11 | $1,371 | 13 | $500 | -$21,581 |

(Numbers approximated to match screenshot order of magnitude.)

### Per-period recognized (calendar 2025 portion)

This is the row "Current year (2025) Concessions". The numbers are SMALLER than the earned row because only the portion of each concession amortizing into calendar 2025 hits this row. Most 2026-commenced leases amortize across 2026 and into 2027, with very little in 2025.

But — the row would have non-zero values if **prior leases** (commenced in 2024 or 2025) are still amortizing into 2025. Specifically:

A lease commenced August 2025 with $2,400 concession over 12 months STRAIGHT_LINE_GAAP:
- Aug 2025: $200 recognized
- Sep-Dec 2025: $200 × 4 = $800 recognized
- Jan-Jul 2026: $200 × 7 = $1,400 recognized

This lease contributes $1,000 to calendar 2025 P&L and $1,400 to calendar 2026.

When you have hundreds of leases with various commencement dates and amortization schedules running through, the per-month calendar-2025 portion is the SUM of all leases' January-2025-amortization-amounts, all February-2025-amortization-amounts, etc. — surfaced into the period column where the original lease event occurred.

### The math that explains the discrepancy

For each period column in F9 (e.g., Mar 2026):
```
TOTAL CONCESSIONS (Mar 2026) = sum of all concession records EARNED in Mar 2026
                              = sum of (event_count × per_event_amount)
                              for events occurring in Mar 2026

Current year (2025) CONCESSIONS (Mar 2026) =
  sum of all monthly_recognition[month] for months in calendar 2025
  WHERE the original lease event was logged in this period column
```

The first is the EARNED total in the period. The second is the calendar-2025-portion of the recognition stream associated with leases that were earned in this period — which for a March 2026 column is typically zero or near-zero for new leases (their amortization spans 2026-2027), but includes any retroactive write-offs or adjustments that book to 2025.

In practice, the bottom row in the screenshot is showing **calendar-2025 P&L impact of leases ALREADY active or commencing in pre-2026 months** — not 2026-period-events at all. The values appear under 2026 period columns because that's where the engine reports cumulative calendar-2025 numbers across the analysis.

This is a specific reporting choice: showing per-period rolling totals of calendar-year accrual, useful for explaining "how much of our 2025 accrual is being trued-up in each 2026 month?"

A cleaner alternative presentation: dedicate one column to calendar 2025 totals and one to calendar 2026 totals, rather than scattering across period columns. This is a UX decision beyond the engine's scope, but the engine's output supports either presentation.

---

## 12. TEST FIXTURES

### 12.1 Single concession, STRAIGHT_LINE_GAAP

- Input: $2,400 / 12-month / commencement Jan 2026
- Expected monthly: $200 × 12 (Jan 2026 - Dec 2026)
- Expected calendar 2026: $2,400; 2027: $0

### 12.2 Single concession, BURN_OFF

- Input: $1,925 (1 month free) / 12-month / commencement Jan 2026 / monthly_rent = $1,925
- Expected monthly: $1,925 in Jan 2026; $0 thereafter
- Expected calendar 2026: $1,925; 2027: $0

### 12.3 Multiple concessions per lease

- Onetime $2,000 + ongoing $100/mo × 12mo, commencement Jul 2026, both STRAIGHT_LINE_GAAP
- Expected monthly: ($166.67 + $100) × 12 = $266.67/mo Jul 2026 - Jun 2027
- Expected calendar 2026: $266.67 × 6 = $1,600.02
- Expected calendar 2027: $266.67 × 6 = $1,600.02
- Total: $3,200 (= $2,000 + $1,200 ✓)

### 12.4 Lease crossing year-end

- $2,400 / 12-month / commencement Jul 2026, STRAIGHT_LINE_GAAP
- Expected: $200 × 6 = $1,200 in calendar 2026
- Expected: $200 × 6 = $1,200 in calendar 2027

### 12.5 Early termination write-off

- $2,400 / 12-month / commencement Jan 2026, terminated end of June 2026
- Recognized Jan-Jun: $200 × 6 = $1,200
- July write-off: $1,200
- Calendar 2026 total: $2,400 (= original full amount ✓)
- write_offs array contains 1 entry

### 12.6 CAPITALIZED treatment

- $5,000 lease-up period concession
- Mode = LEASE_UP
- treatment = CAPITALIZED
- Expected: $0 in monthly_recognition; $5,000 added to lease_up_reserve

### 12.7 Cash invariant across treatments

- Same set of concession records
- Run engine 3× under OPERATING / CAPITALIZED / HYBRID
- Assert: total cash spent identical across all 3
- Assert: only timing/location of recognition differs

### 12.8 Subject historical concession amortizing into current period

- Acquisition closing Jan 2026
- Existing lease commenced Aug 2025, $2,400 / 12mo / STRAIGHT_LINE_GAAP
- As of Jan 2026: 5 months already amortized (pre-acquisition)
- Engine output: $200/mo Jan-Jul 2026 = $1,400 (the remaining 7 months in current owner's P&L)

### 12.9 Custom amortization

- Onetime $1,800, commencement Mar 2026
- Custom schedule: $900 in month 0, $900 in month 6
- Expected monthly: $900 in Mar 2026, $900 in Sep 2026
- Calendar 2026: $1,800; 2027: $0

### 12.10 Fiscal year aggregation

- Same concession data
- Two engine runs: fiscal_year_start = 1 (calendar) vs 4 (Apr-Mar)
- Verify monthly recognition identical in both
- Verify aggregations differ per fiscal-year boundary

---

## 13. BUILD ORDER

1. **Type definitions** — `backend/src/types/concessions.ts` with `ConcessionRecord`, `AmortizationMethod`, `AmortizationOutput`. Foundation for everything else.

2. **Schedule generators** — `backend/src/services/concession-amortization/schedule-generators.ts` with one function per method. Pure functions, easy to unit-test.

3. **Calendar/fiscal aggregator** — `backend/src/services/concession-amortization/aggregator.ts` with `aggregateByCalendarYear` and `aggregateByFiscalYear`.

4. **Main engine entry point** — `backend/src/services/concession-amortization/index.ts` with `amortizeConcessions(input)` orchestrator.

5. **Lease Velocity wiring** — modify Lease Velocity Engine output to produce `ConcessionRecord` array as it generates lease events.

6. **Subject history wiring** — modify M07 diff extractor to produce `ConcessionRecord` entries for past leases with concession data.

7. **Edge case handling** — early termination, mode-mismatch leases, structural changes, holdover, multi-concession leases.

8. **Treatment toggle integration** — wire `leasing_cost_treatment` into the engine's filter logic.

9. **Cash invariant assertion** — runtime check enforcing total-cash-equality across treatments.

10. **dealContext caching + propagation** — store output, emit recompute events to downstream consumers.

11. **F9 row population** — wire engine output to "TOTAL CONCESSIONS" and "Current Year (YYYY) Concessions" rows.

12. **Drilldown modal** — period click → breakdown view.

13. **Test fixtures** — all §12 scenarios as Jest/Vitest test cases.

---

## 14. ARCHITECTURAL RULES (codify in CLAUDE.md)

### EARNED-VS-RECOGNIZED-DISTINCTION RULE

A concession is EARNED at the lease event (sign or commencement). It is RECOGNIZED across operating periods per its amortization method. These are different timestamps and different dollar amounts in any given period. F9 displays must label rows clearly:
- "TOTAL CONCESSIONS" = earned per period
- "Current Year (YYYY) Concessions" = calendar-year-portion recognized
- Mixing them in one row is forbidden.

### CASH-INVARIANT-ACROSS-TREATMENTS RULE

Total cash spent on concessions across the analysis horizon must be identical regardless of `leasing_cost_treatment`. This is asserted at runtime; failure is a fail-loud bug. Treatment changes presentation (S&U vs OpEx, recognition timing within OpEx) but never changes total cash. Any code that produces different cash totals across treatments is broken.

### WRITE-OFFS-ARE-EVENTS-NOT-ASSUMPTIONS RULE

Early-termination concession write-offs are treated as P&L events, not as assumptions to be modeled. They appear in the write-off month with a clear classification (eviction, voluntary, structural). Write-offs are NEVER user-input — they're engine-computed when M07 diff extractor identifies a premature termination.

### AMORTIZATION-METHOD-IS-PER-CONCESSION RULE

Each `ConcessionRecord` carries its own amortization method. Defaults are platform-set per concession type but per-concession overrides are supported. Don't apply a single method to all concessions on a deal — different concession types have different correct treatments (`STRAIGHT_LINE_GAAP` for ASC 842 lease incentives; `CASH_AT_COMMENCEMENT` for pre-lease bonuses; etc.).

### SUBJECT-HISTORY-CONCESSIONS-ARE-FIRST-CLASS-RECORDS RULE

Concessions discovered from rent roll snapshots are full `ConcessionRecord` entries, indistinguishable from engine-projected concessions in the amortization stream. They participate in monthly recognition, calendar/fiscal aggregation, and write-off detection identically. The platform doesn't bifurcate "historical" and "projected" concession recognition — it's one stream of records flowing through one engine.

---

## 15. OUT OF SCOPE FOR V1

These are deferred:

1. **Tax treatment differences** — cost-segregation studies, depreciation of capitalized concessions. F9 produces operating-level concession recognition; tax-side treatment is a separate spec.

2. **Multi-currency concessions** — V1 assumes USD. Multi-currency support deferred.

3. **Ground lease concessions** — V1 assumes residential leases. Commercial/ground-lease concessions have different amortization conventions.

4. **Mid-amortization method change** — V1 doesn't support changing a concession's amortization method after initial creation. Power users who want to change it must override the entire schedule via CUSTOM method.

5. **Non-monetary concessions** — concierge upgrades, parking comps, storage credits valued in dollars only. Pure non-monetary tracking deferred.

6. **Investor-specific reporting views** — some LPs want concessions reported only as cash-basis at commencement; some prefer ASC 842 strict. V1 supports method selection per concession type at the deal level. Per-investor reporting variants deferred.

---

**End of spec.**

Build in the listed order. The Cash-Invariant-Across-Treatments runtime assertion (#9) is the most important defensive check — wire it into CI so every PR validates the invariant. Concession amortization is one of those areas where bugs hide for months because the numbers "look reasonable" until somebody runs three treatments and notices total cash differs by $200K. The assertion catches it on the first failed test run.
