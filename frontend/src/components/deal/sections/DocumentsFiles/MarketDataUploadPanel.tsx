/**
 * MarketDataUploadPanel
 *
 * Vendor-aware upload panel for the Market Data category. Pulls the accepted
 * file-type list from the vendor registry API — no vendor names are hardcoded
 * here. Adding a new vendor to the backend registry automatically makes it
 * appear in this panel.
 *
 * Flow:
 *   1. Fetch vendor file types from GET /api/v1/vendor-registry/file-types
 *   2. Operator drops or browses for a file
 *   3. Classify filename via GET /api/v1/vendor-registry/classify?filename=…
 *   4. Show classification hint (or "unknown type" if no match)
 *   5. Operator confirms → POST /api/v1/deals/:dealId/files with category='market'
 *   6. Show success confirmation
 */

import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../../../../services/api.client';
import { BT } from '../../bloomberg-ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VendorFileTypeInfo {
  documentType: string;
  label: string;
}

interface VendorInfo {
  vendorId: string;
  displayName: string;
  licensePosture: string;
  cadence: string;
  fileTypes: VendorFileTypeInfo[];
}

interface ClassifyResult {
  matched: boolean;
  confidence?: number;
  vendorId?: string;
  displayName?: string;
  documentType?: string;
  label?: string;
}

type UploadStep = 'idle' | 'classifying' | 'ready' | 'uploading' | 'done' | 'error';

// ── MarketDataUploadPanel ─────────────────────────────────────────────────────

export function MarketDataUploadPanel({
  dealId,
  submarketId,
  onUploaded,
}: {
  dealId: string;
  submarketId?: string;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [vendors, setVendors] = useState<VendorInfo[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [classify, setClassify] = useState<ClassifyResult | null>(null);
  const [step, setStep] = useState<UploadStep>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  // Fetch vendor list on mount
  useEffect(() => {
    apiClient.get('/api/v1/vendor-registry/file-types')
      .then(r => setVendors(r.data?.vendors ?? []))
      .catch(() => setVendors([]))
      .finally(() => setLoadingVendors(false));
  }, []);

  async function handleFileSelect(selected: File) {
    setFile(selected);
    setClassify(null);
    setStep('classifying');
    setErrorMsg(null);
    try {
      const r = await apiClient.get<ClassifyResult>(
        `/api/v1/vendor-registry/classify?filename=${encodeURIComponent(selected.name)}`
      );
      setClassify(r.data);
    } catch {
      setClassify({ matched: false });
    }
    setStep('ready');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }

  async function handleUpload() {
    if (!file || step === 'uploading') return;
    setStep('uploading');
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append('files', file);
      fd.append('category', 'market');
      if (submarketId) fd.append('submarketId', submarketId);
      await apiClient.post(`/api/v1/deals/${dealId}/files`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedName(file.name);
      setStep('done');
      onUploaded();
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.error ?? e?.message ?? 'Upload failed.');
      setStep('error');
    }
  }

  function reset() {
    setFile(null);
    setClassify(null);
    setStep('idle');
    setErrorMsg(null);
    setUploadedName(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const cadenceLabel = (c: string) =>
    c === 'quarterly' ? 'Quarterly' : c === 'monthly' ? 'Monthly' : c === 'annual' ? 'Annual' : c;

  const postureColor = (p: string) =>
    p === 'restricted' ? BT.text.red : p === 'platform_only' ? BT.text.amber : BT.text.green;

  const confidencePct = classify?.confidence != null
    ? Math.round(classify.confidence * 100) : null;

  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.subtle}`,
      padding: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, fontFamily: BT.font.mono, letterSpacing: 0.5 }}>
        MARKET DATA FEEDS
      </div>

      {/* ── Accepted types from registry ─────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono, letterSpacing: 0.3 }}>
          ACCEPTED FORMATS
        </div>
        {loadingVendors ? (
          <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono }}>loading registry…</div>
        ) : vendors.length === 0 ? (
          <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono }}>no vendors registered</div>
        ) : (
          vendors.map(v => (
            <div key={v.vendorId} style={{
              background: BT.bg.panelAlt,
              border: `1px solid ${BT.border.subtle}`,
              padding: '6px 8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                  {v.displayName}
                </span>
                <span style={{
                  fontSize: 7, padding: '1px 5px',
                  background: postureColor(v.licensePosture) + '22',
                  color: postureColor(v.licensePosture),
                  fontFamily: BT.font.mono,
                }}>
                  {v.licensePosture === 'platform_only' ? 'PLATFORM ONLY' : v.licensePosture.toUpperCase()}
                </span>
                <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: BT.font.mono, marginLeft: 'auto' }}>
                  {cadenceLabel(v.cadence)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {v.fileTypes.map(ft => (
                  <div key={ft.documentType} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 7, color: BT.text.cyan, fontFamily: BT.font.mono }}>›</span>
                    <span style={{ fontSize: 8, color: BT.text.secondary, fontFamily: BT.font.mono }}>{ft.label}</span>
                    <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: BT.font.mono, marginLeft: 'auto' }}>
                      .xlsx / .csv
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Upload area ──────────────────────────────────────────────────── */}
      {step === 'done' ? (
        <div style={{
          padding: '10px 12px',
          background: BT.text.green + '11',
          border: `1px solid ${BT.text.green}44`,
          fontFamily: BT.font.mono, fontSize: 9,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{ color: BT.text.green }}>✓ UPLOADED — {uploadedName}</span>
          {classify?.matched && (
            <span style={{ color: BT.text.muted, fontSize: 8 }}>
              Detected: {classify.displayName} › {classify.label}
            </span>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 4, background: 'transparent',
              border: `1px solid ${BT.border.subtle}`,
              color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 8,
              padding: '3px 8px', cursor: 'pointer', alignSelf: 'flex-start',
            }}
          >
            Upload another
          </button>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? BT.text.cyan + '88' : BT.border.medium}`,
              padding: '16px 12px',
              textAlign: 'center',
              cursor: 'pointer',
              background: file ? BT.text.cyan + '08' : BT.bg.panelAlt,
              transition: 'all 0.15s',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,.xls"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {!file ? (
              <>
                <div style={{ fontSize: 20, opacity: 0.4, marginBottom: 4 }}>📊</div>
                <div style={{ fontSize: 9, color: BT.text.secondary, fontFamily: BT.font.mono }}>
                  Drop market data export here or click to browse
                </div>
                <div style={{ fontSize: 7, color: BT.text.muted, marginTop: 3, fontFamily: BT.font.mono }}>
                  .xlsx · .csv · .xls
                </div>
              </>
            ) : (
              <div style={{ fontSize: 9, color: BT.text.primary, fontFamily: BT.font.mono }}>
                📄 {file.name}
              </div>
            )}
          </div>

          {/* Classification hint */}
          {step === 'classifying' && (
            <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono }}>
              classifying…
            </div>
          )}

          {step === 'ready' && classify && (
            <div style={{
              padding: '6px 10px',
              background: classify.matched
                ? BT.text.cyan + '11'
                : BT.text.muted + '11',
              border: `1px solid ${classify.matched ? BT.text.cyan + '44' : BT.border.subtle}`,
              fontFamily: BT.font.mono, fontSize: 8,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {classify.matched ? (
                <>
                  <span style={{ color: BT.text.cyan }}>
                    ⬡ {classify.displayName} › {classify.label}
                  </span>
                  {confidencePct != null && (
                    <span style={{ color: BT.text.muted, fontSize: 7 }}>
                      filename match · {confidencePct}% confidence
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: BT.text.muted }}>
                  Type not auto-detected — will be classified on ingest
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {step === 'error' && errorMsg && (
            <div style={{
              padding: '6px 10px',
              background: BT.text.red + '11',
              border: `1px solid ${BT.text.red + '44'}`,
              color: BT.text.red, fontFamily: BT.font.mono, fontSize: 8,
            }}>
              ✗ {errorMsg}
            </div>
          )}

          {/* Upload button */}
          {file && (step === 'ready' || step === 'error') && (
            <button
              onClick={handleUpload}
              style={{
                padding: '7px 14px',
                background: BT.text.cyan,
                color: BT.bg.terminal,
                border: 'none', cursor: 'pointer',
                fontFamily: BT.font.mono, fontSize: 9, fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              📤 INGEST MARKET DATA
            </button>
          )}

          {step === 'uploading' && (
            <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono }}>
              uploading…
            </div>
          )}
        </>
      )}
    </div>
  );
}
