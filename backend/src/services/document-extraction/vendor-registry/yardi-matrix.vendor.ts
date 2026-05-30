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
 * This declaration requires zero changes to classifier.ts, costar-upload.routes.ts,
 * or any other existing code. Registering this file in vendor-registry/index.ts
 * is the only integration step.
 */

import type { VendorDeclaration } from './types';

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
          // Requires "geography" (Yardi's term for submarket) + ≥2 of the rent/
          // occupancy signals, PLUS the "yardi matrix id" anchor OR "concession
          // value" which is unique to Yardi exports.
          signals: ['geography', 'occ rate', 'avg asking rent'],
          minMatches: 2,
          alsoRequireOneFromEach: [
            ['yardi matrix id', 'concession value'],
          ],
          confidence: 0.92,
          description: 'Yardi Matrix Rent Survey: geography + occ rate + avg asking rent + yardi-unique anchor',
        },
        {
          // Looser fallback: all three required if no yardi-specific anchor
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
          // Supply pipeline is distinguished by "delivery date" + "developer"
          // + a Yardi geography anchor ("geography" or "yardi matrix id").
          signals: ['delivery date', 'developer'],
          alsoRequireOneFromEach: [
            ['geography', 'yardi matrix id'],
          ],
          confidence: 0.91,
          description: 'Yardi Matrix Supply Pipeline: delivery date + developer + geography anchor',
        },
        {
          // Looser: delivery date + status + geography + total units
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
    },
  ],
};
