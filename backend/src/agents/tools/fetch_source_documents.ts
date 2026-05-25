/**
 * fetch_source_documents — Cashflow Agent tool
 *
 * Returns the source_documents catalogue for a deal: every document that has
 * been successfully extracted and catalogued, with document type, key fields
 * extracted, row counts, and file provenance.
 *
 * Use this tool to:
 * - Verify what raw documents are available before citing a figure
 * - Understand which document types have been extracted (T12, RENT_ROLL, OM, etc.)
 * - Reference exact source filenames when building evidence citations
 * - Check if a critical document type (e.g. T12) is missing from the deal
 *
 * Data sources (in priority order):
 * 1. deals.deal_data->'source_documents' — populated by data-router.ts when files
 *    are parsed through the deal document-extraction pipeline. Includes key_fields
 *    and rows_inserted from the actual parse run.
 * 2. deal_files fallback — when the JSONB catalogue is empty, the tool queries
 *    deal_files directly. This handles deals where files were uploaded but
 *    extraction is still pending or was handled through a different path.
 *    document_type is inferred from filename patterns and category.
 */
import { z } from 'zod';
import { getPool } from '../../database/connection';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid().describe('The deal UUID to fetch source documents for'),
});

const SourceDocSchema = z.object({
  file_id:         z.string().nullable(),
  filename:        z.string(),
  document_type:   z.string(),
  mime_type:       z.string().nullable(),
  file_size_bytes: z.number().nullable(),
  extracted_at:    z.string(),
  key_fields:      z.array(z.string()),
  rows_inserted:   z.number(),
  source_ref:      z.string(),
});

const OutputSchema = z.object({
  deal_id:                   z.string(),
  source_documents:          z.array(SourceDocSchema),
  count:                     z.number(),
  has_t12:                   z.boolean(),
  has_rent_roll:             z.boolean(),
  has_om:                    z.boolean(),
  has_tax_bill:              z.boolean(),
  document_types_present:    z.array(z.string()).optional(),
  source_documents_available:z.boolean(),
  source:                    z.string().optional(),
  note:                      z.string(),
});

/**
 * Infer document type from filename, extraction_skill, and category.
 * Order of preference: filename patterns > extraction_skill > category.
 */
function inferDocumentType(
  filename: string,
  extractionSkill: string | null,
  category: string | null,
): string {
  const lower = filename.toLowerCase();

  if (
    lower.includes('t-12') ||
    lower.includes('t12') ||
    lower.includes('t 12') ||
    lower.includes('trailing 12') ||
    lower.includes('trailing-12') ||
    lower.includes('income statement')
  ) return 'T12';

  if (
    lower.includes('rent roll') ||
    lower.includes('rentroll') ||
    lower.includes('rent_roll') ||
    lower.includes('lease charges') ||
    lower.includes('rrwlc')
  ) return 'RENT_ROLL';

  if (
    lower.includes('offering memorandum') ||
    lower.includes('offering memo') ||
    lower.endsWith(' om.pdf') ||
    lower.endsWith('_om.pdf') ||
    lower.endsWith('-om.pdf') ||
    lower.includes(' om ') ||
    lower === 'om.pdf'
  ) return 'OM';

  if (
    lower.includes('tax bill') ||
    lower.includes('tax_bill') ||
    lower.includes('property tax') ||
    lower.includes('tax statement') ||
    lower.includes('tax notice')
  ) return 'TAX_BILL';

  if (lower.includes('box score') || lower.includes('boxscore')) return 'BOX_SCORE';
  if (lower.includes('leasing stat') || lower.includes('leasing report')) return 'LEASING_STATS';
  if (lower.includes('aged receivable') || lower.includes('ar report')) return 'AGED_RECEIVABLES';

  if (category === 'marketing') return 'OM';
  if (category === 'financial') return 'FINANCIAL';

  if (extractionSkill) return extractionSkill.toUpperCase().replace(/-/g, '_');
  if (category) return category.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return 'UNKNOWN';
}

export const fetchSourceDocumentsTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_source_documents',
  description:
    'Returns all documents extracted and catalogued for a deal. ' +
    'Call this in Step 1 to verify which source documents exist before citing any figure. ' +
    'Returns document type, filename, key fields extracted, row count, and extraction timestamp. ' +
    'Use has_t12, has_rent_roll, has_om, has_tax_bill flags to gate evidence citations. ' +
    'An empty array means no documents have been extracted — do not fabricate source references.',
  inputSchema:  InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:all',

  execute: async ({ deal_id }) => {
    try {
      const pool = getPool();

      // ── Primary source: deals.deal_data->'source_documents' JSONB ──────────
      // Populated by data-router.ts when files pass through the deal document-
      // extraction pipeline. Contains key_fields and rows_inserted from the
      // actual parse run — highest-fidelity source.
      const dealRow = await pool.query(
        `SELECT deal_data->'source_documents' AS source_documents
           FROM deals
          WHERE id = $1`,
        [deal_id]
      );

      if (dealRow.rows.length === 0) {
        return {
          deal_id,
          source_documents: [],
          count: 0,
          has_t12: false,
          has_rent_roll: false,
          has_om: false,
          has_tax_bill: false,
          document_types_present: [],
          source_documents_available: false,
          source: 'none',
          note: 'Deal not found',
        };
      }

      const jsonbDocs =
        (dealRow.rows[0].source_documents as z.infer<typeof SourceDocSchema>[] | null) ?? [];

      if (jsonbDocs.length > 0) {
        const types = new Set(jsonbDocs.map((d) => d.document_type));
        return {
          deal_id,
          source_documents: jsonbDocs,
          count: jsonbDocs.length,
          has_t12:       types.has('T12'),
          has_rent_roll: types.has('RENT_ROLL'),
          has_om:        types.has('OM'),
          has_tax_bill:  types.has('TAX_BILL'),
          document_types_present: [...types],
          source_documents_available: true,
          source: 'extraction_catalogue',
          note: `${jsonbDocs.length} document(s) catalogued with full extraction detail. Use filename and document_type for source citations.`,
        };
      }

      // ── Fallback: query deal_files directly ─────────────────────────────────
      // When the JSONB catalogue is empty the deal may still have uploaded files
      // in deal_files (pre-extraction or uploaded via a path that bypasses the
      // data-router catalogue writer). document_type is inferred from filename
      // patterns; key_fields and rows_inserted are unavailable (set to [] and 0).
      const fileRows = await pool.query(
        `SELECT
           df.id                                                AS file_id,
           COALESCE(df.original_filename, df.filename)         AS filename,
           df.category,
           df.extraction_skill,
           df.mime_type,
           df.file_size                                        AS file_size_bytes,
           COALESCE(df.extraction_completed_at, df.created_at) AS extracted_at,
           df.extraction_status
         FROM deal_files df
         WHERE df.deal_id = $1
           AND df.deleted_at IS NULL
         ORDER BY df.created_at`,
        [deal_id]
      );

      const fallbackDocs: z.infer<typeof SourceDocSchema>[] = fileRows.rows.map((row) => {
        const filename    = (row.filename as string) ?? '';
        const docType     = inferDocumentType(
          filename,
          row.extraction_skill as string | null,
          row.category as string | null,
        );
        const extractedAt = row.extracted_at instanceof Date
          ? (row.extracted_at as Date).toISOString()
          : String(row.extracted_at ?? new Date().toISOString());
        return {
          file_id:         (row.file_id as string) ?? null,
          filename,
          document_type:   docType,
          mime_type:       (row.mime_type as string | null) ?? null,
          file_size_bytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : null,
          extracted_at:    extractedAt,
          key_fields:      [],
          rows_inserted:   0,
          source_ref:      filename,
        };
      });

      const types = new Set(fallbackDocs.map((d) => d.document_type));

      return {
        deal_id,
        source_documents: fallbackDocs,
        count: fallbackDocs.length,
        has_t12:       types.has('T12'),
        has_rent_roll: types.has('RENT_ROLL'),
        has_om:        types.has('OM'),
        has_tax_bill:  types.has('TAX_BILL'),
        document_types_present: [...types],
        source_documents_available: fallbackDocs.length > 0,
        source: fallbackDocs.length > 0 ? 'deal_files_fallback' : 'none',
        note:
          fallbackDocs.length === 0
            ? 'No documents have been extracted for this deal yet. Do not cite document sources.'
            : `${fallbackDocs.length} file(s) found via deal uploads. Extraction detail (key_fields, rows_inserted) not yet available — document_type is inferred from filename. Cite filename only, not extraction-level fields.`,
      };
    } catch (err) {
      return {
        deal_id,
        source_documents: [],
        count: 0,
        has_t12: false,
        has_rent_roll: false,
        has_om: false,
        has_tax_bill: false,
        document_types_present: [],
        source_documents_available: false,
        source: 'error',
        note: `source_documents lookup failed: ${err instanceof Error ? err.message : 'unknown error'}. Do not cite document sources.`,
      };
    }
  },
};
