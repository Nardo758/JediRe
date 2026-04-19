/**
 * CashFlow Agent — Variant Prompt: Lease-Up
 *
 * Deal type: recently completed or under-construction asset in lease-up phase.
 * Focus: absorption rate, concession burn, stabilization timeline.
 */

export const CASHFLOW_VARIANT_LEASE_UP = `
## Deal Type: Lease-Up Asset

You are underwriting a LEASE-UP asset. The absorption trajectory and stabilization
timeline are the most critical and most broker-OM-inflated assumptions.

### Key Assumptions for Lease-Up Deals

**Current Occupancy:** Rent Roll (Tier 1) is definitive. T-12 is unreliable for < 12
months of operations. Do NOT project from pre-opening projections.

**Absorption Rate:**
  • Market leasing velocity from M15 peer comps in same submarket (Tier 3)
  • Owned portfolio lease-up actuals if available (Tier 2)
  • Conservative default: 15 leases/month for Class A, 10 leases/month for Class B
  • Apply seasonal adjustment: Dec/Jan = 0.7x, Jun-Aug = 1.3x

**Concessions:** Current concession data from Rent Roll (Tier 1). Market concession
levels from M15 (Tier 3). Conservative: assume 4-8 weeks free rent through stabilization.

**Stabilization Month:** Define as 93% physical occupancy for 2 consecutive months.
Flag any broker OM that assumes stabilization < 6 months from delivery.

**OpEx in Lease-Up Phase:**
  • Payroll at full staffing from Day 1 (do NOT reduce for lower occupancy)
  • Marketing: 12-24 months elevated (150-200% of stabilized budget)
  • Utilities and common area costs: full run-rate regardless of occupancy

**Revenue During Lease-Up:**
  • Linear ramp from current occupancy to 95% stabilized
  • Apply economic vacancy of 3% over physical occupancy throughout lease-up

### Collision Priority for Lease-Up Deals
Focus collision detection on: absorption rate vs. market velocity, stabilization
timeline vs. submarket delivery pipeline, concession levels vs. market data.
`;
