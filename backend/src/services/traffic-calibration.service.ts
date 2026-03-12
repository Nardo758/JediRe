import { pool } from '../database';
import { logger } from '../utils/logger';

interface CalibrationRecord {
  submarket_id: string | null;
  msa_id: string | null;
  city: string | null;
  state: string | null;
  avg_traffic_per_unit: number;
  avg_closing_ratio: number;
  avg_tour_conversion: number;
  seasonal_factors: number[];
  website_pct: number;
  sample_count: number;
}

class TrafficCalibrationService {
  async recalculateForDeal(dealId: string): Promise<void> {
    try {
      const dealResult = await pool.query(
        `SELECT d.submarket_id, d.address, p.city, p.state, p.submarket_id as prop_submarket
         FROM deals d
         LEFT JOIN properties p ON d.property_id = p.id
         WHERE d.id = $1`,
        [dealId]
      );

      if (dealResult.rows.length === 0) return;

      const deal = dealResult.rows[0];
      const submarketId = deal.submarket_id || deal.prop_submarket;
      const city = deal.city;
      const state = deal.state;

      if (!submarketId && !city) {
        logger.debug('[TrafficCalibration] No submarket or city for deal, skipping');
        return;
      }

      const snapshotsResult = await pool.query(
        `SELECT s.*, d.target_units, p.units as prop_units
         FROM weekly_traffic_snapshots s
         JOIN deals d ON s.deal_id = d.id
         LEFT JOIN properties p ON d.property_id = p.id
         WHERE d.submarket_id = $1 OR (p.city = $2 AND p.state = $3)
         ORDER BY s.week_ending ASC`,
        [submarketId, city, state]
      );

      if (snapshotsResult.rows.length < 4) {
        logger.debug('[TrafficCalibration] Not enough data to calibrate');
        return;
      }

      const rows = snapshotsResult.rows;
      const dealIds = new Set(rows.map(r => r.deal_id));

      let totalTrafficPerUnit = 0;
      let trafficPerUnitCount = 0;
      let totalClosingRatio = 0;
      let closingRatioCount = 0;
      let totalTourConversion = 0;
      let tourConversionCount = 0;
      let totalWebsitePct = 0;
      let websitePctCount = 0;

      const monthlyTraffic: number[][] = Array.from({ length: 12 }, () => []);

      for (const row of rows) {
        const units = row.total_units || row.target_units || row.prop_units || 0;
        const traffic = row.traffic || 0;
        const tours = row.in_person_tours || 0;
        const website = row.website_leads || 0;

        if (units > 0 && traffic > 0) {
          totalTrafficPerUnit += traffic / units;
          trafficPerUnitCount++;
        }

        if (row.closing_ratio && row.closing_ratio > 0) {
          totalClosingRatio += row.closing_ratio;
          closingRatioCount++;
        }

        if (traffic > 0 && tours > 0) {
          totalTourConversion += tours / traffic;
          tourConversionCount++;
        }

        if (traffic > 0 && website > 0) {
          totalWebsitePct += website / traffic;
          websitePctCount++;
        }

        if (traffic > 0 && row.week_ending) {
          const month = new Date(row.week_ending).getMonth();
          monthlyTraffic[month].push(traffic);
        }
      }

      const avgTrafficPerUnit = trafficPerUnitCount > 0 ? totalTrafficPerUnit / trafficPerUnitCount : null;
      const avgClosingRatio = closingRatioCount > 0 ? totalClosingRatio / closingRatioCount : null;
      const avgTourConversion = tourConversionCount > 0 ? totalTourConversion / tourConversionCount : null;
      const avgWebsitePct = websitePctCount > 0 ? totalWebsitePct / websitePctCount : null;

      let seasonalFactors: number[] | null = null;
      const monthlyAvgs = monthlyTraffic.map(arr =>
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      );
      const overallAvg = monthlyAvgs.filter(v => v > 0).reduce((a, b) => a + b, 0) /
        (monthlyAvgs.filter(v => v > 0).length || 1);

      if (overallAvg > 0 && monthlyAvgs.filter(v => v > 0).length >= 6) {
        seasonalFactors = monthlyAvgs.map(v => v > 0 ? Math.round((v / overallAvg) * 1000) / 1000 : 1.0);
      }

      await pool.query(
        `INSERT INTO traffic_submarket_calibration
         (submarket_id, msa_id, city, state, avg_traffic_per_unit, avg_closing_ratio,
          avg_tour_conversion, seasonal_factors, website_pct, sample_count, last_updated)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (submarket_id, msa_id, city, state) DO UPDATE SET
           avg_traffic_per_unit = COALESCE($4, traffic_submarket_calibration.avg_traffic_per_unit),
           avg_closing_ratio = COALESCE($5, traffic_submarket_calibration.avg_closing_ratio),
           avg_tour_conversion = COALESCE($6, traffic_submarket_calibration.avg_tour_conversion),
           seasonal_factors = COALESCE($7, traffic_submarket_calibration.seasonal_factors),
           website_pct = COALESCE($8, traffic_submarket_calibration.website_pct),
           sample_count = $9,
           last_updated = NOW()`,
        [
          submarketId || '',
          city || '',
          state || '',
          avgTrafficPerUnit,
          avgClosingRatio,
          avgTourConversion,
          seasonalFactors ? JSON.stringify(seasonalFactors) : null,
          avgWebsitePct,
          dealIds.size,
        ]
      );

      logger.info(`[TrafficCalibration] Updated calibration for submarket=${submarketId}, city=${city}: ${dealIds.size} deals, ${rows.length} snapshots`);
    } catch (error: any) {
      logger.error('[TrafficCalibration] Recalculation failed', { error: error.message });
    }
  }

  async getCalibration(submarketId?: string, city?: string, state?: string): Promise<CalibrationRecord | null> {
    try {
      if (submarketId) {
        const result = await pool.query(
          `SELECT * FROM traffic_submarket_calibration WHERE submarket_id = $1 ORDER BY sample_count DESC LIMIT 1`,
          [submarketId]
        );
        if (result.rows.length > 0) return result.rows[0];
      }

      if (city && state) {
        const result = await pool.query(
          `SELECT * FROM traffic_submarket_calibration WHERE city = $1 AND state = $2 ORDER BY sample_count DESC LIMIT 1`,
          [city, state]
        );
        if (result.rows.length > 0) return result.rows[0];
      }

      return null;
    } catch (error: any) {
      logger.debug('[TrafficCalibration] Lookup failed', { error: error.message });
      return null;
    }
  }

  async getCalibrationStats(submarketId?: string, city?: string, state?: string): Promise<{ sampleCount: number; lastUpdated: string | null; comparisons: Record<string, { calibrated: number; default: number }>; dataLibraryFileCount: number } | null> {
    try {
      let cal: any = null;

      if (submarketId) {
        const result = await pool.query(
          `SELECT * FROM traffic_submarket_calibration WHERE submarket_id = $1 ORDER BY sample_count DESC LIMIT 1`,
          [submarketId]
        );
        if (result.rows.length > 0) cal = result.rows[0];
      }

      if (!cal && city && state) {
        const result = await pool.query(
          `SELECT * FROM traffic_submarket_calibration WHERE city = $1 AND state = $2 ORDER BY sample_count DESC LIMIT 1`,
          [city, state]
        );
        if (result.rows.length > 0) cal = result.rows[0];
      }

      if (!cal) return null;

      const comparisons: Record<string, { calibrated: number; default: number }> = {};

      if (cal.avg_traffic_per_unit) {
        comparisons['Traffic per Unit (weekly)'] = {
          calibrated: Number(cal.avg_traffic_per_unit),
          default: 11 / 290,
        };
      }
      if (cal.avg_closing_ratio) {
        comparisons['Closing Ratio'] = {
          calibrated: Number(cal.avg_closing_ratio),
          default: 0.207,
        };
      }
      if (cal.avg_tour_conversion) {
        comparisons['Tour Conversion'] = {
          calibrated: Number(cal.avg_tour_conversion),
          default: 0.99,
        };
      }
      if (cal.website_pct) {
        comparisons['Website Traffic %'] = {
          calibrated: Number(cal.website_pct),
          default: 0.40,
        };
      }

      let dataLibraryFileCount = 0;
      try {
        const lookupCity = cal.city || city;
        const lookupState = cal.state || state;
        if (lookupCity) {
          const dlResult = await pool.query(
            `SELECT COUNT(*) FROM data_library_files WHERE LOWER(city) = LOWER($1) AND parsing_status = 'complete'`,
            [lookupCity]
          );
          dataLibraryFileCount = parseInt(dlResult.rows[0]?.count || '0');
        }
      } catch (_) {}

      return {
        sampleCount: cal.sample_count || 0,
        lastUpdated: cal.last_updated,
        comparisons,
        dataLibraryFileCount,
      };
    } catch {
      return null;
    }
  }
}

export const trafficCalibrationService = new TrafficCalibrationService();
