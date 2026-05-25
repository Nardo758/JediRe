/**
 * write_dealcontext — deal_id mismatch guardrail tests (Task #833 / finding P5-01)
 *
 * Verifies that write_dealcontext emits a logger.warn and sets deal_id_mismatch:true
 * in its output when input.deal_id differs from ctx.dealId, while still writing the
 * field to the database (the "flexible cross-deal write" use-case is intentional;
 * only the audit trail is required).
 *
 * Also verifies that no warning fires and deal_id_mismatch is absent when the IDs match,
 * and that no warning fires when ctx.dealId is undefined (agent runs without a bound deal).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/connection', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  getPool: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { writeDealContextTool } from '../write_dealcontext';
import { logger } from '../../../utils/logger';
import type { RunContext } from '../../runtime/types';

const CTX_DEAL_ID   = 'aaaaaaaa-0000-0000-0000-000000000001';
const INPUT_DEAL_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

function makeCtx(dealId?: string): RunContext {
  return {
    dealId,
    triggeredBy: 'user',
    correlationId: 'corr-test-123',
  };
}

function baseInput(deal_id: string) {
  return {
    deal_id,
    field_path: 'market.vacancy_rate',
    value: 0.05,
    source_label: 'agent:research',
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  vi.mocked(logger.warn).mockReset();
  vi.mocked(logger.debug).mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
});

describe('write_dealcontext — deal_id mismatch guardrail', () => {

  it('emits logger.warn and sets deal_id_mismatch:true when input.deal_id !== ctx.dealId', async () => {
    const result = await writeDealContextTool.execute(
      baseInput(INPUT_DEAL_ID),
      makeCtx(CTX_DEAL_ID),
    );

    expect(vi.mocked(logger.warn)).toHaveBeenCalledOnce();
    const [msg, meta] = vi.mocked(logger.warn).mock.calls[0];
    expect(msg).toMatch(/deal_id mismatch/i);
    expect(meta).toMatchObject({
      inputDealId: INPUT_DEAL_ID,
      ctxDealId: CTX_DEAL_ID,
      fieldPath: 'market.vacancy_rate',
    });

    expect(result.deal_id_mismatch).toBe(true);
    expect(result.success).toBe(true);
    expect(result.deal_id).toBe(INPUT_DEAL_ID);
  });

  it('still performs the DB write even on a mismatch', async () => {
    await writeDealContextTool.execute(
      baseInput(INPUT_DEAL_ID),
      makeCtx(CTX_DEAL_ID),
    );

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO deal_context_fields/);
    expect(params[0]).toBe(INPUT_DEAL_ID);
  });

  it('does NOT warn and omits deal_id_mismatch when IDs match', async () => {
    const result = await writeDealContextTool.execute(
      baseInput(CTX_DEAL_ID),
      makeCtx(CTX_DEAL_ID),
    );

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    expect(result.deal_id_mismatch).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('does NOT warn when ctx.dealId is undefined (unbound run)', async () => {
    const result = await writeDealContextTool.execute(
      baseInput(INPUT_DEAL_ID),
      makeCtx(undefined),
    );

    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    expect(result.deal_id_mismatch).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('includes correlationId in the warning metadata', async () => {
    await writeDealContextTool.execute(
      baseInput(INPUT_DEAL_ID),
      makeCtx(CTX_DEAL_ID),
    );

    const [, meta] = vi.mocked(logger.warn).mock.calls[0];
    expect((meta as Record<string, unknown>).correlationId).toBe('corr-test-123');
  });
});
