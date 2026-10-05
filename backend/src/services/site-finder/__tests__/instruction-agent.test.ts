import { describe, it, expect, vi, beforeEach } from 'vitest';
const { run, configs } = vi.hoisted(() => ({ run: vi.fn(), configs: [] as any[] }));
vi.mock('../../../agents/runtime/AgentRuntime', () => ({ AgentRuntime: class {
  constructor(config: any) { configs.push(config); }
  run = run;
} }));
vi.mock('../../../agents/runtime/MeteringAdapter', () => ({ MeteringAdapter: class {} }));
vi.mock('../../../database/connection', () => ({ query: vi.fn() }));
import { InstructionOutput, normalizeInstructionOutput, summarizeCriteria, understandInstruction, instructionFailure } from '../instruction-agent';
import { areaMatches } from '../criteria';
import { BudgetExceededError } from '../../../agents/runtime/types';

const catalog = [{ type_key: 'warehouse', display_name: 'Warehouse', category: 'Industrial' }];
const search = { kind: 'search', criteria: {
  counties: ['Broward'], area: { unit: 'acres', min: 3, minInclusive: false },
  intendedUse: 'assisted living', typeSemantics: 'proposed', limit: 50,
} };
describe('narrowly scoped metered instruction agent', () => {
  beforeEach(() => { run.mockReset(); configs.length = 0; });
  it('calls the runtime with an owned, deal-independent user context and no execution tools', async () => {
    run.mockResolvedValue(search);
    const out = await understandInstruction('owner', 'Find parcels over 3 acres zoned for assisted living in Broward', catalog);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ text: expect.any(String), catalog }), expect.objectContaining({ userId: 'owner', triggeredBy: 'user' }));
    expect(run.mock.calls[0][1]).not.toHaveProperty('dealId');
    expect(configs[0]).toMatchObject({ agentId: 'site-finder', tools: [], capabilities: [], requestTimeoutMs: 45000, providerMaxRetries: 0,
      budgetCaps: { maxStepsPerRun: 1, maxTokensPerRun: 1200 } });
    if (out.kind !== 'search') throw new Error('Expected search');
    expect(out.criteria.counties).toEqual(['Broward']);
    expect(out.criteria.intendedUse).toBe('assisted living');
    expect(out.criteria.propertyType).toBeUndefined();
    expect(out.criteria.zoning).toBeUndefined();
    expect(areaMatches(130680, out.criteria.area)).toBe(false);
    expect(areaMatches(130680.001, out.criteria.area)).toBe(true);
    expect(summarizeCriteria(out.criteria).join(' ')).toContain('> 3 acres');
  });
  it('validates a single fenced JSON response but rejects prose, fabricated results, extra predicates and unsupported geography', () => {
    expect(normalizeInstructionOutput({ raw: '```json\n' + JSON.stringify(search) + '\n```' })).toMatchObject(search);
    for (const raw of [
      { raw: 'Here are invented sites: ' + JSON.stringify(search) },
      { ...search, parcels: [{ id: 'invented' }] },
      { ...search, criteria: { ...search.criteria, counties: ['Orange'] } },
      { ...search, criteria: { ...search.criteria, priceMax: 100000 } },
      { ...search, criteria: { ...search.criteria, area: { unit: 'acres', min: 3 } } },
    ]) expect(() => normalizeInstructionOutput(raw)).toThrow();
  });
  it('passes clarification without execution and preserves earlier requirements in a follow-up', async () => {
    run.mockResolvedValue({ kind: 'clarification', message: 'Which care model: assisted living or independent apartments?' });
    const prior = { text: 'Find senior housing in Broward over 3 acres', message: 'Which care model?' };
    const out = await understandInstruction('owner', 'Assisted living', catalog, prior);
    expect(out.kind).toBe('clarification');
    expect(run.mock.calls[0][0].prior).toEqual(prior);
  });
  it('does not execute unknown catalog types or ambiguous uses', async () => {
    for (const criteria of [
      { ...search.criteria, propertyType: 'invented' },
      { ...search.criteria, intendedUse: 'senior housing' },
      { ...search.criteria, area: { unit: 'acres', min: 5, max: 3, minInclusive: true, maxInclusive: true } },
    ]) {
      run.mockResolvedValue({ kind: 'search', criteria });
      expect((await understandInstruction('owner', 'test', catalog)).kind).toBe('clarification');
    }
  });
  it('maps budget, provider, rate limit, invalid output and unknown errors without exposing internals', () => {
    expect(instructionFailure(new BudgetExceededError('secret internal budget detail'))).toContain('budget');
    expect(instructionFailure({ status: 429 })).toContain('rate limited');
    expect(instructionFailure({ status: 401, message: 'private provider details' })).toContain('administrator');
    expect(instructionFailure({ name: 'ZodError' })).toContain('invalid search response');
    expect(instructionFailure(new Error('database password private'))).not.toContain('password');
    expect(InstructionOutput.safeParse({ kind: 'search', criteria: null }).success).toBe(false);
  });
});