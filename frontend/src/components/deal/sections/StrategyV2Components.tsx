/**
 * M08 v2 — Barrel re-export.
 * The 1,704-line monolith has been split into focused single-responsibility files.
 * All public exports are re-exported here so existing imports continue to work.
 *
 * New imports should reference the focused files directly:
 *   strategy-v2.types.ts          — HoverCtx, HoverContext
 *   strategy-v2.utils.tsx         — MONO, confColor, sevColor, fmtSafe, gateColor,
 *                                   gateLabel, dirArrow, pct, fmtScore, SS_COLORS,
 *                                   ScoreRing, BlockErrorFallback
 *   StrategyDetectionBanner.tsx   — DetectionBanner
 *   StrategySubStrategyComparison.tsx — SubStrategyComparison
 *   StrategySignalHeatmap.tsx     — SignalHeatmap
 *   StrategyEvidenceReportBlock.tsx   — EvidenceReportBlock
 *   StrategyCorrelationTimingPanel.tsx — CorrelationTimingPanel
 *   StrategyPlanDocument.tsx      — PlanDocument
 *   StrategyMonitoringDashboard.tsx   — MonitoringDashboard
 *   StrategyV2Analysis.tsx        — AICoordinatorNarrative, StrategyIntelligenceSummary,
 *                                   V2FullAnalysis
 */

export { HoverContext } from './strategy-v2.types';
export type { HoverCtx } from './strategy-v2.types';

export {
  MONO,
  BlockErrorFallback,
  confColor,
  sevColor,
  fmtSafe,
  gateColor,
  gateLabel,
  dirArrow,
  pct,
  fmtScore,
  SS_COLORS,
  ScoreRing,
} from './strategy-v2.utils';

export { DetectionBanner } from './StrategyDetectionBanner';
export { SubStrategyComparison } from './StrategySubStrategyComparison';
export { SignalHeatmap } from './StrategySignalHeatmap';
export { EvidenceReportBlock } from './StrategyEvidenceReportBlock';
export { CorrelationTimingPanel } from './StrategyCorrelationTimingPanel';
export { PlanDocument } from './StrategyPlanDocument';
export { MonitoringDashboard } from './StrategyMonitoringDashboard';
export {
  AICoordinatorNarrative,
  StrategyIntelligenceSummary,
  V2FullAnalysis,
} from './StrategyV2Analysis';
