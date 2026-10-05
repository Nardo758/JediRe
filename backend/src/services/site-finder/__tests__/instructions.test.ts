import { describe, it, expect, vi } from 'vitest';
const { understand } = vi.hoisted(() => ({ understand: vi.fn() }));
vi.mock('../instruction-agent', async importOriginal => ({
  ...await importOriginal<typeof import('../instruction-agent')>(), understandInstruction: understand,
}));
vi.mock('../../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
import { SiteFinderInstructions } from '../instructions';
import { SiteFinderRuns } from '../runs';
const id = '9d9271a5-bbee-422a-a31e-a9c434398412';
const text = 'Find parcels over 3 acres zoned for assisted living in Broward';
const criteria = { counties: ['Broward'], intendedUse: 'assisted living', area: { unit: 'acres', min: 3, minInclusive: false, maxInclusive: true }, limit: 50 };
function fixture(options: { catalogFails?: boolean; active?: number; existing?: any; prior?: any } = {}) {
  let snapshot: any = options.existing;
  let claimed = false;
  const query = vi.fn(async (sql: string, args?: any[]) => {
    if (sql.includes('FROM property_types')) {
      if (options.catalogFails) throw new Error('private database details');
      return { rows: [{ type_key: 'warehouse', display_name: 'Warehouse', category: 'Industrial' }] };
    }
    if (sql.includes('RETURNING snapshot,owner_id,prior')) {
      if (!snapshot || claimed) return { rows: [] };
      claimed = true;
      return { rows: [{ snapshot: { ...snapshot, status: 'understanding' }, owner_id: 'owner', prior: options.prior }] };
    }
    if (sql.includes('SELECT snapshot,prior')) return { rows: options.prior ? [{ snapshot: { id, text, status: 'clarification', message: 'Which care?' }, prior: null }] : [] };
    if (sql.includes('SELECT snapshot FROM site_finder_instructions')) return { rows: snapshot && (!sql.includes('owner_id=$2') || args?.[1] === 'owner') ? [{ snapshot }] : [] };
    if (sql.includes('FILTER')) return { rows: [{ active: options.active ?? 0, recent: 0 }] };
    if (sql.includes('INSERT INTO site_finder_instructions')) { snapshot = JSON.parse(args![2]); return { rows: [] }; }
    if (sql.includes('SET snapshot=$3')) { snapshot = JSON.parse(args![2]); return { rows: [] }; }
    return { rows: [] };
  });
  const pool = { query, connect: async () => ({ query, release: vi.fn() }) } as any;
  const runs = { ensureReady: vi.fn(), create: vi.fn().mockResolvedValue({ id, criteria }), get: vi.fn().mockResolvedValue(null) } as unknown as SiteFinderRuns;
  const service = new SiteFinderInstructions(pool, runs);
  return { service, runs, query, snapshot: () => snapshot };
}
describe('single-submit durable instruction flow', () => {
  it('one instruction automatically reaches the existing bounded run once; same HTTP id never repeats work', async () => {
    understand.mockResolvedValue({ kind: 'search', criteria });
    const f = fixture();
    await f.service.submit('owner', id, text);
    await vi.waitFor(() => expect(f.snapshot().status).toBe('searching'));
    expect(f.runs.create).toHaveBeenCalledTimes(1);
    expect(f.runs.create).toHaveBeenCalledWith('owner', criteria, id, true);
    await f.service.submit('owner', id, text);
    expect(f.runs.create).toHaveBeenCalledTimes(1);
    expect(await f.service.get(id, 'other')).toBeNull();
    await expect(f.service.submit('other', id, text)).rejects.toMatchObject({ status: 409 });
    expect(f.query.mock.calls.some(([sql]) => /INSERT INTO deals|UPDATE deal_assumptions/.test(sql))).toBe(false);
    f.service.stop();
  });
  it('clarification starts no search', async () => {
    understand.mockResolvedValue({ kind: 'clarification', message: 'Which care model?' });
    const f = fixture(); await f.service.submit('owner', id, text);
    await vi.waitFor(() => expect(f.snapshot().status).toBe('clarification'));
    expect(f.runs.create).not.toHaveBeenCalled();
    f.service.stop();
  });
  it('catalog/provider failures keep saved text and create no run', async () => {
    understand.mockRejectedValue({ status: 429 });
    for (const catalogFails of [true, false]) {
      const f = fixture({ catalogFails }); await f.service.submit('owner', id, text);
      await vi.waitFor(() => expect(f.snapshot().status).toBe('error'));
      expect(f.snapshot().text).toBe(text);
      expect(f.snapshot().message).toContain(catalogFails ? 'catalog' : 'rate limited');
      expect(f.runs.create).not.toHaveBeenCalled(); f.service.stop();
    }
  });
  it('rejects quota exhaustion, missing/other-owner clarification, or modified id before invoking the agent', async () => {
    const limited = fixture({ active: 2 });
    await expect(limited.service.submit('owner', id, text)).rejects.toMatchObject({ status: 429 }); limited.service.stop();
    const missing = fixture();
    await expect(missing.service.submit('owner', id, text, id)).rejects.toMatchObject({ status: 404 }); missing.service.stop();
    const reused = fixture({ existing: { id, text, status: 'error' } });
    await expect(reused.service.submit('owner', id, 'changed')).rejects.toMatchObject({ status: 409 }); reused.service.stop();
  });
});