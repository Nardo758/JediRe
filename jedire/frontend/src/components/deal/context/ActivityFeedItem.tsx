import React from 'react';
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

const activityColors: Record<ActivityType, string> = {
  email_sent: 'bg-blue-50 border-blue-200',
  email_received: 'bg-blue-50 border-blue-200',
  task_created: 'bg-green-50 border-green-200',
  task_completed: 'bg-green-50 border-green-200',
  task_updated: 'bg-yellow-50 border-yellow-200',
  document_uploaded: 'bg-purple-50 border-purple-200',
  agent_alert: 'bg-indigo-50 border-indigo-200',
  note_added: 'bg-gray-50 border-gray-200',
  status_change: 'bg-orange-50 border-orange-200',
  financial_update: 'bg-emerald-50 border-emerald-200',
  team_member_added: 'bg-pink-50 border-pink-200',
  milestone_hit: 'bg-amber-50 border-amber-200',
  risk_flagged: 'bg-red-50 border-red-200',
  property_added: 'bg-teal-50 border-teal-200',
  analysis_run: 'bg-cyan-50 border-cyan-200',
  deal_created: 'bg-violet-50 border-violet-200',
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
  return (
    <div
      className={`
        border-2 rounded-lg p-4 mb-3 transition-all hover:shadow-md
        ${activityColors[activity.activityType]}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{activityIcons[activity.activityType]}</span>
          <div>
            <div className="font-semibold text-gray-900">
              {activityLabels[activity.activityType]}
            </div>
            <div className="text-xs text-gray-500">
              {format(new Date(activity.createdAt), 'MMM d, yyyy h:mm a')}
              {activity.user && ` • ${activity.user.name}`}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-700 mb-3">{activity.description}</p>

      {/* Metadata */}
      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
        <div className="bg-white bg-opacity-50 rounded p-2 mb-3 text-sm">
          {Object.entries(activity.metadata).map(([key, value]) => (
            <div key={key} className="flex justify-between py-1">
              <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
              <span className="text-gray-900 font-medium">
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
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View Details →
          </button>
        )}
        {onCreateTask && ['email_received', 'agent_alert', 'risk_flagged'].includes(activity.activityType) && (
          <button
            onClick={() => onCreateTask(activity)}
            className="text-sm text-green-600 hover:text-green-800 font-medium"
          >
            Create Task
          </button>
        )}
      </div>
    </div>
  );
};
