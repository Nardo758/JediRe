import { Router, Request, Response } from 'express';
import { financialModelEngine } from '../../services/financial-model-engine.service';
import { excelExportService } from '../../services/excel-export.service';
import { getPool } from '../../database/connection';
import { dealVersionsService, type SaveTrigger } from '../../services/proforma/deal-versions.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { requireDealAccess } from '../../middleware/deal-access';
import type { ProFormaAssumptions } from '../../services/financial-model-engine.service';

const router = Router();

// In-process idempotency cache.
// Value is a live Promise while the build is running so concurrent requests
// with the same key share a single LLM call rather than spawning duplicates.
// On completion the entry is replaced with the full serialised response payload
// so cache hits replay exactly the first response (including assumptionsHash).
type IdempPayload = { data: unknown; assumptionsHash: string };
const _idempotencyCache = new Map<string, Promise<IdempPayload> | { payload: IdempPayload; ts: number }>();
const IDEMPOTENCY_TTL_MS = 10_000;

// ──────────────────────────────────────────────────────────────────────────
// Save-Driven Versioning (Spec §13)
//
// All version endpoints are gated by requireAuth + requireDealAccess so that
// the audit trail cannot be read or written across tenants. Authentication is
// enforced first, then deal-level org membership is checked against the
// authenticated user.
// ──────────────────────────────────────────────────────────────────────────

router.get(
  '/:dealId/versions',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const versions = await dealVersionsService.listVersions(req.params.dealId);
      return res.json({ success: true, data: versions });
    } catch (error: any) {
      console.error('List versions error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  '/:dealId/versions',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      // Audit-integrity: server is authoritative for `created_by`, `model_versions`,
      // and `override_divergences` (Spec §13). Client-supplied values for those
      // fields are intentionally ignored to prevent audit-trail tampering.
      const { snapshot, trigger, note } = req.body ?? {};
      if (!snapshot || typeof snapshot !== 'object') {
        return res.status(400).json({ error: 'snapshot (object) is required' });
      }
      const allowedTriggers: SaveTrigger[] = ['user_save', 'chat_command', 'auto_prompt'];
      const safeTrigger: SaveTrigger | undefined =
        trigger && allowedTriggers.includes(trigger) ? trigger : undefined;
      const userId = (req.user as any)?.userId ?? null;
      const row = await dealVersionsService.saveVersion({
        dealId,
        userId,
        snapshot,
        // modelVersions + divergences intentionally omitted — server stamps them.
        trigger: safeTrigger,
        note: note ?? null,
      });
      return res.status(201).json({ success: true, data: row });
    } catch (error: any) {
      console.error('Save version error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  '/:dealId/versions/:versionNumber',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const versionNumber = Number(req.params.versionNumber);
      if (!Number.isFinite(versionNumber) || versionNumber < 1) {
        return res.status(400).json({ error: 'versionNumber must be a positive integer' });
      }
      const version = await dealVersionsService.getVersion(req.params.dealId, versionNumber);
      if (!version) return res.status(404).json({ error: 'version not found' });
      return res.json({ success: true, data: version });
    } catch (error: any) {
      console.error('Get version error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Maps the F9 frontend proforma format to the engine's ProFormaAssumptions format.
 * The frontend sends:
 *   { dealInfo, acquisition, disposition, revenue, expenses, debt, sensitivityOverrides }
 * The engine expects:
 *   { dealInfo, acquisition, disposition, revenue, expenses, financing, capex, waterfall }
 */
function normalizeToEngineFormat(raw: any): ProFormaAssumptions {
  const d = raw.dealInfo ?? {};
  const acq = raw.acquisition ?? {};
  const dsp = raw.disposition ?? {};
  const rev = raw.revenue ?? {};
  const exp = raw.expenses ?? {};
  const debt = raw.debt ?? {};
  const um = raw.unitMix ?? [];

  // Map unitMix from { unitType, units, rent, sf, assigns } to { floorPlan, unitSize, beds, ... }
  const unitMix = um.length > 0
    ? um.map((u: any) => ({
        floorPlan: u.floorPlan || u.unitType || u.assigns || 'Unit',
        unitSize: u.unitSize || u.sf || 0,
        beds: u.beds ?? 1,
        units: u.units || 1,
        occupied: u.occupied ?? Math.round((u.units || 1) * ((rev.stabilizedOccupancy ?? 0.93))),
        vacant: u.vacant ?? Math.round((u.units || 1) * (1 - (rev.stabilizedOccupancy ?? 0.93))),
        marketRent: u.marketRent || u.rent || 1500,
        inPlaceRent: u.inPlaceRent || u.rent || 1500,
      }))
    : [{
        floorPlan: 'Default',
        unitSize: d.netRentableSF ? Math.round(d.netRentableSF / (d.totalUnits || 1)) : 800,
        beds: 1,
        units: d.totalUnits || 1,
        occupied: Math.round((d.totalUnits || 1) * 0.93),
        vacant: Math.round((d.totalUnits || 1) * 0.07),
        marketRent: 1500,
        inPlaceRent: 1400,
      }];

  // Normalize otherIncome from frontend format if present
  const otherIncome: Record<string, { perUnitMonth: number; penetration: number }> = {};
  if (rev.otherIncome) {
    for (const [k, v] of Object.entries(rev.otherIncome)) {
      const oi = v as any;
      if (typeof oi === 'number') {
        otherIncome[k] = { perUnitMonth: oi, penetration: 1.0 };
      } else if (oi && typeof oi === 'object') {
        otherIncome[k] = {
          perUnitMonth: oi.perUnitMonth ?? oi.perUnit ?? 0,
          penetration: oi.penetration ?? 1.0,
        };
      }
    }
  }

  // Build financing from the frontend debt object
  const interestRate = (debt.interestRate ?? 6.5) / 100;
  const term = debt.term ?? 60;
  const amortization = debt.amortization ?? 30;
  const loanAmount = debt.loanAmount ?? (acq.purchasePrice ? Math.round(acq.purchasePrice * 0.75) : 0);

  return {
    dealInfo: {
      dealName: d.dealName ?? 'Deal',
      totalUnits: d.totalUnits ?? 0,
      netRentableSF: d.netRentableSF ?? 0,
      vintage: d.vintage ?? 1980,
      address: d.address ?? '',
      city: d.city ?? '',
      state: d.state ?? '',
    },
    modelType: raw.modelType ?? 'existing',
    holdPeriod: raw.holdPeriod ?? 5,
    unitMix,
    acquisition: {
      purchasePrice: acq.purchasePrice ?? 0,
      capRate: (acq.capRate ?? 6) / 100,
      closingCosts: acq.closingCosts ?? { legal: 50000, appraisal: 15000, inspection: 10000, title: 15000 },
    },
    disposition: {
      exitCapRate: dsp.exitCapRate ?? 0.065,
      sellingCosts: dsp.sellingCosts ?? 0.02,
      saleNOIMethod: dsp.saleNOIMethod ?? 'terminal',
    },
    revenue: {
      rentGrowth: Array.isArray(rev.rentGrowth)
        ? rev.rentGrowth.map((r: number) => r / 100)
        : [0.03, 0.03, 0.03, 0.03, 0.03],
      lossToLease: (rev.lossToLease ?? 3) / 100,
      stabilizedOccupancy: (rev.stabilizedOccupancy ?? 93) / 100,
      collectionLoss: (rev.collectionLoss ?? 1.5) / 100,
      otherIncome,
    },
    expenses: (() => {
      const mapped: Record<string, { amount: number; type: string; growthRate: number }> = {};
      for (const [k, v] of Object.entries(exp)) {
        const e = v as any;
        if (!e || typeof e !== 'object') continue;
        // Normalize growthRate from percentage to decimal
        const gr = e.growthRate ?? 3;
        mapped[k] = {
          amount: e.amount ?? 0,
          type: e.type ?? 'sf',
          growthRate: gr > 1 ? gr / 100 : gr,
        };
      }
      return mapped;
    })(),
    financing: {
      loanAmount,
      loanType: debt.rateType ?? 'fixed',
      interestRate,
      spread: debt.spread ?? 0.025,
      term,
      amortization,
      ioPeriod: debt.ioPeriod ?? 0,
      originationFee: debt.originationFee ?? 0.01,
      rateCapCost: debt.rateCapCost ?? 0,
      prepayPenalty: debt.prepayPenalty ?? 0,
    },
    capex: {
      lineItems: raw.capexLineItems ?? [],
      contingencyPct: 0.10,
      reservesPerUnit: 250,
    },
    waterfall: {
      lpShare: 0.99,
      gpShare: 0.01,
      hurdles: [{ hurdleRate: 0.08, promoteToGP: 0.20, lpSplit: 0.80 }],
      equityContribution: loanAmount > 0
        ? (acq.purchasePrice ?? 0) - loanAmount
        : Math.round((acq.purchasePrice ?? 0) * 0.25),
    },
  };
}

router.post('/build', async (req: Request, res: Response) => {
  try {
    const { dealId, assumptions, sensitivityOverrides } = req.body;
    if (!dealId || !assumptions) {
      return res.status(400).json({ error: 'dealId and assumptions are required' });
    }

    const normalized = normalizeToEngineFormat(assumptions);

    const idempKey = req.headers['idempotency-key'] as string | undefined;
    if (idempKey) {
      const cacheKey = `${dealId}:${idempKey}`;
      const entry = _idempotencyCache.get(cacheKey);

      if (entry) {
        if (entry instanceof Promise) {
          // A concurrent request is already building — await the shared promise
          // and replay its payload verbatim (same data AND same assumptionsHash).
          const payload = await entry;
          return res.json({ success: true, ...payload, idempotent: true });
        }
        const completed = entry as { payload: IdempPayload; ts: number };
        if (Date.now() - completed.ts < IDEMPOTENCY_TTL_MS) {
          return res.json({ success: true, ...completed.payload, idempotent: true });
        }
      }

      // Store the in-flight promise before awaiting so concurrent duplicates
      // attach to it rather than spawning independent LLM calls.
      const promise: Promise<IdempPayload> = financialModelEngine.buildModel(dealId, normalized)
        .then(({ result, assumptionsHash }) => {
          const pl: IdempPayload = { data: result, assumptionsHash };
          _idempotencyCache.set(cacheKey, { payload: pl, ts: Date.now() });
          return pl;
        })
        .catch(err => { _idempotencyCache.delete(cacheKey); throw err; });
      _idempotencyCache.set(cacheKey, promise);
      const payload = await promise;
      return res.json({ success: true, ...payload });
    }

    const { result, assumptionsHash } = await financialModelEngine.buildModel(dealId, normalized);
    return res.json({ success: true, data: result, assumptionsHash });
  } catch (error: any) {
    console.error('Financial model build error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to build financial model' });
  }
});

router.get('/:dealId/latest', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    // Optional: caller passes ?assumptionsHash=<hex> to get a staleness signal.
    const currentHash = typeof req.query.assumptionsHash === 'string'
      ? req.query.assumptionsHash
      : undefined;
    const model = await financialModelEngine.getLatestModel(dealId, currentHash);
    if (!model) {
      return res.status(404).json({ error: 'No completed model found for this deal' });
    }
    return res.json({ success: true, data: model });
  } catch (error: any) {
    console.error('Get latest model error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:dealId/export/excel', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const model = await financialModelEngine.getLatestModel(dealId);
    if (!model) {
      return res.status(404).json({ error: 'No completed model found. Build a model first.' });
    }

    if (!model.results?.annualCashFlow || !Array.isArray(model.results.annualCashFlow)) {
      return res.status(400).json({ error: 'Model results incomplete — no annual cash flow data available for export' });
    }

    const filepath = await excelExportService.generateWorkbook(dealId, model.assumptions, model.results);

    const fs = await import('fs');
    if (!fs.existsSync(filepath)) {
      return res.status(500).json({ error: 'Excel file generation failed' });
    }

    const pool = getPool();
    await pool.query(
      `UPDATE deal_financial_models SET excel_path = $1, updated_at = NOW()
       WHERE id = (SELECT id FROM deal_financial_models WHERE deal_id = $2 AND status = 'complete' ORDER BY created_at DESC LIMIT 1)`,
      [filepath, dealId]
    );

    return res.download(filepath, undefined, (err) => {
      if (err && !res.headersSent) {
        console.error('Excel download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
  } catch (error: any) {
    console.error('Excel export error:', error.message, error.stack);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
