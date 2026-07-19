/**
 * assumption-store-builder.ts
 *
 * Shared module: reconstructs ProFormaAssumptions from the deal's most recent
 * completed model + overlays resolved agent/user values from deal_assumptions.year1.
 *
 * Extracted from financial-model.routes.ts to break the routes↔service circular
 * and to give buildModel() the same hydration path the HTTP route uses.
 */

import { getPool } from '../database/connection';
import type { ProFormaAssumptions } from './financial-model-engine.service';

// ── Helper: safely coerce a value to number (mirrors bridge's toNumber) ────
function toNumber(v: unknown, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'number') return isFinite(v) ? v : fallback;
  if (typeof v === 'object') {
    const lv = v as Record<string, unknown>;
    if (typeof lv['resolved'] === 'number' && isFinite(lv['resolved'] as number)) {
      return lv['resolved'] as number;
    }
    if (typeof lv['override'] === 'number' && isFinite(lv['override'] as number)) {
      return lv['override'] as number;
    }
  }
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

// Helper: resolve a LayeredValue blob through the canonical chain:
// override > agent_confirmed > platform > stored resolved
function resolveLv(blob: unknown): number | null {
  if (!blob || typeof blob !== 'object') return null;
  const lv = blob as Record<string, unknown>;
  if (lv.override != null) return Number(lv.override);
  if (lv.agent_confirmed != null) return Number(lv.agent_confirmed);
  if (lv.platform != null) return Number(lv.platform);
  if (lv.resolved != null) return Number(lv.resolved);
  return null;
}

/**
 * Build ProFormaAssumptions from the deal's last completed model, overlaying
 * any resolved year1 fields (agent_confirmed, override, platform, resolved).
 *
 * @param dealId  Deal UUID
 * @param pool    DB pool (optional — created internally if omitted)
 */
export async function buildAssumptionsFromStore(
  dealId: string,
  pool?: ReturnType<typeof getPool>,
): Promise<ProFormaAssumptions> {
  const db = pool ?? getPool();

  const result = await db.query(
    `SELECT assumptions FROM deal_financial_models
     WHERE deal_id = $1 AND status = 'complete'
     ORDER BY created_at DESC LIMIT 1`,
    [dealId],
  );
  if (result.rows.length === 0) {
    throw new Error(
      `F-P1-A server-fetch: no completed model found for deal ${dealId}. ` +
      `Cannot reconstruct assumptions — client must supply assumptions body for first build.`
    );
  }
  const raw = result.rows[0].assumptions;
  const assumptions = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ProFormaAssumptions;

  // ── Overlay all year1 LayeredValue fields (widened from financing-only) ────
  try {
    const year1Res = await db.query(
      `SELECT year1->'rate'               as rate,
              year1->'ltv'                as ltv,
              year1->'term'               as term,
              year1->'amort'              as amort,
              year1->'io_period'          as io_period,
              year1->'dscr_floor'         as dscr_floor,
              year1->'debt_yield_floor'   as debt_yield_floor,
              year1->'vacancy_pct'        as vacancy_pct,
              year1->'management_fee_pct' as management_fee_pct,
              year1->'replacement_reserves' as replacement_reserves,
              year1->'exit_cap_rate'      as exit_cap_rate
       FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
      [dealId],
    );
    const y1 = year1Res.rows[0] ?? {};

    // ── Financing ─────────────────────────────────────────────────────────
    const resolvedRate = resolveLv(y1.rate);
    if (resolvedRate != null && !isNaN(resolvedRate)) {
      assumptions.financing = { ...assumptions.financing, interestRate: resolvedRate };
    }

    const resolvedLtv = resolveLv(y1.ltv);
    if (resolvedLtv != null && !isNaN(resolvedLtv)) {
      const purchasePrice = toNumber(assumptions.acquisition?.purchasePrice, 0);
      assumptions.financing = {
        ...assumptions.financing,
        loanAmount: purchasePrice > 0 ? Math.round(resolvedLtv * purchasePrice) : assumptions.financing?.loanAmount ?? 0,
      };
    }

    const resolvedTerm = resolveLv(y1.term);
    if (resolvedTerm != null && !isNaN(resolvedTerm)) {
      assumptions.financing = { ...assumptions.financing, term: resolvedTerm };
    }

    const resolvedAmort = resolveLv(y1.amort);
    if (resolvedAmort != null && !isNaN(resolvedAmort)) {
      assumptions.financing = { ...assumptions.financing, amortization: resolvedAmort };
    }

    const resolvedIo = resolveLv(y1.io_period);
    if (resolvedIo != null && !isNaN(resolvedIo)) {
      assumptions.financing = { ...assumptions.financing, ioPeriod: resolvedIo };
    }

    const resolvedDscr = resolveLv(y1.dscr_floor);
    if (resolvedDscr != null && !isNaN(resolvedDscr)) {
      (assumptions as any)._dscrFloor = resolvedDscr;
    }

    const resolvedDy = resolveLv(y1.debt_yield_floor);
    if (resolvedDy != null && !isNaN(resolvedDy)) {
      (assumptions as any)._debtYieldFloor = resolvedDy;
    }

    // ── Revenue / Disposition ─────────────────────────────────────────────
    const resolvedVacancy = resolveLv(y1.vacancy_pct);
    if (resolvedVacancy != null && !isNaN(resolvedVacancy)) {
      assumptions.revenue = { ...assumptions.revenue, stabilizedOccupancy: 1 - resolvedVacancy };
    }

    const resolvedExitCap = resolveLv(y1.exit_cap_rate);
    if (resolvedExitCap != null && !isNaN(resolvedExitCap)) {
      assumptions.disposition = { ...assumptions.disposition, exitCapRate: resolvedExitCap };
    }

    // ── Expenses ──────────────────────────────────────────────────────────
    const resolvedMgmtFee = resolveLv(y1.management_fee_pct);
    if (resolvedMgmtFee != null && !isNaN(resolvedMgmtFee)) {
      // Convert pct-of-EGI to dollar amount so the bridge can re-derive the pct
      const units = toNumber(assumptions.dealInfo?.totalUnits, 1) || 1;
      const marketRent = (assumptions.unitMix?.length ?? 0) > 0
        ? assumptions.unitMix!.reduce((s, u) => s + (u.marketRent ?? 0) * (u.units ?? 0), 0) /
          (assumptions.unitMix!.reduce((s, u) => s + (u.units ?? 0), 0) || units)
        : 1500;
      const stabilizedOccupancy = assumptions.revenue?.stabilizedOccupancy ?? 0.93;
      const estGPR = units * marketRent * 12;
      const estEGI = estGPR * stabilizedOccupancy;
      const mgmtAmt = estEGI * resolvedMgmtFee;
      assumptions.expenses = {
        ...assumptions.expenses,
        ['management_fee']: { amount: mgmtAmt, type: 'annual', growthRate: 0 },
      };
    }

    // ── CapEx ─────────────────────────────────────────────────────────────
    const resolvedReserves = resolveLv(y1.replacement_reserves);
    if (resolvedReserves != null && !isNaN(resolvedReserves)) {
      assumptions.capex = { ...assumptions.capex, reservesPerUnit: resolvedReserves };
    }
  } catch {
    // Non-blocking: if DB query fails, keep stored values
  }

  return assumptions;
}
