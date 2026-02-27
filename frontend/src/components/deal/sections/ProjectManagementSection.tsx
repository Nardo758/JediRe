/**
 * Project Management Section - Unified Timeline + Due Diligence
 * Consolidates task tracking, milestone management, and dependency visualization
 * 
 * Features:
 * - Three view modes: Checklist, Timeline (Gantt), Dependencies
 * - Context-aware: Pipeline (acquisition DD) vs Portfolio (operations)
 * - Integrated task management with timeline visualization
 * - Critical path tracking and blocker identification
 */

import React, { useState, useMemo } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  ProjectTask,
  ProjectOverview,
  acquisitionProjectTasks,
  acquisitionOverview,
  performanceProjectTasks,
  performanceOverview
} from '../../../data/projectManagementMockData';

interface ProjectManagementSectionProps {
  deal: Deal;
}

export const ProjectManagementSection: React.FC<ProjectManagementSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  
  // View state
  const [selectedView, setSelectedView] = useState<'checklist' | 'timeline' | 'dependencies'>('checklist');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showBlockersOnly, setShowBlockersOnly] = useState(false);

  // Select data based on mode
  const tasks = isPipeline ? acquisitionProjectTasks : performanceProjectTasks;
  const overview = isPipeline ? acquisitionOverview : performanceOverview;

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    
    if (showCriticalOnly) {
      filtered = filtered.filter(t => t.isCriticalPath);
    }
    
    if (showBlockersOnly) {
      filtered = filtered.filter(t => t.status === 'blocked' || t.redFlag?.status === 'open');
    }
    
    return filtered;
  }, [tasks, selectedCategory, showCriticalOnly, showBlockersOnly]);

  return (
    <div className="space-y-6">
      
      {/* Header: Mode Indicator & View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPipeline 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {isPipeline ? '📋 Acquisition Project Plan' : '🏢 Operations Management'}
          </div>
          {isPipeline && overview.daysToClosing && (
            <div className="text-xs text-gray-500">
              {overview.daysToClosing} days to closing • Target: {overview.targetDate}
            </div>
          )}
          {isOwned && overview.daysSinceAcquisition && (
            <div className="text-xs text-gray-500">
              Day {overview.daysSinceAcquisition} since acquisition
            </div>
          )}
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedView('checklist')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedView === 'checklist'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ✅ Checklist
            </button>
            <button
              onClick={() => setSelectedView('timeline')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedView === 'timeline'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Timeline
            </button>
            <button
              onClick={() => setSelectedView('dependencies')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                selectedView === 'dependencies'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔗 Dependencies
            </button>
          </div>
          
          <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            ➕ Add Task
          </button>
        </div>
      </div>

      {/* Overview Dashboard */}
      <OverviewDashboard overview={overview} isPipeline={isPipeline} />

      {/* Category Progress */}
      <CategoryProgressBar categories={overview.categoryProgress} />

      {/* Filter Bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <div className="flex gap-2">
          {['all', 'legal', 'financial', 'physical', 'environmental'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
              }`}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCriticalOnly}
              onChange={(e) => setShowCriticalOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-gray-600">Critical Path Only</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showBlockersOnly}
              onChange={(e) => setShowBlockersOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-gray-600">Blockers Only</span>
          </label>
          <div className="text-xs text-gray-500">
            {filteredTasks.length} of {tasks.length} tasks
          </div>
        </div>
      </div>

      {/* Main Content Views */}
      {selectedView === 'checklist' && (
        <ChecklistView tasks={filteredTasks} isPipeline={isPipeline} />
      )}
      
      {selectedView === 'timeline' && (
        <TimelineView tasks={filteredTasks} isPipeline={isPipeline} />
      )}
      
      {selectedView === 'dependencies' && (
        <DependenciesView tasks={tasks} overview={overview} isPipeline={isPipeline} />
      )}

    </div>
  );
};

// ==================== OVERVIEW DASHBOARD ====================

interface OverviewDashboardProps {
  overview: ProjectOverview;
  isPipeline: boolean;
}

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ overview, isPipeline }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Project Overview</h3>
      
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span className="font-medium">Overall Progress</span>
          <span className="font-semibold">
            {overview.completedTasks} of {overview.totalTasks} tasks complete ({overview.completionPercentage}%)
          </span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
            style={{ width: `${overview.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Completed"
          value={overview.completedTasks}
          icon="✅"
          color="green"
        />
        <StatCard
          label="In Progress"
          value={overview.inProgressTasks}
          icon="🔄"
          color="blue"
        />
        <StatCard
          label="Blocked"
          value={overview.blockedTasks}
          icon="🚫"
          color="red"
          alert={overview.blockedTasks > 0}
        />
        <StatCard
          label="Overdue"
          value={overview.overdueTasks}
          icon="⏰"
          color="orange"
          alert={overview.overdueTasks > 0}
        />
        <StatCard
          label={isPipeline ? "Days to Close" : "Days Owned"}
          value={isPipeline ? overview.daysToClosing : overview.daysSinceAcquisition}
          icon="📅"
          color="gray"
        />
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: string;
  color: 'green' | 'blue' | 'red' | 'orange' | 'gray';
  alert?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, alert }) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    red: 'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    gray: 'bg-gray-50 border-gray-200'
  };

  return (
    <div className={`border rounded-lg p-3 ${colorClasses[color]} ${alert ? 'ring-2 ring-red-500' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-2xl font-bold">{value || 0}</span>
      </div>
      <div className="text-xs font-medium text-gray-700">{label}</div>
    </div>
  );
};

// ==================== CATEGORY PROGRESS BAR ====================

interface CategoryProgressBarProps {
  categories: ProjectOverview['categoryProgress'];
}

const CategoryProgressBar: React.FC<CategoryProgressBarProps> = ({ categories }) => {
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      legal: '⚖️',
      financial: '💰',
      physical: '🏗️',
      environmental: '🌿'
    };
    return icons[category] || '📋';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Category Progress</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

// ==================== CHECKLIST VIEW ====================

interface ChecklistViewProps {
  tasks: ProjectTask[];
  isPipeline: boolean;
}

const ChecklistView: React.FC<ChecklistViewProps> = ({ tasks, isPipeline }) => {
  // Group by status
  const groupedTasks = useMemo(() => {
    return {
      blocked: tasks.filter(t => t.status === 'blocked'),
      inProgress: tasks.filter(t => t.status === 'in-progress'),
      pending: tasks.filter(t => t.status === 'pending' || t.status === 'upcoming'),
      complete: tasks.filter(t => t.status === 'complete' || t.status === 'completed')
    };
  }, [tasks]);

  return (
    <div className="space-y-4">
      
      {/* Blocked Tasks (Alert) */}
      {groupedTasks.blocked.length > 0 && (
        <TaskGroup
          title="🚫 Blocked"
          tasks={groupedTasks.blocked}
          defaultExpanded={true}
          alertColor="red"
        />
      )}

      {/* In Progress */}
      {groupedTasks.inProgress.length > 0 && (
        <TaskGroup
          title="🔄 In Progress"
          tasks={groupedTasks.inProgress}
          defaultExpanded={true}
        />
      )}

      {/* Pending/Upcoming */}
      {groupedTasks.pending.length > 0 && (
        <TaskGroup
          title="📅 Upcoming"
          tasks={groupedTasks.pending}
          defaultExpanded={true}
        />
      )}

      {/* Completed */}
      {groupedTasks.complete.length > 0 && (
        <TaskGroup
          title="✅ Completed"
          tasks={groupedTasks.complete}
          defaultExpanded={false}
        />
      )}

    </div>
  );
};

interface TaskGroupProps {
  title: string;
  tasks: ProjectTask[];
  defaultExpanded: boolean;
  alertColor?: 'red' | 'yellow';
}

const TaskGroup: React.FC<TaskGroupProps> = ({ title, tasks, defaultExpanded, alertColor }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${
      alertColor === 'red' ? 'border-red-300' : 
      alertColor === 'yellow' ? 'border-yellow-300' : 
      'border-gray-200'
    }`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
          alertColor === 'red' ? 'bg-red-50' : 
          alertColor === 'yellow' ? 'bg-yellow-50' : 
          'bg-gray-50'
        }`}
      >
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          {title}
          <span className="px-2 py-0.5 bg-white rounded text-xs font-normal text-gray-600 border border-gray-300">
            {tasks.length}
          </span>
        </h3>
        <span className="text-gray-400">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      
      {isExpanded && (
        <div className="p-4 space-y-3 border-t border-gray-200">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== TASK CARD ====================

interface TaskCardProps {
  task: ProjectTask;
  compact?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, compact = false }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (task.status) {
      case 'complete':
      case 'completed':
        return <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>;
      case 'in-progress':
        return <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white"></div>
        </div>;
      case 'blocked':
        return <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>;
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      legal: '⚖️',
      financial: '💰',
      physical: '🏗️',
      environmental: '🌿'
    };
    return icons[category] || '📋';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900 truncate">{task.title}</span>
            {task.isCriticalPath && (
              <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-700 bg-orange-100 rounded">
                Critical
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>📅 {task.dueDate}</span>
            <span>👤 {task.assignee}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border hover:border-gray-300 hover:shadow-md transition-all ${
      task.redFlag?.status === 'open' ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs">{getCategoryIcon(task.category)}</span>
                <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                {task.isCriticalPath && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-700 bg-orange-100 rounded">
                    Critical Path
                  </span>
                )}
                {task.type === 'milestone' && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded">
                    Milestone
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">{task.description}</p>
            </div>
          </div>

          {/* Progress Bar */}
          {task.progress !== undefined && task.progress > 0 && task.progress < 100 && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span className="font-medium">{task.progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    task.progress >= 80 ? 'bg-green-500' :
                    task.progress >= 50 ? 'bg-blue-500' :
                    'bg-yellow-500'
                  }`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 mb-2">
            <span className="capitalize">{task.category}</span>
            <span>👤 {task.assignee}</span>
            <span className={`font-medium ${
              task.status === 'overdue' || task.status === 'blocked' ? 'text-red-600' : ''
            }`}>
              📅 Due: {task.dueDate}
            </span>
            {task.completedDate && (
              <span className="text-green-600">✅ Completed: {task.completedDate}</span>
            )}
            {task.dependencies && task.dependencies.length > 0 && (
              <span>🔗 {task.dependencies.length} dependencies</span>
            )}
          </div>

          {/* Red Flag Alert */}
          {task.redFlag && task.redFlag.status === 'open' && (
            <div className="mb-3 px-3 py-2 bg-red-100 border border-red-300 rounded text-xs">
              <div className="flex items-center gap-2 text-red-800 font-medium mb-1">
                <span>🚩</span>
                <span className="uppercase">{task.redFlag.severity} Severity Red Flag</span>
              </div>
              <p className="text-red-700">{task.redFlag.description}</p>
            </div>
          )}

          {/* Notes */}
          {task.notes && (
            <div className="mb-2 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded">
              <span className="font-medium">Note:</span> {task.notes}
            </div>
          )}

          {/* Expand for Details */}
          {task.documents.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {expanded ? '↑ Hide Documents' : `↓ Show ${task.documents.length} Document(s)`}
              </button>
              
              {expanded && (
                <div className="mt-2 space-y-1">
                  {task.documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700">
                      <span>📄</span>
                      <a href={doc.url} className="hover:underline">{doc.name}</a>
                      <span className="text-gray-500">• {doc.uploadedAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== TIMELINE VIEW ====================

interface TimelineViewProps {
  tasks: ProjectTask[];
  isPipeline: boolean;
}

const TimelineView: React.FC<TimelineViewProps> = ({ tasks, isPipeline }) => {
  // Calculate date range
  const dateRange = useMemo(() => {
    const dates = tasks
      .filter(t => t.dueDate || t.startDate)
      .map(t => new Date(t.dueDate || t.startDate!).getTime());
    
    if (dates.length === 0) {
      return { minDate: new Date(), maxDate: new Date() };
    }
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    return { minDate, maxDate };
  }, [tasks]);

  const today = new Date();
  const { minDate, maxDate } = dateRange;
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

  const getPosition = (date: string) => {
    const taskDate = new Date(date);
    const days = Math.ceil((taskDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(100, (days / totalDays) * 100));
  };

  const todayPosition = getPosition(today.toISOString());

  const sortedTasks = [...tasks]
    .filter(t => t.dueDate || t.startDate)
    .sort((a, b) => {
      const dateA = new Date(a.startDate || a.dueDate).getTime();
      const dateB = new Date(b.startDate || b.dueDate).getTime();
      return dateA - dateB;
    });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Gantt Timeline</h3>
      
      {/* Timeline Header */}
      <div className="relative h-12 mb-6 border-b-2 border-gray-300">
        <div className="absolute inset-0 flex justify-between text-xs text-gray-500">
          <span>{minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>{maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
        
        {/* Today marker */}
        {todayPosition >= 0 && todayPosition <= 100 && (
          <div 
            className="absolute bottom-0 w-0.5 h-full bg-blue-600 z-10"
            style={{ left: `${todayPosition}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-blue-600 text-white text-xs rounded whitespace-nowrap">
              Today
            </div>
          </div>
        )}
      </div>

      {/* Task Rows */}
      <div className="space-y-2">
        {sortedTasks.map((task) => {
          const startPos = getPosition(task.startDate || task.dueDate);
          const endPos = task.endDate ? getPosition(task.endDate) : startPos;
          const width = Math.max(2, endPos - startPos);

          const barColor = 
            task.status === 'complete' || task.status === 'completed' ? 'bg-green-500' :
            task.status === 'in-progress' ? 'bg-blue-500' :
            task.status === 'blocked' ? 'bg-red-500' :
            task.status === 'overdue' ? 'bg-red-600' :
            'bg-gray-400';

          return (
            <div key={task.id} className="relative h-12 bg-gray-50 rounded border border-gray-200">
              
              {/* Task Bar */}
              <div 
                className={`absolute top-2 h-8 ${barColor} rounded shadow-sm hover:shadow-md transition-shadow cursor-pointer group`}
                style={{ 
                  left: `${startPos}%`, 
                  width: `${width}%`,
                  minWidth: '20px'
                }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="font-semibold">{task.title}</div>
                  <div className="text-gray-300 mt-1">
                    {task.startDate && `Start: ${task.startDate}`}
                  </div>
                  <div className="text-gray-300">
                    Due: {task.dueDate}
                  </div>
                  {task.progress !== undefined && (
                    <div className="text-gray-300">
                      Progress: {task.progress}%
                    </div>
                  )}
                </div>
                
                {/* Progress Fill */}
                {task.progress !== undefined && task.progress > 0 && task.progress < 100 && (
                  <div 
                    className="absolute inset-0 bg-white/30 rounded-l"
                    style={{ width: `${task.progress}%` }}
                  />
                )}
              </div>

              {/* Task Label */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {task.isCriticalPath && <span className="text-xs">🎯</span>}
                <span className="text-xs font-medium text-gray-700 truncate max-w-[150px]">
                  {task.title}
                </span>
              </div>

              {/* Date on right */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== DEPENDENCIES VIEW ====================

interface DependenciesViewProps {
  tasks: ProjectTask[];
  overview: ProjectOverview;
  isPipeline: boolean;
}

const DependenciesView: React.FC<DependenciesViewProps> = ({ tasks, overview, isPipeline }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Critical Path Items */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
          <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
            <span>🎯</span>
            Critical Path ({overview.criticalPathTasks.length})
          </h3>
        </div>
        <div className="p-4">
          {overview.criticalPathTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm">All critical path items complete!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overview.criticalPathTasks.map(task => (
                <TaskCard key={task.id} task={task} compact />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Blockers */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
            <span>🚫</span>
            Blockers & Red Flags ({overview.blockers.length})
          </h3>
        </div>
        <div className="p-4">
          {overview.blockers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm">No blockers or red flags!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overview.blockers.map(task => (
                <TaskCard key={task.id} task={task} compact />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Completions */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-green-50 border-b border-green-200">
          <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
            <span>✅</span>
            Recent Completions ({overview.recentCompletions.length})
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {overview.recentCompletions.map(task => (
              <TaskCard key={task.id} task={task} compact />
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
            <span>📅</span>
            Upcoming Deadlines ({overview.upcomingDeadlines.length})
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {overview.upcomingDeadlines.map(task => (
              <TaskCard key={task.id} task={task} compact />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default ProjectManagementSection;
