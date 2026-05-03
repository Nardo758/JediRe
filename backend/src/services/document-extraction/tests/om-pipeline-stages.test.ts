/**
 * Drift guard for the OM pipeline failure stages.
 *
 * The set of terminal failure stages lives in two places (because backend
 * and frontend don't share a build):
 *   - backend/src/services/document-extraction/om-pipeline-stages.ts
 *   - frontend/src/constants/omPipelineStages.ts
 *
 * This test reads the frontend mirror as text and asserts the same set of
 * stage identifiers appears, so the two files cannot silently drift.
 */
import * as fs from 'fs';
import * as path from 'path';
import { OM_TERMINAL_FAILURE_STAGES } from '../om-pipeline-stages';

describe('OM_TERMINAL_FAILURE_STAGES', () => {
  it('matches the frontend mirror in frontend/src/constants/omPipelineStages.ts', () => {
    const frontendPath = path.resolve(
      __dirname,
      '../../../../../frontend/src/constants/omPipelineStages.ts',
    );
    expect(fs.existsSync(frontendPath)).toBe(true);

    const text = fs.readFileSync(frontendPath, 'utf8');
    // Extract the array literal that follows
    // `export const OM_TERMINAL_FAILURE_STAGES = [`.
    const match = text.match(
      /export const OM_TERMINAL_FAILURE_STAGES\s*=\s*\[([\s\S]*?)\]\s*as const/,
    );
    expect(match).not.toBeNull();

    const frontendStages = [...match![1].matchAll(/'([^']+)'/g)]
      .map((m) => m[1])
      .sort();
    const backendStages = [...OM_TERMINAL_FAILURE_STAGES].sort();

    expect(frontendStages).toEqual(backendStages);
  });

  it('contains the four documented terminal failure stages', () => {
    expect([...OM_TERMINAL_FAILURE_STAGES].sort()).toEqual(
      ['distribute_failed', 'ocr_failed', 'parse_failed', 'sentiment_failed'].sort(),
    );
  });

  it('every terminal failure stage has a frontend OM_FAILURE_STAGE_LABELS entry', () => {
    const frontendPath = path.resolve(
      __dirname,
      '../../../../../frontend/src/constants/omPipelineStages.ts',
    );
    const text = fs.readFileSync(frontendPath, 'utf8');
    const block = text.match(
      /OM_FAILURE_STAGE_LABELS:\s*Record<OmTerminalFailureStage,\s*string>\s*=\s*\{([\s\S]*?)\}/,
    );
    expect(block).not.toBeNull();
    const labelKeys = [...block![1].matchAll(/(\w+):\s*'/g)].map((m) => m[1]).sort();
    expect(labelKeys).toEqual([...OM_TERMINAL_FAILURE_STAGES].sort());
  });
});
