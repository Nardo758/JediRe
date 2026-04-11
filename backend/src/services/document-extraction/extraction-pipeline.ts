import fs from 'fs';
import path from 'path';
import { classifyDocument } from './classifier';
import { parseT12 } from './parsers/t12-parser';
import { parseRentRoll } from './parsers/rent-roll-parser';
import { parseAgedReceivables } from './parsers/aged-receivables-parser';
import { parseBoxScore } from './parsers/box-score-parser';
import { parseConcessionBurnoff } from './parsers/concession-burnoff-parser';
import { parseLTO } from './parsers/lto-parser';
import { parseTaxBill } from './parsers/tax-bill-parser';
import { parseOtherIncome } from './parsers/other-income-parser';
import { routeExtractionResult } from './data-router';
import { DocumentType, ExtractionResult, PipelineResult } from './types';

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

export async function processDocument(
  filePath: string,
  filename: string,
  dealId: string,
  uploadedBy: string
): Promise<{ documentType: DocumentType; success: boolean; error?: string; rowsInserted?: number; alerts: string[] }> {
  const alerts: string[] = [];

  try {
    const buffer = fs.readFileSync(filePath);
    const classification = classifyDocument(buffer, filename);

    if (classification.documentType === 'UNKNOWN') {
      return { documentType: 'UNKNOWN', success: false, error: 'Could not classify document type', alerts };
    }

    if (classification.confidence < 0.5) {
      alerts.push(`Low classification confidence (${(classification.confidence * 100).toFixed(0)}%) for ${classification.documentType}`);
    }

    const parser = getParser(classification.documentType);
    if (!parser) {
      return { documentType: classification.documentType, success: false, error: `No parser available for ${classification.documentType}`, alerts };
    }

    const extractionResult = parser(buffer, filename);

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
      propertyId: dealId,
      filename,
      uploadedBy,
    });

    return {
      documentType: classification.documentType,
      success: true,
      rowsInserted: routeResult.rowsInserted,
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
  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'deal-documents');
  const results: PipelineResult['results'] = [];
  const allAlerts: string[] = [];

  if (!fs.existsSync(uploadsDir)) {
    return {
      dealId,
      documentsProcessed: 0,
      results: [],
      capsuleUpdated: false,
      libraryUpdated: false,
      alerts: ['No uploads directory found'],
    };
  }

  const files = fs.readdirSync(uploadsDir);
  if (files.length === 0) {
    return {
      dealId,
      documentsProcessed: 0,
      results: [],
      capsuleUpdated: false,
      libraryUpdated: false,
      alerts: ['No documents found in uploads directory'],
    };
  }

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const result = await processDocument(filePath, file, dealId, uploadedBy);
    results.push({
      filename: file,
      documentType: result.documentType,
      success: result.success,
      error: result.error,
      rowsInserted: result.rowsInserted,
    });
    allAlerts.push(...result.alerts);
  }

  const anySuccess = results.some(r => r.success);

  return {
    dealId,
    documentsProcessed: results.length,
    results,
    capsuleUpdated: anySuccess,
    libraryUpdated: anySuccess,
    alerts: allAlerts,
  };
}
