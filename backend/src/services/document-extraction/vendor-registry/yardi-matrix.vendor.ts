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

        const parsed = parseYardiRentSurvey(buffer, options);
        if (!parsed.success && parsed.rows.length === 0) {
          return { success: false, error: parsed.error, validRows: 0, rowsInserted: 0 };
        }

        // Step 1: Write to vendor-specific table
        const vendorWrite = await writeYardiRentSurveyRows(query, parsed.rows);

        // Step 2: Write to cross-vendor corpus (historical_observations)
        await upsertYardiHistoricalObservations(query, parsed.rows);

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
