import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Users, Building2, Map, Cog, Database,
  ArrowLeft, Shield, Zap, Bot,
} from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';
import { SystemHealthSection } from './sections/SystemHealthSection';
import { UserManagementSection } from './sections/UserManagementSection';
import { DealOversightSection } from './sections/DealOversightSection';
import { DataCoverageSection } from './sections/DataCoverageSection';
import { BackgroundJobsSection } from './sections/BackgroundJobsSection';
import { EnrichmentStatusSection } from './sections/EnrichmentStatusSection';
import { AgentsPlatformSection } from './sections/AgentsPlatformSection';

type TabKey = 'health' | 'users' | 'deals' | 'coverage' | 'jobs' | 'enrichment' | 'agents';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'health', label: 'System Health', icon: <Activity className="w-4 h-4" /> },
  { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { key: 'deals', label: 'Deals', icon: <Building2 className="w-4 h-4" /> },
  { key: 'coverage', label: 'Data Coverage', icon: <Map className="w-4 h-4" /> },
  { key: 'jobs', label: 'Jobs', icon: <Cog className="w-4 h-4" /> },
  { key: 'enrichment', label: 'Enrichment', icon: <Database className="w-4 h-4" /> },
  { key: 'agents', label: 'Agents', icon: <Bot className="w-4 h-4" /> },
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
      case 'enrichment': return <EnrichmentStatusSection />;
      case 'agents': return <AgentsPlatformSection />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BT.bg.terminal, fontFamily: BT.font.label }}>
      <div style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="p-1.5" style={{ borderRadius: 2 }}>
                <ArrowLeft className="w-4 h-4" style={{ color: BT.text.secondary }} />
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: BT.text.cyan }} />
                <h1 className="text-xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Admin Panel</h1>
              </div>

              <Link
                to="/admin/command-center"
                className="ml-4 flex items-center gap-2 px-4 py-2 text-sm font-medium"
                style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
              >
                <Zap className="w-4 h-4" />
                Command Center
              </Link>
            </div>
            {stats && (
              <div className="hidden md:flex items-center gap-6 text-sm">
                <div>
                  <span style={{ color: BT.text.secondary }}>Users </span>
                  <span className="font-semibold" style={{ color: BT.text.primary }}>{Number(stats.user_count).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ color: BT.text.secondary }}>Deals </span>
                  <span className="font-semibold" style={{ color: BT.text.primary }}>{Number(stats.deal_count).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ color: BT.text.secondary }}>Properties </span>
                  <span className="font-semibold" style={{ color: BT.text.primary }}>{Number(stats.property_count).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ color: BT.text.secondary }}>Scenarios </span>
                  <span className="font-semibold" style={{ color: BT.text.primary }}>{Number(stats.scenario_count).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex max-w-[1400px] mx-auto w-full">
        <nav className="w-52 flex-shrink-0 py-4" style={{ background: BT.bg.panel, borderRight: `1px solid ${BT.border.subtle}` }}>
          <div className="space-y-0.5 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  borderRadius: 2,
                  background: activeTab === tab.key ? BT.bg.active : 'transparent',
                  color: activeTab === tab.key ? BT.text.amber : BT.text.secondary,
                }}
              >
                <span style={{ color: activeTab === tab.key ? BT.text.amber : BT.text.muted }}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 px-2 pt-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
            <div className="text-xs font-medium uppercase px-3 mb-2" style={{ color: BT.text.muted }}>Tools</div>
            <Link
              to="/admin/data-tracker"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm"
              style={{ borderRadius: 2, color: BT.text.secondary }}
            >
              Data Tracker
            </Link>
            <Link
              to="/admin/property-coverage"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm"
              style={{ borderRadius: 2, color: BT.text.secondary }}
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
