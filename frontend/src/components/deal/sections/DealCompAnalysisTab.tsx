import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { competitionService, TieredCompProperty } from '@/services/competition.service';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Check,
  RotateCcw,
  MapPin,
  AlertCircle,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';
import { apiClient } from '../../../api/client';

const BT2 = BT;

type TierKey = 'trade_area' | 'submarket' | 'msa';
type ViewMode = 'list' | 'split' | 'map';

const mono = 'var(--bt-mono)';

const TIER_CONFIG: Record<TierKey, { label: string; color: string }> = {
  trade_area: { label: 'TRADE AREA', color: '#00D26A' },
  submarket:  { label: 'SUBMARKET',  color: '#00BCD4' },
  msa:        { label: 'MSA',        color: '#A78BFA' },
};

interface CompSetSummary {
  count: number;
  avgUnits: number | null;
  avgDistance: number | null;
  avgMatchScore: number | null;
  perTier: Record<TierKey, number>;
}

function computeCompSetSummary(comps: TieredCompProperty[], tiers: Record<TierKey, TieredCompProperty[]>): CompSetSummary {
  const inSet = comps.filter(c => c.in_comp_set);
  const perTier: Record<TierKey, number> = {
    trade_area: tiers.trade_area.filter(c => c.in_comp_set).length,
    submarket: tiers.submarket.filter(c => c.in_comp_set).length,
    msa: tiers.msa.filter(c => c.in_comp_set).length,
  };

  if (inSet.length === 0) return { count: 0, avgUnits: null, avgDistance: null, avgMatchScore: null, perTier };

  const withDist = inSet.filter(c => c.distance_miles != null);

  return {
    count: inSet.length,
    avgUnits: Math.round(inSet.reduce((s, c) => s + c.units, 0) / inSet.length),
    avgDistance: withDist.length > 0 ? Math.round(withDist.reduce((s, c) => s + (c.distance_miles || 0), 0) / withDist.length * 10) / 10 : null,
    avgMatchScore: Math.round(inSet.reduce((s, c) => s + c.match_score, 0) / inSet.length),
    perTier,
  };
}

const thStyle: React.CSSProperties = {
  padding: '3px 6px', fontSize: 7, fontFamily: mono, fontWeight: 700,
  letterSpacing: '0.06em', color: BT2.text.muted,
};

function CompRow({
  comp, rank, onToggleCompSet, toggling, hovered, onHover,
}: {
  comp: TieredCompProperty; rank: number;
  onToggleCompSet: (comp: TieredCompProperty) => void; toggling: boolean;
  hovered: boolean; onHover: (rank: number | null) => void;
}) {
  const scoreColor = comp.match_score >= 70 ? BT2.text.green : comp.match_score >= 50 ? BT2.text.amber : BT2.text.muted;

  return (
    <tr style={{ borderTop: `1px solid ${BT2.border.subtle}40`, background: hovered ? '#00BCD408' : 'transparent' }}
      onMouseEnter={() => onHover(rank)} onMouseLeave={() => onHover(null)}>
      <td style={{ padding: '3px 6px', textAlign: 'center', color: BT2.text.muted, fontFamily: mono, fontSize: 9 }}>{rank}</td>
      <td style={{ padding: '3px 6px' }}>
        <div style={{ color: hovered ? BT2.text.cyan : BT2.text.primary, fontSize: 10, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.name || comp.address}</div>
        <div style={{ color: BT2.text.muted, fontSize: 8, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.address}</div>
      </td>
      <td style={{ padding: '3px 6px', textAlign: 'center', color: BT2.text.secondary, fontFamily: mono, fontSize: 9 }}>{comp.units || '—'}</td>
      <td style={{ padding: '3px 6px', textAlign: 'center', color: BT2.text.secondary, fontFamily: mono, fontSize: 9 }}>{comp.year_built || '—'}</td>
      <td style={{ padding: '3px 6px', textAlign: 'center' }}>
        {comp.class_code ? (
          <span style={{
            fontSize: 8, fontWeight: 700, padding: '1px 3px', borderRadius: 2,
            background: comp.class_code.startsWith('A') ? '#00BCD411' : comp.class_code.startsWith('B') ? '#F5A62311' : BT2.bg.header,
            color: comp.class_code.startsWith('A') ? '#00BCD4' : comp.class_code.startsWith('B') ? '#F5A623' : BT2.text.muted,
          }}>{comp.class_code}</span>
        ) : <span style={{ color: BT2.text.muted, fontSize: 9 }}>—</span>}
      </td>
      <td style={{ padding: '3px 6px', textAlign: 'center', color: BT2.text.secondary, fontFamily: mono, fontSize: 9 }}>
        {comp.distance_miles != null ? `${comp.distance_miles}mi` : '—'}
      </td>
      <td style={{ padding: '3px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ color: scoreColor, fontFamily: mono, fontSize: 9, fontWeight: 700, minWidth: 14 }}>{Math.round(comp.match_score)}</span>
          <div style={{ width: 24, height: 2, background: BT2.bg.header, borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, comp.match_score)}%`, height: '100%', background: scoreColor, borderRadius: 1 }} />
          </div>
        </div>
      </td>
      <td style={{ padding: '3px 6px', textAlign: 'center' }}>
        <button
          onClick={() => onToggleCompSet(comp)}
          disabled={toggling}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            padding: '1px 5px', fontSize: 7, fontWeight: 700, fontFamily: mono,
            borderRadius: 2, cursor: toggling ? 'wait' : 'pointer',
            opacity: toggling ? 0.5 : 1,
            background: comp.in_comp_set ? '#00D26A18' : BT2.bg.header,
            color: comp.in_comp_set ? '#00D26A' : BT2.text.secondary,
            border: `1px solid ${comp.in_comp_set ? '#00D26A55' : BT2.border.medium}`,
          }}
        >
          {comp.in_comp_set ? (<><Check style={{ width: 8, height: 8 }} /> IN</>) : (<><Plus style={{ width: 8, height: 8 }} /> ADD</>)}
        </button>
      </td>
    </tr>
  );
}

function CompMapPanel({
  allComps, tiers, hoveredRank, onHover,
}: {
  allComps: TieredCompProperty[];
  tiers: Record<TierKey, TieredCompProperty[]>;
  hoveredRank: number | null;
  onHover: (rank: number | null) => void;
}) {
  const geoComps = allComps.filter(c => c.lat != null && c.lng != null);

  const mapPositions = useMemo(() => {
    if (geoComps.length === 0) return [];
    const centerLat = geoComps.reduce((s, c) => s + (c.lat || 0), 0) / geoComps.length;
    const centerLng = geoComps.reduce((s, c) => s + (c.lng || 0), 0) / geoComps.length;

    const maxDist = Math.max(...geoComps.map(c => c.distance_miles || 0), 2);
    const scale = 180 / maxDist;

    return geoComps.map((c, i) => {
      const dx = ((c.lng || 0) - centerLng) * 69 * Math.cos((centerLat * Math.PI) / 180);
      const dy = -((c.lat || 0) - centerLat) * 69;
      return {
        comp: c,
        globalRank: allComps.indexOf(c) + 1,
        x: 230 + dx * scale,
        y: 230 + dy * scale,
        tier: c.geographic_tier,
      };
    });
  }, [geoComps, allComps]);

  const maxDist = Math.max(...geoComps.map(c => c.distance_miles || 0), 2);
  const ringDistances = maxDist <= 3 ? [0.5, 1.0, 2.0] : maxDist <= 6 ? [1.0, 2.5, 5.0] : [2.0, 5.0, 10.0];
  const scale = 180 / maxDist;

  const tierColor = (tier: TierKey) => TIER_CONFIG[tier].color;
  const scoreColor = (s: number) => s >= 70 ? BT2.text.green : s >= 50 ? BT2.text.amber : BT2.text.muted;

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      borderRadius: 4, border: `1px solid ${BT2.border.subtle}`, background: BT2.bg.panel,
    }}>
      <div style={{ position: 'absolute', top: 6, left: 8, zIndex: 10, display: 'flex', gap: 5, alignItems: 'center' }}>
        <span style={{ color: BT2.text.cyan, fontFamily: mono, fontSize: 7, fontWeight: 700, padding: '2px 5px', background: '#00BCD415', borderRadius: 2, border: `1px solid ${BT2.border.subtle}` }}>MAP</span>
        <span style={{ color: BT2.text.muted, fontFamily: mono, fontSize: 7 }}>{geoComps.length} geocoded</span>
      </div>

      {geoComps.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 6 }}>
          <MapPin style={{ width: 20, height: 20, color: BT2.text.muted }} />
          <span style={{ color: BT2.text.muted, fontSize: 10 }}>No geocoded properties</span>
          <span style={{ color: BT2.text.muted, fontSize: 8 }}>Properties need lat/lng to appear on map</span>
        </div>
      ) : (
        <svg width="100%" height="100%" viewBox="0 0 460 460" style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <radialGradient id="mapBg" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#111825" />
              <stop offset="100%" stopColor="#0A0E17" />
            </radialGradient>
          </defs>
          <rect width="460" height="460" fill="url(#mapBg)" />

          {[120, 230, 340].map(y => <line key={`h${y}`} x1="0" y1={y} x2="460" y2={y} stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />)}
          {[120, 230, 340].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="460" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />)}

          {ringDistances.map((d, i) => {
            const r = d * scale;
            const colors = ['#00D26A', '#00BCD4', '#A78BFA'];
            return (
              <g key={d}>
                <circle cx="230" cy="230" r={r} stroke={colors[i]} strokeWidth={0.8 - i * 0.1} fill="none" opacity={0.25 - i * 0.06} strokeDasharray="3 2" />
                <text x={230 + r * 0.72} y={230 - r * 0.72} fill={colors[i]} fontSize="7" fontFamily={mono} opacity={0.5 - i * 0.1}>{d}mi</text>
              </g>
            );
          })}

          {mapPositions.map(p => {
            const isHovered = hoveredRank === p.globalRank;
            const pinColor = p.comp.in_comp_set ? '#00D26A' : tierColor(p.tier as TierKey);
            const isTrade = p.tier === 'trade_area';
            const r = isHovered ? 6 : isTrade ? 5 : 3.5;
            const x = Math.max(15, Math.min(445, p.x));
            const y = Math.max(15, Math.min(445, p.y));
            return (
              <g key={p.globalRank}
                onMouseEnter={() => onHover(p.globalRank)}
                onMouseLeave={() => onHover(null)}
                style={{ cursor: 'pointer' }}>
                {isHovered && <circle cx={x} cy={y} r="12" fill={pinColor} opacity="0.08" />}
                <circle cx={x} cy={y} r={r + 1.5} fill={pinColor} opacity={isHovered ? 0.25 : 0.12} />
                <circle cx={x} cy={y} r={r} fill={BT2.bg.terminal} stroke={pinColor} strokeWidth={isHovered ? 2 : 1.5} />
                <text x={x} y={y + (isTrade ? 3 : 2.5)} textAnchor="middle" fill={pinColor} fontSize={isTrade ? 7 : 6} fontFamily={mono} fontWeight="700">{p.globalRank}</text>
                {isHovered && (
                  <g>
                    <rect x={x + 10} y={y - 18} width={130} height={28} rx="3" fill={BT2.bg.header} stroke={BT2.border.medium} strokeWidth="1" opacity="0.95" />
                    <text x={x + 15} y={y - 6} fill={BT2.text.primary} fontSize="8" fontWeight="600">{(p.comp.name || p.comp.address).substring(0, 22)}</text>
                    <text x={x + 15} y={y + 3} fill={BT2.text.muted} fontSize="6" fontFamily={mono}>
                      {p.comp.units}u · {p.comp.class_code || '—'} · {p.comp.distance_miles}mi · {Math.round(p.comp.match_score)}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          <g>
            <circle cx="230" cy="230" r="7" fill="#FF8C42" opacity="0.15" />
            <circle cx="230" cy="230" r="4.5" fill={BT2.bg.terminal} stroke="#FF8C42" strokeWidth="2" />
            <circle cx="230" cy="230" r="2" fill="#FF8C42" />
            <text x="240" y="226" fill="#FF8C42" fontSize="7" fontFamily={mono} fontWeight="700">SUBJECT</text>
          </g>
        </svg>
      )}

      <div style={{ position: 'absolute', bottom: 6, left: 8, right: 8, display: 'flex', gap: 10, alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 8, padding: '3px 6px', background: BT2.bg.header + 'DD', borderRadius: 3, border: `1px solid ${BT2.border.subtle}` }}>
          {[
            { color: '#FF8C42', label: 'Subject' },
            { color: '#00D26A', label: 'In Set' },
            { color: '#00D26A', label: 'Trade', opacity: 0.6 },
            { color: '#00BCD4', label: 'Submarket' },
            { color: '#A78BFA', label: 'MSA' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: l.color, opacity: l.opacity || 1 }} />
              <span style={{ color: BT2.text.muted, fontFamily: mono, fontSize: 6 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TierSection({
  tier, comps, onToggleCompSet, togglingAddress, expanded, onToggleExpand,
  hoveredRank, onHover, rankOffset,
}: {
  tier: TierKey; comps: TieredCompProperty[];
  onToggleCompSet: (comp: TieredCompProperty) => void; togglingAddress: string | null;
  expanded: boolean; onToggleExpand: () => void;
  hoveredRank: number | null; onHover: (rank: number | null) => void;
  rankOffset: number;
}) {
  const config = TIER_CONFIG[tier];
  const inSetCount = comps.filter(c => c.in_comp_set).length;

  return (
    <div style={{ border: `1px solid ${config.color}30`, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
      <button
        onClick={onToggleExpand}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 10px', background: `${config.color}08`, border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {expanded
            ? <ChevronDown style={{ width: 12, height: 12, color: BT2.text.secondary }} />
            : <ChevronRight style={{ width: 12, height: 12, color: BT2.text.secondary }} />}
          <span style={{ color: config.color, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em' }}>{config.label}</span>
          <span style={{ color: BT2.text.secondary, fontFamily: mono, fontSize: 8 }}>({comps.length})</span>
          {inSetCount > 0 && (
            <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
              background: '#00D26A', color: BT2.bg.terminal }}>{inSetCount} in set</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: BT2.text.muted, fontSize: 8, fontFamily: mono }}>
          {comps.length > 0 && (
            <>
              <span>avg {Math.round(comps.reduce((s, c) => s + c.units, 0) / comps.length)}u</span>
              {comps.some(c => c.distance_miles != null) && (
                <span>{(comps.filter(c => c.distance_miles != null).reduce((s, c) => s + (c.distance_miles || 0), 0) / comps.filter(c => c.distance_miles != null).length).toFixed(1)}mi</span>
              )}
            </>
          )}
        </div>
      </button>

      {expanded && (
        <div style={{ background: BT2.bg.panel }}>
          {comps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 10px' }}>
              <MapPin style={{ width: 14, height: 14, margin: '0 auto 4px', display: 'block', color: BT2.text.muted }} />
              <p style={{ color: BT2.text.secondary, fontSize: 9, margin: 0 }}>No properties at this tier</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: BT2.bg.header }}>
                    {['#', 'PROPERTY', 'UNITS', 'BUILT', 'CLS', 'DIST', 'MATCH', 'SET'].map((h, i) => (
                      <th key={i} style={{
                        ...thStyle,
                        textAlign: i === 1 ? 'left' : 'center',
                        width: i === 0 ? 20 : i === 1 ? 'auto' : i === 6 ? 50 : i === 7 ? 42 : 32,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comps.map((comp, idx) => (
                    <CompRow
                      key={comp.address}
                      comp={comp}
                      rank={rankOffset + idx + 1}
                      onToggleCompSet={onToggleCompSet}
                      toggling={togglingAddress === comp.address}
                      hovered={hoveredRank === rankOffset + idx + 1}
                      onHover={onHover}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DealCompAnalysisTabProps {
  dealId?: string;
}

const DealCompAnalysisTab: React.FC<DealCompAnalysisTabProps> = ({ dealId: propDealId }) => {
  const { dealId: paramDealId } = useParams<{ dealId: string }>();
  const dealId = propDealId || paramDealId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tiers, setTiers] = useState<Record<TierKey, TieredCompProperty[]>>({
    trade_area: [], submarket: [], msa: [],
  });
  const [dealInfo, setDealInfo] = useState<{ name: string; address: string } | null>(null);
  const [togglingAddress, setTogglingAddress] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);
  const [expandedTiers, setExpandedTiers] = useState<Record<TierKey, boolean>>({
    trade_area: true, submarket: true, msa: false,
  });
  const [rentalDiscovery, setRentalDiscovery] = useState<{
    loading: boolean;
    result: { median_rent: number | null; comp_count: number; rent_updated: boolean } | null;
    error: string | null;
  }>({ loading: false, result: null, error: null });
  const [marketRent, setMarketRent] = useState<{
    value: number | null;
    sourceType: string | null;
  }>({ value: null, sourceType: null });

  const fetchTieredComps = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await competitionService.discoverTieredComps(dealId, 3);
      setTiers({
        trade_area: result.trade_area,
        submarket: result.submarket,
        msa: result.msa,
      });
      setDealInfo({ name: result.deal.name, address: result.deal.address });
    } catch (err: any) {
      console.error('Failed to fetch tiered comps:', err);
      setError(err.message || 'Failed to load comp analysis');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchTieredComps();
  }, [fetchTieredComps]);

  const allComps = useMemo(() => [...tiers.trade_area, ...tiers.submarket, ...tiers.msa], [tiers]);
  const summary = useMemo(() => computeCompSetSummary(allComps, tiers), [allComps, tiers]);

  const handleToggleCompSet = async (comp: TieredCompProperty) => {
    if (!dealId) return;
    setTogglingAddress(comp.address);
    try {
      if (comp.in_comp_set && comp.comp_set_id) {
        await competitionService.removeFromCompSet(dealId, comp.comp_set_id);
      } else {
        const result = await competitionService.addToCompSet(dealId, {
          address: comp.address,
          name: comp.name,
          units: comp.units,
          year_built: comp.year_built,
          stories: comp.stories,
          class_code: comp.class_code,
          distance_miles: comp.distance_miles,
          match_score: comp.match_score,
          geographic_tier: comp.geographic_tier,
        });
        comp.comp_set_id = result.comp?.id || null;
      }

      setTiers(prev => {
        const updated = { ...prev };
        for (const tier of ['trade_area', 'submarket', 'msa'] as TierKey[]) {
          updated[tier] = prev[tier].map(c =>
            c.address === comp.address
              ? { ...c, in_comp_set: !c.in_comp_set, comp_set_id: c.in_comp_set ? null : (comp.comp_set_id || 'pending') }
              : c
          );
        }
        return updated;
      });
    } catch (err: any) {
      console.error('Failed to toggle comp set:', err);
      setError(`Failed to ${comp.in_comp_set ? 'remove from' : 'add to'} comp set: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setError(null), 4000);
    } finally {
      setTogglingAddress(null);
    }
  };

  const handleResetToDefaults = async () => {
    if (!dealId) return;
    setResetting(true);
    try {
      await competitionService.resetCompSet(dealId, 3);
      await fetchTieredComps();
    } catch (err) {
      console.error('Failed to reset comp set:', err);
    } finally {
      setResetting(false);
    }
  };

  const fetchMarketRent = useCallback(async () => {
    if (!dealId) return;
    try {
      const res: any = await apiClient.get(`/deals/${dealId}/assumptions`);
      const data = res?.data?.data || res?.data;
      setMarketRent({
        value: data?.avg_rent_per_unit ? parseFloat(data.avg_rent_per_unit) : null,
        sourceType: data?.source_type || null,
      });
    } catch {
      // non-blocking
    }
  }, [dealId]);

  useEffect(() => { fetchMarketRent(); }, [fetchMarketRent]);

  const handleDiscoverRental = async () => {
    if (!dealId) return;
    setRentalDiscovery({ loading: true, result: null, error: null });
    try {
      const res: any = await apiClient.post(
        `/deals/${dealId}/comp-set/discover-rental`,
        { radiusMiles: 3, maxComps: 20 },
      );
      // api/client.ts interceptor returns response.data directly (the HTTP body)
      // discover-rental response is flat: { success, dealId, median_rent, comp_count, rent_updated }
      const compCount = res?.comp_count ?? 0;
      setRentalDiscovery({
        loading: false,
        result: {
          median_rent: res?.median_rent ?? null,
          comp_count: compCount,
          rent_updated: res?.rent_updated ?? false,
        },
        error: null,
      });
      await fetchMarketRent();
      await fetchTieredComps();
      window.dispatchEvent(new CustomEvent('assumptions:rent-updated', { detail: { dealId, compCount } }));
    } catch (err: any) {
      setRentalDiscovery({
        loading: false,
        result: null,
        error: err?.message || 'Rental discovery failed',
      });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 20, height: 20, margin: '0 auto 6px', border: `2px solid #A78BFA`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: BT2.text.secondary, fontSize: 9, fontFamily: mono, margin: 0 }}>DISCOVERING COMPS...</p>
        </div>
      </div>
    );
  }

  if (error && allComps.length === 0) {
    return (
      <div style={{ padding: 14, textAlign: 'center', background: '#FF475710', border: `1px solid ${BT2.border.subtle}`, borderRadius: 4 }}>
        <AlertCircle style={{ width: 16, height: 16, margin: '0 auto 4px', display: 'block', color: '#FF4757' }} />
        <p style={{ color: '#FF4757', fontSize: 10, fontWeight: 600, margin: 0 }}>{error}</p>
        <button onClick={fetchTieredComps} style={{ marginTop: 6, color: '#FF4757', fontSize: 9, fontFamily: mono, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          RETRY
        </button>
      </div>
    );
  }

  const totalComps = allComps.length;
  const showTable = viewMode !== 'map';
  const showMap = viewMode !== 'list';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {error && (
        <div style={{ padding: '4px 10px', background: '#FF47570A', borderBottom: `1px solid #FF475730`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle style={{ width: 12, height: 12, color: '#FF4757' }} />
          <span style={{ color: '#FF4757', fontSize: 9 }}>{error}</span>
        </div>
      )}

      {/* Rental discovery result banner */}
      {rentalDiscovery.result && (
        <div style={{
          padding: '6px 10px', marginBottom: 6,
          background: rentalDiscovery.result.rent_updated ? 'rgba(0,210,106,0.08)' : 'rgba(0,188,212,0.08)',
          border: `1px solid ${rentalDiscovery.result.rent_updated ? '#00D26A40' : '#00BCD440'}`,
          borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <TrendingUp style={{ width: 12, height: 12, color: rentalDiscovery.result.rent_updated ? '#00D26A' : '#00BCD4', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            {rentalDiscovery.result.rent_updated && rentalDiscovery.result.median_rent != null ? (
              <span style={{ fontSize: 10, color: BT2.text.primary, fontFamily: mono }}>
                Market rent calibrated:{' '}
                <strong style={{ color: '#00D26A' }}>${rentalDiscovery.result.median_rent.toLocaleString()}/mo</strong>
                {' '}from <strong>{rentalDiscovery.result.comp_count}</strong> apt locator comps — saved to assumptions
              </span>
            ) : rentalDiscovery.result.median_rent != null ? (
              <span style={{ fontSize: 10, color: BT2.text.secondary, fontFamily: mono }}>
                Market estimate:{' '}
                <strong style={{ color: '#00BCD4' }}>${rentalDiscovery.result.median_rent.toLocaleString()}/mo</strong>
                {' '}from <strong>{rentalDiscovery.result.comp_count}</strong> comps
                {' '}· <span style={{ color: BT2.text.muted }}>existing assumption preserved (user-set)</span>
              </span>
            ) : (
              <span style={{ fontSize: 10, color: BT2.text.muted }}>
                No rental comps found within 3 mi — check property coordinates
              </span>
            )}
          </div>
          <button
            onClick={() => setRentalDiscovery({ loading: false, result: null, error: null })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: BT2.text.muted, fontSize: 10, padding: 0 }}
          >×</button>
        </div>
      )}
      {rentalDiscovery.error && (
        <div style={{ padding: '4px 10px', marginBottom: 6, background: '#FF47570A', border: `1px solid #FF475730`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle style={{ width: 10, height: 10, color: '#FF4757' }} />
          <span style={{ fontSize: 9, color: '#FF4757' }}>Rental discovery failed: {rentalDiscovery.error}</span>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px', background: BT2.bg.panel,
        borderLeft: `3px solid ${BT2.text.purple}`, borderRadius: 4,
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ color: BT2.text.purple, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>COMP SET</span>
            <span style={{ color: BT2.text.green, fontFamily: mono, fontSize: 13, fontWeight: 800 }}>{summary.count}</span>
            <span style={{ color: BT2.text.muted, fontSize: 8 }}>selected</span>
          </div>
          <div style={{ width: 1, height: 14, background: BT2.border.subtle }} />
          {(['trade_area', 'submarket', 'msa'] as TierKey[]).map(tier => (
            <div key={tier} style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
              <span style={{ color: BT2.text.muted, fontFamily: mono, fontSize: 7 }}>{TIER_CONFIG[tier].label.split(' ')[0]}</span>
              <span style={{ color: TIER_CONFIG[tier].color, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{summary.perTier[tier]}</span>
            </div>
          ))}
          <div style={{ width: 1, height: 14, background: BT2.border.subtle }} />
          <div style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
            <span style={{ color: BT2.text.muted, fontFamily: mono, fontSize: 7 }}>AVG MATCH</span>
            <span style={{ color: BT2.text.primary, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{summary.avgMatchScore ?? '—'}</span>
          </div>
          {summary.avgDistance != null && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
              <span style={{ color: BT2.text.muted, fontFamily: mono, fontSize: 7 }}>RADIUS</span>
              <span style={{ color: BT2.text.primary, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{summary.avgDistance}mi</span>
            </div>
          )}
          {marketRent.value != null && (
            <>
              <div style={{ width: 1, height: 14, background: BT2.border.subtle }} />
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <span style={{ color: BT2.text.muted, fontFamily: mono, fontSize: 7 }}>MKT RENT</span>
                <span style={{ color: '#00D26A', fontFamily: mono, fontSize: 10, fontWeight: 700 }}>
                  ${Math.round(marketRent.value).toLocaleString()}
                </span>
                {marketRent.sourceType === 'apt_locator' && (
                  <span style={{
                    fontSize: 7, fontWeight: 700, fontFamily: mono, letterSpacing: 0.5,
                    color: '#00BCD4', background: '#00BCD410',
                    border: '1px solid #00BCD440', borderRadius: 2,
                    padding: '1px 4px',
                  }}>MARKET EST</span>
                )}
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {(['list', 'split', 'map'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: '2px 7px', fontSize: 7, fontWeight: 700, fontFamily: mono,
              border: `1px solid ${viewMode === m ? BT2.text.cyan + '60' : BT2.border.medium}`, borderRadius: 3,
              color: viewMode === m ? BT2.text.cyan : BT2.text.muted,
              background: viewMode === m ? '#00BCD410' : 'transparent', cursor: 'pointer',
            }}>{m === 'list' ? '☰ LIST' : m === 'split' ? '◧ SPLIT' : '◻ MAP'}</button>
          ))}
          <div style={{ width: 1, height: 14, background: BT2.border.subtle, margin: '0 2px' }} />
          <button
            onClick={handleDiscoverRental}
            disabled={rentalDiscovery.loading}
            title="Discover nearby apartments from Apt Locator and calibrate market rent"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', fontSize: 7, fontWeight: 700, fontFamily: mono,
              border: `1px solid ${rentalDiscovery.loading ? BT2.border.medium : '#00BCD440'}`,
              borderRadius: 3,
              color: rentalDiscovery.loading ? BT2.text.muted : '#00BCD4',
              background: rentalDiscovery.loading ? 'transparent' : '#00BCD408',
              cursor: rentalDiscovery.loading ? 'wait' : 'pointer',
              opacity: rentalDiscovery.loading ? 0.6 : 1 }}
          >
            <Zap style={{ width: 9, height: 9, animation: rentalDiscovery.loading ? 'spin 1s linear infinite' : 'none' }} />
            {rentalDiscovery.loading ? 'CALIBRATING...' : 'RENTAL COMPS'}
          </button>
          <button
            onClick={handleResetToDefaults}
            disabled={resetting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', fontSize: 7, fontWeight: 700, fontFamily: mono,
              border: `1px solid ${BT2.border.medium}`, borderRadius: 3,
              color: BT2.text.secondary, background: 'transparent', cursor: resetting ? 'wait' : 'pointer',
              opacity: resetting ? 0.5 : 1 }}
          >
            <RotateCcw style={{ width: 9, height: 9, animation: resetting ? 'spin 1s linear infinite' : 'none' }} />
            {resetting ? 'RESETTING...' : 'RESET'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 8, overflow: 'hidden', minHeight: 0 }}>
        {showTable && (
          <div style={{
            flex: viewMode === 'list' ? 1 : 0,
            width: viewMode === 'list' ? '100%' : '58%',
            minWidth: viewMode === 'list' ? undefined : '58%',
            display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto',
          }}>
            {(['trade_area', 'submarket', 'msa'] as TierKey[]).map(tier => {
              const offset = tier === 'trade_area' ? 0
                : tier === 'submarket' ? tiers.trade_area.length
                : tiers.trade_area.length + tiers.submarket.length;
              return (
                <TierSection
                  key={tier}
                  tier={tier}
                  comps={tiers[tier]}
                  onToggleCompSet={handleToggleCompSet}
                  togglingAddress={togglingAddress}
                  expanded={expandedTiers[tier]}
                  onToggleExpand={() => setExpandedTiers(prev => ({ ...prev, [tier]: !prev[tier] }))}
                  hoveredRank={hoveredRank}
                  onHover={setHoveredRank}
                  rankOffset={offset}
                />
              );
            })}
          </div>
        )}

        {showMap && (
          <div style={{
            width: viewMode === 'map' ? '100%' : '42%',
            minWidth: viewMode === 'map' ? undefined : '42%',
            minHeight: 300,
          }}>
            <CompMapPanel
              allComps={allComps}
              tiers={tiers}
              hoveredRank={hoveredRank}
              onHover={setHoveredRank}
            />
          </div>
        )}
      </div>

      {totalComps === 0 && (
        <div style={{ padding: '20px 10px', textAlign: 'center', background: BT2.bg.header, border: `1px solid ${BT2.border.subtle}`, borderRadius: 4, marginTop: 8 }}>
          <MapPin style={{ width: 16, height: 16, margin: '0 auto 6px', display: 'block', color: BT2.text.muted }} />
          <p style={{ color: BT2.text.secondary, fontSize: 10, fontWeight: 600, margin: 0 }}>No comparable properties found</p>
          <p style={{ color: BT2.text.muted, fontSize: 8, margin: '3px 0 0' }}>Records may lack geocoded coordinates.</p>
          <button
            onClick={handleResetToDefaults}
            style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: 9, fontWeight: 700, fontFamily: mono,
              background: '#A78BFA', color: BT2.bg.terminal, borderRadius: 2, border: 'none', cursor: 'pointer' }}
          >
            <RotateCcw style={{ width: 10, height: 10 }} />
            RUN AUTO-DISCOVERY
          </button>
        </div>
      )}
    </div>
  );
};

export default DealCompAnalysisTab;
