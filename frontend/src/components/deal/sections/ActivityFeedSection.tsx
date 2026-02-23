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
    bgColor: 'bg-blue-100'
  },
  boundary_defined: {
    icon: MapPin,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  property_added: {
    icon: MapPin,
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  property_removed: {
    icon: MapPin,
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  analysis_run: {
    icon: TrendingUp,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100'
  },
  document_uploaded: {
    icon: FileText,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100'
  },
  team_member_invited: {
    icon: Users,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100'
  },
  stage_changed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  note_added: {
    icon: Edit,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100'
  },
  default: {
    icon: Activity,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100'
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
  // Stub data - would normally come from API
  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: '1',
      dealId: deal.id,
      type: 'deal_created',
      description: `Deal created: ${deal.name}`,
      userId: '1',
      userName: 'Leon D',
      timestamp: new Date(Date.now() - 86400000 * 5),
      metadata: { dealName: deal.name }
    },
    {
      id: '2',
      dealId: deal.id,
      type: 'boundary_defined',
      description: `Boundary defined (${deal.acres} acres)`,
      userId: '1',
      userName: 'Leon D',
      timestamp: new Date(Date.now() - 86400000 * 5 + 60000),
      metadata: { acres: deal.acres }
    },
    {
      id: '3',
      dealId: deal.id,
      type: 'property_added',
      description: `Added ${deal.propertyCount} properties to deal`,
      userId: 'ai',
      userName: 'RocketMan (AI)',
      timestamp: new Date(Date.now() - 86400000 * 5 + 1800000),
      metadata: { count: deal.propertyCount }
    },
    {
      id: '4',
      dealId: deal.id,
      type: 'document_uploaded',
      description: 'Uploaded: Financial_Proforma.xlsx',
      userId: '1',
      userName: 'Leon D',
      timestamp: new Date(Date.now() - 86400000 * 4),
      metadata: { filename: 'Financial_Proforma.xlsx' }
    },
    {
      id: '5',
      dealId: deal.id,
      type: 'analysis_run',
      description: 'Ran market analysis',
      userId: 'ai',
      userName: 'RocketMan (AI)',
      timestamp: new Date(Date.now() - 86400000 * 3),
      metadata: {}
    }
  ]);

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

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <Filter className="w-4 h-4" />
            {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* Activity Timeline */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No activity yet
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Activity will appear here as you work on this deal
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredActivities.map((activity, index) => {
              const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
              const Icon = config.icon;
              
              return (
                <div
                  key={activity.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
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
                        <div className="w-0.5 h-full bg-gray-200 absolute top-10 bottom-0" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.description}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {activity.userName}
                        </span>
                        
                        {/* User badge for AI */}
                        {activity.userId === 'ai' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            AI
                          </span>
                        )}
                      </div>

                      {/* Metadata details (if any) */}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          {activity.type === 'boundary_defined' && activity.metadata.acres && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                              <MapPin className="w-3 h-3" />
                              {activity.metadata.acres.toFixed(1)} acres
                            </span>
                          )}
                          {activity.type === 'property_added' && activity.metadata.count && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
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
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => setDisplayCount(count => count + 20)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
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
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
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
