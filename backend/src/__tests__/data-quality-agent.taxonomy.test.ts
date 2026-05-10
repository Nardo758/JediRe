/**
 * Task #701 — DQA taxonomy regression tests
 *
 * Five describe blocks:
 *  (a) SEVERITY_MAP values for new/retired classifications
 *  (b) DqaClassification type safety — SEED_PLUMBING retired
 *  (c) allowlist filter — drops 'SEED_PLUMBING', passes 'NOT_IN_DOC'
 *  (d) computeAbsentFields — curated criterion scoping logic
 *  (e) buildUserPrompt — "Absent-field candidates" section presence/absence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SEVERITY_MAP,
  DqaClassification,
  runDataQualityAgent,
} from '../services/data-quality-agent.service';

// Silence the dqa.complete JSON console.log emitted by runDataQualityAgent so
// test output stays readable.  console.error is also suppressed to avoid noise
// from any caught internal errors inside the service.
const _consoleSpy = {
  log:   vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};
afterEach(() => {
  _consoleSpy.log.mockClear();
  _consoleSpy.error.mockClear();
});

// ─── Anthropic mock ────────────────────────────────────────────────────────────
// vi.hoisted ensures the mock fn is available before module resolution.
// All tests configure mockAnthropicCreate per-test via mockResolvedValueOnce.

const mockAnthropicCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

// ─── Extraction-events mock — suppress live DB timestamp calls ─────────────────
vi.mock('../services/extraction-events.service', () => ({
  fetchFieldWriteTimes:     vi.fn(async () => ({})),
  classifyTimestampDelta:   vi.fn(() => 'SEED_PLUMBING_STALE_SEED'),
  computeDeltaSeconds:      vi.fn(() => null),
  WRITE_RACE_WINDOW_SECONDS: 300,
}));

// ─── fs mock — no files on disk during unit tests ─────────────────────────────
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync:   vi.fn(() => false),
    readFileSync: vi.fn(() => Buffer.from('')),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Anthropic tool-use response with the supplied findings.
 * Omitting findings (or passing []) makes callAgent return an empty list.
 */
function makeAnthropicResponse(findings: unknown[] = []) {
  return {
    content: [
      {
        type:  'tool_use',
        name:  'report_findings',
        input: { findings },
      },
    ],
  };
}

/** Returns a fully-valid DqaFinding fixture; override individual fields as needed. */
function makeFinding(overrides: Record<string, unknown> = {}) {
  return {
    classification:     'PARSER_MISS',
    proforma_column:    'om',
    proforma_row:       'gpr',
    source_evidence:    { page: 1, section: 'Revenue', snippet: null },
    reasoning:          'Value is present in source but extracted as null.',
    extracted_value:    null,
    expected_value:     4_901_400,
    confidence:         0.9,
    recommended_action: 'Re-run extraction.',
    ...overrides,
  };
}

/**
 * Builds a mock pg Pool whose query handler covers every SQL branch that
 * runDataQualityAgent exercises.
 *
 * Query routing:
 *   1. SELECT from data_quality_alerts (cache check)       → empty rows (bypass cache)
 *   2. SELECT deals d LEFT JOIN deal_assumptions           → controlled deal_data + year1
 *   3. SELECT year1 FROM deal_assumptions (computeAbsent)  → controlled year1
 *   4. INSERT INTO data_quality_alerts (writeFindings)     → captures agent_finding JSON
 *   5. UPDATE data_quality_alerts (supersedeExisting)      → no-op
 */
function makeDqaPool(opts: {
  dealData?:         Record<string, unknown>;
  year1?:            Record<string, unknown>;
  capturedFindings?: Array<Record<string, unknown>>;
}) {
  const { dealData = {}, year1 = {}, capturedFindings } = opts;

  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      // 1. Cache bypass — return 0 rows so the agent always runs fresh.
      if (
        sql.includes('data_quality_alerts') &&
        sql.includes('SELECT') &&
        !sql.includes('INSERT') &&
        !sql.includes('UPDATE')
      ) {
        return { rows: [], rowCount: 0 };
      }

      // 2. Main deal + year1 JOIN (fetchProformaRowData).
      if (sql.includes('deals d') && sql.includes('LEFT JOIN deal_assumptions')) {
        return { rows: [{ deal_data: dealData, year1 }] };
      }

      // 3. computeAbsentFields — separate SELECT year1 query.
      if (sql.includes('SELECT year1') && sql.includes('deal_assumptions')) {
        return { rows: [{ year1 }] };
      }

      // 4. writeFindings INSERT — capture the serialised agent_finding.
      if (sql.includes('INSERT INTO data_quality_alerts')) {
        const agentFindingJson = params[6] as string;
        if (capturedFindings && agentFindingJson) {
          capturedFindings.push(JSON.parse(agentFindingJson));
        }
        return { rows: [{ id: 'f0000000-0000-0000-0000-000000000001' }] };
      }

      // 5. supersedeExistingFindings UPDATE — no-op.
      if (sql.includes('UPDATE data_quality_alerts')) {
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

// ─── Block (a): SEVERITY_MAP values ──────────────────────────────────────────

describe('SEVERITY_MAP — severity values for new/retired classifications', () => {
  it('SEED_PLUMBING_WRITE_RACE maps to "warning"', () => {
    expect(SEVERITY_MAP.SEED_PLUMBING_WRITE_RACE).toBe('warning');
  });

  it('SEED_PLUMBING_STALE_SEED maps to "warning"', () => {
    expect(SEVERITY_MAP.SEED_PLUMBING_STALE_SEED).toBe('warning');
  });

  it('NOT_IN_DOC maps to "info"', () => {
    expect(SEVERITY_MAP.NOT_IN_DOC).toBe('info');
  });

  it('SEVERITY_MAP has no "SEED_PLUMBING" key (retired classification)', () => {
    expect(Object.keys(SEVERITY_MAP)).not.toContain('SEED_PLUMBING');
  });
});

// ─── Block (b): TypeScript type safety ────────────────────────────────────────

describe('DqaClassification — SEED_PLUMBING is not an assignable value', () => {
  it('type-level: "SEED_PLUMBING" is rejected by DqaClassification union', () => {
    // The exhaustiveness check on SEVERITY_MAP (Record<DqaClassification, DqaSeverity>)
    // means any key absent from the DqaClassification union would fail tsc.
    // Verifying 'SEED_PLUMBING' is absent from the key set proves the type constraint
    // holds at runtime too.
    const keys = Object.keys(SEVERITY_MAP) as string[];
    expect(keys).not.toContain('SEED_PLUMBING');

    // @ts-expect-error — 'SEED_PLUMBING' is not assignable to DqaClassification.
    // If this error-suppression comment becomes unnecessary (i.e. TypeScript no longer
    // rejects the assignment) tsc will fail with "Unused '@ts-expect-error' directive".
    const _retired: DqaClassification = 'SEED_PLUMBING';
    void _retired;
  });
});

// ─── Block (c): allowlist filter ──────────────────────────────────────────────

describe('callAgent allowlist filter', () => {
  beforeEach(() => {
    mockAnthropicCreate.mockReset();
  });

  it('drops a hallucinated legacy "SEED_PLUMBING" finding — retired classification is not in allowlist', async () => {
    const capturedFindings: Array<Record<string, unknown>> = [];
    const pool = makeDqaPool({
      dealData: {
        broker_claims: { proforma: { stabilizedGpr: 4_901_400 }, property: {} },
      },
      year1:            { gpr: { om: null } },
      capturedFindings,
    });

    mockAnthropicCreate.mockResolvedValueOnce(
      makeAnthropicResponse([makeFinding({ classification: 'SEED_PLUMBING', confidence: 0.9 })])
    );

    const result = await runDataQualityAgent(pool as never, {
      dealId:       'deal-allowlist-drop',
      documentType: 'OM',
    });

    expect(result).not.toBeNull();
    // Finding must be dropped — zero results returned and nothing written to DB.
    expect(result!.findings).toHaveLength(0);
    expect(capturedFindings).toHaveLength(0);
  });

  it('passes a valid "NOT_IN_DOC" finding through the allowlist', async () => {
    const capturedFindings: Array<Record<string, unknown>> = [];
    const pool = makeDqaPool({
      dealData: {
        broker_claims: { proforma: { stabilizedGpr: 4_901_400 }, property: {} },
      },
      // gpr.t12 has a value → curated criterion met → NOT_IN_DOC is a valid signal
      year1:            { gpr: { om: null, t12: 4_800_000 } },
      capturedFindings,
    });

    mockAnthropicCreate.mockResolvedValueOnce(
      makeAnthropicResponse([makeFinding({ classification: 'NOT_IN_DOC', confidence: 0.9 })])
    );

    const result = await runDataQualityAgent(pool as never, {
      dealId:       'deal-allowlist-pass',
      documentType: 'OM',
    });

    expect(result).not.toBeNull();
    expect(result!.findings).toHaveLength(1);
    expect(result!.findings[0].classification).toBe('NOT_IN_DOC');
    expect(capturedFindings).toHaveLength(1);
    expect(capturedFindings[0].classification).toBe('NOT_IN_DOC');
  });
});

// ─── Block (d): computeAbsentFields curated criterion ─────────────────────────

describe('computeAbsentFields — curated criterion scoping', () => {
  beforeEach(() => {
    mockAnthropicCreate.mockReset();
    // Return no findings by default — we only care about the prompt content here.
    mockAnthropicCreate.mockResolvedValue(makeAnthropicResponse([]));
  });

  /**
   * Runs the agent and returns the user-message string that was sent to Claude.
   * This is the output of buildUserPrompt, passed as messages[0].content.
   */
  async function runAndCaptureUserMessage(
    pool: ReturnType<typeof makeDqaPool>
  ): Promise<string> {
    await runDataQualityAgent(pool as never, {
      dealId:       'deal-absent-scope',
      documentType: 'OM',
    });
    const callArgs = mockAnthropicCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    return callArgs.messages[0].content;
  }

  it('does NOT include a field when its year1 slot has no other column with a non-null value', async () => {
    // gpr.om = null; no other column in year1.gpr → curated criterion NOT met.
    const pool = makeDqaPool({
      dealData: { broker_claims: { proforma: { stabilizedGpr: 4_901_400 }, property: {} } },
      year1:    { gpr: { om: null } },
    });

    const userMsg = await runAndCaptureUserMessage(pool);

    expect(userMsg).not.toContain('Absent-field candidates');
  });

  it('does NOT include a field when all other columns in year1[row] are also null', async () => {
    // gpr.om = null; gpr.t12 = null → no other source has a value.
    const pool = makeDqaPool({
      dealData: { broker_claims: { proforma: { stabilizedGpr: 4_901_400 }, property: {} } },
      year1:    { gpr: { om: null, t12: null } },
    });

    const userMsg = await runAndCaptureUserMessage(pool);

    expect(userMsg).not.toContain('Absent-field candidates');
  });

  it('DOES include a field when another source column in year1[row] has a non-null value', async () => {
    // gpr.om = null; gpr.t12 = 4800000 → t12 has a value → curated criterion met.
    const pool = makeDqaPool({
      dealData: {
        broker_claims: { proforma: {}, property: {} }, // no gpr in proforma → om slot stays null
      },
      year1: { gpr: { om: null, t12: 4_800_000 } },
    });

    const userMsg = await runAndCaptureUserMessage(pool);

    expect(userMsg).toContain('Absent-field candidates');
    expect(userMsg).toContain('gpr');
  });
});

// ─── Block (e): buildUserPrompt section presence ───────────────────────────────

describe('buildUserPrompt — "Absent-field candidates" section', () => {
  beforeEach(() => {
    mockAnthropicCreate.mockReset();
    mockAnthropicCreate.mockResolvedValue(makeAnthropicResponse([]));
  });

  it('omits the section when no field meets the curated criterion', async () => {
    // year1.gpr.om is populated — not a null-slot candidate at all.
    const pool = makeDqaPool({
      dealData: {
        broker_claims: { proforma: { stabilizedGpr: 4_901_400 }, property: {} },
      },
      year1: { gpr: { om: 4_901_400 } },
    });

    await runDataQualityAgent(pool as never, { dealId: 'deal-bup-1', documentType: 'OM' });

    const callArgs = mockAnthropicCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(callArgs.messages[0].content).not.toContain('Absent-field candidates');
  });

  it('includes the section with the correct field name when the curated criterion is met', async () => {
    // contract_services.om = null; contract_services.t12 = 80000 → curated criterion met.
    const pool = makeDqaPool({
      dealData: {
        // No contractServicesAnnual in proforma → extractedValue null → om slot null
        broker_claims: { proforma: {}, property: {} },
      },
      year1: { contract_services: { om: null, t12: 80_000 } },
    });

    await runDataQualityAgent(pool as never, { dealId: 'deal-bup-2', documentType: 'OM' });

    const callArgs = mockAnthropicCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMsg = callArgs.messages[0].content;

    expect(userMsg).toContain('Absent-field candidates');
    expect(userMsg).toContain('contract_services');
    // Confirm the NOT_IN_DOC instruction is present in the section.
    expect(userMsg).toContain('NOT_IN_DOC');
  });
});
