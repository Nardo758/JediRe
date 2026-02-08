import React, { useState, useEffect } from 'react';
import { DealActivity, KeyMoment as KeyMomentType, TimelineEvent } from '../../types/activity';
import { ActivityFeedItem } from './context/ActivityFeedItem';
import { TimelineView } from './context/TimelineView';
import { KeyMoment } from './context/KeyMoment';
import { api } from '../../services/api';

interface DealContextTrackerProps {
  dealId: number;
  onCreateTask?: (activityContext?: any) => void;
}

type ViewMode = 'activity' | 'timeline' | 'moments';

export const DealContextTracker: React.FC<DealContextTrackerProps> = ({
  dealId,
  onCreateTask,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('activity');
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [keyMoments, setKeyMoments] = useState<KeyMomentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [dealId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load activities
      const activitiesResponse = await api.get(`/deals/${dealId}/activity`);
      setActivities(activitiesResponse.data.data || []);

      // Load timeline (if endpoint exists)
      try {
        const timelineResponse = await api.get(`/deals/${dealId}/timeline`);
        setTimelineEvents(timelineResponse.data.data || []);
      } catch (err) {
        // Endpoint might not exist yet
        setTimelineEvents([]);
      }

      // Load key moments (if endpoint exists)
      try {
        const momentsResponse = await api.get(`/deals/${dealId}/key-moments`);
        setKeyMoments(momentsResponse.data.data || []);
      } catch (err) {
        // Endpoint might not exist yet
        setKeyMoments([]);
      }
    } catch (error) {
      console.error('Error loading context data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTaskFromActivity = (activity: DealActivity) => {
    if (onCreateTask) {
      onCreateTask({
        title: `Follow up on: ${activity.description}`,
        description: `Created from activity on ${new Date(activity.createdAt).toLocaleDateString()}`,
        dealId,
        source: 'activity',
        emailId: activity.metadata?.emailId,
      });
    }
  };

  const filteredActivities = activities.filter((activity) => {
    if (filter === 'all') return true;
    return activity.activityType === filter;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Deal Context</h2>
          <button
            onClick={loadData}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('activity')}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all
              ${viewMode === 'activity' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            `}
          >
            📋 Activity Feed
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all
              ${viewMode === 'timeline' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            `}
          >
            📅 Timeline
          </button>
          <button
            onClick={() => setViewMode('moments')}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all
              ${viewMode === 'moments' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            `}
          >
            ⭐ Key Moments
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            Loading context...
          </div>
        ) : (
          <>
            {/* Activity Feed View */}
            {viewMode === 'activity' && (
              <div>
                {/* Filters */}
                <div className="mb-4">
                  <select
                    id="dealActivityFilter"
                    name="dealActivityFilter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label="Filter activity type"
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="all">All Activity</option>
                    <option value="email_received">📧 Emails</option>
                    <option value="task_completed">✅ Tasks</option>
                    <option value="document_uploaded">📎 Documents</option>
                    <option value="agent_alert">🤖 Agent Alerts</option>
                    <option value="risk_flagged">⚠️ Risks</option>
                    <option value="milestone_hit">🎯 Milestones</option>
                  </select>
                </div>

                {/* Activity List */}
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No activity yet. Create tasks or upload documents to get started.
                  </div>
                ) : (
                  filteredActivities.map((activity) => (
                    <ActivityFeedItem
                      key={activity.id}
                      activity={activity}
                      onCreateTask={handleCreateTaskFromActivity}
                    />
                  ))
                )}
              </div>
            )}

            {/* Timeline View */}
            {viewMode === 'timeline' && (
              <TimelineView events={timelineEvents} />
            )}

            {/* Key Moments View */}
            {viewMode === 'moments' && (
              <div>
                {keyMoments.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No key moments yet. Key decisions and milestones will appear here.
                  </div>
                ) : (
                  keyMoments.map((moment) => (
                    <KeyMoment key={moment.id} moment={moment} />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
