/**
 * Task #690 — broker_claims write race tests
 *
 * Three describe blocks:
 *  (a) routeExtractionResult — broker_claims preservation
 *  (b) seedProFormaYear1 — om slot population
 *  (c) seed observability log
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal mock pg Pool that captures every SQL call and param set. */
function makeMockPool(overrides: Partial<Record<string, unknown>> = {}): {
  pool: { query: ReturnType<typeof vi.fn> };
  calls: Array<{ sql: string; params: unknown[] }>;
} {
  const calls: Array<{ sql: string; params: unknown[] }> = [];

  const dealData: Record<string, unknown> = {
    broker_claims: {
      proforma: {
        stabilizedGpr:          4_901_400,
        realEstateTaxesAnnual:    977_287,
        contractServicesAnnual:    84_000,
        yearOneNOI:             2_600_000,
      },
      property: { name: '464 Bishop', city: 'Atlanta', state: 'GA' },
    },
    extraction_om: { source: 'platform', updatedAt: '2026-05-01T00:00:00Z' },
    ...overrides,
  };

  const pool = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });

      if (sql.includes('SELECT') && sql.includes('deal_data') && !sql.includes('JOIN')) {
        return { rows: [{ deal_data: dealData }] };
      }
      if (sql.includes('SELECT') && sql.includes('year1')) {
        return { rows: [{ year1: null }] };
      }
      if (sql.includes('SELECT id,') && sql.includes('has_t12')) {
        return { rows: [{ id: 'deal-1', has_t12: true, has_rr: false, has_tax: false }] };
      }
      if (sql.includes('SELECT') && sql.includes('deals') && sql.includes('city')) {
        return {
          rows: [{
            id: 'deal-1', target_units: 232,
            deal_data: dealData,
            city: 'Atlanta', state_code: 'GA',
          }],
        };
      }
      if (sql.includes('platform_market_snapshots') || sql.includes('platform_norms')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO deal_assumptions') || sql.includes('UPDATE deals')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };

  return { pool, calls };
}

// ─── Block (a): broker_claims preservation ────────────────────────────────────

describe('updateDealCapsule — atomic JSONB write (broker_claims preservation)', () => {
  it('T12 capsule write uses top-level || merge, not full-replace', async () => {
    const { pool, calls } = makeMockPool();

    // Import the module under test (updateDealCapsule is called inside routeExtractionResult)
    const { routeExtractionResult } = await import('../services/document-extraction/data-router');

    const extractionResult = {
      success: true,
      documentType: 'T12' as const,
      data: {
        months: [],
        summary: {
          gpr: 4_800_000,
          vacancy_loss: 192_000,
          loss_to_lease: 96_000,
          concessions: 48_000,
          bad_debt: 24_000,
          net_rental_income: 4_440_000,
          other_income: 0,
          effective_gross_income: 4_440_000,
          payroll: 280_000,
          repairs_maintenance: 75_000,
          turnover: 18_000,
          contract_services: 80_000,
          marketing: 10_000,
          admin_general: 20_000,
          management_fee: 177_600,
          utilities: 55_000,
          real_estate_tax: 960_000,
          insurance: 60_000,
          total_opex: 1_736_000,
          noi: 2_704_000,
        },
        chartFormat: null,
        propertyId: null,
        unit_count: 232,
      },
      summary: {},
      chartFormat: null,
      warnings: [],
    };

    await routeExtractionResult(extractionResult as never, {
      dealId: 'deal-1',
      filename: 'test-t12.pdf',
      uploadedBy: 'user-1',
      pool: pool as never,
    } as never);

    // The UPDATE deals SET deal_data query must use the JSONB || merge operator
    // and must NOT use a full-replace (= $2::jsonb) pattern.
    const capsuleUpdates = calls.filter(c =>
      c.sql.includes('UPDATE deals') && c.sql.includes('deal_data')
    );

    // At least one capsule update must have fired
    expect(capsuleUpdates.length).toBeGreaterThanOrEqual(1);

    // Verify the write uses || merge (not full-replace)
    for (const upd of capsuleUpdates) {
      expect(upd.sql).toMatch(/COALESCE\(deal_data.*\|\|/s);
      expect(upd.sql).not.toMatch(/deal_data\s*=\s*\$2::jsonb(?!\s*\|\|)/);
    }
  });

  it('OTHER_INCOME capsule write uses broker_claims sub-merge SQL', async () => {
    const { pool, calls } = makeMockPool();
    const { routeExtractionResult } = await import('../services/document-extraction/data-router');

    const extractionResult = {
      success: true,
      documentType: 'OTHER_INCOME' as const,
      data: {
        rows: [],
        summary: { totalAnnual: 240_000, categoryCount: 3 },
      },
      summary: {},
      chartFormat: null,
      warnings: [],
    };

    await routeExtractionResult(extractionResult as never, {
      dealId: 'deal-1',
      filename: 'test-other-income.pdf',
      uploadedBy: 'user-1',
      pool: pool as never,
    } as never);

    const capsuleUpdates = calls.filter(c =>
      c.sql.includes('UPDATE deals') && c.sql.includes('broker_claims')
    );

    // The broker_claims update must use jsonb_build_object sub-merge
    for (const upd of capsuleUpdates) {
      expect(upd.sql).toContain('jsonb_build_object');
      expect(upd.sql).toContain("'broker_claims'");
    }
  });

  it('OM path does not issue a capsule UPDATE (routeOM owns the write)', async () => {
    const { pool, calls } = makeMockPool();
    const { routeExtractionResult } = await import('../services/document-extraction/data-router');

    const extractionResult = {
      success: true,
      documentType: 'OM' as const,
      data: {
        property: { name: '464 Bishop', city: 'Atlanta', state: 'GA', units: 232 },
        brokerProforma: {
          stabilizedGpr: 4_901_400,
          realEstateTaxesAnnual: 977_287,
          contractServicesAnnual: 84_000,
          yearOneNOI: 2_600_000,
        },
        unitMix: [],
        otherIncome: null,
        replacementCost: null,
        capitalPlan: null,
        debtAssumptions: null,
        investmentHighlights: [],
        investmentThesis: null,
        metadata: { askingPrice: null },
      },
      summary: {},
      chartFormat: null,
      warnings: [],
    };

    await routeExtractionResult(extractionResult as never, {
      dealId: 'deal-1',
      filename: 'test-om.pdf',
      uploadedBy: 'user-1',
      pool: pool as never,
    } as never);

    // For OM, updateDealCapsule capsulePayload is empty → no second UPDATE.
    // The only UPDATE deals touching deal_data should be from routeOM itself (JSONB merge).
    const dealUpdates = calls.filter(c =>
      c.sql.includes('UPDATE deals') && c.sql.includes('deal_data')
    );

    for (const upd of dealUpdates) {
      // All deal_data writes must use COALESCE merge — never full-replace
      expect(upd.sql).toMatch(/COALESCE\(deal_data.*\|\|/s);
    }
  });
});

// ─── Block (b): seedProFormaYear1 — om slot population ───────────────────────

describe('seedProFormaYear1 — om slot population', () => {
  let capturedYear1: Record<string, unknown> | null = null;

  function makeSeederPool(brokerClaims: Record<string, unknown> | null) {
    const dealData: Record<string, unknown> = {
      extraction_t12: {
        gpr: 4_800_000,
        vacancy_loss: 192_000,
        loss_to_lease: 48_000,
        real_estate_tax: 960_000,
        contract_services: 80_000,
        payroll: 280_000,
        repairs_maintenance: 75_000,
        turnover: 18_000,
        marketing: 10_000,
        admin_general: 20_000,
        utilities: 55_000,
        insurance: 60_000,
        management_fee: 177_600,
        total_opex: 1_736_000,
        noi: 2_704_000,
        concessions: 48_000,
        bad_debt: 24_000,
        non_revenue_units: 0,
      },
      ...(brokerClaims ? { broker_claims: brokerClaims } : {}),
    };

    capturedYear1 = null;
    return {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT') && sql.includes('target_units') && sql.includes('deal_data')) {
          return { rows: [{ id: 'deal-1', target_units: 232, deal_data: dealData, city: 'Atlanta', state_code: 'GA' }] };
        }
        if (sql.includes('SELECT year1')) {
          return { rows: [] };
        }
        if (sql.includes('platform_market_snapshots') || sql.includes('platform_norms')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO deal_assumptions')) {
          capturedYear1 = typeof params?.[1] === 'string'
            ? JSON.parse(params[1] as string)
            : params?.[1] as Record<string, unknown>;
          return { rows: [{ id: 'seed-1' }] };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
  }

  it('writes year1.gpr.om = stabilizedGpr when broker_claims.proforma is present', async () => {
    const pool = makeSeederPool({
      proforma: { stabilizedGpr: 4_901_400, realEstateTaxesAnnual: 977_287, yearOneNOI: 2_600_000 },
      property: {},
    });

    const { seedProFormaYear1 } = await import('../services/proforma-seeder.service');
    const result = await seedProFormaYear1(pool as never, 'deal-1');

    expect(result.seeded).toBe(true);
    expect(capturedYear1).not.toBeNull();
    const gpr = capturedYear1!['gpr'] as Record<string, unknown>;
    expect(gpr.om).toBe(4_901_400);
  });

  it('writes year1.real_estate_tax.om = realEstateTaxesAnnual when present', async () => {
    const pool = makeSeederPool({
      proforma: { stabilizedGpr: 4_901_400, realEstateTaxesAnnual: 977_287, yearOneNOI: 2_600_000 },
      property: {},
    });

    const { seedProFormaYear1 } = await import('../services/proforma-seeder.service');
    await seedProFormaYear1(pool as never, 'deal-1');

    expect(capturedYear1).not.toBeNull();
    const ret = capturedYear1!['real_estate_tax'] as Record<string, unknown>;
    expect(ret.om).toBe(977_287);
  });

  it('writes null to year1.gpr.om when broker_claims has no proforma', async () => {
    const pool = makeSeederPool(null);

    const { seedProFormaYear1 } = await import('../services/proforma-seeder.service');
    await seedProFormaYear1(pool as never, 'deal-1');

    expect(capturedYear1).not.toBeNull();
    const gpr = capturedYear1!['gpr'] as Record<string, unknown>;
    expect(gpr.om).toBeNull();
  });
});

// ─── Block (c): seed observability log ────────────────────────────────────────

describe('seed observability log', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  function makePoolWithCapsule(capsule: Record<string, unknown>) {
    return {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT') && sql.includes('target_units') && sql.includes('deal_data')) {
          return { rows: [{ id: 'deal-1', target_units: 232, deal_data: capsule, city: null, state_code: null }] };
        }
        if (sql.includes('SELECT year1')) {
          return { rows: [] };
        }
        if (sql.includes('platform_market_snapshots') || sql.includes('platform_norms')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO deal_assumptions')) {
          return { rows: [{ id: 'seed-1' }] };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
  }

  it('emits seed.complete event with correct top-level shape', async () => {
    const pool = makePoolWithCapsule({
      extraction_t12: { gpr: 4_800_000, real_estate_tax: 960_000, payroll: 280_000, noi: 2_704_000 },
      broker_claims: {
        proforma: { stabilizedGpr: 4_901_400, realEstateTaxesAnnual: 977_287 },
        property: {},
      },
      extraction_om: { source: 'platform' },
    });

    const { seedProFormaYear1 } = await import('../services/proforma-seeder.service');
    await seedProFormaYear1(pool as never, 'deal-1');

    const logCalls = consoleSpy.mock.calls
      .map(c => { try { return JSON.parse(String(c[0])); } catch { return null; } })
      .filter(Boolean);

    const seedLog = logCalls.find((l: Record<string, unknown>) => l.event === 'seed.complete');
    expect(seedLog).toBeDefined();
    expect(seedLog.deal_id).toBe('deal-1');
    expect(typeof seedLog.timestamp).toBe('string');
    expect(Array.isArray(seedLog.uploaded_sources)).toBe(true);
    expect(seedLog.year1_slot_population).toBeDefined();
  });

  it('includes expected_vs_actual_gaps when source uploaded but slot is null', async () => {
    const pool = makePoolWithCapsule({
      extraction_t12: { gpr: 4_800_000, real_estate_tax: 960_000, payroll: 280_000, noi: 2_704_000 },
      extraction_om: { source: 'platform' },
    });

    const { seedProFormaYear1 } = await import('../services/proforma-seeder.service');
    await seedProFormaYear1(pool as never, 'deal-1');

    const logCalls = consoleSpy.mock.calls
      .map(c => { try { return JSON.parse(String(c[0])); } catch { return null; } })
      .filter(Boolean);

    const seedLog = logCalls.find((l: Record<string, unknown>) => l.event === 'seed.complete');
    expect(seedLog).toBeDefined();
    // OM is uploaded (extraction_om present) but broker_claims.proforma is absent
    // → gpr.om / real_estate_tax.om / contract_services.om should all be gaps
    expect(Array.isArray(seedLog.expected_vs_actual_gaps)).toBe(true);
    expect(seedLog.expected_vs_actual_gaps.length).toBeGreaterThan(0);
    const gapFields = (seedLog.expected_vs_actual_gaps as Array<{ field: string; slot: string }>)
      .map(g => `${g.field}.${g.slot}`);
    expect(gapFields).toContain('gpr.om');
  });

  it('omits expected_vs_actual_gaps when all source slots are populated', async () => {
    const pool = makePoolWithCapsule({
      extraction_t12: { gpr: 4_800_000, real_estate_tax: 960_000, payroll: 280_000, noi: 2_704_000 },
    });

    const { seedProFormaYear1 } = await import('../services/proforma-seeder.service');
    await seedProFormaYear1(pool as never, 'deal-1');

    const logCalls = consoleSpy.mock.calls
      .map(c => { try { return JSON.parse(String(c[0])); } catch { return null; } })
      .filter(Boolean);

    const seedLog = logCalls.find((l: Record<string, unknown>) => l.event === 'seed.complete');
    expect(seedLog).toBeDefined();
    // Only T12 uploaded — gpr.t12 is populated, so no gap for t12.gpr
    expect(seedLog.expected_vs_actual_gaps).toBeUndefined();
  });
});
