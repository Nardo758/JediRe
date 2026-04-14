/**
 * M07: Rent Roll Parser
 *
 * Main entry point for the rent roll parser pipeline:
 *   1. Detect format (FormatDetector)
 *   2. Map fields (FieldMapper)
 *   3. Parse and validate rows (RentRollValidator)
 *   4. Persist to rent_roll_snapshots + lease_events tables
 *   5. Trigger single-snapshot derivations
 *
 * Returns the snapshot ID for downstream processing.
 */

import fs from 'fs';
import readline from 'readline';
import type { Pool } from 'pg';
import { formatDetectorService } from './format-detector.service';
import { fieldMapperService, type CanonicalField } from './field-mapper.service';
import { rentRollValidatorService } from './rent-roll-validator.service';
import type { RentRollLeaseEvent, ParsedRentRoll } from '../../types/traffic-calibration.types';
import { logger } from '../../utils/logger';

export interface ParseResult {
  snapshot_id: number;
  deal_id: string;
  row_count: number;
  extraction_confidence: number;
  format: string;
  snapshot_date: Date;
  lease_events_stored: number;
}

export class RentRollParserService {

  constructor(private readonly pool: Pool) {}

  /**
   * Full pipeline: detect → map → parse → persist → trigger derivations
   */
  async parseAndStore(filePath: string, dealId: string): Promise<ParseResult> {
    logger.info('[RentRollParser] Starting parse', { filePath, dealId });

    // Step 1: Detect format
    const detection = await formatDetectorService.detect(filePath);
    logger.info('[RentRollParser] Format detected', { format: detection.format, headers: detection.headers.length });

    // Step 2: Map fields
    const mapping = fieldMapperService.buildMapping(detection.headers, detection.format);
    const missingFields = fieldMapperService.getMissingFields(mapping);
    if (missingFields.length > 0) {
      logger.warn('[RentRollParser] Missing required field mappings', { missingFields });
    }

    // Step 3: Parse all rows
    const rows = await this.readAllRows(filePath, detection.format);
    const leaseEvents: RentRollLeaseEvent[] = [];
    const rowConfidences: number[] = [];

    // Try to derive snapshot date from the data or use today
    let snapshotDate = new Date();

    for (const rawRow of rows) {
      const event = this.mapRow(rawRow, mapping);
      const validation = rentRollValidatorService.validateRow(event);
      event.row_confidence = validation.row_confidence;
      rowConfidences.push(validation.row_confidence);
      leaseEvents.push(event as RentRollLeaseEvent);

      // Use the latest lease_start as a proxy for snapshot date
      if (event.lease_start && event.lease_start > snapshotDate) {
        snapshotDate = event.lease_start;
      }
    }

    const extractionConfidence = rentRollValidatorService.computeSnapshotConfidence(
      rowConfidences,
      missingFields.length,
    );

    // Step 4: Persist snapshot
    const snapshotResult = await this.pool.query<{ id: number }>(`
      INSERT INTO rent_roll_snapshots
        (deal_id, original_filename, file_path, file_format, row_count,
         extraction_confidence, snapshot_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'parsed')
      RETURNING id
    `, [
      dealId,
      filePath.split('/').pop() || filePath,
      filePath,
      detection.format,
      leaseEvents.length,
      extractionConfidence,
      snapshotDate.toISOString().split('T')[0],
    ]);

    const snapshotId = snapshotResult.rows[0].id;

    // Step 5: Bulk insert leasing_events
    let eventsStored = 0;
    for (const evt of leaseEvents) {
      try {
        await this.pool.query(`
          INSERT INTO leasing_events (
            snapshot_id, deal_id, unit_id, unit_type, unit_sf,
            contract_rent, market_rent, concession_value, concession_months,
            lease_start, lease_end, move_in_date, move_out_date, notice_date,
            unit_status, is_renewal, days_vacant, row_confidence
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        `, [
          snapshotId, dealId,
          evt.unit_id || null,
          evt.unit_type || null,
          evt.unit_sf || null,
          evt.contract_rent || null,
          evt.market_rent || null,
          evt.concession_value || null,
          evt.concession_months || null,
          evt.lease_start || null,
          evt.lease_end || null,
          evt.move_in_date || null,
          evt.move_out_date || null,
          evt.notice_date || null,
          evt.unit_status || null,
          evt.is_renewal ?? null,
          evt.days_vacant ?? null,
          evt.row_confidence,
        ]);
        eventsStored++;
      } catch (err: any) {
        logger.warn('[RentRollParser] Failed to insert lease event row', { error: err.message });
      }
    }

    logger.info('[RentRollParser] Parse complete', {
      snapshotId, eventsStored, extractionConfidence,
    });

    return {
      snapshot_id: snapshotId,
      deal_id: dealId,
      row_count: leaseEvents.length,
      extraction_confidence: extractionConfidence,
      format: detection.format,
      snapshot_date: snapshotDate,
      lease_events_stored: eventsStored,
    };
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private mapRow(rawRow: any[], mapping: Partial<Record<CanonicalField, number>>): Partial<RentRollLeaseEvent> {
    const get = (field: CanonicalField) => fieldMapperService.getValue(rawRow, mapping, field);

    const parseDate = (v: string | undefined): Date | undefined => {
      if (!v) return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const parseNum = (v: string | undefined): number | undefined => {
      if (!v) return undefined;
      const n = parseFloat(v.replace(/[$,\s]/g, ''));
      return isNaN(n) ? undefined : n;
    };

    const parseInt2 = (v: string | undefined): number | undefined => {
      if (!v) return undefined;
      const n = parseInt(v, 10);
      return isNaN(n) ? undefined : n;
    };

    const statusRaw = get('unit_status')?.toLowerCase();
    let unit_status: RentRollLeaseEvent['unit_status'];
    if (statusRaw?.includes('vacant') || statusRaw === 'v') unit_status = 'vacant';
    else if (statusRaw?.includes('notice') || statusRaw === 'n') unit_status = 'notice';
    else if (statusRaw?.includes('model') || statusRaw === 'm') unit_status = 'model';
    else if (statusRaw?.includes('down') || statusRaw === 'd') unit_status = 'down';
    else if (statusRaw?.includes('occ') || statusRaw === 'o') unit_status = 'occupied';
    else unit_status = undefined;

    const renewalRaw = get('is_renewal')?.toLowerCase();
    const is_renewal = renewalRaw?.includes('renew') || renewalRaw === 'r' || renewalRaw === 'y' || renewalRaw === 'yes'
      ? true
      : renewalRaw === 'n' || renewalRaw === 'no' || renewalRaw === 'new'
        ? false
        : undefined;

    return {
      unit_id: get('unit_id'),
      unit_type: get('unit_type'),
      unit_sf: parseInt2(get('unit_sf')),
      contract_rent: parseNum(get('contract_rent')),
      market_rent: parseNum(get('market_rent')),
      concession_value: parseNum(get('concession_value')),
      concession_months: parseInt2(get('concession_months')),
      lease_start: parseDate(get('lease_start')),
      lease_end: parseDate(get('lease_end')),
      move_in_date: parseDate(get('move_in_date')),
      move_out_date: parseDate(get('move_out_date')),
      notice_date: parseDate(get('notice_date')),
      unit_status,
      is_renewal,
      days_vacant: parseInt2(get('days_vacant')),
      row_confidence: 1.0,
    };
  }

  /**
   * Read all data rows (skipping the header row) from a CSV or XLSX file.
   */
  private async readAllRows(filePath: string, format: string): Promise<any[][]> {
    if (format.endsWith('csv')) {
      return this.readCsvRows(filePath);
    }
    return this.readXlsxRows(filePath);
  }

  private async readCsvRows(filePath: string): Promise<any[][]> {
    return new Promise((resolve, reject) => {
      const rows: any[][] = [];
      let isFirst = true;

      const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        if (isFirst) { isFirst = false; return; } // skip header
        const row = this.parseCsvLine(line);
        if (row.some(cell => cell !== '')) {
          rows.push(row);
        }
      });

      rl.on('close', () => resolve(rows));
      rl.on('error', reject);
    });
  }

  private async readXlsxRows(filePath: string): Promise<any[][]> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return allRows.slice(1); // skip header
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }
}
