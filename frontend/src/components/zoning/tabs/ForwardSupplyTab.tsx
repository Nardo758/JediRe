/**
 * WS-3 Layers 1+2 — Forward Supply Panel
 *
 * Displays projected MF developable capacity within 3mi and 5mi rings of the
 * deal site, broken out by parcel class (vacant / underbuilt / developed).
 * Data is sourced from GET /api/v1/deals/:dealId/forward-supply.
 */

import React, { useEffect, useState } from 'react';
import type { AxiosResponse } from 'axios';
import { Building2, RefreshCw, AlertCircle, MapPin } from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface ForwardSupplyRing {
  radiusMiles: 3 | 5;
  parcelCount: number;
  staticCapacityUnits: number;
  vacantUnits: number;
  underbuiltUnits: number;
  developedCount: number;
  parcelsByClass: { vacant: number; underbuilt: number; developed: number };
  staticByClass: { vacant: number; underbuilt: number; developed: number };
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

interface ForwardSupplyResponse {
  success: boolean;
  dealId: string;
  computedAt: string;
  rings: ForwardSupplyRing[];
  parcels: ForwardSupplyParcel[];
  metadata: {
    lat: number | null;
    lng: number | null;
    hasCoordinates: boolean;
    parcelDataAvailable: boolean;
    municipality: string | null;
    mfZoningFilter: string;
    sweepTruncated: boolean;
    sweepTotalCount: number;
  };
}

interface Props {
  dealId?: string;
  deal?: Record<string, unknown>;
}

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const BG = '#0a0e1a';
const BG2 = '#111827';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#7f8ea3';
const TEXT_AMBER = '#F6AD55';
const TEXT_GREEN = '#68D391';
const TEXT_BLUE = '#63B3ED';
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

/** Safe placeholder rings rendered while loading — all numeric fields are 0. */
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
  },
];

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function RingCard({ ring, isLoading }: { ring: ForwardSupplyRing; isLoading: boolean }) {
  const totalLatent = ring.vacantUnits + ring.underbuiltUnits;
  const utilizationPct =
    ring.staticCapacityUnits > 0
      ? Math.round((1 - totalLatent / ring.staticCapacityUnits) * 100)
      : 0;

  return (
    <div style={{ flex: 1, border: `1px solid ${BORDER}`, background: BG2, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <MapPin size={11} style={{ color: TEXT_AMBER }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT_AMBER, fontWeight: 700 }}>
          {ring.radiusMiles}-MILE RING
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY, marginLeft: 'auto' }}>
          {ring.parcelCount} parcels
        </span>
      </div>

      {isLoading ? (
        <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT_SECONDARY }}>Loading…</div>
      ) : (
        <>
          {/* Row 1: total static capacity + latent summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <Stat label="STATIC CAPACITY" value={fmt(ring.staticCapacityUnits)} unit="units" color={TEXT_PRIMARY} />
            <Stat
              label="LATENT SUPPLY"
              value={fmt(totalLatent)}
              unit="units"
              color={totalLatent > 500 ? TEXT_RED : totalLatent > 200 ? TEXT_AMBER : TEXT_GREEN}
            />
          </div>

          {/* Row 2: static capacity broken out by parcel class */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10,
            borderTop: `1px solid ${BORDER}`, paddingTop: 8,
          }}>
            <Stat label="VACANT CAP" value={fmt(ring.staticByClass.vacant)} unit="u" color={TEXT_GREEN} />
            <Stat label="UNDERBUILT CAP" value={fmt(ring.staticByClass.underbuilt)} unit="u" color={TEXT_AMBER} />
            <Stat label="DEVELOPED CAP" value={fmt(ring.staticByClass.developed)} unit="u" color={TEXT_SECONDARY} />
          </div>

          {/* Row 3: latent detail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <Stat label="VACANT LATENT" value={fmt(ring.vacantUnits)} unit="units" color={TEXT_GREEN} />
            <Stat label="UNDERBUILT LATENT" value={fmt(ring.underbuiltUnits)} unit="units" color={TEXT_AMBER} />
          </div>

          <div style={{ marginBottom: 6 }}>
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

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {(['vacant', 'underbuilt', 'developed'] as const).map((cls) => (
              <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: CLASS_COLORS[cls] }} />
                <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_SECONDARY }}>
                  {CLASS_LABELS[cls]} {ring.parcelsByClass[cls]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
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

const PAGE_SIZE = 50;

export default function ForwardSupplyTab({ dealId }: Props) {
  const [data, setData] = useState<ForwardSupplyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ringFilter, setRingFilter] = useState<3 | 5 | null>(null);
  const [classFilter, setClassFilter] = useState<'vacant' | 'underbuilt' | 'developed' | null>(null);
  const [page, setPage] = useState(0);

  const load = () => {
    if (!dealId) {
      setLoading(false);
      return;
    }
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
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load forward supply data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const displayRings: ForwardSupplyRing[] = data?.rings ?? PLACEHOLDER_RINGS;

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
          MF-ZONED PARCEL SWEEP · 3MI + 5MI RINGS · LAYER 1+2
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

      {error && (
        <div style={{
          margin: 12, padding: '10px 14px',
          background: 'rgba(252,129,129,0.05)', border: `1px solid rgba(252,129,129,0.2)`,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT_RED }}>{error}</span>
        </div>
      )}

      {data?.metadata?.sweepTruncated && (
        <div style={{
          margin: '0 12px 4px', padding: '6px 10px',
          background: 'rgba(252,129,129,0.05)', border: `1px solid rgba(252,129,129,0.2)`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <AlertCircle size={10} style={{ color: TEXT_RED }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_RED }}>
            SWEEP CAPPED — showing {data.metadata.sweepTotalCount.toLocaleString()} of {data.metadata.sweepTotalCount.toLocaleString()}+ parcels. Ring totals may be understated. Ingest additional parcel data for complete coverage.
          </span>
        </div>
      )}

      {/* Ring Summary Cards — always rendered; show "Loading…" until data arrives */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 12px', flexShrink: 0 }}>
        {displayRings.map((ring) => (
          <RingCard key={ring.radiusMiles} ring={ring} isLoading={loading} />
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

      {/* Parcel table */}
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
              <span key={h} style={{ fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY, textTransform: 'uppercase' }}>
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

      {data?.computedAt && (
        <div style={{
          padding: '4px 12px', borderTop: `1px solid ${BORDER}`,
          fontFamily: MONO, fontSize: 7, color: TEXT_SECONDARY, flexShrink: 0,
        }}>
          COMPUTED {new Date(data.computedAt).toLocaleString()} · LAYER 1 SWEEP + LAYER 2 FEASIBILITY (WS-3) · LAYER 3 REZONE TREND: PENDING
        </div>
      )}
    </div>
  );
}
