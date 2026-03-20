/**
 * PathComparisonTable — Side-by-side comparison of all 4 development paths
 *
 * Shows units, timeline, entitlement cost, construction cost, estimated IRR,
 * risk level, and approval probability for each path. Highlights the selected path.
 */

import React, { useMemo } from 'react';
import { CheckCircle2, TrendingUp } from 'lucide-react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import type { DevelopmentPath } from '../../../types/zoning.types';
import { T as BT } from '../../deal/bloomberg-tokens';

interface PathRow {
  id: DevelopmentPath;
  label: string;
  units: number;
  timeline: string;
  entitlementCost: string;
  constructionCost: string;
  estimatedIrr: string;
  riskLevel: string;
  riskStyle: React.CSSProperties;
  approvalProb: string;
}

interface PathComparisonTableProps {
  byRightUnits: number;
  overlayBonusPct: number | null;
  lotAcres: number;
  maxDensityPerAcre: number;
  avgUnitSizeSf: number;
  costPerSf?: number;
  rezoneAnalysis?: any;
}

export default function PathComparisonTable({
  byRightUnits,
  overlayBonusPct,
  lotAcres,
  maxDensityPerAcre,
  avgUnitSizeSf,
  costPerSf = 185,
  rezoneAnalysis,
}: PathComparisonTableProps) {
  const { development_path } = useZoningModuleStore();

  const paths: PathRow[] = useMemo(() => {
    const overlayUnits = overlayBonusPct
      ? Math.floor(byRightUnits * (1 + overlayBonusPct / 100))
      : 0;
    const varianceUnits = Math.floor(byRightUnits * 1.15);
    const bestTarget = rezoneAnalysis?.bestTarget;
    const rezoneUnits = bestTarget
      ? bestTarget.targetEnvelope.maxCapacity
      : Math.floor(lotAcres * maxDensityPerAcre * 1.5);

    const estConstructionCost = (units: number) => {
      const gfa = units * avgUnitSizeSf;
      const cost = gfa * costPerSf;
      if (cost >= 1e6) return `$${(cost / 1e6).toFixed(1)}M`;
      return `$${(cost / 1e3).toFixed(0)}K`;
    };

    const estIrr = (units: number, months: number, risk: number) => {
      const base = 18 + (units / byRightUnits - 1) * 12;
      const timePenalty = months * 0.15;
      const riskDiscount = risk * 2;
      return `${Math.max(8, base - timePenalty - riskDiscount).toFixed(1)}%`;
    };

    const result: PathRow[] = [
      {
        id: 'by_right',
        label: 'By-Right',
        units: byRightUnits,
        timeline: '0 mo',
        entitlementCost: '$0',
        constructionCost: estConstructionCost(byRightUnits),
        estimatedIrr: estIrr(byRightUnits, 0, 0),
        riskLevel: 'Low',
        riskStyle: { color: BT.greenL, background: BT.greenBg },
        approvalProb: '100%',
      },
    ];

    if (overlayUnits > 0) {
      result.push({
        id: 'overlay_bonus',
        label: 'Overlay Bonus',
        units: overlayUnits,
        timeline: '2-4 mo',
        entitlementCost: '~$500K',
        constructionCost: estConstructionCost(overlayUnits),
        estimatedIrr: estIrr(overlayUnits, 3, 1),
        riskLevel: 'Low-Med',
        riskStyle: { color: BT.blueL, background: BT.blueBg },
        approvalProb: '85-95%',
      });
    }

    result.push(
      {
        id: 'variance',
        label: 'Variance',
        units: varianceUnits,
        timeline: '3-6 mo',
        entitlementCost: '~$25K',
        constructionCost: estConstructionCost(varianceUnits),
        estimatedIrr: estIrr(varianceUnits, 4.5, 2),
        riskLevel: 'Moderate',
        riskStyle: { color: BT.amberL, background: BT.amberBg },
        approvalProb: '60-75%',
      },
      {
        id: 'rezone',
        label: bestTarget ? `Rezone to ${bestTarget.targetDistrictCode}` : 'Full Rezone',
        units: rezoneUnits,
        timeline: bestTarget?.estimatedTimeline || '8-18 mo',
        entitlementCost: bestTarget?.estimatedCost || '$275-500K',
        constructionCost: estConstructionCost(rezoneUnits),
        estimatedIrr: estIrr(rezoneUnits, 13, 4),
        riskLevel: 'High',
        riskStyle: { color: BT.redL, background: BT.redBg },
        approvalProb: '30-50%',
      },
    );

    return result;
  }, [byRightUnits, overlayBonusPct, lotAcres, maxDensityPerAcre, avgUnitSizeSf, costPerSf, rezoneAnalysis]);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: BT.bgCard, borderColor: BT.border }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: BT.border, background: BT.bgCard }}>
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: BT.text }}>Path Comparison</h3>
        <p className="text-xs mt-0.5" style={{ color: BT.td }}>Side-by-side metrics for all development paths</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ background: BT.bgCard, borderColor: BT.border }}>
              <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: BT.td }}>Metric</th>
              {paths.map(p => (
                <th
                  key={p.id}
                  className="text-center py-2.5 px-4 text-xs font-semibold uppercase tracking-wider"
                  style={development_path === p.id
                    ? { color: BT.blueL, background: BT.blueBg }
                    : { color: BT.td }
                  }
                >
                  <div className="flex items-center justify-center gap-1">
                    {development_path === p.id && <CheckCircle2 className="w-3 h-3" />}
                    {p.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Max Units', key: 'units', format: (v: number) => v.toLocaleString() },
              { label: 'Entitlement Timeline', key: 'timeline' },
              { label: 'Entitlement Cost', key: 'entitlementCost' },
              { label: 'Est. Construction Cost', key: 'constructionCost' },
              { label: 'Est. IRR', key: 'estimatedIrr' },
              { label: 'Risk Level', key: 'riskLevel', isRisk: true },
              { label: 'Approval Probability', key: 'approvalProb' },
            ].map(row => (
              <tr key={row.label} className="border-b" style={{ borderColor: BT.border }}>
                <td className="py-2.5 px-4 text-xs font-medium" style={{ color: BT.tm }}>{row.label}</td>
                {paths.map(p => {
                  const val = (p as any)[row.key];
                  const isSelected = development_path === p.id;
                  return (
                    <td
                      key={p.id}
                      className="py-2.5 px-4 text-center text-xs"
                      style={isSelected
                        ? { background: `${BT.blueBg}80`, fontWeight: 600, color: BT.text }
                        : { color: BT.tm }
                      }
                    >
                      {row.isRisk ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={p.riskStyle}>
                          {val}
                        </span>
                      ) : row.format ? (
                        row.format(val)
                      ) : (
                        val
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {development_path && (
        <div className="px-5 py-3 border-t flex items-center gap-2"
          style={{ background: BT.blueBg, borderColor: `${BT.blue}40` }}>
          <TrendingUp className="w-4 h-4" style={{ color: BT.blue }} />
          <span className="text-xs" style={{ color: BT.blueL }}>
            <strong>{paths.find(p => p.id === development_path)?.label}</strong> selected —
            {' '}{paths.find(p => p.id === development_path)?.units.toLocaleString()} units,
            {' '}{paths.find(p => p.id === development_path)?.estimatedIrr} est. IRR
          </span>
        </div>
      )}
    </div>
  );
}
