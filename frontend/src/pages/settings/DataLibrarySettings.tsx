import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BT } from '@/components/deal/bloomberg-ui';
import { apiClient } from '../../services/api.client';
import { CloudStoragePanel, BulkUploadPanel } from '../../components/data-library';
import AssetDetailModal from '../../components/data-library/AssetDetailModal';
import { Upload, Cloud, ChevronDown, ChevronRight } from 'lucide-react';
import { AssetsTab } from './DataLibrary/AssetsTab';
import { FilesTab } from './DataLibrary/FilesTab';
import { InboxTab } from './DataLibrary/InboxTab';
import { RollupsTab } from './DataLibrary/RollupsTab';

export type TabKey = 'assets' | 'files' | 'inbox' | 'rollups';

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";
const TABS: { key: TabKey; label: string }[] = [
  { key: 'assets', label: 'ASSETS' },
  { key: 'files', label: 'FILES' },
  { key: 'inbox', label: 'INBOX' },
  { key: 'rollups', label: 'ROLLUPS' },
];

export function DataLibrarySettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabKey = (searchParams.get('tab') as TabKey) || 'assets';

  const setTab = (tab: TabKey) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('tab');
      if (tab !== 'assets') next.set('tab', tab);
      next.delete('page');
      return next;
    });
  };

  const [activePanel, setActivePanel] = useState<'none' | 'upload' | 'cloud'>('none');
  const [showUploadSection, setShowUploadSection] = useState(true);

  const navLink = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em',
    color: active ? '#f0f6fc' : '#8892b0',
    borderBottom: active ? '2px solid #FF8C00' : '2px solid transparent',
    padding: '2px 8px', textTransform: 'uppercase',
  });

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
      {/* Upload Section */}
      <div style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
        <button onClick={() => setShowUploadSection(!showUploadSection)}
          style={{
            width: '100%', padding: '12px 20px', background: BT.bg.panelAlt,
            border: 'none', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', cursor: 'pointer', color: BT.text.primary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={16} style={{ color: BT.text.cyan }} />
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO }}>BULK UPLOAD & CLOUD SYNC</span>
          </div>
          {showUploadSection ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {showUploadSection && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setActivePanel(activePanel === 'upload' ? 'none' : 'upload')}
                style={{
                  padding: '8px 16px', background: activePanel === 'upload' ? BT.bg.accent : BT.bg.input,
                  border: `1px solid ${activePanel === 'upload' ? BT.border.accent : BT.border.medium}`,
                  borderRadius: 4, color: activePanel === 'upload' ? BT.text.amber : BT.text.secondary,
                  fontFamily: MONO, fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              ><Upload size={14} /> Upload Files</button>
              <button onClick={() => setActivePanel(activePanel === 'cloud' ? 'none' : 'cloud')}
                style={{
                  padding: '8px 16px', background: activePanel === 'cloud' ? BT.bg.accent : BT.bg.input,
                  border: `1px solid ${activePanel === 'cloud' ? BT.border.accent : BT.border.medium}`,
                  borderRadius: 4, color: activePanel === 'cloud' ? BT.text.amber : BT.text.secondary,
                  fontFamily: MONO, fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              ><Cloud size={14} /> Cloud Storage</button>
            </div>
            {activePanel === 'upload' && <BulkUploadPanel onUploadComplete={() => {}} />}
            {activePanel === 'cloud' && <CloudStoragePanel onSyncComplete={() => {}} />}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 0, padding: '8px 20px 0',
        borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panelAlt,
      }}>
        {TABS.map(tab => (
          <button key={tab.key} style={navLink(activeTab === tab.key)} onClick={() => setTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: 400 }}>
        {activeTab === 'assets' && <AssetsTab />}
        {activeTab === 'files' && <FilesTab />}
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'rollups' && <RollupsTab />}
      </div>
    </div>
  );
}
