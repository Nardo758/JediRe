/**
 * Timeline Section - Dual-Mode (Acquisition & Performance)
 * Comprehensive timeline and milestone tracking with Gantt-style visualization
 * 
 * Acquisition Mode: Deal milestones, closing timeline, critical dates
 * Performance Mode: Operational milestones, lease expirations, capex schedule
 */

import React, { useState, useMemo } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionTimelineStats,
  acquisitionMilestones,
  acquisitionDeadlines,
  performanceTimelineStats,
  performanceMilestones,
  performanceDeadlines,
  TimelineStat,
  Milestone,
  DeadlineItem
} from '../../../data/timelineMockData';

interface TimelineSectionProps {
  deal: Deal;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [selectedView, setSelectedView] = useState<'timeline' | 'list'>('timeline');
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'upcoming'>('all');

  // Select data based on mode
  const stats = isPipeline ? acquisitionTimelineStats : performanceTimelineStats;
  const milestones = isPipeline ? acquisitionMilestones : performanceMilestones;
  const deadlines = isPipeline ? acquisitionDeadlines : performanceDeadlines;

  // Filter milestones
  const filteredMilestones = useMemo(() => {
    if (filterStatus === 'all') return milestones;
    if (filterStatus === 'critical') return milestones.filter(m => m.category === 'critical');
    if (filterStatus === 'upcoming') return milestones.filter(m => m.status === 'upcoming' || m.status === 'in-progress');
    return milestones;
  }, [milestones, filterStatus]);

  // Group milestones by status
  const groupedMilestones = useMemo(() => {
    const completed = milestones.filter(m => m.status === 'completed');
    const inProgress = milestones.filter(m => m.status === 'in-progress');
    const upcoming = milestones.filter(m => m.status === 'upcoming');
    const overdue = milestones.filter(m => m.status === 'overdue');
    const atRisk = milestones.filter(m => m.status === 'at-risk');

    return { completed, inProgress, upcoming, overdue, atRisk };
  }, [milestones]);

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPipeline 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {isPipeline ? '🎯 Acquisition Timeline' : '🏢 Performance Timeline'}
          </div>
          {isOwned && (
            <div className="text-xs text-gray-500">
              Acquired: {new Date(deal.actualCloseDate || deal.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
        
        {/* View Toggle & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedView('timeline')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedView === 'timeline'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Timeline View
            </button>
            <button
              onClick={() => setSelectedView('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedView === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 List View
            </button>
          </div>
          
          <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            📥 Export
          </button>
          <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            ➕ Add Milestone
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={stats} />

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <div className="flex gap-2">
          {['all', 'critical', 'upcoming'].map(filter => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === filter
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-gray-500">
          Showing {filteredMilestones.length} of {milestones.length} milestones
        </div>
      </div>

      {/* Main Content */}
      {selectedView === 'timeline' ? (
        <TimelineView
          milestones={filteredMilestones}
          groupedMilestones={groupedMilestones}
          isPipeline={isPipeline}
        />
      ) : (
        <ListView
          milestones={filteredMilestones}
          isPipeline={isPipeline}
        />
      )}

      {/* Upcoming Deadlines */}
      <UpcomingDeadlinesCard deadlines={deadlines} isPipeline={isPipeline} />

    </div>
  );
};

// ==================== QUICK STATS GRID ====================

interface QuickStatsGridProps {
  stats: TimelineStat[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  const formatValue = (stat: TimelineStat): string => {
    switch (stat.format) {
      case 'days':
        return `${stat.value}`;
      case 'percentage':
        return `${stat.value}%`;
      case 'number':
        return stat.value.toString();
      default:
        return stat.value.toString();
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'danger':
        return 'bg-red-50 border-red-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <div 
          key={index}
          className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${getStatusColor(stat.status)}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-xs font-medium">{stat.label}</span>
            <span className="text-2xl">{stat.icon}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {formatValue(stat)}
            {stat.format === 'days' && <span className="text-sm font-normal text-gray-500 ml-1">days</span>}
          </div>
          {stat.subtext && (
            <div className="text-xs text-gray-500">{stat.subtext}</div>
          )}
        </div>
      ))}
    </div>
  );
};

// ==================== TIMELINE VIEW ====================

interface TimelineViewProps {
  milestones: Milestone[];
  groupedMilestones: {
    completed: Milestone[];
    inProgress: Milestone[];
    upcoming: Milestone[];
    overdue: Milestone[];
    atRisk: Milestone[];
  };
  isPipeline: boolean;
}

const TimelineView: React.FC<TimelineViewProps> = ({ milestones, groupedMilestones, isPipeline }) => {
  // Calculate date range for timeline
  const dateRange = useMemo(() => {
    const dates = milestones.map(m => new Date(m.date).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    return { minDate, maxDate };
  }, [milestones]);

  const today = new Date();

  return (
    <div className="space-y-6">
      
      {/* Progress Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Progress Overview</h3>
        <div className="space-y-4">
          
          {/* Overall Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>Overall Progress</span>
              <span className="font-semibold">
                {groupedMilestones.completed.length} / {milestones.length} Complete
              </span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                style={{ 
                  width: `${(groupedMilestones.completed.length / milestones.length) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-gray-200">
            <StatusBadge 
              label="Completed" 
              count={groupedMilestones.completed.length}
              color="green"
              icon="✅"
            />
            <StatusBadge 
              label="In Progress" 
              count={groupedMilestones.inProgress.length}
              color="blue"
              icon="🔄"
            />
            <StatusBadge 
              label="Upcoming" 
              count={groupedMilestones.upcoming.length}
              color="gray"
              icon="📅"
            />
            <StatusBadge 
              label="At Risk" 
              count={groupedMilestones.atRisk.length}
              color="yellow"
              icon="⚠️"
            />
            <StatusBadge 
              label="Overdue" 
              count={groupedMilestones.overdue.length}
              color="red"
              icon="🚨"
            />
          </div>
        </div>
      </div>

      {/* Gantt-Style Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">
            {isPipeline ? 'Deal Timeline - Path to Close' : 'Operational Timeline'}
          </h3>
        </div>
        <div className="p-6">
          <GanttTimeline 
            milestones={milestones}
            dateRange={dateRange}
            today={today}
          />
        </div>
      </div>

      {/* Critical Path Items */}
      {groupedMilestones.inProgress.length > 0 || groupedMilestones.upcoming.filter(m => m.category === 'critical').length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>🎯</span> Critical Path Items
          </h3>
          <div className="space-y-3">
            {[...groupedMilestones.inProgress, ...groupedMilestones.upcoming.filter(m => m.category === 'critical')]
              .slice(0, 5)
              .map(milestone => (
                <MilestoneCard key={milestone.id} milestone={milestone} compact />
              ))}
          </div>
        </div>
      ) : null}

    </div>
  );
};

interface StatusBadgeProps {
  label: string;
  count: number;
  color: 'green' | 'blue' | 'gray' | 'yellow' | 'red';
  icon: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ label, count, color, icon }) => {
  const colorClasses = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200'
  };

  return (
    <div className={`border rounded-lg p-3 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
};

// ==================== GANTT TIMELINE ====================

interface GanttTimelineProps {
  milestones: Milestone[];
  dateRange: { minDate: Date; maxDate: Date };
  today: Date;
}

const GanttTimeline: React.FC<GanttTimelineProps> = ({ milestones, dateRange, today }) => {
  const { minDate, maxDate } = dateRange;
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const getPosition = (date: Date) => {
    const days = Math.ceil((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    return (days / totalDays) * 100;
  };

  const todayPosition = getPosition(today);

  const getMilestoneColor = (milestone: Milestone) => {
    if (milestone.status === 'completed') return 'bg-green-500';
    if (milestone.status === 'in-progress') return 'bg-blue-500';
    if (milestone.status === 'overdue') return 'bg-red-500';
    if (milestone.status === 'at-risk') return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="space-y-1">
      {/* Timeline Header */}
      <div className="relative h-12 mb-6 border-b-2 border-gray-300">
        {/* Month markers */}
        <div className="absolute inset-0 flex justify-between text-xs text-gray-500">
          <span>{minDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          <span>{maxDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        </div>
        
        {/* Today marker */}
        {todayPosition >= 0 && todayPosition <= 100 && (
          <div 
            className="absolute bottom-0 w-0.5 h-full bg-blue-600"
            style={{ left: `${todayPosition}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-blue-600 text-white text-xs rounded whitespace-nowrap">
              Today
            </div>
          </div>
        )}
      </div>

      {/* Milestone Rows */}
      <div className="space-y-2">
        {sortedMilestones.map((milestone, index) => {
          const position = getPosition(new Date(milestone.date));
          
          return (
            <div key={milestone.id} className="relative">
              {/* Background line */}
              <div className="h-12 bg-gray-50 rounded border border-gray-200 relative">
                
                {/* Milestone marker */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${position}%` }}
                >
                  <div className="relative group">
                    <div className={`w-4 h-4 rounded-full ${getMilestoneColor(milestone)} ring-4 ring-white border-2 border-gray-200 cursor-pointer hover:scale-125 transition-transform`} />
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="font-semibold">{milestone.title}</div>
                      <div className="text-gray-300 mt-1">
                        {new Date(milestone.date).toLocaleDateString()}
                      </div>
                      {milestone.daysUntil !== undefined && (
                        <div className="text-gray-300">
                          {milestone.daysUntil > 0 ? `${milestone.daysUntil} days until` : 'Today'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Milestone label */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getMilestoneColor(milestone)}`} />
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">
                    {milestone.title}
                  </span>
                  {milestone.category === 'critical' && (
                    <span className="text-xs">🎯</span>
                  )}
                </div>

                {/* Date on right */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  {new Date(milestone.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== LIST VIEW ====================

interface ListViewProps {
  milestones: Milestone[];
  isPipeline: boolean;
}

const ListView: React.FC<ListViewProps> = ({ milestones, isPipeline }) => {
  // Group by time period
  const groupedByTime = useMemo(() => {
    const past: Milestone[] = [];
    const present: Milestone[] = [];
    const future: Milestone[] = [];
    
    milestones.forEach(m => {
      if (m.status === 'completed') {
        past.push(m);
      } else if (m.status === 'in-progress') {
        present.push(m);
      } else {
        future.push(m);
      }
    });

    return { past, present, future };
  }, [milestones]);

  return (
    <div className="space-y-6">
      
      {/* In Progress / Current */}
      {groupedByTime.present.length > 0 && (
        <MilestoneGroup
          title="🔄 In Progress"
          milestones={groupedByTime.present}
          defaultExpanded
        />
      )}

      {/* Upcoming / Future */}
      {groupedByTime.future.length > 0 && (
        <MilestoneGroup
          title="📅 Upcoming"
          milestones={groupedByTime.future}
          defaultExpanded
        />
      )}

      {/* Completed / Past */}
      {groupedByTime.past.length > 0 && (
        <MilestoneGroup
          title="✅ Completed"
          milestones={groupedByTime.past}
          defaultExpanded={false}
        />
      )}

    </div>
  );
};

interface MilestoneGroupProps {
  title: string;
  milestones: Milestone[];
  defaultExpanded: boolean;
}

const MilestoneGroup: React.FC<MilestoneGroupProps> = ({ title, milestones, defaultExpanded }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          {title}
          <span className="px-2 py-0.5 bg-white rounded text-xs font-normal text-gray-600 border border-gray-300">
            {milestones.length}
          </span>
        </h3>
        <span className="text-gray-400">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      
      {isExpanded && (
        <div className="p-4 space-y-3">
          {milestones.map(milestone => (
            <MilestoneCard key={milestone.id} milestone={milestone} />
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== MILESTONE CARD ====================

interface MilestoneCardProps {
  milestone: Milestone;
  compact?: boolean;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone, compact = false }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'at-risk':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'critical':
        return '🎯';
      case 'standard':
        return '📋';
      case 'optional':
        return '💡';
      default:
        return '📌';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      case 'upcoming':
        return 'Upcoming';
      case 'overdue':
        return 'Overdue';
      case 'at-risk':
        return 'At Risk';
      default:
        return status;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
        <span className="text-xl">{getCategoryIcon(milestone.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900 truncate">
              {milestone.title}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(milestone.status)}`}>
              {getStatusLabel(milestone.status)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>📅 {new Date(milestone.date).toLocaleDateString()}</span>
            {milestone.daysUntil !== undefined && milestone.daysUntil > 0 && (
              <span>⏰ {milestone.daysUntil} days</span>
            )}
            {milestone.owner && <span>👤 {milestone.owner}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-1">{getCategoryIcon(milestone.category)}</span>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold text-gray-900">{milestone.title}</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${getStatusColor(milestone.status)}`}>
              {getStatusLabel(milestone.status)}
            </span>
          </div>

          {/* Description */}
          {milestone.description && (
            <p className="text-xs text-gray-600 mb-3">{milestone.description}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span>📅</span>
              <span>{new Date(milestone.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}</span>
            </div>
            
            {milestone.daysUntil !== undefined && (
              <div className={`flex items-center gap-1 font-medium ${
                milestone.daysUntil <= 7 ? 'text-red-600' : 
                milestone.daysUntil <= 14 ? 'text-yellow-600' : 
                'text-gray-600'
              }`}>
                <span>⏰</span>
                <span>
                  {milestone.daysUntil === 0 ? 'Due Today' :
                   milestone.daysUntil < 0 ? `${Math.abs(milestone.daysUntil)} days overdue` :
                   `${milestone.daysUntil} days until`}
                </span>
              </div>
            )}

            {milestone.owner && (
              <div className="flex items-center gap-1">
                <span>👤</span>
                <span>{milestone.owner}</span>
              </div>
            )}

            {milestone.completedDate && (
              <div className="flex items-center gap-1 text-green-600">
                <span>✅</span>
                <span>Completed {new Date(milestone.completedDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {milestone.notes && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">Note:</span> {milestone.notes}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {milestone.dependencies && milestone.dependencies.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">Dependencies:</span> {milestone.dependencies.join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== UPCOMING DEADLINES ====================

interface UpcomingDeadlinesCardProps {
  deadlines: DeadlineItem[];
  isPipeline: boolean;
}

const UpcomingDeadlinesCard: React.FC<UpcomingDeadlinesCardProps> = ({ deadlines, isPipeline }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'high':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'low':
        return 'bg-gray-50 border-gray-200 text-gray-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'due-soon':
        return 'text-red-600 font-semibold';
      case 'upcoming':
        return 'text-blue-600';
      case 'overdue':
        return 'text-red-700 font-bold';
      default:
        return 'text-gray-600';
    }
  };

  const sortedDeadlines = [...deadlines].sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">⏰ Upcoming Deadlines (Next 90 Days)</h3>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          View All Deadlines
        </button>
      </div>
      
      <div className="p-4">
        {sortedDeadlines.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-sm">No upcoming deadlines!</div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedDeadlines.map(deadline => (
              <div 
                key={deadline.id}
                className={`p-4 rounded-lg border ${getPriorityColor(deadline.priority)}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{deadline.title}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className={getStatusColor(deadline.status)}>
                        📅 {deadline.daysUntil === 0 ? 'Due Today' :
                            deadline.daysUntil === 1 ? 'Due Tomorrow' :
                            deadline.daysUntil < 0 ? `${Math.abs(deadline.daysUntil)} days overdue` :
                            `Due in ${deadline.daysUntil} days`}
                      </span>
                      <span className="text-gray-600">• {deadline.category}</span>
                      <span className="text-gray-600">• 👤 {deadline.owner}</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-medium uppercase whitespace-nowrap">
                    {deadline.priority}
                  </span>
                </div>

                {/* Progress Bar */}
                {deadline.completionPercent !== undefined && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span className="font-medium">{deadline.completionPercent}%</span>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          deadline.completionPercent >= 80 ? 'bg-green-500' :
                          deadline.completionPercent >= 50 ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`}
                        style={{ width: `${deadline.completionPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineSection;
