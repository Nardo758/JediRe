/**
 * DevelopmentOverview — Ground-Up Development Deal Capsule Overview
 * 
 * 7 Sections:
 *   §1 Site + Zoning Constraints
 *   §2 Building Configuration
 *   §3 Entitlement Pipeline
 *   §4 Unit Mix Program
 *   §5 Competitive Set
 *   §6 Development Budget + Timeline
 *   §7 Returns Comparison + Site Diligence
 * 
 * Data sources:
 *   deal record:     GET /api/v1/deals/:id
 *   JEDI Score:      GET /api/v1/jedi/score/:dealId
 *   Entitlements:    GET /api/v1/entitlements/deal/:dealId
 *   Capital Stack:   POST /api/v1/capital-structure/stack
 *   Timeline:        GET /api/v1/benchmark-timeline/benchmarks?county=&state=
 *   Zoning Envelope: zoningModuleStore (Zoning Agent output)
 *   Strategy:        dealAnalysisService (cached)
 */

import React, { useEffect, useState } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { apiClient } from '@/services/api.client';
import type { OverviewVariantProps } from './OverviewRouter';

// ── Section Components ───────────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-mono font-bold text-emerald-500 tracking-widest">§{number}</span>
        <span className="text-base font-bold text-slate-900">{title}</span>
      </div>
      {subtitle && <p className="text-xs text-slate-500 ml-7">{subtitle}</p>}
    </div>
  );
}

function MetricCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export const DevelopmentOverview: React.FC<OverviewVariantProps> = ({ deal, dealId, onTabChange }) => {
  const { capitalStructure } = useDealModule();
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any>(null);

  // Load entitlements
  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/entitlements/deal/${dealId}`)
      .then((res: any) => setEntitlements(res?.data?.data || res?.data || []))
      .catch(() => setEntitlements([]));
  }, [dealId]);

  // Load timeline benchmarks
  useEffect(() => {
    const county = deal?.county || '';
    const state = deal?.state || 'FL';
    if (!county) return;
    apiClient.get(`/api/v1/benchmark-timeline/benchmarks?county=${county}&state=${state}`)
      .then((res: any) => setBenchmarks(res?.data?.data || res?.data))
      .catch(() => setBenchmarks(null));
  }, [deal?.county, deal?.state]);

  // Helpers
  const fmt = (n: number | undefined, prefix = '$') => {
    if (n == null) return '—';
    if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `${prefix}${(n / 1e3).toFixed(0)}K`;
    return `${prefix}${n.toLocaleString()}`;
  };
  const pct = (n: number | undefined) => n != null ? `${(n * 100).toFixed(1)}%` : '—';

  // Derive fields from deal — handles both snake_case and camelCase
  const landPrice = deal?.land_price || deal?.landPrice || deal?.budget || 0;
  const totalDevCost = deal?.total_dev_cost || deal?.totalDevCost || 0;
  const hardCosts = deal?.hard_costs || deal?.hardCosts || 0;
  const softCosts = deal?.soft_costs || deal?.softCosts || 0;
  const units = deal?.units || deal?.target_units || deal?.targetUnits || 0;
  const sqft = deal?.sqft || deal?.total_sqft || 0;
  const zoning = deal?.zoning || deal?.zoning_designation || '—';
  const entitled = deal?.entitled ?? deal?.is_entitled ?? false;
  const maxDensity = deal?.max_density || deal?.maxDensity || 0;
  const maxFar = deal?.max_far || deal?.maxFar || 0;
  const maxHeight = deal?.max_height || deal?.maxHeight || 0;
  const yieldOnCost = deal?.yield_on_cost || deal?.yieldOnCost || 0;
  const devSpread = deal?.dev_spread || deal?.devSpread || 0;
  const constructionMonths = deal?.construction_months || deal?.constructionMonths || 0;
  const leaseUpMonths = deal?.lease_up_months || deal?.leaseUpMonths || 0;
  const exitValue = deal?.exit_value || deal?.exitValue || 0;
  const exitCapRate = deal?.exit_cap_rate || deal?.exitCapRate || 0;
  const irr = deal?.irr || 0;
  const equityMultiple = deal?.equity_multiple || deal?.equityMultiple || 0;
  const profitMargin = deal?.profit_margin || deal?.profitMargin || 0;
  const costPerUnit = units > 0 ? Math.round(totalDevCost / units) : 0;
  const costPerSf = sqft > 0 ? Math.round(totalDevCost / sqft) : 0;
  const lotAcres = deal?.acres || deal?.lot_size_acres || deal?.lotSizeAcres || 0;

  return (
    <div className="space-y-8">

      {/* §1 Site + Zoning Constraints */}
      <section>
        <SectionHeader number="1" title="Site + Zoning Constraints" subtitle="Parcel geometry, zoning envelope, and allowable development program" />
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="LOT SIZE" value={lotAcres > 0 ? `${lotAcres} acres` : '—'} sub={deal?.lot_size_sf ? `${deal.lot_size_sf.toLocaleString()} SF` : undefined} />
          <MetricCard label="ZONING" value={zoning} sub={deal?.zoning_desc || deal?.zoningDesc} />
          <MetricCard label="MAX DENSITY" value={maxDensity > 0 ? `${maxDensity} DU/ac` : '—'} sub={maxFar > 0 ? `FAR: ${maxFar}` : undefined} />
          <MetricCard label="MAX HEIGHT" value={maxHeight > 0 ? `${maxHeight} ft` : '—'} sub={deal?.max_lot_coverage ? `Lot coverage: ${pct(deal.max_lot_coverage)}` : undefined} />
        </div>
        {/* Entitlement status badge */}
        <div className="mt-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
            entitled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${entitled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {entitled ? 'ENTITLED' : 'ENTITLEMENT PENDING'}
          </span>
        </div>
      </section>

      {/* §2 Building Configuration */}
      <section>
        <SectionHeader number="2" title="Building Configuration" subtitle="Proposed program — units, SF, building type, parking" />
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="PROPOSED UNITS" value={units > 0 ? `${units}` : '—'} />
          <MetricCard label="TOTAL SF" value={sqft > 0 ? sqft.toLocaleString() : '—'} />
          <MetricCard label="BUILDING TYPE" value={deal?.building_type || deal?.buildingType || deal?.property_type || '—'} />
          <MetricCard label="PARKING" value={deal?.parking_spaces ? `${deal.parking_spaces} spaces` : '—'} sub={deal?.parking_ratio ? `${deal.parking_ratio}/unit` : undefined} />
        </div>
      </section>

      {/* §3 Entitlement Pipeline */}
      <section>
        <SectionHeader number="3" title="Entitlement Pipeline" subtitle="Permits, approvals, and timeline benchmarks" />
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {entitlements.length > 0 ? (
            <div className="space-y-3">
              {entitlements.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{e.name || e.permit_type || 'Permit'}</div>
                    <div className="text-xs text-slate-500">{e.description || e.status_detail || ''}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    e.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    e.status === 'submitted' ? 'bg-blue-50 text-blue-700' :
                    e.status === 'in-review' ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{e.status || 'pending'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-slate-500">No entitlement records found for this deal.</p>
              <button
                className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                onClick={() => onTabChange?.('zoning')}
              >
                Open Zoning Module →
              </button>
            </div>
          )}
          {benchmarks && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-2">COUNTY ENTITLEMENT BENCHMARKS</div>
              <div className="flex gap-4">
                {['p25', 'p50', 'p75', 'p90'].map((p) => (
                  <div key={p} className="text-center">
                    <div className="text-xs text-slate-400 uppercase">{p}</div>
                    <div className="text-sm font-bold text-slate-700">{benchmarks[p] || '—'} mo</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* §4 Unit Mix Program */}
      <section>
        <SectionHeader number="4" title="Unit Mix Program" subtitle="Proposed unit types, sizes, and target rents" />
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {deal?.unit_mix || deal?.unitMix ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    {['Type', 'Count', 'Avg SF', 'Target Rent', '% of Total'].map(h => (
                      <th key={h} className="text-left text-[10px] font-mono text-slate-400 tracking-wider py-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(deal.unit_mix || deal.unitMix || []).map((u: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 px-3 font-medium text-slate-900">{u.type}</td>
                      <td className="py-2 px-3 font-mono">{u.count}</td>
                      <td className="py-2 px-3 font-mono">{u.avgSf || u.avg_sf}</td>
                      <td className="py-2 px-3 font-mono">${(u.targetRent || u.target_rent || 0).toLocaleString()}/mo</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{units > 0 ? `${((u.count / units) * 100).toFixed(0)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Unit mix not yet configured. 
              <button className="text-emerald-600 hover:underline ml-1" onClick={() => onTabChange?.('unit-mix')}>Open Unit Mix Module →</button>
            </p>
          )}
        </div>
      </section>

      {/* §5 Competitive Set */}
      <section>
        <SectionHeader number="5" title="Competitive Set" subtitle="Comparable projects in the trade area" />
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500 text-center py-4">
            Competitive set populated from Market Intelligence.
            <button className="text-emerald-600 hover:underline ml-1" onClick={() => onTabChange?.('competition')}>Open Competition Module →</button>
          </p>
        </div>
      </section>

      {/* §6 Development Budget + Timeline */}
      <section>
        <SectionHeader number="6" title="Development Budget + Timeline" subtitle="Cost stack and construction schedule" />
        <div className="grid grid-cols-2 gap-4">
          {/* Budget */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">COST STACK</div>
            <div className="space-y-2">
              {[
                { label: 'Land Acquisition', value: landPrice },
                { label: 'Hard Costs', value: hardCosts },
                { label: 'Soft Costs', value: softCosts },
                { label: 'Contingency', value: deal?.contingency || 0 },
              ].filter(r => r.value > 0).map((r, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-sm text-slate-700">{r.label}</span>
                  <span className="text-sm font-mono font-medium text-slate-900">{fmt(r.value)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 border-t-2 border-slate-300">
                <span className="text-sm font-bold text-slate-900">Total Dev Cost</span>
                <span className="text-sm font-mono font-bold text-amber-600">{fmt(totalDevCost)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="text-[9px] font-mono text-slate-400">COST/UNIT</div>
                <div className="text-sm font-bold text-slate-800">{fmt(costPerUnit)}</div>
              </div>
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <div className="text-[9px] font-mono text-slate-400">COST/SF</div>
                <div className="text-sm font-bold text-slate-800">{fmt(costPerSf)}</div>
              </div>
            </div>
          </div>
          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">TIMELINE</div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricCard label="CONSTRUCTION" value={constructionMonths > 0 ? `${constructionMonths} mo` : '—'} />
              <MetricCard label="LEASE-UP" value={leaseUpMonths > 0 ? `${leaseUpMonths} mo` : '—'} />
              <MetricCard label="TOTAL" value={constructionMonths + leaseUpMonths > 0 ? `${constructionMonths + leaseUpMonths} mo` : '—'} />
            </div>
            {/* Capital stack from API */}
            {capitalStructure?.structureSummary && (
              <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="text-[10px] font-mono text-indigo-500 tracking-wider mb-1">CAPITAL STACK</div>
                <div className="text-sm font-semibold text-indigo-900">{capitalStructure.structureSummary}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* §7 Returns Comparison + Site Diligence */}
      <section>
        <SectionHeader number="7" title="Returns Comparison + Site Diligence" subtitle="Key development return metrics and module access" />
        <div className="grid grid-cols-4 gap-3 mb-4">
          <MetricCard label="YIELD ON COST" value={yieldOnCost > 0 ? pct(yieldOnCost) : '—'} sub={devSpread > 0 ? `+${devSpread}bps over market` : undefined} highlight />
          <MetricCard label="PROJ. IRR" value={irr > 0 ? `${irr}%` : '—'} highlight />
          <MetricCard label="EQUITY MULTIPLE" value={equityMultiple > 0 ? `${equityMultiple}x` : '—'} highlight />
          <MetricCard label="PROFIT MARGIN" value={profitMargin > 0 ? pct(profitMargin) : '—'} sub={exitValue > 0 ? `Exit: ${fmt(exitValue)} @ ${pct(exitCapRate)} cap` : undefined} highlight />
        </div>
        {/* Module access grid */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">MODULE ACCESS</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'proforma', label: 'Pro Forma', module: 'M09' },
              { id: 'capital-structure', label: 'Capital Structure', module: 'M11' },
              { id: 'risk', label: 'Risk Management', module: 'M14' },
              { id: 'due-diligence', label: 'Due Diligence', module: 'M20' },
              { id: 'zoning', label: 'Property & Zoning', module: 'M02' },
              { id: 'environmental', label: 'Environmental & ESG', module: 'M16' },
            ].map((m) => (
              <button
                key={m.id}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-left group"
                onClick={() => onTabChange?.(m.id)}
              >
                <div>
                  <div className="text-sm font-medium text-slate-800 group-hover:text-emerald-700">{m.label}</div>
                  <div className="text-[10px] font-mono text-slate-400">{m.module}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DevelopmentOverview;
