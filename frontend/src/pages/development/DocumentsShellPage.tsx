import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, BtTabWrapper, SectionPanel, DataRow, Bd, KpiTile,
} from '../../components/deal/bloomberg-ui';
import { DueDiligencePage } from './DueDiligencePage';
import { apiClient } from '../../services/api.client';
import type { DealFile } from '../../components/deal/sections/DocumentsFilesSection';

const TABS = ['DOCUMENT REGISTRY', 'DD CHECKLIST'];

interface DocumentsShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtDate(s: string): string {
  if (!s) return '—';
  return s.slice(0, 10);
}

function extTag(f: DealFile): string {
  return (f.file_extension ?? f.mime_type?.split('/')[1] ?? '?').toUpperCase().slice(0, 6);
}

function aiStatus(f: DealFile): { label: string; color: string } {
  const conf = f.auto_category_confidence ?? 0;
  const hasText = !!f.extracted_text;
  if (hasText && conf >= 0.8) return { label: 'PARSED', color: BT.met.financial };
  if (hasText && conf >= 0.5) return { label: 'PARTIAL', color: BT.text.amber };
  if (hasText) return { label: 'LOW CONF', color: BT.text.amber };
  return { label: 'PENDING', color: BT.text.muted };
}

function statusColor(s: DealFile['status']): string {
  switch (s) {
    case 'final':          return BT.met.financial;
    case 'draft':          return BT.text.amber;
    case 'pending-review': return BT.text.cyan;
    case 'archived':       return BT.text.muted;
    case 'expired':        return BT.text.muted;
    default:               return BT.text.secondary;
  }
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
      .then((res) => {
        const f = res.data?.data?.files ?? [];
        setFiles(f);
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [resolvedDealId]);

  const total   = files.length;
  const parsed  = files.filter(f => !!f.extracted_text && (f.auto_category_confidence ?? 0) >= 0.8).length;
  const pending = files.filter(f => !f.extracted_text).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="DOCUMENTS & FILES"
        subtitle="M18 · DOCUMENT REGISTRY + DUE DILIGENCE"
        borderColor={BT.border.medium}
        metrics={[
          { l: 'TOTAL',   c: BT.text.secondary },
          { l: 'PARSED',  c: BT.met.financial  },
          { l: 'PENDING', c: BT.text.amber     },
          { l: 'AI',      c: BT.text.purple    },
        ]}
        right={
          !loading
            ? <Bd c={BT.met.financial}>{total} FILES</Bd>
            : <Bd c={BT.text.muted}>LOADING</Bd>
        }
      />

      <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
        <div style={{ flex: 1 }}><KpiTile label="TOTAL FILES" value={loading ? '…' : String(total)}  color={BT.text.secondary} /></div>
        <div style={{ flex: 1 }}><KpiTile label="AI PARSED"  value={loading ? '…' : String(parsed)} color={BT.met.financial}  /></div>
        <div style={{ flex: 1 }}><KpiTile label="PENDING AI" value={loading ? '…' : String(pending)} color={BT.text.amber}    /></div>
        <div style={{ flex: 1 }}><KpiTile label="FINAL DOCS" value={loading ? '…' : String(files.filter(f => f.status === 'final').length)} color={BT.text.cyan} /></div>
      </div>

      <SubTabBar
        tabs={TABS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.text.secondary}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <SectionPanel
            title="DOCUMENT REGISTRY"
            subtitle={`M18 · ${total} RECORDS · TYPE / SIZE / UPLOADED / STATUS / AI STATUS`}
            borderColor={BT.border.medium}
            style={{ minHeight: '100%' }}
          >
            {loading && (
              <div style={{ padding: 24, color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 11 }}>LOADING FILES…</div>
            )}
            {!loading && files.length === 0 && (
              <div style={{ padding: 24, color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 11 }}>NO FILES UPLOADED</div>
            )}
            {!loading && files.map((f) => {
              const ai = aiStatus(f);
              return (
                <SectionPanel
                  key={f.id}
                  title={f.original_filename || f.filename}
                  subtitle={`${extTag(f)} · ${fmtSize(f.file_size)} · ${f.category || 'UNCATEGORIZED'}`}
                  borderColor={statusColor(f.status)}
                  style={{ margin: '4px 8px' }}
                >
                  <DataRow label="TYPE"       value={extTag(f)}                 valueColor={BT.text.cyan}               />
                  <DataRow label="SIZE"       value={fmtSize(f.file_size)}      valueColor={BT.text.secondary}          />
                  <DataRow label="UPLOADED"   value={fmtDate(f.created_at)}     valueColor={BT.text.secondary}          />
                  <DataRow label="STATUS"     value={f.status.toUpperCase()}    valueColor={statusColor(f.status)}      />
                  <DataRow label="AI STATUS"  value={ai.label}                  valueColor={ai.color}                   />
                  {f.version > 1 && (
                    <DataRow label="VERSION"  value={`v${f.version}`}           valueColor={BT.text.muted}              />
                  )}
                </SectionPanel>
              );
            })}
          </SectionPanel>
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
