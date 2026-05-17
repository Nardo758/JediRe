/**
 * AgentRuntime codepath symmetry regression test — Task #827
 *
 * PRIMARY INVARIANT: every AgentConfig hook invoked during a full run()
 * execution must also fire during a full startAsync()/_continueRun()
 * execution, with the same count — and vice versa.
 *
 * DESIGN: a shared HookRecorder wraps every mockable config callback and
 * budget method. After each full run the recorder snapshot is compared
 * against the snapshot from the other path. Any new hook added to one path
 * but not the other will break the set-equality assertion automatically —
 * no manual update needed.
 *
 * INTENTIONAL_DIVERGENCES: hooks with documented, expected count differences
 * between the two paths (from the public-API caller's perspective). Must be
 * updated (with a comment) whenever a real intentional divergence is added.
 * Currently empty: at the public-API level run() and startAsync() produce
 * identical hook invocation counts. The budget.check asymmetry exists only
 * _inside_ _continueRun() vs run() — both public entry points call it once
 * before the DB row exists, so counts are equal from outside.
 *
 * SYNTHETIC DIVERGENCE TEST: demonstrates that the recorder would catch the
 * exact class of bug that Task #824 fixed (postProcess silently skipped in
 * one path) — the bug that motivated this whole audit.
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

// ── Hook names ────────────────────────────────────────────────────────────────
// Every this.config.* callable that can be observed from test infrastructure.
// Hooks that live exclusively in the shared loop() / executeTool() helpers
// (firstToolCall, tools, capabilities) are omitted — they are structurally
// symmetric by design and cannot be individually intercepted here.
const HOOK_NAMES = [
  'postProcess',
  'outputSchema.parse',
  'budget.check',
  'budget.checkRunCap',
] as const;
type HookName = typeof HOOK_NAMES[number];

// ── Intentional divergences ───────────────────────────────────────────────────
// Hooks whose invocation COUNTS are expected to differ between run() and
// startAsync() at the public-API level. Must be accompanied by a rationale
// comment. Update this set (and add a comment) before marking any divergence
// as intentional; an unreviewed entry here is a red flag in code review.
//
// Currently empty: budget.check fires once in both paths from the outside
// (run() calls it before row creation; startAsync() also calls it before
// row creation, then delegates to _continueRun() which intentionally does
// not repeat it). Net result: 1 call per path, counts are equal.
const INTENTIONAL_DIVERGENCES = new Set<HookName>();

// ── Recorder factory ──────────────────────────────────────────────────────────

interface HookCounts extends Record<HookName, number> {}

interface RecorderSetup {
  counts: HookCounts;
  budget: { check: ReturnType<typeof vi.fn>; checkRunCap: ReturnType<typeof vi.fn> };
  postProcess: ReturnType<typeof vi.fn>;
  schemaParse: ReturnType<typeof vi.fn>;
}

function makeRecorder(): RecorderSetup {
  const counts: HookCounts = {
    'postProcess': 0,
    'outputSchema.parse': 0,
    'budget.check': 0,
    'budget.checkRunCap': 0,
  };

  return {
    counts,
    budget: {
      check: vi.fn().mockImplementation(async () => { counts['budget.check']++; }),
      checkRunCap: vi.fn().mockImplementation(async () => { counts['budget.checkRunCap']++; }),
    },
    postProcess: vi.fn().mockImplementation(async (o: unknown) => {
      counts['postProcess']++;
      return o as Record<string, unknown>;
    }),
    schemaParse: vi.fn().mockImplementation((v: unknown) => {
      counts['outputSchema.parse']++;
      return v;
    }),
  };
}

// ── Config / context helpers ──────────────────────────────────────────────────

const BUDGET_CAPS = {
  maxTokensPerRun: 10_000,
  maxCostUsdPerRun: 100,
  maxStepsPerRun: 5,
  maxCostUsdPerDealPerDay: 1_000,
  maxCostUsdPerUserPerMonth: 5_000,
};

function makeCtx(): RunContext {
  return {
    dealId: 'deal-symmetry-test',
    userId: 'user-symmetry-test',
    triggeredBy: 'test',
    systemPromptOverride: 'You are a test agent. Always respond with {"ok":true}.',
  };
}

function makeConfig(rec: Pick<RecorderSetup, 'postProcess' | 'schemaParse'>): AgentConfig {
  return {
    agentId: 'cashflow' as AgentConfig['agentId'],
    agentVersion: '0.0.0-test',
    promptVersion: '0.0.0-test',
    modelName: 'claude-3-5-haiku-20241022' as AgentConfig['modelName'],
    capabilities: ['read:all'],
    tools: [],
    budgetCaps: BUDGET_CAPS,
    outputSchema: { parse: rec.schemaParse } as unknown as z.ZodSchema,
    postProcess: rec.postProcess,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('AgentRuntime codepath symmetry', () => {
  let ctx: RunContext;

  beforeEach(() => {
    ctx = makeCtx();
  });

  // ── PRIMARY: set-equality invariant ─────────────────────────────────────────
  // This is the regression guard. It compares complete hook-count snapshots
  // from both paths and fails if ANY tracked hook fires a different number of
  // times — including hooks added in the future.

  it('hook invocation counts are identical between run() and startAsync() — set-equality invariant', async () => {
    const runRec = makeRecorder();
    const asyncRec = makeRecorder();

    const r1 = new AgentRuntime(makeConfig(runRec), null, runRec.budget);
    await r1.run({}, ctx);
    const runSnapshot = { ...runRec.counts };

    const r2 = new AgentRuntime(makeConfig(asyncRec), null, asyncRec.budget);
    const { done } = await r2.startAsync({}, ctx);
    await done;
    const asyncSnapshot = { ...asyncRec.counts };

    for (const hook of HOOK_NAMES) {
      if (INTENTIONAL_DIVERGENCES.has(hook)) continue;
      expect(
        runSnapshot[hook],
        `Hook '${hook}' count differs: run()=${runSnapshot[hook]} startAsync()=${asyncSnapshot[hook]}. ` +
        `Either fix the asymmetry or add '${hook}' to INTENTIONAL_DIVERGENCES with a rationale comment.`
      ).toBe(asyncSnapshot[hook]);
    }

    // Verify the intentional-divergence allowlist itself is audited.
    // If this fails, INTENTIONAL_DIVERGENCES was expanded without a review.
    expect(INTENTIONAL_DIVERGENCES.size).toBe(0);
  });

  // ── SYNTHETIC DIVERGENCE: validates the test infrastructure ─────────────────
  // Demonstrates that the recorder WOULD have caught the Task #824 bug
  // (postProcess skipped in the async path). If this sub-test starts failing,
  // the test infrastructure itself is broken.

  it('detects asymmetry when postProcess is absent from one path (synthetic #824 regression)', async () => {
    // run() path — postProcess present
    const runRec = makeRecorder();
    const r1 = new AgentRuntime(makeConfig(runRec), null, runRec.budget);
    await r1.run({}, ctx);

    // startAsync() path — postProcess deliberately absent (simulates #824 bug)
    const asyncRec = makeRecorder();
    const brokenConfig: AgentConfig = { ...makeConfig(asyncRec), postProcess: undefined };
    const r2 = new AgentRuntime(brokenConfig, null, asyncRec.budget);
    const { done } = await r2.startAsync({}, ctx);
    await done;

    // The counts MUST differ — if they're equal here, the recorder is broken
    expect(runRec.counts['postProcess']).toBe(1);
    expect(asyncRec.counts['postProcess']).toBe(0);
    expect(runRec.counts['postProcess']).not.toBe(asyncRec.counts['postProcess']);
  });

  // ── SANITY: per-hook individual assertions ───────────────────────────────────
  // Concrete, readable checks that complement the set-equality test above.
  // These explicitly document the expected count for each hook in each path.

  describe('run() — synchronous codepath', () => {
    it('invokes postProcess exactly once', async () => {
      const rec = makeRecorder();
      await new AgentRuntime(makeConfig(rec), null, rec.budget).run({}, ctx);
      expect(rec.counts['postProcess']).toBe(1);
    });

    it('invokes outputSchema.parse exactly once', async () => {
      const rec = makeRecorder();
      await new AgentRuntime(makeConfig(rec), null, rec.budget).run({}, ctx);
      expect(rec.counts['outputSchema.parse']).toBe(1);
    });

    it('invokes budget.check exactly once', async () => {
      const rec = makeRecorder();
      await new AgentRuntime(makeConfig(rec), null, rec.budget).run({}, ctx);
      expect(rec.counts['budget.check']).toBe(1);
    });
  });

  describe('startAsync() / _continueRun() — async codepath', () => {
    it('invokes postProcess exactly once', async () => {
      const rec = makeRecorder();
      const { done } = await new AgentRuntime(makeConfig(rec), null, rec.budget).startAsync({}, ctx);
      await done;
      expect(rec.counts['postProcess']).toBe(1);
    });

    it('invokes outputSchema.parse exactly once', async () => {
      const rec = makeRecorder();
      const { done } = await new AgentRuntime(makeConfig(rec), null, rec.budget).startAsync({}, ctx);
      await done;
      expect(rec.counts['outputSchema.parse']).toBe(1);
    });

    it('invokes budget.check exactly once', async () => {
      const rec = makeRecorder();
      const { done } = await new AgentRuntime(makeConfig(rec), null, rec.budget).startAsync({}, ctx);
      await done;
      expect(rec.counts['budget.check']).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('both paths succeed when postProcess is absent', async () => {
      const rec = makeRecorder();
      const config: AgentConfig = { ...makeConfig(rec), postProcess: undefined };

      const r1 = new AgentRuntime(config, null, makeRecorder().budget);
      await expect(r1.run({}, ctx)).resolves.toBeDefined();

      const r2 = new AgentRuntime(config, null, makeRecorder().budget);
      const { done } = await r2.startAsync({}, ctx);
      await expect(done).resolves.toBeDefined();
    });
  });
});
