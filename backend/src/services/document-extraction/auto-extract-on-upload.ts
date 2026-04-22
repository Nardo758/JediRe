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
// Side-effect import: ensures all skills (extract_document, review_contract,
// analyze_appraisal, parse_environmental_report, ...) are registered with
// the skillRegistry before we try to execute them. Without this, the registry
// could be empty depending on which routes the server entrypoint mounted.
import '../skills/skills';

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
    type SkillParams = {
      fileId: string;
      reportType?: 'phase1' | 'phase2';
      extractionType?: 't12' | 'rent_roll' | 'om' | 'appraisal' | 'auto';
    };
    const params: SkillParams = { fileId };
    // analyze_appraisal / review_contract don't need extra args; parse_environmental_report needs reportType
    if (skillId === 'parse_environmental_report') {
      params.reportType = 'phase1';
    } else if (skillId === 'extract_document') {
      params.extractionType = 'auto';
    }

    const result = await skillRegistry.execute(skillId, params, {
      dealId,
      userId,
    });

    if (result.success) {
      await query(
        `UPDATE deal_files
            SET extraction_status = 'done',
                extraction_result = $2,
                extraction_completed_at = NOW(),
                extraction_error = NULL
          WHERE id = $1`,
        [fileId, JSON.stringify(result.data ?? {})]
      );
      logger.info('auto-extract: done', { fileId, skillId });
    } else {
      await query(
        `UPDATE deal_files
            SET extraction_status = 'failed',
                extraction_error = $2,
                extraction_completed_at = NOW()
          WHERE id = $1`,
        [fileId, result.error || 'Unknown extraction error']
      );
      logger.warn('auto-extract: failed', { fileId, skillId, error: result.error });
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
