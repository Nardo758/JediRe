/**
 * Task #1364 — CashFlow Agent sub-field writeback integration test
 *
 * Exercises cashflowPostProcess() directly against the real PostgreSQL database
 * with a mocked LLM response containing pre_renovation / post_stabilization sub-fields
 * for Repairs & Maintenance, Marketing, and Contract Services.
 *
 * Covers:
 *   1. All 6 target keys written to deal_underwriting_scenarios.year1 ✓
 *   2. Low-confidence post_stabilization correctly rejected ✓
 *   3. Non-numeric sub-field value correctly skipped ✓
 *   4. Contract Services sub-fields written when note signals new pool/elevator/parking ✓
 *   5. regimeDataByField pattern: year1Seed[`${year1Key}__pre_renovation`] readable ✓
 *
 * Non-DB dependencies are mocked; the database layer (query) is real.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// ── Mock non-DB service dependencies ─────────────────────────────────────────
vi.mock('../../services/operatorStance.service', () => ({
  getStanceForDeal: vi.fn().mockResolvedValue({
    underwritingPosture: 'base',
    rateEnvironment: 'stable',
    cyclePosition: 'mid',
    expenseGrowthPosture: 'base',
    defaulted: true,
  }),
  applyStanceToProformaFields: vi.fn().mockReturnValue([]),
  applyStanceReblend: vi.fn().mockResolvedValue(undefined),
  suggestAgentInferredStance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/proforma/proFormaMathEngine', () => ({
  correctSnapshotMath: vi.fn().mockReturnValue({
    corrected_snapshot: null,
    validation_report: { field_count: 0, corrections: [] },
    was_corrected: false,
  }),
}));

vi.mock('../../services/sigma/sigma-engine', () => ({
  VARIABLE_META: {},
}));

vi.mock('../../services/hold-period-profiles', () => ({
  ABSOLUTE_MAX_HOLD_YEARS: 30,
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── After mocks: import real modules ─────────────────────────────────────────
import { query } from '../../database/connection';
import { cashflowPostProcess } from '../cashflow.postprocess';
import type { RunContext } from '../runtime/types';

// ── Test deal (uses existing [CS-AUDIT] Value-Add Test deal) ─────────────────
const BASE_DEAL_ID = '1daab29b-e586-41bc-9338-eba72f202abd';
let TEST_SCENARIO_ID: string | null = null;
const TEST_RUN_ID   = '00001364-1111-0000-0000-000000000001';

async function createTestScenario(): Promise<string> {
  // Clean up any leftover scenario from prior run
  await query(
    `DELETE FROM deal_underwriting_scenarios
     WHERE deal_id = $1 AND name = 'Task-1364 integration test'`,
    [BASE_DEAL_ID],
  );

  const res = await query(
    `INSERT INTO deal_underwriting_scenarios
       (deal_id, is_active, year1, deleted_at, name, created_by)
     VALUES ($1, TRUE, '{}', NULL, 'Task-1364 integration test', 'agent')
     RETURNING id`,
    [BASE_DEAL_ID],
  );
  return res.rows[0].id as string;
}

async function cleanupTestScenario(): Promise<void> {
  if (TEST_SCENARIO_ID) {
    await query(
      `DELETE FROM deal_underwriting_scenarios WHERE id = $1`,
      [TEST_SCENARIO_ID],
    );
    TEST_SCENARIO_ID = null;
  }
}

// ── Synthetic agent output (what Claude would produce for a value-add deal) ──
function buildAgentOutput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    proforma_fields: {
      'expense.repairs_maintenance': {
        value: 52000,
        source: 'agent:cashflow',
        evidence: {
          source_tier: 1,
          source_label: 'T12 actuals',
          confidence: 'high',
          derivation_chain: ['T12 R&M $87k → remove one-time HVAC replace → post-reno rate $52k'],
        },
        pre_renovation: {
          value: 87000,
          confidence: 'high',
          source: 'tier1:t12',
          note: 'T12 R&M reflects aging systems pre-renovation. $355/unit/yr.',
        },
        post_stabilization: {
          value: 52000,
          confidence: 'medium',
          source: 'tier2:owned_portfolio',
          note: 'Post-renovation: renovated HVAC/appliances. $212/unit/yr.',
        },
        ...overrides['expense.repairs_maintenance'] as Record<string, unknown>,
      },
      'expense.marketing': {
        value: 38000,
        source: 'agent:cashflow',
        evidence: {
          source_tier: 1,
          source_label: 'T12 actuals',
          confidence: 'medium',
          derivation_chain: ['T12 marketing $62k → exclude rebranding ($24k one-time) → $38k steady-state'],
        },
        pre_renovation: {
          value: 62000,
          confidence: 'high',
          source: 'tier1:t12',
          note: 'Pre-renovation: ILS + rebranding campaign. $253/unit/yr.',
        },
        post_stabilization: {
          value: 38000,
          confidence: 'medium',
          source: 'tier3:market_comp',
          note: 'Stabilized ILS + digital. $155/unit/yr.',
        },
        ...overrides['expense.marketing'] as Record<string, unknown>,
      },
      'expense.contract_services': {
        value: 61000,
        source: 'agent:cashflow',
        evidence: {
          source_tier: 1,
          source_label: 'T12 actuals',
          confidence: 'high',
          derivation_chain: ['T12 $44k + new pool service $14k + parking mgmt $3k = $61k post-reno'],
        },
        pre_renovation: {
          value: 44000,
          confidence: 'high',
          source: 'tier1:t12',
          note: 'Pre-reno: landscaping + pest + fire safety. $179/unit/yr.',
        },
        post_stabilization: {
          value: 61000,
          confidence: 'high',
          source: 'tier2:owned_portfolio',
          note: 'Renovation adds new pool (pool service $14k/yr) + structured parking mgmt ($3k/yr). $249/unit/yr.',
        },
        ...overrides['expense.contract_services'] as Record<string, unknown>,
      },
    },
    collision_summary: { minor_count: 0, material_count: 0, severe_count: 0 },
    confidence_distribution: { high: 3, medium: 0, low: 0 },
    tier_distribution: { tier1: 3, tier2: 0, tier3: 0, tier4: 0 },
    summary: 'Value-add CashFlow analysis with pre/post renovation sub-fields.',
  };
}

const CTX: RunContext = {
  dealId:       BASE_DEAL_ID,
  userId:       '00001364-0000-0000-0000-000000000099',
  triggeredBy:  'user',
  triggerContext: { source: 'integration_test' },
};

// ── Test suite ────────────────────────────────────────────────────────────────
describe('CashFlow Agent sub-field writeback (v1.3, Task #1364)', () => {
  beforeAll(async () => {
    TEST_SCENARIO_ID = await createTestScenario();
  });

  afterAll(async () => {
    await cleanupTestScenario();
  });

  it('writes repairs_maintenance__pre_renovation and __post_stabilization to year1Seed', async () => {
    await cashflowPostProcess(buildAgentOutput(), CTX, TEST_RUN_ID);

    const res = await query(
      `SELECT year1->'repairs_maintenance__pre_renovation'     AS rm_pre,
              year1->'repairs_maintenance__post_stabilization' AS rm_post
       FROM deal_underwriting_scenarios WHERE id = $1`,
      [TEST_SCENARIO_ID],
    );

    const row = res.rows[0];
    expect(row.rm_pre).not.toBeNull();
    expect(row.rm_post).not.toBeNull();
    expect((row.rm_pre as { value: number }).value).toBe(87000);
    expect((row.rm_post as { value: number }).value).toBe(52000);
    expect((row.rm_pre as { confidence: string }).confidence).toBe('high');
  });

  it('writes marketing__pre_renovation and __post_stabilization to year1Seed', async () => {
    const res = await query(
      `SELECT year1->'marketing__pre_renovation'    AS mkt_pre,
              year1->'marketing__post_stabilization' AS mkt_post
       FROM deal_underwriting_scenarios WHERE id = $1`,
      [TEST_SCENARIO_ID],
    );

    const row = res.rows[0];
    expect(row.mkt_pre).not.toBeNull();
    expect(row.mkt_post).not.toBeNull();
    expect((row.mkt_pre as { value: number }).value).toBe(62000);
    expect((row.mkt_post as { value: number }).value).toBe(38000);
  });

  it('writes contract_services__pre_renovation and __post_stabilization when renovation adds new pool/parking', async () => {
    const res = await query(
      `SELECT year1->'contract_services__pre_renovation'      AS cs_pre,
              year1->'contract_services__post_stabilization'  AS cs_post
       FROM deal_underwriting_scenarios WHERE id = $1`,
      [TEST_SCENARIO_ID],
    );

    const row = res.rows[0];
    expect(row.cs_pre).not.toBeNull();
    expect(row.cs_post).not.toBeNull();
    expect((row.cs_pre as { value: number }).value).toBe(44000);
    expect((row.cs_post as { value: number }).value).toBe(61000);
    // Verify note mentions new amenities (pool + structured parking)
    expect((row.cs_post as { note: string }).note).toMatch(/pool|elevator|parking/i);
  });

  it('rejects low-confidence post_stabilization sub-fields', async () => {
    // Reset scenario year1
    await query(`UPDATE deal_underwriting_scenarios SET year1 = '{}' WHERE id = $1`, [TEST_SCENARIO_ID]);

    const lowConfOutput = buildAgentOutput({
      'expense.repairs_maintenance': {
        post_stabilization: { value: 52000, confidence: 'low', source: 'tier3:comp', note: '' },
      },
    });

    await cashflowPostProcess(lowConfOutput, CTX, TEST_RUN_ID);

    const res = await query(
      `SELECT year1->'repairs_maintenance__pre_renovation'     AS rm_pre,
              year1->'repairs_maintenance__post_stabilization' AS rm_post
       FROM deal_underwriting_scenarios WHERE id = $1`,
      [TEST_SCENARIO_ID],
    );
    const row = res.rows[0];
    // pre_renovation should be written (has high confidence)
    expect(row.rm_pre).not.toBeNull();
    // post_stabilization should NOT be written (confidence = 'low')
    expect(row.rm_post).toBeNull();
  });

  it('skips non-numeric sub-field values', async () => {
    await query(`UPDATE deal_underwriting_scenarios SET year1 = '{}' WHERE id = $1`, [TEST_SCENARIO_ID]);

    const badValueOutput: Record<string, unknown> = {
      proforma_fields: {
        'expense.marketing': {
          value: 38000,
          source: 'agent:cashflow',
          evidence: { source_tier: 1, source_label: 'T12', confidence: 'medium', derivation_chain: [] },
          pre_renovation:     { value: 'unknown_string', confidence: 'high', source: 'tier1:t12', note: '' },
          post_stabilization: { value: 38000, confidence: 'high', source: 'tier3:comp', note: '' },
        },
      },
      collision_summary: { minor_count: 0, material_count: 0, severe_count: 0 },
      confidence_distribution: { high: 1, medium: 0, low: 0 },
      tier_distribution: { tier1: 1, tier2: 0, tier3: 0, tier4: 0 },
      summary: 'test',
    };

    await cashflowPostProcess(badValueOutput, CTX, TEST_RUN_ID);

    const res = await query(
      `SELECT year1->'marketing__pre_renovation'    AS mkt_pre,
              year1->'marketing__post_stabilization' AS mkt_post
       FROM deal_underwriting_scenarios WHERE id = $1`,
      [TEST_SCENARIO_ID],
    );
    const row = res.rows[0];
    // pre with non-numeric should be skipped
    expect(row.mkt_pre).toBeNull();
    // post with numeric 38000 should be written
    expect(row.mkt_post).not.toBeNull();
  });

  it('Contract Services NEGATIVE: no sub-fields written when agent omits them (no new pool/elevator/parking)', async () => {
    // When the agent does NOT include CS sub-fields in its output
    // (i.e. the v1.3 prompt correctly told it to skip CS because no new amenities were added),
    // the postprocess must not write those keys.
    await query(`UPDATE deal_underwriting_scenarios SET year1 = '{}' WHERE id = $1`, [TEST_SCENARIO_ID]);

    const noCSSubfieldsOutput: Record<string, unknown> = {
      proforma_fields: {
        // CS is present as a plain value — no sub-fields (no new pool/elevator/parking in deal)
        'expense.contract_services': {
          value: 44000,
          source: 'agent:cashflow',
          evidence: { source_tier: 1, source_label: 'T12 actuals', confidence: 'high', derivation_chain: [] },
          // Intentionally no pre_renovation / post_stabilization
        },
        // R&M and Marketing still get sub-fields (renovation context exists for those)
        'expense.repairs_maintenance': {
          value: 52000,
          source: 'agent:cashflow',
          evidence: { source_tier: 1, source_label: 'T12 actuals', confidence: 'high', derivation_chain: [] },
          pre_renovation:     { value: 87000, confidence: 'high', source: 'tier1:t12', note: 'Pre-reno aging systems.' },
          post_stabilization: { value: 52000, confidence: 'medium', source: 'tier2:portfolio', note: 'Post-reno rate.' },
        },
      },
      collision_summary: { minor_count: 0, material_count: 0, severe_count: 0 },
      confidence_distribution: { high: 2, medium: 0, low: 0 },
      tier_distribution: { tier1: 2, tier2: 0, tier3: 0, tier4: 0 },
      summary: 'No new pool/elevator/parking — CS sub-fields intentionally omitted by agent.',
    };

    await cashflowPostProcess(noCSSubfieldsOutput, CTX, TEST_RUN_ID);

    const res = await query(
      `SELECT year1->'contract_services__pre_renovation'      AS cs_pre,
              year1->'contract_services__post_stabilization'  AS cs_post,
              year1->'repairs_maintenance__pre_renovation'    AS rm_pre,
              year1->'repairs_maintenance__post_stabilization' AS rm_post
       FROM deal_underwriting_scenarios WHERE id = $1`,
      [TEST_SCENARIO_ID],
    );
    const row = res.rows[0];
    // CS sub-fields must be ABSENT (agent did not emit them)
    expect(row.cs_pre,  'CS pre_renovation should be absent when agent omits sub-fields').toBeNull();
    expect(row.cs_post, 'CS post_stabilization should be absent when agent omits sub-fields').toBeNull();
    // R&M should still be present (unrelated to CS gate)
    expect(row.rm_pre,  'R&M pre_renovation should be present').not.toBeNull();
    expect(row.rm_post, 'R&M post_stabilization should be present').not.toBeNull();
  });

  it('Contract Services synthesis gate: CS sub-fields NOT written by fallback even on value_add deal (interior-only reno)', async () => {
    // This test proves the CS amenity gate in the synthesis fallback:
    // Even when deal_type='value_add' (which activates the postprocess synthesis fallback),
    // expense.contract_services sub-fields must NOT be synthesized. Only the LLM can write
    // them — and only when qualifying amenities (pool/elevator/parking) are present.
    await query(`UPDATE deal_underwriting_scenarios SET year1 = '{}' WHERE id = $1`, [TEST_SCENARIO_ID]);

    // Temporarily mark the deal as value_add to activate the synthesis path
    const origDealType = await query(`SELECT deal_type FROM deals WHERE id = $1`, [BASE_DEAL_ID]);
    const prevType = origDealType.rows[0]?.deal_type ?? null;
    await query(`UPDATE deals SET deal_type = 'value_add' WHERE id = $1`, [BASE_DEAL_ID]);

    try {
      // Output: CS has a main value (flat, no sub-fields). R&M/Marketing have NO sub-fields
      // so synthesis may fire for them (but without T12 data it will resolve no pre_reno for R&M).
      const interiorOnlyOutput: Record<string, unknown> = {
        proforma_fields: {
          'expense.contract_services': {
            value: 44000,
            source: 't12',
            evidence: { source_tier: 1, source_label: 'T12 actuals', confidence: 'high', derivation_chain: [] },
            // No sub-fields — interior renovation does not affect CS scope
          },
          'expense.marketing': {
            value: 38000,
            source: 't12',
            evidence: { source_tier: 1, source_label: 'T12 actuals', confidence: 'high', derivation_chain: [] },
            // No sub-fields in LLM output for this test
          },
        },
        collision_summary: { minor_count: 0, material_count: 0, severe_count: 0 },
        confidence_distribution: { high: 2, medium: 0, low: 0 },
        tier_distribution: { tier1: 2, tier2: 0, tier3: 0, tier4: 0 },
        summary: 'Interior-only renovation — CS scope unchanged, no qualifying amenities.',
      };

      await cashflowPostProcess(interiorOnlyOutput, CTX, TEST_RUN_ID);

      const res = await query(
        `SELECT year1->'contract_services__pre_renovation'     AS cs_pre,
                year1->'contract_services__post_stabilization' AS cs_post
         FROM deal_underwriting_scenarios WHERE id = $1`,
        [TEST_SCENARIO_ID],
      );
      const row = res.rows[0];

      // CRITICAL: CS sub-fields must be absent even though deal_type='value_add' and
      // CS has a main value. The synthesis fallback intentionally excludes CS because
      // there is no server-side signal for qualifying amenities.
      expect(
        row.cs_pre,
        'CS pre_renovation must NOT be synthesized — amenity gate must block postprocess from writing it',
      ).toBeNull();
      expect(
        row.cs_post,
        'CS post_stabilization must NOT be synthesized — amenity gate must block postprocess from writing it',
      ).toBeNull();
    } finally {
      // Always restore deal_type
      await query(`UPDATE deals SET deal_type = $2 WHERE id = $1`, [BASE_DEAL_ID, prevType]);
    }
  });

  it('regimeDataByField composer can read the written sub-field keys', async () => {
    // Reset and re-run full scenario to get clean state
    await query(`UPDATE deal_underwriting_scenarios SET year1 = '{}' WHERE id = $1`, [TEST_SCENARIO_ID]);
    await cashflowPostProcess(buildAgentOutput(), CTX, TEST_RUN_ID);

    // Simulate the _PATTERN_B_TO_YEAR1_KEY lookup from proforma-adjustment.service.ts
    const PATTERN_B_TO_YEAR1_KEY: Record<string, string> = {
      repairs_maintenance: 'repairs_maintenance',
      marketing:           'marketing',
      contract_services:   'contract_services',
    };

    for (const [field, year1Key] of Object.entries(PATTERN_B_TO_YEAR1_KEY)) {
      const res = await query(
        `SELECT year1->$2 AS pre_val, year1->$3 AS post_val
         FROM deal_underwriting_scenarios WHERE id = $1`,
        [TEST_SCENARIO_ID, `${year1Key}__pre_renovation`, `${year1Key}__post_stabilization`],
      );
      const row = res.rows[0];
      expect(row.pre_val,  `${field}: pre_renovation should be present`).not.toBeNull();
      expect(row.post_val, `${field}: post_stabilization should be present`).not.toBeNull();
      expect(typeof (row.pre_val  as { value: number }).value).toBe('number');
      expect(typeof (row.post_val as { value: number }).value).toBe('number');
    }
  });
});
