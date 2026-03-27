import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { DealActivity, ActivityType } from '../../../types/activity';
import { format } from 'date-fns';

interface ActivityFeedItemProps {
  activity: DealActivity;
  onCreateTask?: (activity: DealActivity) => void;
  onViewDetails?: (activity: DealActivity) => void;
}

const activityIcons: Record<ActivityType, string> = {
  email_sent: '📧',
  email_received: '📧',
  task_created: '✅',
  task_completed: '✅',
  task_updated: '✅',
  document_uploaded: '📎',
  agent_alert: '🤖',
  note_added: '📝',
  status_change: '🔄',
  financial_update: '💰',
  team_member_added: '👤',
  milestone_hit: '🎯',
  risk_flagged: '⚠️',
  property_added: '🏢',
  analysis_run: '📊',
  deal_created: '🆕',
};

const activityColorMap: Record<ActivityType, string> = {
  email_sent: BT.text.cyan,
  email_received: BT.text.cyan,
  task_created: BT.text.green,
  task_completed: BT.text.green,
  task_updated: BT.text.amber,
  document_uploaded: BT.text.purple,
  agent_alert: BT.text.purple,
  note_added: BT.text.secondary,
  status_change: BT.text.orange,
  financial_update: BT.text.green,
  team_member_added: BT.text.purple,
  milestone_hit: BT.text.amber,
  risk_flagged: BT.text.red,
  property_added: BT.text.cyan,
  analysis_run: BT.text.cyan,
  deal_created: BT.text.purple,
};

const activityLabels: Record<ActivityType, string> = {
  email_sent: 'Email Sent',
  email_received: 'Email Received',
  task_created: 'Task Created',
  task_completed: 'Task Completed',
  task_updated: 'Task Updated',
  document_uploaded: 'Document Uploaded',
  agent_alert: 'Agent Alert',
  note_added: 'Note Added',
  status_change: 'Status Change',
  financial_update: 'Financial Update',
  team_member_added: 'Team Member Added',
  milestone_hit: 'Milestone Hit',
  risk_flagged: 'Risk Flagged',
  property_added: 'Property Added',
  analysis_run: 'Analysis Run',
  deal_created: 'Deal Created',
};

export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({
  activity,
  onCreateTask,
  onViewDetails,
}) => {
  const accentColor = activityColorMap[activity.activityType];
  return (
    <div
      className="p-4 mb-3 transition-all"
      style={{
        background: BT.bg.panel,
        border: `1px solid ${accentColor}33`,
        borderLeft: `2px solid ${accentColor}`,
        borderRadius: 0,
        fontFamily: BT.font.mono,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{activityIcons[activity.activityType]}</span>
          <div>
            <div style={{ fontWeight: 600, color: BT.text.primary, fontSize: 11 }}>
              {activityLabels[activity.activityType]}
            </div>
            <div style={{ fontSize: 9, color: BT.text.muted }}>
              {format(new Date(activity.createdAt), 'MMM d, yyyy h:mm a')}
              {activity.user && ` • ${activity.user.name}`}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3" style={{ color: BT.text.secondary, fontSize: 11 }}>{activity.description}</p>

      {/* Metadata */}
      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
        <div className="p-2 mb-3" style={{ background: BT.bg.panelAlt, fontSize: 10 }}>
          {Object.entries(activity.metadata).map(([key, value]) => (
            <div key={key} className="flex justify-between py-1">
              <span style={{ color: BT.text.secondary, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}:</span>
              <span style={{ color: BT.text.primary, fontWeight: 500 }}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(activity)}
            style={{ fontSize: 10, color: BT.text.cyan, fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: BT.font.mono }}
          >
            View Details →
          </button>
        )}
        {onCreateTask && ['email_received', 'agent_alert', 'risk_flagged'].includes(activity.activityType) && (
          <button
            onClick={() => onCreateTask(activity)}
            style={{ fontSize: 10, color: BT.text.green, fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: BT.font.mono }}
          >
            Create Task
          </button>
        )}
      </div>
    </div>
  );
};
