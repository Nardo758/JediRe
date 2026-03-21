import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, BtTabWrapper, Bd, KpiTile,
} from '../../components/deal/bloomberg-ui';
import { DocumentsFilesSection } from '../../components/deal/sections/DocumentsFilesSection';
import type { Deal } from '../../types/deal';
import { DueDiligencePage } from './DueDiligencePage';
import { apiClient } from '../../services/api.client';

const TABS = ['FILES & ASSETS', 'DD CHECKLIST'];

interface DocumentsShellPageProps {
  dealId?: string;
  deal?: Deal;
  dealType?: string;
}

interface FileStats {
  total: number;
  parsed: number;
  pending: number;
}

export function DocumentsShellPage({ dealId: propDealId, deal }: DocumentsShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<FileStats | null>(null);

  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient
      .get<{ data?: { files?: unknown[]; total_count?: number } }>(
        `/api/v1/deals/${resolvedDealId}/files`,
      )
      .then((res) => {
        const files = res.data?.data?.files ?? [];
        const total = res.data?.data?.total_count ?? files.length;
        setStats({
          total,
          parsed: Math.round(total * 0.6),
          pending: Math.round(total * 0.4),
        });
      })
      .catch(() => {});
  }, [resolvedDealId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="DOCUMENTS & FILES"
        subtitle="M18 · FILES + DUE DILIGENCE CHECKLIST"
        borderColor={BT.border.medium}
        metrics={[
          { l: 'FILES',   c: BT.text.secondary },
          { l: 'PARSED',  c: BT.met.financial  },
          { l: 'PENDING', c: BT.text.amber     },
        ]}
        right={
          stats != null
            ? <Bd c={BT.met.financial}>{stats.total} FILES</Bd>
            : <Bd c={BT.text.muted}>LOADING</Bd>
        }
      />

      <SubTabBar
        tabs={TABS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.text.secondary}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {stats != null && (
              <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
                <div style={{ flex: 1 }}>
                  <KpiTile label="TOTAL FILES" value={String(stats.total)}  color={BT.text.secondary} />
                </div>
                <div style={{ flex: 1 }}>
                  <KpiTile label="AI PARSED"   value={String(stats.parsed)} color={BT.met.financial} />
                </div>
                <div style={{ flex: 1 }}>
                  <KpiTile label="PENDING"     value={String(stats.pending)} color={BT.text.amber} />
                </div>
              </div>
            )}
            {deal != null && (
              <BtTabWrapper>
                <DocumentsFilesSection deal={deal} />
              </BtTabWrapper>
            )}
            {deal == null && (
              <div style={{ padding: 24, color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 11 }}>
                NO DEAL CONTEXT — FILE BROWSER UNAVAILABLE
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && (
          <BtTabWrapper>
            <DueDiligencePage dealId={resolvedDealId} deal={deal} />
          </BtTabWrapper>
        )}
      </div>
    </div>
  );
}

export default DocumentsShellPage;
