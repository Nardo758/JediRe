import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { Pool, PoolClient } from 'pg';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { unitTypeKey, writeRentSnapshots } from '../apartment-locator-rent-history.service';

vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('unit type identity', () => {
  it('normalizes numeric strings, decimals, and exact sqft deterministically', () => {
    expect(unitTypeKey({ bedrooms: '2.0', bathrooms: '2.00', square_feet: '1100' }))
      .toBe('b2-ba2-sf1100');
    expect(unitTypeKey({ bedrooms: 2, bathrooms: 2, square_feet: 1100 }))
      .toBe('b2-ba2-sf1100');
    expect(unitTypeKey({ bedrooms: 0, bathrooms: 1, square_feet: 500 })).toBe('b0-ba1-sf500');
    expect(unitTypeKey({})).toBe('property');
    expect(unitTypeKey({ bedrooms: null, bathrooms: '', square_feet: 'bad' })).toBe('property');
    expect(unitTypeKey({ bedrooms: 2 })).toBe('b2-baunknown-sfunknown');
  });

  it('isolates a failed snapshot and continues subsequent rows', async () => {
    const db = { query: vi.fn().mockRejectedValueOnce({ code: 'XX000' }).mockResolvedValue({ rows: [] }) };
    const result = await writeRentSnapshots(db, [{ id: 'one' }, { id: 'two' }], 'supply-pipeline', 'Test', 'GA', '2026-11-11');
    expect(result).toEqual({ written: 1, failed: 1 });
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('does not fabricate an upstream property ID', async () => {
    const db = { query: vi.fn() };
    expect(await writeRentSnapshots(db, [{}], 'rent-comps', 'Test', 'GA', '2026-11-11'))
      .toEqual({ written: 0, failed: 1 });
    expect(db.query).not.toHaveBeenCalled();
  });
});

// Real PostgreSQL, isolated inside a rolled-back schema. No live HTTP or API keys.
describe.skipIf(!process.env.DATABASE_URL)('daily history PostgreSQL constraints', () => {
  let pool: Pool;
  let client: PoolClient;
  const migration = readFileSync(resolve(__dirname, '../../database/migrations/20261112_apartment_locator_rent_history.sql'), 'utf8');
  const propertyId = randomUUID();
  const schema = `rent_history_test_${randomUUID().replace(/-/g, '')}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
    await client.query(`
      CREATE TABLE properties (id UUID PRIMARY KEY, apartment_locator_id TEXT);
      CREATE TABLE apartment_class_rent_snapshots (id UUID PRIMARY KEY);
      CREATE TABLE apartment_locator_properties (
        external_id TEXT, source TEXT, avg_asking_rent NUMERIC, concessions TEXT,
        available_units INT, total_units INT, city TEXT, state TEXT, zip TEXT,
        address TEXT, property_name TEXT, data_as_of DATE
      );
      INSERT INTO apartment_locator_properties VALUES (
        'backfill-test', 'apartment_locator_ai', 1500, 'special', 5, 100,
        'Test', 'GA', '00000', '123 Test', 'Test Property', '2026-11-10'
      );
      INSERT INTO apartment_locator_properties VALUES (
        'undated-test', 'apartment_locator_ai', 1600, NULL, 2, 50,
        'Test', 'GA', NULL, '456 Test', 'Undated Property', NULL
      );
    `);
    await client.query('INSERT INTO properties VALUES ($1, $2)', [propertyId, 'test-1']);
    await client.query(migration);
  });

  afterAll(async () => {
    if (client) { await client.query('ROLLBACK'); client.release(); }
    if (pool) await pool.end();
  });

  it('backfills once with the actual as-of date and migration date fallback', async () => {
    await client.query(migration);
    const r = await client.query(`SELECT alai_property_id, snapshot_date::text, unit_type_key, source_endpoint,
      snapshot_date = CURRENT_DATE AS is_today FROM apartment_locator_rent_snapshots ORDER BY alai_property_id`);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ alai_property_id: 'backfill-test', snapshot_date: '2026-11-10', unit_type_key: 'property', source_endpoint: 'backfill' });
    expect(r.rows[1].is_today).toBe(true);
  });

  it('updates the same unique property/unit/day and leaves previous days untouched', async () => {
    const row = { property_id: 'test-1', bedrooms: 2, bathrooms: 2, square_feet: 1100, rent: 1800, concessions: 'One month free' };
    await writeRentSnapshots(client, [row], 'rent-comps', 'Test', 'GA', '2026-11-11');
    await writeRentSnapshots(client, [{ ...row, rent: 1850 }], 'rent-comps', 'Test', 'GA', '2026-11-11');
    await writeRentSnapshots(client, [{ ...row, rent: 1900 }], 'rent-comps', 'Test', 'GA', '2026-11-12');
    const r = await client.query(`SELECT asking_rent, property_id, effective_rent FROM apartment_locator_rent_snapshots
      WHERE alai_property_id = 'test-1' ORDER BY snapshot_date`);
    expect(r.rows).toHaveLength(2);
    expect(r.rows.map(r => Number(r.asking_rent))).toEqual([1850, 1900]);
    expect(r.rows[0].property_id).toBe(propertyId);
    expect(r.rows[0].effective_rent).toBeNull(); // Lease term unknown: don't invent effective rent.
  });

  it('distinguishes floor plans, source, and property-level observations', async () => {
    await writeRentSnapshots(client, [{ id: 'test-1', rent: 1700 }], 'supply-pipeline', 'Test', 'GA', '2026-11-11');
    await writeRentSnapshots(client, [{ property_id: 'test-1', bedrooms: 1, rent: 1400 }], 'rent-comps', 'Test', 'GA', '2026-11-11');
    const r = await client.query(`SELECT unit_type_key FROM apartment_locator_rent_snapshots
      WHERE alai_property_id = 'test-1' AND snapshot_date = '2026-11-11'`);
    expect(r.rows.map(r => r.unit_type_key).sort()).toEqual(['b1-baunknown-sfunknown', 'b2-ba2-sf1100', 'property']);
    await client.query(`INSERT INTO apartment_locator_rent_snapshots
      (source, source_endpoint, alai_property_id, unit_type_key, city, state, snapshot_date)
      VALUES ('another_source', 'backfill', 'test-1', 'property', 'Test', 'GA', '2026-11-11')`);
    expect((await client.query(`SELECT COUNT(*)::int AS n FROM apartment_locator_rent_snapshots
      WHERE alai_property_id = 'test-1' AND unit_type_key = 'property' AND snapshot_date = '2026-11-11'`)).rows[0].n).toBe(2);
  });

  it('keeps unmatched properties and derives psf without inventing effective rent', async () => {
    await writeRentSnapshots(client, [{ property_id: 'unmatched', rent: 2000, square_feet: 1000 }], 'rent-comps', 'Test', 'GA', '2026-11-11');
    const r = await client.query(`SELECT property_id, rent_per_sqft, effective_rent, raw FROM apartment_locator_rent_snapshots WHERE alai_property_id = 'unmatched'`);
    expect(r.rows[0]).toMatchObject({ property_id: null, rent_per_sqft: '2.0000', effective_rent: null });
    expect(r.rows[0].raw.rent).toBe(2000);
  });
});
