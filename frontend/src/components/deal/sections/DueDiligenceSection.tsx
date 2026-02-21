/**
 * Due Diligence Section - Dual-Mode (Acquisition & Performance)
 * Switches content based on deal status:
 * - pipeline → Acquisition mode: DD checklist, inspections, red flags
 * - owned → Performance mode: Ongoing compliance, audits, remediation
 */

import React, { useState, useMemo } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionDDStats,
  acquisitionChecklist,
  acquisitionInspections,
  performanceDDStats,
  performanceChecklist,
  performanceInspections,
  DDChecklistItem,
  DDInspection,
  DDStat
} from '../../../data/dueDiligenceMockData';

interface DueDiligenceSectionProps {
  deal: Deal;
}

export const DueDiligenceSection: React.FC<DueDiligenceSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  // Select data based on mode
  const stats = isPipeline ? acquisitionDDStats : performanceDDStats;
  const checklist = isPipeline ? acquisitionChecklist : performanceChecklist;
  const inspections = isPipeline ? acquisitionInspections : performanceInspections;

  // Filter checklist
  const filteredChecklist = useMemo(() => {
    let items = checklist;
    
    if (selectedCategory !== 'all') {
      items = items.filter(item => item.category === selectedCategory);
    }
    
    if (showCriticalOnly) {
      items = items.filter(item => item.isCriticalPath);
    }
    
    return items;
  }, [checklist, selectedCategory, showCriticalOnly]);

  // Calculate category progress
  const categoryProgress = useMemo(() => {
    const categories = ['legal', 'financial', 'physical', 'environmental'];
    return categories.map(category => {
      const items = checklist.filter(item => item.category === category);
      const completed = items.filter(item => item.status === 'complete').length;
      const total = items.length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return {
        category,
        label: category.charAt(0).toUpperCase() + category.slice(1),
        completed,
        total,
        percentage,
        color: getCategoryColor(category)
      };
    });
  }, [checklist]);

  // Get red flags
  const redFlags = useMemo(() => {
    return checklist.filter(item => item.redFlag && item.redFlag.status === 'open');
  }, [checklist]);

  // Get critical path items
  const criticalItems = useMemo(() => {
    return checklist.filter(item => item.isCriticalPath && item.status !== 'complete');
  }, [checklist]);

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPipeline 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {isPipeline ? '✅ Acquisition DD Mode' : '📋 Performance Compliance Mode'}
        </div>
        {isPipeline && (
          <div className="text-xs text-gray-500">
            DD Period: Day 18 of 60 • Contingency Expires: Mar 15, 2024
          </div>
        )}
      </div>

      {/* Quick Stats Cards */}
      <QuickStatsGrid stats={stats} />

      {/* Category Progress Bars */}
      <CategoryProgressSection categories={categoryProgress} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Checklist (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <ChecklistSection
            checklist={filteredChecklist}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            showCriticalOnly={showCriticalOnly}
            setShowCriticalOnly={setShowCriticalOnly}
            mode={mode}
          />
        </div>

        {/* Right Column: Red Flags & Critical Items (1/3 width) */}
        <div className="space-y-4">
          <RedFlagsPanel redFlags={redFlags} mode={mode} />
          <CriticalItemsPanel criticalItems={criticalItems} mode={mode} />
          <InspectionsPanel inspections={inspections} mode={mode} />
        </div>
      </div>

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: DDStat[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className={`text-2xl font-bold mb-1 ${
              stat.color === 'red' ? 'text-red-600' :
              stat.color === 'yellow' ? 'text-yellow-600' :
              stat.color === 'orange' ? 'text-orange-600' :
              stat.color === 'blue' ? 'text-blue-600' :
              'text-gray-900'
            }`}>
              {stat.value}
            </div>
            {stat.trend && (
              <div className={`flex items-center gap-1 text-xs font-medium ${
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

interface CategoryProgressSectionProps {
  categories: Array<{
    category: string;
    label: string;
    completed: number;
    total: number;
    percentage: number;
    color: string;
  }>;
}

const CategoryProgressSection: React.FC<CategoryProgressSectionProps> = ({ categories }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Category Progress</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <div key={cat.category}>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
              <span className="font-medium flex items-center gap-2">
                <span>{getCategoryIcon(cat.category)}</span>
                {cat.label}
              </span>
              <span className="font-semibold">{cat.completed}/{cat.total}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${cat.color} rounded-full transition-all`}
                style={{ width: `${cat.percentage}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">{cat.percentage}%</div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ChecklistSectionProps {
  checklist: DDChecklistItem[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  showCriticalOnly: boolean;
  setShowCriticalOnly: (show: boolean) => void;
  mode: 'acquisition' | 'performance';
}

const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  checklist,
  selectedCategory,
  setSelectedCategory,
  showCriticalOnly,
  setShowCriticalOnly,
  mode
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      
      {/* Header with Filters */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            {mode === 'acquisition' ? 'DD Checklist' : 'Compliance Checklist'}
          </h3>
          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            + Add Item
          </button>
        </div>
        
        {/* Filter Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            {['all', 'legal', 'financial', 'physical', 'environmental'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
          
          <label className="flex items-center gap-2 ml-auto">
            <input
              type="checkbox"
              checked={showCriticalOnly}
              onChange={(e) => setShowCriticalOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-gray-600">Critical Path Only</span>
          </label>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="divide-y divide-gray-200 max-h-[800px] overflow-y-auto">
        {checklist.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">No items match the current filters</p>
          </div>
        ) : (
          checklist.map((item) => <ChecklistItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
};

interface ChecklistItemProps {
  item: DDChecklistItem;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
      item.redFlag ? 'bg-red-50/30' : ''
    }`}>
      <div className="flex items-start gap-3">
        
        {/* Status Checkbox */}
        <div className="flex-shrink-0 mt-1">
          {item.status === 'complete' ? (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : item.status === 'in-progress' ? (
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white"></div>
            </div>
          ) : item.status === 'blocked' ? (
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-gray-900">{item.title}</h4>
                {item.isCriticalPath && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-700 bg-orange-100 rounded">
                    Critical
                  </span>
                )}
                {item.redFlag && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold text-red-700 bg-red-100 rounded flex items-center gap-1">
                    🚩 Red Flag
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mb-2">{item.description}</p>
              
              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span>{getCategoryIcon(item.category)}</span>
                  <span className="capitalize">{item.category}</span>
                </span>
                <span>👤 {item.assignee}</span>
                <span className={`${isOverdue(item.dueDate, item.status) ? 'text-red-600 font-medium' : ''}`}>
                  📅 {item.status === 'complete' ? `Done ${item.completedDate}` : `Due ${item.dueDate}`}
                </span>
                {item.documents.length > 0 && (
                  <span>📎 {item.documents.length} doc{item.documents.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Red Flag Alert */}
              {item.redFlag && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                    <span className="text-sm">🚩</span>
                    <span className="uppercase text-xs">{item.redFlag.severity} Severity</span>
                  </div>
                  <p className="text-red-700">{item.redFlag.description}</p>
                </div>
              )}

              {/* Expandable Details */}
              {(item.notes || item.documents.length > 0) && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {expanded ? '↑ Hide Details' : '↓ Show Details'}
                </button>
              )}

              {expanded && (
                <div className="mt-3 space-y-2">
                  {item.notes && (
                    <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded">
                      <span className="font-medium">Notes:</span> {item.notes}
                    </div>
                  )}
                  {item.documents.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-700">Documents:</div>
                      {item.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700">
                          <span>📄</span>
                          <a href={doc.url} className="hover:underline">{doc.name}</a>
                          <span className="text-gray-500">• {doc.uploadedAt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div>
              <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeClass(item.status)}`}>
                {item.status === 'complete' ? 'Complete' :
                 item.status === 'in-progress' ? 'In Progress' :
                 item.status === 'blocked' ? 'Blocked' :
                 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface RedFlagsPanelProps {
  redFlags: DDChecklistItem[];
  mode: 'acquisition' | 'performance';
}

const RedFlagsPanel: React.FC<RedFlagsPanelProps> = ({ redFlags, mode }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-red-50 border-b border-red-200">
        <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
          <span>🚩</span>
          Red Flags ({redFlags.length})
        </h3>
      </div>
      <div className="p-4">
        {redFlags.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <div className="text-2xl mb-2">✅</div>
            <p className="text-xs">No active red flags</p>
          </div>
        ) : (
          <div className="space-y-3">
            {redFlags.map((item) => (
              <div key={item.id} className="border border-red-200 rounded-lg p-3 bg-red-50/50">
                <div className="flex items-start gap-2">
                  <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                    item.redFlag?.severity === 'high' ? 'bg-red-600 text-white' :
                    item.redFlag?.severity === 'medium' ? 'bg-orange-500 text-white' :
                    'bg-yellow-500 text-white'
                  }`}>
                    {item.redFlag?.severity?.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-medium text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-xs text-gray-700">{item.redFlag?.description}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="capitalize">{item.category}</span> • {item.assignee}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface CriticalItemsPanelProps {
  criticalItems: DDChecklistItem[];
  mode: 'acquisition' | 'performance';
}

const CriticalItemsPanel: React.FC<CriticalItemsPanelProps> = ({ criticalItems, mode }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
        <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
          <span>⚡</span>
          Critical Path Items ({criticalItems.length})
        </h3>
      </div>
      <div className="p-4">
        {criticalItems.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-xs">All critical items complete!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {criticalItems.slice(0, 8).map((item) => (
              <div key={item.id} className="border border-gray-200 rounded p-2 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.status === 'in-progress' ? 'bg-blue-500' :
                    item.status === 'blocked' ? 'bg-red-500' :
                    'bg-gray-300'
                  }`} />
                  <h4 className="text-xs font-medium text-gray-900 flex-1">{item.title}</h4>
                </div>
                <div className="text-xs text-gray-500 ml-4">
                  <span className={`${isOverdue(item.dueDate, item.status) ? 'text-red-600 font-medium' : ''}`}>
                    Due {item.dueDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface InspectionsPanelProps {
  inspections: DDInspection[];
  mode: 'acquisition' | 'performance';
}

const InspectionsPanel: React.FC<InspectionsPanelProps> = ({ inspections, mode }) => {
  const completed = inspections.filter(i => i.status === 'completed').length;
  const total = inspections.length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
        <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
          <span>🔍</span>
          {mode === 'acquisition' ? 'Inspections' : 'Audits'} ({completed}/{total})
        </h3>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {inspections.map((inspection) => (
            <div key={inspection.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-900">{inspection.type}</h4>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  inspection.status === 'completed' ? 'bg-green-100 text-green-700' :
                  inspection.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {inspection.status === 'completed' ? 'Done' :
                   inspection.status === 'in-progress' ? 'In Progress' :
                   'Scheduled'}
                </span>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div>📅 {inspection.status === 'completed' ? inspection.completedDate : inspection.scheduledDate}</div>
                <div>👤 {inspection.inspector}</div>
                <div>💰 ${inspection.cost.toLocaleString()}</div>
              </div>

              {inspection.findings && inspection.findings.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-1">Findings:</div>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {inspection.findings.slice(0, 2).map((finding, idx) => (
                      <li key={idx}>• {finding}</li>
                    ))}
                  </ul>
                  {inspection.reportUrl && (
                    <a href={inspection.reportUrl} className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-block">
                      View Full Report →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== HELPER FUNCTIONS ====================

const getCategoryColor = (category: string): string => {
  const colors = {
    legal: 'bg-blue-600',
    financial: 'bg-green-600',
    physical: 'bg-purple-600',
    environmental: 'bg-orange-600'
  };
  return colors[category as keyof typeof colors] || 'bg-gray-600';
};

const getCategoryIcon = (category: string): string => {
  const icons = {
    legal: '⚖️',
    financial: '💰',
    physical: '🏗️',
    environmental: '🌿'
  };
  return icons[category as keyof typeof icons] || '📋';
};

const getStatusBadgeClass = (status: string): string => {
  const classes = {
    complete: 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    blocked: 'bg-red-100 text-red-700',
    pending: 'bg-gray-100 text-gray-700'
  };
  return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-700';
};

const isOverdue = (dueDate: string, status: string): boolean => {
  if (status === 'complete') return false;
  const due = new Date(dueDate);
  const today = new Date();
  return due < today;
};

export default DueDiligenceSection;
