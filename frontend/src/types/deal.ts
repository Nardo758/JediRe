// Unified Deal type for entire application

export type DealState =
  | 'SIGNAL_INTAKE'
  | 'TRIAGE'
  | 'INTELLIGENCE_ASSEMBLY'
  | 'UNDERWRITING'
  | 'DEAL_PACKAGING'
  | 'EXECUTION'
  | 'POST_CLOSE'
  | 'MARKET_NOTE'
  | 'STALLED'
  | 'ARCHIVED';

export type TriageStatus = 'Hot' | 'Warm' | 'Watch' | 'Pass';

export interface Deal {
  // Core fields (JEDI RE)
  id: string;
  name: string;
  projectType: string;
  tier: string;
  status: string;
  budget: number;
  boundary: any;
  acres: number;
  propertyCount: number;
  pendingTasks: number;
  createdAt: string;
  
  // State Machine
  state?: DealState;
  triageStatus?: TriageStatus;
  triageScore?: number;
  signalConfidence?: number;
  triagedAt?: string;
  stateData?: any;
  daysInStation?: number;
  
  // User/ownership
  userId?: string;
  
  // Agent/Deal management
  stage?: string;
  priority?: string;
  propertyAddress?: string;
  dealType?: string;
  dealValue?: number;
  commissionEstimate?: number;
  commissionRate?: number;
  clientName?: string;
  clientId?: string;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  notes?: string;
  description?: string;
  address?: string;
  dealCategory?: string;
  developmentType?: string;
  targetUnits?: number;
  timelineStart?: string;
  timelineEnd?: string;
  projectIntent?: string;
  
  // Pipeline tracking
  taskCount?: number;
  pipelineStage?: string;
  daysInStage?: number;
  
  // Communication
  emailCount?: number;
  completedTasks?: number;
  
  // Timestamps
  updatedAt?: string;
  
  // Activity
  activities?: import('./index').DealActivity[];
  
  // Development
  isDevelopment?: boolean;
}
