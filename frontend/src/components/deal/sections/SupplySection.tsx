/**
 * Supply Section - Dual-Mode Pipeline Analysis
 * - Acquisition Mode: Future supply impact, delivery timeline, absorption
 * - Performance Mode: New competition tracking, market saturation alerts
 */

import React, { useState, useMemo } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionPipelineProjects,
  acquisitionSupplyStats,
  performancePipelineProjects,
  performanceSupplyStats,
  PipelineProject,
  ProjectStatus,
  ImpactLevel,
  SupplyStats,
  getProjectsByStatus,
  getProjectsByDistance,
  getProjectsDeliveringInMonths,
  calculateSupplyImpact,
  getStatusColor,
  getImpactColor,
  getImpactBadge
} from '../../../data/supplyMockData';

interface SupplySectionProps {
  deal: Deal;
}

export const SupplySection: React.FC<SupplySectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  
  // Select data based on mode
  const projects = isPipeline ? acquisitionPipelineProjects : performancePipelineProjects;
  const stats = isPipeline ? acquisitionSupplyStats : performanceSupplyStats;
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [distanceFilter, setDistanceFilter] = useState<number>(5); // miles
  const [showCompetitiveOnly, setShowCompetitiveOnly] = useState<boolean>(false);
  
  // Filtered projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    if (statusFilter !== 'all') {
      filtered = getProjectsByStatus(filtered, statusFilter);
    }
    
    filtered = getProjectsByDistance(filtered, distanceFilter);
    
    if (showCompetitiveOnly) {
      filtered = filtered.filter(p => p.competitive);
    }
    
    return filtered;
  }, [projects, statusFilter, distanceFilter, showCompetitiveOnly]);
  
  // Calculate supply impact
  const supplyImpact = useMemo(() => {
    return calculateSupplyImpact(projects, [1, 3, 5]);
  }, [projects]);
  
  // Projects delivering in next 12 months
  const projectsDelivering12mo = useMemo(() => {
    return getProjectsDeliveringInMonths(projects, 12);
  }, [projects]);
  
  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPipeline 
            ? 'bg-orange-100 text-orange-700' 
            : 'bg-purple-100 text-purple-700'
        }`}>
          {isPipeline ? '🏗️ Acquisition: Supply Impact Analysis' : '🎯 Performance: Competition Tracking'}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={stats} mode={mode} />

      {/* Supply Impact Calculator */}
      <SupplyImpactCard 
        supplyImpact={supplyImpact} 
        totalUnits={stats.totalPipelineUnits}
        mode={mode}
      />

      {/* Filters */}
      <FilterBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        distanceFilter={distanceFilter}
        setDistanceFilter={setDistanceFilter}
        showCompetitiveOnly={showCompetitiveOnly}
        setShowCompetitiveOnly={setShowCompetitiveOnly}
        totalProjects={projects.length}
        filteredCount={filteredProjects.length}
      />

      {/* Delivery Timeline Chart */}
      <DeliveryTimelineChart 
        projects={projectsDelivering12mo}
        mode={mode}
      />

      {/* Pipeline Projects Grid */}
      <PipelineProjectsGrid 
        projects={filteredProjects}
        mode={mode}
      />

      {/* Market Insights */}
      <MarketInsightsCard 
        stats={stats}
        projects={projects}
        mode={mode}
      />
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: SupplyStats;
  mode: 'acquisition' | 'performance';
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats, mode }) => {
  const statItems = [
    {
      label: 'Total Pipeline Units',
      value: stats.totalPipelineUnits.toLocaleString(),
      icon: '🏗️',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      label: 'Units Within 3 Miles',
      value: stats.unitsWithin3Miles.toLocaleString(),
      icon: '📍',
      color: 'bg-purple-50 border-purple-200'
    },
    {
      label: 'Delivering in 12 Months',
      value: stats.unitsDelivering12Months.toLocaleString(),
      icon: '📅',
      color: 'bg-orange-50 border-orange-200'
    },
    {
      label: 'Direct Competitors',
      value: stats.directCompetitors.toString(),
      icon: '🎯',
      color: 'bg-red-50 border-red-200'
    },
    {
      label: 'Avg Distance',
      value: `${stats.averageDistanceToCompetition.toFixed(1)} mi`,
      icon: '📏',
      color: 'bg-green-50 border-green-200'
    }
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {mode === 'acquisition' ? 'Supply Overview' : 'Competition Overview'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statItems.map((stat, index) => (
          <div 
            key={index}
            className={`${stat.color} border rounded-lg p-4 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-xs font-medium">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SupplyImpactCardProps {
  supplyImpact: Record<string, number>;
  totalUnits: number;
  mode: 'acquisition' | 'performance';
}

const SupplyImpactCard: React.FC<SupplyImpactCardProps> = ({ supplyImpact, totalUnits, mode }) => {
  const getImpactSeverity = (units: number, distance: number): ImpactLevel => {
    if (distance <= 1 && units > 500) return 'high';
    if (distance <= 3 && units > 1200) return 'high';
    if (distance <= 1 && units > 200) return 'medium';
    if (distance <= 3 && units > 600) return 'medium';
    return 'low';
  };

  const impactData = [
    {
      distance: '1 mile',
      units: supplyImpact['1mi'] || 0,
      severity: getImpactSeverity(supplyImpact['1mi'] || 0, 1)
    },
    {
      distance: '3 miles',
      units: supplyImpact['3mi'] || 0,
      severity: getImpactSeverity(supplyImpact['3mi'] || 0, 3)
    },
    {
      distance: '5 miles',
      units: supplyImpact['5mi'] || 0,
      severity: getImpactSeverity(supplyImpact['5mi'] || 0, 5)
    }
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span>📊</span>
        {mode === 'acquisition' ? 'Supply Impact Calculator' : 'Competitive Pressure Analysis'}
      </h3>
      
      <div className="grid grid-cols-3 gap-6">
        {impactData.map((item, index) => (
          <div key={index} className="text-center">
            <div className="text-sm text-gray-600 mb-2">Within {item.distance}</div>
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {item.units.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mb-3">units</div>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getImpactColor(item.severity)}`}>
              {getImpactBadge(item.severity)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Pipeline Units:</span>
            <span className="font-bold text-gray-900 ml-2">{totalUnits.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-600">Market Saturation Risk:</span>
            <span className={`font-bold ml-2 ${
              supplyImpact['3mi'] > 1500 ? 'text-red-600' :
              supplyImpact['3mi'] > 1000 ? 'text-yellow-600' :
              'text-green-600'
            }`}>
              {supplyImpact['3mi'] > 1500 ? 'High' :
               supplyImpact['3mi'] > 1000 ? 'Medium' :
               'Low'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FilterBarProps {
  statusFilter: ProjectStatus | 'all';
  setStatusFilter: (filter: ProjectStatus | 'all') => void;
  distanceFilter: number;
  setDistanceFilter: (distance: number) => void;
  showCompetitiveOnly: boolean;
  setShowCompetitiveOnly: (show: boolean) => void;
  totalProjects: number;
  filteredCount: number;
}

const FilterBar: React.FC<FilterBarProps> = ({
  statusFilter,
  setStatusFilter,
  distanceFilter,
  setDistanceFilter,
  showCompetitiveOnly,
  setShowCompetitiveOnly,
  totalProjects,
  filteredCount
}) => {
  const statusOptions: Array<{ value: ProjectStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All Status' },
    { value: 'planned', label: 'Planned' },
    { value: 'under-construction', label: 'Under Construction' },
    { value: 'pre-leasing', label: 'Pre-Leasing' },
    { value: 'delivered', label: 'Delivered' }
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-4 flex-wrap">
        
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Distance Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Max Distance:</label>
          <select
            value={distanceFilter}
            onChange={(e) => setDistanceFilter(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={1}>Within 1 mile</option>
            <option value={3}>Within 3 miles</option>
            <option value={5}>Within 5 miles</option>
            <option value={10}>Within 10 miles</option>
          </select>
        </div>

        {/* Competitive Only Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showCompetitiveOnly}
            onChange={(e) => setShowCompetitiveOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Direct Competitors Only</span>
        </label>

        {/* Results Count */}
        <div className="ml-auto text-sm text-gray-600">
          Showing <span className="font-bold text-gray-900">{filteredCount}</span> of {totalProjects} projects
        </div>
      </div>
    </div>
  );
};

interface DeliveryTimelineChartProps {
  projects: PipelineProject[];
  mode: 'acquisition' | 'performance';
}

const DeliveryTimelineChart: React.FC<DeliveryTimelineChartProps> = ({ projects, mode }) => {
  // Group projects by quarter
  const projectsByQuarter = useMemo(() => {
    const grouped: Record<string, PipelineProject[]> = {};
    
    projects.forEach(project => {
      const quarter = project.deliveryQuarter;
      if (!grouped[quarter]) {
        grouped[quarter] = [];
      }
      grouped[quarter].push(project);
    });
    
    return grouped;
  }, [projects]);

  const quarters = Object.keys(projectsByQuarter).sort();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span>📅</span>
        {mode === 'acquisition' ? 'Delivery Timeline (Next 12 Months)' : 'New Competition Timeline'}
      </h3>
      
      <div className="space-y-4">
        {quarters.map((quarter, index) => {
          const quarterProjects = projectsByQuarter[quarter];
          const totalUnits = quarterProjects.reduce((sum, p) => sum + p.units, 0);
          const competitiveUnits = quarterProjects.filter(p => p.competitive).reduce((sum, p) => sum + p.units, 0);
          
          return (
            <div key={quarter}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900 w-16">{quarter}</span>
                  <span className="text-xs text-gray-600">
                    {quarterProjects.length} projects • {totalUnits.toLocaleString()} units
                    {competitiveUnits > 0 && (
                      <span className="text-red-600 font-semibold ml-2">
                        ({competitiveUnits.toLocaleString()} competitive)
                      </span>
                    )}
                  </span>
                </div>
              </div>
              
              {/* Timeline bar */}
              <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${Math.min((totalUnits / 500) * 100, 100)}%` }}
                >
                  {totalUnits.toLocaleString()}
                </div>
              </div>
              
              {/* Project pills */}
              <div className="mt-2 flex flex-wrap gap-2">
                {quarterProjects.map(project => (
                  <div 
                    key={project.id}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      project.competitive 
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    {project.name} ({project.units})
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {quarters.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No projects delivering in the next 12 months</p>
        </div>
      )}
    </div>
  );
};

interface PipelineProjectsGridProps {
  projects: PipelineProject[];
  mode: 'acquisition' | 'performance';
}

const PipelineProjectsGrid: React.FC<PipelineProjectsGridProps> = ({ projects, mode }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {mode === 'acquisition' ? 'Pipeline Projects' : 'Competitive Properties'}
      </h3>
      
      {projects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No projects match the current filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
};

interface ProjectCardProps {
  project: PipelineProject;
  mode: 'acquisition' | 'performance';
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, mode }) => {
  return (
    <div className={`border-2 rounded-lg p-4 hover:shadow-lg transition-shadow ${
      project.competitive 
        ? 'border-red-200 bg-red-50' 
        : 'border-gray-200 bg-white'
    }`}>
      
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-gray-900 text-sm mb-1">{project.name}</h4>
          <p className="text-xs text-gray-600">{project.developer}</p>
        </div>
        {project.competitive && (
          <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">
            🎯 Direct
          </span>
        )}
      </div>

      {/* Key Metrics */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Units:</span>
          <span className="font-bold text-gray-900">{project.units.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Distance:</span>
          <span className="font-bold text-gray-900">{project.distance.toFixed(1)} mi</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Delivery:</span>
          <span className="font-bold text-gray-900">{project.deliveryQuarter}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Rent Range:</span>
          <span className="font-bold text-gray-900">
            ${project.rentRange.min.toLocaleString()} - ${project.rentRange.max.toLocaleString()}
          </span>
        </div>
        {project.percentLeased !== undefined && project.percentLeased > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Leased:</span>
            <span className="font-bold text-gray-900">{project.percentLeased}%</span>
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="mb-3">
        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(project.status)}`}>
          {project.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </span>
      </div>

      {/* Impact Level */}
      <div className={`border-t pt-3 ${project.competitive ? 'border-red-200' : 'border-gray-200'}`}>
        <div className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getImpactColor(project.impactLevel)}`}>
          {getImpactBadge(project.impactLevel)}
        </div>
      </div>

      {/* Amenities (small preview) */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-600 line-clamp-2">
          {project.amenities.slice(0, 3).join(' • ')}
          {project.amenities.length > 3 && ` +${project.amenities.length - 3} more`}
        </div>
      </div>
    </div>
  );
};

interface MarketInsightsCardProps {
  stats: SupplyStats;
  projects: PipelineProject[];
  mode: 'acquisition' | 'performance';
}

const MarketInsightsCard: React.FC<MarketInsightsCardProps> = ({ stats, projects, mode }) => {
  const insights = useMemo(() => {
    const result: Array<{ type: 'warning' | 'success' | 'info'; message: string }> = [];
    
    // Supply concentration
    if (stats.unitsWithin3Miles > 1500) {
      result.push({
        type: 'warning',
        message: `High supply concentration: ${stats.unitsWithin3Miles.toLocaleString()} units within 3 miles indicates potential oversupply risk.`
      });
    } else if (stats.unitsWithin3Miles < 800) {
      result.push({
        type: 'success',
        message: `Favorable supply conditions: Only ${stats.unitsWithin3Miles.toLocaleString()} units within 3 miles suggests healthy market dynamics.`
      });
    }
    
    // Near-term delivery pressure
    if (stats.unitsDelivering12Months > 800) {
      result.push({
        type: 'warning',
        message: `${stats.unitsDelivering12Months.toLocaleString()} units delivering in next 12 months. Monitor absorption rates closely.`
      });
    }
    
    // Direct competition
    if (stats.directCompetitors >= 6) {
      result.push({
        type: 'warning',
        message: `${stats.directCompetitors} direct competitors may pressure rents and occupancy. Consider differentiation strategy.`
      });
    } else if (stats.directCompetitors <= 3) {
      result.push({
        type: 'success',
        message: `Limited direct competition (${stats.directCompetitors} projects) provides pricing flexibility.`
      });
    }
    
    // Average distance
    if (stats.averageDistanceToCompetition < 1.0) {
      result.push({
        type: 'info',
        message: `Competition is very close (avg ${stats.averageDistanceToCompetition.toFixed(1)} mi). Location and amenities will be critical differentiators.`
      });
    }
    
    return result;
  }, [stats]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span>💡</span>
        {mode === 'acquisition' ? 'Market Insights & Recommendations' : 'Competitive Analysis'}
      </h3>
      
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg border-l-4 ${
              insight.type === 'warning' 
                ? 'bg-yellow-50 border-yellow-500' 
                : insight.type === 'success'
                ? 'bg-green-50 border-green-500'
                : 'bg-blue-50 border-blue-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">
                {insight.type === 'warning' ? '⚠️' : insight.type === 'success' ? '✅' : 'ℹ️'}
              </span>
              <p className="text-sm text-gray-700">
                {insight.message}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Action Items */}
      <div className="mt-6 pt-6 border-t border-blue-200">
        <h4 className="text-sm font-bold text-gray-900 mb-3">
          {mode === 'acquisition' ? 'Recommended Actions:' : 'Strategic Considerations:'}
        </h4>
        <ul className="space-y-2 text-sm text-gray-700">
          {mode === 'acquisition' ? (
            <>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Monitor absorption rates of nearby deliveries to validate demand assumptions</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Conduct competitive amenity analysis to identify differentiation opportunities</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Model conservative lease-up scenarios accounting for competition</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Consider phased delivery to match market absorption capacity</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Review retention strategies to minimize tenant turnover to new competition</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Evaluate capital improvement opportunities to maintain competitive position</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Monitor competitor lease-up velocity and concession packages</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Adjust marketing and pricing strategies based on new supply deliveries</span>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default SupplySection;
