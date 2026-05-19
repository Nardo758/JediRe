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
  note:                      z.string(),
});

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
          note: 'Deal not found',
        };
      }

      const sourceDocs = (dealRow.rows[0].source_documents as z.infer<typeof SourceDocSchema>[] | null) ?? [];
      const types = new Set(sourceDocs.map((d) => d.document_type));

      return {
        deal_id,
        source_documents: sourceDocs,
        count: sourceDocs.length,
        has_t12:       types.has('T12'),
        has_rent_roll: types.has('RENT_ROLL'),
        has_om:        types.has('OM'),
        has_tax_bill:  types.has('TAX_BILL'),
        document_types_present: [...types],
        source_documents_available: sourceDocs.length > 0,
        note:
          sourceDocs.length === 0
            ? 'No documents have been extracted for this deal yet. Do not cite document sources.'
            : `${sourceDocs.length} document(s) catalogued. Use filename and document_type for source citations.`,
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
        note: `source_documents lookup failed: ${err instanceof Error ? err.message : 'unknown error'}. Do not cite document sources.`,
      };
    }
  },
};
