/**
 * Timeline Section - Example Usage
 * Demonstrates how to integrate the TimelineSection into your deal pages
 */

import React from 'react';
import { TimelineSection } from './TimelineSection';
import { Deal } from '../../../types/deal';

// ==================== EXAMPLE 1: Basic Usage ====================

export const BasicTimelineExample: React.FC = () => {
  // Mock deal in pipeline (acquisition mode)
  const pipelineDeal: Deal = {
    id: '1',
    name: 'Sunset Plaza Apartments',
    projectType: 'Multifamily',
    tier: 'A',
    status: 'pipeline',
    budget: 45000000,
    boundary: null,
    acres: 5.2,
    propertyCount: 1,
    pendingTasks: 8,
    createdAt: '2024-01-05',
    propertyAddress: '1234 Sunset Blvd, Los Angeles, CA 90028'
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Deal Timeline - Acquisition Mode</h1>
      <TimelineSection deal={pipelineDeal} />
    </div>
  );
};

// ==================== EXAMPLE 2: Performance Mode ====================

export const PerformanceTimelineExample: React.FC = () => {
  // Mock deal that's owned (performance mode)
  const ownedDeal: Deal = {
    id: '2',
    name: 'Harbor View Office Complex',
    projectType: 'Office',
    tier: 'A',
    status: 'owned',
    budget: 52000000,
    boundary: null,
    acres: 8.5,
    propertyCount: 2,
    pendingTasks: 5,
    createdAt: '2023-01-15',
    actualCloseDate: '2023-01-15',
    propertyAddress: '5678 Harbor Drive, San Diego, CA 92101'
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Property Timeline - Performance Mode</h1>
      <TimelineSection deal={ownedDeal} />
    </div>
  );
};

// ==================== EXAMPLE 3: In Tab Navigation ====================

export const TimelineTabExample: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState('overview');
  
  const deal: Deal = {
    id: '3',
    name: 'Tech Tower',
    projectType: 'Office',
    tier: 'A',
    status: 'pipeline',
    budget: 38000000,
    boundary: null,
    acres: 3.2,
    propertyCount: 1,
    pendingTasks: 12,
    createdAt: '2024-01-10',
    propertyAddress: '999 Innovation Way, San Francisco, CA 94107'
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
    { id: 'financial', label: 'Financial', icon: '💰' },
    { id: 'market', label: 'Market', icon: '📈' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{deal.name}</h1>
          <p className="text-sm text-gray-500">{deal.propertyAddress}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Overview Content</h2>
            <p className="text-gray-600">Overview section content here...</p>
          </div>
        )}
        
        {activeTab === 'timeline' && (
          <TimelineSection deal={deal} />
        )}
        
        {activeTab === 'financial' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Financial Content</h2>
            <p className="text-gray-600">Financial section content here...</p>
          </div>
        )}
        
        {activeTab === 'market' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Market Content</h2>
            <p className="text-gray-600">Market section content here...</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== EXAMPLE 4: With Custom Actions ====================

export const TimelineWithActionsExample: React.FC = () => {
  const deal: Deal = {
    id: '4',
    name: 'Marina Bay Retail',
    projectType: 'Retail',
    tier: 'B',
    status: 'pipeline',
    budget: 28000000,
    boundary: null,
    acres: 2.8,
    propertyCount: 1,
    pendingTasks: 6,
    createdAt: '2024-01-15',
    propertyAddress: '1500 Marina Blvd, Marina del Rey, CA 90292'
  };

  const handleExport = () => {
    console.log('Exporting timeline...');
    // Implement export logic
  };

  const handleAddMilestone = () => {
    console.log('Adding new milestone...');
    // Implement add milestone modal
  };

  return (
    <div className="p-6">
      {/* Custom Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{deal.name} - Timeline</h1>
          <p className="text-sm text-gray-500 mt-1">Track milestones and critical deadlines</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            📥 Export Timeline
          </button>
          <button
            onClick={handleAddMilestone}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ➕ Add Milestone
          </button>
        </div>
      </div>

      {/* Timeline Section */}
      <TimelineSection deal={deal} />
    </div>
  );
};

// ==================== EXAMPLE 5: Side-by-Side Comparison ====================

export const DualTimelineExample: React.FC = () => {
  const acquisitionDeal: Deal = {
    id: '5',
    name: 'Parkside Apartments',
    projectType: 'Multifamily',
    tier: 'A',
    status: 'pipeline',
    budget: 42000000,
    boundary: null,
    acres: 4.5,
    propertyCount: 1,
    pendingTasks: 10,
    createdAt: '2024-01-20',
    propertyAddress: '789 Park Avenue, Denver, CO 80203'
  };

  const performanceDeal: Deal = {
    id: '6',
    name: 'Riverside Offices',
    projectType: 'Office',
    tier: 'A',
    status: 'owned',
    budget: 55000000,
    boundary: null,
    acres: 7.2,
    propertyCount: 3,
    pendingTasks: 4,
    createdAt: '2022-06-15',
    actualCloseDate: '2022-06-15',
    propertyAddress: '2000 Riverside Dr, Austin, TX 78701'
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Timeline Comparison: Acquisition vs Performance</h1>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Acquisition Mode */}
        <div>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-lg font-semibold text-blue-900">🎯 Acquisition Mode</h2>
            <p className="text-sm text-blue-700 mt-1">Pre-close deal tracking</p>
          </div>
          <TimelineSection deal={acquisitionDeal} />
        </div>

        {/* Performance Mode */}
        <div>
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="text-lg font-semibold text-green-900">🏢 Performance Mode</h2>
            <p className="text-sm text-green-700 mt-1">Post-close asset management</p>
          </div>
          <TimelineSection deal={performanceDeal} />
        </div>
      </div>
    </div>
  );
};

// ==================== EXAMPLE 6: Integration with DealSection ====================

export const DealSectionTimelineExample: React.FC = () => {
  const deal: Deal = {
    id: '7',
    name: 'Downtown Business Park',
    projectType: 'Mixed-Use',
    tier: 'A',
    status: 'pipeline',
    budget: 65000000,
    boundary: null,
    acres: 12.5,
    propertyCount: 5,
    pendingTasks: 15,
    createdAt: '2024-02-01',
    propertyAddress: '100 Commerce Street, Seattle, WA 98101'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Deal Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{deal.name}</h1>
              <div className="flex items-center gap-4 text-sm">
                <span>📍 {deal.propertyAddress}</span>
                <span>•</span>
                <span>💰 ${(deal.budget / 1000000).toFixed(1)}M</span>
                <span>•</span>
                <span>📏 {deal.acres} acres</span>
                <span>•</span>
                <span>🏢 {deal.propertyCount} properties</span>
              </div>
            </div>
            <div className="px-4 py-2 bg-white bg-opacity-20 rounded-lg">
              <div className="text-xs uppercase font-semibold">Status</div>
              <div className="text-lg font-bold capitalize">{deal.status}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <TimelineSection deal={deal} />
      </div>
    </div>
  );
};

// ==================== Export All Examples ====================

export const TimelineExamples = {
  BasicTimelineExample,
  PerformanceTimelineExample,
  TimelineTabExample,
  TimelineWithActionsExample,
  DualTimelineExample,
  DealSectionTimelineExample
};

export default TimelineExamples;
