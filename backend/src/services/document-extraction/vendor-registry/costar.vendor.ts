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
 * vendorParser: each fileType registers a lazy parse+persist function.
 *   Lazy dynamic imports (await import(...)) prevent DB connection
 *   initialisation when this declaration is imported in test environments.
 *
 * Source of truth for classifier.ts CoStar patterns:
 *   This file replaces all hardcoded CoStar branches in classifier.ts.
 *   Any change to CoStar filename fingerprints or header signals belongs here.
 */

import type { VendorDeclaration, VendorParseOptions, VendorParseResult } from './types';

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
      /**
       * Parse + dual-write for CoStar DataTable (Submarket Time-Series).
       *
       * Writes to:
       *   1. vendor_market_observations — cross-vendor normalized substrate
       *      (one row per parsed period, tagged vendor_id='costar')
       *
       * Note: costar_submarket_stats / costar_market_metrics require a dealId
       * for their composite unique key (deal_id + submarket + state + period_date).
       * Those writes happen in the deal-scoped data-router path
       * (routeCoStarSubmarket) which has the deal context. The vendorParser
       * here serves the cross-deal Data Library upload path.
       */
      vendorParser: async (buffer: Buffer, options: VendorParseOptions): Promise<VendorParseResult> => {
        const { parseCoStarSubmarket } = await import('../parsers/costar-submarket-parser');
        const { query } = await import('../../../database/connection');
        const { randomUUID } = await import('crypto');

        const data = parseCoStarSubmarket(buffer, options.fileId ?? '');

        if (data.rows.length === 0) {
          return {
            success: false,
            error: `No valid CoStar DataTable rows parsed (${data.skippedRows} skipped)`,
            validRows: 0,
            invalidRows: data.skippedRows,
            rowsInserted: 0,
          };
        }

        // geography_id: use fileId as a stable per-file anchor.
        // In the deal-upload path (data-router.ts), the deal's city+state
        // provides a richer submarket label; here we use what is available.
        const geographyId = options.fileId ?? `costar-submarket-${Date.now()}`;

        let inserted = 0;
        let writeErrors = 0;

        for (const row of data.rows) {
          try {
            await query(
              `INSERT INTO vendor_market_observations
                 (id, vendor_id, vendor_file_type, deal_id, file_id,
                  observation_date, geography_level, geography_id,
                  avg_asking_rent, vacancy_rate,
                  under_construction_units, inventory_units, net_absorption_units,
                  cap_rate, price_per_unit,
                  vendor_license_posture, vendor_data_as_of, raw_snapshot)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
               ON CONFLICT DO NOTHING`,
              [
                randomUUID(),
                'costar',
                'COSTAR_SUBMARKET_EXPORT',
                options.dealId ?? null,
                options.fileId ?? null,
                row.periodDate,
                'submarket',
                geographyId,
                row.askingRentPerUnit,
                row.vacancyRate,
                row.underConstructionUnits,
                row.inventoryUnits,
                row.absorption12mo,
                row.capRate,
                row.salePricePerUnit,
                'restricted',
                options.dataAsOf ?? null,
                JSON.stringify(row),
              ],
            );
            inserted++;
          } catch {
            writeErrors++;
          }
        }

        return {
          success: inserted > 0 || (data.rows.length > 0 && writeErrors === 0),
          rowsInserted: inserted,
          validRows: data.rows.length,
          invalidRows: data.skippedRows + writeErrors,
        };
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
      /**
       * Registry-driven dispatch for CoStar sale comps (data-library upload path).
       *
       * Sale comps are property-level comp records, not submarket time-series
       * observations. Full database writes (market_sale_comps) require a dealId
       * because the table is deal-scoped. Without dealId the file is classified
       * and acknowledged as a success so the data_library_files row is marked
       * parsed; the operator can then associate it with a deal for extraction.
       *
       * When dealId is provided, delegates to processCoStarUpload for the
       * full 3-tier dedup pipeline.
       */
      vendorParser: async (buffer: Buffer, options: VendorParseOptions): Promise<VendorParseResult> => {
        if (!options.dealId) {
          // Classify-only: no deal context available for deal-scoped writes.
          // Return success so parser_status is set to 'success' and the file
          // is visible in the data library. The operator can link to a deal later.
          return { success: true, rowsInserted: 0, validRows: 0, invalidRows: 0 };
        }

        const { getPool } = await import('../../../database/connection');
        const { processCoStarUpload } = await import('../../valuation/costar-comp-upload.service');

        const pool = getPool();
        const result = await processCoStarUpload(pool, {
          buffer,
          filename: options.fileId ?? 'Near By Sales.xlsx',
          fileId: options.fileId ?? null,
          compType: 'sale',
          dealId: options.dealId,
        });

        if (result.rejected) {
          return { success: false, error: result.rejectReason, rowsInserted: 0, validRows: 0 };
        }

        return {
          success: true,
          rowsInserted: result.inserted + (result.merged ?? 0),
          validRows: result.totalRows - result.skippedInvalid,
          invalidRows: result.skippedInvalid,
        };
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
      /**
       * Registry-driven dispatch for CoStar rent comps (data-library upload path).
       *
       * Mirrors COSTAR_SALE_COMPS vendorParser behaviour: classify-only when no
       * dealId; full processCoStarUpload pipeline when dealId is present.
       */
      vendorParser: async (buffer: Buffer, options: VendorParseOptions): Promise<VendorParseResult> => {
        if (!options.dealId) {
          return { success: true, rowsInserted: 0, validRows: 0, invalidRows: 0 };
        }

        const { getPool } = await import('../../../database/connection');
        const { processCoStarUpload } = await import('../../valuation/costar-comp-upload.service');

        const pool = getPool();
        const result = await processCoStarUpload(pool, {
          buffer,
          filename: options.fileId ?? 'Rent Comp Properties.xlsx',
          fileId: options.fileId ?? null,
          compType: 'rent',
          dealId: options.dealId,
        });

        if (result.rejected) {
          return { success: false, error: result.rejectReason, rowsInserted: 0, validRows: 0 };
        }

        return {
          success: true,
          rowsInserted: result.inserted + (result.merged ?? 0),
          validRows: result.totalRows - result.skippedInvalid,
          invalidRows: result.skippedInvalid,
        };
      },
    },
  ],
};
