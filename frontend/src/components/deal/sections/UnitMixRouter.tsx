/**
 * Unit Mix Router (M03 · Unit Program)
 *
 * Intelligent component that renders different unit mix UIs based on deal type:
 * - Existing: unit-mix-positioning-v5 (analyzer mode — competitive analysis)
 * - Development: development-program-builder (designer mode — build new program)
 * - Redevelopment: both stacked vertically (Current → Target workflow)
 * - Hidden: returns null
 *
 * Fetches real data from M02/M03 (Zoning) and M05/M06 (Market Demand) APIs
 *
 * Import locations:
 *   - UnitMixPositioningV5: src/components/modules/unit-mix/unit-mix-positioning-v5.jsx
 *   - DevelopmentProgramBuilder: src/components/modules/unit-mix/development-program-builder.jsx
 */

import React, { useMemo, lazy, Suspense } from 'react';
import { useDealType, useDealStore } from '../../../stores/dealStore';
import { getUnitMixMode } from '../../../shared/config/product-type-adaptation';
import useDevelopmentProgramData from '../../../hooks/useDevelopmentProgramData';

// Dynamic imports for these components
// Replace paths if components are located elsewhere in your codebase
const UnitMixPositioningV5 = lazy(() => import('../../modules/unit-mix/unit-mix-positioning-v5'));
const DevelopmentProgramBuilder = lazy(() => import('../../modules/unit-mix/development-program-builder'));

// Loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
    <p className="text-sm text-gray-500">Loading unit mix component...</p>
  </div>
);

interface UnitMixRouterProps {
  deal?: any;
  dealId?: string;
}

/**
 * Routes to the correct unit mix component based on deal type and mode.
 * Fetches real data from M02/M03 (Zoning) and M05/M06 (Market Demand) for development mode.
 */
export const UnitMixRouter: React.FC<UnitMixRouterProps> = ({ deal, dealId }) => {
  const dealType = useDealType();
  const mode = useMemo(() => getUnitMixMode(dealType), [dealType]);

  // Read development envelope from dealStore (written by Dev Capacity tab)
  const envelope = useDealStore(s => s.developmentEnvelope);
  const resolvedUnitMix = useDealStore(s => s.resolvedUnitMix);
  const existingUnits = deal?.existingProperty?.units || 0;
  const netNewUnits = envelope ? Math.max(0, envelope.max_units - existingUnits) : 0;

  // Fetch zoning and demand data for development mode
  const { zoning, demand, loading: dataLoading } = useDevelopmentProgramData(
    dealId || deal?.id,
    deal?.tradeAreaId
  );

  // Hidden mode — module not rendered
  if (mode === 'hidden') {
    return null;
  }

  // Existing deal — show analyzer only
  if (mode === 'analyzer') {
    return (
      <div className="space-y-4">
        <Suspense fallback={<LoadingFallback />}>
          <UnitMixPositioningV5 deal={deal} dealId={dealId} />
        </Suspense>
      </div>
    );
  }

  // Development deal — show designer only
  if (mode === 'designer') {
    // Calculate utilization metrics
    const totalUnitMixUnits = resolvedUnitMix.reduce((sum, row) => sum + row.count, 0);
    const totalUnitMixSF = resolvedUnitMix.reduce((sum, row) => sum + (row.count * row.avgSF), 0);
    const maxUnits = envelope?.max_units || 0;
    const maxGFA = envelope?.max_gfa || 0;
    const unitUtilization = maxUnits > 0 ? (totalUnitMixUnits / maxUnits) * 100 : 0;
    const sfUtilization = maxGFA > 0 ? (totalUnitMixSF / maxGFA) * 100 : 0;

    return (
      <div className="space-y-4">
        {/* Zoning Constraints Bar */}
        {envelope && (
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Zoning Envelope Utilization</span>
              <span className="text-xs text-gray-500">
                {totalUnitMixUnits} of {maxUnits} units · {Math.round(totalUnitMixSF).toLocaleString()} of {Math.round(maxGFA).toLocaleString()} SF
              </span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-600">Units</span>
                  <span className="text-[10px] font-medium text-gray-700">{unitUtilization.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(unitUtilization, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-600">Gross Floor Area</span>
                  <span className="text-[10px] font-medium text-gray-700">{sfUtilization.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all"
                    style={{ width: `${Math.min(sfUtilization, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {dataLoading && <LoadingFallback />}
        {!dataLoading && (
          <Suspense fallback={<LoadingFallback />}>
            <DevelopmentProgramBuilder
              deal={deal}
              dealId={dealId || deal?.id}
              zoning={zoning}
              demand={demand}
              zoningEnvelope={envelope}
            />
          </Suspense>
        )}
      </div>
    );
  }

  // Redevelopment deal — show both with divider
  if (mode === 'analyzer_designer') {
    // Calculate utilization metrics for redevelopment target
    const totalUnitMixUnits = resolvedUnitMix.reduce((sum, row) => sum + row.count, 0);
    const totalUnitMixSF = resolvedUnitMix.reduce((sum, row) => sum + (row.count * row.avgSF), 0);
    const maxUnits = envelope?.max_units || 0;
    const maxGFA = envelope?.max_gfa || 0;
    const unitUtilization = maxUnits > 0 ? (totalUnitMixUnits / maxUnits) * 100 : 0;
    const sfUtilization = maxGFA > 0 ? (totalUnitMixSF / maxGFA) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* CURRENT STATE */}
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Current Unit Mix</h3>
            <p className="text-xs text-gray-500 mt-1">
              {existingUnits} existing units · Competitive positioning vs. submarket comps
            </p>
          </div>
          <Suspense fallback={<LoadingFallback />}>
            <UnitMixPositioningV5 deal={deal} dealId={dealId} readonly />
          </Suspense>
        </div>

        {/* DIVIDER */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
          <span className="text-xs font-medium text-gray-500 px-3 py-1 bg-gray-50 rounded">
            {existingUnits} existing → {maxUnits} total ({netNewUnits} net new)
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-gray-200 to-transparent" />
        </div>

        {/* TARGET STATE */}
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Target Unit Program</h3>
            <p className="text-xs text-gray-500 mt-1">
              Post-renovation mix informed by market demand and zoning envelope
            </p>
          </div>

          {/* Zoning Constraints Bar */}
          {envelope && (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Zoning Envelope (Post-Renovation)</span>
                <span className="text-xs text-gray-500">
                  {totalUnitMixUnits} of {maxUnits} units · {Math.round(totalUnitMixSF).toLocaleString()} of {Math.round(maxGFA).toLocaleString()} SF
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-600">Units ({netNewUnits} net new, {existingUnits} existing)</span>
                    <span className="text-[10px] font-medium text-gray-700">{unitUtilization.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.min(unitUtilization, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-600">Gross Floor Area</span>
                    <span className="text-[10px] font-medium text-gray-700">{sfUtilization.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all"
                      style={{ width: `${Math.min(sfUtilization, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {dataLoading && <LoadingFallback />}
          {!dataLoading && (
            <Suspense fallback={<LoadingFallback />}>
              <DevelopmentProgramBuilder
                deal={deal}
                dealId={dealId || deal?.id}
                zoning={zoning}
                demand={demand}
                zoningEnvelope={envelope}
                netNewUnits={netNewUnits}
              />
            </Suspense>
          )}
        </div>
      </div>
    );
  }

  // Fallback (shouldn't happen)
  return null;
};

export default UnitMixRouter;
