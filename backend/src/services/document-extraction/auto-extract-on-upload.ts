/**
 * Auto-extract pipeline triggered on file upload (Task #320)
 *
 * When a file is uploaded to a deal, this service:
 *   1. Marks deal_files.extraction_status = 'running'
 *   2. Picks the appropriate extract skill based on the file's category
 *   3. Invokes the skill via the skill registry
 *   4. Persists the result and final status (done | failed | skipped)
 *
 * Designed to be fire-and-forget from the upload handler.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { skillRegistry } from '../skills/skill-registry';
import { eventDispatcher } from '../agents/event-dispatcher';
import { openclawNotifier } from '../notifications/openclawNotifier';
// Side-effect import: ensures all skills (extract_document, review_contract,
// analyze_appraisal, parse_environmental_report, ...) are registered with
// the skillRegistry before we try to execute them. Without this, the registry
// could be empty depending on which routes the server entrypoint mounted.
import '../skills/skills';
// Real extraction pipeline (classifier + parsers + data-router → deal_data /
// deal_capsules). The 'extract_document' skill in the registry is a thin
// stub used for agent tool-calling discovery; for actual upload-driven
// extraction we delegate to processDocument so OM/T12/RentRoll PDFs really
// get parsed and routed into deal_data.broker_claims, deal_monthly_actuals,
// rent_roll_snapshots, etc.
import { processDocument } from './extraction-pipeline';

// Map deal_files.category -> extract skill id
function pickSkillForCategory(category: string | null | undefined): string {
  switch ((category || '').toLowerCase()) {
    case 'legal':
      return 'review_contract';
    case 'appraisals':
      return 'analyze_appraisal';
    case 'environmental':
      return 'parse_environmental_report';
    case 'financial':
    case 'financial-analysis':
    case 'inspections':
    case 'permits':
    case 'insurance':
    case 'marketing':
    case 'other':
    default:
      return 'extract_document';
  }
}

// Categories we don't try to auto-extract (e.g. raw images / zips)
function shouldSkipExtraction(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  if (mimeType.startsWith('image/')) return true;
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return true;
  return false;
}

export interface TriggerOptions {
  fileId: string;
  dealId: string;
  userId: string;
  category?: string | null;
  mimeType?: string | null;
  /** Original upload filename — used for display in OpenClaw alerts. */
  filename?: string | null;
}

/**
 * Run extraction for a single file. Resolves when finished.
 * Caller should typically NOT await (fire-and-forget) so the upload
 * response returns quickly, but awaiting is safe (used in tests).
 */
export async function runExtractionForFile(opts: TriggerOptions): Promise<void> {
  const { fileId, dealId, userId, category, mimeType } = opts;

  if (shouldSkipExtraction(mimeType)) {
    try {
      await query(
        `UPDATE deal_files
            SET extraction_status = 'skipped',
                extraction_completed_at = NOW(),
                extraction_error = NULL
          WHERE id = $1`,
        [fileId]
      );
    } catch (err) {
      logger.warn('auto-extract: failed to mark skipped', { fileId, err });
    }
    return;
  }

  const skillId = pickSkillForCategory(category);

  try {
    await query(
      `UPDATE deal_files
          SET extraction_status = 'running',
              extraction_skill = $2,
              extraction_started_at = NOW(),
              extraction_error = NULL
        WHERE id = $1`,
      [fileId, skillId]
    );
  } catch (err) {
    logger.error('auto-extract: failed to mark running', { fileId, err });
    return;
  }

  try {
    let resultData: Record<string, unknown> | null = null;
    let resultSuccess = false;
    let resultError: string | undefined;

    if (skillId === 'extract_document') {
      // Real extraction path: classify + parse + route into deal_data /
      // deal_capsules. The corresponding skillRegistry entry is a stub
      // that only echoes "queued", which is why upload-driven extraction
      // never actually populated anything before this branch existed.
      const fileRow = await query(
        `SELECT file_path, original_filename, mime_type
           FROM deal_files
          WHERE id = $1`,
        [fileId]
      );
      if (fileRow.rows.length === 0) {
        resultSuccess = false;
        resultError = 'File row vanished before extraction';
      } else {
        const { file_path, original_filename, mime_type } = fileRow.rows[0] as {
          file_path: string;
          original_filename: string;
          mime_type: string | null;
        };
        const pipelineResult = await processDocument(
          file_path,
          original_filename,
          dealId,
          userId,
          fileId,
          mime_type ?? mimeType ?? undefined
        );
        resultSuccess = pipelineResult.success;
        resultError = pipelineResult.error;
        resultData = {
          documentType: pipelineResult.documentType,
          rowsInserted: pipelineResult.rowsInserted ?? 0,
          capsuleUpdated: pipelineResult.capsuleUpdated ?? false,
          libraryUpdated: pipelineResult.libraryUpdated ?? false,
          proformaSeeded: pipelineResult.proformaSeeded ?? false,
          crossValidationVariances: pipelineResult.crossValidationVariances ?? 0,
          alerts: pipelineResult.alerts ?? [],
        };
      }
    } else {
      // Other categories (legal/appraisals/environmental) still go through
      // the skill registry. Those skills are currently stubs but the contract
      // is the same — when they get real implementations they'll just work.
      type SkillParams = {
        fileId: string;
        reportType?: 'phase1' | 'phase2';
      };
      const params: SkillParams = { fileId };
      if (skillId === 'parse_environmental_report') {
        params.reportType = 'phase1';
      }
      const result = await skillRegistry.execute(skillId, params, {
        dealId,
        userId,
      });
      resultSuccess = result.success;
      resultError = result.error;
      resultData = (result.data ?? null) as Record<string, unknown> | null;
    }

    if (resultSuccess) {
      await query(
        `UPDATE deal_files
            SET extraction_status = 'done',
                extraction_result = $2,
                extraction_completed_at = NOW(),
                extraction_error = NULL
          WHERE id = $1`,
        [fileId, JSON.stringify(resultData ?? {})]
      );
      logger.info('auto-extract: done', { fileId, skillId });

      // After extraction succeeds, notify agents to underwrite
      const dealFile = await query(
        `SELECT deal_id, category FROM deal_files WHERE id = $1`,
        [fileId]
      );
      const df = dealFile.rows[0];
      if (df?.deal_id) {
        const cat = (df.category || '').toLowerCase();
<<<<<<< HEAD
        // Trigger agents on any uploaded document — not just OM
        // The agent system triages based on category internally
        eventDispatcher.onDocumentUploaded(df.deal_id, 'system', {
          fileId,
          filename: opts.filename || '',
          category: cat || 'unknown',
          mimeType: opts.mimeType || 'application/octet-stream',
        }).catch(e => logger.warn('auto-extract: failed to trigger underwriting', { fileId, e }));
=======
        if (cat.includes('offering') || cat.includes('om')) {
          eventDispatcher.onDocumentUploaded(df.deal_id, 'system', {
            fileId,
            filename: opts.filename || '',
            category: 'offering_memorandum',
            mimeType: 'application/pdf',
          }).catch(e => logger.warn('auto-extract: failed to trigger underwriting', { fileId, e }));
        }

        // Fan a multi-channel notification out to OpenClaw (Telegram + SMS)
        // so the deal team learns "we now know what's in this file" without
        // having to refresh the UI. Fire-and-forget — never blocks extraction.
        if (openclawNotifier.isEnabled()) {
          openclawNotifier.notifyDocumentExtracted({
            dealId: df.deal_id,
            fileId,
            filename: opts.filename ?? undefined,
            category: df.category,
          }).catch((e: unknown) => {
            logger.warn('auto-extract: openclaw notify failed', {
              fileId,
              error: e instanceof Error ? e.message : String(e),
            });
          });
        }
>>>>>>> ca137e2a (Task #431: Replace ClawdBot stub with OpenClaw multi-channel notifier)
      }
    } else {
      await query(
        `UPDATE deal_files
            SET extraction_status = 'failed',
                extraction_error = $2,
                extraction_completed_at = NOW()
          WHERE id = $1`,
        [fileId, resultError || 'Unknown extraction error']
      );
      logger.warn('auto-extract: failed', { fileId, skillId, error: resultError });
    }
  } catch (err) {
    logger.error('auto-extract: threw', { fileId, skillId, err });
    const message =
      err instanceof Error ? err.message : 'Extraction crashed';
    try {
      await query(
        `UPDATE deal_files
            SET extraction_status = 'failed',
                extraction_error = $2,
                extraction_completed_at = NOW()
          WHERE id = $1`,
        [fileId, message]
      );
    } catch (writeErr) {
      logger.error('auto-extract: failed to record failure', { fileId, writeErr });
    }
  }
}

/**
 * Fire-and-forget wrapper used by the upload route.
 * Catches any unhandled rejection so it never crashes the request handler.
 */
export function triggerExtractionInBackground(opts: TriggerOptions): void {
  setImmediate(() => {
    runExtractionForFile(opts).catch((err) => {
      logger.error('auto-extract: background trigger crashed', { fileId: opts.fileId, err });
    });
  });
}
