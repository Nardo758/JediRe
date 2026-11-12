import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { query, snapshots } = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  snapshots: vi.fn().mockResolvedValue({ written: 1, failed: 0 }),
}));
vi.mock('../../database/connection', () => ({ getPool: () => ({ query }), query }));
vi.mock('../apartment-locator-rent-history.service', () => ({ writeRentSnapshots: snapshots }));
vi.mock('../intake-sources/apartment-locator', () => ({ upsertApartmentLocatorJob: vi.fn() }));
vi.mock('../property-entity/property-dual-write.service', () => ({ isDualWriteEnabled: () => false }));
vi.mock('../property-entity/property-characteristics.service', () => ({ propertyCharacteristicsService: {} }));
vi.mock('../property-entity/property-operating-data.service', () => ({ propertyOperatingDataService: {} }));
vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { ApartmentLocatorSyncService } from '../apartment-locator-sync.service';

describe('Apartment Locator city sync history wiring', () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => vi.clearAllMocks());
  it('uses only the three existing endpoints and persists both row sets', async () => {
    const comp = { property_id: 'comp-1', bedrooms: 1, rent: 1500 };
    const supply = { id: 'supply-1', rent: 1800, address: '123 Test', city: 'Test', state: 'GA' };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/market-data?')) return { ok: true, json: async () => ({ success: true, data: {
        supply: {}, pricing: { avg_rent_by_type: {} }, demand: {}, forecast: {},
      } }) };
      if (url.includes('/rent-comps?')) return { ok: true, json: async () => ({ success: true, data: [comp] }) };
      if (url.includes('/supply-pipeline?')) return { ok: true, json: async () => ({ success: true, data: [supply] }) };
      throw new Error('Unexpected external endpoint');
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await new ApartmentLocatorSyncService().syncCity('Test', 'GA');
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(snapshots).toHaveBeenCalledWith(expect.anything(), [supply], 'supply-pipeline', 'Test', 'GA', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(snapshots).toHaveBeenCalledWith(expect.anything(), [comp], 'rent-comps', 'Test', 'GA', snapshots.mock.calls[0][5]);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO apartment_locator_properties'))).toBe(true);
  });

  it('still completes the city when every snapshot write was isolated as failed', async () => {
    snapshots.mockResolvedValueOnce({ written: 0, failed: 1 }).mockResolvedValueOnce({ written: 0, failed: 1 });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        success: true,
        data: url.includes('/market-data?')
          ? { supply: {}, pricing: { avg_rent_by_type: {} }, demand: {}, forecast: {} }
          : [],
      }),
    })));
    const result = await new ApartmentLocatorSyncService().syncCity('Test', 'GA');
    expect(result.success).toBe(true);
    expect(result.stats.rent_snapshots_failed).toBe(2);
    expect(query.mock.calls.some(([sql]) => sql.includes('END AS asset_class'))).toBe(true);
  });
});
