/**
 * Unit Mix Router (M03 · Unit Program)
 *
 * Intelligent component that renders different unit mix UIs based on deal type:
 * - Existing: unit-mix-positioning-v5 (analyzer mode — competitive analysis)
 * - Development: development-program-builder (designer mode — build new program)
 * - Redevelopment: both stacked vertically (Current → Target workflow)
 * - Hidden: returns null
 *
 * Import locations:
 *   - UnitMixPositioningV5: src/components/modules/unit-mix/unit-mix-positioning-v5.jsx
 *   - DevelopmentProgramBuilder: src/components/modules/unit-mix/development-program-builder.jsx
 */

import React, { useMemo, lazy, Suspense } from 'react';
import { useDealType } from '../../../stores/dealStore';
import { getUnitMixMode } from '../../../shared/config/product-type-adaptation';

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
 */
export const UnitMixRouter: React.FC<UnitMixRouterProps> = ({ deal, dealId }) => {
  const dealType = useDealType();
  const mode = useMemo(() => getUnitMixMode(dealType), [dealType]);

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
    return (
      <div className="space-y-4">
        <Suspense fallback={<LoadingFallback />}>
          <DevelopmentProgramBuilder deal={deal} dealId={dealId} />
        </Suspense>
      </div>
    );
  }

  // Redevelopment deal — show both with divider
  if (mode === 'analyzer_designer') {
    return (
      <div className="space-y-6">
        {/* CURRENT STATE */}
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Current Unit Mix</h3>
            <p className="text-xs text-gray-500 mt-1">Existing property composition and competitive positioning</p>
          </div>
          <Suspense fallback={<LoadingFallback />}>
            <UnitMixPositioningV5 deal={deal} dealId={dealId} readonly />
          </Suspense>
        </div>

        {/* DIVIDER */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
          <span className="text-xs font-medium text-gray-500 px-3 py-1 bg-gray-50 rounded">
            Current → Target
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-gray-200 to-transparent" />
        </div>

        {/* TARGET STATE */}
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Target Unit Program</h3>
            <p className="text-xs text-gray-500 mt-1">Post-repositioning mix informed by market demand and site constraints</p>
          </div>
          <Suspense fallback={<LoadingFallback />}>
            <DevelopmentProgramBuilder deal={deal} dealId={dealId} />
          </Suspense>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't happen)
  return null;
};

export default UnitMixRouter;
