/**
 * Admin Dashboard - Central hub for admin tools
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Map, Database, Settings, Users, BarChart3 } from 'lucide-react';

export function AdminDashboard() {
  const adminTools = [
    {
      icon: <Map className="w-8 h-8 text-blue-600" />,
      title: 'Property Coverage',
      description: 'Monitor data coverage across counties (620K parcels)',
      path: '/admin/property-coverage',
      status: 'Active',
      color: 'bg-blue-50 border-blue-200',
    },
    {
      icon: <Database className="w-8 h-8 text-green-600" />,
      title: 'Data Management',
      description: 'Manage property data, scrapers, and integrations',
      path: '/admin/data-management',
      status: 'Coming Soon',
      color: 'bg-green-50 border-green-200',
    },
    {
      icon: <Users className="w-8 h-8 text-purple-600" />,
      title: 'User Management',
      description: 'Manage users, permissions, and access control',
      path: '/admin/users',
      status: 'Coming Soon',
      color: 'bg-purple-50 border-purple-200',
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-orange-600" />,
      title: 'Analytics',
      description: 'Platform usage, API calls, and performance metrics',
      path: '/admin/analytics',
      status: 'Coming Soon',
      color: 'bg-orange-50 border-orange-200',
    },
    {
      icon: <Settings className="w-8 h-8 text-gray-600" />,
      title: 'System Settings',
      description: 'Configure integrations, API keys, and system settings',
      path: '/admin/settings',
      status: 'Coming Soon',
      color: 'bg-gray-50 border-gray-200',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Platform administration and data management tools
          </p>
        </div>
      </div>

      {/* Admin Tools Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminTools.map((tool, index) => (
            <Link
              key={index}
              to={tool.path}
              className={`${tool.color} border rounded-lg p-6 hover:shadow-lg transition-shadow ${
                tool.status === 'Coming Soon' ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  {tool.icon}
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    tool.status === 'Active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tool.status}
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {tool.title}
              </h3>
              
              <p className="text-sm text-gray-600">
                {tool.description}
              </p>
            </Link>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Total Properties</div>
            <div className="text-2xl font-bold text-gray-900">620K</div>
            <div className="text-xs text-gray-500 mt-1">Fulton + DeKalb</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Active Deals</div>
            <div className="text-2xl font-bold text-gray-900">47</div>
            <div className="text-xs text-gray-500 mt-1">In pipeline</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">API Calls (24h)</div>
            <div className="text-2xl font-bold text-gray-900">2.4K</div>
            <div className="text-xs text-gray-500 mt-1">All endpoints</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">System Status</div>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <div className="text-xs text-gray-500 mt-1">All systems operational</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 bg-white rounded-lg border border-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm text-gray-900">Property Coverage Dashboard accessed</div>
                  <div className="text-xs text-gray-500">2 minutes ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm text-gray-900">Fulton County API health check passed</div>
                  <div className="text-xs text-gray-500">15 minutes ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm text-gray-900">DeKalb County scraper completed successfully</div>
                  <div className="text-xs text-gray-500">1 hour ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
