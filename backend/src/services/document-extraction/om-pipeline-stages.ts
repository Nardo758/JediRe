/**
 * Single source of truth for OM pipeline stage identifiers.
 *
 * These string literals are persisted to `data_library_files.parsing_stage`
 * by the backend pipeline runner and consumed by the frontend Data Library
 * UI for status badges, color coding, and retry-eligibility checks.
 *
 * If you add a new terminal failure stage to the pipeline:
 *   1. Add it to `OM_TERMINAL_FAILURE_STAGES` below.
 *   2. Mirror the addition in `frontend/src/constants/omPipelineStages.ts`
 *      (the in-sync test in
 *      `backend/src/services/document-extraction/tests/om-pipeline-stages.test.ts`
 *      will fail loudly if you forget).
 *   3. Add a label + color entry in the frontend `stageLabels` /
 *      `stageColors` maps in `DataLibraryPage.tsx`.
 */

/**
 * Terminal failure stages — the pipeline reached this stage and aborted.
 * Used by:
 *   - `parseFileAsync` outer catch (preserves the granular stage instead of
 *     overwriting it with a generic 'error').
 *   - The frontend retry button (only retryable when the file is in one of
 *     these stages or in the generic 'error' status).
 */
export const OM_TERMINAL_FAILURE_STAGES = [
  'parse_failed',
  'ocr_failed',
  'distribute_failed',
  'sentiment_failed',
] as const;

export type OmTerminalFailureStage = (typeof OM_TERMINAL_FAILURE_STAGES)[number];

export const OM_TERMINAL_FAILURE_STAGE_SET: ReadonlySet<string> = new Set(
  OM_TERMINAL_FAILURE_STAGES,
);

export function isOmTerminalFailureStage(
  stage: string | null | undefined,
): stage is OmTerminalFailureStage {
  return !!stage && OM_TERMINAL_FAILURE_STAGE_SET.has(stage);
}
