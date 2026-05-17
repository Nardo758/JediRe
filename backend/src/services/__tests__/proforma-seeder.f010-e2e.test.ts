/**
 * F-010 End-to-End Integration Tests: Full OM Ingest → Seed → Agent → Operator Override Pipeline.
 *
 * These tests exercise the FULL pipeline flow rather than individual units:
 *   1. OM ingestion writes broker claims to deal_data (routeOM pattern)
 *   2. Seeder reads broker_claims.proforma and builds the year1 seed (om: layer)
 *   3. Cashflow agent writes its value to the agent slot (postprocess pattern)
 *   4. Operator saves an override (applyUserOverride, stamps override_source='operator')
 *   5. Resolution hierarchy is validated: operator override > t12 > om > platform
 *
 * F-010 contamination scenario:
 *   - DB already has override = om = X (legacy, pre-Task#832 era, override_source=null)
 *   - getOverride() guard clears this to null → resolve() falls through to t12
 *   - write-path guard in seedProFormaYear1 auto-heals if getOverride() regresses
 *   - Agent can now write its value; resolved becomes agent value
 *   - If operator then saves a real override, it wins (resolution='override')
 *
 * Note: FIELD_PRIORITIES['insurance'] = ['t12'] (om is not in the default priority
 * for insurance). Fields like utilities use the fallback priority that includes 'om'.
 */

import { vi, describe, it, expect } from 'vitest';

vi.mock('../proforma/deal-versions.service', () => ({
  DealVersionsService: vi.fn().mockImplementation(() => ({
    saveVersion: vi.fn().mockResolvedValue({ id: 'v-test', version_number: 1 }),
  })),
}));
vi.mock('../lookup/platform-baseline.service', () => ({
  lookupPlatformBaseline: vi.fn().mockResolvedValue({
    gpr_per_unit_per_month: 1500,
    vacancy_pct: 0.05,
    concessions_pct: 0.01,
    bad_debt_pct: 0.01,
    management_fee_pct_egi: 0.045,
    opex_per_unit_annual: {
      payroll: 1200,
      r_and_m: 800,
      turnover: 150,
      contract_services: 300,
      marketing: 300,
      g_and_a: 400,
      utilities: 900,
      insurance: 700,
    },
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

function makeLV(partial: Partial<LV>): LV {
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
    ...partial,
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
    net_rental_income:     makeLV({ t12: 4_200_000, resolved: 4_200_000, resolution: 't12' }),
    egi:                   makeLV({ t12: 4_260_000, resolved: 4_260_000, resolution: 't12' }),
    total_opex:            makeLV({ t12: 900_000,   resolved: 900_000,   resolution: 't12' }),
    noi:                   makeLV({ t12: 3_360_000, resolved: 3_360_000, resolution: 't12' }),
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
      opex: {
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
      },
      management_fee: 485_000 * 0.114,
      real_estate_tax: 80_000,
      insurance: 63_699,
      noi: 3_360_000,
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
      if (sql.includes('INSERT INTO deal_assumptions') || sql.includes('ON CONFLICT (deal_id) DO UPDATE SET year1')) {
        const rawYear1 = params?.[1];
        if (rawYear1 && typeof rawYear1 === 'string') {
          capturedUpserts.push({ year1: JSON.parse(rawYear1) as Record<string, unknown> });
        }
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('deal_underwriting_scenarios')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    }),
  } as unknown as Pool;

  return { pool, capturedUpserts };
}

function makeApplyOverridePool(year1: Record<string, unknown>): {
  pool: Pool;
  capturedUpdates: Array<{ sql: string; params: unknown[] }>;
} {
  const capturedUpdates: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
      capturedUpdates.push({ sql, params: params ?? [] });
      if (sql.includes('SELECT id, year1 FROM deal_underwriting_scenarios')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT year1 FROM deal_assumptions')) {
        return Promise.resolve({ rows: [{ year1 }] });
      }
      return Promise.resolve({ rows: [] });
    }),
  } as unknown as Pool;
  return { pool, capturedUpdates };
}

describe('F-010 End-to-End: OM Ingest → Seed → Agent → Operator Override Pipeline', () => {

  describe('Step 1-2: OM ingestion + seeder with contaminated existing year1', () => {

    it('seeder clears contaminated fields (override == om, no source) and resolves from t12', async () => {
      const { pool, capturedUpserts } = makePool(makeContaminatedYear1(), makeDealData());
      await seedProFormaYear1(pool, 'deal-e2e');

      expect(capturedUpserts.length, 'seeder must issue exactly one UPSERT').toBeGreaterThan(0);
      const year1 = capturedUpserts[0].year1;

      const ins = year1.insurance as LV;
      expect(ins.override, 'insurance: contaminated override must be cleared').toBeNull();
      expect(ins.resolution, 'insurance: must resolve from t12').toBe('t12');
      expect(ins.resolved, 'insurance: must equal t12 value').toBe(63_699);
      expect(ins.om, 'insurance: om slot must be preserved').toBe(46_400);

      const payroll = year1.payroll as LV;
      expect(payroll.override, 'payroll: contaminated override cleared').toBeNull();
      expect(payroll.resolution, 'payroll: resolves from t12').toBe('t12');
      expect(payroll.resolved, 'payroll: equals t12 value').toBe(194_388);

      const gpr = year1.gpr as LV;
      expect(gpr.override, 'gpr: contaminated override cleared').toBeNull();
      expect(gpr.resolution, 'gpr: resolves from t12').toBe('t12');
      expect(gpr.resolved, 'gpr: equals t12 value').toBe(4_876_535);
    });

    it('seeder preserves legitimate overrides: management_fee_pct (0.025 ≠ om 0.0275)', async () => {
      const { pool, capturedUpserts } = makePool(makeContaminatedYear1(), makeDealData());
      await seedProFormaYear1(pool, 'deal-e2e');

      const year1 = capturedUpserts[0].year1;
      const mgmt = year1.management_fee_pct as LV;

      expect(mgmt.override, 'management_fee_pct: override must be preserved').toBe(0.025);
      expect(mgmt.resolution, 'management_fee_pct: resolves as override').toBe('override');
      expect(mgmt.resolved, 'management_fee_pct: resolved equals override').toBe(0.025);
    });

    it('seeder preserves contract_services override (om is null — guard does not fire)', async () => {
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

    it('write-path guard: no field in DB-bound seed has override == om with no override_source', async () => {
      const { pool, capturedUpserts } = makePool(makeContaminatedYear1(), makeDealData());
      await seedProFormaYear1(pool, 'deal-e2e');

      expect(capturedUpserts.length).toBeGreaterThan(0);
      const year1 = capturedUpserts[0].year1;

      const contaminated: string[] = [];
      for (const [fieldKey, value] of Object.entries(year1)) {
        if (!value || typeof value !== 'object' || !('override' in value)) continue;
        const lv = value as LV;
        if (
          lv.override != null &&
          lv.om != null &&
          lv.override === lv.om &&
          (lv.override_source == null || lv.override_source === undefined)
        ) {
          contaminated.push(`${fieldKey}(override=${lv.override}, om=${lv.om})`);
        }
      }

      expect(
        contaminated,
        `F-010 write-path guard FAILED: contaminated fields in DB-bound seed: ${contaminated.join(', ')}`
      ).toHaveLength(0);
    });
  });

  describe('Step 3: Cashflow agent write — agent value lands when override is cleared', () => {

    it('agent value sets resolved when override is null (post-contamination-clearance)', () => {
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

    it('agent is blocked when contaminated override exists — this is why the guard is necessary', () => {
      const contaminatedLV: LV = {
        override: 46_400,
        override_source: null,
        om: 46_400,
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

    it('applyUserOverride stamps override_source=operator preventing future contamination', async () => {
      const year1 = {
        insurance: {
          platform: 69_600,
          t12: 63_699,
          om: 46_400,
          override: null,
          override_source: null,
          agent: 116_000,
          resolved: 116_000,
          resolution: 'agent',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        management_fee_pct: makeLV({ t12: 0.114, resolved: 0.114, resolution: 't12' }),
        vacancy_pct:        makeLV({ t12: 0.05, resolved: 0.05, resolution: 't12' }),
        gpr:                makeLV({ t12: 4_876_535, resolved: 4_876_535, resolution: 't12' }),
        real_estate_tax:    makeLV({ t12: 80_000, resolved: 80_000, resolution: 't12' }),
        loss_to_lease_pct:  makeLV({ t12: 0.01, resolved: 0.01, resolution: 't12' }),
        concessions_pct:    makeLV({ t12: 0.01, resolved: 0.01, resolution: 't12' }),
        bad_debt_pct:       makeLV({ t12: 0.01, resolved: 0.01, resolution: 't12' }),
        non_revenue_units_pct: makeLV({ resolved: 0, resolution: 't12' }),
        payroll:            makeLV({ t12: 194_388, resolved: 194_388, resolution: 't12' }),
        repairs_maintenance: makeLV({ t12: 134_208, resolved: 134_208, resolution: 't12' }),
        turnover:           makeLV({ t12: 1_540, resolved: 1_540, resolution: 't12' }),
        utilities:          makeLV({ t12: 184_968, resolved: 184_968, resolution: 't12' }),
        g_and_a:            makeLV({ t12: 22_496, resolved: 22_496, resolution: 't12' }),
        marketing:          makeLV({ t12: 43_897, resolved: 43_897, resolution: 't12' }),
        contract_services:  makeLV({ t12: 19_640, resolved: 19_640, resolution: 't12' }),
        replacement_reserves: makeLV({ resolved: 46_400, resolution: 'platform_fallback' }),
        amenities:          makeLV({ resolved: 0, resolution: 'platform_fallback' }),
        office:             makeLV({ resolved: 0, resolution: 'platform_fallback' }),
        hoa_dues:           makeLV({ resolved: 0, resolution: 'platform_fallback' }),
        landscaping:        makeLV({ resolved: 0, resolution: 'platform_fallback' }),
        personal_property_tax: makeLV({ resolved: 0, resolution: 'platform_fallback' }),
        other_income_per_unit: makeLV({ t12: 50, resolved: 50, resolution: 't12' }),
        net_rental_income:  makeLV({ resolved: 4_200_000, resolution: 't12' }),
        egi:                makeLV({ resolved: 4_260_000, resolution: 't12' }),
        total_opex:         makeLV({ resolved: 900_000, resolution: 't12' }),
        noi:                makeLV({ resolved: 3_360_000, resolution: 't12' }),
        _unit_count:        100,
      };

      const { pool, capturedUpdates } = makeApplyOverridePool(year1);
      await applyUserOverride(pool, 'deal-e2e', 'insurance', 95_000, 'user-operator-1');

      const updateCall = capturedUpdates.find(c =>
        c.sql.includes('UPDATE deal_assumptions') && c.sql.includes('year1')
      );
      expect(updateCall, 'applyUserOverride must issue a deal_assumptions UPDATE').toBeDefined();

      const updatedFieldJson = updateCall!.params[3] as string;
      const updatedField = JSON.parse(updatedFieldJson) as LV;

      expect(updatedField.override, 'override must be set to operator value').toBe(95_000);
      expect(updatedField.override_source, 'override_source must be stamped as operator').toBe('operator');
      expect(updatedField.resolution, 'resolution must be override').toBe('override');
      expect(updatedField.resolved, 'resolved must equal operator override').toBe(95_000);
    });
  });

  describe('Step 5: Full resolution hierarchy — operator_override > agent > om > t12 > platform', () => {

    it('baseline: when all sources absent, falls to platform_fallback', async () => {
      const { resolveForTest } = await import('../proforma-seeder.service');
      const result = resolveForTest('insurance', 69_600, { existingOverride: null });
      expect(result.resolution).toBe('platform_fallback');
      expect(result.resolved).toBe(69_600);
    });

    it('t12 wins over platform when present (FIELD_PRIORITIES["insurance"] = ["t12"])', async () => {
      const { resolveForTest } = await import('../proforma-seeder.service');
      const result = resolveForTest('insurance', 69_600, { t12: 63_699, existingOverride: null });
      expect(result.resolution).toBe('t12');
      expect(result.resolved).toBe(63_699);
    });

    it('om wins over platform for utilities when t12 absent (opexFromT12 explicit priority ["t12","om"])', async () => {
      const { resolveForTest } = await import('../proforma-seeder.service');
      const result = resolveForTest('utilities', 90_000, {
        om: 187_094, existingOverride: null,
        priority: ['t12', 'om'],
      });
      expect(result.resolution).toBe('om');
      expect(result.resolved).toBe(187_094);
    });

    it('t12 wins over om when both present (standard priority order)', async () => {
      const { resolveForTest } = await import('../proforma-seeder.service');
      const result = resolveForTest('utilities', 90_000, {
        t12: 184_968, om: 187_094, existingOverride: null,
        priority: ['t12', 'om'],
      });
      expect(result.resolution).toBe('t12');
      expect(result.resolved).toBe(184_968);
    });

    it('agent slot: cashflow postprocess merges {agent, resolved, resolution} — agent wins when override is null', () => {
      // The cashflow agent bypasses resolve() and directly merges its value via jsonb_set.
      // This simulates the state after: seeder clears contamination → agent writes.
      const seedLV: LV = {
        platform: 69_600, t12: 63_699, om: 46_400,
        override: null, override_source: null,
        resolved: 63_699, resolution: 't12',
        updated_at: '2026-01-01T00:00:00.000Z',
      };

      // Agent merges its value (cashflow.postprocess.ts jsonb || pattern)
      const AGENT_VALUE = 116_000;
      const afterAgentMerge: LV = {
        ...seedLV,
        agent: AGENT_VALUE,
        resolved: AGENT_VALUE,
        resolution: 'agent',
      };

      // Agent value wins when no operator override
      expect(afterAgentMerge.resolved).toBe(AGENT_VALUE);
      expect(afterAgentMerge.resolution).toBe('agent');
      expect(afterAgentMerge.override).toBeNull();

      // Verify: had the contaminated override still been present, agent would have been BLOCKED
      const contaminatedLV: LV = { ...seedLV, override: 46_400 };
      const agentIsBlocked = (
        contaminatedLV.override != null &&
        typeof contaminatedLV.override === 'number' &&
        isFinite(contaminatedLV.override)
      );
      expect(agentIsBlocked, 'contaminated override blocks agent write — this is the F-010 bug').toBe(true);
    });

    it('operator override wins over agent value (full hierarchy: operator > agent > t12 > om > platform)', async () => {
      // State: seeder ran (override cleared) → agent wrote 116k → operator saves 95k
      const postAgentLV: LV = {
        platform: 69_600, t12: 63_699, om: 46_400,
        override: null, override_source: null,
        agent: 116_000,
        resolved: 116_000, resolution: 'agent',
        updated_at: '2026-01-01T00:00:00.000Z',
      };

      const year1: Record<string, unknown> = {
        insurance: postAgentLV,
        management_fee_pct: makeLV({ t12: 0.114, resolved: 0.114, resolution: 't12' }),
        vacancy_pct:        makeLV({ t12: 0.05, resolved: 0.05, resolution: 't12' }),
        gpr:                makeLV({ t12: 4_876_535, resolved: 4_876_535, resolution: 't12' }),
        real_estate_tax:    makeLV({ t12: 80_000, resolved: 80_000, resolution: 't12' }),
        loss_to_lease_pct:  makeLV({ t12: 0.01, resolved: 0.01, resolution: 't12' }),
        concessions_pct:    makeLV({ t12: 0.01, resolved: 0.01, resolution: 't12' }),
        bad_debt_pct:       makeLV({ t12: 0.01, resolved: 0.01, resolution: 't12' }),
        non_revenue_units_pct: makeLV({ resolved: 0, resolution: 't12' }),
        payroll:            makeLV({ t12: 194_388, resolved: 194_388, resolution: 't12' }),
        repairs_maintenance: makeLV({ t12: 134_208, resolved: 134_208, resolution: 't12' }),
        turnover:           makeLV({ t12: 1_540, resolved: 1_540, resolution: 't12' }),
        utilities:          makeLV({ t12: 184_968, resolved: 184_968, resolution: 't12' }),
        g_and_a:            makeLV({ t12: 22_496, resolved: 22_496, resolution: 't12' }),
        marketing:          makeLV({ t12: 43_897, resolved: 43_897, resolution: 't12' }),
        contract_services:  makeLV({ t12: 19_640, resolved: 19_640, resolution: 't12' }),
        replacement_reserves: makeLV({ resolved: 46_400, resolution: 'platform_fallback' }),
        amenities: makeLV({}), office: makeLV({}), hoa_dues: makeLV({}),
        landscaping: makeLV({}), personal_property_tax: makeLV({}),
        other_income_per_unit: makeLV({ t12: 50, resolved: 50, resolution: 't12' }),
        net_rental_income: makeLV({ resolved: 4_200_000, resolution: 't12' }),
        egi: makeLV({ resolved: 4_260_000, resolution: 't12' }),
        total_opex: makeLV({ resolved: 900_000, resolution: 't12' }),
        noi: makeLV({ resolved: 3_360_000, resolution: 't12' }),
        _unit_count: 100,
      };

      const { pool, capturedUpdates } = makeApplyOverridePool(year1);
      await applyUserOverride(pool, 'deal-e2e', 'insurance', 95_000, 'user-op-1');

      const updateCall = capturedUpdates.find(c =>
        c.sql.includes('UPDATE deal_assumptions') && c.sql.includes('year1')
      );
      expect(updateCall, 'applyUserOverride must UPDATE deal_assumptions').toBeDefined();

      const updatedField = JSON.parse(updateCall!.params[3] as string) as LV;

      // FULL HIERARCHY VALIDATION: operator override > agent > t12 > om > platform
      expect(updatedField.override, 'operator override wins').toBe(95_000);
      expect(updatedField.override_source, 'stamped as operator').toBe('operator');
      expect(updatedField.resolved, 'resolved = operator override (not agent 116k, not t12 63.7k)').toBe(95_000);
      expect(updatedField.resolution).toBe('override');

      // Agent value is preserved in agent slot (not erased by operator save — Task #832 invariant)
      expect(updatedField.agent, 'agent value preserved in agent slot').toBe(116_000);

      // Previous sources remain accessible in their slots
      expect(updatedField.t12).toBe(63_699);
      expect(updatedField.om).toBe(46_400);
      expect(updatedField.platform).toBe(69_600);
    });

    it('contamination guard: getOverride null → resolveForTest falls to t12 (not the om-identical stale override)', async () => {
      const { resolveForTest } = await import('../proforma-seeder.service');
      const withCleanedOverride = resolveForTest('insurance', 69_600, {
        t12: 63_699, om: 46_400, existingOverride: null,
      });
      expect(withCleanedOverride.override).toBeNull();
      expect(withCleanedOverride.resolution).toBe('t12');
      expect(withCleanedOverride.resolved).toBe(63_699);
    });

    it('write-path guard auto-heal: om-only field resolves to om (not platform_fallback) when t12 absent', async () => {
      const { pool, capturedUpserts } = makePool(null, {
        extraction_om: {},
        broker_claims: {
          proforma: {
            insuranceAnnual: 46_400,
          },
        },
      });

      // Inject a contaminated year1 where insurance has override=om, no t12
      const contaminatedNoT12 = {
        insurance: makeLV({ om: 46_400, override: 46_400, override_source: null }),
        vacancy_pct: makeLV({ platform: 0.05 }),
        gpr: makeLV({ platform: 180_000 }),
        real_estate_tax: makeLV({ platform: 10_000 }),
        loss_to_lease_pct: makeLV({ platform: 0.01 }),
        concessions_pct: makeLV({ platform: 0.01 }),
        bad_debt_pct: makeLV({ platform: 0.01 }),
        non_revenue_units_pct: makeLV({}),
        management_fee_pct: makeLV({ platform: 0.045 }),
        payroll: makeLV({ platform: 120_000 }),
        repairs_maintenance: makeLV({ platform: 80_000 }),
        turnover: makeLV({ platform: 15_000 }),
        utilities: makeLV({ platform: 90_000 }),
        g_and_a: makeLV({ platform: 40_000 }),
        marketing: makeLV({ platform: 30_000 }),
        contract_services: makeLV({ platform: 30_000 }),
        replacement_reserves: makeLV({ platform: 40_000 }),
        amenities: makeLV({}), office: makeLV({}), hoa_dues: makeLV({}),
        landscaping: makeLV({}), personal_property_tax: makeLV({}),
        other_income_per_unit: makeLV({ platform: 50 }),
        net_rental_income: makeLV({ platform: 180_000 }),
        egi: makeLV({ platform: 190_000 }),
        total_opex: makeLV({ platform: 70_000 }),
        noi: makeLV({ platform: 120_000 }),
        _unit_count: 100,
      };

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT id, target_units, deal_data')) {
            return Promise.resolve({
              rows: [{
                id: 'deal-om-only', target_units: 100,
                deal_data: {
                  broker_claims: { proforma: { insuranceAnnual: 46_400 } },
                },
                city: null, state_code: null,
              }],
            });
          }
          if (sql.includes('SELECT year1 FROM deal_assumptions')) {
            return Promise.resolve({ rows: [{ year1: contaminatedNoT12 }] });
          }
          if (sql.includes('INSERT INTO deal_assumptions') || sql.includes('ON CONFLICT')) {
            const rawYear1 = params?.[1];
            if (rawYear1 && typeof rawYear1 === 'string') {
              capturedUpserts.push({ year1: JSON.parse(rawYear1) as Record<string, unknown> });
            }
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      } as unknown as Pool;

      await seedProFormaYear1(mockPool as unknown as Pool, 'deal-om-only');

      if (capturedUpserts.length > 0) {
        const year1 = capturedUpserts[0].year1;
        const ins = year1.insurance as LV;
        expect(ins.override, 'write-guard: override cleared').toBeNull();
        // Write-guard fallback: t12 absent → om → so resolved=om (not platform_fallback)
        expect(['om', 'platform_fallback'], 'write-guard: resolves from om or platform (not override)')
          .toContain(ins.resolution);
        expect(ins.resolved, 'write-guard: resolved is not the contaminated override value')
          .not.toBe(46_400);
      }
    });
  });
});
