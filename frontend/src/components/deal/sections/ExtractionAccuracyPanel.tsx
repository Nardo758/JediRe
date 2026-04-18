import React, { useState, useCallback } from 'react';
import { apiClient } from '../../../services/api.client';
import { BT } from '../bloomberg-ui';

interface AccuracyCheck {
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
  extracted?: number | null;
  stated?: number | null;
  variancePct?: number | null;
}

interface DocumentAccuracy {
  documentId: string;
  documentType: string;
  fileName: string;
  overallScore: number;
  checks: AccuracyCheck[];
  customLineItems?: Array<{ label: string; amount: number }>;
  warnings: string[];
}

interface Props {
  dealId: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pass: { color: '#00d4aa', icon: '✓', label: 'Pass' },
  warn: { color: '#f59e0b', icon: '⚠', label: 'Warning' },
  fail: { color: '#ef4444', icon: '✗', label: 'Fail' },
  info: { color: '#60a5fa', icon: 'ℹ', label: 'Info' },
};

function scoreColor(score: number): string {
  if (score >= 85) return '#00d4aa';
  if (score >= 65) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'High Confidence';
  if (score >= 65) return 'Review Recommended';
  return 'Needs Attention';
}

function fmt$(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

const DocTypeLabel: Record<string, string> = {
  T12: 'T12 Operating Statement',
  RENT_ROLL: 'Rent Roll',
  TAX_BILL: 'Tax Bill',
};

export const ExtractionAccuracyPanel: React.FC<Props> = ({ dealId }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DocumentAccuracy[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (report) { setOpen(true); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/extraction-accuracy`);
      setReport(res.data.data ?? []);
      setOpen(true);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to load accuracy report');
    } finally {
      setLoading(false);
    }
  }, [dealId, report]);

  return (
    <>
      <button
        onClick={load}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          background: 'transparent',
          border: `1px solid ${BT.border.subtle}`,
          borderRadius: '4px',
          color: BT.text.secondary,
          fontSize: '11px',
          fontFamily: BT.font.mono,
          cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: '0.05em',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = BT.text.cyan;
          (e.currentTarget as HTMLButtonElement).style.color = BT.text.cyan;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = BT.border.subtle;
          (e.currentTarget as HTMLButtonElement).style.color = BT.text.secondary;
        }}
      >
        <span style={{ fontSize: '13px' }}>◎</span>
        {loading ? 'VERIFYING...' : 'VERIFY EXTRACTION'}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: '8px',
              width: '100%',
              maxWidth: '760px',
              maxHeight: '80vh',
              overflowY: 'auto',
              fontFamily: BT.font.mono,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${BT.border.subtle}`,
            }}>
              <div>
                <div style={{ color: BT.text.cyan, fontSize: '12px', letterSpacing: '0.1em' }}>
                  EXTRACTION ACCURACY REPORT
                </div>
                <div style={{ color: BT.text.secondary, fontSize: '10px', marginTop: '2px' }}>
                  Verifies extracted data against document totals and internal consistency
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none', color: BT.text.secondary,
                  fontSize: '18px', cursor: 'pointer', padding: '4px 8px',
                }}
              >×</button>
            </div>

            {/* Error state */}
            {error && (
              <div style={{ padding: '20px', color: '#ef4444', fontSize: '12px' }}>
                {error}
              </div>
            )}

            {/* No documents */}
            {report && report.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: BT.text.secondary, fontSize: '12px' }}>
                No processed documents found. Upload and process documents to see accuracy metrics.
              </div>
            )}

            {/* Report */}
            {report && report.map((doc, di) => (
              <div key={doc.documentId} style={{ padding: '20px', borderBottom: di < report.length - 1 ? `1px solid ${BT.border.subtle}` : 'none' }}>
                {/* Document header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ color: BT.text.primary, fontSize: '13px', fontWeight: 600 }}>
                      {DocTypeLabel[doc.documentType] ?? doc.documentType}
                    </div>
                    <div style={{ color: BT.text.muted, fontSize: '10px', marginTop: '2px' }}>
                      {doc.fileName}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: scoreColor(doc.overallScore),
                      lineHeight: 1,
                    }}>
                      {doc.overallScore}
                    </div>
                    <div style={{ fontSize: '9px', color: scoreColor(doc.overallScore), marginTop: '2px', letterSpacing: '0.05em' }}>
                      {scoreLabel(doc.overallScore)}
                    </div>
                  </div>
                </div>

                {/* Score bar */}
                <div style={{ height: '3px', background: BT.bg.terminal, borderRadius: '2px', marginBottom: '16px' }}>
                  <div style={{
                    height: '100%',
                    width: `${doc.overallScore}%`,
                    background: scoreColor(doc.overallScore),
                    borderRadius: '2px',
                    transition: 'width 0.6s ease',
                  }} />
                </div>

                {/* Checks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {doc.checks.map((check, ci) => {
                    const cfg = STATUS_CONFIG[check.status];
                    return (
                      <div
                        key={ci}
                        style={{
                          display: 'flex',
                          gap: '10px',
                          padding: '10px 12px',
                          background: BT.bg.terminal,
                          borderRadius: '4px',
                          borderLeft: `3px solid ${cfg.color}`,
                        }}
                      >
                        <span style={{ color: cfg.color, fontSize: '14px', flexShrink: 0, lineHeight: 1.4 }}>
                          {cfg.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ color: BT.text.primary, fontSize: '11px', fontWeight: 600 }}>
                              {check.label}
                            </span>
                            {check.variancePct != null && check.variancePct > 0.01 && (
                              <span style={{
                                fontSize: '9px',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: `${cfg.color}20`,
                                color: cfg.color,
                              }}>
                                {(check.variancePct * 100).toFixed(1)}% delta
                              </span>
                            )}
                          </div>
                          <div style={{ color: BT.text.secondary, fontSize: '10px', lineHeight: 1.5 }}>
                            {check.detail}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom line items */}
                {doc.customLineItems && doc.customLineItems.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{
                      fontSize: '10px',
                      color: BT.text.muted,
                      letterSpacing: '0.08em',
                      marginBottom: '8px',
                    }}>
                      CUSTOM GL LINES ADDED TO PROFORMA
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {doc.customLineItems.map((item, ii) => (
                        <div key={ii} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: '#60a5fa10',
                          border: `1px solid #60a5fa30`,
                          borderRadius: '3px',
                          fontSize: '10px',
                        }}>
                          <span style={{ color: BT.text.secondary }}>{item.label}</span>
                          <span style={{ color: '#60a5fa', fontWeight: 600 }}>{fmt$(item.amount)}/yr</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {doc.warnings.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    {doc.warnings.map((w, wi) => (
                      <div key={wi} style={{
                        fontSize: '10px',
                        color: '#f59e0b',
                        padding: '4px 0',
                        borderTop: wi === 0 ? `1px solid ${BT.border.subtle}` : 'none',
                        paddingTop: wi === 0 ? '12px' : '4px',
                      }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div style={{ padding: '12px 20px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '10px', color: BT.text.muted }}>
                Scores update automatically after each document reprocess
              </div>
              <button
                onClick={() => { setReport(null); load(); }}
                style={{
                  background: 'none', border: `1px solid ${BT.border.subtle}`,
                  color: BT.text.secondary, fontSize: '10px', fontFamily: BT.font.mono,
                  padding: '4px 10px', borderRadius: '3px', cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                REFRESH
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExtractionAccuracyPanel;
