/**
 * Tests for the auto-tagging behavior of `discoveryEngine.storeNewsDiscovery`
 * and the helper `matchActiveDealsForNews`. Verifies that ingested trade-press
 * items are matched against active deals by MSA / city without requiring a
 * per-deal manual scan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database `query` function so the matcher can be exercised without
// hitting Postgres, and so we can capture the SQL that gets emitted.
const queryMock = vi.fn();
vi.mock('../../../database/connection', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

// Silence event dispatch — we don't care about side effects here.
vi.mock('../../agents/event-dispatcher', () => ({
  eventDispatcher: { onNewsAlert: vi.fn() },
}));

// Import after mocks so the mocked modules are picked up.
import { discoveryEngine } from '../discovery-engine';
import type { NewsDiscovery } from '../discovery-engine';

const ATL_DEAL_ID = '11111111-1111-1111-1111-111111111111';
const DAL_DEAL_ID = '22222222-2222-2222-2222-222222222222';
const NYC_DEAL_ID = '33333333-3333-3333-3333-333333333333';

const ACTIVE_DEAL_ROWS = [
  { id: ATL_DEAL_ID, city: 'Atlanta', msa_name: 'Atlanta-Sandy Springs-Roswell, GA' },
  { id: DAL_DEAL_ID, city: 'Dallas', msa_name: 'Dallas-Fort Worth-Arlington, TX' },
  { id: NYC_DEAL_ID, city: 'New York', msa_name: 'New York-Newark-Jersey City, NY-NJ-PA' },
];

function makeNews(overrides: Partial<NewsDiscovery> = {}): NewsDiscovery {
  return {
    id: overrides.id || 'cre_test_item',
    headline: overrides.headline || 'Some headline',
    source: overrides.source || 'Test Source',
    url: overrides.url || 'https://example.com/article',
    publishedAt: overrides.publishedAt || new Date('2026-04-30T00:00:00Z'),
    summary: overrides.summary,
    category: overrides.category || 'cre_press',
    relevantMsas: overrides.relevantMsas,
    relevantDeals: overrides.relevantDeals,
  };
}

describe('discoveryEngine MSA/city auto-tagging', () => {
  beforeEach(() => {
    queryMock.mockReset();
    discoveryEngine.invalidateActiveDealsCache();
  });

  it('matches a news item to a deal via the feed marketHint (relevantMsas)', async () => {
    queryMock.mockResolvedValueOnce({ rows: ACTIVE_DEAL_ROWS });

    const matched = await discoveryEngine.matchActiveDealsForNews(
      makeNews({
        headline: 'Some unrelated headline',
        relevantMsas: ['Atlanta'],
      })
    );

    expect(matched).toEqual([ATL_DEAL_ID]);
  });

  it('matches via headline text when no marketHint is provided', async () => {
    queryMock.mockResolvedValueOnce({ rows: ACTIVE_DEAL_ROWS });

    const matched = await discoveryEngine.matchActiveDealsForNews(
      makeNews({
        headline: 'Dallas multifamily market sees record absorption',
      })
    );

    expect(matched).toEqual([DAL_DEAL_ID]);
  });

  it('matches multiple deals when their cities both appear in the article', async () => {
    queryMock.mockResolvedValueOnce({ rows: ACTIVE_DEAL_ROWS });

    const matched = await discoveryEngine.matchActiveDealsForNews(
      makeNews({
        headline: 'New York and Atlanta lead Q1 leasing activity',
      })
    );

    expect(matched.sort()).toEqual([ATL_DEAL_ID, NYC_DEAL_ID].sort());
  });

  it('returns no matches when nothing in the article relates to active deals', async () => {
    queryMock.mockResolvedValueOnce({ rows: ACTIVE_DEAL_ROWS });

    const matched = await discoveryEngine.matchActiveDealsForNews(
      makeNews({
        headline: 'Boise office sales tick up',
        summary: 'Idaho secondary market activity',
      })
    );

    expect(matched).toEqual([]);
  });

  it('caches the active-deals query across consecutive calls', async () => {
    queryMock.mockResolvedValueOnce({ rows: ACTIVE_DEAL_ROWS });

    await discoveryEngine.matchActiveDealsForNews(makeNews({ relevantMsas: ['Atlanta'] }));
    await discoveryEngine.matchActiveDealsForNews(makeNews({ relevantMsas: ['Dallas'] }));
    await discoveryEngine.matchActiveDealsForNews(makeNews({ relevantMsas: ['New York'] }));

    // Only the first call should hit the deals table.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('storeNewsDiscovery writes auto-matched deals into relevant_deals', async () => {
    // First call: getActiveDealsForMatching loads deal rows.
    queryMock.mockResolvedValueOnce({ rows: ACTIVE_DEAL_ROWS });
    // Second call: the INSERT — return the synthetic xmax=0 inserted flag.
    queryMock.mockResolvedValueOnce({ rows: [{ inserted: true }] });

    const news = makeNews({
      id: 'cre_atl_test',
      headline: 'A headline that does not name any city',
      relevantMsas: ['Atlanta'],
    });

    const outcome = await discoveryEngine.storeNewsDiscovery(news);
    expect(outcome).toBe('inserted');

    // Inspect the INSERT call args — relevant_deals (param index 8) should be
    // a JSON array containing the auto-matched Atlanta deal id.
    expect(queryMock).toHaveBeenCalledTimes(2);
    const insertArgs = queryMock.mock.calls[1];
    const params = insertArgs[1] as unknown[];
    const relevantDealsParam = params[8];
    expect(typeof relevantDealsParam).toBe('string');
    const parsed = JSON.parse(relevantDealsParam as string);
    expect(parsed).toContain(ATL_DEAL_ID);
  });

  it('storeNewsDiscovery merges auto-matched deals with caller-provided ones', async () => {
    queryMock.mockResolvedValueOnce({ rows: ACTIVE_DEAL_ROWS });
    queryMock.mockResolvedValueOnce({ rows: [{ inserted: false }] });

    const news = makeNews({
      id: 'cre_merge_test',
      headline: 'Atlanta apartment market update',
      relevantDeals: [DAL_DEAL_ID], // caller already attached an unrelated deal
    });

    await discoveryEngine.storeNewsDiscovery(news);

    const insertArgs = queryMock.mock.calls[1];
    const params = insertArgs[1] as unknown[];
    const parsed = JSON.parse(params[8] as string);
    expect(parsed.sort()).toEqual([ATL_DEAL_ID, DAL_DEAL_ID].sort());
  });

  it('backfillRecentNewsAutoTags additively updates existing relevant_deals', async () => {
    // 1) SELECT recent rows from news_discoveries — return three rows in
    //    different states so we exercise additive merging, dedupe, and skip.
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          // Row A: untagged, headline names Atlanta → should add ATL.
          id: 'cre_row_a',
          headline: 'Atlanta multifamily Q2 update',
          source: 'GlobeSt',
          url: 'https://example.com/a',
          published_at: new Date('2026-04-30T00:00:00Z'),
          summary: null,
          category: 'cre_press',
          relevant_msas: null,
          relevant_deals: null,
        },
        {
          // Row B: already tagged with NYC, headline names Dallas → should
          // add DAL but NOT re-add NYC (additive merge with dedupe).
          id: 'cre_row_b',
          headline: 'Dallas leasing absorption tops list',
          source: 'Bisnow',
          url: 'https://example.com/b',
          published_at: new Date('2026-04-29T00:00:00Z'),
          summary: 'Dallas market commentary',
          category: 'cre_press',
          relevant_msas: ['Dallas'],
          relevant_deals: [NYC_DEAL_ID],
        },
        {
          // Row C: already tagged with ATL via prior auto-match — matcher
          // returns ATL, but it's already present, so no UPDATE should fire.
          id: 'cre_row_c',
          headline: 'Atlanta capital markets recap',
          source: 'Bisnow',
          url: 'https://example.com/c',
          published_at: new Date('2026-04-28T00:00:00Z'),
          summary: null,
          category: 'cre_press',
          relevant_msas: ['Atlanta'],
          relevant_deals: [ATL_DEAL_ID],
        },
      ],
    });
    // 2) Inside the loop, the first row triggers getActiveDealsForMatching
    //    (cached for the rest of the loop).
    queryMock.mockResolvedValueOnce({ rows: ACTIVE_DEAL_ROWS });
    // 3) Two UPDATE calls expected (rows A and B); each just needs to resolve.
    queryMock.mockResolvedValueOnce({ rows: [] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const updated = await discoveryEngine.backfillRecentNewsAutoTags({ sinceHours: 24, limit: 100 });

    expect(updated).toBe(2);

    // Total query calls: 1 (deals) + 1 (select) + 2 (updates) = 4.
    expect(queryMock).toHaveBeenCalledTimes(4);

    // First UPDATE = row A; should append ATL only.
    const updateA = queryMock.mock.calls[2];
    expect(updateA[0]).toContain('UPDATE news_discoveries');
    const paramsA = updateA[1] as unknown[];
    expect(paramsA[0]).toBe('cre_row_a');
    const additionsA = JSON.parse(paramsA[1] as string);
    expect(additionsA).toEqual([ATL_DEAL_ID]);

    // Second UPDATE = row B; should append DAL only (NYC already present,
    // so the additions array must NOT include NYC).
    const updateB = queryMock.mock.calls[3];
    const paramsB = updateB[1] as unknown[];
    expect(paramsB[0]).toBe('cre_row_b');
    const additionsB = JSON.parse(paramsB[1] as string);
    expect(additionsB).toEqual([DAL_DEAL_ID]);
    expect(additionsB).not.toContain(NYC_DEAL_ID);
  });

  it('storeNewsDiscovery still inserts when matching fails', async () => {
    // First call (getActiveDealsForMatching) blows up.
    queryMock.mockRejectedValueOnce(new Error('db down'));
    // Second call (the actual insert) succeeds.
    queryMock.mockResolvedValueOnce({ rows: [{ inserted: true }] });

    const news = makeNews({ id: 'cre_safe', relevantMsas: ['Atlanta'] });
    const outcome = await discoveryEngine.storeNewsDiscovery(news);

    expect(outcome).toBe('inserted');
    // The relevant_deals param should be null since matching failed and
    // the caller didn't supply any deals.
    const insertArgs = queryMock.mock.calls[1];
    const params = insertArgs[1] as unknown[];
    expect(params[8]).toBeNull();
  });
});
