import React, { useState } from 'react';
import { Activity, Search, Filter, ChevronDown, MapPin, FileText, Users, TrendingUp, Edit, CheckCircle, AlertCircle } from 'lucide-react';
import { Deal } from '@/types';

interface ActivityItem {
  id: string;
  dealId: string;
  type: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface ActivityFeedSectionProps {
  deal: Deal;
}

// Activity type icons and colors
const ACTIVITY_CONFIG: Record<string, { 
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
}> = {
  deal_created: {
    icon: TrendingUp,
    color: 'text-blue-600',
    bgColor: 'bg-[#0d1e3d]'
  },
  boundary_defined: {
    icon: MapPin,
    color: 'text-purple-600',
    bgColor: 'bg-[#1a0d3d]'
  },
  property_added: {
    icon: MapPin,
    color: 'text-green-600',
    bgColor: 'bg-[#022c22]'
  },
  property_removed: {
    icon: MapPin,
    color: 'text-red-400',
    bgColor: 'bg-[#1c0a0a]'
  },
  analysis_run: {
    icon: TrendingUp,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-100'
  },
  document_uploaded: {
    icon: FileText,
    color: 'text-orange-600',
    bgColor: 'bg-[#1a0d00]'
  },
  team_member_invited: {
    icon: Users,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100'
  },
  stage_changed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-[#022c22]'
  },
  note_added: {
    icon: Edit,
    color: 'text-[#9EA8B4]',
    bgColor: 'bg-[#131920]'
  },
  default: {
    icon: Activity,
    color: 'text-[#9EA8B4]',
    bgColor: 'bg-[#131920]'
  }
};

const ACTIVITY_TYPES = [
  { value: 'all', label: 'All Activity' },
  { value: 'deal_created', label: 'Deal Created' },
  { value: 'boundary_defined', label: 'Boundary' },
  { value: 'property_added', label: 'Properties' },
  { value: 'analysis_run', label: 'Analysis' },
  { value: 'document_uploaded', label: 'Documents' },
  { value: 'team_member_invited', label: 'Team' },
  { value: 'stage_changed', label: 'Stage Changes' },
  { value: 'note_added', label: 'Notes' }
];

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Time part
  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);

  // Date part
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    const dateStr = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
    return `${dateStr}, ${timeStr}`;
  } else {
    const dateStr = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }).format(date);
    return `${dateStr}, ${timeStr}`;
  }
}

export function ActivityFeedSection({ deal }: ActivityFeedSectionProps) {
  // API state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch activity data from API
  React.useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/deals/${deal.id}/team/activity`);

        if (!response.ok) {
          throw new Error('Failed to fetch activity data');
        }

        const data = await response.json();

        // Transform API response to match component interface
        const transformedActivities: ActivityItem[] = (data || []).map((activity: any) => ({
          id: activity.id,
          dealId: activity.deal_id,
          type: activity.action || 'default',
          description: activity.details?.description || activity.action || 'Activity',
          userId: activity.actor_id || 'system',
          userName: activity.actor_name || 'System',
          timestamp: new Date(activity.created_at),
          metadata: activity.details || {}
        }));

        setActivities(transformedActivities);
      } catch (err) {
        console.error('Error fetching activity:', err);
        setError(err instanceof Error ? err.message : 'Failed to load activity feed');
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    if (deal.id) {
      fetchActivity();
    }
  }, [deal.id]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [displayCount, setDisplayCount] = useState(20);

  // Filter activities
  const filteredActivities = activities
    .filter(activity => {
      const matchesType = selectedType === 'all' || activity.type === selectedType;
      const matchesSearch = 
        activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.userName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      const comparison = b.timestamp.getTime() - a.timestamp.getTime();
      return sortOrder === 'newest' ? comparison : -comparison;
    })
    .slice(0, displayCount);

  const hasMore = filteredActivities.length < activities.length;

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-[#9EA8B4]">Loading activity feed...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-[#1c0a0a] border border-red-800/50 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-2">⚠️ Error loading activity feed</p>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="bg-[#0F1319] rounded-lg border border-[#1e2a3d] p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#253347] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-[#253347] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            {ACTIVITY_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(order => order === 'newest' ? 'oldest' : 'newest')}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#253347] rounded-lg hover:bg-[#0F1319] text-sm font-medium transition-colors"
          >
            <Filter className="w-4 h-4" />
            {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* Activity Timeline */}
      {filteredActivities.length === 0 ? (
        <div className="bg-[#0F1319] rounded-lg border border-[#1e2a3d] p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#131920] rounded-full mb-4">
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#E8E6E1] mb-2">
            No activity yet
          </h3>
          <p className="text-sm text-[#9EA8B4] mb-6">
            Activity will appear here as you work on this deal
          </p>
        </div>
      ) : (
        <div className="bg-[#0F1319] rounded-lg border border-[#1e2a3d] overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredActivities.map((activity, index) => {
              const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
              const Icon = config.icon;
              
              return (
                <div
                  key={activity.id}
                  className="p-4 hover:bg-[#0F1319] transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Timeline connector */}
                    <div className="relative flex flex-col items-center">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      
                      {/* Vertical line (except for last item) */}
                      {index < filteredActivities.length - 1 && (
                        <div className="w-0.5 h-full bg-[#1e2a3d] absolute top-10 bottom-0" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#E8E6E1]">
                            {activity.description}
                          </p>
                        </div>
                        <span className="text-xs text-[#6B7585] whitespace-nowrap">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#9EA8B4]">
                          {activity.userName}
                        </span>
                        
                        {/* User badge for AI */}
                        {activity.userId === 'ai' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#1a0d3d] text-purple-800">
                            AI
                          </span>
                        )}
                      </div>

                      {/* Metadata details (if any) */}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-[#6B7585]">
                          {activity.type === 'boundary_defined' && activity.metadata.acres && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#131920] rounded">
                              <MapPin className="w-3 h-3" />
                              {activity.metadata.acres.toFixed(1)} acres
                            </span>
                          )}
                          {activity.type === 'property_added' && activity.metadata.count && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#131920] rounded">
                              {activity.metadata.count} properties
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="p-4 border-t border-[#1e2a3d] text-center">
              <button
                onClick={() => setDisplayCount(count => count + 20)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-400 hover:bg-[#0d1e3d] rounded-lg transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                Load More Activity
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats Footer */}
      {filteredActivities.length > 0 && (
        <div className="bg-[#0F1319] rounded-lg border border-[#1e2a3d] p-4">
          <div className="flex items-center justify-between text-sm text-[#9EA8B4]">
            <span>
              Showing {filteredActivities.length} of {activities.length} activities
              {selectedType !== 'all' && ` (${ACTIVITY_TYPES.find(t => t.value === selectedType)?.label})`}
            </span>
            {activities.length > 0 && (
              <span>
                Last activity: {formatTimestamp(activities[0].timestamp)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
