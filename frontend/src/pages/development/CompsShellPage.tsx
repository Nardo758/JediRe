import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, BtTabWrapper, SectionPanel, DataRow, Bd, KpiTile,
} from '../../components/deal/bloomberg-ui';
import CompetitionPage from './CompetitionPage';
import { apiClient } from '../../services/api.client';

const TABS = ['SALE COMPS', 'COMPETITION ANALYSIS'];

interface CompsShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
  onUpdate?: () => void;
}

interface CompTransaction {
  id: string;
  recording_date: string;
  property_address: string;
  units: number;
  year_built: number;
  derived_sale_price: number;
  price_per_unit: number;
  implied_cap_rate: number | null;
  buyer_type: string;
  distance_miles: number;
}

interface CompSet {
  comp_count: number;
  median_price_per_unit: number;
  avg_price_per_unit: number;
  avg_implied_cap_rate: number | null;
  comps: CompTransaction[];
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(2)}%` : '—';
}

function fmtDate(s: string): string {
  if (!s) return '—';
  return s.slice(0, 10);
}

function fmtMi(v: number): string {
  return `${v.toFixed(2)} mi`;
}

export function CompsShellPage({ dealId: propDealId, deal, onUpdate }: CompsShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = deal?.id as string | undefined ?? propDealId ?? params.dealId ?? params.id ?? '';

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [compSet, setCompSet] = useState<CompSet | null>(null);

  useEffect(() => {
    if (!resolvedDealId) return;
    setLoading(true);
    apiClient
      .get<{ data?: CompSet }>(`/api/v1/deals/${resolvedDealId}/comps`)
      .then((res) => {
        const payload = res.data?.data ?? (res.data as unknown as CompSet);
        setCompSet(payload ?? null);
      })
      .catch(() => setCompSet(null))
      .finally(() => setLoading(false));
  }, [resolvedDealId]);

  const count    = compSet?.comp_count ?? compSet?.comps?.length ?? 0;
  const avgPpu   = compSet?.avg_price_per_unit ?? 0;
  const avgCap   = compSet?.avg_implied_cap_rate ?? null;
  const compScore = count >= 10 ? 'HIGH' : count >= 5 ? 'MED' : count > 0 ? 'LOW' : 'N/A';
  const compScoreColor = count >= 10 ? BT.met.financial : count >= 5 ? BT.text.amber : BT.text.muted;

  const verdictOk  = count >= 5;
  const verdictTxt = verdictOk
    ? `COMPS SUPPORTED — ${count} COMPARABLES IN DATABASE`
    : count > 0
      ? `THIN MARKET — ONLY ${count} COMPS AVAILABLE · MANUAL REVIEW REQUIRED`
      : 'NO COMPS LOADED — GENERATE OR IMPORT COMPS TO PROCEED';
  const verdictColor = verdictOk ? BT.met.financial : count > 0 ? BT.text.amber : BT.text.muted;

  const comps = compSet?.comps ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="COMPS & COMPETITION"
        subtitle="M15 · SALE COMPS + PEER BENCHMARKING"
        borderColor={BT.text.amber}
        metrics={[
          { l: 'SALE COMPS',  c: BT.text.amber    },
          { l: 'F_CAP',       c: BT.met.financial },
          { l: 'O_OCC',       c: BT.met.occupancy },
          { l: 'COMP SCORE',  c: BT.text.cyan     },
        ]}
        right={<Bd c={compScoreColor}>{compScore}</Bd>}
      />

      <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
        <div style={{ flex: 1 }}><KpiTile label="COMP COUNT"    value={loading ? '…' : String(count)} color={BT.text.amber} /></div>
        <div style={{ flex: 1 }}><KpiTile label="AVG $/UNIT"   value={loading ? '…' : (avgPpu > 0 ? fmtUsd(avgPpu) : '—')} color={BT.met.financial} /></div>
        <div style={{ flex: 1 }}><KpiTile label="AVG CAP RATE" value={loading ? '…' : fmtPct(avgCap)} color={BT.text.cyan} /></div>
        <div style={{ flex: 1 }}><KpiTile label="COMP SCORE"   value={loading ? '…' : compScore} color={compScoreColor} /></div>
      </div>

      <div style={{
        padding: '4px 10px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        fontFamily: BT.font.mono, fontSize: 9, fontWeight: 700,
        color: verdictColor, letterSpacing: 0.5, flexShrink: 0,
      }}>
        ▶ {verdictTxt}
      </div>

      <SubTabBar
        tabs={TABS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.text.amber}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <SectionPanel title="SALE COMP TRANSACTIONS" subtitle={`${count} RECORDS · /api/v1/deals/.../comps`} borderColor={BT.text.amber} style={{ minHeight: '100%' }}>
            {loading && (
              <div style={{ padding: 24, color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 11 }}>LOADING COMPS…</div>
            )}
            {!loading && comps.length === 0 && (
              <div style={{ padding: 24, color: BT.text.muted, fontFamily: BT.font.mono, fontSize: 11 }}>NO COMP DATA — USE GENERATE COMPS ACTION</div>
            )}
            {!loading && comps.map((c) => (
              <SectionPanel key={c.id} title={c.property_address || '—'} subtitle={`${fmtDate(c.recording_date)} · ${fmtMi(c.distance_miles)}`} borderColor={BT.border.subtle} style={{ margin: '4px 8px' }}>
                <DataRow label="SALE PRICE"   value={fmtUsd(c.derived_sale_price)} valueColor={BT.met.financial} />
                <DataRow label="PRICE / UNIT" value={fmtUsd(c.price_per_unit)}     valueColor={BT.text.cyan}     />
                <DataRow label="CAP RATE"     value={fmtPct(c.implied_cap_rate)}   valueColor={BT.text.amber}    />
                <DataRow label="UNITS"        value={String(c.units)}              valueColor={BT.text.secondary} />
                <DataRow label="YEAR BUILT"   value={String(c.year_built)}         valueColor={BT.text.secondary} />
                <DataRow label="BUYER TYPE"   value={c.buyer_type || '—'}          valueColor={BT.text.secondary} />
                <DataRow label="DISTANCE"     value={fmtMi(c.distance_miles)}      valueColor={BT.text.muted}    />
              </SectionPanel>
            ))}
          </SectionPanel>
        )}

        {activeTab === 1 && (
          <BtTabWrapper>
            <CompetitionPage dealId={resolvedDealId} deal={deal} dealType={''} onUpdate={onUpdate} />
          </BtTabWrapper>
        )}
      </div>
    </div>
  );
}

export default CompsShellPage;
