// ============================================================================
// extraction-pipeline.ts — PATCH SET
// Apply these targeted edits to backend/src/services/document-extraction/extraction-pipeline.ts
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 1 — `processDocument` must pass documentId into route context AND
// return the real capsule/library/seeder/xval flags to the caller.
// ─────────────────────────────────────────────────────────────────────────────

// FIND the entire body of processDocument():

export async function processDocument(
  filePath: string,
  filename: string,
  dealId: string,
  uploadedBy: string
): Promise<{ documentType: DocumentType; success: boolean; error?: string; rowsInserted?: number; alerts: string[] }> {
  // ... existing body
}

// REPLACE WITH (note expanded return type and threading of documentId):

export async function processDocument(
  filePath: string,
  filename: string,
  dealId: string,
  uploadedBy: string,
  documentId?: string,             // NEW — optional; if known, threaded into capsule
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
      documentId,                    // NEW — pass through
    });

    return {
      documentType: classification.documentType,
      success: true,
      rowsInserted: routeResult.rowsInserted,
      // CRITICAL: pass through real flags from data-router instead of fabricating from anySuccess
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


// ─────────────────────────────────────────────────────────────────────────────
// PATCH 2 — `processDealDocuments` passes documentId, persists real flags on
// the deal_document_files row, and aggregates real outcomes (no more fabrication).
// ─────────────────────────────────────────────────────────────────────────────

// FIND the entire body of processDealDocuments() and REPLACE WITH:

export async function processDealDocuments(
  dealId: string,
  uploadedBy: string
): Promise<PipelineResult> {
  const pool = getPool();
  const results: PipelineResult['results'] = [];
  const allAlerts: string[] = [];
  let anyCapsuleUpdated = false;
  let anyLibraryUpdated = false;
  let anyProformaSeeded = false;
  let totalCrossValidationVariances = 0;

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

    const result = await processDocument(filePath, doc.original_filename, dealId, uploadedBy, doc.id);

    // Track aggregate real flags
    if (result.capsuleUpdated) anyCapsuleUpdated = true;
    if (result.libraryUpdated) anyLibraryUpdated = true;
    if (result.proformaSeeded) anyProformaSeeded = true;
    if (result.crossValidationVariances) totalCrossValidationVariances += result.crossValidationVariances;

    // Persist FULL outcome on the deal_document_files row (not just success/error/rowsInserted)
    await pool.query(
      `UPDATE deal_document_files SET
         document_type = $2, extraction_status = $3,
         extraction_result = $4, updated_at = NOW()
       WHERE id = $1`,
      [doc.id, result.documentType, result.success ? 'completed' : 'failed', JSON.stringify({
        success: result.success,
        error: result.error,
        rowsInserted: result.rowsInserted,
        capsuleUpdated: result.capsuleUpdated,           // NEW — real flag
        libraryUpdated: result.libraryUpdated,           // NEW — real flag
        proformaSeeded: result.proformaSeeded,           // NEW
        crossValidationVariances: result.crossValidationVariances,  // NEW
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
    capsuleUpdated: anyCapsuleUpdated,           // real aggregate, not fabricated
    libraryUpdated: anyLibraryUpdated,           // real aggregate, not fabricated
    alerts: allAlerts,
  };
}
