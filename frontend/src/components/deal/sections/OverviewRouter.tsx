import React, { useMemo } from 'react';
import { resolveProjectType, PROJECT_TYPE_META } from '@/shared/types/project-type';
import type { ProjectType } from '@/shared/types/project-type';
import OverviewSection from './OverviewSection';
import { DevelopmentOverview } from './DevelopmentOverview';
import { RedevelopmentOverview } from './RedevelopmentOverview';

export interface OverviewVariantProps {
  deal: any;
  dealId?: string;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
  onTabChange?: (tabId: string) => void;
  onStrategySelected?: (strategyId: string) => void;
}

const OVERVIEW_COMPONENTS: Record<ProjectType, React.ComponentType<any>> = {
  existing: OverviewSection,
  development: DevelopmentOverview,
  redevelopment: RedevelopmentOverview,
};

export const OverviewRouter: React.FC<any> = (props) => {
  const { deal } = props;
  const projectType = useMemo(() => resolveProjectType(deal), [
    deal?.project_type, deal?.projectType,
    deal?.development_type, deal?.developmentType,
  ]);
  const Component = OVERVIEW_COMPONENTS[projectType];
  const meta = PROJECT_TYPE_META[projectType];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-slate-100 text-slate-600 border border-slate-200">
          <span>{meta.icon}</span>
          {meta.label}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">{meta.sectionCount} sections</span>
      </div>
      <Component {...props} />
    </div>
  );
};

export default OverviewRouter;
