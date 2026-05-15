/**
 * WS-3 Layers 1+2+3 — Forward Supply Panel
 *
 * Displays projected MF developable capacity within 3mi and 5mi rings of the
 * deal site.  Each ring card shows:
 *
 *   Layer 1+2 (static):  MF-zoned parcels swept by PostGIS + building-envelope
 *                        capacity per parcel class.
 *   Layer 3 (trend):     Non-MF parcels weighted by rezone probability derived
 *                        from zoning_upzoning / entitlement_approval /
 *                        development_moratorium events in the submarket.
 *                        Phase A uses a linear event-density model.
 *
 * Data source: GET /api/v1/deals/:dealId/forward-supply
 */

import React, { useEffect, useState } from 'react';
import type { AxiosResponse } from 'axios';
import { Building2, RefreshCw, AlertCircle, MapPin, TrendingUp } from 'lucide-react';
import { apiClient } from '../../../services/api.client';

// ─────────────────────────── Types ──────────────────────────────────────────

interface TrendWeightedRing {
  trendWeightedCapacityUnits: number;
  probableRezoneParcels: {
    parcelId: string;
    theoreticalMFCapacity: number;
    rezoneProbability: number;
  }[];
}

interface ForwardSupplyRing {
  radiusMiles: 3 | 5;
  parcelCount: number;
  staticCapacityUnits: number;
  vacantUnits: number;
  underbuiltUnits: number;
  developedCount: number;
  parcelsByClass: { vacant: number; underbuilt: number; developed: number };
  staticByClass: { vacant: number; underbuilt: number; developed: number };
  trendWeighted: TrendWeightedRing;
}

interface ForwardSupplyParcel {
  parcelId: string;
  address: string | null;
  zoningCode: string | null;
  acreage: number;
  bindingUnitsPerAcre: number;
  allowedUnits: number;
  currentUse: 'vacant' | 'underbuilt' | 'developed';
  latentCapacityUnits: number;
  limitingFactor: string;
  distanceMiles: number;
  ring: 3 | 5;
}

interface TrendSignalMeta {
  submarketId: string | null;
  upzoningEventCount: number;
  approvalEventCount: number;
  moratoriumActive: boolean;
  moratoriumName: string | null;
  rezoneProbabilityBase: number;
  modelPhase: 'A_linear';
  nonMfParcelCount: number;
  nonMfSweepTruncated: boolean;
}

interface ForwardSupplyResponse {
  success: boolean;
  dealId: string;
  computedAt: string;
  rings: ForwardSupplyRing[];
  parcels: ForwardSupplyParcel[];
  metadata: {
    dealFound: boolean;
    lat: number | null;
    lng: number | null;
    hasCoordinates: boolean;
    parcelDataAvailable: boolean;
    municipality: string | null;
    mfZoningFilter: string;
    sweepTruncated: boolean;
    sweepTotalCount: number;
    trendSignal: TrendSignalMeta | null;
  };
}

interface Props {
  dealId?: string;
  deal?: Record<string, unknown>;
}

// ─────────────────────────── Styles / constants ──────────────────────────────

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const BG = '#0a0e1a';
const BG2 = '#111827';
const BG3 = '#0d1525';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#7f8ea3';
const TEXT_AMBER = '#F6AD55';
const TEXT_GREEN = '#68D391';
const TEXT_BLUE = '#63B3ED';
const TEXT_PURPLE = '#B794F4';
const TEXT_RED = '#FC8181';

const CLASS_COLORS: Record<'vacant' | 'underbuilt' | 'developed', string> = {
  vacant: TEXT_GREEN,
  underbuilt: TEXT_AMBER,
  developed: TEXT_SECONDARY,
};

const CLASS_LABELS: Record<'vacant' | 'underbuilt' | 'developed', string> = {
  vacant: 'VACANT',
  underbuilt: 'UNDERBUILT',
  developed: 'DEVELOPED',
};

// ─────────────────────────── Placeholder data ───────────────────────────────

const EMPTY_TREND_WEIGHTED: TrendWeightedRing = {
  trendWeightedCapacityUnits: 0,
  probableRezoneParcels: [],
};

const PLACEHOLDER_RINGS: ForwardSupplyRing[] = [
  {
    radiusMiles: 3,
    parcelCount: 0,
    staticCapacityUnits: 0,
    vacantUnits: 0,
    underbuiltUnits: 0,
    developedCount: 0,
    parcelsByClass: { vacant: 0, underbuilt: 0, developed: 0 },
    staticByClass: { vacant: 0, underbuilt: 0, developed: 0 },
    trendWeighted: EMPTY_TREND_WEIGHTED,
  },
  {
    radiusMiles: 5,
    parcelCount: 0,
    staticCapacityUnits: 0,
    vacantUnits: 0,
    underbuiltUnits: 0,
    developedCount: 0,
    parcelsByClass: { vacant: 0, underbuilt: 0, developed: 0 },
    staticByClass: { vacant: 0, underbuilt: 0, developed: 0 },
    trendWeighted: EMPTY_TREND_WEIGHTED,
  },
];

// ─────────────────────────── Sub-components ─────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function Stat({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string;
}) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 13, color, fontWeight: 700 }}>
        {value}
        <span style={{ fontSize: 8, fontWeight: 400, color: TEXT_SECONDARY, marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}

function RingCard({ ring, isLoading, trendSignal }: {
  ring: ForwardSupplyRing;
  isLoading: boolean;
  trendSignal: TrendSignalMeta | null;
}) {
  const totalLatent = ring.vacantUnits + ring.underbuiltUnits;
  const utilizationPct =
    ring.staticCapacityUnits > 0
      ? Math.round((1 - totalLatent / ring.staticCapacityUnits) * 100)
      : 0;

  const trendUnits = ring.trendWeighted.trendWeightedCapacityUnits;
  const totalWithTrend = ring.staticCapacityUnits + trendUnits;
  const trendProbPct = trendSignal
    ? Math.round(trendSignal.rezoneProbabilityBase * 100)
    : 0;

  return (
    <div style={{ flex: 1, border: `1px solid ${BORDER}`, background: BG2, padding: '12px 14px' }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <MapPin size={11} style={{ color: TEXT_AMBER }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT_AMBER, fontWeight: 700 }}>
          {ring.radiusMiles}-MILE RING
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY, marginLeft: 'auto' }}>
          {ring.parcelCount} MF parcels
        </span>
      </div>

      {isLoading ? (
        <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>Loading…</div>
      ) : (
        <>
          {/* ── Layer 1+2: Static MF capacity ───────────────────────────── */}
          <div style={{
            fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY,
            marginBottom: 6, letterSpacing: '0.05em',
          }}>
            L1+2 · STATIC MF CAPACITY
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <Stat label="STATIC CAPACITY" value={fmt(ring.staticCapacityUnits)} unit="units" color={TEXT_PRIMARY} />
            <Stat
              label="LATENT SUPPLY"
              value={fmt(totalLatent)}
              unit="units"
              color={totalLatent > 500 ? TEXT_RED : totalLatent > 200 ? TEXT_AMBER : TEXT_GREEN}
            />
          </div>

          {/* Static capacity by class */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10,
            borderTop: `1px solid ${BORDER}`, paddingTop: 8,
          }}>
            <Stat label="VACANT CAP" value={fmt(ring.staticByClass.vacant)} unit="u" color={TEXT_GREEN} />
            <Stat label="UNDERBUILT CAP" value={fmt(ring.staticByClass.underbuilt)} unit="u" color={TEXT_AMBER} />
            <Stat label="DEVELOPED CAP" value={fmt(ring.staticByClass.developed)} unit="u" color={TEXT_SECONDARY} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <Stat label="VACANT LATENT" value={fmt(ring.vacantUnits)} unit="units" color={TEXT_GREEN} />
            <Stat label="UNDERBUILT LATENT" value={fmt(ring.underbuiltUnits)} unit="units" color={TEXT_AMBER} />
          </div>

          {/* Utilization bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, marginBottom: 3,
            }}>
              <span>DEVELOPMENT UTILIZATION</span>
              <span style={{ color: TEXT_PRIMARY }}>{utilizationPct}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', height: 4, borderRadius: 2 }}>
              <div style={{
                background: utilizationPct > 80 ? TEXT_GREEN : utilizationPct > 50 ? TEXT_AMBER : TEXT_RED,
                height: '100%', width: `${utilizationPct}%`, borderRadius: 2,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* Parcel class legend */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {(['vacant', 'underbuilt', 'developed'] as const).map((cls) => (
              <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: CLASS_COLORS[cls] }} />
                <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY }}>
                  {CLASS_LABELS[cls]} {ring.parcelsByClass[cls]}
                </span>
              </div>
            ))}
          </div>

          {/* ── Layer 3: Trend-Weighted capacity ────────────────────────── */}
          <div style={{
            borderTop: `1px solid rgba(183,148,244,0.15)`,
            paddingTop: 10,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8,
            }}>
              <TrendingUp size={9} style={{ color: TEXT_PURPLE }} />
              <span style={{ fontFamily: MONO, fontSize: 7, color: TEXT_PURPLE, letterSpacing: '0.05em' }}>
                L3 · REZONE TREND · PROBABILISTIC
              </span>
              <span style={{
                fontFamily: MONO, fontSize: 6, color: 'rgba(183,148,244,0.5)',
                marginLeft: 'auto',
              }}>
                PHASE A LINEAR
              </span>
            </div>

            {/* Static vs Trend-Weighted side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <Stat
                label="STATIC (L1+2)"
                value={fmt(ring.staticCapacityUnits)}
                unit="u"
                color={TEXT_PRIMARY}
              />
              <Stat
                label="TREND UPSIDE"
                value={`+${fmt(trendUnits)}`}
                unit="u"
                color={trendUnits > 0 ? TEXT_PURPLE : TEXT_SECONDARY}
              />
              <Stat
                label="TOTAL W/ TREND"
                value={fmt(totalWithTrend)}
                unit="u"
                color={trendUnits > 0 ? TEXT_PURPLE : TEXT_PRIMARY}
              />
            </div>

            {/* Rezone probability and non-MF parcel count */}
            <div style={{
              display: 'flex', gap: 12,
              fontFamily: MONO, fontSize: 8,
            }}>
              <div>
                <span style={{ color: TEXT_SECONDARY }}>REZONE PROB </span>
                <span style={{ color: trendProbPct > 0 ? TEXT_PURPLE : TEXT_SECONDARY, fontWeight: 700 }}>
                  {trendProbPct}%
                </span>
              </div>
              <div>
                <span style={{ color: TEXT_SECONDARY }}>NON-MF PARCELS </span>
                <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>
                  {fmt(ring.trendWeighted.probableRezoneParcels.length)}
                </span>
              </div>
              {trendSignal?.moratoriumActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <AlertCircle size={8} style={{ color: TEXT_RED }} />
                  <span style={{ fontFamily: MONO, fontSize: 7, color: TEXT_RED }}>
                    MORATORIUM
                  </span>
                </div>
              )}
            </div>

            {/* Upzone/approval event counts when available */}
            {trendSignal && trendSignal.submarketId && (
              <div style={{
                display: 'flex', gap: 10, marginTop: 6,
                fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY,
              }}>
                <span>↑ {trendSignal.upzoningEventCount} UPZONE EVENTS</span>
                <span>✓ {trendSignal.approvalEventCount} APPROVALS</span>
              </div>
            )}

            {!trendSignal?.submarketId && (
              <div style={{
                fontFamily: MONO, fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 4,
              }}>
                No submarket linked — trend signal unavailable
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

// ─────────────────────────── Main component ─────────────────────────────────

export default function ForwardSupplyTab({ dealId }: Props) {
  const [data, setData] = useState<ForwardSupplyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ringFilter, setRingFilter] = useState<3 | 5 | null>(null);
  const [classFilter, setClassFilter] = useState<'vacant' | 'underbuilt' | 'developed' | null>(null);
  const [page, setPage] = useState(0);

  const load = () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    apiClient
      .get<ForwardSupplyResponse>(`/api/v1/deals/${dealId}/forward-supply`)
      .then((res: AxiosResponse<ForwardSupplyResponse>) => {
        if (res.data?.success) {
          setData(res.data);
        } else {
          setError('Endpoint returned unsuccessful response');
        }
      })
      .catch((err: Error) => setError(err.message ?? 'Failed to load forward supply data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const displayRings: ForwardSupplyRing[] = data?.rings ?? PLACEHOLDER_RINGS;
  const trendSignal = data?.metadata?.trendSignal ?? null;

  const filteredParcels = (data?.parcels ?? []).filter((p) => {
    if (ringFilter !== null && p.ring !== ringFilter) return false;
    if (classFilter !== null && p.currentUse !== classFilter) return false;
    return true;
  });
  const pagedParcels = filteredParcels.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredParcels.length / PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, overflowY: 'auto' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
      }}>
        <Building2 size={12} style={{ color: TEXT_AMBER }} />
        <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT_AMBER, fontWeight: 700 }}>
          FORWARD SUPPLY · WS-3
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, marginLeft: 4 }}>
          L1+2 MF SWEEP · L3 REZONE TREND · 3MI + 5MI
        </span>
        {data?.metadata?.municipality && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_BLUE, marginLeft: 4 }}>
            {data.metadata.municipality.toUpperCase()}
          </span>
        )}
        <button
          onClick={load}
          disabled={loading}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY,
            background: 'transparent', border: `1px solid ${BORDER}`,
            padding: '2px 8px', cursor: 'pointer',
          }}
        >
          <RefreshCw size={9} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          REFRESH
        </button>
      </div>

      {/* No coordinates warning */}
      {!data?.metadata?.hasCoordinates && !loading && (
        <div style={{
          margin: 12, padding: '10px 14px',
          background: 'rgba(246,173,85,0.05)', border: `1px solid rgba(246,173,85,0.2)`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={12} style={{ color: TEXT_AMBER }} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
            No coordinates on this deal. Draw a property boundary or set coordinates to enable the radius sweep.
          </span>
        </div>
      )}

      {/* No parcel data */}
      {data?.metadata?.hasCoordinates && !data?.metadata?.parcelDataAvailable && !loading && (
        <div style={{
          margin: 12, padding: '10px 14px',
          background: 'rgba(99,179,237,0.05)', border: `1px solid rgba(99,179,237,0.2)`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={12} style={{ color: TEXT_BLUE }} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
            No MF-zoned county parcel data found within 5 miles. Ingest parcel GeoJSON data for this area to populate the supply sweep.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          margin: 12, padding: '10px 14px',
          background: 'rgba(252,129,129,0.05)', border: `1px solid rgba(252,129,129,0.2)`,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_RED }}>{error}</span>
        </div>
      )}

      {/* MF sweep truncation warning */}
      {data?.metadata?.sweepTruncated && (
        <div style={{
          margin: '0 12px 4px', padding: '6px 10px',
          background: 'rgba(252,129,129,0.05)', border: `1px solid rgba(252,129,129,0.2)`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <AlertCircle size={10} style={{ color: TEXT_RED }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_RED }}>
            MF SWEEP CAPPED — showing {data.parcels.length.toLocaleString()} of {data.metadata.sweepTotalCount.toLocaleString()}+ parcels. Ring totals may be understated.
          </span>
        </div>
      )}

      {/* Non-MF sweep truncation warning */}
      {trendSignal?.nonMfSweepTruncated && (
        <div style={{
          margin: '0 12px 4px', padding: '6px 10px',
          background: 'rgba(183,148,244,0.05)', border: `1px solid rgba(183,148,244,0.15)`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <AlertCircle size={10} style={{ color: TEXT_PURPLE }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_PURPLE }}>
            L3 NON-MF SWEEP CAPPED — trend-weighted totals may be understated.
          </span>
        </div>
      )}

      {/* Moratorium banner */}
      {trendSignal?.moratoriumActive && (
        <div style={{
          margin: '0 12px 4px', padding: '6px 10px',
          background: 'rgba(252,129,129,0.05)', border: `1px solid rgba(252,129,129,0.2)`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <AlertCircle size={10} style={{ color: TEXT_RED }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_RED }}>
            ACTIVE MORATORIUM{trendSignal.moratoriumName ? ` — ${trendSignal.moratoriumName}` : ''} · Rezone probability capped at 5%.
          </span>
        </div>
      )}

      {/* Ring summary cards */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 12px', flexShrink: 0 }}>
        {displayRings.map((ring) => (
          <RingCard
            key={ring.radiusMiles}
            ring={ring}
            isLoading={loading}
            trendSignal={trendSignal}
          />
        ))}
      </div>

      {/* Filter bar */}
      {data && data.parcels.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, padding: '4px 12px 8px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, alignSelf: 'center' }}>
            FILTER:
          </span>
          {([null, 3, 5] as const).map((r) => (
            <button
              key={String(r)}
              onClick={() => { setRingFilter(r); setPage(0); }}
              style={{
                fontFamily: MONO, fontSize: 8,
                color: ringFilter === r ? TEXT_AMBER : TEXT_SECONDARY,
                background: ringFilter === r ? 'rgba(246,173,85,0.12)' : 'transparent',
                border: `1px solid ${ringFilter === r ? 'rgba(246,173,85,0.3)' : BORDER}`,
                padding: '2px 8px', cursor: 'pointer',
              }}
            >
              {r === null ? 'ALL RINGS' : `${r}MI`}
            </button>
          ))}
          {(['vacant', 'underbuilt', 'developed', null] as const).map((cls) => (
            <button
              key={String(cls)}
              onClick={() => { setClassFilter(cls); setPage(0); }}
              style={{
                fontFamily: MONO, fontSize: 8,
                color: classFilter === cls ? (cls ? CLASS_COLORS[cls] : TEXT_PRIMARY) : TEXT_SECONDARY,
                background: classFilter === cls ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: `1px solid ${classFilter === cls ? BORDER : 'rgba(255,255,255,0.04)'}`,
                padding: '2px 8px', cursor: 'pointer',
              }}
            >
              {cls === null ? 'ALL CLASSES' : CLASS_LABELS[cls]}
            </button>
          ))}
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, marginLeft: 'auto', alignSelf: 'center' }}>
            {filteredParcels.length} parcels
          </span>
        </div>
      )}

      {/* MF parcel table (L1+2) */}
      {data && data.parcels.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr 60px 60px 70px 70px 70px 60px',
            padding: '5px 12px',
            borderBottom: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.02)',
            position: 'sticky', top: 0, zIndex: 1,
          }}>
            {['ZONING', 'ADDRESS', 'ACRES', 'DIST', 'ALLOWED', 'LATENT', 'UNITS/AC', 'CLASS'].map((h) => (
              <span key={h} style={{ fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY }}>
                {h}
              </span>
            ))}
          </div>

          {pagedParcels.map((p) => (
            <div
              key={p.parcelId}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 60px 60px 70px 70px 70px 60px',
                padding: '4px 12px',
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_BLUE }}>
                {p.zoningCode ?? '—'}
              </span>
              <span style={{
                fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.address ?? `Parcel ${p.parcelId.slice(0, 8)}`}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PRIMARY }}>{p.acreage.toFixed(2)}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>{p.distanceMiles.toFixed(2)}mi</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PRIMARY }}>{p.allowedUnits}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: p.latentCapacityUnits > 0 ? CLASS_COLORS[p.currentUse] : TEXT_SECONDARY }}>
                {p.latentCapacityUnits > 0 ? `+${p.latentCapacityUnits}` : '—'}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PRIMARY }}>{p.bindingUnitsPerAcre.toFixed(1)}</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: CLASS_COLORS[p.currentUse] }}>
                {CLASS_LABELS[p.currentUse]}
              </span>
            </div>
          ))}

          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderTop: `1px solid ${BORDER}`,
            }}>
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                style={{
                  fontFamily: MONO, fontSize: 8, color: page === 0 ? TEXT_SECONDARY : TEXT_PRIMARY,
                  background: 'transparent', border: `1px solid ${BORDER}`,
                  padding: '2px 8px', cursor: page === 0 ? 'default' : 'pointer',
                }}
              >
                ◀ PREV
              </button>
              <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                style={{
                  fontFamily: MONO, fontSize: 8,
                  color: page >= totalPages - 1 ? TEXT_SECONDARY : TEXT_PRIMARY,
                  background: 'transparent', border: `1px solid ${BORDER}`,
                  padding: '2px 8px', cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                }}
              >
                NEXT ▶
              </button>
            </div>
          )}
        </div>
      )}

      {data && data.parcels.length === 0 && !loading && !data.metadata.parcelDataAvailable && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
            No parcel data — run the parcel ingest for this area to enable forward supply analysis.
          </span>
        </div>
      )}

      {/* Footer */}
      {data?.computedAt && (
        <div style={{
          padding: '4px 12px', borderTop: `1px solid ${BORDER}`,
          fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY, flexShrink: 0,
          background: BG3,
        }}>
          COMPUTED {new Date(data.computedAt).toLocaleString()}
          {' · '}L1 MF SWEEP + L2 FEASIBILITY (WS-3)
          {' · '}L3 REZONE TREND PHASE A
          {trendSignal ? ` · p=${(trendSignal.rezoneProbabilityBase * 100).toFixed(0)}%` : ''}
        </div>
      )}
    </div>
  );
}
