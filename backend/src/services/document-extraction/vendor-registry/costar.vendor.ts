/**
 * CoStar Vendor Declaration
 *
 * Defines how the platform identifies, handles, and stores CoStar market data
 * exports. CoStar produces three export types:
 *
 *   COSTAR_SUBMARKET_EXPORT  — "DataTable.xlsx"  — submarket time-series
 *   COSTAR_SALE_COMPS        — "Near By Sales"   — sale comp grid
 *   COSTAR_RENT_COMPS        — "Rent Comp Prop"  — rent comp grid
 *
 * License posture: `restricted`
 *   Operators upload their own CoStar exports. The platform stores parsed rows
 *   for that deal only. Raw CoStar-branded data is never re-exported or served
 *   to third parties with CoStar attribution.
 *
 * Source of truth for classifier.ts CoStar patterns:
 *   This file replaces all hardcoded CoStar branches in classifier.ts.
 *   Any change to CoStar filename fingerprints or header signals belongs here.
 */

import type { VendorDeclaration } from './types';

export const COSTAR_VENDOR: VendorDeclaration = {
  vendorId: 'costar',
  displayName: 'CoStar',
  licensePosture: 'restricted',

  freshnessProfile: {
    staleDays: 90,
    criticalStaleDays: 180,
    cadence: 'quarterly',
  },

  fileTypes: [
    // ── COSTAR_SUBMARKET_EXPORT ("DataTable.xlsx") ──────────────────────────
    // Time-series with one row per period: vacancy, rent, absorption, cap rate.
    // Must be checked BEFORE sale/rent comps — its signals don't overlap.
    {
      documentType: 'COSTAR_SUBMARKET_EXPORT',
      label: 'DataTable (Submarket Time-Series)',
      filenamePatterns: [/DataTable/i],
      filenameConfidence: 0.65,
      headerPatterns: [
        {
          // Requires ≥3 of the 4 submarket-specific signals, PLUS either
          // "market cap rate" or "asking rent" as an additional anchor.
          signals: ['period', 'vacancy rate', 'inventory units', 'absorp'],
          minMatches: 3,
          alsoRequireOneFromEach: [
            ['market cap rate', 'asking rent'],
          ],
          confidence: 0.93,
          description: 'CoStar DataTable signals: period + vacancy rate + inventory units + absorp + cap/rent anchor',
        },
      ],
      writeTargets: {
        vendorSpecific: {
          costar_submarket_stats: 'costar_upload',
        },
        crossVendor: {
          table: 'historical_observations',
          vendorSourceValue: 'costar',
        },
      },
    },

    // ── COSTAR_SALE_COMPS ("Near By Sales") ─────────────────────────────────
    // Property comp list with sale date + sale price.
    {
      documentType: 'COSTAR_SALE_COMPS',
      label: 'Near By Sales (Sale Comps)',
      filenamePatterns: [/Near[\s_-]*By[\s_-]*Sales/i],
      filenameConfidence: 0.65,
      headerPatterns: [
        {
          signals: ['sale date', 'sale price', 'address'],
          confidence: 0.92,
          description: 'CoStar sale comp headers: sale date + sale price + address',
        },
      ],
      writeTargets: {
        vendorSpecific: {
          market_sale_comps: 'costar_upload',
        },
      },
    },

    // ── COSTAR_RENT_COMPS ("Rent Comp Properties") ──────────────────────────
    // Property comp list with rent metrics + occupancy — no sale date.
    // Must be checked AFTER sale comps (excludes "sale date" to disambiguate).
    {
      documentType: 'COSTAR_RENT_COMPS',
      label: 'Rent Comp Properties (Rent Comps)',
      filenamePatterns: [/Rent[\s_-]*Comp[\s_-]*Prop/i],
      filenameConfidence: 0.65,
      headerPatterns: [
        {
          // Requires "address" plus one rent signal and one occupancy signal,
          // and must NOT contain "sale date" (which would make it a sale comp).
          signals: ['address'],
          alsoRequireOneFromEach: [
            ['asking rent', 'effective rent', 'rent/unit', 'rent/sf'],
            ['occ %', 'occupancy'],
          ],
          excluding: ['sale date'],
          confidence: 0.90,
          description: 'CoStar rent comp headers: rent metric + occupancy + address (no sale date)',
        },
      ],
      writeTargets: {
        vendorSpecific: {
          market_rent_comps: 'costar_upload',
        },
      },
    },
  ],
};
