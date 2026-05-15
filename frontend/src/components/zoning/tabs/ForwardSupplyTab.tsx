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
 * Two browseable tables appear below the ring cards:
 *   1. L1+2 MF parcel table — filtered by ring + class
 *   2. L3 non-MF probable-rezone table — filtered by ring, sorted by
 *      probabilistic units (descending, pre-sorted server-side)
 *
 * Data source: GET /api/v1/deals/:dealId/forward-supply
 */

import React, { useEffect, useState } from 'react';
import type { AxiosResponse } from 'axios';
import { Building2, RefreshCw, AlertCircle, MapPin, TrendingUp } from 'lucide-react';
import { apiClient } from '../../../services/api.client';

// ─────────────────────────── Types ──────────────────────────────────────────

interface NonMfRezoneParcels {
  parcelId: string;
  address: string | null;
  zoningCode: string | null;
  acreage: number;
  distanceMiles: number;
  theoreticalMFCapacity: number;
  rezoneProbability: number;
  probabilisticUnits: number;
}

interface TrendWeightedRing {
  trendWeightedCapacityUnits: number;
  probableRezoneParcels: NonMfRezoneParcels[];
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
  modelPhase: 'A_linear' | 'B_empirical';
  /** Matched corpus rows for Phase B. 0 = Phase B not attempted or no match. */
  phaseBCorpusSize: number;
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
const BORDER_PURPLE = 'rgba(183,148,244,0.12)';
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
    radiusMiles: 3, parcelCount: 0, staticCapacityUnits: 0,
    vacantUnits: 0, underbuiltUnits: 0, developedCount: 0,
    parcelsByClass: { vacant: 0, underbuilt: 0, developed: 0 },
    staticByClass: { vacant: 0, underbuilt: 0, developed: 0 },
    trendWeighted: EMPTY_TREND_WEIGHTED,
  },
  {
    radiusMiles: 5, parcelCount: 0, staticCapacityUnits: 0,
    vacantUnits: 0, underbuiltUnits: 0, developedCount: 0,
    parcelsByClass: { vacant: 0, underbuilt: 0, developed: 0 },
    staticByClass: { vacant: 0, underbuilt: 0, developed: 0 },
    trendWeighted: EMPTY_TREND_WEIGHTED,
  },
];

const PAGE_SIZE = 50;

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

function FilterBtn({
  label, active, color, onClick,
}: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: MONO, fontSize: 8,
        color: active ? (color ?? TEXT_AMBER) : TEXT_SECONDARY,
        background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: `1px solid ${active ? (color ? `${color}55` : 'rgba(246,173,85,0.3)') : BORDER}`,
        padding: '2px 8px', cursor: 'pointer',
      }}
    >
      {label}
    </button>
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
          <div style={{ fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY, marginBottom: 6, letterSpacing: '0.05em' }}>
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

          {/* L3 section */}
          <div style={{ borderTop: `1px solid ${BORDER_PURPLE}`, paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <TrendingUp size={9} style={{ color: TEXT_PURPLE }} />
              <span style={{ fontFamily: MONO, fontSize: 7, color: TEXT_PURPLE, letterSpacing: '0.05em' }}>
                L3 · REZONE TREND · PROBABILISTIC
              </span>
              <span style={{ fontFamily: MONO, fontSize: 6, color: 'rgba(183,148,244,0.5)', marginLeft: 'auto' }}>
                PHASE A LINEAR
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <Stat label="STATIC (L1+2)" value={fmt(ring.staticCapacityUnits)} unit="u" color={TEXT_PRIMARY} />
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

            <div style={{ display: 'flex', gap: 12, fontFamily: MONO, fontSize: 8 }}>
              <div>
                <span style={{ color: TEXT_SECONDARY }}>REZONE PROB </span>
                <span style={{ color: trendProbPct > 0 ? TEXT_PURPLE : TEXT_SECONDARY, fontWeight: 700 }}>
                  {trendProbPct}%
                </span>
              </div>
              <div>
                <span style={{ color: TEXT_SECONDARY }}>NON-MF PARCELS </span>
                <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>
                  {fmt(trendSignal?.nonMfParcelCount ?? ring.trendWeighted.probableRezoneParcels.length)}
                </span>
                {(trendSignal?.nonMfParcelCount ?? 0) > ring.trendWeighted.probableRezoneParcels.length &&
                  ring.trendWeighted.probableRezoneParcels.length > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 6, color: TEXT_SECONDARY, marginLeft: 3 }}>
                    top 100 shown
                  </span>
                )}
              </div>
              {trendSignal?.moratoriumActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <AlertCircle size={8} style={{ color: TEXT_RED }} />
                  <span style={{ fontFamily: MONO, fontSize: 7, color: TEXT_RED }}>MORATORIUM</span>
                </div>
              )}
            </div>

            {trendSignal && trendSignal.submarketId && (
              <div style={{ display: 'flex', gap: 10, marginTop: 6, fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY }}>
                <span>↑ {trendSignal.upzoningEventCount} UPZONE EVENTS</span>
                <span>✓ {trendSignal.approvalEventCount} APPROVALS</span>
              </div>
            )}

            {!trendSignal?.submarketId && (
              <div style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                No submarket linked — trend signal unavailable
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────── Main component ─────────────────────────────────

export default function ForwardSupplyTab({ dealId }: Props) {
  const [data, setData] = useState<ForwardSupplyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // L1+2 MF parcel table state
  const [ringFilter, setRingFilter] = useState<3 | 5 | null>(null);
  const [classFilter, setClassFilter] = useState<'vacant' | 'underbuilt' | 'developed' | null>(null);
  const [page, setPage] = useState(0);

  // L3 non-MF parcel table state
  const [nonMfRingFilter, setNonMfRingFilter] = useState<3 | 5>(5);
  const [nonMfPage, setNonMfPage] = useState(0);
  const [nonMfExpanded, setNonMfExpanded] = useState(true);
  const [nonMfSortDir, setNonMfSortDir] = useState<'desc' | 'asc'>('desc');

  const load = () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    apiClient
      .get<ForwardSupplyResponse>(`/api/v1/deals/${dealId}/forward-supply`)
      .then((res: AxiosResponse<ForwardSupplyResponse>) => {
        if (res.data?.success) setData(res.data);
        else setError('Endpoint returned unsuccessful response');
      })
      .catch((err: Error) => setError(err.message ?? 'Failed to load forward supply data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dealId]);

  const displayRings = data?.rings ?? PLACEHOLDER_RINGS;
  const trendSignal = data?.metadata?.trendSignal ?? null;

  // ── L1+2 MF parcel filtering ──
  const filteredParcels = (data?.parcels ?? []).filter((p) => {
    if (ringFilter !== null && p.ring !== ringFilter) return false;
    if (classFilter !== null && p.currentUse !== classFilter) return false;
    return true;
  });
  const pagedParcels = filteredParcels.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredParcels.length / PAGE_SIZE);

  // ── L3 non-MF parcel data ──
  // 5mi ring contains all 3mi parcels as a superset; 3mi ring has only 3mi parcels.
  const nonMfParcelsRaw: NonMfRezoneParcels[] =
    data?.rings.find((r) => r.radiusMiles === nonMfRingFilter)?.trendWeighted.probableRezoneParcels ?? [];
  // Apply client-side sort (server pre-sorts desc; toggle gives asc view without a round-trip)
  const nonMfParcels = nonMfSortDir === 'desc'
    ? nonMfParcelsRaw
    : [...nonMfParcelsRaw].sort((a, b) => a.probabilisticUnits - b.probabilisticUnits);
  const pagedNonMf = nonMfParcels.slice(nonMfPage * PAGE_SIZE, (nonMfPage + 1) * PAGE_SIZE);
  const nonMfTotalPages = Math.ceil(nonMfParcels.length / PAGE_SIZE);

  const hasNonMfData = nonMfParcels.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, overflowY: 'auto' }}>

      {/* ── Header ── */}
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

      {/* ── Banners ── */}
      {!data?.metadata?.hasCoordinates && !loading && (
        <div style={{ margin: 12, padding: '10px 14px', background: 'rgba(246,173,85,0.05)', border: `1px solid rgba(246,173,85,0.2)`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={12} style={{ color: TEXT_AMBER }} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
            No coordinates on this deal. Draw a property boundary or set coordinates to enable the radius sweep.
          </span>
        </div>
      )}
      {data?.metadata?.hasCoordinates && !data?.metadata?.parcelDataAvailable && !loading && (
        <div style={{ margin: 12, padding: '10px 14px', background: 'rgba(99,179,237,0.05)', border: `1px solid rgba(99,179,237,0.2)`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={12} style={{ color: TEXT_BLUE }} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
            No MF-zoned county parcel data found within 5 miles. Ingest parcel GeoJSON data for this area to populate the supply sweep.
          </span>
        </div>
      )}
      {error && (
        <div style={{ margin: 12, padding: '10px 14px', background: 'rgba(252,129,129,0.05)', border: `1px solid rgba(252,129,129,0.2)` }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_RED }}>{error}</span>
        </div>
      )}
      {data?.metadata?.sweepTruncated && (
        <div style={{ margin: '0 12px 4px', padding: '6px 10px', background: 'rgba(252,129,129,0.05)', border: `1px solid rgba(252,129,129,0.2)`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={10} style={{ color: TEXT_RED }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_RED }}>
            MF SWEEP CAPPED — showing {data.parcels.length.toLocaleString()} of {data.metadata.sweepTotalCount.toLocaleString()}+ parcels. Ring totals may be understated.
          </span>
        </div>
      )}
      {trendSignal?.nonMfSweepTruncated && (
        <div style={{ margin: '0 12px 4px', padding: '6px 10px', background: 'rgba(183,148,244,0.05)', border: `1px solid ${BORDER_PURPLE}`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={10} style={{ color: TEXT_PURPLE }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_PURPLE }}>
            L3 NON-MF SWEEP CAPPED — trend-weighted totals may be understated.
          </span>
        </div>
      )}
      {trendSignal?.moratoriumActive && (
        <div style={{ margin: '0 12px 4px', padding: '6px 10px', background: 'rgba(252,129,129,0.05)', border: `1px solid rgba(252,129,129,0.2)`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={10} style={{ color: TEXT_RED }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_RED }}>
            ACTIVE MORATORIUM{trendSignal.moratoriumName ? ` — ${trendSignal.moratoriumName}` : ''} · Rezone probability capped at 5%.
          </span>
        </div>
      )}

      {/* ── Ring summary cards ── */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 12px', flexShrink: 0 }}>
        {displayRings.map((ring) => (
          <RingCard key={ring.radiusMiles} ring={ring} isLoading={loading} trendSignal={trendSignal} />
        ))}
      </div>

      {/* ── L1+2 MF parcel table ── */}
      {data && data.parcels.length > 0 && (
        <>
          {/* Filter bar */}
          <div style={{
            display: 'flex', gap: 6, padding: '4px 12px 8px',
            borderBottom: `1px solid ${BORDER}`, flexShrink: 0, flexWrap: 'wrap',
          }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, alignSelf: 'center' }}>
              L1+2 FILTER:
            </span>
            {([null, 3, 5] as const).map((r) => (
              <FilterBtn
                key={String(r)}
                label={r === null ? 'ALL RINGS' : `${r}MI`}
                active={ringFilter === r}
                onClick={() => { setRingFilter(r); setPage(0); }}
              />
            ))}
            {(['vacant', 'underbuilt', 'developed', null] as const).map((cls) => (
              <FilterBtn
                key={String(cls)}
                label={cls === null ? 'ALL CLASSES' : CLASS_LABELS[cls]}
                active={classFilter === cls}
                color={cls ? CLASS_COLORS[cls] : undefined}
                onClick={() => { setClassFilter(cls); setPage(0); }}
              />
            ))}
            <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, marginLeft: 'auto', alignSelf: 'center' }}>
              {filteredParcels.length} parcels
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowY: 'auto', flexShrink: 0, maxHeight: 280 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 60px 60px 70px 70px 70px 60px',
              padding: '5px 12px',
              borderBottom: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.02)',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              {['ZONING', 'ADDRESS', 'ACRES', 'DIST', 'ALLOWED', 'LATENT', 'UNITS/AC', 'CLASS'].map((h) => (
                <span key={h} style={{ fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY }}>{h}</span>
              ))}
            </div>
            {pagedParcels.map((p) => (
              <div key={p.parcelId} style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 60px 60px 70px 70px 70px 60px',
                padding: '4px 12px',
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_BLUE }}>{p.zoningCode ?? '—'}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.address ?? `Parcel ${p.parcelId.slice(0, 8)}`}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PRIMARY }}>{p.acreage.toFixed(2)}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>{p.distanceMiles.toFixed(2)}mi</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PRIMARY }}>{p.allowedUnits}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: p.latentCapacityUnits > 0 ? CLASS_COLORS[p.currentUse] : TEXT_SECONDARY }}>
                  {p.latentCapacityUnits > 0 ? `+${p.latentCapacityUnits}` : '—'}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PRIMARY }}>{p.bindingUnitsPerAcre.toFixed(1)}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: CLASS_COLORS[p.currentUse] }}>{CLASS_LABELS[p.currentUse]}</span>
              </div>
            ))}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: `1px solid ${BORDER}` }}>
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                  style={{ fontFamily: MONO, fontSize: 8, color: page === 0 ? TEXT_SECONDARY : TEXT_PRIMARY, background: 'transparent', border: `1px solid ${BORDER}`, padding: '2px 8px', cursor: page === 0 ? 'default' : 'pointer' }}>
                  ◀ PREV
                </button>
                <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY }}>{page + 1} / {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                  style={{ fontFamily: MONO, fontSize: 8, color: page >= totalPages - 1 ? TEXT_SECONDARY : TEXT_PRIMARY, background: 'transparent', border: `1px solid ${BORDER}`, padding: '2px 8px', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
                  NEXT ▶
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {data && data.parcels.length === 0 && !loading && !data.metadata.parcelDataAvailable && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
            No parcel data — run the parcel ingest for this area to enable forward supply analysis.
          </span>
        </div>
      )}

      {/* ── L3 Non-MF probable-rezone table ── */}
      {data && (
        <div style={{ borderTop: `1px solid ${BORDER_PURPLE}`, flexShrink: 0 }}>
          {/* Collapsible section header */}
          <div
            onClick={() => setNonMfExpanded((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', cursor: 'pointer',
              background: 'rgba(183,148,244,0.04)',
              userSelect: 'none',
            }}
          >
            <TrendingUp size={9} style={{ color: TEXT_PURPLE }} />
            <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PURPLE, fontWeight: 700 }}>
              L3 · NON-MF PROBABLE REZONE PARCELS
            </span>
            {trendSignal?.modelPhase === 'B_empirical' ? (
              <span style={{
                fontFamily: MONO, fontSize: 7, color: 'rgba(74,222,128,0.8)',
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.25)',
                padding: '1px 5px', borderRadius: 2,
              }}
                title={`Phase B empirical calibration active — ${trendSignal.phaseBCorpusSize} corpus observations`}
              >
                PHASE B EMPIRICAL
              </span>
            ) : (
              <span style={{
                fontFamily: MONO, fontSize: 7, color: 'rgba(183,148,244,0.6)',
                background: 'rgba(183,148,244,0.1)',
                border: '1px solid rgba(183,148,244,0.2)',
                padding: '1px 5px', borderRadius: 2,
              }}
                title={
                  (trendSignal?.phaseBCorpusSize ?? 0) > 0
                    ? `Phase A fallback — Phase B corpus too small (${trendSignal!.phaseBCorpusSize} obs, need 5)`
                    : 'Phase A linear model — no Phase B corpus yet'
                }
              >
                {(trendSignal?.phaseBCorpusSize ?? 0) > 0 ? 'PHASE A (FALLBACK)' : 'PHASE A LINEAR'}
              </span>
            )}
            <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, marginLeft: 4 }}>
              sorted by probabilistic units ↓
            </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, marginLeft: 'auto' }}>
              {nonMfExpanded ? '▲' : '▼'}
            </span>
          </div>

          {nonMfExpanded && (
            <>
              {/* Ring filter for non-MF table */}
              <div style={{
                display: 'flex', gap: 6, padding: '4px 12px 6px',
                borderBottom: `1px solid ${BORDER_PURPLE}`, flexWrap: 'wrap',
              }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, alignSelf: 'center' }}>
                  RING:
                </span>
                {([3, 5] as const).map((r) => (
                  <FilterBtn
                    key={r}
                    label={`${r}MI`}
                    active={nonMfRingFilter === r}
                    color={TEXT_PURPLE}
                    onClick={() => { setNonMfRingFilter(r); setNonMfPage(0); }}
                  />
                ))}
                <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY, marginLeft: 'auto', alignSelf: 'center' }}>
                  {nonMfParcels.length} parcels{(trendSignal?.nonMfParcelCount ?? 0) > nonMfParcels.length && nonMfParcels.length > 0 ? ' (top 100)' : ''}
                </span>
              </div>

              {!trendSignal?.submarketId && (
                <div style={{ padding: '12px', fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
                  No submarket linked to this deal — rezone trend signal is unavailable. Link a submarket to compute Layer 3 upside.
                </div>
              )}

              {trendSignal?.submarketId && !hasNonMfData && !loading && (
                <div style={{ padding: '12px', fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
                  No non-MF parcels found within the {nonMfRingFilter}-mile ring. The rezone trend signal ({Math.round((trendSignal?.rezoneProbabilityBase ?? 0) * 100)}%) will apply to non-MF parcels when parcel data is ingested.
                </div>
              )}

              {hasNonMfData && (
                <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                  {/* Column headers — PROB UNITS is sortable */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 55px 55px 80px 75px 80px',
                    padding: '5px 12px',
                    borderBottom: `1px solid ${BORDER}`,
                    background: 'rgba(183,148,244,0.03)',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>
                    {['ZONING', 'ADDRESS', 'ACRES', 'DIST', 'THEOR MF CAP', 'REZONE PROB'].map((h) => (
                      <span key={h} style={{ fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY }}>{h}</span>
                    ))}
                    <span
                      onClick={() => { setNonMfSortDir((d) => d === 'desc' ? 'asc' : 'desc'); setNonMfPage(0); }}
                      style={{
                        fontFamily: MONO, fontSize: 7, color: TEXT_PURPLE,
                        cursor: 'pointer', userSelect: 'none',
                      }}
                      title="Toggle sort direction"
                    >
                      PROB UNITS {nonMfSortDir === 'desc' ? '▼' : '▲'}
                    </span>
                  </div>

                  {pagedNonMf.map((p) => {
                    const probPct = Math.round(p.rezoneProbability * 100);
                    return (
                      <div key={p.parcelId} style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr 55px 55px 80px 75px 80px',
                        padding: '4px 12px',
                        borderBottom: `1px solid rgba(255,255,255,0.03)`,
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_BLUE }}>
                          {p.zoningCode ?? '—'}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.address ?? `Parcel ${p.parcelId.slice(0, 8)}`}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PRIMARY }}>
                          {p.acreage.toFixed(2)}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>
                          {p.distanceMiles.toFixed(2)}mi
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PRIMARY }}>
                          {fmt(p.theoreticalMFCapacity)}u
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_PURPLE }}>
                          {probPct}%
                        </span>
                        <span style={{
                          fontFamily: MONO, fontSize: 9,
                          color: p.probabilisticUnits > 0 ? TEXT_PURPLE : TEXT_SECONDARY,
                          fontWeight: p.probabilisticUnits > 50 ? 700 : 400,
                        }}>
                          {p.probabilisticUnits > 0 ? `~${fmt(p.probabilisticUnits)}u` : '—'}
                        </span>
                      </div>
                    );
                  })}

                  {nonMfTotalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: `1px solid ${BORDER}` }}>
                      <button onClick={() => setNonMfPage(Math.max(0, nonMfPage - 1))} disabled={nonMfPage === 0}
                        style={{ fontFamily: MONO, fontSize: 8, color: nonMfPage === 0 ? TEXT_SECONDARY : TEXT_PRIMARY, background: 'transparent', border: `1px solid ${BORDER}`, padding: '2px 8px', cursor: nonMfPage === 0 ? 'default' : 'pointer' }}>
                        ◀ PREV
                      </button>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY }}>{nonMfPage + 1} / {nonMfTotalPages}</span>
                      <button onClick={() => setNonMfPage(Math.min(nonMfTotalPages - 1, nonMfPage + 1))} disabled={nonMfPage >= nonMfTotalPages - 1}
                        style={{ fontFamily: MONO, fontSize: 8, color: nonMfPage >= nonMfTotalPages - 1 ? TEXT_SECONDARY : TEXT_PRIMARY, background: 'transparent', border: `1px solid ${BORDER}`, padding: '2px 8px', cursor: nonMfPage >= nonMfTotalPages - 1 ? 'default' : 'pointer' }}>
                        NEXT ▶
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Footer ── */}
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
