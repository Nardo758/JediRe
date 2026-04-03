import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';

const BT2 = BT;

type TierKey = 'trade_area' | 'submarket' | 'msa';

const mono = 'var(--bt-mono)';

const TIER_CONFIG: Record<TierKey, { label: string; color: string; icon: string }> = {
  trade_area: { label: 'Trade Area', color: '#00D26A', icon: '📍' },
  submarket:  { label: 'Submarket',  color: '#00BCD4', icon: '🏘️' },
  msa:        { label: 'MSA',        color: '#A78BFA', icon: '🌆' },
};

interface CompSetSummary {
  count: number;
  avgUnits: number | null;
  avgDistance: number | null;
  avgMatchScore: number | null;
}

function computeCompSetSummary(comps: TieredCompProperty[]): CompSetSummary {
  const inSet = comps.filter(c => c.in_comp_set);
  if (inSet.length === 0) return { count: 0, avgUnits: null, avgDistance: null, avgMatchScore: null };

  const withDist = inSet.filter(c => c.distance_miles != null);

  return {
    count: inSet.length,
    avgUnits: Math.round(inSet.reduce((s, c) => s + c.units, 0) / inSet.length),
    avgDistance: withDist.length > 0 ? Math.round(withDist.reduce((s, c) => s + (c.distance_miles || 0), 0) / withDist.length * 10) / 10 : null,
    avgMatchScore: Math.round(inSet.reduce((s, c) => s + c.match_score, 0) / inSet.length),
  };
}

const thStyle: React.CSSProperties = {
  padding: '4px 8px', fontSize: 8, fontFamily: mono, fontWeight: 700,
  letterSpacing: '0.06em', color: BT2.text.muted,
};

function CompRow({
  comp, rank, onToggleCompSet, toggling,
}: {
  comp: TieredCompProperty; rank: number;
  onToggleCompSet: (comp: TieredCompProperty) => void; toggling: boolean;
}) {
  const scoreColor = comp.match_score >= 70 ? BT2.text.green : comp.match_score >= 50 ? BT2.text.amber : BT2.text.muted;
  const [hovered, setHovered] = useState(false);

  return (
    <tr style={{ borderTop: `1px solid ${BT2.border.subtle}40`, background: hovered ? BT2.bg.header : 'transparent' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={{ padding: '4px 8px', textAlign: 'center', color: BT2.text.muted, fontFamily: mono, fontSize: 9 }}>{rank}</td>
      <td style={{ padding: '4px 8px' }}>
        <div style={{ color: BT2.text.primary, fontSize: 10, fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.name || comp.address}</div>
        <div style={{ color: BT2.text.muted, fontSize: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.address}</div>
      </td>
      <td style={{ padding: '4px 8px', textAlign: 'center', color: BT2.text.secondary, fontFamily: mono, fontSize: 9 }}>{comp.units || '—'}</td>
      <td style={{ padding: '4px 8px', textAlign: 'center', color: BT2.text.secondary, fontFamily: mono, fontSize: 9 }}>{comp.year_built || '—'}</td>
      <td style={{ padding: '4px 8px', textAlign: 'center', color: BT2.text.secondary, fontFamily: mono, fontSize: 9 }}>{comp.stories || '—'}</td>
      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
        {comp.class_code ? (
          <span style={{
            fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
            background: comp.class_code.startsWith('A') ? '#00BCD411' : comp.class_code.startsWith('B') ? '#F5A62311' : BT2.bg.header,
            color: comp.class_code.startsWith('A') ? '#00BCD4' : comp.class_code.startsWith('B') ? '#F5A623' : BT2.text.muted,
          }}>{comp.class_code}</span>
        ) : <span style={{ color: BT2.text.muted, fontSize: 9 }}>—</span>}
      </td>
      <td style={{ padding: '4px 8px', textAlign: 'center', color: BT2.text.secondary, fontFamily: mono, fontSize: 9 }}>
        {comp.distance_miles != null ? `${comp.distance_miles}mi` : '—'}
      </td>
      <td style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: scoreColor, fontFamily: mono, fontSize: 9, fontWeight: 700, minWidth: 18 }}>{Math.round(comp.match_score)}</span>
          <div style={{ width: 36, height: 3, background: BT2.bg.header, borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, comp.match_score)}%`, height: '100%', background: scoreColor, borderRadius: 1 }} />
          </div>
        </div>
      </td>
      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
        <button
          onClick={() => onToggleCompSet(comp)}
          disabled={toggling}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 6px', fontSize: 8, fontWeight: 700, fontFamily: mono,
            borderRadius: 2, cursor: toggling ? 'wait' : 'pointer',
            opacity: toggling ? 0.5 : 1,
            background: comp.in_comp_set ? '#00D26A18' : BT2.bg.header,
            color: comp.in_comp_set ? '#00D26A' : BT2.text.secondary,
            border: `1px solid ${comp.in_comp_set ? '#00D26A55' : BT2.border.medium}`,
          }}
        >
          {comp.in_comp_set ? (<><Check style={{ width: 9, height: 9 }} /> IN</>) : (<><Plus style={{ width: 9, height: 9 }} /> ADD</>)}
        </button>
      </td>
    </tr>
  );
}

function TierSection({
  tier, comps, onToggleCompSet, togglingAddress,
}: {
  tier: TierKey; comps: TieredCompProperty[];
  onToggleCompSet: (comp: TieredCompProperty) => void; togglingAddress: string | null;
}) {
  const [expanded, setExpanded] = useState(tier === 'trade_area');
  const config = TIER_CONFIG[tier];
  const inSetCount = comps.filter(c => c.in_comp_set).length;

  return (
    <div style={{ border: `1px solid ${config.color}30`, borderRadius: 4, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 10px', background: `${config.color}08`, border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {expanded
            ? <ChevronDown style={{ width: 12, height: 12, color: BT2.text.secondary }} />
            : <ChevronRight style={{ width: 12, height: 12, color: BT2.text.secondary }} />}
          <span style={{ color: config.color, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em' }}>{config.icon} {config.label.toUpperCase()}</span>
          <span style={{ color: BT2.text.secondary, fontFamily: mono, fontSize: 8 }}>({comps.length})</span>
          {inSetCount > 0 && (
            <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
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
            <div style={{ textAlign: 'center', padding: '14px 10px' }}>
              <MapPin style={{ width: 14, height: 14, margin: '0 auto 4px', display: 'block', color: BT2.text.muted }} />
              <p style={{ color: BT2.text.secondary, fontSize: 9, margin: 0 }}>No properties at this tier</p>
              <p style={{ color: BT2.text.muted, fontSize: 8, margin: '2px 0 0' }}>
                {tier === 'trade_area' && 'No geocoded properties within trade area radius'}
                {tier === 'submarket' && 'Deal not within a defined submarket boundary'}
                {tier === 'msa' && 'Deal not within a defined MSA boundary'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: BT2.bg.header }}>
                    <th style={{ ...thStyle, width: 28, textAlign: 'center' }}>#</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>PROPERTY</th>
                    <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>UNITS</th>
                    <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>BUILT</th>
                    <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>STOR</th>
                    <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>CLS</th>
                    <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>DIST</th>
                    <th style={{ ...thStyle, width: 56, textAlign: 'left' }}>MATCH</th>
                    <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>SET</th>
                  </tr>
                </thead>
                <tbody>
                  {comps.map((comp, idx) => (
                    <CompRow
                      key={comp.address}
                      comp={comp}
                      rank={idx + 1}
                      onToggleCompSet={onToggleCompSet}
                      toggling={togglingAddress === comp.address}
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

  const allComps = [...tiers.trade_area, ...tiers.submarket, ...tiers.msa];
  const summary = computeCompSetSummary(allComps);

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

  if (error) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px', background: BT2.bg.panel,
        borderLeft: `3px solid ${BT2.text.purple}`, borderRadius: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: BT2.text.purple, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>DISCOVERY</span>
          <span style={{ color: BT2.border.subtle }}>·</span>
          <span style={{ color: BT2.text.primary, fontSize: 10, fontWeight: 700 }}>{dealInfo?.name || 'Deal'}</span>
          <span style={{ color: BT2.text.muted, fontSize: 8, fontFamily: mono }}>{totalComps} props</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {summary.count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 7, fontFamily: mono, color: BT2.text.muted }}>SET:</span>
              <span style={{ fontSize: 9, fontFamily: mono, color: '#00D26A', fontWeight: 700 }}>{summary.count}</span>
              <span style={{ color: BT2.border.subtle }}>|</span>
              <span style={{ fontSize: 7, fontFamily: mono, color: BT2.text.muted }}>AVG UNITS:</span>
              <span style={{ fontSize: 9, fontFamily: mono, color: BT2.text.primary, fontWeight: 700 }}>{summary.avgUnits ?? '—'}</span>
              <span style={{ color: BT2.border.subtle }}>|</span>
              <span style={{ fontSize: 7, fontFamily: mono, color: BT2.text.muted }}>DIST:</span>
              <span style={{ fontSize: 9, fontFamily: mono, color: BT2.text.primary, fontWeight: 700 }}>{summary.avgDistance != null ? `${summary.avgDistance}mi` : '—'}</span>
              <span style={{ color: BT2.border.subtle }}>|</span>
              <span style={{ fontSize: 7, fontFamily: mono, color: BT2.text.muted }}>MATCH:</span>
              <span style={{ fontSize: 9, fontFamily: mono, color: BT2.text.primary, fontWeight: 700 }}>{summary.avgMatchScore ?? '—'}</span>
            </div>
          )}
          {summary.count === 0 && (
            <span style={{ fontSize: 8, fontFamily: mono, color: '#F5A623' }}>No comps selected</span>
          )}
          <button
            onClick={handleResetToDefaults}
            disabled={resetting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', fontSize: 8, fontWeight: 700, fontFamily: mono,
              border: `1px solid ${BT2.border.medium}`, borderRadius: 2,
              color: BT2.text.secondary, background: 'transparent', cursor: resetting ? 'wait' : 'pointer',
              opacity: resetting ? 0.5 : 1 }}
          >
            <RotateCcw style={{ width: 10, height: 10, animation: resetting ? 'spin 1s linear infinite' : 'none' }} />
            {resetting ? 'RESETTING...' : 'RESET'}
          </button>
        </div>
      </div>

      {(['trade_area', 'submarket', 'msa'] as TierKey[]).map(tier => (
        <TierSection
          key={tier}
          tier={tier}
          comps={tiers[tier]}
          onToggleCompSet={handleToggleCompSet}
          togglingAddress={togglingAddress}
        />
      ))}

      {totalComps === 0 && (
        <div style={{ padding: '20px 10px', textAlign: 'center', background: BT2.bg.header, border: `1px solid ${BT2.border.subtle}`, borderRadius: 4 }}>
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
