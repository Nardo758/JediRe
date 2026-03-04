import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Users, Building2, Map, Cog,
  ArrowLeft, Shield,
} from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { SystemHealthSection } from './sections/SystemHealthSection';
import { UserManagementSection } from './sections/UserManagementSection';
import { DealOversightSection } from './sections/DealOversightSection';
import { DataCoverageSection } from './sections/DataCoverageSection';
import { BackgroundJobsSection } from './sections/BackgroundJobsSection';

type TabKey = 'health' | 'users' | 'deals' | 'coverage' | 'jobs';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'health', label: 'System Health', icon: <Activity className="w-4 h-4" /> },
  { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { key: 'deals', label: 'Deals', icon: <Building2 className="w-4 h-4" /> },
  { key: 'coverage', label: 'Data Coverage', icon: <Map className="w-4 h-4" /> },
  { key: 'jobs', label: 'Jobs', icon: <Cog className="w-4 h-4" /> },
];

interface QuickStats {
  user_count: string;
  deal_count: string;
  property_count: string;
  scenario_count: string;
  zoning_district_count: string;
  benchmark_count: string;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('health');
  const [stats, setStats] = useState<QuickStats | null>(null);

  useEffect(() => {
    apiClient.get('/api/v1/admin/system/stats')
      .then(res => setStats(res.data.totals))
      .catch(() => {});
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'health': return <SystemHealthSection />;
      case 'users': return <UserManagementSection />;
      case 'deals': return <DealOversightSection />;
      case 'coverage': return <DataCoverageSection />;
      case 'jobs': return <BackgroundJobsSection />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="p-1.5 rounded-md hover:bg-gray-100">
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
              </div>
            </div>
            {stats && (
              <div className="hidden md:flex items-center gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Users </span>
                  <span className="font-semibold text-gray-900">{Number(stats.user_count).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Deals </span>
                  <span className="font-semibold text-gray-900">{Number(stats.deal_count).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Properties </span>
                  <span className="font-semibold text-gray-900">{Number(stats.property_count).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Scenarios </span>
                  <span className="font-semibold text-gray-900">{Number(stats.scenario_count).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex max-w-[1400px] mx-auto w-full">
        <nav className="w-52 flex-shrink-0 bg-white border-r border-[#e2e8f0] py-4">
          <div className="space-y-0.5 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className={activeTab === tab.key ? 'text-blue-600' : 'text-gray-400'}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 px-2 pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase px-3 mb-2">Tools</div>
            <Link
              to="/admin/data-tracker"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Data Tracker
            </Link>
            <Link
              to="/admin/property-coverage"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              Property Coverage
            </Link>
          </div>
        </nav>

        <main className="flex-1 p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
