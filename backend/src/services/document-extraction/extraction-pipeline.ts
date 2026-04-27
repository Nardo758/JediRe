import fs from 'fs';
import path from 'path';
import { classifyDocument } from './classifier';
import { parseT12 } from './parsers/t12-parser';
import { parseRentRoll } from './parsers/rent-roll-parser';
import { parseAgedReceivables } from './parsers/aged-receivables-parser';
import { parseBoxScore } from './parsers/box-score-parser';
import { parseConcessionBurnoff } from './parsers/concession-burnoff-parser';
import { parseLTO } from './parsers/lto-parser';
import { parseTaxBill, parseTaxBillAsync } from './parsers/tax-bill-parser';
import { parseOtherIncome } from './parsers/other-income-parser';
import { parseOM } from './parsers/om-parser';
import { routeExtractionResult } from './data-router';
import { DocumentType, ExtractionResult, PipelineResult } from './types';
import { getPool } from '../../database/connection';

function getParser(docType: DocumentType): ((buffer: Buffer, filename: string) => ExtractionResult) | null {
  switch (docType) {
    case 'T12': return parseT12;
    case 'RENT_ROLL': return parseRentRoll;
    case 'AGED_RECEIVABLES': return parseAgedReceivables;
    case 'BOX_SCORE': return parseBoxScore;
    case 'CONCESSION_BURNOFF': return parseConcessionBurnoff;
    case 'T30_LTO': return parseLTO;
    case 'TAX_BILL': return parseTaxBill;
    case 'OTHER_INCOME': return parseOtherIncome;
    default: return null;
  }
}

/**
 * Bridge for the OM parser.
 *
 * parseOM is async (LLM call + optional OCR) and its OMParseResult already
 * extends ExtractionResult with `data: OMExtraction | null`. The pipeline's
 * downstream consumer (`routeOM` in data-router.ts) casts result.data back
 * to OMExtraction, so we deliberately pass the rich shape through instead
 * of flattening into a hand-picked subset — flattening would break routeOM.
 *
 * uploadedBy and dealId are forwarded into the parser's AICallContext so
 * credit-metering and per-deal AI bookkeeping can resolve the real user.
 * Passing a non-UUID placeholder here causes JediAIService.checkAndDeductCredits
 * to crash on `invalid input syntax for type uuid`, which fails the whole
 * extraction silently and leaves the Deal Capsule un-populated.
 */
async function parseOMForPipeline(
  buffer: Buffer,
  filename: string,
  uploadedBy: string,
  dealId: string,
): Promise<ExtractionResult> {
  const result = await parseOM(buffer, filename, {
    userId: uploadedBy,
    dealId,
    onStageChange: async () => { /* no-op for in-pipeline runs */ },
  });
  return result as ExtractionResult;
}

export async function processDocument(
  filePath: string,
  filename: string,
  dealId: string,
  uploadedBy: string,
  documentId?: string,
  mimeType?: string,
): Promise<{
  documentType: DocumentType;
  success: boolean;
  error?: string;
  rowsInserted?: number;
  capsuleUpdated?: boolean;
  libraryUpdated?: boolean;
  proformaSeeded?: boolean;
  crossValidationVariances?: number;
  alerts: string[];
}> {
  const alerts: string[] = [];

  try {
    const buffer = fs.readFileSync(filePath);
    const classification = await classifyDocument(buffer, filename);

    if (classification.documentType === 'UNKNOWN') {
      return { documentType: 'UNKNOWN', success: false, error: 'Could not classify document type', alerts };
    }

    if (classification.confidence < 0.5) {
      alerts.push(`Low classification confidence (${(classification.confidence * 100).toFixed(0)}%) for ${classification.documentType}`);
    }

    let extractionResult: ExtractionResult;

    if (classification.documentType === 'TAX_BILL' && /\.pdf$/i.test(filename)) {
      extractionResult = await parseTaxBillAsync(buffer, filename);
    } else if (classification.documentType === 'OM') {
      // OM parser is async (LLM + optional OCR). Bridge handles the call.
      extractionResult = await parseOMForPipeline(buffer, filename, uploadedBy, dealId);
    } else {
      const parser = getParser(classification.documentType);
      if (!parser) {
        return { documentType: classification.documentType, success: false, error: `No parser available for ${classification.documentType}`, alerts };
      }
      extractionResult = parser(buffer, filename);
    }

    if (!extractionResult.success) {
      return {
        documentType: classification.documentType,
        success: false,
        error: extractionResult.error || 'Extraction failed',
        alerts: [...alerts, ...extractionResult.warnings],
      };
    }

    const routeResult = await routeExtractionResult(extractionResult, {
      dealId,
      filename,
      uploadedBy,
      documentId,
      filePath,
      mimeType,
      fileSize: buffer.byteLength,
    });

    return {
      documentType: classification.documentType,
      success: true,
      rowsInserted: routeResult.rowsInserted,
      capsuleUpdated: routeResult.capsuleUpdated,
      libraryUpdated: routeResult.libraryUpdated,
      proformaSeeded: routeResult.proformaSeeded,
      crossValidationVariances: routeResult.crossValidationVariances,
      alerts: [...alerts, ...routeResult.alerts, ...extractionResult.warnings],
    };
  } catch (err) {
    return {
      documentType: 'UNKNOWN',
      success: false,
      error: err instanceof Error ? err.message : 'Pipeline error',
      alerts,
    };
  }
}

export async function processDealDocuments(
  dealId: string,
  uploadedBy: string
): Promise<PipelineResult> {
  const pool = getPool();
  const results: PipelineResult['results'] = [];
  const allAlerts: string[] = [];
  let anyCapsuleUpdated = false;
  let anyLibraryUpdated = false;

  const docFiles = await pool.query(
    `SELECT id, filename, original_filename, file_path FROM deal_document_files
     WHERE deal_id = $1 ORDER BY created_at`,
    [dealId]
  );

  if (docFiles.rows.length === 0) {
    return {
      dealId,
      documentsProcessed: 0,
      results: [],
      capsuleUpdated: false,
      libraryUpdated: false,
      alerts: ['No documents found for this deal'],
    };
  }

  for (const doc of docFiles.rows) {
    const filePath = doc.file_path;

    if (!fs.existsSync(filePath)) {
      results.push({
        filename: doc.original_filename,
        documentType: 'UNKNOWN',
        success: false,
        error: 'File not found on disk',
      });
      continue;
    }

    // Infer mime type from extension since deal_document_files doesn't
    // persist the original mimetype. This is only used by the data-library
    // mirror for display — the actual extraction pipeline classifies the
    // document from its bytes.
    const ext = path.extname(doc.original_filename).toLowerCase();
    const inferredMime: string | undefined =
      ext === '.pdf'  ? 'application/pdf' :
      ext === '.csv'  ? 'text/csv' :
      ext === '.xls'  ? 'application/vnd.ms-excel' :
      ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
      ext === '.txt'  ? 'text/plain' :
      undefined;

    const result = await processDocument(
      filePath,
      doc.original_filename,
      dealId,
      uploadedBy,
      doc.id,
      inferredMime,
    );

    if (result.capsuleUpdated) anyCapsuleUpdated = true;
    if (result.libraryUpdated) anyLibraryUpdated = true;

    await pool.query(
      `UPDATE deal_document_files SET
         document_type = $2, extraction_status = $3,
         extraction_result = $4, updated_at = NOW()
       WHERE id = $1`,
      [doc.id, result.documentType, result.success ? 'completed' : 'failed', JSON.stringify({
        success: result.success,
        error: result.error,
        rowsInserted: result.rowsInserted,
        capsuleUpdated: result.capsuleUpdated,
        libraryUpdated: result.libraryUpdated,
        proformaSeeded: result.proformaSeeded,
        crossValidationVariances: result.crossValidationVariances,
        alerts: result.alerts,
      })]
    );

    results.push({
      filename: doc.original_filename,
      documentType: result.documentType,
      success: result.success,
      error: result.error,
      rowsInserted: result.rowsInserted,
    });
    allAlerts.push(...result.alerts);
  }

  return {
    dealId,
    documentsProcessed: results.length,
    results,
    capsuleUpdated: anyCapsuleUpdated,
    libraryUpdated: anyLibraryUpdated,
    alerts: allAlerts,
  };
}
