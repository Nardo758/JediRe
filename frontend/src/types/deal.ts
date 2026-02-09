// Unified Deal type for entire application

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
