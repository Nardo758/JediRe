/**
 * Task #839 — Agent sub-key preservation regression test
 *
 * Guards the invariant added by Task #832:
 *   applyUserOverride MUST use per-field jsonb sub-key merge, NOT full-replace.
 *   If the full-replace pattern is ever reintroduced, every operator save would
 *   silently erase all Cashflow Agent values (resolution='agent') from every
 *   field in year1 — not just the field being saved.
 *
 * Scenario:
 *   1. Deal has year1 where insurance.agent = 125_280 and resolution = 'agent'
 *      (i.e., the Cashflow Agent has run and written its insurance estimate).
 *   2. Operator saves an override on a DIFFERENT field: vacancy_pct → 0.12.
 *   3. After the save, insurance.agent MUST still be 125_280.
 *
 * Coverage:
 *   - deal_assumptions fallback path (no active M40 scenario)   ← primary path
 *   - deal_underwriting_scenarios active-scenario path (M40)    ← scenario path
 *
 * Because the real SQL (`COALESCE(year1 #> path, '{}') || $4::jsonb`) cannot
 * be executed in a mock environment, the test:
 *   (a) Captures the raw params passed to the UPDATE query.
 *   (b) Simulates the DB-side JSONB merge in JavaScript.
 *   (c) Asserts on the simulated result — which is exactly what a real PG
 *       execution would produce.
 *
 * NOTE — Integration test gap (flagged by code review):
 *   These are mock-driven unit tests; they do not execute real PostgreSQL JSONB
 *   operations against a live database.  The JS simulateMerge() replicates PG
 *   JSONB merge semantics faithfully, but a pg-backed integration test that
 *   issues the real UPDATE and re-reads year1 would provide deeper confidence.
 *   That is tracked as a follow-up (Task #861 — CI validation step).
 *
 * Additional assertions lock the structural properties that MAKE the SQL safe:
 *   - derivedUpdate (Layer A) must not include non-derived fields.
 *   - fieldForDb (Layer B) must not include an `agent` sub-key (because the
 *     agent sub-key is written only by cashflow.postprocess.ts; if it ever
 *     appeared here it would overwrite the DB's agent value on the target field).
 *   - The SQL pattern must be a jsonb_set sub-key merge, not SET year1 = $full.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyUserOverride } from '../services/proforma-seeder.service';

// ── Suppress version snapshot (non-fatal side-effect, not under test) ─────────
vi.mock('../services/proforma/deal-versions.service', () => ({
  DealVersionsService: class {
    saveVersion = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal LayeredValue. `agent` key is omitted entirely when not supplied. */
function makeLv(opts: {
  t12?:       number | null;
  platform?:  number | null;
  agent?:     number;
  override?:  number | null;
  resolved:   number;
  resolution: string;
}) {
  const lv: Record<string, unknown> = {
    t12:        opts.t12      ?? null,
    rent_roll:  null,
    om:         null,
    platform:   opts.platform ?? null,
    override:   opts.override ?? null,
    resolved:   opts.resolved,
    resolution: opts.resolution,
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  // Only include agent key when a value is provided — absent key is the
  // "not yet written by agent" state; null would falsely indicate agent ran.
  if (opts.agent !== undefined) {
    lv.agent = opts.agent;
  }
  return lv;
}

/**
 * Build a realistic year1 seed that includes:
 *   - vacancy_pct without an agent value (the field being overridden by the operator)
 *   - insurance WITH an agent value (the field that must NOT be erased)
 *   - all other fields needed by recomputeDerived
 */
function makeYear1() {
  return {
    _unit_count: 100,

    // Revenue
    gpr:                   makeLv({ t12: 1_200_000, resolved: 1_200_000, resolution: 't12' }),
    loss_to_lease_pct:     makeLv({ t12: 0.02,      resolved: 0.02,      resolution: 't12' }),
    vacancy_pct:           makeLv({ t12: 0.08,      resolved: 0.08,      resolution: 't12' }),
    concessions_pct:       makeLv({ t12: 0.01,      resolved: 0.01,      resolution: 't12' }),
    non_revenue_units_pct: makeLv({ resolved: 0.01, resolution: 'platform_fallback' }),
    bad_debt_pct:          makeLv({ t12: 0.005,     resolved: 0.005,     resolution: 't12' }),
    management_fee_pct:    makeLv({ t12: 0.04,      resolved: 0.04,      resolution: 't12' }),
    other_income_per_unit: makeLv({ resolved: 50,   resolution: 'platform_fallback' }),

    other_income_breakdown: {
      parking:         makeLv({ resolved: 24_000, resolution: 'om' }),
      pet:             makeLv({ resolved: 6_000,  resolution: 'om' }),
      storage:         makeLv({ resolved: 3_600,  resolution: 'om' }),
      rubs:            makeLv({ resolved: 0,      resolution: 'om' }),
      laundry:         makeLv({ resolved: 0,      resolution: 'om' }),
      fees:            makeLv({ resolved: 0,      resolution: 'om' }),
      insurance_admin: makeLv({ resolved: 0,      resolution: 'om' }),
      other:           makeLv({ resolved: 1_400,  resolution: 'om' }),
    },

    // OpEx (most are t12-sourced; insurance is agent-sourced — the field under test)
    payroll:              makeLv({ t12: 180_000, resolved: 180_000, resolution: 't12' }),
    repairs_maintenance:  makeLv({ t12: 60_000,  resolved: 60_000,  resolution: 't12' }),
    turnover:             makeLv({ t12: 15_000,  resolved: 15_000,  resolution: 't12' }),
    contract_services:    makeLv({ t12: 12_000,  resolved: 12_000,  resolution: 't12' }),
    marketing:            makeLv({ t12: 8_000,   resolved: 8_000,   resolution: 't12' }),
    utilities:            makeLv({ t12: 48_000,  resolved: 48_000,  resolution: 't12' }),
    g_and_a:              makeLv({ t12: 20_000,  resolved: 20_000,  resolution: 't12' }),
    hoa_dues:             makeLv({ resolved: 0,  resolution: 'platform_fallback' }),
    real_estate_tax:      makeLv({ t12: 90_000,  resolved: 90_000,  resolution: 't12' }),
    personal_property_tax:makeLv({ resolved: 0,  resolution: 'platform_fallback' }),
    amenities:            makeLv({ t12: 5_000,   resolved: 5_000,   resolution: 't12' }),
    office:               makeLv({ resolved: 0,  resolution: 'platform_fallback' }),

    // ── The field under test: Cashflow Agent wrote insurance ──────────────────
    // agent: 125_280 means the AI-derived annual insurance cost.
    // resolution: 'agent' means the agent's value is currently winning.
    // This sub-key MUST survive an applyUserOverride call on any other field.
    insurance: makeLv({
      t12:       110_000,   // t12 value present but agent is winning
      platform:    48_000,  // platform fallback also present
      agent:      125_280,  // ← Cashflow Agent wrote this
      resolved:   125_280,  // agent wins
      resolution: 'agent',  // ← must survive the override
    }),

    // Derived (recomputeDerived mutates these in-place)
    net_rental_income: makeLv({ resolved: 0, resolution: 'platform_fallback' }),
    egi:               makeLv({ resolved: 0, resolution: 'platform_fallback' }),
    total_opex:        makeLv({ resolved: 0, resolution: 'platform_fallback' }),
    noi:               makeLv({ resolved: 0, resolution: 'platform_fallback' }),
  };
}

// ── Mock pool factory ─────────────────────────────────────────────────────────

interface CapturedUpdate {
  sql:           string;
  dealId:        string;
  parts:         string[];
  derivedUpdate: Record<string, unknown>;
  fieldForDb:    Record<string, unknown>;
}

/**
 * Returns a mock PG pool and a `getCaptured()` accessor.
 *
 * IMPORTANT: `getCaptured()` must be called AFTER `applyUserOverride` completes —
 * not at destructure time — so the closure has been populated by the UPDATE call.
 */
function makePool(year1: Record<string, unknown>): {
  pool:         { query: ReturnType<typeof vi.fn> };
  getCaptured:  () => CapturedUpdate | undefined;
} {
  let capturedUpdate: CapturedUpdate | undefined;

  const pool = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      // M40: scenarios SELECT — return empty so the path falls back to deal_assumptions
      if (sql.includes('deal_underwriting_scenarios')) {
        return { rows: [] };
      }
      // Primary year1 read (SELECT year1 FROM deal_assumptions)
      if (sql.includes('SELECT year1')) {
        return { rows: [{ year1 }] };
      }
      // Capture the UPDATE params for assertions.
      // SQL signature (Task #832 per-field merge):
      //   UPDATE deal_assumptions SET year1 = jsonb_set(year1 || $3::jsonb, $2::text[],
      //     COALESCE(...) || $4::jsonb, true) WHERE deal_id = $1
      // params[0] = dealId, params[1] = parts[], params[2] = derivedUpdateJson, params[3] = fieldForDbJson
      if (sql.includes('UPDATE deal_assumptions')) {
        capturedUpdate = {
          sql,
          dealId:        params![0] as string,
          parts:         params![1] as string[],
          derivedUpdate: JSON.parse(params![2] as string),
          fieldForDb:    JSON.parse(params![3] as string),
        };
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };

  return { pool, getCaptured: () => capturedUpdate };
}

/**
 * Variant pool for the M40 active-underwriting-scenario path.
 *
 * Returns `{ rows: [{ id: scenarioId, year1 }] }` for the scenarios SELECT so
 * applyUserOverride takes the `activeScenarioId` branch and issues the UPDATE
 * against `deal_underwriting_scenarios` instead of `deal_assumptions`.
 *
 * Params order is identical to the deal_assumptions path:
 *   [scenarioId, parts[], derivedUpdateJson, fieldForDbJson]
 */
function makeScenarioPool(
  year1: Record<string, unknown>,
  scenarioId = 'scenario-test-001',
): {
  pool:        { query: ReturnType<typeof vi.fn> };
  getCaptured: () => CapturedUpdate | undefined;
} {
  let capturedUpdate: CapturedUpdate | undefined;

  const pool = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      // M40: scenarios SELECT — return an active scenario so the scenario branch fires
      if (sql.includes('deal_underwriting_scenarios') && sql.includes('SELECT')) {
        return { rows: [{ id: scenarioId, year1 }] };
      }
      // Capture the scenarios UPDATE
      if (sql.includes('UPDATE deal_underwriting_scenarios')) {
        capturedUpdate = {
          sql,
          dealId:        params![0] as string,
          parts:         params![1] as string[],
          derivedUpdate: JSON.parse(params![2] as string),
          fieldForDb:    JSON.parse(params![3] as string),
        };
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };

  return { pool, getCaptured: () => capturedUpdate };
}

// ── DB-side JSONB merge simulator ─────────────────────────────────────────────
/**
 * Replicates the PostgreSQL UPDATE expression from applyUserOverride:
 *
 *   year1 = jsonb_set(
 *     year1 || $derivedUpdate,          ← Layer A: derived fields top-level merge
 *     $parts,
 *     COALESCE(year1 #> $parts, '{}')   ← existing field sub-keys (incl. agent)
 *       || $fieldForDb,                 ← Layer B: new override sub-keys
 *     true
 *   )
 *
 * The agent sub-key on `insurance` survives because:
 *   - insurance is absent from derivedUpdate → Layer A doesn't touch it
 *   - insurance is NOT the target field → Layer B doesn't touch it
 *   - The final year1.insurance = original year1.insurance (unchanged)
 */
function simulateMerge(
  originalYear1: Record<string, unknown>,
  captured: CapturedUpdate,
): Record<string, unknown> {
  // Layer A: top-level merge — derived fields overwrite their counterparts in year1.
  const afterDerived = { ...originalYear1, ...captured.derivedUpdate };

  // Layer B: sub-key merge on the target field only.
  // COALESCE(year1 #> parts, '{}') = the existing DB field object (has agent key).
  // || fieldForDb = merge the new override sub-keys on top.
  // The agent sub-key is NOT in fieldForDb, so it survives from the existing object.
  const targetKey = captured.parts[0];
  const existingTarget = (afterDerived[targetKey] ?? {}) as Record<string, unknown>;
  afterDerived[targetKey] = { ...existingTarget, ...captured.fieldForDb };

  return afterDerived;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyUserOverride — agent sub-key preservation (Task #839 regression)', () => {
  const DEAL_ID         = 'test-deal-agent-839';
  const USER_ID         = 'test-user-839';
  const AGENT_INSURANCE = 125_280;

  // ── Core invariant ──────────────────────────────────────────────────────────

  describe('core invariant: insurance.agent survives vacancy_pct override', () => {
    let captured: CapturedUpdate;
    let finalYear1: Record<string, unknown>;
    let baseYear1: Record<string, unknown>;

    beforeEach(async () => {
      baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      const { pool, getCaptured } = makePool(baseYear1);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

      const c = getCaptured();
      expect(c, 'UPDATE was not issued — applyUserOverride may have thrown').toBeDefined();
      captured = c!;
      finalYear1 = simulateMerge(baseYear1, captured);
    });

    it('insurance.agent is still 125_280 after the simulated DB merge', () => {
      const ins = finalYear1.insurance as Record<string, unknown>;
      expect(ins.agent).toBe(AGENT_INSURANCE);
    });

    it('insurance.resolution remains "agent" (the AI badge is preserved)', () => {
      const ins = finalYear1.insurance as Record<string, unknown>;
      expect(ins.resolution).toBe('agent');
    });

    it('insurance is NOT present in derivedUpdate (Layer A must not touch it)', () => {
      expect(captured.derivedUpdate).not.toHaveProperty('insurance');
    });

    it('insurance is NOT present in fieldForDb (Layer B only targets vacancy_pct)', () => {
      expect(captured.fieldForDb).not.toHaveProperty('insurance');
    });
  });

  // ── fieldForDb (Layer B) correctness ───────────────────────────────────────

  describe('fieldForDb (Layer B — the target field written to DB) correctness', () => {
    let captured: CapturedUpdate;
    let baseYear1: Record<string, unknown>;

    beforeEach(async () => {
      baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      const { pool, getCaptured } = makePool(baseYear1);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

      captured = getCaptured()!;
    });

    it('fieldForDb does NOT contain an agent sub-key for the target field', () => {
      // If `agent` were included in fieldForDb, the DB-side || merge would
      // OVERWRITE any existing agent value on vacancy_pct — defeating Task #832.
      expect(captured.fieldForDb).not.toHaveProperty('agent');
    });

    it('fieldForDb contains the new override value', () => {
      expect(captured.fieldForDb.override).toBe(0.12);
    });

    it('fieldForDb carries resolution = "override"', () => {
      expect(captured.fieldForDb.resolution).toBe('override');
    });

    it('fieldForDb carries override_source = "operator"', () => {
      expect(captured.fieldForDb.override_source).toBe('operator');
    });

    it('target field (vacancy_pct) has correct override in final simulated state', () => {
      const finalYear1 = simulateMerge(baseYear1, captured);
      const vac = finalYear1.vacancy_pct as Record<string, unknown>;
      expect(vac.override).toBe(0.12);
      expect(vac.resolution).toBe('override');
    });
  });

  // ── derivedUpdate (Layer A) whitelist ──────────────────────────────────────

  describe('derivedUpdate (Layer A) whitelist — only derived fields are included', () => {
    const DERIVED_FIELDS = new Set([
      'net_rental_income', 'egi', 'total_opex', 'noi',
      'other_income_per_unit', 'noi_per_unit',
    ]);
    const NON_DERIVED = [
      'payroll', 'insurance', 'real_estate_tax', 'gpr',
      'vacancy_pct', 'repairs_maintenance', 'utilities',
    ];

    let captured: CapturedUpdate;

    beforeEach(async () => {
      const baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      const { pool, getCaptured } = makePool(baseYear1);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

      captured = getCaptured()!;
    });

    it('derivedUpdate contains only recognised derived fields', () => {
      for (const key of Object.keys(captured.derivedUpdate)) {
        expect(DERIVED_FIELDS.has(key),
          `unexpected field "${key}" found in derivedUpdate`).toBe(true);
      }
    });

    it.each(NON_DERIVED)('derivedUpdate does not contain "%s"', (field) => {
      expect(captured.derivedUpdate).not.toHaveProperty(field);
    });
  });

  // ── SQL structure guard ────────────────────────────────────────────────────

  describe('SQL structure guard — jsonb_set sub-key merge, not full-replace', () => {
    let capturedSql: string;

    beforeEach(async () => {
      const baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      const { pool, getCaptured } = makePool(baseYear1);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

      capturedSql = getCaptured()!.sql;
    });

    it('UPDATE SQL uses jsonb_set (sub-key merge)', () => {
      expect(capturedSql).toMatch(/jsonb_set/i);
    });

    it('UPDATE SQL preserves existing field via COALESCE sub-path read', () => {
      // COALESCE(year1 #> ...) reads the DB's current field value (incl. agent)
      // before merging the new override on top — the key safety mechanism.
      expect(capturedSql).toMatch(/COALESCE/i);
    });

    it('UPDATE SQL does NOT use the old full-replace pattern (SET year1 = $2::jsonb)', () => {
      // This is the exact pattern from the pre-Task-#832 bug that erased agent values.
      expect(capturedSql).not.toMatch(/SET year1\s*=\s*\$2::jsonb/i);
    });
  });

  // ── Clearing an override ───────────────────────────────────────────────────

  describe('clearing an override (value=null) also preserves insurance.agent', () => {
    it('insurance.agent survives when vacancy_pct override is cleared', async () => {
      const baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      // Pre-seed a vacancy_pct override so the clear has something to remove.
      const vac = baseYear1.vacancy_pct as Record<string, unknown>;
      vac.override   = 0.15;
      vac.resolution = 'override';

      const { pool, getCaptured } = makePool(baseYear1);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', null, USER_ID);

      const captured = getCaptured();
      expect(captured, 'UPDATE was not issued during clear').toBeDefined();

      const finalYear1 = simulateMerge(baseYear1, captured!);
      const ins = finalYear1.insurance as Record<string, unknown>;

      expect(ins.agent).toBe(AGENT_INSURANCE);
      expect(ins.resolution).toBe('agent');
    });
  });

  // ── Spot-check other agent-written fields ──────────────────────────────────

  describe('agent values on other OpEx fields are similarly protected', () => {
    const AGENT_FIELDS = [
      { field: 'payroll',         agentVal: 195_000 },
      { field: 'real_estate_tax', agentVal: 97_500  },
      { field: 'utilities',       agentVal: 51_200  },
    ] as const;

    it.each(AGENT_FIELDS)(
      '$field — agent value $agentVal is preserved when vacancy_pct is overridden',
      async ({ field, agentVal }) => {
        const baseYear1 = makeYear1() as unknown as Record<string, unknown>;

        // Write an agent value onto this field to simulate post-Cashflow-Agent state.
        const lv = baseYear1[field] as Record<string, unknown>;
        lv.agent      = agentVal;
        lv.resolved   = agentVal;
        lv.resolution = 'agent';

        const { pool, getCaptured } = makePool(baseYear1);
        await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

        const captured = getCaptured();
        expect(captured, `UPDATE not issued (field: ${field})`).toBeDefined();

        const finalYear1 = simulateMerge(baseYear1, captured!);
        const targetLv = finalYear1[field] as Record<string, unknown>;

        expect(targetLv.agent,      `${field}.agent was erased`).toBe(agentVal);
        expect(targetLv.resolution, `${field}.resolution changed`).toBe('agent');
      },
    );
  });

  // ── M40 active-scenario path (deal_underwriting_scenarios) ────────────────
  // applyUserOverride writes to the active underwriting scenario when one exists
  // (M40 feature).  The same JSONB sub-key merge is used, so agent sub-keys must
  // be equally preserved through that code path.

  describe('M40 active-scenario path — insurance.agent survives via deal_underwriting_scenarios UPDATE', () => {
    const SCENARIO_ID = 'scenario-test-839';

    it('UPDATE targets deal_underwriting_scenarios (not deal_assumptions)', async () => {
      const baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      const { pool, getCaptured } = makeScenarioPool(baseYear1, SCENARIO_ID);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

      const captured = getCaptured();
      expect(captured, 'UPDATE was not issued — scenario path may have failed').toBeDefined();
      expect(captured!.sql).toMatch(/UPDATE deal_underwriting_scenarios/i);
    });

    it('insurance.agent is preserved when writing via the scenario path', async () => {
      const baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      const { pool, getCaptured } = makeScenarioPool(baseYear1, SCENARIO_ID);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

      const captured = getCaptured()!;
      const finalYear1 = simulateMerge(baseYear1, captured);
      const ins = finalYear1.insurance as Record<string, unknown>;

      expect(ins.agent).toBe(AGENT_INSURANCE);
      expect(ins.resolution).toBe('agent');
    });

    it('scenario-path UPDATE SQL uses jsonb_set sub-key merge (not full-replace)', async () => {
      const baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      const { pool, getCaptured } = makeScenarioPool(baseYear1, SCENARIO_ID);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

      const { sql } = getCaptured()!;
      expect(sql).toMatch(/jsonb_set/i);
      expect(sql).toMatch(/COALESCE/i);
      expect(sql).not.toMatch(/SET year1\s*=\s*\$2::jsonb/i);
    });

    it('fieldForDb written to scenario does NOT contain agent sub-key', async () => {
      const baseYear1 = makeYear1() as unknown as Record<string, unknown>;
      const { pool, getCaptured } = makeScenarioPool(baseYear1, SCENARIO_ID);

      await applyUserOverride(pool as never, DEAL_ID, 'vacancy_pct', 0.12, USER_ID);

      expect(getCaptured()!.fieldForDb).not.toHaveProperty('agent');
    });
  });
});
