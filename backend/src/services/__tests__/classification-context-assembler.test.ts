import { describe, test, expect } from 'vitest';
import {
  assembleClassificationContext,
  type RawClassificationRow,
} from '../classification-context-assembler';

describe('ClassificationContext assembler', () => {
  const dealId = 'test-deal-001';

  test('resolves single row correctly', () => {
    const rows: RawClassificationRow[] = [
      {
        field: 'deal_type',
        value: 'existing',
        source: 'email_intake',
        confidence: 0.8,
        stampedAt: '2026-07-18T10:00:00Z',
        userId: 'u1',
      },
    ];

    const ctx = assembleClassificationContext(dealId, rows);
    expect(ctx.dealId).toBe(dealId);
    expect(ctx.dealType?.value).toBe('existing');
    expect(ctx.dealType?.confidence).toBe(0.8);
    expect(ctx.strategy).toBeNull();
  });

  test('user_override wins over platform_default', () => {
    const rows: RawClassificationRow[] = [
      {
        field: 'strategy',
        value: 'rental',
        source: 'platform_default',
        confidence: 0.5,
        stampedAt: '2026-07-18T09:00:00Z',
        userId: null,
      },
      {
        field: 'strategy',
        value: 'flip',
        source: 'user_override',
        confidence: 1.0,
        stampedAt: '2026-07-18T10:00:00Z',
        userId: 'u1',
      },
    ];

    const ctx = assembleClassificationContext(dealId, rows);
    expect(ctx.strategy?.value).toBe('flip');
    expect(ctx.strategy?.provenance.ingestionSource).toBe('user_override');
  });

  test('agent_output wins over email_intake', () => {
    const rows: RawClassificationRow[] = [
      {
        field: 'asset_class',
        value: 'multifamily',
        source: 'email_intake',
        confidence: 0.6,
        stampedAt: '2026-07-18T09:00:00Z',
        userId: null,
      },
      {
        field: 'asset_class',
        value: 'retail',
        source: 'agent:research',
        confidence: 0.85,
        stampedAt: '2026-07-18T10:00:00Z',
        userId: null,
        agentRunId: 'run-123',
      },
    ];

    const ctx = assembleClassificationContext(dealId, rows);
    expect(ctx.assetClass?.value).toBe('retail');
    expect(ctx.assetClass?.provenance.ingestionSource).toBe('agent:research');
  });

  test('tie-breaks by recency when precedence is equal', () => {
    const rows: RawClassificationRow[] = [
      {
        field: 'deal_mode',
        value: 'STABILIZED',
        source: 'agent:cashflow',
        confidence: 0.7,
        stampedAt: '2026-07-18T09:00:00Z',
        userId: null,
      },
      {
        field: 'deal_mode',
        value: 'LEASE_UP',
        source: 'agent:cashflow',
        confidence: 0.75,
        stampedAt: '2026-07-18T11:00:00Z',
        userId: null,
      },
    ];

    const ctx = assembleClassificationContext(dealId, rows);
    expect(ctx.dealMode?.value).toBe('LEASE_UP');
  });

  test('ignores unknown fields', () => {
    const rows: RawClassificationRow[] = [
      {
        field: 'unknown_field',
        value: 'whatever',
        source: 'platform',
        confidence: 0.5,
        stampedAt: '2026-07-18T10:00:00Z',
        userId: null,
      },
    ];

    const ctx = assembleClassificationContext(dealId, rows);
    expect(ctx.dealType).toBeNull();
    expect(ctx.strategy).toBeNull();
  });

  test('invalid values are filtered out', () => {
    const rows: RawClassificationRow[] = [
      {
        field: 'deal_type',
        value: 'not_a_real_type',
        source: 'email_intake',
        confidence: 0.9,
        stampedAt: '2026-07-18T10:00:00Z',
        userId: null,
      },
    ];

    const ctx = assembleClassificationContext(dealId, rows);
    expect(ctx.dealType).toBeNull();
  });

  test('canonicalizes legacy strategy aliases', () => {
    const rows: RawClassificationRow[] = [
      {
        field: 'strategy',
        value: 'bts',
        source: 'platform',
        confidence: 0.5,
        stampedAt: '2026-07-18T10:00:00Z',
        userId: null,
      },
    ];

    const ctx = assembleClassificationContext(dealId, rows);
    expect(ctx.strategy?.value).toBe('build_to_sell');
  });

  test('assembles all six canonical fields', () => {
    const rows: RawClassificationRow[] = [
      { field: 'deal_type', value: 'value_add', source: 'email_intake', confidence: 0.8, stampedAt: '2026-07-18T10:00:00Z', userId: null },
      { field: 'strategy', value: 'rental', source: 'agent:research', confidence: 0.85, stampedAt: '2026-07-18T10:00:00Z', userId: null },
      { field: 'asset_class', value: 'multifamily', source: 'email_intake', confidence: 0.8, stampedAt: '2026-07-18T10:00:00Z', userId: null },
      { field: 'deal_mode', value: 'LEASE_UP', source: 'agent:cashflow', confidence: 0.9, stampedAt: '2026-07-18T10:00:00Z', userId: null },
      { field: 'project_intent', value: 'acquisition', source: 'user', confidence: 1.0, stampedAt: '2026-07-18T10:00:00Z', userId: 'u1' },
      { field: 'view_mode', value: 'acquisition', source: 'platform', confidence: 0.5, stampedAt: '2026-07-18T10:00:00Z', userId: null },
    ];

    const ctx = assembleClassificationContext(dealId, rows);
    expect(ctx.dealType?.value).toBe('value_add');
    expect(ctx.strategy?.value).toBe('rental');
    expect(ctx.assetClass?.value).toBe('multifamily');
    expect(ctx.dealMode?.value).toBe('LEASE_UP');
    expect(ctx.projectIntent?.value).toBe('acquisition');
    expect(ctx.viewMode?.value).toBe('acquisition');
    expect(ctx.assembledAt).toBeDefined();
  });
});
