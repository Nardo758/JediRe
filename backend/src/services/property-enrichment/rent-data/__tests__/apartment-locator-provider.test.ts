import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../database/connection', () => ({ query: vi.fn() }));
vi.mock('../../../../utils/logger', () => ({ logger: { warn: vi.fn() } }));
import { query } from '../../../../database/connection';
import { ApartmentLocatorRentProvider } from '../apartment-locator-provider';
import { RentDataProviderRegistry } from '../provider-registry';

describe('local Apartment Locator rent provider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network is forbidden'); }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('registers the local provider, never Apartments.com, and returns clean no-data', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const registry = new RentDataProviderRegistry();
    expect(registry.getProviders().map(p => p.config.name)).toEqual(['apartment_locator_ai']);
    expect(await registry.fetchRentData('123 Test', 'Test', 'GA')).toEqual({ data: null, provider: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns actual local floor plans without inventing inventory or effective rent', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{
      unit_type_key: 'b2-ba2-sf1100', bedrooms: '2', bathrooms: '2', square_feet: 1100,
      asking_rent: '1800', total_units: 100, rent_per_sqft: '1.6364', snapshot_date: '2026-11-11',
    }] } as any);
    const data = await new ApartmentLocatorRentProvider().fetchRentData('123 Test', 'Test', 'GA');
    expect(data?.unitMix[0]).toMatchObject({ beds: 2, baths: 2, sqFt: 1100, askingRent: 1800, unitCount: 0 });
    expect(data?.totalUnits).toBe(100);
    expect(data?.avgEffectiveRent).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts property-level fallback data without inventing a unit mix', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ asking_rent: '1500', total_units: 90, snapshot_date: '2026-11-10' }] } as any);
    const result = await new RentDataProviderRegistry().fetchRentData('123 Test', 'Test', 'GA');
    expect(result.provider).toBe('apartment_locator_ai');
    expect(result.data?.unitMix).toEqual([]);
    expect(result.data?.avgAskingRent).toBe(1500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns no data cleanly after a database failure', async () => {
    vi.mocked(query).mockRejectedValue(new Error('DB unavailable'));
    expect(await new RentDataProviderRegistry().fetchRentData('123 Test', 'Test', 'GA')).toEqual({ data: null, provider: null });
  });
});
