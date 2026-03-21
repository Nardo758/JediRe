import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, BtTabWrapper, SectionPanel, DataRow, Bd,
} from '../../components/deal/bloomberg-ui';
import { DocumentsFilesSection } from '../../components/deal/sections/DocumentsFilesSection';
import type { Deal } from '../../types/deal';
import { DueDiligencePage } from './DueDiligencePage';
import { apiClient } from '../../services/api.client';

const TABS = ['FILES & ASSETS', 'DD CHECKLIST'];

interface DocumentsShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

function isDeal(d: Record<string, unknown>): d is Deal {
  return typeof d.id === 'string' && typeof d.name === 'string';
}

interface FileTotal { total: number }

export function DocumentsShellPage({ dealId: propDealId, deal }: DocumentsShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const [activeTab, setActiveTab] = useState(0);
  const [fileTotal, setFileTotal] = useState<FileTotal | null>(null);

  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient
      .get<{ data?: { files?: unknown[]; total_count?: number } }>(
        `/api/v1/deals/${resolvedDealId}/files`,
      )
      .then((res) => {
        const files = res.data?.data?.files ?? [];
        const total = res.data?.data?.total_count ?? files.length;
        setFileTotal({ total });
      })
      .catch(() => {});
  }, [resolvedDealId]);

  const typedDeal: Deal | null = deal != null && isDeal(deal) ? deal : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="DOCUMENTS & FILES"
        subtitle="M18 · FILES + DUE DILIGENCE CHECKLIST"
        borderColor={BT.border.medium}
        metrics={[
          { l: 'FILES',   c: BT.text.secondary },
          { l: 'TYPE',    c: BT.text.cyan      },
          { l: 'STATUS',  c: BT.met.financial  },
          { l: 'AI',      c: BT.text.purple    },
        ]}
        right={
          fileTotal != null
            ? <Bd c={BT.met.financial}>{fileTotal.total} FILES</Bd>
            : <Bd c={BT.text.muted}>—</Bd>
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
            <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
              <SectionPanel
                title="FILE REGISTRY"
                subtitle="M18 · TOTAL COUNT FROM API"
                borderColor={BT.border.medium}
                style={{ flex: 1, minWidth: 0 }}
              >
                <DataRow label="TOTAL FILES"  value={fileTotal != null ? String(fileTotal.total) : '—'} valueColor={BT.text.secondary} />
                <DataRow label="TYPE"         value="MIXED"    valueColor={BT.text.cyan}                />
                <DataRow label="STATUS"       value="ACTIVE"   valueColor={BT.met.financial}            />
                <DataRow label="AI STATUS"    value="READY"    valueColor={BT.text.purple}              />
              </SectionPanel>
            </div>

            {typedDeal != null ? (
              <BtTabWrapper>
                <DocumentsFilesSection deal={typedDeal} />
              </BtTabWrapper>
            ) : (
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
