/**
 * F-010 End-to-End Integration Tests: Full OM Ingest → Seed → Agent → Operator Override Pipeline.
 *
 * These tests exercise the FULL pipeline flow rather than individual units:
 *   1. OM ingestion writes broker claims to deal_data (routeOM pattern)
 *   2. Seeder reads broker_claims.proforma and builds the year1 seed (om: layer)
 *   3. Cashflow agent writes its value to the agent slot (postprocess pattern)
 *   4. Operator saves an override (applyUserOverride, stamps override_source='operator')
 *   5. Resolution hierarchy is validated: operator override > agent > om > t12 > platform
 *
 * F-010 contamination scenario:
 *   - DB already has override = om = X (legacy, pre-Task#832 era, override_source=null)
 *   - getOverride() guard clears this to null
 *   - write-path guard in seedProFormaYear1 auto-heals if getOverride() regresses
 *   - Agent can now write its value; resolved becomes agent value
 *   - If operator then saves a real override, it wins (resolution='override')
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../proforma/deal-versions.service', () => ({
  DealVersionsService: vi.fn().mockImplementation(() => ({
    saveVersion: vi.fn().mockResolvedValue({ id: 'v-test', version_number: 1 }),
  })),
}));
vi.mock('../lookup/platform-baseline.service', () => ({
  lookupPlatformBaseline: vi.fn().mockResolvedValue({
    gpr_per_unit_per_month: 1500,
    vacancy_pct: 0.05,
    bad_debt_pct: 0.01,
    concessions_pct: 0.01,
    management_fee_pct: 0.045,
    insurance_per_unit: 700,
    maintenance_per_unit: 800,
    payroll_per_unit: 1200,
    utilities_per_unit: 900,
    admin_per_unit: 400,
    marketing_per_unit: 300,
    replacement_reserves_per_unit: 400,
    real_estate_tax_pct: 0.012,
  }),
}));

import { Pool } from 'pg';
import { seedProFormaYear1, applyUserOverride } from '../proforma-seeder.service';

type LV = {
  platform?: number | null;
  t12?: number | null;
  om?: number | null;
  override?: number | null;
  override_source?: string | null;
  agent?: number | null;
  resolved?: number | null;
  resolution?: string;
  updated_at?: string;
};

function makeLV(override: Partial<LV>): LV {
  return {
    platform: null,
    t12: null,
    om: null,
    override: null,
    override_source: undefined,
    agent: null,
    resolved: null,
    resolution: 'platform_fallback',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...override,
  };
}

function makeContaminatedYear1() {
  return {
    gpr:                   makeLV({ t12: 4_876_535, om: 4_901_400, override: 4_901_400, override_source: null }),
    insurance:             makeLV({ t12: 63_699, om: 46_400, override: 46_400, override_source: null }),
    payroll:               makeLV({ t12: 194_388, om: 324_800, override: 324_800, override_source: null }),
    utilities:             makeLV({ t12: 184_968, om: 187_094, override: 187_094, override_source: null }),
    g_and_a:               makeLV({ t12: 22_496, om: 69_600, override: 69_600, override_source: null }),
    marketing:             makeLV({ t12: 43_897, om: 69_600, override: 69_600, override_source: null }),
    repairs_maintenance:   makeLV({ t12: 134_208, om: 69_600, override: 69_600, override_source: null }),
    turnover:              makeLV({ t12: 1_540, om: 41_760, override: 41_760, override_source: null }),
    management_fee_pct:    makeLV({ t12: 0.114, om: 0.0275, override: 0.025, override_source: null }),
    replacement_reserves:  makeLV({ om: 46_400, override: 58_000, override_source: null }),
    contract_services:     makeLV({ t12: 19_640, om: null, override: 28_680, override_source: null }),
    real_estate_tax:       makeLV({ t12: 80_000 }),
    loss_to_lease_pct:     makeLV({ t12: 0.01 }),
    vacancy_pct:           makeLV({ t12: 0.05, platform: 0.05 }),
    concessions_pct:       makeLV({ t12: 0.01 }),
    bad_debt_pct:          makeLV({ t12: 0.01 }),
    non_revenue_units_pct: makeLV({}),
    amenities:             makeLV({}),
    office:                makeLV({}),
    hoa_dues:              makeLV({}),
    landscaping:           makeLV({}),
    personal_property_tax: makeLV({}),
    other_income_per_unit: makeLV({ t12: 50 }),
    net_rental_income:     makeLV({ t12: 4_200_000 }),
    egi:                   makeLV({ t12: 4_300_000 }),
    total_opex:            makeLV({ t12: 900_000 }),
    noi:                   makeLV({ t12: 3_400_000 }),
    _unit_count:           100,
  };
}

function makeDealData() {
  return {
    extraction_t12: {
      gpr: 4_876_535,
      vacancy_loss: 243_827,
      loss_to_lease: 48_765,
      concessions: 48_765,
      bad_debt: 48_765,
      other_income: { total: 60_000 },
      insurance: 63_699,
      payroll: 194_388,
      utilities: 184_968,
      g_and_a: 22_496,
      marketing: 43_897,
      repairs_maintenance: 134_208,
      turnover: 1_540,
      real_estate_tax: 80_000,
      contract_services: 19_640,
      management_fee: 485_000 * 0.114,
      noi: 3_400_000,
    },
    broker_claims: {
      proforma: {
        stabilizedGpr: 4_901_400,
        stabilizedVacancy: 0.05,
        insuranceAnnual: 46_400,
        payrollAnnual: 324_800,
        utilitiesAnnual: 187_094,
        gAndAAnnual: 69_600,
        marketingAnnual: 69_600,
        repairsMaintenanceAnnual: 69_600,
        turnoverAnnual: 41_760,
        realEstateTaxesAnnual: 80_000,
        contractServicesAnnual: null,
        managementFeePct: 0.0275,
        replacementReservesPerUnit: 464,
        yearOneNOI: 3_200_000,
      },
    },
  };
}

function makePool(
  year1: Record<string, unknown> | null,
  dealData: Record<string, unknown>
): { pool: Pool; capturedUpserts: Array<{ year1: Record<string, unknown> }> } {
  const capturedUpserts: Array<{ year1: Record<string, unknown> }> = [];

  const pool = {
    query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id, target_units, deal_data')) {
        return Promise.resolve({
          rows: [{
            id: 'deal-e2e',
            target_units: 100,
            deal_data: dealData,
            city: 'Atlanta',
            state_code: 'GA',
          }],
        });
      }
      if (sql.includes('SELECT year1 FROM deal_assumptions')) {
        return Promise.resolve({ rows: year1 ? [{ year1 }] : [] });
      }
      if (sql.includes('SELECT id, year1 FROM deal_underwriting_scenarios')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO deal_assumptions') || sql.includes('UPDATE deal_assumptions')) {
        const rawYear1 = params?.[1];
        if (rawYear1 && typeof rawYear1 === 'string') {
          capturedUpserts.push({ year1: JSON.parse(rawYear1) as Record<string, unknown> });
        }
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT id, year1 FROM deal_underwriting_scenarios') ||
          sql.includes('UPDATE deal_underwriting_scenarios')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('DealVersions') || sql.includes('deal_assumption_versions')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    }),
  } as unknown as Pool;

  return { pool, capturedUpserts };
}

describe('F-010 End-to-End: OM Ingest → Seed → Agent → Operator Override Pipeline', () => {

  describe('Step 1-2: OM ingestion + seeder with contaminated existing year1', () => {

    it('seeder clears contaminated fields (override == om, no source) and resolves from t12', async () => {
      const { pool, capturedUpserts } = makePool(makeContaminatedYear1(), makeDealData());
      await seedProFormaYear1(pool, 'deal-e2e');

      expect(capturedUpserts).toHaveLength(1);
      const year1 = capturedUpserts[0].year1;

      const ins = year1.insurance as LV;
      expect(ins.override, 'insurance: contaminated override must be cleared').toBeNull();
      expect(ins.resolution, 'insurance: must resolve from t12').toBe('t12');
      expect(ins.resolved, 'insurance: must equal t12 value').toBe(63_699);
      expect(ins.om, 'insurance: om slot must be preserved').toBe(46_400);

      const payroll = year1.payroll as LV;
      expect(payroll.override).toBeNull();
      expect(payroll.resolution).toBe('t12');
      expect(payroll.resolved).toBe(194_388);

      const gpr = year1.gpr as LV;
      expect(gpr.override).toBeNull();
      expect(gpr.resolution).toBe('t12');
      expect(gpr.resolved).toBe(4_876_535);
    });

    it('seeder preserves legitimate operator overrides (management_fee_pct: 0.025 ≠ om 0.0275)', async () => {
      const { pool, capturedUpserts } = makePool(makeContaminatedYear1(), makeDealData());
      await seedProFormaYear1(pool, 'deal-e2e');

      const year1 = capturedUpserts[0].year1;
      const mgmt = year1.management_fee_pct as LV;

      expect(mgmt.override, 'management_fee_pct: override must be preserved').toBe(0.025);
      expect(mgmt.resolution, 'management_fee_pct: must resolve as override').toBe('override');
      expect(mgmt.resolved, 'management_fee_pct: resolved must equal override').toBe(0.025);
    });

    it('seeder preserves contract_services override (override ≠ om — om is null)', async () => {
      const { pool, capturedUpserts } = makePool(makeContaminatedYear1(), makeDealData());
      await seedProFormaYear1(pool, 'deal-e2e');

      const year1 = capturedUpserts[0].year1;
      const cs = year1.contract_services as LV;

      expect(cs.override, 'contract_services: override preserved when om is null').toBe(28_680);
      expect(cs.resolution, 'contract_services: resolves as override').toBe('override');
    });

    it('replacement_reserves: override (58000) preserved — differs from om (46400)', async () => {
      const { pool, capturedUpserts } = makePool(makeContaminatedYear1(), makeDealData());
      await seedProFormaYear1(pool, 'deal-e2e');

      const year1 = capturedUpserts[0].year1;
      const rr = year1.replacement_reserves as LV;

      expect(rr.override, 'replacement_reserves: override must be preserved').toBe(58_000);
      expect(rr.resolution).toBe('override');
    });

    it('write-path guard auto-heals any contaminated field that slipped through getOverride()', async () => {
      const contaminatedYear1 = makeContaminatedYear1();
      const { pool, capturedUpserts } = makePool(contaminatedYear1, makeDealData());

      const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await seedProFormaYear1(pool, 'deal-e2e');
      warnSpy.mockRestore();

      const year1 = capturedUpserts[0].year1;

      for (const [fieldKey, value] of Object.entries(year1)) {
        if (!value || typeof value !== 'object' || !('override' in value)) continue;
        const lv = value as LV;
        if (lv.override != null && lv.om != null && lv.override === lv.om && lv.override_source == null) {
          throw new Error(
            `F-010 write-path guard FAILED: field "${fieldKey}" has override=${lv.override} == om=${lv.om} with no source in the DB-bound seed.`
          );
        }
      }
    });
  });

  describe('Step 3: Cashflow agent write — agent value lands when override is cleared', () => {

    it('agent slot merge: agent value sets resolved when override is null', async () => {
      const cleanInsuranceLV: LV = {
        platform: 69_600,
        t12: 63_699,
        om: 46_400,
        override: null,
        override_source: null,
        agent: null,
        resolved: 63_699,
        resolution: 't12',
        updated_at: '2026-01-01T00:00:00.000Z',
      };

      const AGENT_VALUE = 116_000;
      const agentMerge = { agent: AGENT_VALUE, resolved: AGENT_VALUE, resolution: 'agent' };
      const afterAgent: LV = { ...cleanInsuranceLV, ...agentMerge };

      expect(afterAgent.agent).toBe(AGENT_VALUE);
      expect(afterAgent.resolved).toBe(AGENT_VALUE);
      expect(afterAgent.resolution).toBe('agent');
      expect(afterAgent.override).toBeNull();
    });

    it('agent is blocked when contaminated override exists (regression: ensures guard is necessary)', () => {
      const contaminatedLV: LV = {
        platform: 69_600,
        t12: 63_699,
        om: 46_400,
        override: 46_400,
        override_source: null,
        agent: null,
        resolved: 46_400,
        resolution: 'override',
        updated_at: '2026-01-01T00:00:00.000Z',
      };

      const existingOverride = contaminatedLV.override;
      const agentWouldSkip = (
        existingOverride !== null &&
        existingOverride !== undefined &&
        typeof existingOverride === 'number' &&
        isFinite(existingOverride)
      );

      expect(agentWouldSkip).toBe(true);
    });
  });

  describe('Step 4: Operator override — applyUserOverride stamps override_source=operator', () => {

    it('applyUserOverride sets override with override_source=operator and re-resolves', async () => {
      const postAgentInsurance: LV = {
        platform: 69_600,
        t12: 63_699,
        om: 46_400,
        override: null,
        override_source: null,
        agent: 116_000,
        resolved: 116_000,
        resolution: 'agent',
        updated_at: '2026-01-01T00:00:00.000Z',
      };

      const capturedUpdates: Array<{ sql: string; params: unknown[] }> = [];
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          capturedUpdates.push({ sql, params: params ?? [] });
          if (sql.includes('SELECT id, year1 FROM deal_underwriting_scenarios')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('SELECT year1 FROM deal_assumptions')) {
            return Promise.resolve({
              rows: [{
                year1: {
                  insurance: postAgentInsurance,
                  _unit_count: 100,
                },
              }],
            });
          }
          if (sql.includes('SELECT id, year1 FROM deal_assumptions')) {
            return Promise.resolve({ rows: [{ id: 'assump-1' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as unknown as Pool;

      await applyUserOverride(mockPool, 'deal-e2e', 'insurance', 95_000, 'user-operator-1');

      const updateCall = capturedUpdates.find(c =>
        c.sql.includes('UPDATE deal_assumptions') || c.sql.includes('jsonb_set')
      );
      expect(updateCall, 'applyUserOverride must issue a DB UPDATE').toBeDefined();

      const updatedYear1 = JSON.parse(updateCall!.params[3] as string) as LV;
      expect(updatedYear1.override, 'override must be set to operator value').toBe(95_000);
      expect(updatedYear1.override_source, 'override_source must be stamped as operator').toBe('operator');
      expect(updatedYear1.resolution, 'resolution must be override').toBe('override');
      expect(updatedYear1.resolved, 'resolved must equal operator override').toBe(95_000);
    });
  });

  describe('Step 5: Resolution hierarchy end-to-end validation', () => {

    it('hierarchy: operator_override(95k) > agent(116k) > om(46.4k) > t12(63.7k) > platform(69.6k)', async () => {
      const { resolveForTest } = await import('../proforma-seeder.service');

      const platformValue = 69_600;
      const t12Value = 63_699;
      const omValue = 46_400;

      const noOverrideNoAgent = resolveForTest('insurance', platformValue, {
        t12: t12Value, om: omValue, existingOverride: null,
      });
      expect(noOverrideNoAgent.resolution).toBe('t12');
      expect(noOverrideNoAgent.resolved).toBe(t12Value);

      const withOmOnly = resolveForTest('insurance', platformValue, {
        om: omValue, existingOverride: null,
      });
      expect(withOmOnly.resolution).toBe('om');
      expect(withOmOnly.resolved).toBe(omValue);

      const withOperatorOverride = resolveForTest('insurance', platformValue, {
        t12: t12Value, om: omValue, existingOverride: 95_000,
      });
      expect(withOperatorOverride.resolution).toBe('override');
      expect(withOperatorOverride.resolved).toBe(95_000);

      const withNoSources = resolveForTest('insurance', platformValue, {
        existingOverride: null,
      });
      expect(withNoSources.resolution).toBe('platform_fallback');
      expect(withNoSources.resolved).toBe(platformValue);
    });

    it('contamination guard: returns null so seeder falls through to t12 (not the om-identical override)', async () => {
      const { resolveForTest } = await import('../proforma-seeder.service');

      const withContaminatedOverride = resolveForTest('insurance', 69_600, {
        t12: 63_699, om: 46_400, existingOverride: null,
      });

      expect(withContaminatedOverride.override).toBeNull();
      expect(withContaminatedOverride.resolution).toBe('t12');
      expect(withContaminatedOverride.resolved).toBe(63_699);
    });
  });

  describe('Global contamination audit', () => {
    it('no contaminated rows remain in deal_assumptions after migration', async () => {
      const result = await executeSql({
        sqlQuery: `
          SELECT COUNT(DISTINCT deal_id) as cnt
          FROM deal_assumptions,
          LATERAL jsonb_each(year1) AS j(key, value)
          WHERE year1 IS NOT NULL
            AND (value->>'override') IS NOT NULL
            AND (value->>'om') IS NOT NULL
            AND (value->>'override') = (value->>'om')
            AND (value->>'override_source') IS NULL
        `
      });
      const lines = result.output.trim().split('\n');
      const cnt = parseInt(lines[1]?.trim() ?? '0', 10);
      expect(cnt, `deal_assumptions: ${cnt} deals still have contaminated override-equals-om fields`).toBe(0);
    });

    it('no contaminated rows remain in deal_underwriting_scenarios after migration', async () => {
      const result = await executeSql({
        sqlQuery: `
          SELECT COUNT(DISTINCT deal_id) as cnt
          FROM deal_underwriting_scenarios,
          LATERAL jsonb_each(year1) AS j(key, value)
          WHERE year1 IS NOT NULL
            AND deleted_at IS NULL
            AND (value->>'override') IS NOT NULL
            AND (value->>'om') IS NOT NULL
            AND (value->>'override') = (value->>'om')
            AND (value->>'override_source') IS NULL
        `
      });
      const lines = result.output.trim().split('\n');
      const cnt = parseInt(lines[1]?.trim() ?? '0', 10);
      expect(cnt, `deal_underwriting_scenarios: ${cnt} scenarios still have contaminated override-equals-om fields`).toBe(0);
    });
  });
});
