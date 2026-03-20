/**
 * Timeline Section - Dual-Mode (Acquisition & Performance)
 * Comprehensive timeline and milestone tracking with Gantt-style visualization
 * 
 * Acquisition Mode: Deal milestones, closing timeline, critical dates
 * Performance Mode: Operational milestones, lease expirations, capex schedule
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { apiClient } from '@/services/api.client';

// Type definitions
interface TimelineStat {
  label: string;
  value: number | string;
  format: 'days' | 'percentage' | 'number';
  icon: string;
  subtext?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
}

interface Milestone {
  id: string;
  title: string;
  description?: string;
  date: string;
  status: 'completed' | 'in-progress' | 'upcoming' | 'overdue' | 'at-risk';
  category: 'critical' | 'standard' | 'optional';
  owner?: string;
  completedDate?: string;
  daysUntil?: number;
  notes?: string;
  dependencies?: string[];
}

interface DeadlineItem {
  id: string;
  title: string;
  dueDate: string;
  daysUntil: number;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'due-soon' | 'upcoming' | 'overdue';
  owner: string;
  completionPercent?: number;
}

interface TimelineData {
  stats?: TimelineStat[];
  milestones?: Milestone[];
  deadlines?: DeadlineItem[];
}

interface TimelineSectionProps {
  deal: Deal;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [selectedView, setSelectedView] = useState<'timeline' | 'list'>('timeline');
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'upcoming'>('all');
  const [liveData, setLiveData] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchTimelineData = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get(`/api/v1/deals/${deal.id}/state`);
        if (cancelled) return;
        const data = response.data;
        if (data?.success && data?.timeline_data) {
          const td = data.timeline_data;
          setLiveData({
            stats: td.stats || undefined,
            milestones: td.milestones || undefined,
            deadlines: td.deadlines || undefined,
          });
          setIsLive(true);
        }
      } catch {
        if (!cancelled) {
          setIsLive(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchTimelineData();
    return () => { cancelled = true; };
  }, [deal.id]);

  const saveTimelineData = useCallback(async (updatedMilestones: Milestone[]) => {
    setIsSaving(true);
    try {
      const timelinePayload: TimelineData = {
        stats: liveData?.stats || getDefaultTimelineStats(isPipeline),
        milestones: updatedMilestones,
        deadlines: liveData?.deadlines || getDefaultDeadlines(isPipeline),
      };
      await apiClient.patch(`/api/v1/deals/${deal.id}/state`, {
        timeline_data: timelinePayload,
      });
      setLiveData(timelinePayload);
      setIsLive(true);
    } catch {
    } finally {
      setIsSaving(false);
    }
  }, [deal.id, isPipeline, liveData]);

  const stats = (isLive && liveData?.stats) ? liveData.stats : getDefaultTimelineStats(isPipeline);
  const milestones = (isLive && liveData?.milestones) ? liveData.milestones : getDefaultMilestones(isPipeline);
  const deadlines = (isLive && liveData?.deadlines) ? liveData.deadlines : getDefaultDeadlines(isPipeline);

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

  const handleMilestoneStatusUpdate = useCallback((milestoneId: string, newStatus: Milestone['status']) => {
    const updated = milestones.map(m =>
      m.id === milestoneId
        ? { ...m, status: newStatus, ...(newStatus === 'completed' ? { completedDate: new Date().toISOString().split('T')[0] } : {}) }
        : m
    );
    saveTimelineData(updated);
  }, [milestones, saveTimelineData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#9EA8B4]">Loading timeline data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPipeline 
              ? 'bg-[#0d1e3d] text-blue-400' 
              : 'bg-[#022c22] text-green-400'
          }`}>
            {isPipeline ? '🎯 Acquisition Timeline' : '🏢 Performance Timeline'}
          </div>
          {isLive && (
            <div className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE DATA
            </div>
          )}
          {isSaving && (
            <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300 flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
              Saving...
            </div>
          )}
          {isOwned && (
            <div className="text-xs text-[#6B7585]">
              Acquired: {new Date(deal.actualCloseDate || deal.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
        
        {/* View Toggle & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[#131920] rounded-lg p-1">
            <button
              onClick={() => setSelectedView('timeline')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedView === 'timeline'
                  ? 'bg-[#0F1319] text-[#E8E6E1] shadow-sm'
                  : 'text-[#9EA8B4] hover:text-[#E8E6E1]'
              }`}
            >
              📊 Timeline View
            </button>
            <button
              onClick={() => setSelectedView('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedView === 'list'
                  ? 'bg-[#0F1319] text-[#E8E6E1] shadow-sm'
                  : 'text-[#9EA8B4] hover:text-[#E8E6E1]'
              }`}
            >
              📋 List View
            </button>
          </div>
          
          <button className="px-3 py-1.5 text-xs font-medium text-[#9EA8B4] bg-[#0F1319] border border-[#253347] rounded-lg hover:bg-[#0F1319] transition-colors">
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
        <span className="text-sm font-medium text-[#9EA8B4]">Filter:</span>
        <div className="flex gap-2">
          {['all', 'critical', 'upcoming'].map(filter => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === filter
                  ? 'bg-[#0d1e3d] text-blue-400 border border-blue-700'
                  : 'bg-[#0F1319] text-[#9EA8B4] border border-[#253347] hover:border-gray-400'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-[#6B7585]">
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
        return 'bg-[#022c22] border-green-800/50';
      case 'warning':
        return 'bg-[#1a1200] border-yellow-200';
      case 'danger':
        return 'bg-[#1c0a0a] border-red-800/50';
      case 'info':
      default:
        return 'bg-[#0d1e3d] border-blue-900/50';
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
            <span className="text-[#9EA8B4] text-xs font-medium">{stat.label}</span>
            <span className="text-2xl">{stat.icon}</span>
          </div>
          <div className="text-2xl font-bold text-[#E8E6E1] mb-1">
            {formatValue(stat)}
            {stat.format === 'days' && <span className="text-sm font-normal text-[#6B7585] ml-1">days</span>}
          </div>
          {stat.subtext && (
            <div className="text-xs text-[#6B7585]">{stat.subtext}</div>
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
      <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-6">
        <h3 className="text-sm font-semibold text-[#9EA8B4] mb-4">Progress Overview</h3>
        <div className="space-y-4">
          
          {/* Overall Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-[#9EA8B4] mb-2">
              <span>Overall Progress</span>
              <span className="font-semibold">
                {groupedMilestones.completed.length} / {milestones.length} Complete
              </span>
            </div>
            <div className="h-4 bg-[#131920] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                style={{ 
                  width: `${(groupedMilestones.completed.length / milestones.length) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-[#1e2a3d]">
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
      <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-[#0F1319] border-b border-[#1e2a3d]">
          <h3 className="text-sm font-semibold text-[#9EA8B4]">
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
        <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#9EA8B4] mb-4 flex items-center gap-2">
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
    green: 'bg-[#022c22] text-green-400 border-green-800/50',
    blue: 'bg-[#0d1e3d] text-blue-400 border-blue-900/50',
    gray: 'bg-[#0F1319] text-[#9EA8B4] border-[#1e2a3d]',
    yellow: 'bg-[#1a1200] text-yellow-700 border-yellow-200',
    red: 'bg-[#1c0a0a] text-red-400 border-red-800/50'
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
      <div className="relative h-12 mb-6 border-b-2 border-[#253347]">
        {/* Month markers */}
        <div className="absolute inset-0 flex justify-between text-xs text-[#6B7585]">
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
              <div className="h-12 bg-[#0F1319] rounded border border-[#1e2a3d] relative">
                
                {/* Milestone marker */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${position}%` }}
                >
                  <div className="relative group">
                    <div className={`w-4 h-4 rounded-full ${getMilestoneColor(milestone)} ring-4 ring-white border-2 border-[#1e2a3d] cursor-pointer hover:scale-125 transition-transform`} />
                    
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
                  <span className="text-xs font-medium text-[#9EA8B4] truncate max-w-[200px]">
                    {milestone.title}
                  </span>
                  {milestone.category === 'critical' && (
                    <span className="text-xs">🎯</span>
                  )}
                </div>

                {/* Date on right */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#6B7585]">
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
    <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-[#0F1319] border-b border-[#1e2a3d] flex items-center justify-between hover:bg-[#131920] transition-colors"
      >
        <h3 className="text-sm font-semibold text-[#9EA8B4] flex items-center gap-2">
          {title}
          <span className="px-2 py-0.5 bg-[#0F1319] rounded text-xs font-normal text-[#9EA8B4] border border-[#253347]">
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
        return 'bg-[#022c22] text-green-400 border-green-700';
      case 'in-progress':
        return 'bg-[#0d1e3d] text-blue-400 border-blue-700';
      case 'overdue':
        return 'bg-[#1c0a0a] text-red-400 border-red-700';
      case 'at-risk':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-[#131920] text-[#9EA8B4] border-[#253347]';
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
      <div className="flex items-center gap-3 p-3 rounded-lg border border-[#1e2a3d] hover:border-[#253347] hover:shadow-sm transition-all">
        <span className="text-xl">{getCategoryIcon(milestone.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-[#E8E6E1] truncate">
              {milestone.title}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(milestone.status)}`}>
              {getStatusLabel(milestone.status)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6B7585]">
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
    <div className="p-4 rounded-lg border border-[#1e2a3d] hover:border-[#253347] hover:shadow-md transition-all">
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-1">{getCategoryIcon(milestone.category)}</span>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold text-[#E8E6E1]">{milestone.title}</h4>
            <span className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${getStatusColor(milestone.status)}`}>
              {getStatusLabel(milestone.status)}
            </span>
          </div>

          {/* Description */}
          {milestone.description && (
            <p className="text-xs text-[#9EA8B4] mb-3">{milestone.description}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#6B7585]">
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
                milestone.daysUntil <= 7 ? 'text-red-400' : 
                milestone.daysUntil <= 14 ? 'text-yellow-600' : 
                'text-[#9EA8B4]'
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
            <div className="mt-3 pt-3 border-t border-[#1e2a3d]">
              <div className="text-xs text-[#9EA8B4]">
                <span className="font-medium">Note:</span> {milestone.notes}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {milestone.dependencies && milestone.dependencies.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#1e2a3d]">
              <div className="text-xs text-[#9EA8B4]">
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
        return 'bg-[#1c0a0a] border-red-800/50 text-red-400';
      case 'high':
        return 'bg-[#1a0d00] border-orange-200 text-orange-700';
      case 'medium':
        return 'bg-[#1a1200] border-yellow-200 text-yellow-700';
      case 'low':
        return 'bg-[#0F1319] border-[#1e2a3d] text-[#9EA8B4]';
      default:
        return 'bg-[#0F1319] border-[#1e2a3d] text-[#9EA8B4]';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'due-soon':
        return 'text-red-400 font-semibold';
      case 'upcoming':
        return 'text-blue-600';
      case 'overdue':
        return 'text-red-400 font-bold';
      default:
        return 'text-[#9EA8B4]';
    }
  };

  const sortedDeadlines = [...deadlines].sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-[#0F1319] border-b border-[#1e2a3d] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#9EA8B4]">⏰ Upcoming Deadlines (Next 90 Days)</h3>
        <button className="text-xs text-blue-600 hover:text-blue-400 font-medium">
          View All Deadlines
        </button>
      </div>
      
      <div className="p-4">
        {sortedDeadlines.length === 0 ? (
          <div className="text-center py-8 text-[#6B7585]">
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
                    <h4 className="text-sm font-semibold text-[#E8E6E1] mb-1">{deadline.title}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className={getStatusColor(deadline.status)}>
                        📅 {deadline.daysUntil === 0 ? 'Due Today' :
                            deadline.daysUntil === 1 ? 'Due Tomorrow' :
                            deadline.daysUntil < 0 ? `${Math.abs(deadline.daysUntil)} days overdue` :
                            `Due in ${deadline.daysUntil} days`}
                      </span>
                      <span className="text-[#9EA8B4]">• {deadline.category}</span>
                      <span className="text-[#9EA8B4]">• 👤 {deadline.owner}</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-[#0F1319] border border-[#253347] rounded text-xs font-medium uppercase whitespace-nowrap">
                    {deadline.priority}
                  </span>
                </div>

                {/* Progress Bar */}
                {deadline.completionPercent !== undefined && (
                  <div>
                    <div className="flex justify-between text-xs text-[#9EA8B4] mb-1">
                      <span>Progress</span>
                      <span className="font-medium">{deadline.completionPercent}%</span>
                    </div>
                    <div className="h-2 bg-[#0F1319] rounded-full overflow-hidden border border-[#1e2a3d]">
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

// ==================== DEFAULT DATA FUNCTIONS ====================

function getDefaultTimelineStats(isPipeline: boolean): TimelineStat[] {
  if (isPipeline) {
    return [
      { label: 'Days to Closing', value: 42, format: 'days', icon: '📅', status: 'info', subtext: 'Target: Mar 25, 2024' },
      { label: 'Progress', value: 68, format: 'percentage', icon: '📊', status: 'success' },
      { label: 'Milestones Complete', value: '12/18', format: 'number', icon: '✅' },
      { label: 'At Risk', value: 2, format: 'number', icon: '⚠️', status: 'warning' },
      { label: 'Critical Path Items', value: 4, format: 'number', icon: '🎯', status: 'info' }
    ];
  } else {
    return [
      { label: 'Days Since Acquisition', value: 487, format: 'days', icon: '📅', status: 'info', subtext: 'Acquired: Jan 15, 2023' },
      { label: 'Operational Progress', value: 78, format: 'percentage', icon: '📊', status: 'success' },
      { label: 'Milestones Complete', value: '24/31', format: 'number', icon: '✅' },
      { label: 'Upcoming Deadlines', value: 8, format: 'number', icon: '⏰', status: 'info' },
      { label: 'Critical Items', value: 3, format: 'number', icon: '🎯', status: 'warning' }
    ];
  }
}

function getDefaultMilestones(isPipeline: boolean): Milestone[] {
  if (isPipeline) {
    return [
      {
        id: '1',
        title: 'Earnest Money Deposited',
        description: 'Initial deposit submitted to title company',
        date: '2024-01-05',
        status: 'completed',
        category: 'critical',
        owner: 'John Smith',
        completedDate: '2024-01-05',
        daysUntil: -20
      },
      {
        id: '2',
        title: 'Property Inspection Complete',
        description: 'Physical inspection of all units and systems',
        date: '2024-01-15',
        status: 'completed',
        category: 'critical',
        owner: 'Sarah Johnson',
        completedDate: '2024-01-15',
        daysUntil: -10
      },
      {
        id: '3',
        title: 'Due Diligence Period Ends',
        description: 'Final date to terminate contract without penalty',
        date: '2024-02-01',
        status: 'in-progress',
        category: 'critical',
        owner: 'Michael Chen',
        daysUntil: 7
      },
      {
        id: '4',
        title: 'Financing Commitment',
        description: 'Receive loan commitment letter from lender',
        date: '2024-02-15',
        status: 'upcoming',
        category: 'critical',
        owner: 'David Park',
        daysUntil: 21
      },
      {
        id: '5',
        title: 'Final Walkthrough',
        description: 'Pre-closing inspection of property',
        date: '2024-03-20',
        status: 'upcoming',
        category: 'standard',
        owner: 'Sarah Johnson',
        daysUntil: 54
      },
      {
        id: '6',
        title: 'Closing Date',
        description: 'Transaction closing and funding',
        date: '2024-03-25',
        status: 'upcoming',
        category: 'critical',
        owner: 'John Smith',
        daysUntil: 59
      }
    ];
  } else {
    return [
      {
        id: '1',
        title: 'Q1 Unit Renovations',
        description: 'Complete 15 unit turns with upgraded finishes',
        date: '2024-03-31',
        status: 'in-progress',
        category: 'critical',
        owner: 'Construction Team',
        daysUntil: 65
      },
      {
        id: '2',
        title: 'Lease Renewals Campaign',
        description: 'Outreach to 42 expiring leases in Q2',
        date: '2024-04-15',
        status: 'upcoming',
        category: 'critical',
        owner: 'Property Manager',
        daysUntil: 80
      },
      {
        id: '3',
        title: 'Annual Budget Review',
        description: 'Complete annual operating budget and variance analysis',
        date: '2024-01-31',
        status: 'completed',
        category: 'standard',
        owner: 'Finance Team',
        completedDate: '2024-01-28',
        daysUntil: -5
      },
      {
        id: '4',
        title: 'Property Tax Appeal',
        description: 'File property tax appeal with county',
        date: '2024-05-01',
        status: 'upcoming',
        category: 'standard',
        owner: 'Asset Manager',
        daysUntil: 96
      },
      {
        id: '5',
        title: 'Insurance Renewal',
        description: 'Review and renew property insurance policies',
        date: '2024-06-01',
        status: 'upcoming',
        category: 'standard',
        owner: 'Risk Management',
        daysUntil: 127
      }
    ];
  }
}

function getDefaultDeadlines(isPipeline: boolean): DeadlineItem[] {
  if (isPipeline) {
    return [
      {
        id: '1',
        title: 'Due Diligence Period Ends',
        dueDate: '2024-02-01',
        daysUntil: 7,
        category: 'Legal',
        priority: 'critical',
        status: 'due-soon',
        owner: 'Michael Chen',
        completionPercent: 85
      },
      {
        id: '2',
        title: 'Financing Commitment Required',
        dueDate: '2024-02-15',
        daysUntil: 21,
        category: 'Financial',
        priority: 'critical',
        status: 'upcoming',
        owner: 'David Park',
        completionPercent: 60
      },
      {
        id: '3',
        title: 'Title Commitment Review',
        dueDate: '2024-02-08',
        daysUntil: 14,
        category: 'Legal',
        priority: 'high',
        status: 'upcoming',
        owner: 'Legal Team',
        completionPercent: 40
      }
    ];
  } else {
    return [
      {
        id: '1',
        title: 'Q1 Renovation Milestone',
        dueDate: '2024-03-31',
        daysUntil: 65,
        category: 'Physical',
        priority: 'high',
        status: 'upcoming',
        owner: 'Construction Team',
        completionPercent: 67
      },
      {
        id: '2',
        title: 'Lease Renewal Outreach',
        dueDate: '2024-04-15',
        daysUntil: 80,
        category: 'Operations',
        priority: 'high',
        status: 'upcoming',
        owner: 'Property Manager',
        completionPercent: 20
      },
      {
        id: '3',
        title: 'Property Tax Appeal Filing',
        dueDate: '2024-05-01',
        daysUntil: 96,
        category: 'Financial',
        priority: 'medium',
        status: 'upcoming',
        owner: 'Asset Manager',
        completionPercent: 0
      },
      {
        id: '4',
        title: 'Insurance Renewal',
        dueDate: '2024-06-01',
        daysUntil: 127,
        category: 'Operations',
        priority: 'medium',
        status: 'upcoming',
        owner: 'Risk Management',
        completionPercent: 10
      }
    ];
  }
}

export default TimelineSection;
