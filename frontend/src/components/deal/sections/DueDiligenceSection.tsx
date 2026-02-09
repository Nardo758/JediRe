import React, { useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, Square, ChevronDown, ChevronUp, Plus, FileText, Calendar } from 'lucide-react';
import { ModuleUpsellBanner } from './ModuleUpsellBanner';
import { Button } from '../../shared/Button';

interface DueDiligenceSectionProps {
  deal: any;
  enhanced: boolean;
  onToggleModule: (moduleSlug: string) => void;
}

interface Task {
  id: string;
  name: string;
  status: 'complete' | 'in-progress' | 'overdue' | 'pending';
  dueDate?: string;
}

interface Category {
  id: string;
  name: string;
  tasks: Task[];
  riskScore: number;
  expanded: boolean;
}

const basicTasks = [
  { id: '1', name: 'Review financials', completed: false },
  { id: '2', name: 'Inspect property', completed: false },
  { id: '3', name: 'Title search', completed: false },
  { id: '4', name: 'Environmental assessment', completed: false },
  { id: '5', name: 'Zoning verification', completed: false },
  { id: '6', name: 'Review leases', completed: false },
  { id: '7', name: 'Insurance review', completed: false },
  { id: '8', name: 'Appraisal', completed: false }
];

const enhancedCategories: Category[] = [
  {
    id: 'financial',
    name: 'Financial Due Diligence',
    expanded: false,
    riskScore: 2.1,
    tasks: [
      { id: 'f1', name: 'Review last 3 years P&L statements', status: 'complete' },
      { id: 'f2', name: 'Analyze rent roll (current)', status: 'complete' },
      { id: 'f3', name: 'Verify operating expenses', status: 'complete' },
      { id: 'f4', name: 'Review capital expenditure history', status: 'complete' },
      { id: 'f5', name: 'Confirm property taxes', status: 'complete' },
      { id: 'f6', name: 'Review tenant payment history', status: 'in-progress', dueDate: '3 days' },
      { id: 'f7', name: 'Verify insurance costs', status: 'pending' },
      { id: 'f8', name: 'Analyze utility expenses', status: 'pending' }
    ]
  },
  {
    id: 'physical',
    name: 'Physical Inspection',
    expanded: false,
    riskScore: 7.3,
    tasks: [
      { id: 'p1', name: 'Schedule property inspection', status: 'complete' },
      { id: 'p2', name: 'Review existing inspection reports', status: 'complete' },
      { id: 'p3', name: 'Walk all units (sample 20%)', status: 'complete' },
      { id: 'p4', name: 'Inspect common areas', status: 'complete' },
      { id: 'p5', name: 'HVAC system inspection', status: 'overdue', dueDate: 'OVERDUE 2 days' },
      { id: 'p6', name: 'Roof inspection', status: 'pending' },
      { id: 'p7', name: 'Plumbing system review', status: 'pending' },
      { id: 'p8', name: 'Electrical system review', status: 'pending' },
      { id: 'p9', name: 'Foundation inspection', status: 'pending' },
      { id: 'p10', name: 'Parking lot/garage inspection', status: 'pending' },
      { id: 'p11', name: 'Pool/amenities inspection', status: 'pending' },
      { id: 'p12', name: 'Landscaping assessment', status: 'pending' }
    ]
  },
  {
    id: 'legal',
    name: 'Legal & Title',
    expanded: false,
    riskScore: 4.5,
    tasks: [
      { id: 'l1', name: 'Order title search', status: 'complete' },
      { id: 'l2', name: 'Review preliminary title report', status: 'complete' },
      { id: 'l3', name: 'Resolve title issues', status: 'in-progress', dueDate: '5 days' },
      { id: 'l4', name: 'Survey property boundaries', status: 'pending' },
      { id: 'l5', name: 'Review deed restrictions', status: 'pending' },
      { id: 'l6', name: 'Confirm zoning compliance', status: 'pending' }
    ]
  },
  {
    id: 'environmental',
    name: 'Environmental',
    expanded: false,
    riskScore: 1.8,
    tasks: [
      { id: 'e1', name: 'Phase I Environmental Assessment', status: 'complete' },
      { id: 'e2', name: 'Review environmental reports', status: 'complete' },
      { id: 'e3', name: 'Asbestos inspection', status: 'pending' },
      { id: 'e4', name: 'Lead paint testing', status: 'pending' }
    ]
  },
  {
    id: 'tenant',
    name: 'Tenant Relations',
    expanded: false,
    riskScore: 3.2,
    tasks: [
      { id: 't1', name: 'Review all lease agreements', status: 'complete' },
      { id: 't2', name: 'Tenant satisfaction survey', status: 'in-progress', dueDate: '7 days' },
      { id: 't3', name: 'Review tenant complaints history', status: 'pending' },
      { id: 't4', name: 'Verify security deposits', status: 'pending' }
    ]
  },
  {
    id: 'compliance',
    name: 'Compliance & Regulatory',
    expanded: false,
    riskScore: 5.8,
    tasks: [
      { id: 'c1', name: 'Building code compliance review', status: 'complete' },
      { id: 'c2', name: 'Fire safety inspection', status: 'in-progress', dueDate: '4 days' },
      { id: 'c3', name: 'ADA compliance audit', status: 'pending' },
      { id: 'c4', name: 'Certificate of occupancy verification', status: 'pending' },
      { id: 'c5', name: 'HOA/condo association review', status: 'pending' }
    ]
  }
];

const criticalDates = [
  { name: 'HVAC inspection', status: 'overdue', days: 'OVERDUE by 2 days', color: 'text-red-600' },
  { name: 'Tenant payment review', status: 'upcoming', days: 'Due in 3 days', color: 'text-yellow-600' },
  { name: 'Title issue resolution', status: 'upcoming', days: 'Due in 5 days', color: 'text-yellow-600' },
  { name: 'Appraisal', status: 'scheduled', days: 'Scheduled for Feb 15', color: 'text-green-600' }
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'complete':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'in-progress':
      return <Clock className="w-5 h-5 text-blue-600" />;
    case 'overdue':
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    default:
      return <Square className="w-5 h-5 text-gray-400" />;
  }
};

const getRiskLabel = (score: number): string => {
  if (score <= 3) return 'LOW';
  if (score <= 6) return 'MEDIUM';
  return 'HIGH';
};

const getRiskColor = (score: number): string => {
  if (score <= 3) return 'text-green-600 bg-green-100';
  if (score <= 6) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
};

export function DueDiligenceSection({ deal, enhanced, onToggleModule }: DueDiligenceSectionProps) {
  const [basicTasksState, setBasicTasksState] = useState(basicTasks);
  const [categories, setCategories] = useState(enhancedCategories);

  const handleAddModule = () => {
    onToggleModule('dd-suite-pro');
  };

  const handleUpgradeBundle = () => {
    console.log('Upgrade to bundle');
  };

  const handleLearnMore = () => {
    console.log('Learn more about DD Suite Pro');
  };

  const toggleBasicTask = (taskId: string) => {
    setBasicTasksState(basicTasksState.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const toggleCategory = (categoryId: string) => {
    setCategories(categories.map(cat =>
      cat.id === categoryId ? { ...cat, expanded: !cat.expanded } : cat
    ));
  };

  const completedBasicTasks = basicTasksState.filter(t => t.completed).length;
  const totalBasicTasks = basicTasksState.length;
  const basicProgress = Math.round((completedBasicTasks / totalBasicTasks) * 100);

  const getTotalTasks = () => {
    return categories.reduce((sum, cat) => sum + cat.tasks.length, 0);
  };

  const getCompletedTasks = () => {
    return categories.reduce((sum, cat) => 
      sum + cat.tasks.filter(t => t.status === 'complete').length, 0
    );
  };

  const overallProgress = Math.round((getCompletedTasks() / getTotalTasks()) * 100);
  const overallRiskScore = (categories.reduce((sum, cat) => sum + cat.riskScore, 0) / categories.length).toFixed(1);

  // BASIC VERSION
  if (!enhanced) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Due Diligence</h2>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Checklist</h3>
          
          <div className="space-y-3 mb-6">
            {basicTasksState.map((task) => (
              <label 
                key={task.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleBasicTask(task.id)}
                  className="w-5 h-5"
                />
                <span className={`flex-1 ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                  {task.name}
                </span>
                {task.completed && <CheckCircle className="w-5 h-5 text-green-600" />}
              </label>
            ))}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-semibold text-gray-900">{completedBasicTasks}/{totalBasicTasks} complete ({basicProgress}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${basicProgress}%` }}
              />
            </div>
          </div>
        </div>

        <ModuleUpsellBanner
          moduleName="Due Diligence Suite Pro"
          price="$39"
          benefits={[
            'Smart checklists (auto-generated based on deal type)',
            'Risk scoring (quantify DD risk across 12 categories)',
            'Automated document review (AI extraction & validation)',
            'Property condition integration',
            'Critical dates & deadline management',
            'Task assignment and team collaboration'
          ]}
          bundleInfo={{
            name: 'Flipper Bundle',
            price: '$89',
            savings: '20%'
          }}
          onAddModule={handleAddModule}
          onUpgradeBundle={handleUpgradeBundle}
          onLearnMore={handleLearnMore}
        />
      </div>
    );
  }

  // ENHANCED VERSION
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <CheckCircle className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Due Diligence</h2>
        <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
          DD Suite Pro Active
        </span>
      </div>

      {/* Overall Progress & Risk Score */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Smart Checklist (Multifamily Value-Add)
          </h3>
          <span className="text-sm text-gray-600">
            Auto-generated {getTotalTasks()} tasks based on your deal type and strategy
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-semibold text-gray-900">
                {getCompletedTasks()}/{getTotalTasks()} complete ({overallProgress}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Risk Score</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">{overallRiskScore}/10</span>
                <span className={`px-3 py-1 text-xs font-medium rounded ${getRiskColor(Number(overallRiskScore))}`}>
                  {getRiskLabel(Number(overallRiskScore))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Checklists */}
      <div className="space-y-4">
        {categories.map((category) => {
          const completedInCategory = category.tasks.filter(t => t.status === 'complete').length;
          const totalInCategory = category.tasks.length;
          const categoryProgress = Math.round((completedInCategory / totalInCategory) * 100);

          return (
            <div key={category.id} className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    {category.expanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                    <h4 className="text-lg font-semibold text-gray-900">{category.name}</h4>
                  </div>
                  
                  <span className="text-sm text-gray-600">
                    ({completedInCategory}/{totalInCategory} complete)
                  </span>
                  
                  <div className="flex-1 max-w-xs">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${categoryProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-xs font-medium rounded ${getRiskColor(category.riskScore)}`}>
                    Risk: {getRiskLabel(category.riskScore)} ({category.riskScore}/10)
                  </span>
                </div>
              </button>

              {category.expanded && (
                <div className="border-t border-gray-200 p-4">
                  <div className="space-y-2">
                    {category.tasks.map((task) => (
                      <div 
                        key={task.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {getStatusIcon(task.status)}
                          <span className={`${task.status === 'complete' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {task.name}
                          </span>
                        </div>
                        
                        {task.dueDate && (
                          <span className={`text-sm font-medium ${
                            task.status === 'overdue' ? 'text-red-600' : 
                            task.status === 'in-progress' ? 'text-yellow-600' : 
                            'text-gray-600'
                          }`}>
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">
                      <strong>Risk Assessment:</strong> {
                        category.riskScore <= 3 ? 'Historical data verified, low concerns.' :
                        category.riskScore <= 6 ? 'Some items need attention, moderate risk.' :
                        'Critical items outstanding, high risk area.'
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Risk Breakdown Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{category.name}:</span>
              <span className={`px-2 py-1 text-xs font-medium rounded ${getRiskColor(category.riskScore)}`}>
                {getRiskLabel(category.riskScore)} ({category.riskScore}/10)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Critical Dates */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Critical Dates</h3>
        </div>
        
        <div className="space-y-3">
          {criticalDates.map((date, index) => (
            <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-gray-900">{date.name}</span>
              <span className={`font-medium ${date.color}`}>
                {date.status === 'overdue' && <AlertTriangle className="w-4 h-4 inline mr-2" />}
                {date.days}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="default">
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
        <Button variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Export DD Report
        </Button>
        <Button variant="ghost">
          Share with Team
        </Button>
      </div>
    </div>
  );
}
