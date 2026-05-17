/**
 * AgentRuntime codepath symmetry regression test — Task #827
 *
 * Verifies that run() and startAsync()/_continueRun() invoke the same set of
 * AgentConfig hook callbacks. This test MUST FAIL if any future refactor
 * silently bypasses a hook in one path but not the other.
 *
 * Coverage:
 *   - postProcess fires exactly once per path, in both paths
 *   - outputSchema.parse fires exactly once per path, in both paths
 *   - Both paths succeed when postProcess is absent (optional hook)
 *   - Symmetry invariant: invocation counts are equal across both paths
 *
 * Documented intentional divergence (not covered here — correct behavior):
 *   budget.check() runs in run() and startAsync() but NOT _continueRun().
 *   _continueRun() is private and always called after budget.check() has
 *   already run in startAsync(). See audit table above _continueRun() in
 *   AgentRuntime.ts for the full hook inventory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('../../../database/connection', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../MeteringAdapter', () => ({
  dealRunStartLimiter: { acquire: vi.fn().mockResolvedValue(undefined) },
  MeteringAdapter: vi.fn().mockImplementation(() => ({
    createMessage: vi.fn().mockResolvedValue({
      id: 'msg-symmetry-test',
      model: 'claude-3-5-haiku-20241022',
      content: [{ type: 'text', text: '{"ok":true}' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10, cost_usd: 0.001 },
    }),
  })),
}));

vi.mock('../DeepSeekMeteringAdapter', () => ({
  DeepSeekMeteringAdapter: vi.fn().mockImplementation(() => ({
    createMessage: vi.fn(),
  })),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AgentRuntime } from '../AgentRuntime';
import type { AgentConfig, RunContext } from '../types';

const BUDGET_CAPS = {
  maxTokensPerRun: 10_000,
  maxCostUsdPerRun: 100,
  maxStepsPerRun: 5,
  maxCostUsdPerDealPerDay: 1_000,
  maxCostUsdPerUserPerMonth: 5_000,
};

function makeMockBudget() {
  return {
    check: vi.fn().mockResolvedValue(undefined),
    checkRunCap: vi.fn().mockResolvedValue(undefined),
  };
}

function makeCtx(): RunContext {
  return {
    dealId: 'deal-symmetry-test',
    userId: 'user-symmetry-test',
    triggeredBy: 'test',
    systemPromptOverride: 'You are a test agent. Always respond with {"ok":true}.',
  };
}

function makeConfig(hooks: {
  postProcess: ReturnType<typeof vi.fn>;
  schemaParse: ReturnType<typeof vi.fn>;
}): AgentConfig {
  return {
    agentId: 'cashflow' as AgentConfig['agentId'],
    agentVersion: '0.0.0-test',
    promptVersion: '0.0.0-test',
    modelName: 'claude-3-5-haiku-20241022' as AgentConfig['modelName'],
    capabilities: ['read:all'],
    tools: [],
    budgetCaps: BUDGET_CAPS,
    outputSchema: { parse: hooks.schemaParse } as unknown as z.ZodSchema,
    postProcess: hooks.postProcess,
  };
}

describe('AgentRuntime codepath symmetry', () => {
  let budget: ReturnType<typeof makeMockBudget>;
  let ctx: RunContext;

  beforeEach(() => {
    budget = makeMockBudget();
    ctx = makeCtx();
  });

  describe('run() — synchronous codepath', () => {
    it('invokes postProcess exactly once', async () => {
      const postProcess = vi.fn().mockImplementation(async (o: unknown) => o as Record<string, unknown>);
      const schemaParse = vi.fn().mockImplementation((v: unknown) => v);

      const runtime = new AgentRuntime(makeConfig({ postProcess, schemaParse }), null, budget);
      await runtime.run({}, ctx);

      expect(postProcess).toHaveBeenCalledTimes(1);
    });

    it('invokes outputSchema.parse exactly once', async () => {
      const postProcess = vi.fn().mockImplementation(async (o: unknown) => o as Record<string, unknown>);
      const schemaParse = vi.fn().mockImplementation((v: unknown) => v);

      const runtime = new AgentRuntime(makeConfig({ postProcess, schemaParse }), null, budget);
      await runtime.run({}, ctx);

      expect(schemaParse).toHaveBeenCalledTimes(1);
    });
  });

  describe('startAsync() / _continueRun() — async codepath', () => {
    it('invokes postProcess exactly once', async () => {
      const postProcess = vi.fn().mockImplementation(async (o: unknown) => o as Record<string, unknown>);
      const schemaParse = vi.fn().mockImplementation((v: unknown) => v);

      const runtime = new AgentRuntime(makeConfig({ postProcess, schemaParse }), null, budget);
      const { done } = await runtime.startAsync({}, ctx);
      await done;

      expect(postProcess).toHaveBeenCalledTimes(1);
    });

    it('invokes outputSchema.parse exactly once', async () => {
      const postProcess = vi.fn().mockImplementation(async (o: unknown) => o as Record<string, unknown>);
      const schemaParse = vi.fn().mockImplementation((v: unknown) => v);

      const runtime = new AgentRuntime(makeConfig({ postProcess, schemaParse }), null, budget);
      const { done } = await runtime.startAsync({}, ctx);
      await done;

      expect(schemaParse).toHaveBeenCalledTimes(1);
    });
  });

  describe('symmetry invariant — hook counts must match across both paths', () => {
    it('postProcess invocation count is equal in run() and startAsync()', async () => {
      const runPostProcess = vi.fn().mockImplementation(async (o: unknown) => o as Record<string, unknown>);
      const runSchemaParse = vi.fn().mockImplementation((v: unknown) => v);

      const asyncPostProcess = vi.fn().mockImplementation(async (o: unknown) => o as Record<string, unknown>);
      const asyncSchemaParse = vi.fn().mockImplementation((v: unknown) => v);

      const r1 = new AgentRuntime(makeConfig({ postProcess: runPostProcess, schemaParse: runSchemaParse }), null, budget);
      await r1.run({}, ctx);

      const r2 = new AgentRuntime(makeConfig({ postProcess: asyncPostProcess, schemaParse: asyncSchemaParse }), null, budget);
      const { done } = await r2.startAsync({}, ctx);
      await done;

      expect(runPostProcess.mock.calls.length).toBe(asyncPostProcess.mock.calls.length);
      expect(runSchemaParse.mock.calls.length).toBe(asyncSchemaParse.mock.calls.length);
    });

    it('both paths succeed when postProcess is absent', async () => {
      const schemaParse = vi.fn().mockImplementation((v: unknown) => v);
      const config: AgentConfig = { ...makeConfig({ postProcess: vi.fn(), schemaParse }), postProcess: undefined };

      const r1 = new AgentRuntime(config, null, budget);
      await expect(r1.run({}, ctx)).resolves.toBeDefined();

      const r2 = new AgentRuntime(config, null, budget);
      const { done } = await r2.startAsync({}, ctx);
      await expect(done).resolves.toBeDefined();
    });
  });
});
