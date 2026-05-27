import React, { useState } from 'react';
import { BT } from '../bloomberg-ui';
import { BlockErrorBoundary } from '../../BlockErrorBoundary';
import type { StrategyAnalysisV2 } from '../../../hooks/useStrategyAnalysisV2';
import { HoverContext } from './strategy-v2.types';
import { MONO, confColor, BlockErrorFallback } from './strategy-v2.utils';
import { DetectionBanner } from './StrategyDetectionBanner';
import { SubStrategyComparison } from './StrategySubStrategyComparison';
import { SignalHeatmap } from './StrategySignalHeatmap';
import { EvidenceReportBlock } from './StrategyEvidenceReportBlock';
import { CorrelationTimingPanel } from './StrategyCorrelationTimingPanel';
import { PlanDocument } from './StrategyPlanDocument';
import { MonitoringDashboard } from './StrategyMonitoringDashboard';

export function AICoordinatorNarrative({ narrative }: { narrative: string }) {
  return (
    <div style={{ borderTop: `1px solid ${BT.border.medium}`, borderBottom: `1px solid ${BT.border.medium}`, padding: '10px 14px', background: BT.bg.panelAlt, margin: '1px 0' }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>AI COORDINATOR NARRATIVE</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, lineHeight: 1.7, fontStyle: 'italic' }}>
        {narrative || 'No coordinator narrative available for this deal.'}
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  color,
  truncate = false,
}: {
  label: string;
  value: string;
  color: string;
  truncate?: boolean;
}) {
  return (
    <div>
      <div style={{
        fontFamily: MONO, fontSize: 8, color: BT.text.muted,
        letterSpacing: 0.8, marginBottom: 2, textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 10, fontWeight: 700, color,
        ...(truncate ? {
          whiteSpace: 'nowrap' as const,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        } : {}),
      }}>
        {value}
      </div>
    </div>
  );
}

export function StrategyIntelligenceSummary({
  analysis,
}: {
  analysis: StrategyAnalysisV2;
}) {
  const det = analysis.detection;
  const isGated = det.requiresUserConfirmation && !det.userConfirmed;

  const primary = (analysis.subStrategies ?? []).find(ss => ss.isDetectedPrimary)
    ?? analysis.subStrategies?.[0]
    ?? null;

  const conf = det.confidence;
  const confPct = `${(conf * 100).toFixed(0)}%`;
  const confLabel = conf >= 0.85 ? 'HIGH' : conf >= 0.70 ? 'MEDIUM' : 'LOW';
  const cColor = confColor(conf);

  const fp = primary?.financialPreview;
  const riskFactors = primary?.evidenceReport?.thesisPrompt?.riskFactors ?? [];
  const topRisk = riskFactors[0] ?? null;
  const thesis = primary?.evidenceReport?.thesis ?? null;

  const entryQuarter = analysis.plan?.entry?.targetQuarter ?? null;
  const priceCeiling = analysis.plan?.entry?.priceCeiling ?? null;

  const dash = '—';

  const fmt = (v: unknown, suffix = '', digits = 1): string => {
    if (isGated) return dash;
    if (v === null || v === undefined || v === '') return dash;
    const n = Number(v);
    if (!Number.isFinite(n)) return dash;
    return `${n.toFixed(digits)}${suffix}`;
  };

  const fmtPrice = (v: unknown): string => {
    if (isGated) return dash;
    if (v === null || v === undefined) return dash;
    const n = Number(v);
    if (!Number.isFinite(n)) return dash;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const holdMonths = fp?.holdMonths ?? null;
  const holdStr = isGated
    ? dash
    : holdMonths != null && Number.isFinite(Number(holdMonths))
      ? Number(holdMonths) >= 12
        ? `${(Number(holdMonths) / 12).toFixed(1)}yr`
        : `${Number(holdMonths)}mo`
      : dash;

  const strategyName = (primary?.name || det.detectedSubStrategy || det.detectedDealType || '')
    .replace(/_/g, ' ')
    .toUpperCase() || dash;

  return (
    <div style={{
      borderLeft: `3px solid ${BT.text.amber}`,
      background: BT.bg.panelAlt,
      borderBottom: `1px solid ${BT.border.subtle}`,
      padding: '10px 14px 12px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10, flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, color: BT.text.amber,
          letterSpacing: 1, fontWeight: 700,
        }}>
          STRATEGY INTELLIGENCE
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 9, color: BT.text.muted,
        }}>
          ·
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary,
          letterSpacing: 0.3,
        }}>
          {strategyName}
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700, color: cColor,
          background: `${cColor}18`, border: `1px solid ${cColor}44`,
          padding: '1px 6px', letterSpacing: 0.5,
        }}>
          {confLabel} {confPct}
        </span>
        {isGated && (
          <span style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.amber,
            background: `${BT.text.amber}12`, border: `1px solid ${BT.text.amber}33`,
            padding: '1px 6px', letterSpacing: 0.4,
          }}>
            CONFIRM DETECTION TO UNLOCK FINANCIALS
          </span>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px 10px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SummaryCell
            label="PRIMARY IRR"
            value={fmt(fp?.irr, '%', 1)}
            color={isGated ? BT.text.muted : BT.text.green}
          />
          <SummaryCell
            label="EQUITY MULTIPLE"
            value={isGated ? dash : fp?.equityMultiple != null ? `${Number(fp.equityMultiple).toFixed(2)}×` : dash}
            color={isGated ? BT.text.muted : BT.text.green}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SummaryCell
            label="HOLD PERIOD"
            value={holdStr}
            color={isGated ? BT.text.muted : BT.text.cyan}
          />
          <SummaryCell
            label="ENTRY TARGET"
            value={isGated ? dash : entryQuarter ?? dash}
            color={isGated ? BT.text.muted : BT.text.cyan}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SummaryCell
            label="PRICE CEILING"
            value={fmtPrice(priceCeiling)}
            color={isGated ? BT.text.muted : BT.text.amber}
          />
          <SummaryCell
            label="TOP RISK"
            value={isGated ? dash : topRisk ?? dash}
            color={isGated ? BT.text.muted : BT.text.red}
            truncate
          />
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          borderLeft: `1px solid ${BT.border.subtle}`, paddingLeft: 10,
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.muted,
            letterSpacing: 0.8, marginBottom: 3, textTransform: 'uppercase',
          }}>
            THESIS
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 9,
            color: isGated ? BT.text.muted : BT.text.secondary,
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            fontStyle: isGated ? 'italic' : 'normal',
          }}>
            {isGated ? 'Confirm detection to unlock thesis.' : thesis ?? dash}
          </div>
        </div>
      </div>
    </div>
  );
}

export function V2FullAnalysis({
  analysis,
  onConfirm,
  onAdjust,
  onOverride,
  dealId,
}: {
  analysis: StrategyAnalysisV2;
  onConfirm: () => void;
  onAdjust: (subStrategyKey: string) => void;
  onOverride: (ac: string) => void;
  dealId: string;
}) {
  const [hoveredEvidenceRef, setHoveredEvidenceRef] = useState<string | null>(null);
  const det = analysis.detection;
  const isGated = det.requiresUserConfirmation && !det.userConfirmed;

  return (
    <HoverContext.Provider value={{ hoveredEvidenceRef, setHoveredEvidenceRef }}>
      <StrategyIntelligenceSummary analysis={analysis} />

      <DetectionBanner detection={det} onConfirm={onConfirm} onAdjust={onAdjust} onOverride={onOverride} />

      {!isGated && (
        <>
          <BlockErrorBoundary
            label="SubStrategyComparisonPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the sub-strategy comparison panel — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <SubStrategyComparison subStrategies={analysis.subStrategies} arbitrage={analysis.arbitrage} />
          </BlockErrorBoundary>

          {(analysis.subStrategies ?? []).map(ss => (
            <BlockErrorBoundary
              key={ss.key}
              label={`EvidenceReportBlock:${ss.key}`}
              fallback={({ retry }) => (
                <BlockErrorFallback
                  message={`Couldn't render evidence for ${(ss.name || ss.key).replace(/_/g, ' ').toUpperCase()} — other sub-strategies are unaffected.`}
                  onRetry={retry}
                />
              )}
            >
              <EvidenceReportBlock ss={ss} defaultExpanded={ss.isDetectedPrimary} />
            </BlockErrorBoundary>
          ))}

          <BlockErrorBoundary
            label="SignalHeatmapPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the signal heatmap — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <SignalHeatmap subStrategies={analysis.subStrategies} signalScores={analysis.signalScores} />
          </BlockErrorBoundary>

          <BlockErrorBoundary
            label="CorrelationTimingPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the correlation & timing panel — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <CorrelationTimingPanel
              goldenChain={analysis.goldenChain}
              correlationAlerts={analysis.correlationAlerts}
              indicators={analysis.indicators}
            />
          </BlockErrorBoundary>

          <BlockErrorBoundary
            label="PlanDocumentPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the investment plan — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <PlanDocument plan={analysis.plan} dealId={dealId} />
          </BlockErrorBoundary>

          <BlockErrorBoundary
            label="MonitoringDashboardPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the monitoring dashboard — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <MonitoringDashboard monitoring={analysis.plan?.monitoring || []} />
          </BlockErrorBoundary>

          <BlockErrorBoundary
            label="AICoordinatorNarrativePanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the AI coordinator narrative — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <AICoordinatorNarrative narrative={analysis.coordinatorNarrative} />
          </BlockErrorBoundary>
        </>
      )}

      {isGated && (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.amber }}>
            DETECTION GATE LOCKED
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginTop: 8 }}>
            Confirm the detected asset class above to unlock scoring, evidence, and plan sections.
          </div>
        </div>
      )}
    </HoverContext.Provider>
  );
}
