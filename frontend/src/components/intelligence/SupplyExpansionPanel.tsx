/**
 * Supply Expansion Panel
 * 
 * When user clicks on "2,400 units under construction", this panel shows:
 * - Individual projects with specs
 * - Breakdown by submarket, quarter, developer, class
 * - Data gaps that need filling
 * - Action buttons to trigger research
 */

import React, { useState } from 'react';
import { X, Building2, Calendar, Users, AlertTriangle, Search, ChevronDown, ChevronUp, MapPin, Clock, TrendingUp } from 'lucide-react';
import type { SupplyPipelineData, DevelopmentProject, DataGap } from '../../hooks/useContextAwareness';

interface SupplyExpansionPanelProps {
  data: SupplyPipelineData;
  marketName?: string;
  submarketName?: string;
  onClose: () => void;
  onTriggerResearch?: (gaps: DataGap[]) => void;
  onProjectClick?: (project: DevelopmentProject) => void;
}

type ViewMode = 'projects' | 'bySubmarket' | 'byQuarter' | 'byDeveloper';

const STATUS_COLORS: Record<string, string> = {
  planned: '#9CA3AF',
  permitted: '#F59E0B',
  under_construction: '#3B82F6',
  lease_up: '#10B981',
  completed: '#6B7280'
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  permitted: 'Permitted',
  under_construction: 'Under Construction',
  lease_up: 'Lease-Up',
  completed: 'Completed'
};

const CLASS_COLORS: Record<string, string> = {
  A: '#10B981',
  B: '#3B82F6',
  C: '#F59E0B',
  Unknown: '#9CA3AF'
};

export const SupplyExpansionPanel: React.FC<SupplyExpansionPanelProps> = ({
  data,
  marketName,
  submarketName,
  onClose,
  onTriggerResearch,
  onProjectClick
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('projects');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [showGaps, setShowGaps] = useState(false);

  const criticalGaps = data.gaps?.filter(g => g.relevance === 'critical') || [];
  const hasGaps = criticalGaps.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[90vw] max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-xl font-semibold text-white">
                Supply Pipeline
                {submarketName && <span className="text-blue-200 ml-2">· {submarketName}</span>}
              </h2>
              <p className="text-blue-200 text-sm">
                {data.totalUnits.toLocaleString()} units across {data.projects.length} projects
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Alert for data gaps */}
        {hasGaps && (
          <div 
            className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between cursor-pointer"
            onClick={() => setShowGaps(!showGaps)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="text-amber-800 dark:text-amber-200 font-medium">
                {criticalGaps.length} critical data gaps
              </span>
              <span className="text-amber-600 dark:text-amber-400 text-sm">
                — {criticalGaps[0]?.userQuestion}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onTriggerResearch && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTriggerResearch(criticalGaps);
                  }}
                  className="px-3 py-1 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"
                >
                  <Search className="w-4 h-4 inline mr-1" />
                  Research Now
                </button>
              )}
              {showGaps ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
            </div>
          </div>
        )}

        {/* Expanded gaps view */}
        {showGaps && (
          <div className="px-6 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800">
            <div className="space-y-2">
              {criticalGaps.map(gap => (
                <div key={gap.id} className="flex items-center justify-between py-2 border-b border-amber-100 dark:border-amber-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{gap.userQuestion}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{gap.analystThought}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    gap.relevance === 'critical' ? 'bg-red-100 text-red-700' :
                    gap.relevance === 'important' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {gap.relevance}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 grid grid-cols-4 gap-4">
          <SummaryCard 
            label="By Submarket" 
            count={data.summary.submarketCount}
            detail={data.summary.topSubmarkets[0]?.name || '-'}
            detailValue={data.summary.topSubmarkets[0]?.units}
          />
          <SummaryCard 
            label="Delivery Timeline" 
            count={Object.keys(data.byQuarter).length}
            detail={data.summary.deliveryTimeline[0]?.quarter || '-'}
            detailValue={data.summary.deliveryTimeline[0]?.units}
          />
          <SummaryCard 
            label="Top Developer" 
            count={Object.keys(data.byDeveloper).length}
            detail={data.summary.topDevelopers[0]?.name || '-'}
            detailValue={data.summary.topDevelopers[0]?.units}
          />
          <SummaryCard 
            label="By Class" 
            count={Object.keys(data.byClass).length}
            detail={`Class A: ${data.byClass.A?.units || 0}`}
          />
        </div>

        {/* View mode tabs */}
        <div className="px-6 py-2 border-b border-gray-200 dark:border-gray-700 flex gap-2">
          {(['projects', 'bySubmarket', 'byQuarter', 'byDeveloper'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {mode === 'projects' && 'Projects'}
              {mode === 'bySubmarket' && 'By Submarket'}
              {mode === 'byQuarter' && 'By Quarter'}
              {mode === 'byDeveloper' && 'By Developer'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'projects' && (
            <ProjectsView 
              projects={data.projects}
              expandedProject={expandedProject}
              onToggleExpand={setExpandedProject}
              onProjectClick={onProjectClick}
            />
          )}
          
          {viewMode === 'bySubmarket' && (
            <BreakdownView 
              data={data.bySubmarket}
              labelKey="Submarket"
              icon={<MapPin className="w-4 h-4" />}
            />
          )}
          
          {viewMode === 'byQuarter' && (
            <BreakdownView 
              data={data.byQuarter}
              labelKey="Quarter"
              icon={<Calendar className="w-4 h-4" />}
              sorted
            />
          )}
          
          {viewMode === 'byDeveloper' && (
            <BreakdownView 
              data={data.byDeveloper}
              labelKey="Developer"
              icon={<Users className="w-4 h-4" />}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const SummaryCard: React.FC<{
  label: string;
  count: number;
  detail?: string;
  detailValue?: number;
}> = ({ label, count, detail, detailValue }) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
    {detail && (
      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
        {detail}
        {detailValue && <span className="text-blue-600 ml-1">({detailValue.toLocaleString()})</span>}
      </p>
    )}
  </div>
);

const ProjectsView: React.FC<{
  projects: DevelopmentProject[];
  expandedProject: string | null;
  onToggleExpand: (id: string | null) => void;
  onProjectClick?: (project: DevelopmentProject) => void;
}> = ({ projects, expandedProject, onToggleExpand, onProjectClick }) => (
  <div className="space-y-3">
    {projects.map(project => (
      <div 
        key={project.id}
        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
      >
        {/* Project header */}
        <div 
          className="p-4 flex items-center justify-between cursor-pointer"
          onClick={() => onToggleExpand(expandedProject === project.id ? null : project.id)}
        >
          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[project.constructionStatus] }}
              title={STATUS_LABELS[project.constructionStatus]}
            />
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {project.name}
                {project.gaps.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                    {project.gaps.length} gaps
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                {project.address || project.submarket}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-right">
            {/* Units */}
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{project.units}</p>
              <p className="text-xs text-gray-500">units</p>
            </div>

            {/* Class badge */}
            {project.assetClass && (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: CLASS_COLORS[project.assetClass] || CLASS_COLORS.Unknown }}
              >
                {project.assetClass}
              </div>
            )}

            {/* Delivery */}
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {project.deliveryQuarter || 'TBD'}
              </p>
              <p className="text-xs text-gray-500">delivery</p>
            </div>

            {/* Expand icon */}
            {expandedProject === project.id 
              ? <ChevronUp className="w-5 h-5 text-gray-400" />
              : <ChevronDown className="w-5 h-5 text-gray-400" />
            }
          </div>
        </div>

        {/* Expanded details */}
        {expandedProject === project.id && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Developer</p>
                <p className="font-medium text-gray-900 dark:text-white">{project.developer || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Stories</p>
                <p className="font-medium text-gray-900 dark:text-white">{project.stories || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Target Rent</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {project.targetRents ? `$${project.targetRents.toLocaleString()}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Pre-Leasing</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {project.preLeasingPct ? `${project.preLeasingPct}%` : '-'}
                </p>
              </div>
            </div>

            {/* Data gaps for this project */}
            {project.gaps.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                  Missing Data:
                </p>
                <div className="flex flex-wrap gap-1">
                  {project.gaps.map(gap => (
                    <span 
                      key={gap}
                      className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded"
                    >
                      {gap.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => onProjectClick?.(project)}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Details
              </button>
              <span className={`px-2 py-1 text-xs rounded ${
                project.dataFreshness === 'fresh' ? 'bg-green-100 text-green-700' :
                project.dataFreshness === 'stale' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {project.dataFreshness}
              </span>
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
);

const BreakdownView: React.FC<{
  data: Record<string, { units: number; projects: number }>;
  labelKey: string;
  icon?: React.ReactNode;
  sorted?: boolean;
}> = ({ data, labelKey, icon, sorted }) => {
  const entries = Object.entries(data);
  
  if (sorted) {
    entries.sort(([a], [b]) => a.localeCompare(b));
  } else {
    entries.sort(([, a], [, b]) => b.units - a.units);
  }

  const maxUnits = Math.max(...entries.map(([, v]) => v.units));

  return (
    <div className="space-y-2">
      {entries.map(([name, stats]) => (
        <div 
          key={name}
          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center gap-4"
        >
          <div className="text-gray-400 dark:text-gray-500">
            {icon}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900 dark:text-white">{name}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {stats.units.toLocaleString()} units · {stats.projects} project{stats.projects !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(stats.units / maxUnits) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SupplyExpansionPanel;
