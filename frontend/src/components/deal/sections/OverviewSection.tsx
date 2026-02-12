/**
 * Overview Section - JEDI RE Enhanced Deal Page
 * Complete overview with stats, map, actions, timeline, and team
 */

import React from 'react';
import { Deal } from '../../../types/deal';

interface OverviewSectionProps {
  deal: Deal;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ deal }) => {
  // Mock data - replace with real data later
  const stats = {
    properties: deal.propertyCount || 12,
    budget: deal.budget || 45000000,
    status: deal.stage || 'Active',
    timeline: deal.timelineEstimate || '18 months',
    teamSize: deal.teamSize || 8
  };

  const quickActions = [
    { id: 'find-properties', label: 'Find Properties', icon: '🏢', color: 'blue' },
    { id: 'run-analysis', label: 'Run Analysis', icon: '📊', color: 'purple' },
    { id: 'generate-report', label: 'Generate Report', icon: '📄', color: 'green' }
  ];

  const recentActivity = [
    { id: 1, type: 'update', text: 'Deal stage updated to Due Diligence', time: '2 hours ago', user: 'Leon D' },
    { id: 2, type: 'document', text: 'Phase I Environmental Report uploaded', time: '5 hours ago', user: 'Sarah Johnson' },
    { id: 3, type: 'note', text: 'Meeting notes added from broker call', time: '1 day ago', user: 'Leon D' }
  ];

  const keyTeam = [
    { id: 1, name: 'Leon D', role: 'Lead', avatar: 'LD', status: 'online' },
    { id: 2, name: 'Sarah Johnson', role: 'Analyst', avatar: 'SJ', status: 'online' },
    { id: 3, name: 'John Smith', role: 'Broker', avatar: 'JS', status: 'offline' }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Active': 'bg-green-100 text-green-800',
      'Due Diligence': 'bg-blue-100 text-blue-800',
      'Under Contract': 'bg-purple-100 text-purple-800',
      'Closed': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      
      {/* Quick Stats Cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Properties */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Properties</span>
              <span className="text-2xl">🏢</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.properties}</div>
          </div>

          {/* Budget */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Budget</span>
              <span className="text-2xl">💰</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.budget)}</div>
          </div>

          {/* Status */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Status</span>
              <span className="text-2xl">📊</span>
            </div>
            <div className="mt-2">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(stats.status)}`}>
                {stats.status}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Timeline</span>
              <span className="text-2xl">⏱️</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.timeline}</div>
          </div>

          {/* Team Size */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Team</span>
              <span className="text-2xl">👥</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.teamSize} members</div>
          </div>
        </div>
      </div>

      {/* Main content row: Map + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Map View (2/3 width) */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span>🗺️</span> Interactive Map
              </h3>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">
                  View Full
                </button>
              </div>
            </div>
            <div className="relative bg-gray-100 h-96">
              {/* Map will be integrated here */}
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">🗺️</div>
                  <p className="text-sm font-medium">Interactive map showing:</p>
                  <ul className="text-xs mt-2 space-y-1">
                    <li>• Deal boundary</li>
                    <li>• Property locations</li>
                    <li>• Nearby points of interest</li>
                    <li>• Trade area & submarket</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions (1/3 width) */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-${action.color}-300 hover:bg-${action.color}-50 transition-all text-left group`}
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Deal Progress */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Deal Progress</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Due Diligence</span>
                  <span>65%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Financing</span>
                  <span>40%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Legal Review</span>
                  <span>80%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Recent Activity + Key Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Recent Activity</h3>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentActivity.map(activity => (
              <div key={activity.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex-shrink-0 mt-1">
                  {activity.type === 'update' && <span className="text-blue-500">🔄</span>}
                  {activity.type === 'document' && <span className="text-green-500">📄</span>}
                  {activity.type === 'note' && <span className="text-purple-500">📝</span>}
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

        {/* Key Team Members */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Key Team Members</h3>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              + Add Member
            </button>
          </div>
          <div className="space-y-3">
            {keyTeam.map(member => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {member.avatar}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    member.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{member.name}</div>
                  <div className="text-xs text-gray-500">{member.role}</div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
