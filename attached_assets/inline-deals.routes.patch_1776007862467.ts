// ============================================================================
// inline-deals.routes.ts — PATCH SET
// Apply these targeted edits to backend/src/api/rest/inline-deals.routes.ts
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 1 — `/upload-document` POST: thread documentId into processDocument
// and expose proforma seed flags in the response.
// ─────────────────────────────────────────────────────────────────────────────

// FIND (around line 1041):
    if (verifiedDealId) {
      processDocument(req.file.path, req.file.originalname, verifiedDealId, req.user!.userId)
        .then(async (result) => {
          console.log(`[ExtractionPipeline] ${req.file!.originalname} → ${result.documentType} (${result.success ? 'OK' : 'FAIL'}${result.rowsInserted ? `, ${result.rowsInserted} rows` : ''})`);
          if (result.alerts.length > 0) {
            console.log(`[ExtractionPipeline] Alerts: ${result.alerts.join('; ')}`);
          }
          try {
            await pool.query(
              `UPDATE deal_document_files SET
                 document_type = $1, extraction_status = $2,
                 extraction_result = $3, updated_at = NOW()
               WHERE id = $4`,
              [result.documentType, result.success ? 'completed' : 'failed',
               JSON.stringify({ success: result.success, error: result.error, rowsInserted: result.rowsInserted, alerts: result.alerts }),
               docId]
            );
          } catch (e) { console.error('[ExtractionPipeline] Status update error:', e); }
        })
        .catch(err => {
          console.error(`[ExtractionPipeline] Error processing ${req.file!.originalname}:`, err);
        });
    }

// REPLACE WITH:
    if (verifiedDealId) {
      // Pass docId as the 5th argument so the pipeline can thread it into
      // the capsule (extraction.document_id) for provenance.
      processDocument(req.file.path, req.file.originalname, verifiedDealId, req.user!.userId, docId)
        .then(async (result) => {
          const seedTag = result.proformaSeeded ? ' +seed' : '';
          const xvalTag = result.crossValidationVariances ? ` +xval(${result.crossValidationVariances})` : '';
          console.log(`[ExtractionPipeline] ${req.file!.originalname} → ${result.documentType} (${result.success ? 'OK' : 'FAIL'}${result.rowsInserted ? `, ${result.rowsInserted} rows` : ''}${seedTag}${xvalTag})`);
          if (result.alerts.length > 0) {
            console.log(`[ExtractionPipeline] Alerts: ${result.alerts.join('; ')}`);
          }
          try {
            await pool.query(
              `UPDATE deal_document_files SET
                 document_type = $1, extraction_status = $2,
                 extraction_result = $3, updated_at = NOW()
               WHERE id = $4`,
              [result.documentType, result.success ? 'completed' : 'failed',
               JSON.stringify({
                 success: result.success,
                 error: result.error,
                 rowsInserted: result.rowsInserted,
                 capsuleUpdated: result.capsuleUpdated,             // real flag
                 libraryUpdated: result.libraryUpdated,             // real flag
                 proformaSeeded: result.proformaSeeded,             // NEW
                 crossValidationVariances: result.crossValidationVariances,  // NEW
                 alerts: result.alerts,
               }),
               docId]
            );

            // Notify the frontend via WebSocket so the deal page can refresh
            // module data without polling. (Uses existing websocket.service if available.)
            try {
              const { broadcastToDeal } = await import('../../services/websocket.service');
              if (broadcastToDeal) {
                broadcastToDeal(verifiedDealId, {
                  type: 'extraction_complete',
                  documentId: docId,
                  documentType: result.documentType,
                  success: result.success,
                  capsuleUpdated: result.capsuleUpdated,
                  proformaSeeded: result.proformaSeeded,
                  crossValidationVariances: result.crossValidationVariances,
                });
              }
            } catch { /* websocket optional — don't fail the upload */ }
          } catch (e) { console.error('[ExtractionPipeline] Status update error:', e); }
        })
        .catch(err => {
          console.error(`[ExtractionPipeline] Error processing ${req.file!.originalname}:`, err);
        });
    }


// ─────────────────────────────────────────────────────────────────────────────
// PATCH 2 — POST `/` (deal create): threads docId into the bulk processing
// path and, on success, auto-triggers `financialModelEngine.buildModel()` so
// the financial dashboard has data to read.
// ─────────────────────────────────────────────────────────────────────────────

// FIND (around line 241):
    setImmediate(async () => {
      try {
        if (docIds.length > 0) {
          await pool.query(
            `UPDATE deal_document_files SET deal_id = $1, updated_at = NOW()
             WHERE id = ANY($2::uuid[]) AND uploaded_by = $3 AND deal_id IS NULL`,
            [row.id, docIds, req.user!.userId]
          );
        }
        await processDealDocuments(row.id, req.user!.userId);
      } catch (err) {
        console.error(`[ExtractionPipeline] Deal creation trigger failed for ${row.id}:`, err instanceof Error ? err.message : err);
      }
    });

// REPLACE WITH:
    setImmediate(async () => {
      try {
        if (docIds.length > 0) {
          await pool.query(
            `UPDATE deal_document_files SET deal_id = $1, updated_at = NOW()
             WHERE id = ANY($2::uuid[]) AND uploaded_by = $3 AND deal_id IS NULL`,
            [row.id, docIds, req.user!.userId]
          );
        }
        const pipelineResult = await processDealDocuments(row.id, req.user!.userId);

        // After extraction completes, if any document yielded a successful seed,
        // auto-trigger M09 financial model build so the dashboard has data.
        // The seeder has already populated deal_assumptions.year1 — buildModel
        // will read from there (after enhancing with M26/M27).
        const seedExists = await pool.query(
          `SELECT 1 FROM deal_assumptions WHERE deal_id = $1 AND year1 IS NOT NULL`,
          [row.id]
        );
        if (seedExists.rows.length > 0) {
          try {
            const { financialModelEngine } = await import('../../services/financial-model-engine.service');
            const { buildAssumptionsFromYear1Seed } = await import('../../services/proforma-seeder.service');
            const seedResult = await pool.query(
              `SELECT year1 FROM deal_assumptions WHERE deal_id = $1`,
              [row.id]
            );
            const year1 = seedResult.rows[0]?.year1;
            if (year1 && buildAssumptionsFromYear1Seed) {
              const assumptions = buildAssumptionsFromYear1Seed(year1, row);
              await financialModelEngine.buildModel(row.id, assumptions);
              console.log(`[FinancialModel] Auto-built from seeded assumptions for deal ${row.id}`);
            }
          } catch (modelErr) {
            console.error(`[FinancialModel] Auto-build failed for ${row.id}:`, modelErr instanceof Error ? modelErr.message : modelErr);
          }
        }
      } catch (err) {
        console.error(`[ExtractionPipeline] Deal creation trigger failed for ${row.id}:`, err instanceof Error ? err.message : err);
      }
    });


// ─────────────────────────────────────────────────────────────────────────────
// PATCH 3 — Add a new GET endpoint for the proforma seed shape so the
// frontend can read the LayeredValue tree without a full /summary fetch.
// Add this after the existing /:dealId/extract-document route (~line 1136):
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:dealId/proforma/year1', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const result = await pool.query(
      `SELECT year1, source_type, source_date, updated_at
       FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    if (result.rows.length === 0 || !result.rows[0].year1) {
      return res.json({ success: true, data: null, message: 'No proforma seed available — upload a T12 or rent roll first' });
    }
    res.json({
      success: true,
      data: {
        year1: result.rows[0].year1,
        sourceType: result.rows[0].source_type,
        seededAt: result.rows[0].source_date,
        updatedAt: result.rows[0].updated_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH endpoint for user overrides on individual fields:
router.patch('/:dealId/proforma/year1/override', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const { fieldPath, value } = req.body;

    if (!fieldPath || typeof fieldPath !== 'string') {
      return res.status(400).json({ success: false, error: 'fieldPath required' });
    }

    const ownerCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { applyUserOverride } = await import('../../services/proforma-seeder.service');
    await applyUserOverride(pool, dealId, fieldPath, value, req.user!.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
