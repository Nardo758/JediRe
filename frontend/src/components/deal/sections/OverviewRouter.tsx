import React, { useMemo } from 'react';
import { resolveProjectType } from '@/shared/types/project-type';
import BloombergOverviewSection from './BloombergOverviewSection';
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
  geographicContext?: any;
}

const OVERVIEW_COMPONENTS: Record<string, React.ComponentType<any>> = {
  existing: BloombergOverviewSection,
  development: DevelopmentOverview,
  redevelopment: RedevelopmentOverview,
};

export const OverviewRouter: React.FC<OverviewVariantProps> = (props) => {
  const { deal } = props;
  const projectType = useMemo(() => resolveProjectType(deal), [
    deal?.project_type, deal?.projectType,
    deal?.development_type, deal?.developmentType,
  ]);
  const Component = OVERVIEW_COMPONENTS[projectType] ?? BloombergOverviewSection;
  return <Component {...props} />;
};

export default OverviewRouter;
