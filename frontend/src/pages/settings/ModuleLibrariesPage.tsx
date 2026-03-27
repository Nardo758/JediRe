import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';
import { DollarSign, BarChart3, ClipboardCheck, Activity } from 'lucide-react';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface ModuleLibraryStats {
  module: string;
  fileCount: number;
  lastUpload?: string;
}

interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  fileCount: number;
  lastUpload?: string;
  onClick: () => void;
}

function ModuleLibraryCard({ icon, title, description, fileCount, lastUpload, onClick }: ModuleCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left' as const,
        padding: 20,
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ padding: 10, background: BT.bg.panelAlt, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, marginBottom: 4 }}>{title}</h3>
          <p style={{ fontSize: 11, color: BT.text.secondary, marginBottom: 10 }}>{description}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11 }}>
            <div>
              <span style={{ fontWeight: 600, color: BT.text.cyan, ...mono }}>{fileCount}</span>
              <span style={{ color: BT.text.muted, marginLeft: 4 }}>files</span>
            </div>
            {lastUpload && (
              <div style={{ color: BT.text.muted }}>
                Last upload: <span style={{ fontWeight: 500, color: BT.text.secondary }}>{lastUpload}</span>
              </div>
            )}
          </div>
        </div>
        <span style={{ color: BT.text.muted, fontSize: 18, flexShrink: 0 }}>&rarr;</span>
      </div>
    </button>
  );
}

export function ModuleLibrariesPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, ModuleLibraryStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const modules = ['financial', 'market', 'due_diligence', 'traffic'];
      const results = await Promise.all(
        modules.map(async (module) => {
          try {
            const response = await apiClient.get(`/api/v1/module-libraries/${module}/files`);
            const files = response.data.files || [];
            let lastUpload = undefined;
            if (files.length > 0) {
              const uploadDate = new Date(files[0].uploadedAt);
              const now = new Date();
              const diffDays = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays === 0) lastUpload = 'Today';
              else if (diffDays === 1) lastUpload = 'Yesterday';
              else if (diffDays < 7) lastUpload = `${diffDays} days ago`;
              else if (diffDays < 30) { const w = Math.floor(diffDays / 7); lastUpload = `${w} week${w > 1 ? 's' : ''} ago`; }
              else { const m = Math.floor(diffDays / 30); lastUpload = `${m} month${m > 1 ? 's' : ''} ago`; }
            }
            return { module, fileCount: files.length, lastUpload };
          } catch { return { module, fileCount: 0, lastUpload: undefined }; }
        })
      );
      const statsMap: Record<string, ModuleLibraryStats> = {};
      results.forEach(stat => { statsMap[stat.module] = stat; });
      setStats(statsMap);
    } catch (error) {
      console.error('Failed to load module library stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleClick = (module: string) => { navigate(`/settings/module-libraries/${module}`); };

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ height: 32, width: 32, border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary, letterSpacing: '0.04em' }}>Module Libraries</h1>
        <p style={{ fontSize: 12, color: BT.text.secondary, marginTop: 4 }}>
          Upload historical data for Opus to learn from. Build personal data libraries for each module to power AI-driven pro forma generation and analysis.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        <ModuleLibraryCard
          icon={<DollarSign style={{ width: 24, height: 24, color: BT.text.green }} />}
          title="Financial Module"
          description="Upload previous pro formas, operating expenses, debt terms, and historical financial data"
          fileCount={stats.financial?.fileCount || 0}
          lastUpload={stats.financial?.lastUpload}
          onClick={() => handleModuleClick('financial')}
        />
        <ModuleLibraryCard
          icon={<BarChart3 style={{ width: 24, height: 24, color: BT.text.cyan }} />}
          title="Market Module"
          description="Upload market reports, proprietary research, comp data, and custom market analysis"
          fileCount={stats.market?.fileCount || 0}
          lastUpload={stats.market?.lastUpload}
          onClick={() => handleModuleClick('market')}
        />
        <ModuleLibraryCard
          icon={<ClipboardCheck style={{ width: 24, height: 24, color: BT.text.amber }} />}
          title="Due Diligence Module"
          description="Upload checklists, template documents, and previous DD files for standardization"
          fileCount={stats.due_diligence?.fileCount || 0}
          lastUpload={stats.due_diligence?.lastUpload}
          onClick={() => handleModuleClick('due_diligence')}
        />
        <ModuleLibraryCard
          icon={<Activity style={{ width: 24, height: 24, color: BT.text.violet }} />}
          title="Traffic Module"
          description="Upload weekly traffic reports, leasing velocity data, and conversion benchmarks to calibrate predictions"
          fileCount={stats.traffic?.fileCount || 0}
          lastUpload={stats.traffic?.lastUpload}
          onClick={() => handleModuleClick('traffic')}
        />
      </div>

      <div style={{ marginTop: 24, padding: 20, background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ padding: 8, background: BT.bg.active }}>
            <BarChart3 style={{ width: 20, height: 20, color: BT.text.cyan }} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, marginBottom: 6 }}>How Opus Learning Works</h3>
            <p style={{ fontSize: 12, color: BT.text.secondary, marginBottom: 6 }}>
              When you upload historical data, Opus analyzes patterns, formulas, and assumptions to understand your unique investment approach. The more data you provide, the more accurate and personalized your AI-generated models become.
            </p>
            <p style={{ fontSize: 11, color: BT.text.muted }}>
              <strong style={{ color: BT.text.secondary }}>Example:</strong> Upload 10 previous multifamily pro formas &rarr; Opus learns typical OpEx/unit, rent growth rates, cap rates, hold periods &rarr; Applies these patterns to new deals automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
