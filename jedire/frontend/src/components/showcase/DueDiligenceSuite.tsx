import React, { useState } from 'react';

interface DDTask {
  id: string;
  title: string;
  category: string;
  status: 'pending' | 'in-progress' | 'completed' | 'na';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  riskLevel: 'low' | 'medium' | 'high';
  aiGenerated: boolean;
}

export function DueDiligenceSuite() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const tasks: DDTask[] = [
    // Financial (8 tasks)
    { id: 'f1', title: 'Review 3-year operating statements', category: 'Financial', status: 'completed', priority: 'high', assignee: 'You', dueDate: '2025-02-15', riskLevel: 'high', aiGenerated: true },
    { id: 'f2', title: 'Verify rent roll accuracy', category: 'Financial', status: 'completed', priority: 'high', assignee: 'You', riskLevel: 'high', aiGenerated: true },
    { id: 'f3', title: 'Analyze expense trends', category: 'Financial', status: 'in-progress', priority: 'medium', assignee: 'Sarah', dueDate: '2025-02-18', riskLevel: 'medium', aiGenerated: true },
    { id: 'f4', title: 'Review property tax assessments', category: 'Financial', status: 'pending', priority: 'medium', riskLevel: 'medium', aiGenerated: false },
    { id: 'f5', title: 'Validate utility expenses', category: 'Financial', status: 'pending', priority: 'low', riskLevel: 'low', aiGenerated: true },
    { id: 'f6', title: 'Check insurance claim history', category: 'Financial', status: 'completed', priority: 'medium', riskLevel: 'medium', aiGenerated: false },
    { id: 'f7', title: 'Analyze capital expenditure history', category: 'Financial', status: 'in-progress', priority: 'high', assignee: 'You', dueDate: '2025-02-20', riskLevel: 'high', aiGenerated: true },
    { id: 'f8', title: 'Review reserve fund adequacy', category: 'Financial', status: 'pending', priority: 'medium', riskLevel: 'medium', aiGenerated: true },
    
    // Legal (7 tasks)
    { id: 'l1', title: 'Title search and review', category: 'Legal', status: 'completed', priority: 'high', assignee: 'Attorney', riskLevel: 'high', aiGenerated: true },
    { id: 'l2', title: 'Review all leases', category: 'Legal', status: 'in-progress', priority: 'high', assignee: 'Attorney', dueDate: '2025-02-17', riskLevel: 'high', aiGenerated: true },
    { id: 'l3', title: 'Check for liens and encumbrances', category: 'Legal', status: 'completed', priority: 'high', riskLevel: 'high', aiGenerated: true },
    { id: 'l4', title: 'Review HOA documents', category: 'Legal', status: 'pending', priority: 'medium', riskLevel: 'medium', aiGenerated: false },
    { id: 'l5', title: 'Verify zoning compliance', category: 'Legal', status: 'in-progress', priority: 'high', assignee: 'Attorney', dueDate: '2025-02-19', riskLevel: 'high', aiGenerated: true },
    { id: 'l6', title: 'Review service contracts', category: 'Legal', status: 'pending', priority: 'low', riskLevel: 'low', aiGenerated: false },
    { id: 'l7', title: 'Check for pending litigation', category: 'Legal', status: 'completed', priority: 'high', riskLevel: 'high', aiGenerated: true },
    
    // Property (10 tasks)
    { id: 'p1', title: 'Full property inspection', category: 'Property', status: 'completed', priority: 'high', assignee: 'Inspector', riskLevel: 'high', aiGenerated: true },
    { id: 'p2', title: 'Roof inspection', category: 'Property', status: 'completed', priority: 'high', riskLevel: 'high', aiGenerated: true },
    { id: 'p3', title: 'HVAC system evaluation', category: 'Property', status: 'completed', priority: 'high', riskLevel: 'high', aiGenerated: true },
    { id: 'p4', title: 'Plumbing assessment', category: 'Property', status: 'in-progress', priority: 'medium', assignee: 'Inspector', dueDate: '2025-02-16', riskLevel: 'medium', aiGenerated: true },
    { id: 'p5', title: 'Electrical system review', category: 'Property', status: 'in-progress', priority: 'medium', assignee: 'Inspector', dueDate: '2025-02-16', riskLevel: 'medium', aiGenerated: true },
    { id: 'p6', title: 'Foundation inspection', category: 'Property', status: 'pending', priority: 'high', riskLevel: 'high', aiGenerated: true },
    { id: 'p7', title: 'Structural engineer report', category: 'Property', status: 'pending', priority: 'high', dueDate: '2025-02-22', riskLevel: 'high', aiGenerated: true },
    { id: 'p8', title: 'Pool and amenity inspection', category: 'Property', status: 'pending', priority: 'low', riskLevel: 'low', aiGenerated: false },
    { id: 'p9', title: 'Parking lot assessment', category: 'Property', status: 'pending', priority: 'medium', riskLevel: 'medium', aiGenerated: false },
    { id: 'p10', title: 'Landscaping evaluation', category: 'Property', status: 'completed', priority: 'low', riskLevel: 'low', aiGenerated: false },
    
    // Environmental (8 tasks)
    { id: 'e1', title: 'Phase I Environmental Assessment', category: 'Environmental', status: 'completed', priority: 'high', assignee: 'Environmental', riskLevel: 'high', aiGenerated: true },
    { id: 'e2', title: 'Asbestos inspection', category: 'Environmental', status: 'completed', priority: 'high', riskLevel: 'high', aiGenerated: true },
    { id: 'e3', title: 'Lead paint assessment', category: 'Environmental', status: 'completed', priority: 'high', riskLevel: 'high', aiGenerated: true },
    { id: 'e4', title: 'Mold inspection', category: 'Environmental', status: 'in-progress', priority: 'medium', assignee: 'Environmental', dueDate: '2025-02-17', riskLevel: 'medium', aiGenerated: true },
    { id: 'e5', title: 'Radon testing', category: 'Environmental', status: 'pending', priority: 'low', riskLevel: 'low', aiGenerated: false },
    { id: 'e6', title: 'Soil contamination check', category: 'Environmental', status: 'pending', priority: 'medium', riskLevel: 'medium', aiGenerated: true },
    { id: 'e7', title: 'Underground storage tank review', category: 'Environmental', status: 'na', priority: 'medium', riskLevel: 'medium', aiGenerated: false },
    { id: 'e8', title: 'Wetlands determination', category: 'Environmental', status: 'na', priority: 'low', riskLevel: 'low', aiGenerated: false },
    
    // Market (7 tasks)
    { id: 'm1', title: 'Market rent analysis', category: 'Market', status: 'completed', priority: 'high', assignee: 'You', riskLevel: 'high', aiGenerated: true },
    { id: 'm2', title: 'Comparable sales review', category: 'Market', status: 'completed', priority: 'high', riskLevel: 'high', aiGenerated: true },
    { id: 'm3', title: 'Submarket analysis', category: 'Market', status: 'in-progress', priority: 'medium', assignee: 'You', dueDate: '2025-02-19', riskLevel: 'medium', aiGenerated: true },
    { id: 'm4', title: 'Supply pipeline assessment', category: 'Market', status: 'pending', priority: 'high', riskLevel: 'high', aiGenerated: true },
    { id: 'm5', title: 'Demographics study', category: 'Market', status: 'pending', priority: 'medium', riskLevel: 'medium', aiGenerated: false },
    { id: 'm6', title: 'Employment trends analysis', category: 'Market', status: 'completed', priority: 'medium', riskLevel: 'medium', aiGenerated: true },
    { id: 'm7', title: 'Traffic and transportation review', category: 'Market', status: 'pending', priority: 'low', riskLevel: 'low', aiGenerated: false }
  ];

  const categories = ['all', ...Array.from(new Set(tasks.map(t => t.category)))];
  
  const filteredTasks = selectedCategory === 'all' 
    ? tasks 
    : tasks.filter(t => t.category === selectedCategory);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'na': return 'bg-gray-50 text-gray-500 border-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const categoryStats = categories.slice(1).map(cat => {
    const catTasks = tasks.filter(t => t.category === cat);
    const completed = catTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    return {
      category: cat,
      total: catTasks.length,
      completed,
      percentage: Math.round((completed / catTasks.length) * 100),
      risk: catTasks.filter(t => t.riskLevel === 'high' && t.status !== 'completed').length
    };
  });

  const overallCompletion = Math.round((tasks.filter(t => t.status === 'completed' || t.status === 'na').length / tasks.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Due Diligence Suite</h2>
          <p className="text-sm text-gray-600 mt-1">Smart checklist with 40+ contextual tasks • {overallCompletion}% complete</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-blue-600">{overallCompletion}%</div>
          <div className="text-xs text-gray-500">Overall Progress</div>
        </div>
      </div>

      {/* Category Progress Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {categoryStats.map(stat => (
          <div
            key={stat.category}
            onClick={() => setSelectedCategory(stat.category)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedCategory === stat.category
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <h4 className="font-semibold text-gray-900 text-sm mb-2">{stat.category}</h4>
            <div className="text-2xl font-bold text-gray-900 mb-1">{stat.percentage}%</div>
            <div className="text-xs text-gray-500 mb-2">{stat.completed}/{stat.total} tasks</div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${stat.percentage}%` }}
              />
            </div>
            {stat.risk > 0 && (
              <div className="mt-2 text-xs text-red-600 font-semibold">
                ⚠️ {stat.risk} high-risk open
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat === 'all' ? 'All Tasks' : cat}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`p-4 border-2 rounded-lg ${getStatusColor(task.status)} transition-all hover:shadow-md`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={task.status === 'completed'}
                className="mt-1 w-5 h-5 rounded border-gray-300"
                readOnly
              />
              
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-600' : 'text-gray-900'}`}>
                        {task.title}
                      </h4>
                      {task.aiGenerated && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                          ✨ AI
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getRiskColor(task.riskLevel)}`}>
                        {task.riskLevel} risk
                      </span>
                      {task.priority === 'high' && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">
                          High Priority
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <span className="capitalize">{task.category}</span>
                      {task.assignee && <span>👤 {task.assignee}</span>}
                      {task.dueDate && (
                        <span>📅 Due {new Date(task.dueDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <span className={`px-3 py-1 text-xs rounded-full font-semibold capitalize ${getStatusColor(task.status)}`}>
                    {task.status === 'na' ? 'N/A' : task.status.replace('-', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Risk Dashboard */}
      <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg">
        <h3 className="font-semibold text-red-900 mb-4">High-Risk Open Items</h3>
        <div className="grid gap-2">
          {tasks.filter(t => t.riskLevel === 'high' && t.status !== 'completed' && t.status !== 'na').map(task => (
            <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded border border-red-200">
              <span className="font-medium text-gray-900">{task.title}</span>
              <span className="text-sm text-gray-600">{task.category}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
