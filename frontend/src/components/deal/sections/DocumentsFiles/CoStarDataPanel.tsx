/**
 * CoStarDataPanel — CoStar export upload panel for the Documents Vault
 *
 * Handles three data types via tabs:
 *   1. Sale Comps        — preview → review → commit to market_sale_comps
 *   2. Rent Comps        — preview → review → commit to market_rent_comps
 *   3. Submarket Performance — stored in deal vault (category='costar')
 */

import React, { useState, useRef } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { apiClient } from '../../../../services/api.client';
import { BT } from '../../bloomberg-ui';

// ── Types ──────────────────────────────────────────────────────────────────────

type CompTab = 'sale' | 'rent' | 'submarket';
type UploadStep = 'select' | 'previewing' | 'review' | 'committing' | 'done';

interface CommitResult {
  compType: 'sale' | 'rent';
  totalRows: number;
  inserted: number;
  skippedDup: number;
  skippedInvalid: number;
  errors: Array<{ row: number; address: string; reason: string }>;
  rejected: boolean;
  rejectReason?: string;
}

interface PreviewRow {
  rowIndex: number;
  propertyName: string | null;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  submarket: string | null;
  units: number | null;
  yearBuilt: number | null;
  assetClass: string | null;
  saleDate: string | null;
  salePrice: number | null;
  pricePerUnit: number | null;
  capRate: number | null;
  noi: number | null;
  snapshotDate: string | null;
  avgAskingRent: number | null;
  avgEffectiveRent: number | null;
  occupancyPct: number | null;
  isValid: boolean;
  validationError: string | null;
  isDuplicate: boolean;
}

interface PreviewResult {
  compType: 'sale' | 'rent';
  detectedCompType: 'sale' | 'rent' | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: PreviewRow[];
  rejected: boolean;
  rejectReason?: string;
}

interface RowState {
  assetClass: string | null;
  excluded: boolean;
  overwriteDuplicate: boolean;
}

// ── Shared table styles ────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '5px 8px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: '#6b7280',
  borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', background: '#f9fafb',
};
const TD: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12, color: '#374151',
  borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap',
};

// ── ReviewTable ────────────────────────────────────────────────────────────────

function ReviewTable({
  preview,
  rowStates,
  onRowChange,
}: {
  preview: PreviewResult;
  rowStates: Map<number, RowState>;
  onRowChange: (rowIndex: number, patch: Partial<RowState>) => void;
}) {
  const isSale = preview.compType === 'sale';

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              <th style={TH}>INCL.</th>
              <th style={TH}>ADDRESS</th>
              <th style={TH}>CITY / ST</th>
              {isSale ? (
                <>
                  <th style={TH}>SALE DATE</th>
                  <th style={{ ...TH, textAlign: 'right' }}>PRICE</th>
                  <th style={{ ...TH, textAlign: 'right' }}>PPU</th>
                  <th style={{ ...TH, textAlign: 'right' }}>CAP%</th>
                  <th style={{ ...TH, textAlign: 'right' }}>NOI</th>
                </>
              ) : (
                <>
                  <th style={{ ...TH, textAlign: 'right' }}>ASK RENT</th>
                  <th style={{ ...TH, textAlign: 'right' }}>EFF RENT</th>
                  <th style={{ ...TH, textAlign: 'right' }}>OCC%</th>
                </>
              )}
              <th style={TH}>CLASS</th>
              <th style={TH}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map(row => {
              const rs = rowStates.get(row.rowIndex) ?? {
                assetClass: row.assetClass,
                excluded: !row.isValid,
                overwriteDuplicate: false,
              };
              const isExcluded = rs.excluded;
              const rowBg = !row.isValid
                ? '#fee2e222'
                : row.isDuplicate
                ? '#fef3c722'
                : 'transparent';

              return (
                <tr key={row.rowIndex} style={{ backgroundColor: rowBg, opacity: isExcluded ? 0.45 : 1 }}>
                  <td style={TD}>
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      disabled={!row.isValid}
                      onChange={e => onRowChange(row.rowIndex, { excluded: !e.target.checked })}
                      style={{ cursor: row.isValid ? 'pointer' : 'not-allowed', accentColor: '#3b82f6' }}
                    />
                  </td>
                  <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span title={row.address}>{row.address}</span>
                  </td>
                  <td style={TD}>{row.city}, {row.state}</td>
                  {isSale ? (
                    <>
                      <td style={TD}>{row.saleDate ?? '—'}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.salePrice != null ? `$${row.salePrice.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.pricePerUnit != null ? `$${Math.round(row.pricePerUnit).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.capRate != null ? `${row.capRate.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.noi != null ? `$${Math.round(row.noi).toLocaleString()}` : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.avgAskingRent != null ? `$${Math.round(row.avgAskingRent).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.avgEffectiveRent != null ? `$${Math.round(row.avgEffectiveRent).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.occupancyPct != null ? `${row.occupancyPct.toFixed(1)}%` : '—'}
                      </td>
                    </>
                  )}
                  <td style={TD}>
                    <select
                      value={rs.assetClass ?? ''}
                      onChange={e => onRowChange(row.rowIndex, { assetClass: e.target.value || null })}
                      disabled={isExcluded}
                      style={{
                        fontSize: 11, padding: '2px 4px',
                        backgroundColor: rs.assetClass == null ? '#fef3c7' : '#fff',
                        border: `1px solid ${rs.assetClass == null ? '#d97706' : '#d1d5db'}`,
                        color: '#374151', borderRadius: 3,
                        cursor: isExcluded ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="">—</option>
                      {['A', 'B', 'C', 'D'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td style={TD}>
                    {!row.isValid ? (
                      <span style={{ color: '#ef4444', fontSize: 11 }} title={row.validationError ?? ''}>INVALID</span>
                    ) : row.isDuplicate ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#d97706', fontSize: 11 }}>DUP</span>
                        {!isExcluded && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={rs.overwriteDuplicate}
                              onChange={e => onRowChange(row.rowIndex, { overwriteDuplicate: e.target.checked })}
                              style={{ accentColor: '#d97706' }}
                            />
                            <span style={{ fontSize: 10, color: '#d97706' }}>OVR</span>
                          </label>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#16a34a', fontSize: 11 }}>OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>
        {preview.totalRows} row{preview.totalRows !== 1 ? 's' : ''} total
        {preview.duplicateRows > 0 && ` · ${preview.duplicateRows} duplicate${preview.duplicateRows !== 1 ? 's' : ''} detected`}
        {preview.invalidRows > 0 && ` · ${preview.invalidRows} invalid (auto-excluded)`}
      </div>
    </div>
  );
}

// ── CompUploadPane (sale / rent) ───────────────────────────────────────────────

function CompUploadPane({
  dealId,
  compType,
  onUploaded,
}: {
  dealId: string;
  compType: 'sale' | 'rent';
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [snapshotDate, setSnapshotDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [panelError, setPanelError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [rowStates, setRowStates] = useState<Map<number, RowState>>(new Map());
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  function handleRowChange(rowIndex: number, patch: Partial<RowState>) {
    setRowStates(prev => {
      const next = new Map(prev);
      const existing = next.get(rowIndex);
      const base: RowState = existing ?? {
        assetClass: preview?.rows.find(r => r.rowIndex === rowIndex)?.assetClass ?? null,
        excluded: false,
        overwriteDuplicate: false,
      };
      next.set(rowIndex, { ...base, ...patch });
      return next;
    });
  }

  async function handlePreview() {
    if (!file) return;
    setStep('previewing');
    setPanelError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('comp_type', compType);
    fd.append('snapshot_date', snapshotDate);
    try {
      const res = await apiClient.post(
        `/api/v1/deals/${dealId}/valuation-grid/comps/preview`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const p: PreviewResult = res.data.data ?? res.data;
      if (p.rejected) {
        setPanelError(p.rejectReason ?? 'Preview failed.');
        setStep('select');
        return;
      }
      const initial = new Map<number, RowState>();
      for (const row of p.rows) {
        if (!row.isValid) {
          initial.set(row.rowIndex, { assetClass: null, excluded: true, overwriteDuplicate: false });
        }
      }
      setPreview(p);
      setRowStates(initial);
      setStep('review');
    } catch (e: any) {
      const serverData = e?.response?.data;
      if (serverData?.data?.rejected) {
        setPanelError(serverData.data.rejectReason ?? 'Preview failed.');
      } else {
        setPanelError(serverData?.error ?? e?.message ?? 'Preview failed.');
      }
      setStep('select');
    }
  }

  async function handleCommit() {
    if (!file || !preview) return;
    setStep('committing');
    setPanelError(null);

    const overrides: Array<{
      rowIndex: number;
      assetClass?: string | null;
      excluded: boolean;
      overwriteDuplicate: boolean;
    }> = [];
    for (const [rowIndex, rs] of rowStates.entries()) {
      overrides.push({ rowIndex, assetClass: rs.assetClass, excluded: rs.excluded, overwriteDuplicate: rs.overwriteDuplicate });
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('comp_type', preview.compType);
    fd.append('snapshot_date', snapshotDate);
    fd.append('overrides', JSON.stringify(overrides));

    try {
      const res = await apiClient.post(
        `/api/v1/deals/${dealId}/valuation-grid/comps/commit`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const r: CommitResult = res.data.data ?? res.data;
      setCommitResult(r);
      setStep('done');
      if (!r.rejected && r.inserted > 0) onUploaded();
    } catch (e: any) {
      const serverData = e?.response?.data?.data;
      if (serverData) {
        setCommitResult(serverData as CommitResult);
        setStep('done');
      } else {
        setPanelError(e?.response?.data?.error ?? e?.message ?? 'Commit failed.');
        setStep('review');
      }
    }
  }

  function reset() {
    setStep('select');
    setFile(null);
    setPreview(null);
    setRowStates(new Map());
    setCommitResult(null);
    setPanelError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const isPreviewing = step === 'previewing';
  const isCommitting = step === 'committing';

  return (
    <div>
      {panelError && (
        <div style={{
          marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 6,
          padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
        }}>
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: '#dc2626' }}>{panelError}</span>
        </div>
      )}

      {(step === 'select' || step === 'previewing') && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>FILE (CSV / XLSX)</div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => { setFile(e.target.files?.[0] ?? null); setPanelError(null); }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  fontSize: 12, padding: '6px 12px',
                  background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
                  color: file ? '#111827' : '#9ca3af', cursor: 'pointer',
                }}
              >
                {file ? file.name : 'Choose file…'}
              </button>
            </div>

            {compType === 'rent' && (
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  AS-OF DATE <span style={{ color: '#ef4444' }}>*</span>
                </div>
                <input
                  type="date"
                  value={snapshotDate}
                  onChange={e => setSnapshotDate(e.target.value)}
                  style={{
                    fontSize: 12, padding: '6px 8px',
                    background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151',
                  }}
                />
              </div>
            )}

            <button
              onClick={handlePreview}
              disabled={isPreviewing || !file}
              style={{
                fontSize: 12, padding: '6px 16px', fontWeight: 600,
                background: isPreviewing || !file ? '#e5e7eb' : '#2563eb',
                color: isPreviewing || !file ? '#9ca3af' : '#fff',
                border: 'none', borderRadius: 6,
                cursor: isPreviewing || !file ? 'not-allowed' : 'pointer',
              }}
            >
              {isPreviewing ? 'Parsing…' : 'Preview'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {compType === 'sale'
              ? 'CoStar CSV/XLSX — requires Address, City, State, Sale Date, Sale Price.'
              : 'CoStar CSV/XLSX — requires Address, City, State + As-of date.'}
          </div>
        </>
      )}

      {(step === 'review' || step === 'committing') && preview && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#16a34a' }}>● OK</span>
            <span style={{ fontSize: 11, color: '#d97706' }}>● DUP — existing comp; check OVR to overwrite</span>
            <span style={{ fontSize: 11, color: '#ef4444' }}>● INVALID — missing required fields; auto-excluded</span>
          </div>
          <ReviewTable preview={preview} rowStates={rowStates} onRowChange={handleRowChange} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              style={{
                fontSize: 12, padding: '6px 18px', fontWeight: 600,
                background: isCommitting ? '#e5e7eb' : '#16a34a',
                color: isCommitting ? '#9ca3af' : '#fff',
                border: 'none', borderRadius: 6, cursor: isCommitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isCommitting ? 'Committing…' : 'Commit'}
            </button>
            <button
              onClick={reset}
              disabled={isCommitting}
              style={{
                fontSize: 12, padding: '6px 12px',
                background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
                color: '#6b7280', cursor: isCommitting ? 'not-allowed' : 'pointer',
              }}
            >
              Back
            </button>
          </div>
        </>
      )}

      {step === 'done' && commitResult && (
        <div>
          {commitResult.rejected ? (
            <div style={{
              display: 'flex', gap: 8, padding: '10px 12px',
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
            }}>
              <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Commit rejected</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{commitResult.rejectReason}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
                {([
                  ['Type', commitResult.compType.toUpperCase()],
                  ['Total Rows', String(commitResult.totalRows)],
                  ['Inserted', String(commitResult.inserted)],
                  ['Skipped (dup)', String(commitResult.skippedDup)],
                  ['Skipped (invalid)', String(commitResult.skippedInvalid)],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                    <div style={{
                      fontSize: 16, fontWeight: 700,
                      color: label === 'Inserted' && Number(val) > 0 ? '#16a34a'
                        : label === 'Skipped (invalid)' && Number(val) > 0 ? '#dc2626'
                        : '#111827',
                    }}>{val}</div>
                  </div>
                ))}
              </div>
              {commitResult.errors.length > 0 && (
                <div style={{ maxHeight: 80, overflowY: 'auto', marginTop: 6 }}>
                  {commitResult.errors.slice(0, 20).map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#6b7280' }}>
                      Row {e.row} — {e.address}: {e.reason}
                    </div>
                  ))}
                  {commitResult.errors.length > 20 && (
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      … and {commitResult.errors.length - 20} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={reset}
              style={{
                fontSize: 12, padding: '5px 12px',
                background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
                color: '#6b7280', cursor: 'pointer',
              }}
            >
              Upload another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SubmarketUploadPane ────────────────────────────────────────────────────────

function SubmarketUploadPane({ dealId }: { dealId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneFile, setDoneFile] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setDoneFile(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', 'costar');
    fd.append('description', 'CoStar submarket performance export');
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/files`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDoneFile(file.name);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {error && (
        <div style={{
          marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 6,
          padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
        }}>
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>
        </div>
      )}

      {doneFile && (
        <div style={{
          marginBottom: 10, padding: '8px 12px',
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6,
          fontSize: 12, color: '#15803d',
        }}>
          ✓ <strong>{doneFile}</strong> stored in vault under CoStar category.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>FILE (CSV / XLSX)</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null); setDoneFile(null); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              fontSize: 12, padding: '6px 12px',
              background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
              color: file ? '#111827' : '#9ca3af', cursor: 'pointer',
            }}
          >
            {file ? file.name : 'Choose file…'}
          </button>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          style={{
            fontSize: 12, padding: '6px 16px', fontWeight: 600,
            background: uploading || !file ? '#e5e7eb' : '#2563eb',
            color: uploading || !file ? '#9ca3af' : '#fff',
            border: 'none', borderRadius: 6,
            cursor: uploading || !file ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#9ca3af' }}>
        CoStar submarket performance export (vacancy, rent, absorption, supply). Stored in vault for reference.
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

interface CoStarDataPanelProps {
  dealId: string;
  onCompsUploaded?: () => void;
}

export const CoStarDataPanel: React.FC<CoStarDataPanelProps> = ({ dealId, onCompsUploaded }) => {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<CompTab>('sale');

  const tabs: Array<{ id: CompTab; label: string }> = [
    { id: 'sale', label: 'Sale Comps' },
    { id: 'rent', label: 'Rent Comps' },
    { id: 'submarket', label: 'Submarket Performance' },
  ];

  return (
    <div style={{ border: `1px solid ${BT.border.medium}`, marginBottom: 8, overflow: 'hidden', background: BT.bg.panel }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: expanded ? BT.bg.active : BT.bg.panel,
          border: 'none', borderBottom: expanded ? `1px solid ${BT.border.subtle}` : 'none',
          borderTop: `2px solid ${BT.text.blue}`,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={14} style={{ color: BT.text.cyan }} />
          <span style={{ fontWeight: 700, fontSize: 11, color: BT.text.primary, fontFamily: BT.font.mono, letterSpacing: 0.5 }}>COSTAR EXPORTS</span>
          <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: BT.font.mono }}>Sale Comps · Rent Comps · Submarket Performance</span>
        </div>
        {expanded
          ? <ChevronDown size={14} style={{ color: BT.text.muted }} />
          : <ChevronRight size={14} style={{ color: BT.text.muted }} />
        }
      </button>

      {expanded && (
        <div style={{ padding: '14px 16px' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: '1px solid #e5e7eb' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontSize: 12, padding: '6px 14px',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                  color: activeTab === tab.id ? '#2563eb' : '#6b7280',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: 'pointer', marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'sale' && (
            <CompUploadPane dealId={dealId} compType="sale" onUploaded={() => onCompsUploaded?.()} />
          )}
          {activeTab === 'rent' && (
            <CompUploadPane dealId={dealId} compType="rent" onUploaded={() => onCompsUploaded?.()} />
          )}
          {activeTab === 'submarket' && (
            <SubmarketUploadPane dealId={dealId} />
          )}
        </div>
      )}
    </div>
  );
};
