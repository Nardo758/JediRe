/**
 * Path Selection — "Select Your Path" component
 *
 * 4 development paths:
 *   A: By-Right — current zoning max, 0 months entitlement, lowest risk
 *   B: Overlay Bonus — bonus density from overlay, +2-4 months, low-moderate risk
 *   C: Variance — +10-25% above by-right, +3-6 months, moderate risk
 *   D: Full Rezone — target code max density, +8-18 months, high risk
 *
 * Path selection writes to zoningModuleStore.development_path and propagates
 * to Deal Capsule header + all downstream modules (M08, M09, 3D, M11, M14).
 */

import React, { useMemo } from 'react';
import {
  Zap,
  Layers,
  FileEdit,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import type { DevelopmentPath, BuildingEnvelope } from '../../../types/zoning.types';
import { T as BT } from '../../deal/bloomberg-tokens';

interface PathOption {
  id: DevelopmentPath;
  label: string;
  icon: React.ReactNode;
  units: string;
  timeline: string;
  entitlementCost: string;
  risk: string;
  riskStyle: React.CSSProperties;
  when: string;
  description: string;
}

interface PathSelectionProps {
  byRightUnits: number;
  overlayBonusPct: number | null;
  lotAcres: number;
  maxDensityPerAcre: number;
  avgUnitSizeSf: number;
  rezoneAnalysis?: any;
}

export default function PathSelection({
  byRightUnits,
  overlayBonusPct,
  lotAcres,
  maxDensityPerAcre,
  avgUnitSizeSf,
  rezoneAnalysis,
}: PathSelectionProps) {
  const { development_path, selectDevelopmentPath } = useZoningModuleStore();

  const paths: PathOption[] = useMemo(() => {
    const overlayUnits = overlayBonusPct
      ? Math.floor(byRightUnits * (1 + overlayBonusPct / 100))
      : null;

    const varianceUnits = Math.floor(byRightUnits * 1.15);

    const bestTarget = rezoneAnalysis?.bestTarget;
    const rezoneUnits = bestTarget
      ? bestTarget.targetEnvelope.maxCapacity
      : Math.floor(lotAcres * maxDensityPerAcre * 1.5);
    const rezoneUpliftPct = byRightUnits > 0
      ? Math.round(((rezoneUnits - byRightUnits) / byRightUnits) * 100)
      : 0;
    const rezoneLabel = bestTarget
      ? `${rezoneUnits} units (+${rezoneUpliftPct}%)`
      : `${rezoneUnits} units (est.)`;
    const rezoneDesc = bestTarget
      ? `Rezone to ${bestTarget.targetDistrictCode}${bestTarget.targetDistrictName ? ` (${bestTarget.targetDistrictName})` : ''}. Based on actual target district data.`
      : 'Petition to change zoning code entirely. Requires political support.';
    const rezoneCost = bestTarget?.estimatedCost || '$275-500K';
    const rezoneTimeline = bestTarget?.estimatedTimeline ? `+${bestTarget.estimatedTimeline}` : '+8-18 months';

    return [
      {
        id: 'by_right' as DevelopmentPath,
        label: 'A: By-Right',
        icon: <Zap className="w-5 h-5" />,
        units: `${byRightUnits} units`,
        timeline: '0 months entitlement',
        entitlementCost: '$0',
        risk: 'Low',
        riskStyle: { color: BT.green, background: BT.greenBg },
        when: 'Speed matters, risk-averse sponsor',
        description: 'Build to current zoning maximum. No entitlement process needed.',
      },
      ...(overlayUnits ? [{
        id: 'overlay_bonus' as DevelopmentPath,
        label: 'B: Overlay Bonus',
        icon: <Layers className="w-5 h-5" />,
        units: `${overlayUnits} units (+${overlayBonusPct}%)`,
        timeline: '+2-4 months',
        entitlementCost: '~$500K compliance',
        risk: 'Low-Moderate',
        riskStyle: { color: BT.blue, background: BT.blueBg },
        when: 'Overlay applies, best risk/reward',
        description: `Leverage overlay bonus for ${overlayBonusPct}% density uplift with compliance requirements.`,
      }] : []),
      {
        id: 'variance' as DevelopmentPath,
        label: 'C: Variance',
        icon: <FileEdit className="w-5 h-5" />,
        units: `${varianceUnits} units (+${Math.round((varianceUnits / byRightUnits - 1) * 100)}%)`,
        timeline: '+3-6 months',
        entitlementCost: '~$25K',
        risk: 'Moderate',
        riskStyle: { color: BT.amberL, background: BT.amberBg },
        when: 'Binding constraint can be relieved',
        description: 'Request variance from specific constraints. Requires hardship justification.',
      },
      {
        id: 'rezone' as DevelopmentPath,
        label: 'D: Full Rezone',
        icon: <Building2 className="w-5 h-5" />,
        units: rezoneLabel,
        timeline: rezoneTimeline,
        entitlementCost: rezoneCost,
        risk: 'High',
        riskStyle: { color: BT.redL, background: BT.redBg },
        when: 'Value creation >> cost + risk',
        description: rezoneDesc,
      },
    ];
  }, [byRightUnits, overlayBonusPct, lotAcres, maxDensityPerAcre, rezoneAnalysis]);

  const handleSelect = (pathId: DevelopmentPath) => {
    const pathOption = paths.find(p => p.id === pathId);
    const unitStr = pathOption?.units.match(/(\d+)/);
    const units = unitStr ? parseInt(unitStr[1]) : byRightUnits;

    const maxStories = units > 200 ? 7 : units > 100 ? 5 : 4;
    const constructionType = maxStories <= 4 ? 'wood_frame' as const : maxStories <= 7 ? 'podium_wood' as const : 'steel_concrete' as const;

    const envelope: BuildingEnvelope = {
      max_units: units,
      max_gfa_sf: units * avgUnitSizeSf,
      max_stories: maxStories,
      max_footprint_sf: Math.round(units * avgUnitSizeSf / maxStories / 0.82),
      buildable_polygon: null,
      required_parking_spaces: Math.round(units * 1.25),
      parking_structure_type: units > 150 ? 'podium' : 'surface',
      parking_levels: units > 150 ? Math.ceil(units * 1.25 * 350 / (units * avgUnitSizeSf / maxStories / 0.82)) : 0,
      residential_floors: maxStories - (units > 150 ? 1 : 0),
      ground_floor_retail_sf: units > 150 ? 5000 : 0,
      construction_type: constructionType,
    };

    selectDevelopmentPath(pathId, envelope);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold" style={{ color: BT.text }}>Select Your Development Path</h3>
        <p className="text-xs mt-1" style={{ color: BT.td }}>
          This selection propagates to Strategy (M08), ProForma (M09), 3D Design, Capital Structure (M11), and Risk (M14).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {paths.map(path => {
          const isSelected = development_path === path.id;
          return (
            <button
              key={path.id}
              onClick={() => handleSelect(path.id)}
              className="text-left rounded-lg p-4 transition-all"
              style={isSelected
                ? { border: `2px solid ${BT.blue}`, background: `${BT.blueBg}80`, outline: `1px solid ${BT.blue}40` }
                : { border: `2px solid ${BT.border}`, background: BT.bgCard }
              }
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg"
                  style={isSelected
                    ? { background: BT.blueBg, color: BT.blueL }
                    : { background: BT.bgPanel, color: BT.tm }
                  }>
                  {path.icon}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold" style={{ color: BT.text }}>{path.label}</div>
                  <div className="text-lg font-bold" style={{ color: BT.text }}>{path.units}</div>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5" style={{ color: BT.blue }} />}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="text-center">
                  <Clock className="w-3 h-3 mx-auto mb-0.5" style={{ color: BT.td }} />
                  <div className="text-[10px] font-medium" style={{ color: BT.text }}>{path.timeline}</div>
                </div>
                <div className="text-center">
                  <DollarSign className="w-3 h-3 mx-auto mb-0.5" style={{ color: BT.td }} />
                  <div className="text-[10px] font-medium" style={{ color: BT.text }}>{path.entitlementCost}</div>
                </div>
                <div className="text-center">
                  <AlertTriangle className="w-3 h-3 mx-auto mb-0.5" style={{ color: BT.td }} />
                  <div className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={path.riskStyle}>{path.risk}</div>
                </div>
              </div>

              <p className="text-[10px] mb-1" style={{ color: BT.td }}>{path.description}</p>
              <p className="text-[10px] italic" style={{ color: BT.td }}>{path.when}</p>
            </button>
          );
        })}
      </div>

      {development_path && (
        <div className="border rounded-lg p-3 flex items-center gap-3"
          style={{ background: BT.blueBg, borderColor: `${BT.blue}50` }}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: BT.blue }} />
          <div className="flex-1">
            <span className="text-xs font-bold" style={{ color: BT.blueL }}>
              Path {paths.find(p => p.id === development_path)?.label.charAt(0)}: {paths.find(p => p.id === development_path)?.label.slice(3)}
            </span>
            <span className="text-xs ml-2" style={{ color: BT.blue }}>
              {paths.find(p => p.id === development_path)?.units}
            </span>
          </div>
          <span className="text-[10px]" style={{ color: BT.blue }}>Propagated to downstream modules</span>
        </div>
      )}
    </div>
  );
}
