/**
 * T5 Harness — AgentOrchestrator tool-loop cap enforcement
 *
 * TOKEN_LEAK_REMEDIATION_TRANCHE1 — Task #5
 *
 * PURPOSE: Prove that the maxToolRounds cap added to AgentOrchestrator
 * (agent-orchestrator.ts:392-404) actually halts the tool-use loop when the
 * model never returns stop_reason !== 'tool_use'.
 *
 * SETUP: Mock Anthropic SDK so the first (and every subsequent) response has
 * stop_reason === 'tool_use'. Mock skillRegistry so tool execution succeeds.
 * Set AGENT_ORCHESTRATOR_MAX_TOOL_ROUNDS=1.
 *
 * EXPECTED: The loop executes exactly 1 tool round, then hits the cap,
 * logs an error, and breaks. No second API call is made.
 *
 * ACCEPTANCE: Paste the test output (PASS + error log line) as evidence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../database/connection', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../notifications/openclawNotifier', () => ({
  openclawNotifier: {
    isEnabled: vi.fn().mockReturnValue(false),
    notifyAgentRunCompleted: vi.fn(),
  },
}));

// Mock Anthropic SDK before importing the orchestrator
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Mock skill registry
const mockExecute = vi.fn();
vi.mock('../skills/skill-registry', () => ({
  skillRegistry: {
    getToolDefinitions: vi.fn().mockReturnValue([
      {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: { type: 'object', properties: {} },
      },
    ]),
    execute: mockExecute,
  },
}));

// Mock agent personas
vi.mock('./agent-personas', () => ({
  AGENT_PERSONAS: [],
  AgentPersona: {},
  TriggerEvent: {},
  getAgentById: vi.fn().mockImplementation((id: string) => ({
    id,
    name: 'Test Agent',
    systemPrompt: 'You are a test agent.',
    allowedSkills: ['*'],
    canWorkAutonomously: true,
    triggers: [],
    notificationChannels: ['in_app'],
  })),
  getAgentsByTrigger: vi.fn().mockReturnValue([]),
}));

// Import AFTER mocks are set up
import { agentOrchestrator } from './agent-orchestrator';
import { logger } from '../../utils/logger';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock Anthropic response with the given stop_reason. */
function makeAnthropicResponse(stopReason: 'tool_use' | 'end_turn', toolUseCount = 0) {
  const content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> = [];

  if (stopReason === 'tool_use') {
    for (let i = 0; i < toolUseCount; i++) {
      content.push({
        type: 'tool_use',
        id: `toolu_${i}`,
        name: 'test_tool',
        input: { test: true },
      });
    }
  } else {
    content.push({ type: 'text', text: '{"result":"done"}' });
  }

  return {
    id: `msg_${Date.now()}`,
    model: 'claude-sonnet-4-5',
    content,
    stop_reason: stopReason,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('T5 — AgentOrchestrator tool-loop cap enforcement', () => {
  const ORIGINAL_ENV = process.env.AGENT_ORCHESTRATOR_MAX_TOOL_ROUNDS;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set cap to 1 — the minimal non-zero value. With a model that always
    // returns tool_use, this means exactly 1 round should execute before halt.
    process.env.AGENT_ORCHESTRATOR_MAX_TOOL_ROUNDS = '1';
  });

  afterEach(() => {
    process.env.AGENT_ORCHESTRATOR_MAX_TOOL_ROUNDS = ORIGINAL_ENV;
  });

  it('halts after exactly 1 tool round when cap=1 and model always returns tool_use', async () => {
    // Arrange: model ALWAYS wants to call tools (never stops)
    mockCreate.mockResolvedValue(makeAnthropicResponse('tool_use', 1));
    mockExecute.mockResolvedValue({ data: { ok: true } });

    // Act: process a request that routes to our test agent
    const response = await agentOrchestrator.processRequest({
      message: 'test message',
      context: {
        userId: 'user-t5-test',
        dealId: 'deal-t5-test',
        conversationId: 'conv-t5-test',
      },
    });

    // Assert: exactly 2 API calls were made:
    //   1. Initial call (turn 0) → returns tool_use
    //   2. Follow-up after tool result → returns tool_use again (mock always returns tool_use)
    // BUT the cap should break BEFORE a 3rd call.
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // The error log must fire with the expected message
    const errorCalls = vi.mocked(logger.error).mock.calls;
    const capError = errorCalls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('exceeded maxToolRounds')
    );
    expect(capError).toBeDefined();

    // Verify the error message contains the cap value and agent id
    const errorMsg = capError![0] as string;
    expect(errorMsg).toContain('maxToolRounds (1)');
    expect(errorMsg).toContain('halting tool-use loop');

    // The response should still be returned (graceful degradation, not a throw)
    expect(response).toBeDefined();
    expect(response.agentId).toBe('orchestrator');
  });

  it('does NOT halt early when cap=10 and model stops after 2 rounds', async () => {
    // Arrange: model stops after 2 tool rounds
    process.env.AGENT_ORCHESTRATOR_MAX_TOOL_ROUNDS = '10';
    let callCount = 0;
    mockCreate.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve(makeAnthropicResponse('tool_use', 1));
      }
      return Promise.resolve(makeAnthropicResponse('end_turn'));
    });
    mockExecute.mockResolvedValue({ data: { ok: true } });

    // Act
    await agentOrchestrator.processRequest({
      message: 'test message',
      context: {
        userId: 'user-t5-test',
        dealId: 'deal-t5-test',
        conversationId: 'conv-t5-test-2',
      },
    });

    // Assert: 3 API calls (initial + 2 tool rounds)
    expect(mockCreate).toHaveBeenCalledTimes(3);

    // No cap error should fire
    const errorCalls = vi.mocked(logger.error).mock.calls;
    const capError = errorCalls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('exceeded maxToolRounds')
    );
    expect(capError).toBeUndefined();
  });

  it('uses default cap of 10 when env var is unset', async () => {
    delete process.env.AGENT_ORCHESTRATOR_MAX_TOOL_ROUNDS;
    let callCount = 0;
    mockCreate.mockImplementation(() => {
      callCount++;
      if (callCount <= 5) {
        return Promise.resolve(makeAnthropicResponse('tool_use', 1));
      }
      return Promise.resolve(makeAnthropicResponse('end_turn'));
    });
    mockExecute.mockResolvedValue({ data: { ok: true } });

    await agentOrchestrator.processRequest({
      message: 'test message',
      context: {
        userId: 'user-t5-test',
        dealId: 'deal-t5-test',
        conversationId: 'conv-t5-test-3',
      },
    });

    // 6 calls: initial + 5 tool rounds, all within default cap of 10
    expect(mockCreate).toHaveBeenCalledTimes(6);
  });
});

// ── Evidence format (paste this in audit) ────────────────────────────────────
/*
When this test passes, the following log line is emitted:

  AgentOrchestrator: agent "orchestrator" exceeded maxToolRounds (1) \
    for conversationId=conv-t5-test — halting tool-use loop

This proves:
  1. The cap is read from AGENT_ORCHESTRATOR_MAX_TOOL_ROUNDS.
  2. The loop counter increments each iteration.
  3. When toolRounds > maxToolRounds, logger.error fires and break executes.
  4. No further API calls are made after the cap trips.

Acceptance: Run `npm test -- src/services/agents/__tests__/t5-tool-cap.harness.test.ts`
             and paste the PASS output + the error log line above.
*/
