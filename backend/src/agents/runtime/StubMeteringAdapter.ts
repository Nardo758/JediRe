/**
 * StubMeteringAdapter — Test fixture for budget enforcement integration tests.
 *
 * Extends MeteringAdapter to override createMessage() with a deterministic
 * stub that returns a synthetic MeteredMessage with a high cost_usd (0.10),
 * guaranteeing that BudgetEnforcer.checkRunCap() triggers on the first
 * model-call iteration when the per-run cap is below $0.10.
 *
 * All other AgentRuntime paths (row creation, step persistence, error capture,
 * status update) run against real DB tables, making this a realistic integration
 * fixture without any Anthropic API calls.
 *
 * Usage (dependency injection — no global state mutation):
 *   const runtime = new AgentRuntime(config, new StubMeteringAdapter(), new BudgetEnforcer());
 *   await runtime.run(input, ctx);   // throws BudgetExceededError on first call
 */

import Anthropic from '@anthropic-ai/sdk';
import { MeteringAdapter, type MessageParams, type MeteredMessage } from './MeteringAdapter';

export class StubMeteringAdapter extends MeteringAdapter {
  constructor() {
    // Dummy Anthropic client — SDK constructor requires an apiKey but the real
    // client is never called because createMessage() is fully overridden below.
    super(new Anthropic({ apiKey: 'stub-not-used' }));
  }

  /**
   * Returns a minimal synthetic MeteredMessage with cost_usd=0.10.
   * The high cost immediately exceeds the test's per-run cap ($0.001),
   * causing BudgetEnforcer to throw BudgetExceededError on the first call.
   *
   * Content is empty because the budget check fires before the content is parsed.
   */
  override async createMessage(params: MessageParams): Promise<MeteredMessage> {
    const stub: MeteredMessage = {
      id:            'stub-msg-budget-test',
      type:          'message',
      role:          'assistant',
      content:       [],
      model:         params.model,
      stop_reason:   'end_turn',
      stop_sequence: null,
      usage:         {
        input_tokens:  1000,
        output_tokens: 500,
        cost_usd:      0.10,  // exceeds maxCostUsdPerRun=$0.001 → BudgetExceededError
      },
    } as MeteredMessage;     // cast required: Anthropic.Message has platform-internal fields
    return stub;
  }
}
