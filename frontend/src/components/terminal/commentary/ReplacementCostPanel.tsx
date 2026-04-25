import React, { useEffect, useState } from 'react';
import { BT } from '../theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface ProvenanceRow {
  id: string;
  sourceFileId: number | null;
  propertyName: string | null;
  units: number | null;
  yearBuilt: number | null;
  replacementCostPerUnit: number | null;
  totalReplacementCost: number | null;
  hardCostPsf: number | null;
  capturedAt: string;
}

interface CostResponse {
  entityType: 'msa' | 'submarket';
  entityId: string;
  canonicalKey: string;
  entityName: string | null;
  sampleSize: number;
  perUnit: { median: number | null; p25: number | null; p75: number | null; min: number | null; max: number | null };
  totalReplacementCostMedian: number | null;
  hardCostPsfMedian: number | null;
  provenance: ProvenanceRow[];
}

interface ReplacementCostPanelProps {
  entityType: 'msa' | 'submarket';
  entityId: string;
  refreshNonce?: number;
}

const fmtMoney = (n: number | null): string => {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

export const ReplacementCostPanel: React.FC<ReplacementCostPanelProps> = ({
  entityType, entityId, refreshNonce,
}) => {
  const [data, setData] = useState<CostResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('authToken') ?? '';
    fetch(`/api/v1/replacement-cost/${entityType}/${encodeURIComponent(entityId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CostResponse>;
      })
      .then(j => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId, refreshNonce]);

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: BT.text.amber,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: `1px solid ${BT.text.amber}44`,
        paddingBottom: 4, marginBottom: 8, ...mono,
      }}>
        Replacement Cost
      </div>

      {loading && <div style={{ fontSize: 11, color: BT.text.muted, ...mono }}>Loading…</div>}
      {error && !loading && <div style={{ fontSize: 11, color: BT.accent.red, ...mono }}>{error}</div>}

      {!loading && !error && data && (
        <>
          {data.sampleSize === 0 ? (
            <div style={{ fontSize: 11, color: BT.text.muted, lineHeight: 1.5 }}>
              No replacement-cost data extracted from broker OMs for this market yet.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Row label="Median / unit"   value={fmtMoney(data.perUnit.median)} accent={BT.text.cyan} />
                <Row label="P25 / unit"      value={fmtMoney(data.perUnit.p25)} />
                <Row label="P75 / unit"      value={fmtMoney(data.perUnit.p75)} />
                <Row label="Total RC median" value={fmtMoney(data.totalReplacementCostMedian)} />
                <Row label="Hard cost PSF"   value={data.hardCostPsfMedian == null ? '—' : `$${data.hardCostPsfMedian.toFixed(0)}`} />
                <Row label="Sample size"     value={`n=${data.sampleSize}`} accent={BT.text.muted} />
              </div>

              {data.provenance.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, color: BT.text.muted, ...mono, marginBottom: 4, textTransform: 'uppercase' }}>
                    Recent sources
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {data.provenance.slice(0, 5).map(p => (
                      <div key={p.id} style={{ fontSize: 10, color: BT.text.secondary, ...mono, lineHeight: 1.4 }}>
                        {p.propertyName ?? `File #${p.sourceFileId ?? '—'}`}{p.units ? ` · ${p.units}u` : ''}{' · '}
                        <span style={{ color: BT.text.cyan }}>{fmtMoney(p.replacementCostPerUnit)}/u</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, ...mono }}>
    <span style={{ color: BT.text.muted }}>{label}</span>
    <span style={{ color: accent ?? BT.text.primary, fontWeight: 600 }}>{value}</span>
  </div>
);

export default ReplacementCostPanel;
