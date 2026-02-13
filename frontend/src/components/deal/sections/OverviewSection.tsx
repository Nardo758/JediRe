/**
 * Overview Section - Dual-Mode (Acquisition & Performance)
 * Switches content based on deal status:
 * - pipeline → Acquisition mode
 * - owned → Performance mode
 */

import React from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionStats,
  acquisitionActions,
  acquisitionProgress,
  acquisitionActivities,
  acquisitionTeam,
  performanceStats,
  performanceActions,
  performanceMetrics,
  performanceActivities,
  performanceTeam,
  QuickStat,
  QuickAction,
  PerformanceMetric,
  Activity,
  TeamMember
} from '../../../data/overviewMockData';

interface OverviewSectionProps {
  deal: Deal;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);

  // Select data based on mode
  const stats = isPipeline ? acquisitionStats : performanceStats;
  const actions = isPipeline ? acquisitionActions : performanceActions;
  const activities = isPipeline ? acquisitionActivities : performanceActivities;
  const team = isPipeline ? acquisitionTeam : performanceTeam;

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPipeline 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {isPipeline ? '🎯 Acquisition Mode' : '🏢 Performance Mode'}
        </div>
        {isOwned && (
          <div className="text-xs text-gray-500">
            Acquired: {new Date(deal.actualCloseDate || deal.createdAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Quick Stats Cards */}
      <QuickStatsGrid stats={stats} />

      {/* Main Content Row: Map + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Map */}
        <InteractiveMap deal={deal} mode={mode} />

        {/* Quick Actions & Progress/Performance */}
        <div className="space-y-4">
          <QuickActionsCard actions={actions} />
          
          {isPipeline ? (
            <DealProgressCard progress={acquisitionProgress} />
          ) : (
            <PerformanceMetricsCard metrics={performanceMetrics} />
          )}
        </div>
      </div>

      {/* Bottom Row: Recent Activity + Key Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityCard activities={activities} mode={mode} />
        <KeyTeamCard team={team} mode={mode} />
      </div>

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: QuickStat[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  const formatValue = (stat: QuickStat): string => {
    switch (stat.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(stat.value as number);
      case 'percentage':
        return `${stat.value}%`;
      case 'number':
        return stat.value.toLocaleString();
      default:
        return stat.value.toString();
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatValue(stat)}
            </div>
            {stat.subtext && (
              <div className="text-xs text-gray-500">{stat.subtext}</div>
            )}
            {stat.trend && (
              <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${
                stat.trend.direction === 'up' 
                  ? 'text-green-600' 
                  : stat.trend.direction === 'down'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}>
                <span>{stat.trend.direction === 'up' ? '↗' : stat.trend.direction === 'down' ? '↘' : '→'}</span>
                <span>{stat.trend.value}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface InteractiveMapProps {
  deal: Deal;
  mode: 'acquisition' | 'performance';
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ deal, mode }) => {
  const mapContext = mode === 'acquisition' 
    ? [
        '• Deal boundary & properties',
        '• Competitive analysis',
        '• Market demographics',
        '• Points of interest'
      ]
    : [
        '• Asset location & boundary',
        '• Market comparables',
        '• Trade area analysis',
        '• Performance heatmaps'
      ];

  const handleOpenMapView = () => {
    // Scroll to the map view section if on enhanced page
    const mapSection = document.getElementById('section-map-view');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Or open the standalone map page
      window.open(`/map?dealId=${deal.id}`, '_blank');
    }
  };

  return (
    <div className="lg:col-span-2">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all cursor-pointer group" onClick={handleOpenMapView}>
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span>🗺️</span> Interactive Map
          </h3>
          <button 
            className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); handleOpenMapView(); }}
          >
            Open Map View →
          </button>
        </div>
        <div className="relative bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 h-96">
          {/* Map CTA - link to dedicated Map View module */}
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 group-hover:scale-105 transition-transform">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-pulse">🗺️</div>
              <p className="text-base font-semibold text-gray-700 mb-2">
                {mode === 'acquisition' ? 'Deal Location Intelligence' : 'Asset Performance Map'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Click to open full interactive map view
              </p>
              <ul className="text-xs mt-3 space-y-1 text-gray-600">
                {mapContext.map((item, i) => (
                  <li key={i} className="flex items-center justify-center gap-2">
                    <span className="text-green-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg inline-block shadow-lg hover:shadow-xl group-hover:bg-blue-700 transition-all">
                <span className="text-sm font-semibold">
                  Open Map View Module →
                </span>
              </div>
              <div className="mt-4 px-4 py-2 bg-white rounded-lg border border-gray-200 inline-block shadow-sm">
                <span className="text-xs font-medium text-gray-700">
                  📍 {deal.address || deal.propertyAddress || 'Loading location...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface QuickActionsCardProps {
  actions: QuickAction[];
}

const QuickActionsCard: React.FC<QuickActionsCardProps> = ({ actions }) => {
  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'hover:border-blue-300 hover:bg-blue-50',
      purple: 'hover:border-purple-300 hover:bg-purple-50',
      green: 'hover:border-green-300 hover:bg-green-50',
      orange: 'hover:border-orange-300 hover:bg-orange-50',
      indigo: 'hover:border-indigo-300 hover:bg-indigo-50'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={action.action}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 ${getColorClasses(action.color)} transition-all text-left group`}
          >
            <span className="text-2xl">{action.icon}</span>
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface DealProgressCardProps {
  progress: Array<{ label: string; percentage: number; color: string }>;
}

const DealProgressCard: React.FC<DealProgressCardProps> = ({ progress }) => {
  const getColorClass = (color: string) => {
    const colors = {
      blue: 'bg-blue-600',
      purple: 'bg-purple-600',
      green: 'bg-green-600',
      orange: 'bg-orange-600'
    };
    return colors[color as keyof typeof colors] || 'bg-gray-600';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Deal Progress</h3>
      <div className="space-y-3">
        {progress.map((item, index) => (
          <div key={index}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{item.label}</span>
              <span className="font-medium">{item.percentage}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getColorClass(item.color)} rounded-full transition-all`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PerformanceMetricsCardProps {
  metrics: PerformanceMetric[];
}

const PerformanceMetricsCard: React.FC<PerformanceMetricsCardProps> = ({ metrics }) => {
  const formatValue = (metric: PerformanceMetric, value: number): string => {
    if (metric.format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    }
    if (metric.format === 'percentage') {
      return `${value}%`;
    }
    return value.toLocaleString();
  };

  const getPerformanceStatus = (actual: number, target: number) => {
    const ratio = actual / target;
    if (ratio >= 0.98) return { color: 'green', icon: '✅', label: 'Meeting Target' };
    if (ratio >= 0.9) return { color: 'yellow', icon: '⚠️', label: 'Slightly Below' };
    return { color: 'red', icon: '❌', label: 'Below Target' };
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance vs Budget</h3>
      <div className="space-y-4">
        {metrics.map((metric, index) => {
          const status = getPerformanceStatus(metric.actual, metric.target);
          const percentage = Math.min((metric.actual / metric.target) * 100, 100);
          
          return (
            <div key={index}>
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="font-medium text-gray-700">{metric.label}</span>
                <span className="text-gray-500">
                  {formatValue(metric, metric.actual)} / {formatValue(metric, metric.target)}
                </span>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    status.color === 'green' 
                      ? 'bg-green-600' 
                      : status.color === 'yellow'
                        ? 'bg-yellow-500'
                        : 'bg-red-600'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className={`flex items-center gap-1 text-xs mt-1 ${
                status.color === 'green' 
                  ? 'text-green-600' 
                  : status.color === 'yellow'
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}>
                <span>{status.icon}</span>
                <span className="font-medium">{status.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface RecentActivityCardProps {
  activities: Activity[];
  mode: 'acquisition' | 'performance';
}

const RecentActivityCard: React.FC<RecentActivityCardProps> = ({ activities, mode }) => {
  const getActivityIcon = (type: string) => {
    const icons = {
      update: '🔄',
      document: '📄',
      note: '📝',
      event: '📅',
      operational: '⚙️'
    };
    return icons[type as keyof typeof icons] || '📋';
  };

  const getActivityColor = (type: string) => {
    const colors = {
      update: 'text-blue-500',
      document: 'text-green-500',
      note: 'text-purple-500',
      event: 'text-orange-500',
      operational: 'text-indigo-500'
    };
    return colors[type as keyof typeof colors] || 'text-gray-500';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Recent Activity</h3>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>
      <div className="space-y-3">
        {activities.map(activity => (
          <div 
            key={activity.id} 
            className="flex gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
          >
            <div className={`flex-shrink-0 mt-1 ${getActivityColor(activity.type)}`}>
              <span className="text-lg">{getActivityIcon(activity.type)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{activity.text}</p>
              <p className="text-xs text-gray-500 mt-1">
                {activity.user} • {activity.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface KeyTeamCardProps {
  team: TeamMember[];
  mode: 'acquisition' | 'performance';
}

const KeyTeamCard: React.FC<KeyTeamCardProps> = ({ team, mode }) => {
  const getStatusColor = (status: string) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      away: 'bg-yellow-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-400';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          {mode === 'acquisition' ? 'Key Team Members' : 'Property Team'}
        </h3>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          + Add Member
        </button>
      </div>
      <div className="space-y-3">
        {team.map(member => (
          <div key={member.id} className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                {member.avatar}
              </div>
              <div 
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`}
              />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{member.name}</div>
              <div className="text-xs text-gray-500">{member.role}</div>
            </div>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
