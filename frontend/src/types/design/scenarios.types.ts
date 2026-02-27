export type ScenarioType = 'by-right' | 'variance' | 'rezone' | 'custom';

export interface DevelopmentScenario {
  id: string;
  dealId: string;
  type: ScenarioType;
  name: string;
  maxHeight: number;
  maxStories: number;
  far: number;
  maxUnits: number;
  maxGFA: number;
  setbacks: {
    front: number;
    rear: number;
    side: number;
  };
  bindingConstraint: string;
  riskLevel: 'low' | 'medium' | 'high';
  timelineMonths: number;
  description?: string;
  targetDistrictCode?: string;
}

export const SCENARIO_COLORS: Record<ScenarioType, string> = {
  'by-right': '#22c55e',
  'variance': '#f59e0b',
  'rezone': '#ef4444',
  'custom': '#8b5cf6',
};

export const SCENARIO_OPACITY: Record<ScenarioType, number> = {
  'by-right': 0.25,
  'variance': 0.15,
  'rezone': 0.10,
  'custom': 0.15,
};

export const SCENARIO_ACTIVE_OPACITY = 0.35;
