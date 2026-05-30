/**
 * Yardi Matrix Vendor Declaration — Piece A2 (Second Vendor Abstraction Proof)
 *
 * Yardi Matrix publishes two export types relevant to multifamily market
 * intelligence:
 *
 *   YARDI_MATRIX_RENT_SURVEY    — Quarterly rent/vacancy snapshot per submarket.
 *   YARDI_MATRIX_SUPPLY_PIPELINE — Forward-looking supply pipeline per property.
 *
 * Write path for rent survey (triggered by vendorParser):
 *   1. yardi_matrix_rent_survey   — vendor-specific table (full columns)
 *   2. historical_observations    — cross-vendor corpus with vendor_source='yardi_matrix'
 *
 * Write path for supply pipeline (triggered by vendorParser):
 *   1. yardi_matrix_supply_pipeline — vendor-specific table
 *
 * License posture: `platform_only`
 *   Operators upload their own Yardi Matrix exports. Data is used internally
 *   for market intelligence only. Not re-exported with Yardi branding.
 *
 * vendorParser: each fileType registers a lazy parse+persist function.
 *   Lazy dynamic imports (await import(...)) prevent DB connection
 *   initialisation when this declaration is imported in test environments.
 */

import type { VendorDeclaration, VendorParseOptions, VendorParseResult } from './types';

export const YARDI_MATRIX_VENDOR: VendorDeclaration = {
  vendorId: 'yardi_matrix',
  displayName: 'Yardi Matrix',
  licensePosture: 'platform_only',

  freshnessProfile: {
    staleDays: 120,
    criticalStaleDays: 365,
    cadence: 'quarterly',
  },

  fileTypes: [
    // ── YARDI_MATRIX_RENT_SURVEY ──────────────────────────────────────────────
    {
      documentType: 'YARDI_MATRIX_RENT_SURVEY',
      label: 'Rent Survey (Submarket Snapshot)',
      filenamePatterns: [
        /yardi[\s_-]*matrix[\s_-]*(rent[\s_-]*survey|multifamily[\s_-]*rent)/i,
        /YMRS_/,
      ],
      filenameConfidence: 0.70,
      headerPatterns: [
        {
          signals: ['geography', 'occ rate', 'avg asking rent'],
          minMatches: 2,
          alsoRequireOneFromEach: [
            ['yardi matrix id', 'concession value'],
          ],
          confidence: 0.92,
          description: 'Yardi Matrix Rent Survey: geography + occ rate + avg asking rent + yardi-unique anchor',
        },
        {
          signals: ['geography', 'occ rate', 'avg asking rent', 'avg eff rent', 'total inventory'],
          minMatches: 4,
          excluding: ['sale date', 'delivery date'],
          confidence: 0.82,
          description: 'Yardi Matrix Rent Survey (loose): geography + occ rate + asking/eff rent + total inventory',
        },
      ],
      writeTargets: {
        vendorSpecific: {
          yardi_matrix_rent_survey: 'yardi_matrix',
        },
        crossVendor: {
          table: 'historical_observations',
          vendorSourceValue: 'yardi_matrix',
        },
      },
      vendorParser: async (buffer: Buffer, options: VendorParseOptions): Promise<VendorParseResult> => {
        const {
          parseYardiRentSurvey,
          writeYardiRentSurveyRows,
          upsertYardiHistoricalObservations,
        } = await import('../parsers/yardi-matrix-parser');
        const { query } = await import('../../../database/connection');
        const { randomUUID } = await import('crypto');

        const parsed = parseYardiRentSurvey(buffer, options);
        if (!parsed.success && parsed.rows.length === 0) {
          return { success: false, error: parsed.error, validRows: 0, rowsInserted: 0 };
        }

        // Step 1: Write to vendor-specific table
        const vendorWrite = await writeYardiRentSurveyRows(query, parsed.rows);

        // Step 2: Write to cross-vendor corpus (historical_observations)
        await upsertYardiHistoricalObservations(query, parsed.rows);

        // Step 3: Write to vendor_market_observations — the normalized cross-vendor
        // substrate (mirrors the CoStar DataTable dual-write pattern).
        // Dedup key: (vendor_id, observation_date, geography_level, geography_id,
        //             COALESCE(deal_id::text, '')) — ON CONFLICT DO NOTHING is safe.
        for (const row of parsed.rows) {
          const vacancyRate =
            row.occupancy_rate != null
              ? parseFloat((100 - row.occupancy_rate).toFixed(3))
              : null;

          try {
            await query(
              `INSERT INTO vendor_market_observations
                 (id, vendor_id, vendor_file_type, deal_id, file_id,
                  observation_date, geography_level, geography_id, geography_name, state,
                  avg_asking_rent, avg_effective_rent, vacancy_rate,
                  under_construction_units, inventory_units, net_absorption_units,
                  vendor_license_posture, vendor_data_as_of, raw_snapshot)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
               ON CONFLICT DO NOTHING`,
              [
                randomUUID(),
                'yardi_matrix',
                'YARDI_MATRIX_RENT_SURVEY',
                options.dealId ?? null,
                options.fileId ?? null,
                row.period_date,
                'submarket',
                row.submarket,
                row.submarket,
                row.state ?? null,
                row.avg_asking_rent,
                row.avg_effective_rent,
                vacancyRate,
                row.new_supply_units,
                row.total_inventory_units,
                row.net_absorption_units,
                'platform_only',
                options.dataAsOf ?? row.data_as_of ?? null,
                JSON.stringify({
                  submarket:             row.submarket,
                  metro:                 row.metro,
                  state:                 row.state,
                  avg_asking_rent:       row.avg_asking_rent,
                  avg_effective_rent:    row.avg_effective_rent,
                  occupancy_rate:        row.occupancy_rate,
                  concession_value_mo:   row.concession_value_mo,
                  total_inventory_units: row.total_inventory_units,
                  new_supply_units:      row.new_supply_units,
                  net_absorption_units:  row.net_absorption_units,
                  yardi_matrix_id:       row.yardi_matrix_id,
                }),
              ],
            );
          } catch {
            // Non-fatal: vendor_market_observations write failures don't
            // block the vendor-specific table write (already counted above).
          }
        }

        return {
          success: vendorWrite.inserted > 0 || parsed.rows.length === 0,
          rowsInserted: vendorWrite.inserted,
          validRows: parsed.validRows,
          invalidRows: parsed.invalidRows + vendorWrite.errors,
        };
      },
    },

    // ── YARDI_MATRIX_SUPPLY_PIPELINE ─────────────────────────────────────────
    {
      documentType: 'YARDI_MATRIX_SUPPLY_PIPELINE',
      label: 'Supply Pipeline (Property-Level)',
      filenamePatterns: [
        /yardi[\s_-]*matrix[\s_-]*(supply[\s_-]*pipeline|supply)/i,
        /YMSP_/,
      ],
      filenameConfidence: 0.70,
      headerPatterns: [
        {
          signals: ['delivery date', 'developer'],
          alsoRequireOneFromEach: [
            ['geography', 'yardi matrix id'],
          ],
          confidence: 0.91,
          description: 'Yardi Matrix Supply Pipeline: delivery date + developer + geography anchor',
        },
        {
          signals: ['delivery date', 'status', 'geography', 'total units'],
          minMatches: 3,
          excluding: ['sale date', 'asking rent'],
          confidence: 0.80,
          description: 'Yardi Matrix Supply Pipeline (loose): delivery date + status + geography + total units',
        },
      ],
      writeTargets: {
        vendorSpecific: {
          yardi_matrix_supply_pipeline: 'yardi_matrix',
        },
      },
      vendorParser: async (buffer: Buffer, options: VendorParseOptions): Promise<VendorParseResult> => {
        const { parseYardiSupplyPipeline, writeYardiSupplyRows } =
          await import('../parsers/yardi-matrix-parser');
        const { query } = await import('../../../database/connection');

        const parsed = parseYardiSupplyPipeline(buffer, options);
        if (!parsed.success && parsed.rows.length === 0) {
          return { success: false, error: parsed.error, validRows: 0, rowsInserted: 0 };
        }

        const { inserted, errors } = await writeYardiSupplyRows(query, parsed.rows);
        return {
          success: inserted > 0 || parsed.rows.length === 0,
          rowsInserted: inserted,
          validRows: parsed.validRows,
          invalidRows: parsed.invalidRows + errors,
        };
      },
    },
  ],
};
