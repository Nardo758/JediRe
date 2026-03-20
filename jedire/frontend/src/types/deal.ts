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

export type DealCategory = 'pipeline' | 'portfolio';

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
  
  // Category (pipeline vs portfolio)
  dealCategory?: DealCategory;
  
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
  
  // Deal Data (from creation flow)
  purchasePrice?: number;
  callForOfferDate?: string;
  units?: number;
  occupancy?: number;
  rentPerSf?: number;
  capRate?: number;
  renovationBudget?: number;
  uploadedDocuments?: string[];
  
  // Property Type & Strategy
  propertyTypeId?: number;
  propertyTypeKey?: string;
  strategyName?: string;
  strategy_name?: string;
  strategyDefaults?: {
    holdPeriod: string;
    exitStrategy: string;
    keyMetrics: string[];
    assumptions: {
      capRate?: number;
      rentGrowth?: number;
      expenseGrowth?: number;
      occupancy?: number;
      renovationBudget?: number;
      timeToStabilize?: number;
    };
  };
  strategy_defaults?: {
    holdPeriod: string;
    exitStrategy: string;
    keyMetrics: string[];
    assumptions: {
      capRate?: number;
      rentGrowth?: number;
      expenseGrowth?: number;
      occupancy?: number;
      renovationBudget?: number;
      timeToStabilize?: number;
    };
  };
}
