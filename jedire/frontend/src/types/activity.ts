export type ActivityType =
  | 'email_sent'
  | 'email_received'
  | 'task_created'
  | 'task_completed'
  | 'task_updated'
  | 'document_uploaded'
  | 'agent_alert'
  | 'note_added'
  | 'status_change'
  | 'financial_update'
  | 'team_member_added'
  | 'milestone_hit'
  | 'risk_flagged'
  | 'property_added'
  | 'analysis_run'
  | 'deal_created';

export interface DealActivity {
  id: number;
  dealId: number;
  userId?: number;
  activityType: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface KeyMoment {
  id: number;
  dealId: number;
  title: string;
  description: string;
  momentType: 'milestone' | 'decision' | 'risk' | 'achievement';
  date: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface TimelineEvent {
  date: string;
  title: string;
  type: 'past' | 'current' | 'future';
  completed?: boolean;
  activities: DealActivity[];
}
