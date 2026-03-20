/**
 * PathComparisonTable — Side-by-side comparison of all 4 development paths
 *
 * Shows units, timeline, entitlement cost, construction cost, estimated IRR,
 * risk level, and approval probability for each path. Highlights the selected path.
 */

import React, { useMemo } from 'react';
import { CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import type { DevelopmentPath, BuildingEnvelope } from '../../../types/zoning.types';

interface PathRow {
  id: DevelopmentPath;
  label: string;
  units: number;
  timeline: string;
  entitlementCost: string;
  constructionCost: string;
  estimatedIrr: string;
  riskLevel: string;
  riskColor: string;
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
      // Simplified: more units = better base, more time = higher carry cost,
      // more risk = bigger discount
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
        riskColor: 'text-green-700 bg-green-50',
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
        riskColor: 'text-blue-700 bg-blue-50',
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
        riskColor: 'text-amber-700 bg-amber-50',
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
        riskColor: 'text-red-700 bg-red-50',
        approvalProb: '30-50%',
      },
    );

    return result;
  }, [byRightUnits, overlayBonusPct, lotAcres, maxDensityPerAcre, avgUnitSizeSf, costPerSf, rezoneAnalysis]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Path Comparison</h3>
        <p className="text-xs text-gray-500 mt-0.5">Side-by-side metrics for all development paths</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Metric</th>
              {paths.map(p => (
                <th
                  key={p.id}
                  className={`text-center py-2.5 px-4 text-xs font-semibold uppercase tracking-wider ${
                    development_path === p.id ? 'text-blue-700 bg-blue-50' : 'text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    {development_path === p.id && <CheckCircle2 className="w-3 h-3" />}
                    {p.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { label: 'Max Units', key: 'units', format: (v: number) => v.toLocaleString() },
              { label: 'Entitlement Timeline', key: 'timeline' },
              { label: 'Entitlement Cost', key: 'entitlementCost' },
              { label: 'Est. Construction Cost', key: 'constructionCost' },
              { label: 'Est. IRR', key: 'estimatedIrr' },
              { label: 'Risk Level', key: 'riskLevel', isRisk: true },
              { label: 'Approval Probability', key: 'approvalProb' },
            ].map(row => (
              <tr key={row.label} className="hover:bg-gray-50/50">
                <td className="py-2.5 px-4 text-xs font-medium text-gray-700">{row.label}</td>
                {paths.map(p => {
                  const val = (p as any)[row.key];
                  const isSelected = development_path === p.id;
                  return (
                    <td
                      key={p.id}
                      className={`py-2.5 px-4 text-center text-xs ${
                        isSelected ? 'bg-blue-50/50 font-semibold text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {row.isRisk ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${p.riskColor}`}>
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
        <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-blue-800">
            <strong>{paths.find(p => p.id === development_path)?.label}</strong> selected —
            {' '}{paths.find(p => p.id === development_path)?.units.toLocaleString()} units,
            {' '}{paths.find(p => p.id === development_path)?.estimatedIrr} est. IRR
          </span>
        </div>
      )}
    </div>
  );
}
