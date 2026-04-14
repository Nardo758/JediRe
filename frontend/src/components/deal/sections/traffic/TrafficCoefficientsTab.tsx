import { useState, useEffect } from 'react';
import { AlertTriangle, Activity, Database, RefreshCw } from 'lucide-react';
import { apiClient } from '@/services/api.client';
import { BT } from '../../bloomberg-ui';

const MONO = BT.font.mono;

interface ComparisonEntry {
  calibrated: number;
  default: number;
  std_dev?: number;
}

interface CalibrationData {
  calibrated: boolean;
  sampleCount: number;
  lastUpdated: string | null;
  comparisons: Record<string, ComparisonEntry>;
  dataLibraryFileCount: number;
  matchTier?: string;
  nPeerProperties?: number;
  windowType?: 'TTM' | 'TTM-24';
  scopeLevel?: string;
}

interface CoefficientRow {
  key: string;
  label: string;
  description: string;
  format: 'pct' | 'decimal' | 'days';
  baseline: number;
  platform: number | null;
  thisDeal: number | null;
  sigma: number | null;
}

const BASELINE_DEFAULTS: Record<string, { label: string; description: string; baseline: number; format: 'pct' | 'decimal' | 'days' }> = {
  closing_ratio:      { label: 'Walk-in → Signed',    description: 'Walk-in visitors that convert to signed leases',       baseline: 0.35,  format: 'pct' },
  tour_conversion:    { label: 'Tour → Signed',        description: 'Scheduled tours that result in signed leases',         baseline: 0.45,  format: 'pct' },
  avg_days_to_lease:  { label: 'Days to Lease',        description: 'Avg days from first contact to executed lease',        baseline: 7,     format: 'days' },
  seasonal_factor:    { label: 'Seasonality Index',    description: 'Current month vs annual average (1.0 = neutral)',      baseline: 1.0,   format: 'decimal' },
  dow_factor:         { label: 'Day-of-Week Factor',   description: "Today's traffic vs weekly average (1.0 = neutral)",    baseline: 1.0,   format: 'decimal' },
  renewal_rate:       { label: 'Renewal Rate',         description: 'Proportion of expiring leases that renew in-place',   baseline: 0.55,  format: 'pct' },
};

function fmtVal(val: number | null | undefined, format: 'pct' | 'decimal' | 'days'): string {
  if (val === null || val === undefined) return '—';
  if (format === 'pct') return `${(val * 100).toFixed(1)}%`;
  if (format === 'days') return `${val.toFixed(1)}d`;
  return val.toFixed(3);
}

function zScore(thisDeal: number | null, platform: number | null, sigma: number | null): number | null {
  if (thisDeal === null || platform === null) return null;
  const effectiveSigma = sigma ?? (Math.abs(platform) * 0.15 || 0.001);
  return Math.abs(thisDeal - platform) / effectiveSigma;
}

function collisionSigmaLabel(z: number | null): string | null {
  if (z === null) return null;
  if (z >= 3.0) return `${z.toFixed(1)}σ — 3σ EXTREME DIVERGENCE`;
  if (z >= 2.0) return `${z.toFixed(1)}σ — SIGNIFICANT DIVERGENCE`;
  if (z >= 1.5) return `${z.toFixed(1)}σ — NOTABLE DIVERGENCE`;
  return null;
}

interface TrafficCoefficientsTabProps {
  dealId: string;
}

export default function TrafficCoefficientsTab({ dealId }: TrafficCoefficientsTabProps) {
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showRefresh = false) => {
    if (!dealId) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/leasing-traffic/weekly-report/${dealId}/calibration`);
      setCalibration(res.data);
    } catch {
      setCalibration(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [dealId]);

  const rows: CoefficientRow[] = Object.entries(BASELINE_DEFAULTS).map(([key, def]) => {
    const comp = calibration?.comparisons?.[key] ?? calibration?.comparisons?.[def.label] ?? null;
    return {
      key,
      label: def.label,
      description: def.description,
      format: def.format,
      baseline: def.baseline,
      platform: comp ? comp.default : null,
      thisDeal: comp ? comp.calibrated : null,
      sigma: comp?.std_dev ?? null,
    };
  });

  const extraKeys = calibration?.comparisons
    ? Object.keys(calibration.comparisons).filter(k => !BASELINE_DEFAULTS[k] && !Object.values(BASELINE_DEFAULTS).find(d => d.label === k))
    : [];
  extraKeys.forEach(k => {
    const comp = calibration!.comparisons[k];
    const isPct = k.toLowerCase().includes('ratio') || k.toLowerCase().includes('pct') || k.toLowerCase().includes('rate');
    rows.push({
      key: k,
      label: k.replace(/_/g, ' ').toUpperCase(),
      description: 'Calibrated coefficient',
      format: isPct ? 'pct' : 'decimal',
      baseline: comp.default,
      platform: comp.default,
      thisDeal: comp.calibrated,
      sigma: comp.std_dev ?? null,
    });
  });

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: BT.bg.terminal }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${BT.text.amber}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO }}>LOADING CALIBRATION DATA...</p>
      </div>
    );
  }

  const hasCalibration = calibration?.calibrated && Object.keys(calibration?.comparisons ?? {}).length > 0;

  return (
    <div style={{ background: BT.bg.terminal, display: 'flex', flexDirection: 'column', gap: 1 }}>

      {/* Header info strip */}
      <div style={{ background: BT.bg.header, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <Activity size={11} color={BT.text.purple} />
        <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.8, fontWeight: 700 }}>
          CONVERSION COEFFICIENTS — BAYESIAN RESOLUTION
        </span>
        {calibration?.sampleCount != null && calibration.sampleCount > 0 && (
          <span style={{ fontSize: 9, color: BT.text.cyan, fontFamily: MONO, marginLeft: 8 }}>
            {calibration.sampleCount} PEER PROPS
          </span>
        )}
        {calibration?.matchTier && (
          <span style={{ fontSize: 9, color: BT.text.purple, fontFamily: MONO }}>
            TIER: {calibration.matchTier}
          </span>
        )}
        {calibration?.windowType && (
          <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>
            WINDOW: {calibration.windowType}
          </span>
        )}
        {calibration?.lastUpdated && (
          <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, marginLeft: 'auto' }}>
            UPDATED {new Date(calibration.lastUpdated).toLocaleDateString()}
          </span>
        )}
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{ background: 'transparent', border: `1px solid ${BT.border.subtle}`, color: BT.text.muted, cursor: 'pointer', padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 9 }}
        >
          <RefreshCw size={9} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'LOADING' : 'REFRESH'}
        </button>
      </div>

      {/* Column header row */}
      <div style={{
        background: BT.bg.panelAlt,
        display: 'grid',
        gridTemplateColumns: '2fr 100px 110px 110px',
        padding: '5px 12px',
        borderBottom: `1px solid ${BT.border.medium}`,
        gap: 4,
      }}>
        <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, fontWeight: 700, letterSpacing: 1 }}>COEFFICIENT</span>
        <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO, fontWeight: 700, letterSpacing: 1, textAlign: 'right' }}>BASELINE</span>
        <span style={{ fontSize: 9, color: BT.text.cyan, fontFamily: MONO, fontWeight: 700, letterSpacing: 1, textAlign: 'right' }}>PLATFORM</span>
        <div style={{ textAlign: 'right', background: `${BT.text.amber}12`, border: `1px solid ${BT.text.amber}30`, padding: '1px 6px' }}>
          <span style={{ fontSize: 9, color: BT.text.amber, fontFamily: MONO, fontWeight: 700, letterSpacing: 1 }}>THIS DEAL ▶</span>
        </div>
      </div>

      {/* Coefficient rows */}
      {rows.map((row, i) => {
        const z = zScore(row.thisDeal, row.platform, row.sigma);
        const collisionLabel = collisionSigmaLabel(z);
        const hasCollision = collisionLabel !== null;
        const bg = i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt;
        const effectiveVal = row.thisDeal ?? row.platform;
        const dealColor = row.thisDeal !== null ? BT.text.amber : BT.text.muted;
        const platformColor = row.platform !== null ? BT.text.cyan : BT.text.muted;

        return (
          <div key={row.key}>
            <div style={{
              background: bg,
              display: 'grid',
              gridTemplateColumns: '2fr 100px 110px 110px',
              padding: '7px 12px',
              borderBottom: `1px solid ${BT.border.subtle}`,
              alignItems: 'center',
              gap: 4,
            }}>
              <div>
                <div style={{ fontSize: 10, color: BT.text.primary, fontFamily: MONO, fontWeight: 700 }}>{row.label}</div>
                <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, marginTop: 1 }}>{row.description}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO }}>{fmtVal(row.baseline, row.format)}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: platformColor, fontFamily: MONO }}>
                  {fmtVal(row.platform, row.format)}
                </span>
              </div>
              <div style={{ textAlign: 'right', background: row.thisDeal !== null ? `${BT.text.amber}0c` : 'transparent', padding: '2px 8px', border: row.thisDeal !== null ? `1px solid ${BT.text.amber}25` : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: dealColor, fontFamily: MONO }}>
                  {fmtVal(effectiveVal, row.format)}
                </span>
              </div>
            </div>

            {hasCollision && (
              <div style={{
                background: `${BT.text.amber}0a`,
                borderBottom: `1px solid ${BT.text.amber}30`,
                padding: '4px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <AlertTriangle size={10} color={BT.text.amber} />
                <span style={{ fontSize: 9, color: BT.text.amber, fontFamily: MONO }}>
                  COLLISION WARNING — {row.label}: THIS DEAL vs PLATFORM = {collisionLabel}. Deal-specific data deviates beyond expected range.
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {!hasCalibration && (
        <div style={{ background: BT.bg.panel, padding: '40px 24px', textAlign: 'center' }}>
          <Database size={28} style={{ color: BT.text.muted, margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontSize: 11, color: BT.text.secondary, fontFamily: MONO, marginBottom: 6 }}>NO CALIBRATION DATA AVAILABLE</p>
          <p style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>
            Showing industry baseline defaults. Upload weekly operator reports or select comp deals to enable coefficient calibration.
          </p>
        </div>
      )}

      {/* Legend footer */}
      <div style={{ background: BT.bg.header, padding: '5px 12px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${BT.border.subtle}` }}>
        <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>BASELINE = Industry model defaults</span>
        <span style={{ fontSize: 9, color: BT.text.cyan, fontFamily: MONO }}>PLATFORM = M07 submarket calibration</span>
        <span style={{ fontSize: 9, color: BT.text.amber, fontFamily: MONO }}>THIS DEAL ▶ = Resolved Bayesian blend</span>
        <span style={{ fontSize: 9, color: BT.text.amber, fontFamily: MONO, marginLeft: 'auto' }}>⚠ COLLISION = THIS DEAL vs PLATFORM &gt;1.5σ</span>
      </div>
    </div>
  );
}
