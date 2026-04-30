/**
 * DesignTargetsPanel — Program targets sidebar for F7 3D Design tab.
 *
 * Shows approved design targets from F3 Market (Programming + Amenity Gaps tabs)
 * against current real-time metrics from the 3D editor.
 *
 * Layout:
 * ┌────────────────────────────────┐
 * │ ??? Design Targets             │
 * ├────────────────────────────────┤
 * │ Units      30/36 ████████░░ 83%│
 * │ GFA     180K/183K ███████░░ 98%│
 * │ FAR      2.8/3.0  ████████░ 93%│
 * │ Floors     8/10    ████░░░░ 80%│
 * │ Parking 1.2/1.5   ████░░░░ 80%│
 * ├────────────────────────────────┤
 * │ ??? Approved Amenities        │
 * │ [?] Pool              ✓       │
 * │ [?] Fitness Center    ✓       │
 * │ [?] Co-Working        ✓       │
 * │ [?] Rooftop Lounge    ✗       │
 * ├────────────────────────────────┤
 * │ ??? Budget Remaining          │
 * │ $42.5M / $68.0M  █████░░ 62%  │
 * └────────────────────────────────┘
 */

import React from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DesignTargets {
  /** Target metrics from F3 Programming tab */
  program: {
    /** Target total units */
    targetUnits: number;
    /** Target gross floor area (sqft) */
    targetGFA: number;
    /** Target floor area ratio */
    targetFAR: number;
    /** Target max floors */
    targetFloors: number;
    /** Target parking ratio (spaces/unit) */
    targetParkingRatio: number;
    /** Target building height (ft) */
    targetHeight: number;
  };
  /** Approved amenities from F3 Amenity Gaps tab */
  approvedAmenities: string[];
  /** Budget for construction (optional) */
  budget?: {
    /** Total budget for construction */
    total: number;
    /** Cost per sqft estimate */
    costPerSqft: number;
  };
  /** Target unit mix breakdown */
  unitMix?: {
    studio: number;
    oneBed: number;
    twoBed: number;
    threeBed: number;
  };
}

export interface CurrentMetrics {
  currentUnits: number;
  currentGFA: number;
  currentFAR: number;
  currentFloors: number;
  currentParkingSpaces: number;
  currentHeight: number;
  /** Estimated cost based on current GFA */
  estimatedCost: number;
}

interface DesignTargetsPanelProps {
  targets: DesignTargets;
  metrics: CurrentMetrics;
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bars = Math.round(pct / 10);
  const empty = 10 - bars;
  const isOver = pct > 100;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-right text-gray-400">{label}</span>
      <span className="w-24 text-right font-mono tabular-nums">
        {value.toLocaleString()} / {max.toLocaleString()}
      </span>
      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOver ? 'bg-red-500' : pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={`w-10 text-right font-mono tabular-nums ${isOver ? 'text-red-400' : ''}`}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Amenity Badge ──────────────────────────────────────────────────────────

function AmenityBadge({ name, approved }: { name: string; approved: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
      approved ? 'bg-emerald-900/50 text-emerald-300' : 'bg-gray-700 text-gray-400 line-through'
    }`}>
      <span>{approved ? '✓' : '✗'}</span>
      <span>{name}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const DesignTargetsPanel: React.FC<DesignTargetsPanelProps> = ({ targets, metrics }) => {
  const costUsed = targets.budget ? Math.round((metrics.estimatedCost / targets.budget.total) * 100) : 0;
  const pctFloors = targets.program.targetFloors > 0
    ? Math.round((metrics.currentFloors / targets.program.targetFloors) * 100)
    : 0;

  return (
    <div className="w-72 bg-gray-900 border-r border-gray-700 p-3 flex flex-col gap-4 overflow-y-auto text-sm">
      {/* Header */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">??? Design Targets</h3>
      </div>

      {/* Program Targets */}
      <div className="space-y-2">
        <ProgressBar value={metrics.currentUnits} max={targets.program.targetUnits} label="Units" />
        <ProgressBar
          value={Math.round(metrics.currentGFA / 1000)}
          max={Math.round(targets.program.targetGFA / 1000)}
          label="GFA (K)"
        />
        <ProgressBar value={metrics.currentFAR * 10} max={targets.program.targetFAR * 10} label="FAR" />
        <ProgressBar value={metrics.currentFloors} max={targets.program.targetFloors} label="Floors" />
        <ProgressBar value={metrics.currentHeight} max={targets.program.targetHeight} label="Height" />
        {targets.program.targetParkingRatio > 0 && (
          <ProgressBar
            value={metrics.currentParkingSpaces / Math.max(1, metrics.currentUnits)}
            max={targets.program.targetParkingRatio}
            label="Park"
          />
        )}
      </div>

      {/* Unit Mix Breakdown */}
      {targets.unitMix && (
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Unit Mix</h4>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span className="text-gray-400">Studio:</span>
            <span className="text-right font-mono">{targets.unitMix.studio}%</span>
            <span className="text-gray-400">1BR:</span>
            <span className="text-right font-mono">{targets.unitMix.oneBed}%</span>
            <span className="text-gray-400">2BR:</span>
            <span className="text-right font-mono">{targets.unitMix.twoBed}%</span>
            <span className="text-gray-400">3BR:</span>
            <span className="text-right font-mono">{targets.unitMix.threeBed}%</span>
          </div>
        </div>
      )}

      {/* Approved Amenities */}
      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">??? Approved Amenities</h4>
        <div className="flex flex-wrap gap-1">
          {targets.approvedAmenities.map((name) => (
            <AmenityBadge key={name} name={name} approved={true} />
          ))}
          {/* Pre-populated with common multifamily amenities for initial display */}
          {targets.approvedAmenities.length === 0 && (
            <span className="text-xs text-gray-500 italic">None selected in F3</span>
          )}
        </div>
      </div>

      {/* Budget */}
      {targets.budget && (
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">??? Budget Remaining</h4>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Used:</span>
              <span className="font-mono">${(metrics.estimatedCost / 1e6).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total:</span>
              <span className="font-mono">${(targets.budget.total / 1e6).toFixed(1)}M</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all ${
                  costUsed > 100 ? 'bg-red-500' : costUsed > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, costUsed)}%` }}
              />
            </div>
            <div className="text-xs text-right text-gray-500">
              {costUsed > 100 ? `+${costUsed - 100}% over budget` : `${costUsed}% used`}
            </div>
          </div>
        </div>
      )}

      {/* Design Feedback */}
      <div className="mt-auto pt-2 border-t border-gray-700">
        <div className="flex items-center gap-1.5 text-xs">
          {(() => {
            const issues: string[] = [];
            if (metrics.currentUnits < targets.program.targetUnits * 0.8) issues.push('under units');
            if (metrics.currentFloors > targets.program.targetFloors) issues.push('exceeds height');
            if (metrics.currentFAR > targets.program.targetFAR * 1.1) issues.push('exceeds FAR');
            if (issues.length === 0) return <span className="text-emerald-400">✓ Within targets</span>;
            return <span className="text-amber-400">⚠ {issues.join(', ')}</span>;
          })()}
        </div>
      </div>
    </div>
  );
};

export default DesignTargetsPanel;
