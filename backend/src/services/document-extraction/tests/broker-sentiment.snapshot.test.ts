/**
 * Persistence-contract test for `scoreBrokerSentiment` (Task #391).
 *
 * The happy-path of the OM pipeline must produce an actual sentiment snapshot
 * in `market_sentiment_history` (source='broker_om') for every resolved
 * market key. The pipeline-level integration test in
 * `dataLibrary.runOmPipeline.test.ts` mocks `scoreBrokerSentiment` wholesale
 * for control over the failure branches, so this companion test exercises
 * the persistence side-effect end-to-end: jediAI returns a structured label,
 * `recordSentimentSnapshot` is invoked once per (msa, submarket) target with
 * the correct score, source, and entity identifiers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ai/aiService', () => ({
  jediAI: { generate: vi.fn() },
}));

vi.mock('../../sentiment-history.service', () => ({
  recordSentimentSnapshot: vi.fn(),
  labelToScore: (label: 'bullish' | 'neutral' | 'bearish'): -1 | 0 | 1 =>
    label === 'bullish' ? 1 : label === 'bearish' ? -1 : 0,
}));

vi.mock('../../../database/connection', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  getPool: vi.fn(() => ({})),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// KG ingestion fans out via dynamic import — stub it so the test doesn't
// require the neural-network module graph.
vi.mock('../../neural-network/knowledge-graph.service', () => ({
  getKnowledgeGraph: () => ({ upsertNode: vi.fn().mockResolvedValue(undefined) }),
}));

import { jediAI } from '../../ai/aiService';
import { recordSentimentSnapshot } from '../../sentiment-history.service';
import { scoreBrokerSentiment } from '../broker-sentiment.service';

const generateMock = jediAI.generate as unknown as ReturnType<typeof vi.fn>;
const recordMock = recordSentimentSnapshot as unknown as ReturnType<typeof vi.fn>;

describe('scoreBrokerSentiment persistence', () => {
  beforeEach(() => {
    generateMock.mockReset();
    recordMock.mockReset();
  });

  it('records a broker_om snapshot for every resolved market key', async () => {
    generateMock.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          label: 'bullish',
          score: 1,
          rationale: 'Strong submarket fundamentals.',
        }),
      }],
    });
    recordMock.mockResolvedValue({ ok: true });

    const result = await scoreBrokerSentiment({
      thesis: 'Buckhead is poised for rent growth.',
      highlights: ['Walkable to MARTA', 'Class A finishes'],
      msaKey: 'msa:12060',
      submarketKey: 'submarket:cbre:atl-buckhead',
      userId: null,
      fileId: 42,
    });

    expect(result).not.toBeNull();
    expect(result!.label).toBe('bullish');
    expect(result!.score).toBe(1);

    // Snapshot persisted once per target — msa AND submarket.
    expect(recordMock).toHaveBeenCalledTimes(2);

    const calls = recordMock.mock.calls.map(c => c[0]);
    expect(calls).toContainEqual({
      entityType: 'msa',
      entityId: '12060',
      agentScore: 1,
      source: 'broker_om',
    });
    expect(calls).toContainEqual({
      entityType: 'submarket',
      entityId: 'atl-buckhead',
      agentScore: 1,
      source: 'broker_om',
    });

    expect(result!.recordedFor.map(r => r.entityType).sort())
      .toEqual(['msa', 'submarket']);
    expect(result!.recordedFor.every(r => r.ok)).toBe(true);
  });

  it('returns null and records nothing when the OM has no narrative text', async () => {
    const result = await scoreBrokerSentiment({
      thesis: null,
      highlights: [],
      msaKey: 'msa:12060',
      submarketKey: 'submarket:cbre:atl-buckhead',
      userId: null,
      fileId: 43,
    });

    expect(result).toBeNull();
    expect(generateMock).not.toHaveBeenCalled();
    expect(recordMock).not.toHaveBeenCalled();
  });
});
