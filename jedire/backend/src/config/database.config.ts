import { Pool } from 'pg';
import { config } from 'dotenv';

config();

export const databaseConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'jedire',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
export const pool = new Pool(databaseConfig);

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

// Graceful shutdown
export async function closeDatabase() {
  await pool.end();
  console.log('Database pool closed');
}

// Helper function for transactions
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// PostGIS helper functions
export const postgis = {
  // Convert GeoJSON to PostGIS geometry
  fromGeoJSON: (geojson: any) => {
    return `ST_GeomFromGeoJSON('${JSON.stringify(geojson)}')`;
  },

  // Convert PostGIS geometry to GeoJSON
  toGeoJSON: (column: string) => {
    return `ST_AsGeoJSON(${column})::json`;
  },

  // Check if point is within polygon
  contains: (polygon: string, lat: number, lng: number) => {
    return `ST_Contains(${polygon}, ST_Point(${lng}, ${lat}))`;
  },

  // Calculate distance between two points (in meters)
  distance: (lat1: number, lng1: number, lat2: number, lng2: number) => {
    return `ST_Distance(
      ST_GeogFromText('POINT(${lng1} ${lat1})'),
      ST_GeogFromText('POINT(${lng2} ${lat2})')
    )`;
  },

  // Get area of polygon (in square meters)
  area: (polygon: string) => {
    return `ST_Area(${polygon}::geography)`;
  },
};

export default pool;
