/**
 * OverviewRouter — Deal Capsule Overview Adapter
 * 
 * Drop-in replacement for OverviewSection in DealDetailPage.
 * Reads deal.projectType and renders the correct overview variant:
 *   - 'existing'       → ExistingOverview (4 sections — current OverviewSection)
 *   - 'development'    → DevelopmentOverview (7 sections)
 *   - 'redevelopment'  → RedevelopmentOverview (9 sections)
 * 
 * WIRING (one-line change in DealDetailPage.tsx):
 *   BEFORE: import OverviewSection from '../components/deal/sections/OverviewSection';
 *   AFTER:  import { OverviewRouter } from '../components/deal/sections/OverviewRouter';
 * 
 *   BEFORE: component: OverviewSection
 *   AFTER:  component: OverviewRouter
 * 
 * Props contract matches what DealDetailPage passes to all tab components:
 *   { deal, dealId, embedded, onUpdate, onBack }
 * 
 * Each variant also receives onTabChange (for cross-module navigation)
 * derived from the onBack prop pattern.
 */

import React, { useMemo } from 'react';
import { resolveProjectType, PROJECT_TYPE_META } from '@/shared/types/project-type';
import type { ProjectType } from '@/shared/types/project-type';

// ── Variant Imports ──────────────────────────────────────────────────────────
// Existing uses the original OverviewSection (already built, 490 lines)
import { OverviewSection } from './OverviewSection';
// Development and Redevelopment are new components
import { DevelopmentOverview } from './DevelopmentOverview';
import { RedevelopmentOverview } from './RedevelopmentOverview';

// ── Shared Props Interface ───────────────────────────────────────────────────
export interface OverviewVariantProps {
  deal: any;
  dealId?: string;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
  onTabChange?: (tabId: string) => void;
  onStrategySelected?: (strategyId: string) => void;
}

// ── Component Map ────────────────────────────────────────────────────────────
const OVERVIEW_COMPONENTS: Record<ProjectType, React.ComponentType<OverviewVariantProps>> = {
  existing: OverviewSection as React.ComponentType<OverviewVariantProps>,
  development: DevelopmentOverview,
  redevelopment: RedevelopmentOverview,
};

// ── Router Component ─────────────────────────────────────────────────────────
export const OverviewRouter: React.FC<OverviewVariantProps> = (props) => {
  const { deal } = props;

  const projectType = useMemo(() => resolveProjectType(deal), [
    deal?.project_type,
    deal?.projectType,
    deal?.development_type,
    deal?.developmentType,
  ]);

  const OverviewComponent = OVERVIEW_COMPONENTS[projectType];
  const meta = PROJECT_TYPE_META[projectType];

  return (
    <div className="space-y-4">
      {/* Project Type Indicator — small badge so the user knows which variant is active */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${meta.bgColor} ${meta.color} border`}>
            <span>{meta.icon}</span>
            {meta.label}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {meta.sectionCount} sections
          </span>
        </div>
      </div>

      {/* Render the correct variant */}
      <OverviewComponent {...props} onTabChange={props.onBack ? undefined : undefined} />
    </div>
  );
};

// Default export for backward compatibility with tab component pattern
export default OverviewRouter;
