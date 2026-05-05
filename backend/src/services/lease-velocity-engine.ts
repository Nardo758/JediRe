import type { LeaseMode, LeaseVelocityInputs, LeaseVelocityResult, MonthOutput, DealContext, LeasingCostTreatment, StabilizationDefinition } from './lease-velocity-types';
import type { ConcessionRecord, ConcessionType } from '../types/concessions';
import { type LeaseEventType, defaultMethodForEventType } from './concession-amortization/defaults';

const PRE_LEASE_SIGNING_CURVE_6MO = [0.05, 0.08, 0.12, 0.15, 0.18, 0.22, 0.20];
const MOVE_IN_LAG = { same_month_as_sign: 0.30, one_month_after: 0.55, two_months_after: 0.13, three_months_after: 0.02 };
const LEASE_UP_S_CURVE = [0.06, 0.07, 0.08, 0.10, 0.12, 0.13, 0.13, 0.13, 0.12, 0.10, 0.08, 0.07, 0.05, 0.04, 0.03, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.005];
const DECAY_CURVE_24MO = (() => { const c: number[] = []; for (let i = 0; i < 24; i++) c.push(Math.max(0.05, 1.0 - Math.pow(i / 24, 1.5))); return c; })();
const SEASONAL = [0.70, 0.75, 0.95, 1.10, 1.25, 1.35, 1.40, 1.35, 1.10, 0.95, 0.75, 0.65];
const MKTG_DEFS: Record<string, { pl: number; bm: number }> = { LEASE_UP_NEW_CONSTRUCTION: { pl: 1800, bm: 8000 }, STABILIZED_MAINTENANCE: { pl: 400, bm: 2000 }, OCCUPANCY_RECOVERY: { pl: 1000, bm: 4000 }, V2_PENDING_VALUE_ADD: { pl: 800, bm: 3000 } };
const TURN_COST: Record<string, number> = { A: 1500, B: 1000, C: 700 };
const FUNNEL: Record<string, { o: number }> = { LEASE_UP_NEW_CONSTRUCTION: { o: 0.030 }, STABILIZED_MAINTENANCE: { o: 0.067 }, OCCUPANCY_RECOVERY: { o: 0.048 }, V2_PENDING_VALUE_ADD: { o: 0.050 } };
const CONC_MULT: Record<string, number> = { CONSERVATIVE: 0.7, MARKET: 1.0, AGGRESSIVE: 1.3 };
const MKTG_INT_MULT: Record<string, number> = { LOW: 0.85, MARKET: 1.0, AGGRESSIVE: 1.15 };

// Internal types
interface CostPerMo { new_lease_concessions_onetime: number; new_lease_concessions_ongoing: number; renewal_concessions_onetime: number; renewal_concessions_ongoing: number; marketing_spend: number; locator_broker_fees: number; make_ready_turn_costs: number; bad_debt: number; loss_to_lease_dollars: number; lease_up_reserve_burn: number; cumulative_lease_up_reserve_drawn: number; total_leasing_p_and_l_impact: number; total_capitalized: number; total_cash_outflow: number; }
interface RunResult { mo: MonthOutput[]; sm: number | null; cr: number; w: string[] }

function fmtMon(by: number, bm: number, off: number): string { const d = new Date(by, bm + off, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function genCrv(w: number): number[] { const c: number[] = []; const n = w + 1; for (let i = 0; i < n; i++) c.push(1 / (1 + Math.exp(-6 * (i / (n - 1) - 0.5)))); const s = c.reduce((a, b) => a + b, 0); return s > 0 ? c.map(v => v / s) : c; }

function distPre(sc: number, dm: number, win = 6): Map<number, number> {
  const o = new Map<number, number>(); const crv = win === 6 ? PRE_LEASE_SIGNING_CURVE_6MO : genCrv(win); let a = 0;
  for (let k = win; k >= 0; k--) { const m = dm - k; const w = crv[win - k] ?? 0; const v = Math.floor(sc * w); o.set(m, v); a += v; }
  const r = sc - a; if (r > 0) o.set(dm, (o.get(dm) ?? 0) + r); return o;
}

function distMove(sm: Map<number, number>, dm: number): Map<number, number> {
  const o = new Map<number, number>();
  for (const [ms, sc] of sm) { const E: [string, number][] = [['same_month_as_sign', 0], ['one_month_after', 1], ['two_months_after', 2], ['three_months_after', 3]];
    for (const [k, ofs] of E) { const w = (MOVE_IN_LAG as any)[k] ?? 0; const tm = Math.max(dm, ms + ofs); o.set(tm, (o.get(tm) ?? 0) + sc * w); } }
  let tr = 0; let traw = 0; const res = new Map<number, number>();
  for (const [m, v] of o) { traw += v; const r = Math.round(v); res.set(m, r); tr += r; }
  const rem = Math.round(traw) - tr; if (rem !== 0) res.set(dm, (res.get(dm) ?? 0) + rem); return res;
}

function resMode(inp: LeaseVelocityInputs, dc?: DealContext): { mode: LeaseMode; w: string[] } {
  const w: string[] = [];
  if (inp.mode) { w.push(`MODE OVERRIDDEN: AUTO → ${inp.mode}`); return { mode: inp.mode, w }; }
  if (!dc) return { mode: 'STABILIZED_MAINTENANCE', w };
  const nw = new Date(); const yb = dc.deal.year_built; const age = (nw.getFullYear() - yb) * 12 + (nw.getMonth() - 5);
  const co = inp.current_occupancy ?? ((dc.traffic?.subject_history?.current_state?.units_occupied ?? Math.round(dc.deal.total_units * 0.95)) / dc.deal.total_units);
  const cx = dc.capex_schedule?.has_active_phase ?? false; const h = dc.has_prior_history ?? false;
  if (age <= 24 && co < 0.80 && !h) return { mode: 'LEASE_UP_NEW_CONSTRUCTION', w };
  if (co >= 0.90 && !cx) return { mode: 'STABILIZED_MAINTENANCE', w };
  if (co >= 0.70 && co < 0.90 && !cx) return { mode: 'OCCUPANCY_RECOVERY', w };
  if (cx && co < 0.95) w.push('Active capex'); return { mode: 'STABILIZED_MAINTENANCE', w };
}

function isSt(phy: number, eco: number, def: StabilizationDefinition): boolean {
  if (def === 'PHYSICAL_95') return phy >= 0.95; if (def === 'ECONOMIC_95') return eco >= 0.95; return phy >= 0.90;
}

// FIX §11 + §5: reserve burn uses full stabilized opex+ds, not % of current gpr (which is always 0).
// Treatment branching: total_cash_outflow is identical across all three — only P&L presentation differs.
function cStack(n: number, nl: number, rn: number, rp: number, gap: number, tu: number, mode: string, cs: string, mi: string, mr: number, cls: string, gpr: number, er: number, treatment: LeasingCostTreatment, fullMonthlyGpr: number): CostPerMo {
  const sm2 = CONC_MULT[cs] ?? 1.0; const cpl = mr * sm2; const nlcOT = nl * cpl; const rcOT = rn * 0.02 * mr;
  const dM = DECAY_CURVE_24MO[Math.min(n, 23)] ?? 0.05; const nlcOG = nlcOT * dM; const rcOG = rcOT / 12;
  const m = MKTG_DEFS[mode] ?? { pl: 400, bm: 2000 }; const ms = m.pl * nl + m.bm;
  const agg = mi === 'AGGRESSIVE' || cs === 'AGGRESSIVE';
  const lp = (agg && (mode === 'LEASE_UP_NEW_CONSTRUCTION' || mode === 'OCCUPANCY_RECOVERY')) ? 0.30 : 0;
  const lf = lp * nl * mr * 0.75; const tc = TURN_COST[cls] ?? 1000; const mk = (rp + gap) * tc;
  const bd = gpr * 0.015; const ltl = gpr * 0.025;

  // FIX: reserve burn = max(0, full_opex + full_debt_service - current_gpr)
  // full_opex ≈ 55% of stabilized GPR; full_ds ≈ 40% of stabilized GPR (per §8.2 run rate)
  // In early lease-up gpr << fullMonthlyGpr, so this correctly produces positive burn.
  const LURB = mode === 'LEASE_UP_NEW_CONSTRUCTION'
    ? Math.max(0, fullMonthlyGpr * 0.55 + fullMonthlyGpr * 0.40 - gpr)
    : 0;
  const cLUR = er + LURB;

  // LEASE-UP-RESERVE-IS-S&U: reserve is always capitalized regardless of treatment (§16)
  // Treatment branching — only P&L presentation differs; total cash is invariant (§5, §16)
  let pnl: number; let cap: number;
  if (treatment === 'OPERATING') {
    // Everything hits P&L; reserve is S&U (capitalized) per the hard rule
    pnl = nlcOT + rcOT + ms + lf + mk + bd;
    cap = LURB;
  } else if (treatment === 'CAPITALIZED') {
    // Lease-up concessions, marketing, locator fees → S&U; only make-ready + bad debt stay as P&L
    const isLeaseUp = mode === 'LEASE_UP_NEW_CONSTRUCTION';
    const capCosts = isLeaseUp ? nlcOT + rcOT + ms + lf : 0;
    pnl = mk + bd + (isLeaseUp ? 0 : nlcOT + rcOT + ms + lf);
    cap = LURB + capCosts;
  } else {
    // HYBRID (default): concessions amortize as effective-rent reduction (ongoing); marketing stays OpEx
    pnl = nlcOG + rcOG + ms + mk + bd;
    cap = LURB;
  }

  // total_cash_outflow is computed from raw dollar components, not from pnl/cap, so it
  // is identical across all three treatments by construction. pnl+cap intentionally
  // differs: HYBRID amortizes concessions; CAPITALIZED moves them off P&L to S&U.
  const totalCash = nlcOT + rcOT + ms + lf + mk + bd + LURB;

  return {
    new_lease_concessions_onetime: Math.round(nlcOT), new_lease_concessions_ongoing: Math.round(nlcOG),
    renewal_concessions_onetime: Math.round(rcOT), renewal_concessions_ongoing: Math.round(rcOG),
    marketing_spend: Math.round(ms), locator_broker_fees: Math.round(lf), make_ready_turn_costs: Math.round(mk),
    bad_debt: Math.round(bd), loss_to_lease_dollars: Math.round(ltl), lease_up_reserve_burn: Math.round(LURB),
    cumulative_lease_up_reserve_drawn: Math.round(cLUR), total_leasing_p_and_l_impact: Math.round(pnl),
    total_capitalized: Math.round(cap), total_cash_outflow: Math.round(totalCash),
  };
}

function rnLU(inp: LeaseVelocityInputs, tu: number, tO: number, mr: number, cls: string, def: StabilizationDefinition, cs: string, mi: string, treatment: LeasingCostTreatment): RunResult {
  const w: string[] = []; const mo: MonthOutput[] = []; const h = inp.time_horizon_months ?? 36;
  const dm = inp.delivery_month ?? 4; const plc = inp.pre_leased_count ?? 0; const pw = inp.pre_lease_window_months ?? 6;
  const pS = distPre(plc, dm, pw); const mM = distMove(pS, dm);
  let co = 0; let er = 0; let sm: number | null = null; let stable = false; const eB = new Map<number, number>();
  const aT = inp.avg_lease_term_months ?? 12; const mR = mr / 12; const fullGpr = tu * mR;
  for (let i = 0; i < h; i++) {
    const cal = fmtMon(2026, 0, i); let pre = 0, on = 0, mn = 0, mOut = 0, exp = 0, ren = 0, ts = 0;
    if (i < dm) { pre = pS.get(i) ?? 0; co = 0; }
    else if (i === dm) { pre = pS.get(i) ?? 0; mn = Math.round(mM.get(i) ?? 0); co += mn; }
    else {
      const msd = i - dm; const rem = tu - co;
      if (!stable && rem > 0) { const ci = Math.min(msd - 1, LEASE_UP_S_CURVE.length - 1); const br = LEASE_UP_S_CURVE[ci] ?? 0.01; const ia = MKTG_INT_MULT[mi] ?? 1.0; const abs = Math.round(br * rem * ia); on = Math.round(abs * SEASONAL[i % 12]); }
      mn = Math.round(mM.get(i) ?? 0) + on; co = Math.min(tu, co + mn); const fE = dm + aT;
      if (i >= fE) { exp = eB.get(i) ?? 0; ren = Math.round(exp * 0.65); mOut = exp - ren; co = Math.max(0, co - mOut); }
      eB.set(i + aT, (eB.get(i + aT) ?? 0) + mn);
    }
    ts = pre + on; const gpr = Math.round(co * mR);
    // costMode uses the stable flag from the prior iteration: stab month prices as lease-up;
    // all subsequent months use stabilized cost/funnel parameters.
    const costMode: LeaseMode = (stable && sm !== null) ? 'STABILIZED_MAINTENANCE' : 'LEASE_UP_NEW_CONSTRUCTION';
    const c = cStack(i, ts, ren, Math.max(0, exp - ren), 0, tu, costMode, cs, mi, mr, cls, gpr, er, treatment, fullGpr);
    er = c.cumulative_lease_up_reserve_drawn; const phy = tu > 0 ? co / tu : 0;
    const st = isSt(phy, phy, def); if (st && sm === null) { sm = i; stable = true; }
    const modeThisMonth: LeaseMode = (stable && sm !== null && i > sm) ? 'STABILIZED_MAINTENANCE' : 'LEASE_UP_NEW_CONSTRUCTION';
    const cR = FUNNEL[modeThisMonth]?.o ?? 0.03; const ip = cR > 0 ? Math.round(ts / cR) : 0;
    mo.push({ month_index: i, calendar_month: cal, mode_for_month: modeThisMonth, expirations: exp, renewals: ren, replacement_leases: Math.max(0, exp - ren), gap_close_leases: 0, pre_lease_signings: pre, lease_up_signings: on, total_signings: ts, move_ins: mn, move_outs: mOut, cumulative_occupied: co, physical_occupancy_pct: Math.round(phy * 10000) / 100, economic_occupancy_pct: Math.round(phy * 10000) / 100, gpr, vacancy_loss: Math.round(gpr * (1 - phy)), concessions_new_lease: c.new_lease_concessions_onetime, concessions_renewal: c.renewal_concessions_onetime, loss_to_lease_dollars: c.loss_to_lease_dollars, effective_rent: Math.round(Math.max(0, gpr - c.new_lease_concessions_onetime)), marketing_spend: c.marketing_spend, locator_fees: c.locator_broker_fees, make_ready: c.make_ready_turn_costs, bad_debt: c.bad_debt, opex: Math.round(gpr * 0.55), noi: Math.round(gpr - gpr * 0.55), debt_service: Math.round(-gpr * 0.40), cash_flow: Math.round(gpr - gpr * 0.55 - gpr * 0.40), lease_up_reserve_burn: c.lease_up_reserve_burn, cumulative_lease_up_reserve: er, implied_prospect_volume: ip, stabilization_marker: st && sm === i,
    });
  }
  return { mo, sm, cr: er, w };
}

function rnST(inp: LeaseVelocityInputs, tu: number, tO: number, cO: number, mr: number, cls: string, def: StabilizationDefinition, cs: string, treatment: LeasingCostTreatment): RunResult {
  const mo: MonthOutput[] = []; const w: string[] = []; const h = inp.time_horizon_months ?? 24;
  const rr = 0.65; const dv = 21; const mR = mr / 12; let er = 0; const bE = 1 / 12; const fullGpr = tu * mR;
  for (let i = 0; i < h; i++) {
    const cal = fmtMon(2026, 0, i); const exp = Math.round(tu * bE); const ren = Math.round(exp * rr); const rep = exp - ren;
    const drag = tu > 0 ? (rep * dv) / (tu * 30) : 0; const nl = rep; const sm_ = SEASONAL[i % 12]; const adj = Math.round(nl * sm_);
    const iO = tO + drag; const co = Math.min(tu, Math.floor(tu * iO)); const gpr = Math.round(co * mR);
    const c = cStack(i, adj, ren, rep, 0, tu, 'STABILIZED_MAINTENANCE', cs, 'MARKET', mr, cls, gpr, er, treatment, fullGpr);
    const phy = tu > 0 ? co / tu : 0; const cR = FUNNEL['STABILIZED_MAINTENANCE']?.o ?? 0.067; const ip = cR > 0 ? Math.round(adj / cR) : 0;
    mo.push({ month_index: i, calendar_month: cal, mode_for_month: 'STABILIZED_MAINTENANCE', expirations: exp, renewals: ren, replacement_leases: rep, gap_close_leases: 0, pre_lease_signings: 0, lease_up_signings: adj, total_signings: adj, move_ins: adj, move_outs: rep, cumulative_occupied: co, physical_occupancy_pct: Math.round(phy * 10000) / 100, economic_occupancy_pct: Math.round(phy * 10000) / 100, gpr, vacancy_loss: Math.round(gpr * (1 - phy)), concessions_new_lease: c.new_lease_concessions_onetime, concessions_renewal: c.renewal_concessions_onetime, loss_to_lease_dollars: c.loss_to_lease_dollars, effective_rent: Math.round(Math.max(0, gpr - c.new_lease_concessions_onetime)), marketing_spend: c.marketing_spend, locator_fees: c.locator_broker_fees, make_ready: c.make_ready_turn_costs, bad_debt: c.bad_debt, opex: Math.round(gpr * 0.55), noi: Math.round(gpr - gpr * 0.55), debt_service: Math.round(-gpr * 0.40), cash_flow: Math.round(gpr - gpr * 0.55 - gpr * 0.40), lease_up_reserve_burn: 0, cumulative_lease_up_reserve: 0, implied_prospect_volume: ip, stabilization_marker: true });
  }
  return { mo, sm: 0, cr: 0, w };
}

function rnRC(inp: LeaseVelocityInputs, tu: number, tO: number, cO: number, mr: number, cls: string, def: StabilizationDefinition, cs: string, treatment: LeasingCostTreatment, pm?: number): RunResult {
  const w: string[] = []; const mo: MonthOutput[] = []; const cu = inp.catch_up_period_months ?? 12;
  const h = inp.time_horizon_months ?? (cu + 12); const rr = 0.65; const dv = 21; const mR = mr / 12; const bE = 1 / 12;
  const gU = Math.max(0, (tO - cO) * tu); let co = Math.round(tu * cO); let er = 0; let cG = 0; let sm: number | null = null;
  const fullGpr = tu * mR;
  for (let i = 0; i < h; i++) {
    const cal = fmtMon(2026, 0, i); const exp = Math.round(tu * bE); const ren = Math.round(exp * rr); const rep = exp - ren;
    const sm_ = SEASONAL[i % 12]; let gl = 0;
    if (i < cu && cG < gU) { gl = Math.round((gU / cu) * sm_); gl = Math.min(gl, Math.round(gU - cG)); }
    if (pm && gl > pm && i === 0) w.push(`INFEASIBLE_CATCHUP_PACE:${gl} exceeds peer max ${pm}`);
    const tn = rep + gl; const adj = Math.round(tn * sm_); cG += gl;
    co = Math.round((cO + (cG / tu)) * tu); const gpr = Math.round(co * mR);
    const c = cStack(i, adj, ren, rep, gl, tu, 'OCCUPANCY_RECOVERY', cs, 'AGGRESSIVE', mr, cls, gpr, er, treatment, fullGpr);
    const phy = tu > 0 ? co / tu : 0; const st = isSt(phy, phy, def); if (st && sm === null) sm = i;
    const cR = FUNNEL['OCCUPANCY_RECOVERY']?.o ?? 0.048; const ip = cR > 0 ? Math.round(adj / cR) : 0;
    mo.push({ month_index: i, calendar_month: cal, mode_for_month: 'OCCUPANCY_RECOVERY', expirations: exp, renewals: ren, replacement_leases: rep, gap_close_leases: gl, pre_lease_signings: 0, lease_up_signings: adj, total_signings: adj, move_ins: adj, move_outs: rep, cumulative_occupied: co, physical_occupancy_pct: Math.round(phy * 10000) / 100, economic_occupancy_pct: Math.round(phy * 10000) / 100, gpr, vacancy_loss: Math.round(gpr * (1 - phy)), concessions_new_lease: c.new_lease_concessions_onetime, concessions_renewal: c.renewal_concessions_onetime, loss_to_lease_dollars: c.loss_to_lease_dollars, effective_rent: Math.round(Math.max(0, gpr - c.new_lease_concessions_onetime)), marketing_spend: c.marketing_spend, locator_fees: c.locator_broker_fees, make_ready: c.make_ready_turn_costs, bad_debt: c.bad_debt, opex: Math.round(gpr * 0.55), noi: Math.round(gpr - gpr * 0.55), debt_service: Math.round(-gpr * 0.40), cash_flow: Math.round(gpr - gpr * 0.55 - gpr * 0.40), lease_up_reserve_burn: c.lease_up_reserve_burn, cumulative_lease_up_reserve: er, implied_prospect_volume: ip, stabilization_marker: st && sm === i });
  }
  return { mo, sm, cr: er, w };
}

function narr(mode: LeaseMode, inp: LeaseVelocityInputs, mo: MonthOutput[], sm: number | null, cr: number, w: string[]): string {
  const tm = mo.length; const ts = mo.reduce((s, m) => s + m.total_signings, 0); const am = tm > 0 ? Math.round(ts / tm) : 0;
  const tC = mo.reduce((s, m) => s + m.concessions_new_lease + m.concessions_renewal, 0); const tM = mo.reduce((s, m) => s + m.marketing_spend, 0);
  const tG = mo.reduce((s, m) => s + m.gpr, 0); const cP = tG > 0 ? (tC / tG) : 0;
  const aR = mo.reduce((s, m) => s + m.renewals, 0) / tm; const aNL = mo.reduce((s, m) => s + (m.lease_up_signings + m.gap_close_leases), 0) / tm;
  const sC = sm != null ? (mo[sm]?.calendar_month ?? 'N/A') : 'N/A'; const wt = w.length > 0 ? ' Warning: ' + w.join('; ') + '.' : '';
  if (mode === 'LEASE_UP_NEW_CONSTRUCTION') return `Property modeled at ${inp.pre_leased_count ?? 0} pre-leased units against ${inp.total_units} total. Lease-up reaches ${(inp.target_occupancy * 100).toFixed(0)}% by month ${sm ?? 'N/A'} (${sC}), requiring an average of ${am} signed leases/month post-delivery. Total leasing cost through stabilization: $${tC.toLocaleString()} in concessions (${(cP * 100).toFixed(1)}% of stabilized GPR), $${tM.toLocaleString()} in marketing, $${cr.toLocaleString()} captured as lease-up reserve.${wt}`;
  if (mode === 'STABILIZED_MAINTENANCE') return `Property requires approximately ${am} signed leases/month to maintain ${(inp.target_occupancy * 100).toFixed(0)}% occupancy, including ${Math.round(aR)} renewals and ${Math.round(aNL)} replacement leases. Annual leasing cost: $${tC.toLocaleString()} in concessions plus $${tM.toLocaleString()} in marketing, equal to ${(cP * 100).toFixed(1)}% of stabilized GPR.${wt}`;
  if (mode === 'OCCUPANCY_RECOVERY') return `Property starts at ${((inp.current_occupancy ?? 0.80) * 100).toFixed(0)}% and reaches ${(inp.target_occupancy * 100).toFixed(0)}% by month ${sm ?? 'N/A'} (${sC}). Required pace: ${Math.max(...mo.map(m => m.lease_up_signings + m.gap_close_leases))} leases in peak months. Recovery cost: $${tC.toLocaleString()} in concessions, $${tM.toLocaleString()} in marketing.${wt}`;
  return `Lease velocity engine: ${tm} months, ${ts} total signings.${wt}`;
}

// ── ConcessionRecord assembly ─────────────────────────────────────────────────

/**
 * Map a LeaseEventType to the ConcessionType field on ConcessionRecord.
 * Free rent is the canonical concession for lease-up and renewal events;
 * move-in specials for new-lease one-time and pre-lease signing bonuses.
 */
const EVENT_TO_CONCESSION_TYPE: Record<LeaseEventType, ConcessionType> = {
  NEW_LEASE_ONETIME:  'MOVE_IN_SPECIAL',
  NEW_LEASE_ONGOING:  'FREE_RENT',
  RENEWAL_ONETIME:    'FREE_RENT',
  RENEWAL_ONGOING:    'FREE_RENT',
  LEASE_UP_INCENTIVE: 'FREE_RENT',
  PRE_LEASE_BONUS:    'MOVE_IN_SPECIAL',
};

/**
 * Compute the lease end date (ISO YYYY-MM-DD, last day of end month) given
 * a calendar month string ("YYYY-MM") and a term length in months.
 */
function computeLeaseEndDate(calendarMonth: string, termMonths: number): string {
  const yr = parseInt(calendarMonth.slice(0, 4), 10);
  const mo = parseInt(calendarMonth.slice(5, 7), 10); // 1-indexed
  const totalMonth0 = (yr * 12 + mo - 1) + (termMonths - 1); // 0-indexed end month
  const endYear = Math.floor(totalMonth0 / 12);
  const endMo = (totalMonth0 % 12) + 1; // 1-indexed
  const lastDay = new Date(endYear, endMo, 0).getDate();
  return `${endYear}-${String(endMo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Build a single ConcessionRecord for a given lease event in a month.
 */
function makeRecord(
  dealId: string,
  calendarMonth: string,
  eventType: LeaseEventType,
  cashValue: number,
  termMonths: number,
  isLeaseUpPeriod: boolean,
  treatment: LeasingCostTreatment,
  suffix: string,
): ConcessionRecord {
  const leaseStart = `${calendarMonth}-01`;
  const leaseEnd = computeLeaseEndDate(calendarMonth, termMonths);
  return {
    id: `${dealId}-lv-${calendarMonth}-${suffix}`,
    deal_id: dealId,
    lease_id: `lv-${calendarMonth}-${suffix}`,
    concession_type: EVENT_TO_CONCESSION_TYPE[eventType],
    cash_value: cashValue,
    lease_start_date: leaseStart,
    lease_end_date: leaseEnd,
    lease_term_months: termMonths,
    amortization_method: defaultMethodForEventType(eventType),
    is_lease_up_period: isLeaseUpPeriod,
    leasing_cost_treatment: treatment,
    is_renewal: eventType === 'RENEWAL_ONETIME' || eventType === 'RENEWAL_ONGOING',
    is_subject_history: false,
    inferred_from_rent_roll: false,
    early_termination_date: null,
    structural_write_off_date: null,
  };
}

/**
 * Assemble ConcessionRecord[] from the monthly forward table produced by the LV engine.
 *
 * §13 step 5 — LV Engine Output Assembly:
 *   For each MonthOutput with concession dollars:
 *   - New lease signings: classified as PRE_LEASE_BONUS (pre-delivery), LEASE_UP_INCENTIVE
 *     (lease-up window), or NEW_LEASE_ONETIME (stabilized).
 *   - Renewal signings: classified as RENEWAL_ONETIME.
 *   - is_lease_up_period: true when mode_for_month === 'LEASE_UP_NEW_CONSTRUCTION'.
 *   - Months with mixed pre+on signings generate proportionally split records.
 *   - Months with zero concession dollars produce no record (clean empty array).
 */
function buildConcessionRecords(
  months: MonthOutput[],
  inputs: LeaseVelocityInputs,
  treatment: LeasingCostTreatment,
): ConcessionRecord[] {
  const dealId = inputs.deal_id ?? 'lv';
  const termMonths = inputs.avg_lease_term_months ?? 12;
  const records: ConcessionRecord[] = [];

  for (const month of months) {
    const cal = month.calendar_month;
    const isLeaseUp = month.mode_for_month === 'LEASE_UP_NEW_CONSTRUCTION';

    // ── New lease concessions ───────────────────────────────────────────────
    const nlCash = month.concessions_new_lease;
    if (nlCash > 0) {
      const pre = month.pre_lease_signings;
      const on = month.lease_up_signings;
      const total = pre + on;

      if (total === 0) {
        // Signings info unavailable — emit one aggregate record
        const eventType: LeaseEventType = isLeaseUp ? 'LEASE_UP_INCENTIVE' : 'NEW_LEASE_ONETIME';
        records.push(makeRecord(dealId, cal, eventType, nlCash, termMonths, isLeaseUp, treatment, 'new'));
      } else if (pre > 0 && on === 0) {
        // Pure pre-lease month
        records.push(makeRecord(dealId, cal, 'PRE_LEASE_BONUS', nlCash, termMonths, isLeaseUp, treatment, 'pre'));
      } else if (pre === 0) {
        // On-lease or stabilized signings only
        const eventType: LeaseEventType = isLeaseUp ? 'LEASE_UP_INCENTIVE' : 'NEW_LEASE_ONETIME';
        records.push(makeRecord(dealId, cal, eventType, nlCash, termMonths, isLeaseUp, treatment, 'new'));
      } else {
        // Mixed month — split proportionally between PRE_LEASE_BONUS and LEASE_UP_INCENTIVE
        const preCash = Math.round((nlCash * pre) / total);
        const onCash = nlCash - preCash;
        if (preCash > 0) {
          records.push(makeRecord(dealId, cal, 'PRE_LEASE_BONUS', preCash, termMonths, isLeaseUp, treatment, 'pre'));
        }
        if (onCash > 0) {
          const eventType: LeaseEventType = isLeaseUp ? 'LEASE_UP_INCENTIVE' : 'NEW_LEASE_ONETIME';
          records.push(makeRecord(dealId, cal, eventType, onCash, termMonths, isLeaseUp, treatment, 'new'));
        }
      }
    }

    // ── Renewal concessions ─────────────────────────────────────────────────
    const rnCash = month.concessions_renewal;
    if (rnCash > 0 && month.renewals > 0) {
      records.push(makeRecord(dealId, cal, 'RENEWAL_ONETIME', rnCash, termMonths, false, treatment, 'ren'));
    }
  }

  return records;
}

export class LeaseVelocityEngine {
  run(inputs: LeaseVelocityInputs, dc?: DealContext): LeaseVelocityResult {
    const { mode, w } = resMode(inputs, dc); const allW: string[] = [...w];
    const tu = inputs.total_units; const tO = inputs.target_occupancy; const cO = inputs.current_occupancy ?? tO;
    const mr = inputs.avg_market_rent ?? 1800; const cls = inputs.property_class ?? 'B';
    const def = inputs.stabilization_definition ?? 'PHYSICAL_95'; const cs = inputs.concession_strategy ?? 'MARKET';
    const mi = inputs.marketing_intensity ?? 'MARKET';
    const treatment = inputs.leasing_cost_treatment ?? 'HYBRID';
    let r: RunResult;
    switch (mode) {
      case 'LEASE_UP_NEW_CONSTRUCTION': r = rnLU(inputs, tu, tO, mr, cls, def, cs, mi, treatment); break;
      case 'STABILIZED_MAINTENANCE': r = rnST(inputs, tu, tO, cO, mr, cls, def, cs, treatment); break;
      case 'OCCUPANCY_RECOVERY': r = rnRC(inputs, tu, tO, cO, mr, cls, def, cs, treatment, dc?.traffic?.peer_set?.max_monthly_absorption_per_class_msa); break;
      default: r = rnST(inputs, tu, tO, cO, mr, cls, def, cs, treatment);
    }
    allW.push(...r.w);

    const concessionRecords = buildConcessionRecords(r.mo, inputs, treatment);

    return {
      success: true,
      mode,
      inputs,
      months: r.mo,
      narrative: narr(mode, inputs, r.mo, r.sm, r.cr, allW),
      stabilization_month: r.sm,
      cumulative_reserve_required: r.cr,
      warnings: allW,
      concession_records: concessionRecords,
    };
  }
}

export default new LeaseVelocityEngine();
