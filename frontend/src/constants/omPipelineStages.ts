/**
 * Mirror of `backend/src/services/document-extraction/om-pipeline-stages.ts`.
 *
 * Backend is the source of truth. The two lists are kept in sync by the
 * test in
 * `backend/src/services/document-extraction/tests/om-pipeline-stages.test.ts`
 * which reads this file at test time and fails if the sets diverge.
 *
 * If you add a stage here without updating the backend file (or vice versa)
 * the in-sync test will fail.
 */

export const OM_TERMINAL_FAILURE_STAGES = [
  'parse_failed',
  'ocr_failed',
  'distribute_failed',
  'sentiment_failed',
] as const;

export type OmTerminalFailureStage = (typeof OM_TERMINAL_FAILURE_STAGES)[number];

const TERMINAL_SET: ReadonlySet<string> = new Set(OM_TERMINAL_FAILURE_STAGES);

export function isOmTerminalFailureStage(
  stage: string | null | undefined,
): stage is OmTerminalFailureStage {
  return !!stage && TERMINAL_SET.has(stage);
}

/**
 * Stages from which the operator may re-trigger the OM pipeline. Includes
 * the generic 'error' status (set when the pipeline failed before reaching
 * a stage-specific catch handler) plus every terminal failure stage.
 */
export const OM_RETRYABLE_STAGES: ReadonlySet<string> = new Set<string>([
  'error',
  ...OM_TERMINAL_FAILURE_STAGES,
]);

/**
 * Shared failure-badge color. Every terminal failure stage renders with the
 * same red so the operator gets a consistent visual signal.
 */
export const OM_FAILURE_STAGE_COLOR = '#e06c75';

/**
 * Human-readable label for each terminal failure stage. Keep keys in sync
 * with OM_TERMINAL_FAILURE_STAGES — the drift-guard test in
 * `backend/.../tests/om-pipeline-stages.test.ts` (and the assertion below)
 * will fail loudly if a stage is added without a label.
 */
export const OM_FAILURE_STAGE_LABELS: Record<OmTerminalFailureStage, string> = {
  parse_failed: 'Parse failed',
  ocr_failed: 'OCR failed',
  distribute_failed: 'Routing failed',
  sentiment_failed: 'Sentiment failed',
};

// Compile-time check: ensure every terminal failure stage has a label.
// (TypeScript will error here if a new stage is added to
// OM_TERMINAL_FAILURE_STAGES without a corresponding label entry.)
const _failureLabelsExhaustive: Record<OmTerminalFailureStage, string> =
  OM_FAILURE_STAGE_LABELS;
void _failureLabelsExhaustive;
