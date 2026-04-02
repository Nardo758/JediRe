import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../../database/connection';

interface LeaseRecord {
  leaseDate: Date;
  marketRent: number;
  newLER: number;
  priorLER: number;
  sqft: number;
  unit: string;
  unitType: string;
  leaseType: string;
}

interface WeeklyBucket {
  periodDate: string;
  avgMarketRent: number;
  avgLER: number;
  count: number;
}

interface IngestionResult {
  propertyId: string;
  propertyName: string;
  totalLeases: number;
  filteredLeases: number;
  weeksUpdated: number;
  metricsUpserted: string[];
  dateRange: { start: string; end: string };
}

const ALLOWED_DIRS = ['attached_assets', 'uploads', 'data'];

const PROPERTY_MAP: Record<string, { geoId: string; geoName: string }> = {
  highlands: { geoId: 'hsc-duluth', geoName: 'Highlands at Sweetwater Creek' },
  symphony: { geoId: 'ssc-suwanee', geoName: 'Symphony at Suwanee Creek' },
};

function validateFilePath(filePath: string): string {
  const resolved = path.resolve(process.cwd(), filePath);
  const cwd = process.cwd();

  if (!resolved.startsWith(cwd)) {
    throw new Error('File path must be within the project directory');
  }

  const relative = path.relative(cwd, resolved);
  const topDir = relative.split(path.sep)[0];

  if (!ALLOWED_DIRS.includes(topDir)) {
    throw new Error(`File must be in one of: ${ALLOWED_DIRS.join(', ')}`);
  }

  return resolved;
}

function excelSerialToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400000);
}

function parseLeaseFile(filePath: string, sheetName?: string): LeaseRecord[] {
  const safePath = validateFilePath(filePath);
  const ext = path.extname(safePath).toLowerCase();
  let workbook: XLSX.WorkBook;

  if (ext === '.csv') {
    const buf = fs.readFileSync(safePath);
    workbook = XLSX.read(buf, { type: 'buffer' });
  } else {
    workbook = XLSX.readFile(safePath, { cellDates: false });
  }

  const targetSheet = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) {
    throw new Error(`Sheet "${targetSheet}" not found. Available: ${workbook.SheetNames.join(', ')}`);
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
  const records: LeaseRecord[] = [];

  for (const row of rows) {
    const rawDate = row['Lease Start Dates'];
    const marketRent = row['Market Rent at Lease Execution'];
    const newLER = row['New LER'];
    const priorLER = row['Prior Rent LER'];
    const sqft = row['SqFt'];
    const unit = row['Unit'];
    const unitType = row['Unit Type'];
    const leaseType = (row['Renewal/Trade Out '] || row['Renewal/Trade Out'] || '').toString().trim();

    if (rawDate == null || marketRent == null || typeof marketRent !== 'number') continue;
    if (typeof rawDate !== 'number') continue;

    const leaseDate = excelSerialToDate(rawDate);
    if (isNaN(leaseDate.getTime())) continue;
    if (leaseDate.getFullYear() > 2030 || leaseDate.getFullYear() < 2018) continue;

    if (marketRent <= 0 || marketRent > 10000) continue;

    records.push({
      leaseDate,
      marketRent,
      newLER: typeof newLER === 'number' ? newLER : 0,
      priorLER: typeof priorLER === 'number' ? priorLER : 0,
      sqft: typeof sqft === 'number' ? sqft : 0,
      unit: unit?.toString() || '',
      unitType: unitType?.toString() || '',
      leaseType,
    });
  }

  return records;
}

function assignToWeeklyBuckets(
  records: LeaseRecord[],
  weeklyDates: Date[],
): Map<string, { marketRents: number[]; lers: number[] }> {
  const buckets = new Map<string, { marketRents: number[]; lers: number[] }>();

  for (const rec of records) {
    let closest: Date | null = null;
    let minDiff = Infinity;

    for (const wd of weeklyDates) {
      const diff = Math.abs(rec.leaseDate.getTime() - wd.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = wd;
      }
    }

    if (!closest || minDiff > 7 * 86400000) continue;
    const key = closest.toISOString().split('T')[0];

    if (!buckets.has(key)) {
      buckets.set(key, { marketRents: [], lers: [] });
    }
    const bucket = buckets.get(key)!;
    bucket.marketRents.push(rec.marketRent);
    if (rec.newLER > 0) {
      bucket.lers.push(rec.newLER);
    }
  }

  return buckets;
}

function applyLOCF(
  buckets: Map<string, { marketRents: number[]; lers: number[] }>,
  allWeeklyDates: string[],
  leaseStartDate: string,
  leaseEndDate: string,
): WeeklyBucket[] {
  const result: WeeklyBucket[] = [];
  let lastMktRent: number | null = null;
  let lastLER: number | null = null;

  for (const dateStr of allWeeklyDates) {
    if (dateStr < leaseStartDate) continue;
    if (dateStr > leaseEndDate) break;

    const bucket = buckets.get(dateStr);

    if (bucket && bucket.marketRents.length > 0) {
      const avgMkt = bucket.marketRents.reduce((a, b) => a + b, 0) / bucket.marketRents.length;
      const avgLER = bucket.lers.length > 0
        ? bucket.lers.reduce((a, b) => a + b, 0) / bucket.lers.length
        : avgMkt;

      lastMktRent = Math.round(avgMkt);
      lastLER = Math.round(avgLER);

      result.push({
        periodDate: dateStr,
        avgMarketRent: lastMktRent,
        avgLER: lastLER,
        count: bucket.marketRents.length,
      });
    } else if (lastMktRent !== null && lastLER !== null) {
      result.push({
        periodDate: dateStr,
        avgMarketRent: lastMktRent,
        avgLER: lastLER,
        count: 0,
      });
    }
  }

  return result;
}

export async function ingestLeaseRentData(
  filePath: string,
  propertyKey: string,
  sheetName?: string,
): Promise<IngestionResult> {
  const pool = getPool();
  const property = PROPERTY_MAP[propertyKey];
  if (!property) {
    throw new Error(`Unknown property key: "${propertyKey}". Valid: ${Object.keys(PROPERTY_MAP).join(', ')}`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Lease Rent Ingestion: ${property.geoName} (${property.geoId})`);
  console.log(`File: ${filePath}`);
  console.log(`${'='.repeat(60)}\n`);

  const records = parseLeaseFile(filePath, sheetName);
  console.log(`Parsed ${records.length} valid lease records`);

  if (records.length === 0) {
    throw new Error('No valid lease records found in file');
  }

  const dateRange = {
    start: records.reduce((min, r) => r.leaseDate < min ? r.leaseDate : min, records[0].leaseDate),
    end: records.reduce((max, r) => r.leaseDate > max ? r.leaseDate : max, records[0].leaseDate),
  };
  console.log(`Date range: ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]}`);

  const existingDates = await pool.query(
    `SELECT DISTINCT period_date FROM metric_time_series
     WHERE geography_id = $1 AND metric_id LIKE 'OP_%' AND period_type = 'weekly'
     ORDER BY period_date`,
    [property.geoId],
  );

  const weeklyDates = existingDates.rows.map((r: any) => new Date(r.period_date));
  const weeklyDateStrs = weeklyDates.map((d: Date) => d.toISOString().split('T')[0]);
  console.log(`Found ${weeklyDates.length} existing weekly time slots`);

  const buckets = assignToWeeklyBuckets(records, weeklyDates);
  console.log(`Leases distributed across ${buckets.size} weekly buckets`);

  const leaseStartStr = dateRange.start.toISOString().split('T')[0];
  const leaseEndStr = dateRange.end.toISOString().split('T')[0];
  const weeklyData = applyLOCF(buckets, weeklyDateStrs, leaseStartStr, leaseEndStr);
  console.log(`Final weekly series: ${weeklyData.length} data points (${weeklyData.filter(w => w.count > 0).length} with actual data, ${weeklyData.filter(w => w.count === 0).length} LOCF)`);

  const totalUnitsResult = await pool.query(
    `SELECT period_date, value FROM metric_time_series
     WHERE geography_id = $1 AND metric_id = 'OP_TOTAL_UNITS'
     ORDER BY period_date`,
    [property.geoId],
  );
  const totalUnitsMap = new Map<string, number>();
  for (const row of totalUnitsResult.rows) {
    totalUnitsMap.set(new Date(row.period_date).toISOString().split('T')[0], parseFloat(row.value));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let upsertCount = 0;
    const metricsUpserted = new Set<string>();

    for (const week of weeklyData) {
      const metrics: { metricId: string; value: number }[] = [
        { metricId: 'OP_AVG_MARKET_RENT', value: week.avgMarketRent },
        { metricId: 'OP_LER', value: week.avgLER },
      ];

      const concessionPct = week.avgMarketRent > 0
        ? Math.round((1 - week.avgLER / week.avgMarketRent) * 10000) / 100
        : 0;
      metrics.push({ metricId: 'OP_CONCESSION_PCT', value: concessionPct });

      const totalUnits = totalUnitsMap.get(week.periodDate);
      if (totalUnits && totalUnits > 0) {
        metrics.push({
          metricId: 'OP_GROSS_MARKET_RENT',
          value: Math.round(week.avgMarketRent * totalUnits),
        });
      }

      for (const m of metrics) {
        await client.query(
          `INSERT INTO metric_time_series
            (metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence)
           VALUES ($1, 'property', $2, $3, $4, 'weekly', $5, 'lease_transactions', 0.95)
           ON CONFLICT (metric_id, geography_type, geography_id, period_date)
           DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, confidence = EXCLUDED.confidence`,
          [m.metricId, property.geoId, property.geoName, week.periodDate, m.value],
        );
        upsertCount++;
        metricsUpserted.add(m.metricId);
      }
    }

    await client.query('COMMIT');
    console.log(`Upserted ${upsertCount} metric rows across ${metricsUpserted.size} metrics`);

    const verification = await pool.query(
      `SELECT metric_id, COUNT(DISTINCT value) as distinct_vals, MIN(value)::numeric as min_val, MAX(value)::numeric as max_val
       FROM metric_time_series
       WHERE geography_id = $1 AND metric_id IN ('OP_AVG_MARKET_RENT', 'OP_LER', 'OP_CONCESSION_PCT', 'OP_GROSS_MARKET_RENT')
       GROUP BY metric_id ORDER BY metric_id`,
      [property.geoId],
    );
    console.log('\nVerification:');
    for (const row of verification.rows) {
      console.log(`  ${row.metric_id}: ${row.distinct_vals} distinct values, range ${row.min_val} - ${row.max_val}`);
    }

    return {
      propertyId: property.geoId,
      propertyName: property.geoName,
      totalLeases: records.length,
      filteredLeases: records.length,
      weeksUpdated: weeklyData.length,
      metricsUpserted: Array.from(metricsUpserted),
      dateRange: {
        start: dateRange.start.toISOString().split('T')[0],
        end: dateRange.end.toISOString().split('T')[0],
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function ingestAllLeaseFiles(): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  const highlandsPath = 'attached_assets/Highlands_Weekly_Report_03.16.26_Modified__1775135178541.xlsx';
  if (fs.existsSync(path.resolve(process.cwd(), highlandsPath))) {
    console.log('Processing Highlands...');
    const r = await ingestLeaseRentData(highlandsPath, 'highlands', 'Renewal & Trade Out');
    results.push(r);
  } else {
    console.warn(`Highlands file not found: ${highlandsPath}`);
  }

  const symphonyPath = 'attached_assets/New_SSC_Weekly_Report_03.30_(1)_1775135167953.csv';
  if (fs.existsSync(path.resolve(process.cwd(), symphonyPath))) {
    console.log('Processing Symphony...');
    const r = await ingestLeaseRentData(symphonyPath, 'symphony');
    results.push(r);
  } else {
    console.warn(`Symphony file not found: ${symphonyPath}`);
  }

  return results;
}
