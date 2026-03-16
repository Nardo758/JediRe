import React, { useEffect, useState } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { apiClient } from '@/services/api.client';

interface DevelopmentOverviewProps {
  deal: any;
  dealId?: string;
  onStrategySelected?: (strategyId: string) => void;
  onTabChange?: (tabId: string) => void;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
}

const f = (deal: any, snake: string, camel: string, fallback: any = null) =>
  deal?.[snake] ?? deal?.[camel] ?? fallback;

const SectionHead: React.FC<{
  title: string;
  right?: string;
  accentColor?: string;
}> = ({ title, right, accentColor = 'border-amber-500' }) => (
  <div className={`flex items-center justify-between px-4 py-2.5 bg-stone-50 border-y border-stone-200 border-l-[3px] ${accentColor}`}>
    <span className="text-[10px] font-mono text-stone-500 tracking-widest font-bold uppercase">{title}</span>
    {right && <span className="text-[10px] text-stone-400">{right}</span>}
  </div>
);

const KVCard: React.FC<{
  label: string;
  value: string;
  note?: string;
  valueColor?: string;
  noteColor?: string;
}> = ({ label, value, note, valueColor = 'text-amber-600', noteColor = 'text-stone-400' }) => (
  <div className="bg-white p-3">
    <div className="text-[9px] font-mono text-stone-400 tracking-widest uppercase mb-1">{label}</div>
    <div className={`text-lg font-bold font-mono ${valueColor}`}>{value}</div>
    {note && <div className={`text-[10px] mt-1 ${noteColor}`}>{note}</div>}
  </div>
);

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${color}`}>
    {label}
  </span>
);

const EmptyState: React.FC<{ message: string; linkLabel?: string; onClick?: () => void }> = ({ message, linkLabel, onClick }) => (
  <div className="bg-stone-50 border border-stone-200 rounded-lg p-6 text-center">
    <p className="text-xs text-stone-400 mb-2">{message}</p>
    {linkLabel && onClick && (
      <button onClick={onClick} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
        {linkLabel} &rarr;
      </button>
    )}
  </div>
);

const fmtDollar = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(0)}`;
};

const pct = (n: number | null | undefined, decimals = 1): string =>
  n != null && !isNaN(n) ? `${n.toFixed(decimals)}%` : '—';

export const DevelopmentOverview: React.FC<DevelopmentOverviewProps> = ({
  deal,
  dealId,
  onTabChange,
}) => {
  const {
    capitalStructure, financial, activeScenario, siteData,
    computedReturns,
  } = useDealModule();

  const id = dealId || deal?.id;

  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setEntitlementLoading(true);
    apiClient.get(`/api/v1/entitlements/deal/${id}`)
      .then(res => {
        const raw = res.data?.data ?? res.data?.entitlements ?? res.data;
        setEntitlements(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setEntitlements([]))
      .finally(() => setEntitlementLoading(false));
  }, [id]);

  useEffect(() => {
    const county = f(deal, 'county', 'county', '');
    const state = f(deal, 'state', 'state', '');
    if (!county || !state) return;
    apiClient.get('/api/v1/benchmark-timeline/benchmarks', { params: { county, state } })
      .then(res => {
        const sums: any[] = res.data?.summaries || [];
        if (sums.length === 0) return setBenchmarks(null);
        const avg = (key: string) => {
          const vals = sums.map((s: any) => s[key]).filter((v: any) => typeof v === 'number' && v > 0);
          return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null;
        };
        setBenchmarks({ p25: avg('p25Months'), p50: avg('medianMonths'), p75: avg('p75Months'), p90: avg('p90Months') });
      })
      .catch(() => setBenchmarks(null));
  }, [deal?.county, deal?.state]);

  const lotSize = f(deal, 'lot_size', 'lotSize', null) || f(deal, 'lot_size_sf', 'lotSizeSf', null) || siteData?.lotAreaSf;
  const zoning = f(deal, 'zoning_code', 'zoningCode', null) || f(deal, 'zoning', 'zoning', null) || siteData?.baseDistrictCode;
  const maxDensity = f(deal, 'max_density', 'maxDensity', null) || activeScenario?.maxUnits;
  const maxHeight = f(deal, 'max_height', 'maxHeight', null) || activeScenario?.maxStories;
  const entitled = f(deal, 'entitled', 'entitled', null);

  const proposedUnits = f(deal, 'target_units', 'targetUnits', null) || f(deal, 'units', 'units', null);
  const totalSF = f(deal, 'total_sf', 'totalSf', null) || f(deal, 'gross_building_area', 'grossBuildingArea', null);
  const buildingType = f(deal, 'building_type', 'buildingType', null) || f(deal, 'property_type', 'propertyType', 'Multifamily');
  const parking = f(deal, 'parking_spaces', 'parkingSpaces', null) || activeScenario?.parkingRequired;

  const unitMix: any[] = f(deal, 'unit_mix', 'unitMix', null) || [];
  const totalUnitsFromMix = unitMix.reduce((s: number, u: any) => s + (u.count || u.units || 0), 0);

  const landCost = f(deal, 'land_cost', 'landCost', null) || financial?.landCost || capitalStructure?.landCost;
  const hardCosts = f(deal, 'hard_costs', 'hardCosts', null) || financial?.hardCosts || capitalStructure?.hardCosts;
  const softCosts = f(deal, 'soft_costs', 'softCosts', null) || financial?.softCosts || capitalStructure?.softCosts;
  const contingency = f(deal, 'contingency', 'contingency', null) || capitalStructure?.contingency;
  const totalDevCost = f(deal, 'total_development_cost', 'totalDevelopmentCost', null) || financial?.totalDevelopmentCost || capitalStructure?.totalDevelopmentCost;
  const costPerUnit = totalDevCost && proposedUnits ? totalDevCost / proposedUnits : null;
  const costPerSF = totalDevCost && totalSF ? totalDevCost / totalSF : null;
  const totalEquity = capitalStructure?.totalEquity || financial?.totalEquity;
  const totalDebt = capitalStructure?.loanBalance?.[0] ?? capitalStructure?.totalDebt ?? financial?.totalDebt;

  const constructionMonths = f(deal, 'construction_months', 'constructionMonths', null);
  const leaseUpMonths = f(deal, 'lease_up_months', 'leaseUpMonths', null);
  const totalMonths = constructionMonths && leaseUpMonths ? constructionMonths + leaseUpMonths : null;

  const yoc = financial?.yieldOnCost || (computedReturns?.yieldOnCost ? computedReturns.yieldOnCost * 100 : null);
  const irr = financial?.irr || (computedReturns?.irrLevered ? computedReturns.irrLevered * 100 : null);
  const em = financial?.equityMultiple || computedReturns?.equityMultiple;
  const profitMargin = f(deal, 'profit_margin', 'profitMargin', null);

  const costStack = [
    { label: 'Land Acquisition', value: landCost },
    { label: 'Hard Costs', value: hardCosts },
    { label: 'Soft Costs', value: softCosts },
    { label: 'Contingency', value: contingency },
    { label: 'Total Dev Cost', value: totalDevCost, bold: true },
    { label: 'Cost / Unit', value: costPerUnit },
    { label: 'Cost / SF', value: costPerSF },
    ...(totalDebt != null ? [{ label: 'Total Debt', value: totalDebt }] : []),
    ...(totalEquity != null ? [{ label: 'Total Equity', value: totalEquity }] : []),
  ];

  const moduleLinks = [
    { label: 'Zoning', tab: 'zoning', icon: '📐' },
    { label: 'Unit Mix', tab: 'unit-mix', icon: '🏠' },
    { label: 'ProForma', tab: 'proforma', icon: '📊' },
    { label: 'Competition', tab: 'competition', icon: '🏢' },
    { label: 'Capital', tab: 'capital', icon: '💰' },
    { label: 'Risk', tab: 'risk-management', icon: '⚠️' },
  ];

  return (
    <div className="space-y-5">
      {/* §1 — Site + Zoning Constraints */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionHead title="Site + Zoning Constraints" right="M04 Zoning" accentColor="border-cyan-500" />
        <div className="grid grid-cols-4 gap-px bg-stone-200 rounded-lg overflow-hidden mt-3">
          <KVCard label="Lot Size" value={lotSize ? `${Math.round(lotSize).toLocaleString()} SF` : '—'} note={lotSize ? `${(lotSize / 43560).toFixed(2)} ac` : undefined} />
          <KVCard label="Zoning" value={zoning || '—'} valueColor="text-stone-900" />
          <KVCard label="Max Density" value={maxDensity ? `${maxDensity} units` : '—'} valueColor="text-emerald-600" />
          <KVCard label="Max Height" value={maxHeight ? `${maxHeight} stories` : '—'} valueColor="text-violet-600" />
        </div>
        <div className="mt-3">
          {entitled === true && <Badge label="ENTITLED" color="bg-emerald-100 text-emerald-700 border border-emerald-300" />}
          {entitled === false && <Badge label="NOT ENTITLED" color="bg-amber-100 text-amber-700 border border-amber-300" />}
          {entitled == null && <Badge label="ENTITLEMENT STATUS UNKNOWN" color="bg-stone-100 text-stone-500 border border-stone-300" />}
        </div>
      </div>

      {/* §2 — Building Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionHead title="Building Configuration" right="Proposed Program" accentColor="border-emerald-500" />
        <div className="grid grid-cols-4 gap-px bg-stone-200 rounded-lg overflow-hidden mt-3">
          <KVCard label="Proposed Units" value={proposedUnits ? `${proposedUnits}` : '—'} valueColor="text-emerald-600" />
          <KVCard label="Total SF" value={totalSF ? `${Math.round(totalSF).toLocaleString()}` : '—'} valueColor="text-stone-900" />
          <KVCard label="Building Type" value={buildingType || '—'} valueColor="text-stone-900" />
          <KVCard label="Parking" value={parking ? `${parking} spaces` : '—'} valueColor="text-stone-900" />
        </div>
      </div>

      {/* §3 — Entitlement Pipeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionHead title="Entitlement Pipeline" right="Permits & Approvals" accentColor="border-violet-500" />
        <div className="mt-3">
          {entitlementLoading && <p className="text-xs text-stone-400 animate-pulse">Loading entitlements...</p>}
          {!entitlementLoading && entitlements.length === 0 && (
            <EmptyState
              message="No entitlements or permits on file for this deal."
              linkLabel="Open Zoning Module"
              onClick={() => onTabChange?.('zoning')}
            />
          )}
          {!entitlementLoading && entitlements.length > 0 && (
            <div className="space-y-2">
              {entitlements.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                  <div>
                    <span className="text-xs font-semibold text-stone-800">{e.name || e.permit_type || e.type || 'Permit'}</span>
                    {e.number && <span className="text-[10px] text-stone-400 ml-2">#{e.number}</span>}
                  </div>
                  <Badge
                    label={(e.status || 'PENDING').toUpperCase()}
                    color={
                      (e.status || '').toLowerCase() === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      (e.status || '').toLowerCase() === 'denied' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }
                  />
                </div>
              ))}
            </div>
          )}
          {benchmarks && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <div className="text-[9px] font-mono text-stone-400 tracking-widest font-bold mb-2">BENCHMARK TIMELINE</div>
              <div className="grid grid-cols-4 gap-2">
                {['p25', 'p50', 'p75', 'p90'].map(k => (
                  <div key={k} className="text-center bg-stone-50 rounded p-2">
                    <div className="text-[9px] text-stone-400 uppercase">{k}</div>
                    <div className="text-sm font-bold text-stone-700 font-mono">
                      {benchmarks[k] != null ? `${benchmarks[k]}mo` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* §4 — Unit Mix Program */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionHead title="Unit Mix Program" right={totalUnitsFromMix > 0 ? `${totalUnitsFromMix} total units` : ''} accentColor="border-blue-500" />
        <div className="mt-3">
          {unitMix.length === 0 ? (
            <EmptyState
              message="No unit mix configured for this deal."
              linkLabel="Configure Unit Mix"
              onClick={() => onTabChange?.('unit-mix')}
            />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  {['Type', 'Count', 'Avg SF', 'Target Rent', '% of Total'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[9px] font-mono text-stone-400 tracking-widest uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unitMix.map((u: any, i: number) => {
                  const count = u.count || u.units || 0;
                  const pctTotal = totalUnitsFromMix > 0 ? ((count / totalUnitsFromMix) * 100).toFixed(1) : '—';
                  return (
                    <tr key={i} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2 font-semibold text-stone-800">{u.type || u.name || u.unit_type || `Type ${i + 1}`}</td>
                      <td className="px-4 py-2 text-stone-700">{count}</td>
                      <td className="px-4 py-2 text-stone-700">{u.avg_sf || u.avgSf || u.sqft ? `${Math.round(u.avg_sf || u.avgSf || u.sqft)} SF` : '—'}</td>
                      <td className="px-4 py-2 font-mono text-amber-600">{u.target_rent || u.targetRent || u.rent ? fmtDollar(u.target_rent || u.targetRent || u.rent) : '—'}</td>
                      <td className="px-4 py-2 text-stone-600">{pctTotal === '—' ? '—' : `${pctTotal}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* §5 — Competitive Set */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionHead title="Competitive Set" right="M06 Competition" accentColor="border-orange-500" />
        <div className="mt-3">
          <EmptyState
            message="View comparable properties and competitive analysis."
            linkLabel="Open Competition Module"
            onClick={() => onTabChange?.('competition')}
          />
        </div>
      </div>

      {/* §6 — Development Budget + Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionHead title="Development Budget + Timeline" right="M09 ProForma · M11 Capital" accentColor="border-amber-500" />
        <div className="grid grid-cols-2 gap-6 mt-3">
          <div>
            <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-3">COST STACK</div>
            {costStack.map((row, i) => (
              <div key={i} className={`flex justify-between items-center py-1.5 ${row.bold ? 'border-t border-stone-200 pt-2 mt-1' : 'border-b border-stone-100 last:border-0'}`}>
                <span className={`text-xs ${row.bold ? 'font-bold text-stone-900' : 'text-stone-600'}`}>{row.label}</span>
                <span className={`text-sm font-bold font-mono ${row.bold ? 'text-amber-600' : 'text-stone-800'}`}>
                  {row.value != null ? fmtDollar(row.value) : '—'}
                </span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-3">TIMELINE</div>
            <div className="space-y-3">
              {[
                { label: 'Construction', value: constructionMonths, color: 'border-blue-400', tc: 'text-blue-600' },
                { label: 'Lease-Up', value: leaseUpMonths, color: 'border-emerald-400', tc: 'text-emerald-600' },
                { label: 'Total Duration', value: totalMonths, color: 'border-amber-400', tc: 'text-amber-600' },
              ].map((t, i) => (
                <div key={i} className={`p-3 bg-stone-50 rounded-lg border-l-[3px] ${t.color}`}>
                  <div className={`text-[10px] font-bold tracking-wider mb-1 ${t.tc}`}>{t.label}</div>
                  <div className="text-xl font-bold text-stone-900 font-mono">
                    {t.value != null ? `${t.value} mo` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* §7 — Returns Comparison + Module Access */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionHead title="Returns Comparison" right="Development Returns" accentColor="border-emerald-500" />
        <div className="grid grid-cols-4 gap-px bg-stone-200 rounded-lg overflow-hidden mt-3">
          <KVCard label="Yield on Cost" value={yoc != null ? pct(yoc) : '—'} valueColor="text-amber-600" />
          <KVCard label="Levered IRR" value={irr != null ? pct(irr) : '—'} valueColor="text-emerald-600" />
          <KVCard label="Equity Multiple" value={em != null ? `${em.toFixed(2)}x` : '—'} valueColor="text-violet-600" />
          <KVCard label="Profit Margin" value={profitMargin != null ? pct(profitMargin) : '—'} valueColor="text-cyan-600" />
        </div>
        <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mt-5 mb-3">MODULE ACCESS</div>
        <div className="grid grid-cols-3 gap-3">
          {moduleLinks.map((m, i) => (
            <button
              key={i}
              onClick={() => onTabChange?.(m.tab)}
              className="bg-stone-50 rounded-lg p-4 text-left hover:bg-stone-100 transition-colors border border-stone-200"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{m.icon}</span>
                <span className="text-xs font-semibold text-stone-800">{m.label}</span>
              </div>
              <span className="text-[10px] text-blue-600 hover:text-blue-800">Open module &rarr;</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DevelopmentOverview;
