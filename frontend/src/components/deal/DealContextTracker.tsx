import React, { useState, useEffect } from 'react';
import { DealActivity, KeyMoment as KeyMomentType, TimelineEvent } from '../../types/activity';
import { ActivityFeedItem } from './context/ActivityFeedItem';
import { TimelineView } from './context/TimelineView';
import { KeyMoment } from './context/KeyMoment';
import { api } from '../../services/api';
import { BT } from '@/components/deal/bloomberg-ui';

interface DealContextTrackerProps {
  dealId: string;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
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
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: BT.fontSize.xl, fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>Deal Context</h2>
          <button
            onClick={loadData}
            className="px-4 py-2 transition-colors"
            style={{ fontSize: BT.fontSize.base, background: BT.bg.hover, color: BT.text.secondary, fontFamily: BT.font.mono, borderRadius: 0, border: `1px solid ${BT.border.subtle}`, cursor: 'pointer' }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('activity')}
            className="px-4 py-2 transition-all"
            style={{
              fontWeight: 500,
              fontFamily: BT.font.mono,
              fontSize: BT.fontSize.base,
              borderRadius: 0,
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'activity' ? BT.text.cyan : BT.bg.hover,
              color: viewMode === 'activity' ? BT.bg.terminal : BT.text.secondary,
            }}
          >
            📋 Activity Feed
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className="px-4 py-2 transition-all"
            style={{
              fontWeight: 500,
              fontFamily: BT.font.mono,
              fontSize: BT.fontSize.base,
              borderRadius: 0,
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'timeline' ? BT.text.cyan : BT.bg.hover,
              color: viewMode === 'timeline' ? BT.bg.terminal : BT.text.secondary,
            }}
          >
            📅 Timeline
          </button>
          <button
            onClick={() => setViewMode('moments')}
            className="px-4 py-2 transition-all"
            style={{
              fontWeight: 500,
              fontFamily: BT.font.mono,
              fontSize: BT.fontSize.base,
              borderRadius: 0,
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'moments' ? BT.text.cyan : BT.bg.hover,
              color: viewMode === 'moments' ? BT.bg.terminal : BT.text.secondary,
            }}
          >
            ⭐ Key Moments
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>
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
                    className="px-3 py-2"
                    style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, borderRadius: 0 }}
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
                  <div className="text-center py-12" style={{ color: BT.text.muted, fontFamily: BT.font.label }}>
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
                  <div className="text-center py-12" style={{ color: BT.text.muted, fontFamily: BT.font.label }}>
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
