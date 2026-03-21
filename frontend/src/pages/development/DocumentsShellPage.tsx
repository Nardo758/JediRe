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
import type { DealFile } from '../../components/deal/sections/DocumentsFilesSection';

const TABS = ['Files & Assets', 'DD Checklist'];

interface DocumentsShellPageProps {
  dealId?: string;
  deal?: Deal;
  dealType?: string;
}

export function DocumentsShellPage({ dealId: propDealId, deal }: DocumentsShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId ?? params.dealId ?? params.id ?? '';

  const [activeTab, setActiveTab] = useState(0);
  const [files, setFiles] = useState<DealFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resolvedDealId) return;
    setLoading(true);
    apiClient
      .get<{ data?: { files?: DealFile[]; total_count?: number } }>(
        `/api/v1/deals/${resolvedDealId}/files`,
      )
      .then((res) => setFiles(res.data?.data?.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [resolvedDealId]);

  const total   = files.length;
  const parsed  = files.filter(f => !!f.extracted_text && (f.auto_category_confidence ?? 0) >= 0.8).length;
  const pending = files.filter(f => !f.extracted_text).length;
  const finals  = files.filter(f => f.status === 'final').length;

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
          !loading
            ? <Bd c={BT.met.financial}>{total} FILES</Bd>
            : <Bd c={BT.text.muted}>LOADING</Bd>
        }
      />

      <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
        <div style={{ flex: 1 }}><KpiTile label="TOTAL FILES" value={loading ? '…' : String(total)}   color={BT.text.secondary} /></div>
        <div style={{ flex: 1 }}><KpiTile label="AI PARSED"   value={loading ? '…' : String(parsed)}  color={BT.met.financial}  /></div>
        <div style={{ flex: 1 }}><KpiTile label="PENDING AI"  value={loading ? '…' : String(pending)} color={BT.text.amber}     /></div>
        <div style={{ flex: 1 }}><KpiTile label="FINAL DOCS"  value={loading ? '…' : String(finals)}  color={BT.text.cyan}      /></div>
      </div>

      <SubTabBar tabs={TABS} active={activeTab} setActive={setActiveTab} color={BT.text.secondary} />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          deal != null
            ? (
              <BtTabWrapper>
                <DocumentsFilesSection deal={deal} />
              </BtTabWrapper>
            )
            : (
              <div style={{ padding: 24, color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 11 }}>
                NO DEAL CONTEXT — FILE BROWSER UNAVAILABLE
              </div>
            )
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
