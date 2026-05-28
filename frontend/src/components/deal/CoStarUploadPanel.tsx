import React, { useState, useRef } from 'react';
import { BT } from '../deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: BT.font.mono };

type CompType = 'sale' | 'rent' | 'submarket';

interface PreviewRow {
  rowIndex: number;
  propertyName: string | null;
  address: string;
  city: string;
  state: string;
  zip?: string | null;
  submarket?: string | null;
  units?: number | null;
  yearBuilt?: number | null;
  assetClass?: string | null;
  saleDate?: string | null;
  salePrice?: number | null;
  pricePerUnit?: number | null;
  capRate?: number | null;
  snapshotDate?: string | null;
  avgAskingRent?: number | null;
  avgEffectiveRent?: number | null;
  occupancyPct?: number | null;
  periodDate?: string | null;
  vacancyRate?: number | null;
  askingRentPerUnit?: number | null;
  isValid: boolean;
  validationError: string | null;
  isDuplicate: boolean;
}

interface PreviewResult {
  compType: CompType;
  detectedCompType: CompType | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: PreviewRow[];
  rejected: boolean;
  rejectReason?: string;
}

interface CommitResult {
  compType: CompType;
  totalRows: number;
  inserted: number;
  skippedDup: number;
  skippedInvalid: number;
  errors: Array<{ row: number; address: string; reason: string }>;
  rejected: boolean;
  rejectReason?: string;
}

interface CoStarSummary {
  sale: { count: number; earliest: string | null; latest: string | null };
  rent: { count: number; earliest: string | null; latest: string | null };
  submarket: { count: number; earliest: string | null; latest: string | null };
  total: number;
}

interface Props {
  dealId: string;
  onClose?: () => void;
}

type Phase = 'upload' | 'preview' | 'committed';

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString()}`;
}

export function CoStarUploadPanel({ dealId, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [compType, setCompType] = useState<CompType>('sale');
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [dataAsOf, setDataAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CoStarSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const baseUrl = `/api/v1/deals/${dealId}/costar`;

  React.useEffect(() => {
    fetch(`${baseUrl}/summary`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setSummary(d))
      .catch(() => {});
  }, [dealId, baseUrl]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('compType', compType);
      fd.append('snapshotDate', snapshotDate);
      fd.append('dataAsOf', dataAsOf);

      const res = await fetch(`${baseUrl}/preview`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data: PreviewResult = await res.json();
      if (!res.ok) throw new Error((data as any).error ?? 'Preview failed');
      if (data.rejected) throw new Error(data.rejectReason ?? 'File rejected');
      setPreview(data);
      setPhase('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('compType', compType);
      fd.append('snapshotDate', snapshotDate);
      fd.append('dataAsOf', dataAsOf);
      fd.append('overrides', '[]');

      const res = await fetch(`${baseUrl}/commit`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data: CommitResult = await res.json();
      if (!res.ok) throw new Error((data as any).error ?? 'Commit failed');
      setCommitResult(data);
      setPhase('committed');
      fetch(`${baseUrl}/summary`, { credentials: 'include' }).then(r => r.json()).then(setSummary).catch(() => {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ct: CompType) => {
    if (!confirm(`Remove all CoStar ${ct} comps for this deal?`)) return;
    await fetch(`${baseUrl}/${ct}`, { method: 'DELETE', credentials: 'include' });
    fetch(`${baseUrl}/summary`, { credentials: 'include' }).then(r => r.json()).then(setSummary).catch(() => {});
  };

  const COMP_TYPE_LABELS: Record<CompType, string> = {
    sale: 'Sale Comps',
    rent: 'Rent Comps',
    submarket: 'Submarket Performance',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: BT.text.primary }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13 }}>📊</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.primary, ...mono }}>COSTAR COMP IMPORT</div>
            <div style={{ fontSize: 9, color: BT.text.muted, ...mono }}>Upload CSV or Excel export · Sale · Rent · Submarket</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: BT.text.muted, cursor: 'pointer', fontSize: 16 }}>×</button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Summary chips */}
        {summary && summary.total > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['sale', 'rent', 'submarket'] as CompType[]).map(ct => {
              const s = summary[ct];
              if (!s.count) return null;
              return (
                <div key={ct} style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.cyan, ...mono }}>{s.count.toLocaleString()}</span>
                    <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}> {COMP_TYPE_LABELS[ct].toUpperCase()}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(ct)}
                    title="Remove all"
                    style={{ background: 'none', border: 'none', color: BT.text.muted, cursor: 'pointer', fontSize: 11 }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Phase: Upload ── */}
        {phase === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Config row */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {/* Comp Type */}
              <div style={{ flex: '1 1 180px' }}>
                <div style={{ fontSize: 9, color: BT.text.muted, ...mono, marginBottom: 6, letterSpacing: 0.5 }}>EXPORT TYPE</div>
                <select
                  value={compType}
                  onChange={e => setCompType(e.target.value as CompType)}
                  style={{ width: '100%', background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, padding: '8px 10px', ...mono, fontSize: 10, outline: 'none' }}
                >
                  <option value="sale">Sale Comps</option>
                  <option value="rent">Rent Comps</option>
                  <option value="submarket">Submarket Performance</option>
                </select>
              </div>

              {/* Snapshot date (rent / submarket) */}
              {compType !== 'sale' && (
                <div style={{ flex: '1 1 150px' }}>
                  <div style={{ fontSize: 9, color: BT.text.muted, ...mono, marginBottom: 6, letterSpacing: 0.5 }}>
                    {compType === 'rent' ? 'AS-OF DATE' : 'PERIOD DATE'}
                  </div>
                  <input
                    type="date"
                    value={snapshotDate}
                    onChange={e => setSnapshotDate(e.target.value)}
                    style={{ width: '100%', background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, padding: '8px 10px', ...mono, fontSize: 10, outline: 'none' }}
                  />
                </div>
              )}

              {/* Data as-of (export date from CoStar) */}
              <div style={{ flex: '1 1 150px' }}>
                <div style={{ fontSize: 9, color: BT.text.muted, ...mono, marginBottom: 6, letterSpacing: 0.5 }}>COSTAR EXPORT DATE</div>
                <input
                  type="date"
                  value={dataAsOf}
                  onChange={e => setDataAsOf(e.target.value)}
                  style={{ width: '100%', background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, padding: '8px 10px', ...mono, fontSize: 10, outline: 'none' }}
                />
                <div style={{ fontSize: 8, color: BT.text.muted, ...mono, marginTop: 3 }}>When CoStar generated this export</div>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${file ? BT.text.cyan : BT.border.medium}`,
                background: file ? BT.text.cyan + '08' : BT.bg.panelAlt,
                padding: 32, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
              />
              {file ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.cyan, ...mono }}>{file.name}</div>
                  <div style={{ fontSize: 9, color: BT.text.muted, ...mono, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · Click to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📤</div>
                  <div style={{ fontSize: 11, color: BT.text.secondary, ...mono }}>Drop CoStar CSV or Excel export here</div>
                  <div style={{ fontSize: 9, color: BT.text.muted, ...mono, marginTop: 4 }}>or click to browse · .csv / .xls / .xlsx accepted</div>
                </>
              )}
            </div>

            {/* Column mapping reference */}
            <details style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, padding: 12 }}>
              <summary style={{ fontSize: 9, color: BT.text.muted, ...mono, cursor: 'pointer', letterSpacing: 0.5 }}>
                COLUMN MAPPING REFERENCE ▾
              </summary>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  {
                    label: 'SALE COMPS', color: BT.text.amber,
                    cols: ['Address *', 'City *', 'State *', 'Sale Date *', 'Sale Price *', 'Cap Rate', '# Units', 'Bldg SF', 'Year Built', 'Building Class', 'Buyer / Seller', 'Latitude / Longitude'],
                  },
                  {
                    label: 'RENT COMPS', color: BT.text.green,
                    cols: ['Address *', 'City *', 'State *', 'Asking Rent/Unit *', 'Effective Rent/Unit', 'Occupancy', 'Concession %', '# Units', 'Year Built', 'Building Class', 'Submarket'],
                  },
                  {
                    label: 'SUBMARKET PERFORMANCE', color: BT.text.cyan,
                    cols: ['Submarket *', 'Period / Date *', 'Market / MSA', 'City', 'State', 'Vacancy Rate', 'Asking Rent/Unit', 'Eff Rent/Unit', 'Rent Growth', 'Net Absorption', 'Deliveries', 'Inventory', 'Under Const.'],
                  },
                ].map(section => (
                  <div key={section.label}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: section.color, letterSpacing: 0.5, ...mono, marginBottom: 6 }}>{section.label}</div>
                    {section.cols.map(col => (
                      <div key={col} style={{ fontSize: 9, color: col.includes('*') ? BT.text.secondary : BT.text.muted, ...mono, marginBottom: 2 }}>
                        {col.includes('*') ? '▸' : '·'} {col}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 8, color: BT.text.muted, ...mono, marginTop: 8 }}>* = required field</div>
            </details>

            {error && (
              <div style={{ background: BT.text.red + '18', border: `1px solid ${BT.text.red}44`, padding: '10px 14px', fontSize: 10, color: BT.text.red, ...mono }}>
                {error}
              </div>
            )}

            <button
              onClick={handlePreview}
              disabled={!file || loading}
              style={{
                padding: '12px 24px', background: file && !loading ? BT.text.cyan : BT.bg.panelAlt,
                color: file && !loading ? BT.bg.terminal : BT.text.muted,
                border: 'none', cursor: file && !loading ? 'pointer' : 'not-allowed',
                ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              }}
            >
              {loading ? 'PARSING…' : '▶ PREVIEW IMPORT'}
            </button>
          </div>
        )}

        {/* ── Phase: Preview ── */}
        {phase === 'preview' && preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Summary bar */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'TOTAL', val: preview.totalRows, color: BT.text.primary },
                { label: 'VALID', val: preview.validRows, color: BT.text.green },
                { label: 'INVALID', val: preview.invalidRows, color: preview.invalidRows > 0 ? BT.text.red : BT.text.muted },
                { label: 'DUPLICATE', val: preview.duplicateRows, color: preview.duplicateRows > 0 ? BT.text.amber : BT.text.muted },
                { label: 'TYPE', val: COMP_TYPE_LABELS[preview.compType], color: BT.text.cyan },
              ].map(item => (
                <div key={item.label} style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, padding: '8px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: item.color, ...mono }}>{item.val}</div>
                  <div style={{ fontSize: 8, color: BT.text.muted, ...mono, letterSpacing: 0.5 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Preview table */}
            <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, overflowX: 'auto' }}>
              {/* Header */}
              <div style={{ display: 'flex', padding: '8px 12px', borderBottom: `1px solid ${BT.border.medium}`, background: BT.bg.header, minWidth: 600 }}>
                {[
                  { label: 'STATUS', w: '8%' },
                  { label: 'ADDRESS', w: '30%' },
                  { label: 'CITY / STATE', w: '16%' },
                  { label: 'UNITS', w: '8%' },
                  { label: preview.compType === 'sale' ? 'SALE DATE' : preview.compType === 'rent' ? 'AS-OF DATE' : 'PERIOD', w: '14%' },
                  { label: preview.compType === 'sale' ? 'PRICE/UNIT' : preview.compType === 'rent' ? 'ASK RENT/U' : 'ASK RENT/U', w: '12%' },
                  { label: preview.compType === 'sale' ? 'CAP RATE' : 'OCC %', w: '10%' },
                ].map(h => (
                  <div key={h.label} style={{ width: h.w, fontSize: 8, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5, ...mono }}>
                    {h.label}
                  </div>
                ))}
              </div>

              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {preview.rows.map((row, i) => (
                  <div
                    key={row.rowIndex}
                    style={{
                      display: 'flex', padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`,
                      background: !row.isValid ? BT.text.red + '10' : row.isDuplicate ? BT.text.amber + '10' : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                      minWidth: 600,
                    }}
                  >
                    <div style={{ width: '8%' }}>
                      <span style={{
                        fontSize: 8, fontWeight: 700, ...mono,
                        color: !row.isValid ? BT.text.red : row.isDuplicate ? BT.text.amber : BT.text.green,
                      }}>
                        {!row.isValid ? '✗ INVALID' : row.isDuplicate ? '⚠ DUP' : '✓ OK'}
                      </span>
                    </div>
                    <div style={{ width: '30%', fontSize: 10, color: BT.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.address}
                      {row.validationError && <div style={{ fontSize: 8, color: BT.text.red, ...mono }}>{row.validationError}</div>}
                    </div>
                    <div style={{ width: '16%', fontSize: 9, color: BT.text.secondary, ...mono }}>{row.city}{row.state ? `, ${row.state}` : ''}</div>
                    <div style={{ width: '8%', fontSize: 9, color: BT.text.muted, ...mono }}>{row.units ?? '—'}</div>
                    <div style={{ width: '14%', fontSize: 9, color: BT.text.muted, ...mono }}>
                      {preview.compType === 'sale' ? row.saleDate : preview.compType === 'rent' ? row.snapshotDate : row.periodDate ?? '—'}
                    </div>
                    <div style={{ width: '12%', fontSize: 9, color: BT.text.muted, ...mono }}>
                      {preview.compType === 'sale'
                        ? fmt(row.pricePerUnit, '$')
                        : fmt(row.avgAskingRent ?? (row as any).askingRentPerUnit, '$')}
                    </div>
                    <div style={{ width: '10%', fontSize: 9, color: BT.text.muted, ...mono }}>
                      {preview.compType === 'sale'
                        ? (row.capRate != null ? `${row.capRate.toFixed(1)}%` : '—')
                        : (row.occupancyPct != null ? `${row.occupancyPct.toFixed(1)}%` : '—')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ background: BT.text.red + '18', border: `1px solid ${BT.text.red}44`, padding: '10px 14px', fontSize: 10, color: BT.text.red, ...mono }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setPhase('upload'); setPreview(null); setError(null); }}
                style={{ padding: '10px 20px', background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.medium}`, cursor: 'pointer', ...mono, fontSize: 10 }}
              >
                ← BACK
              </button>
              <button
                onClick={handleCommit}
                disabled={preview.validRows === 0 || loading}
                style={{
                  flex: 1, padding: '10px 20px',
                  background: preview.validRows > 0 && !loading ? BT.text.green : BT.bg.panelAlt,
                  color: preview.validRows > 0 && !loading ? BT.bg.terminal : BT.text.muted,
                  border: 'none', cursor: preview.validRows > 0 && !loading ? 'pointer' : 'not-allowed',
                  ...mono, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                }}
              >
                {loading ? 'IMPORTING…' : `⬆ IMPORT ${preview.validRows} VALID ROWS`}
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Committed ── */}
        {phase === 'committed' && commitResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: BT.text.green + '12', border: `1px solid ${BT.text.green}44`, padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: BT.text.green, ...mono, marginBottom: 4 }}>
                IMPORT COMPLETE
              </div>
              <div style={{ fontSize: 10, color: BT.text.secondary, ...mono }}>
                {commitResult.inserted} rows inserted into {COMP_TYPE_LABELS[commitResult.compType]}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'INSERTED', val: commitResult.inserted, color: BT.text.green },
                { label: 'SKIPPED (DUP)', val: commitResult.skippedDup, color: BT.text.amber },
                { label: 'SKIPPED (ERR)', val: commitResult.skippedInvalid, color: commitResult.skippedInvalid > 0 ? BT.text.red : BT.text.muted },
              ].map(item => (
                <div key={item.label} style={{ flex: 1, background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: item.color, ...mono }}>{item.val}</div>
                  <div style={{ fontSize: 8, color: BT.text.muted, ...mono, letterSpacing: 0.5 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {commitResult.errors.length > 0 && (
              <div style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, maxHeight: 160, overflowY: 'auto' }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, fontSize: 9, fontWeight: 700, color: BT.text.muted, ...mono, letterSpacing: 0.5 }}>ROW ERRORS</div>
                {commitResult.errors.slice(0, 20).map((e, i) => (
                  <div key={i} style={{ padding: '6px 12px', borderBottom: `1px solid ${BT.border.subtle}`, fontSize: 9, ...mono }}>
                    <span style={{ color: BT.text.amber }}>Row {e.row}</span>
                    <span style={{ color: BT.text.muted }}> · {e.address} · </span>
                    <span style={{ color: BT.text.red }}>{e.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setPhase('upload'); setPreview(null); setCommitResult(null); setFile(null); setError(null); }}
                style={{ flex: 1, padding: '10px 20px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', cursor: 'pointer', ...mono, fontSize: 10, fontWeight: 700 }}
              >
                ⬆ UPLOAD ANOTHER FILE
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  style={{ padding: '10px 20px', background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.medium}`, cursor: 'pointer', ...mono, fontSize: 10 }}
                >
                  CLOSE
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
