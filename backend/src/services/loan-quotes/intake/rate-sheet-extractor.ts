/**
 * rate-sheet-extractor.ts
 * Component 4: Rate sheet extractor stub.
 *
 * Intake channel #1: Upload.
 * Rate sheet → documents folder in tools → same classify→locate→extract
 * pipeline as OMs (OM Extraction spec is the parser).
 *
 * A rate sheet is a structured financing doc — (tier,term)→spread is a
 * classify-then-extract table problem.
 *
 * Provenance chain:
 *   upload → classify → locate tables → extract → broker_claims
 *
 * TODO: Integrate with OM Extraction module once built.
 */

import type { LoanQuote, BrokerClaimsProvenance } from '../loan-quote.types';

/**
 * Input: a raw document (PDF, image, etc.) representing a lender rate sheet.
 * TODO: Define Document type once OM Extraction module provides it.
 */
export interface RateSheetDocument {
  /** Document ID in the storage system. */
  documentId: string;

  /** File name, e.g. 'NewPoint_Multifamily_2024-06-25.pdf'. */
  fileName: string;

  /** MIME type. */
  mimeType: string;

  /** Org scope — Lane B privacy. */
  orgId: string;

  /** User who uploaded the document. */
  uploadedBy: string;

  /** Upload timestamp (ISO 8601). */
  uploadedAt: string;
}

/**
 * Extract a LoanQuote from an uploaded rate sheet document.
 *
 * This is a STUB. Real implementation will:
 * 1. Call OM Extraction classify→locate→extract pipeline
 * 2. Parse the spread matrix table(s)
 * 3. Identify lender, program, quote date, expiry
 * 4. Build the adjustment stack
 * 5. Capture prepay structure
 * 6. Populate broker_claims provenance
 *
 * @param document — the uploaded rate sheet
 * @returns a LoanQuote (stub returns a synthetic quote for testing)
 */
export async function extractRateSheet(document: RateSheetDocument): Promise<LoanQuote> {
  // TODO: Replace with real OM Extraction integration.
  // For the stub, return a synthetic NewPoint-like quote.

  const now = new Date();
  const quoteDate = now.toISOString().split('T')[0];
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const provenance: BrokerClaimsProvenance = {
    source: 'rate_sheet_upload',
    date: now.toISOString(),
    confidence: 0.7,
    sourceId: document.documentId,
    context: `Extracted from ${document.fileName} uploaded by ${document.uploadedBy}`,
  };

  return {
    id: `quote-stub-${Date.now()}`,
    orgId: document.orgId,
    lender: 'NewPoint',
    program: 'Fannie DUS',
    quoteDate,
    expires,
    indexBasis: 'treasury_10yr',
    rateType: 'fixed',
    spreadMatrix: {
      program: 'Fannie DUS',
      grid: {
        'Tier-3': {
          7: { min: 0.0126, max: 0.0136 },
          10: { min: 0.0130, max: 0.0140 },
        },
      },
    },
    adjustments: [
      { name: 'Green building', bps: -20, provenance: 'sheet_row_12' },
      { name: 'MAH', bps: -30, provenance: 'sheet_row_13' },
    ],
    prepayStructure: {
      type: 'yield_maintenance',
      terms: { lockoutMonths: 0, formula: 'treasury_rate + spread - note_rate' },
    },
    brokerClaims: provenance,
    notes: 'STUB: Replace with OM Extraction pipeline output',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
