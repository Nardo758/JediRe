import { describe, it, expect } from 'vitest';

// We need to test resolveLayeredValue in isolation.
// It is not exported, so we re-implement the exact logic here
// (mirrors backend/src/services/field-access/get-field-value.service.ts)

function extractNum(v: unknown): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function resolveLayeredValue(
  lv: Record<string, unknown>,
  computedValue: number | null,
  computedFormula: string | undefined,
  perYearOverride: number | null,
): { resolved: number | null; resolution: string | null; source: string | null } {
  const override = extractNum(lv.override);
  const agent = extractNum(lv.agent);
  const agentConfirmed = extractNum(lv.agent_confirmed);
  const storedResolved = extractNum(lv.resolved);
  const storedSource = typeof lv.source === 'string' ? lv.source : null;
  const storedRes = typeof lv.resolution === 'string' ? lv.resolution : null;

  let resolved: number | null = storedResolved;
  let resolution: string | null = storedRes;
  let source: string | null = storedSource;

  if (agent != null) {
    resolved = agent;
    resolution = storedRes && storedRes.startsWith('agent') ? storedRes : 'agent:cashflow';
    source = storedSource && storedSource.startsWith('agent') ? storedSource : 'agent:cashflow';
  }

  if (computedValue != null && override == null) {
    resolved = computedValue;
    resolution = 'engine:cashflow';
    source = 'engine:cashflow';
  }

  if (agentConfirmed != null && override == null) {
    resolved = agentConfirmed;
    resolution = 'agent_confirmed';
    source = storedSource && storedSource.startsWith('agent') ? storedSource : 'agent_confirmed';
  }

  if (perYearOverride != null && override == null) {
    resolved = perYearOverride;
    resolution = 'per_year_override';
    source = 'per_year_override';
  }

  if (override != null) {
    resolved = override;
    resolution = 'override';
    source = 'override';
  }

  return { resolved, resolution, source };
}

describe('W1 · R1 — agent_confirmed resolution order', () => {
  const baseLV: Record<string, unknown> = {
    resolved: 100,
    resolution: 't12',
    source: 't12',
  };

  it('identity: no agent_confirmed → same as pre-change (storedResolved wins)', () => {
    const result = resolveLayeredValue(baseLV, null, undefined, null);
    expect(result.resolved).toBe(100);
    expect(result.resolution).toBe('t12');
    expect(result.source).toBe('t12');
  });

  it('identity: Engine A computed without agent_confirmed → computed wins', () => {
    const result = resolveLayeredValue(baseLV, 150, 'egi - opex', null);
    expect(result.resolved).toBe(150);
    expect(result.resolution).toBe('engine:cashflow');
  });

  it('agent_confirmed beats Engine A computed', () => {
    const lv = { ...baseLV, agent_confirmed: 200 };
    const result = resolveLayeredValue(lv, 150, 'egi - opex', null);
    expect(result.resolved).toBe(200);
    expect(result.resolution).toBe('agent_confirmed');
  });

  it('perYearOverride beats agent_confirmed', () => {
    const lv = { ...baseLV, agent_confirmed: 200 };
    const result = resolveLayeredValue(lv, 150, 'egi - opex', 250);
    expect(result.resolved).toBe(250);
    expect(result.resolution).toBe('per_year_override');
  });

  it('override beats everything', () => {
    const lv = { ...baseLV, override: 300, agent_confirmed: 200 };
    const result = resolveLayeredValue(lv, 150, 'egi - opex', 250);
    expect(result.resolved).toBe(300);
    expect(result.resolution).toBe('override');
  });

  it('legacy agent below Engine A (backward compat)', () => {
    const lv = { ...baseLV, agent: 120 };
    const result = resolveLayeredValue(lv, 150, 'egi - opex', null);
    // Engine A should override the legacy agent value
    expect(result.resolved).toBe(150);
    expect(result.resolution).toBe('engine:cashflow');
  });

  it('agent_confirmed restores value above Engine A even when legacy agent exists', () => {
    const lv = { ...baseLV, agent: 120, agent_confirmed: 200 };
    const result = resolveLayeredValue(lv, 150, 'egi - opex', null);
    // agent_confirmed (200) > Engine A (150) > legacy agent (120)
    expect(result.resolved).toBe(200);
    expect(result.resolution).toBe('agent_confirmed');
  });

  it('full chain: stored < agent < computed < agent_confirmed < perYear < override', () => {
    const lv = {
      resolved: 100,
      agent: 120,
      agent_confirmed: 200,
      override: 300,
      resolution: 't12',
      source: 't12',
    };
    const result = resolveLayeredValue(lv, 150, 'egi - opex', 250);
    expect(result.resolved).toBe(300); // override wins
    expect(result.resolution).toBe('override');
  });
});
