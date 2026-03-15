/**
 * RedevelopmentOverview — Redevelopment Deal Capsule Overview
 * 
 * 9 Sections:
 *   §1 Acquisition + As-Is Metrics
 *   §2 NOI Transformation (hero)
 *   §3 Site + Zoning Capacity
 *   §4 Renovation + Expansion Scope
 *   §5 Unit Mix Program
 *   §6 Development Budget + Timeline
 *   §7 Capital Structure
 *   §8 Value Bridge + Returns
 *   §9 Due Diligence + Module Access
 * 
 * The hybrid: existing operations + development scope.
 */

import React, { useEffect, useState } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { apiClient } from '@/services/api.client';
import type { OverviewVariantProps } from './OverviewRouter';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | undefined | null, prefix = '$') => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${prefix}${(n / 1e3).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString()}`;
};
const pct = (n: number | undefined | null) => n != null ? `${(n * 100).toFixed(1)}%` : '—';

// ── Sub-Components ───────────────────────────────────────────────────────────

function SH({ n, title, sub, color = 'text-violet-500' }: { n: string; title: string; sub?: string; color?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2">
        <span className={`text-[10px] font-mono font-bold ${color} tracking-widest`}>§{n}</span>
        <span className="text-base font-bold text-slate-900">{title}</span>
      </div>
      {sub && <p className="text-xs text-slate-500 ml-7">{sub}</p>}
    </div>
  );
}

function MC({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function DR({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100">
      <span className={`text-sm ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-bold text-amber-600' : 'font-medium text-slate-900'}`}>{value}</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { complete: 'bg-emerald-500', 'in-progress': 'bg-amber-500', 'not-started': 'bg-slate-300' };
  return <span className={`w-2 h-2 rounded-full inline-block ${colors[status] || 'bg-slate-300'}`} />;
}

// ── Main Component ───────────────────────────────────────────────────────────

export const RedevelopmentOverview: React.FC<OverviewVariantProps> = ({ deal, dealId, onTabChange }) => {
  const { capitalStructure } = useDealModule();

  // Field resolution — handles snake_case from DB and camelCase from store
  const f = (snake: string, camel: string, fallback?: any) => deal?.[snake] ?? deal?.[camel] ?? fallback;

  const askPrice = f('purchase_price', 'purchasePrice', f('ask_price', 'askPrice', 0));
  const existingUnits = f('existing_units', 'existingUnits', f('units', 'units', 0));
  const existingSqft = f('existing_sqft', 'existingSqft', f('sqft', 'sqft', 0));
  const existingNoi = f('existing_noi', 'existingNoi', 0);
  const existingOccupancy = f('existing_occupancy', 'existingOccupancy', f('occupancy', 'occupancy', 0));
  const existingCapRate = f('existing_cap_rate', 'existingCapRate', f('cap_rate', 'capRate', 0));
  const existingRentPerUnit = f('existing_rent_per_unit', 'existingRentPerUnit', 0);
  const yearBuilt = f('year_built', 'yearBuilt', null);

  const stabilizedNoi = f('stabilized_noi', 'stabilizedNoi', 0);
  const stabilizedRentPerUnit = f('stabilized_rent_per_unit', 'stabilizedRentPerUnit', 0);
  const stabilizedOccupancy = f('stabilized_occupancy', 'stabilizedOccupancy', 0.95);

  const renovationBudget = f('renovation_budget', 'renovationBudget', 0);
  const renovPerUnit = existingUnits > 0 ? Math.round(renovationBudget / existingUnits) : 0;
  const expansionUnits = f('expansion_units', 'expansionUnits', 0);
  const expansionCost = f('expansion_cost', 'expansionCost', 0);
  const expansionCostPerUnit = expansionUnits > 0 ? Math.round(expansionCost / expansionUnits) : 0;

  const totalUnits = existingUnits + expansionUnits;
  const totalInvestment = f('total_investment', 'totalInvestment', askPrice + renovationBudget + expansionCost);
  const exitValue = f('exit_value', 'exitValue', 0);
  const irr = f('irr', 'irr', 0);
  const equityMultiple = f('equity_multiple', 'equityMultiple', 0);
  const equityRequired = f('equity_required', 'equityRequired', 0);
  const seniorDebt = f('senior_debt', 'seniorDebt', 0);
  const cashOnCash = f('cash_on_cash', 'cashOnCash', 0);
  const zoningAllows = f('zoning_allows', 'zoningAllows', 0);
  const zoning = f('zoning', 'zoning', '—');
  const lotAcres = f('acres', 'lotSizeAcres', 0);
  const renovationMonths = f('renovation_months', 'renovationMonths', 0);
  const leaseUpMonths = f('lease_up_months', 'leaseUpMonths', 0);

  const noiDelta = stabilizedNoi - existingNoi;
  const rentDelta = stabilizedRentPerUnit - existingRentPerUnit;
  const renovROI = (renovationBudget + expansionCost) > 0 ? noiDelta / (renovationBudget + expansionCost) : 0;
  const valueCreation = exitValue - totalInvestment;

  const pricePerUnit = existingUnits > 0 ? Math.round(askPrice / existingUnits) : 0;
  const pricePerSf = existingSqft > 0 ? Math.round(askPrice / existingSqft) : 0;

  return (
    <div className="space-y-8">

      {/* §1 Acquisition + As-Is Metrics */}
      <section>
        <SH n="1" title="Acquisition + As-Is Metrics" sub="Current operations baseline — what you're buying today" />
        <div className="grid grid-cols-4 gap-3">
          <MC label="GOING-IN CAP RATE" value={existingCapRate > 0 ? pct(existingCapRate) : '—'} sub="Trailing 12mo NOI" />
          <MC label="CURRENT NOI" value={fmt(existingNoi)} sub={`${fmt(pricePerUnit)}/unit · ${fmt(pricePerSf)}/SF`} />
          <MC label="OCCUPANCY" value={existingOccupancy > 0 ? pct(existingOccupancy) : '—'} sub={existingOccupancy < 0.9 ? 'Below stabilized — upside potential' : 'Near stabilized'} />
          <MC label="AVG RENT / UNIT" value={existingRentPerUnit > 0 ? `${fmt(existingRentPerUnit)}/mo` : '—'} sub={yearBuilt ? `Built ${yearBuilt} · ${existingUnits} units` : undefined} />
        </div>
      </section>

      {/* §2 NOI Transformation (Hero) */}
      <section>
        <SH n="2" title="NOI Transformation" sub="The value story — as-is to stabilized" color="text-emerald-500" />
        <div className="bg-gradient-to-br from-white to-emerald-50 rounded-xl border border-emerald-200 p-6">
          <div className="grid grid-cols-5 items-center gap-0">
            {/* As-Is */}
            <div className="text-center p-4">
              <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-2">AS-IS NOI</div>
              <div className="text-3xl font-bold text-slate-900">{fmt(existingNoi)}</div>
              <div className="text-xs text-slate-500 mt-2">{existingUnits} units · {pct(existingOccupancy)} occ</div>
            </div>
            <div className="text-center text-2xl text-slate-300 font-light">→</div>
            {/* Stabilized */}
            <div className="text-center p-4 bg-emerald-100 rounded-xl">
              <div className="text-[10px] font-mono text-emerald-600 tracking-wider mb-2">STABILIZED NOI</div>
              <div className="text-3xl font-bold text-emerald-700">{fmt(stabilizedNoi)}</div>
              <div className="text-xs text-emerald-600 mt-2">{totalUnits} units · {pct(stabilizedOccupancy)} occ</div>
            </div>
            <div className="text-center text-2xl text-slate-300 font-light">=</div>
            {/* Delta */}
            <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="text-[10px] font-mono text-amber-600 tracking-wider mb-2">NOI UPLIFT</div>
              <div className="text-3xl font-bold text-amber-600">+{fmt(noiDelta)}</div>
              <div className="text-xs text-amber-600 mt-2">+{existingNoi > 0 ? pct(noiDelta / existingNoi) : '—'} · +{fmt(rentDelta)}/unit</div>
            </div>
          </div>
        </div>
      </section>

      {/* §3 Site + Zoning Capacity */}
      <section>
        <SH n="3" title="Site + Zoning Capacity" sub="What exists vs what's allowed — expansion feasibility" />
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">DENSITY ANALYSIS</div>
            {/* Visual bar */}
            <div className="h-6 bg-slate-100 rounded-full overflow-hidden mb-2 flex">
              <div className="bg-blue-500 h-full" style={{ width: zoningAllows > 0 ? `${Math.min((existingUnits / (existingUnits + 112)) * 100, 100)}%` : '60%' }}
                title={`Existing: ${existingUnits}`} />
              {expansionUnits > 0 && (
                <div className="bg-violet-400 h-full" style={{ width: `${(expansionUnits / (existingUnits + 112)) * 100}%` }}
                  title={`Expansion: +${expansionUnits}`} />
              )}
            </div>
            <div className="flex gap-3 text-[10px] font-mono text-slate-500 mb-4">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> Existing ({existingUnits})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-violet-400" /> Expansion (+{expansionUnits})</span>
            </div>
            <DR label="Current Zoning" value={zoning} />
            <DR label="Lot Size" value={lotAcres > 0 ? `${lotAcres} acres` : '—'} />
            <DR label="Existing Units" value={`${existingUnits}`} />
            <DR label="Expansion Units" value={`+${expansionUnits}`} />
            <DR label="Post-Expansion Total" value={`${totalUnits} units`} bold />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">ZONING ENVELOPE</div>
            <DR label="Max Density" value={f('max_density', 'maxDensity') ? `${f('max_density', 'maxDensity')} DU/ac` : '—'} />
            <DR label="Max Height" value={f('max_height', 'maxHeight') ? `${f('max_height', 'maxHeight')} ft` : '—'} />
            <DR label="Max Lot Coverage" value={f('max_lot_coverage', 'maxLotCoverage') ? pct(f('max_lot_coverage', 'maxLotCoverage')) : '—'} />
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                {f('expansion_requires_variance', 'expansionRequiresVariance')
                  ? `⚠ Variance required — existing ${existingUnits} units may be legally nonconforming. Expansion requires approval.`
                  : `Expansion of +${expansionUnits} units permitted by-right under current zoning.`
                }
              </p>
            </div>
            <button className="mt-3 text-xs text-violet-600 hover:text-violet-700 font-medium" onClick={() => onTabChange?.('zoning')}>
              Open Zoning Module →
            </button>
          </div>
        </div>
      </section>

      {/* §4 Renovation + Expansion Scope */}
      <section>
        <SH n="4" title="Renovation + Expansion Scope" sub="Dual-track: interior upgrades + new construction" />
        <div className="grid grid-cols-2 gap-4">
          {/* Renovation */}
          <div className="bg-white rounded-xl border-l-4 border-l-blue-500 border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-[10px] font-mono text-blue-600 tracking-wider">RENOVATION</div>
                <div className="text-xs text-slate-500 mt-1">{existingUnits} units to renovate</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">{fmt(renovationBudget)}</div>
                <div className="text-xs font-mono text-slate-500">{fmt(renovPerUnit)}/unit</div>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-xs text-blue-700">Target rent uplift</span>
                <span className="text-xs font-bold text-blue-700 font-mono">+{fmt(rentDelta)}/mo (+{existingRentPerUnit > 0 ? pct(rentDelta / existingRentPerUnit) : '—'})</span>
              </div>
            </div>
          </div>
          {/* Expansion */}
          <div className="bg-white rounded-xl border-l-4 border-l-violet-500 border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-[10px] font-mono text-violet-600 tracking-wider">EXPANSION</div>
                <div className="text-xs text-slate-500 mt-1">+{expansionUnits} new units</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">{fmt(expansionCost)}</div>
                <div className="text-xs font-mono text-slate-500">{fmt(expansionCostPerUnit)}/unit</div>
              </div>
            </div>
            <div className="p-3 bg-violet-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-xs text-violet-700">Post-expansion total</span>
                <span className="text-xs font-bold text-violet-700 font-mono">{totalUnits} units</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* §5 Unit Mix Program */}
      <section>
        <SH n="5" title="Unit Mix Program" sub="Existing mix + expansion → blended stabilized portfolio" />
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {(deal?.existing_mix || deal?.existingMix) ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    {['Type', 'Count', 'Avg SF', 'Current Rent', 'Target Rent', 'Δ Rent'].map(h => (
                      <th key={h} className="text-left text-[10px] font-mono text-slate-400 tracking-wider py-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(deal.existing_mix || deal.existingMix || []).map((u: any, i: number) => {
                    const delta = (u.targetRent || u.target_rent || 0) - (u.currentRent || u.current_rent || 0);
                    return (
                      <tr key={`e${i}`} className="border-b border-slate-100">
                        <td className="py-2 px-3 font-medium text-slate-900">{u.type}</td>
                        <td className="py-2 px-3 font-mono">{u.count}</td>
                        <td className="py-2 px-3 font-mono">{u.avgSf || u.avg_sf}</td>
                        <td className="py-2 px-3 font-mono">{fmt(u.currentRent || u.current_rent)}</td>
                        <td className="py-2 px-3 font-mono text-emerald-600">{fmt(u.targetRent || u.target_rent)}</td>
                        <td className="py-2 px-3 font-mono text-emerald-600">+{fmt(delta)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Unit mix not yet configured.
              <button className="text-violet-600 hover:underline ml-1" onClick={() => onTabChange?.('unit-mix')}>Open Unit Mix →</button>
            </p>
          )}
        </div>
      </section>

      {/* §6 Development Budget + Timeline */}
      <section>
        <SH n="6" title="Development Budget + Timeline" sub="Renovation + expansion cost and phased schedule" />
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">TOTAL INVESTMENT</div>
            <DR label="Acquisition" value={fmt(askPrice)} />
            <DR label="Renovation" value={fmt(renovationBudget)} />
            <DR label="Expansion" value={fmt(expansionCost)} />
            <DR label="Other (soft + closing)" value={fmt(totalInvestment - askPrice - renovationBudget - expansionCost)} />
            <DR label="Total Investment" value={fmt(totalInvestment)} bold />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">TIMELINE</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <MC label="RENOVATION" value={renovationMonths > 0 ? `${renovationMonths} mo` : '—'} />
              <MC label="LEASE-UP" value={leaseUpMonths > 0 ? `${leaseUpMonths} mo` : '—'} />
              <MC label="TOTAL" value={renovationMonths + leaseUpMonths > 0 ? `${renovationMonths + leaseUpMonths + 2} mo` : '—'} />
            </div>
          </div>
        </div>
      </section>

      {/* §7 Capital Structure */}
      <section>
        <SH n="7" title="Capital Structure" sub="Bridge-to-perm with renovation and expansion draws" />
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">SOURCES</div>
            <DR label="Senior Debt" value={seniorDebt > 0 ? fmt(seniorDebt) : '—'} />
            <DR label="Sponsor Equity" value={equityRequired > 0 ? fmt(equityRequired) : '—'} />
            <DR label="Total Capitalization" value={fmt(seniorDebt + equityRequired)} bold />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            {capitalStructure?.structureSummary ? (
              <>
                <div className="text-[10px] font-mono text-slate-400 tracking-wider mb-3">PLATFORM CAPITAL STRUCTURE</div>
                <div className="text-sm font-semibold text-indigo-900">{capitalStructure.structureSummary}</div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">Capital structure not yet modeled.</p>
                <button className="mt-2 text-xs text-violet-600 font-medium" onClick={() => onTabChange?.('capital-structure')}>
                  Open Capital Structure →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* §8 Value Bridge + Returns */}
      <section>
        <SH n="8" title="Value Bridge + Returns" sub="Total basis → stabilized value → value creation" color="text-emerald-500" />
        {/* Value creation banner */}
        {valueCreation > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-4 flex justify-between items-center">
            <span className="text-sm font-semibold text-emerald-700">Value Creation</span>
            <span className="text-2xl font-bold text-emerald-700 font-mono">+{fmt(valueCreation)}</span>
          </div>
        )}
        <div className="grid grid-cols-4 gap-3">
          <MC label="PROJ. IRR" value={irr > 0 ? `${irr}%` : '—'} sub="Levered, blended reno + expansion" highlight />
          <MC label="EQUITY MULTIPLE" value={equityMultiple > 0 ? `${equityMultiple}x` : '—'} sub={equityRequired > 0 ? `On ${fmt(equityRequired)} equity` : undefined} highlight />
          <MC label="RENOVATION ROI" value={renovROI > 0 ? pct(renovROI) : '—'} sub={`${fmt(noiDelta)} uplift / ${fmt(renovationBudget + expansionCost)} spent`} highlight />
          <MC label="CASH-ON-CASH" value={cashOnCash > 0 ? `${cashOnCash}%` : '—'} sub="Year 1 levered yield" />
        </div>
      </section>

      {/* §9 Due Diligence + Module Access */}
      <section>
        <SH n="9" title="Due Diligence + Module Access" sub="Navigate into any module — status tracked across lifecycle" />
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'zoning', label: 'Property & Zoning', module: 'M02' },
              { id: 'market-intelligence', label: 'Market Intelligence', module: 'M05' },
              { id: 'traffic-intelligence', label: 'Traffic Intelligence', module: 'M07' },
              { id: 'proforma', label: 'Pro Forma', module: 'M09' },
              { id: 'capital-structure', label: 'Capital Structure', module: 'M11' },
              { id: 'risk', label: 'Risk Management', module: 'M14' },
              { id: 'competition', label: 'Competition', module: 'M15' },
              { id: 'environmental', label: 'Environmental & ESG', module: 'M16' },
              { id: 'due-diligence', label: 'Due Diligence Checklist', module: 'M20' },
            ].map((m) => (
              <button
                key={m.id}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors text-left group"
                onClick={() => onTabChange?.(m.id)}
              >
                <div>
                  <div className="text-sm font-medium text-slate-800 group-hover:text-violet-700">{m.label}</div>
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

export default RedevelopmentOverview;
