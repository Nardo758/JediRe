import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, BtTabWrapper, SectionPanel, TableHeader, TableRow, Bd, KpiTile,
} from '../../components/deal/bloomberg-ui';
import { DueDiligencePage } from './DueDiligencePage';
import { apiClient } from '../../services/api.client';
import type { DealFile } from '../../components/deal/sections/DocumentsFilesSection';

const TABS = ['Files & Assets', 'DD Checklist'];

interface DocumentsShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtDate(s: string): string {
  return s ? s.slice(0, 10) : '—';
}

function fileExt(f: DealFile): string {
  return (f.file_extension ?? f.mime_type?.split('/')[1] ?? '?').toUpperCase().slice(0, 6);
}

function aiStatusLabel(f: DealFile): { label: string; color: string } {
  const conf = f.auto_category_confidence ?? 0;
  const hasText = !!f.extracted_text;
  if (hasText && conf >= 0.8) return { label: 'PARSED',   color: BT.met.financial };
  if (hasText && conf >= 0.5) return { label: 'PARTIAL',  color: BT.text.amber    };
  if (hasText)                return { label: 'LOW CONF', color: BT.text.amber    };
  return                            { label: 'PENDING',  color: BT.text.muted    };
}

function statusColor(s: DealFile['status']): string {
  switch (s) {
    case 'final':          return BT.met.financial;
    case 'draft':          return BT.text.amber;
    case 'pending-review': return BT.text.cyan;
    default:               return BT.text.muted;
  }
}

const DOC_COLS = [
  { label: 'FILENAME',   flex: 3, color: BT.text.secondary },
  { label: 'TYPE',       flex: 1, color: BT.text.cyan      },
  { label: 'SIZE',       flex: 1, color: BT.text.muted     },
  { label: 'UPLOADED',   flex: 1, color: BT.text.muted     },
  { label: 'STATUS',     flex: 1, color: BT.met.financial  },
  { label: 'AI STATUS',  flex: 1, color: BT.text.purple    },
];

export function DocumentsShellPage({ dealId: propDealId, deal }: DocumentsShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId ?? params.dealId ?? params.id ?? '';

  const [activeTab, setActiveTab] = useState(0);
  const [files, setFiles]   = useState<DealFile[]>([]);
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
        <div style={{ flex: 1 }}><KpiTile label="TOTAL FILES" value={loading ? '…' : String(total)}   color={BT.text.secondary} /></div>
        <div style={{ flex: 1 }}><KpiTile label="AI PARSED"   value={loading ? '…' : String(parsed)}  color={BT.met.financial}  /></div>
        <div style={{ flex: 1 }}><KpiTile label="PENDING AI"  value={loading ? '…' : String(pending)} color={BT.text.amber}     /></div>
        <div style={{ flex: 1 }}><KpiTile label="FINAL DOCS"  value={loading ? '…' : String(finals)}  color={BT.text.cyan}      /></div>
      </div>

      <SubTabBar tabs={TABS} active={activeTab} setActive={setActiveTab} color={BT.text.secondary} />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <SectionPanel
            title="DOCUMENT REGISTRY"
            subtitle={`M18 · ${total} RECORDS · FILENAME / TYPE / SIZE / UPLOADED / STATUS / AI STATUS`}
            borderColor={BT.border.medium}
            style={{ minHeight: '100%' }}
          >
            {loading && (
              <div style={{ padding: 24, color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 11 }}>LOADING FILES…</div>
            )}
            {!loading && files.length === 0 && (
              <div style={{ padding: 24, color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 11 }}>NO FILES UPLOADED</div>
            )}
            {!loading && files.length > 0 && (
              <div>
                <TableHeader cols={DOC_COLS} />
                {files.map((f, i) => {
                  const ai = aiStatusLabel(f);
                  return (
                    <TableRow
                      key={f.id}
                      index={i}
                      cells={[
                        { value: f.original_filename || f.filename,                        flex: 3, color: BT.text.secondary, weight: 600 },
                        { value: <Bd c={BT.text.cyan}>{fileExt(f)}</Bd>,                  flex: 1                                         },
                        { value: fmtSize(f.file_size),                                     flex: 1, color: BT.text.muted                   },
                        { value: fmtDate(f.created_at),                                    flex: 1, color: BT.text.muted                   },
                        { value: <Bd c={statusColor(f.status)}>{f.status.toUpperCase()}</Bd>, flex: 1                                      },
                        { value: <Bd c={ai.color}>{ai.label}</Bd>,                         flex: 1                                         },
                      ]}
                    />
                  );
                })}
              </div>
            )}
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
