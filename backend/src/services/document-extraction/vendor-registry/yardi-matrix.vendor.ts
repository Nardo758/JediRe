/**
 * Yardi Matrix Vendor Declaration — Piece A2 (Second Vendor Abstraction Proof)
 *
 * Yardi Matrix publishes two export types relevant to multifamily market
 * intelligence:
 *
 *   YARDI_MATRIX_RENT_SURVEY    — Quarterly rent/vacancy snapshot per submarket.
 *                                 Filename: "Yardi Matrix - Rent Survey *.xlsx"
 *                                 or "YMRS_*.xlsx"
 *
 *   YARDI_MATRIX_SUPPLY_PIPELINE — Forward-looking supply pipeline per property.
 *                                  Filename: "Yardi Matrix - Supply Pipeline *.xlsx"
 *                                  or "YMSP_*.xlsx"
 *
 * KEY DISCRIMINATORS from CoStar:
 *   - Yardi uses "Geography" for submarket (CoStar uses "Submarket").
 *   - Yardi uses "Occ Rate" (CoStar uses "Occupancy" or "Occupancy Rate").
 *   - "Yardi Matrix ID" is a unique identifier present in all Yardi exports.
 *   - "Concession Value ($ Per Month)" is Yardi-specific (CoStar has "Concession %").
 *   - Supply pipeline uses "Delivery Date" (not a CoStar concept).
 *
 * License posture: `platform_only`
 *   Operators upload their own Yardi Matrix exports. Data is used internally
 *   for market intelligence only. Not re-exported with Yardi branding.
 *
 * vendorParser: each fileType registers a parse+persist function using lazy
 * dynamic imports so that importing this declaration in test environments does
 * NOT trigger DB connection initialization.
 */

import type { VendorDeclaration, VendorParseOptions, VendorParseResult } from './types';

export const YARDI_MATRIX_VENDOR: VendorDeclaration = {
  vendorId: 'yardi_matrix',
  displayName: 'Yardi Matrix',
  licensePosture: 'platform_only',

  freshnessProfile: {
    staleDays: 120,        // Yardi Matrix surveys are quarterly
    criticalStaleDays: 365,
    cadence: 'quarterly',
  },

  fileTypes: [
    // ── YARDI_MATRIX_RENT_SURVEY ──────────────────────────────────────────────
    // Quarterly submarket rent + vacancy snapshot.
    // Must be checked BEFORE supply pipeline (supply has a "geography" signal too).
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
      // Lazy-imported: safe to use this declaration in test environments without
      // triggering DB connection initialisation.
      vendorParser: async (buffer: Buffer, options: VendorParseOptions): Promise<VendorParseResult> => {
        const { parseYardiRentSurvey, writeYardiRentSurveyRows } =
          await import('../parsers/yardi-matrix-parser');
        const { query } = await import('../../../database/connection');

        const parsed = parseYardiRentSurvey(buffer, options);
        if (!parsed.success && parsed.rows.length === 0) {
          return { success: false, error: parsed.error, validRows: 0, rowsInserted: 0 };
        }

        const { inserted, errors } = await writeYardiRentSurveyRows(query, parsed.rows);
        return {
          success: inserted > 0 || (parsed.validRows === 0 && parsed.invalidRows === 0),
          rowsInserted: inserted,
          validRows: parsed.validRows,
          invalidRows: parsed.invalidRows + errors,
        };
      },
    },

    // ── YARDI_MATRIX_SUPPLY_PIPELINE ─────────────────────────────────────────
    // Per-property forward-looking supply pipeline.
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
          success: inserted > 0 || (parsed.validRows === 0 && parsed.invalidRows === 0),
          rowsInserted: inserted,
          validRows: parsed.validRows,
          invalidRows: parsed.invalidRows + errors,
        };
      },
    },
  ],
};
