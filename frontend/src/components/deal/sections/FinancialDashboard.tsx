import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/services/api.client';

interface DealProps {
  deal?: any;
  dealId?: string;
}

interface ModuleDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  fields: string[];
}

const MODULES_DEF: ModuleDef[] = [
  { id: 'strategy', label: 'Strategy', icon: '\u2295', description: 'Strategy Arbitrage Engine (M08)', fields: ['BTS / Flip / Rental / STR scores', 'Arbitrage flag when delta >15pts', 'Recommended strategy'] },
  { id: 'traffic', label: 'Traffic', icon: '\u2197', description: 'Traffic Fusion Engine v2 (M07)', fields: ['Leasing traffic predictions', 'Digital traffic via SpyFu', 'Weekly walk-in forecast'] },
  { id: 'proforma', label: 'Pro Forma', icon: '$', description: 'Pro Forma Engine (M09)', fields: ['NOI projection multi-year', 'Rent roll with occupancy', 'Expense assumptions'] },
  { id: 'debt', label: 'Debt', icon: '\u25CB', description: 'Capital Structure Engine (M11)', fields: ['Loan options compared', 'DSCR & IO analysis', 'Defeasance modeling'] },
];

const METRICS = [
  { key: 'irr', label: 'IRR', fmt: (v: number) => `${v}%` },
  { key: 'equityMultiple', label: 'Equity Multiple', fmt: (v: number) => `${v}x` },
  { key: 'cashOnCash', label: 'Cash-on-Cash', fmt: (v: number) => `${v}%` },
  { key: 'noi', label: 'Year 1 NOI', fmt: (v: number) => fmt$(v) },
  { key: 'dscr', label: 'DSCR', fmt: (v: number) => `${v}x` },
  { key: 'yoc', label: 'Yield on Cost', fmt: (v: number) => `${v}%` },
  { key: 'exitValue', label: 'Exit Value', fmt: (v: number) => fmt$(v) },
];

const fmt$ = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const TABS = [
  { k: 'comparison', l: 'Model Comparison', i: '\u229E' },
  { k: 'assumptions', l: 'Assumptions', i: '\u2261' },
  { k: 'debt', l: 'Debt Comparison', i: '\u2299' },
  { k: 'projections', l: 'Projections', i: '\u25A4' },
  { k: 'sensitivity', l: 'Sensitivity Analysis', i: '\u223F' },
  { k: 'waterfall', l: 'Waterfall', i: '\u25E9' },
  { k: 'decision', l: 'Decision Summary', i: '\u2713' },
];

const QP = ['Which loan wins?', 'Stress: 6% exit cap', 'Break-even occupancy?', 'Build best case', 'IRR vs rent growth?', 'Raise CapEx $7K/unit'];

function buildSysPrompt(model: any, ms: Record<string, string>) {
  const conn = MODULES_DEF.filter(m => ms[m.id] && ms[m.id] !== 'none').map(m => `${m.label}(${ms[m.id]})`).join(', ') || 'none';
  const acq = model?.acquisition || {};
  const rev = model?.revenue || {};
  const debt = model?.debt || {};
  const loan = debt?.loans?.[debt?.selectedLoan] || {};
  const scenarios = model?.scenarios || {};
  const base = scenarios?.base || {};

  return `You are JEDI — elite real estate financial modeling AI embedded in JEDI RE. You can modify the live deal model.
DEAL: ${model?.propertyName || 'Unknown'} | ${model?.meta || ''}
CONNECTED MODULES: ${conn}
MODEL: Purchase ${fmt$(acq.purchasePrice || 0)} | ${acq.units || 0} units | Occ ${fmtPct(rev.currentOccupancy || 0)}\u2192${fmtPct(rev.stabilizedOccupancy || 0)} | ${loan.name || 'N/A'} @ ${fmtPct(loan.rate || 0)} IO:${loan.ioYears || 0}yr | IRR Base:${base.irr || 0}% Best:${scenarios.best?.irr || 0}% Worst:${scenarios.worst?.irr || 0}%
To modify: respond with \`\`\`model_update\n{"description":"...","changes":{"acquisition.purchasePrice":56000000},"explanation":"..."}\`\`\`
Speak like a senior institutional analyst — direct, data-driven, precise.`;
}

function applyUpdate(model: any, changes: Record<string, any>) {
  const u = JSON.parse(JSON.stringify(model));
  for (const [p, v] of Object.entries(changes)) {
    const k = p.split('.');
    let o = u;
    for (let i = 0; i < k.length - 1; i++) o = o[k[i]];
    o[k[k.length - 1]] = v;
  }
  return u;
}

function parseResp(text: string) {
  const m = text.match(/```model_update\n([\s\S]*?)```/);
  if (!m) return { text, update: null };
  try {
    const u = JSON.parse(m[1]);
    return { text: text.replace(/```model_update[\s\S]*?```/, '').trim(), update: u };
  } catch { return { text, update: null }; }
}

function computeModel(m: any) {
  if (!m?.debt?.loans || !m?.debt?.selectedLoan) return null;
  const loan = m.debt.loans[m.debt.selectedLoan];
  if (!loan) return null;
  const capex = m.capex || {};
  const totalInteriorCapex = ((capex.unitsY1 || 0) + (capex.unitsY2 || 0) + (capex.unitsY3 || 0) + (capex.unitsY4 || 0) + (capex.unitsY5 || 0)) * (capex.interiorPerUnit || 0);
  const totalDay1Capex = (capex.exteriorCapex || 0) + (capex.deferredMaintenance || 0);
  const closingCosts = (m.acquisition?.purchasePrice || 0) * (m.acquisition?.closingCostsPct || 0.02);
  const totalCost = (m.acquisition?.purchasePrice || 0) + closingCosts + totalInteriorCapex + totalDay1Capex;
  const equity = totalCost - (loan.proceeds || 0);
  const annualDebtService = (loan.proceeds || 0) * (loan.rate || 0);
  const rev = m.revenue || {};
  const stabilizedNOI = (rev.currentMonthlyRent || 0) * 12 * (1 + (rev.rentGrowthY1 || 0)) * (rev.stabilizedOccupancy || 0.95);
  const dscr = annualDebtService > 0 ? stabilizedNOI / annualDebtService : 0;
  const exitValue = (m.exit?.exitCapRate || 0.055) > 0 ? stabilizedNOI / (m.exit?.exitCapRate || 0.055) : 0;
  const netProceeds = exitValue * (1 - (m.exit?.saleCostPct || 0.015)) - (loan.proceeds || 0);
  return { loan, totalInteriorCapex, totalDay1Capex, closingCosts, totalCost, equity, annualDebtService, stabilizedNOI, dscr, exitValue, netProceeds };
}

function buildModelFromSummary(summary: any): any {
  const deal = summary?.deal || {};
  const strategy = summary?.strategy || {};
  const latestModel = summary?.model || summary?.latestModel || {};
  const marketContext = summary?.marketContext || {};
  const capitalStructure = summary?.capitalOptions || summary?.capitalStructure || {};

  const budget = deal.budget || deal.deal_data?.budget || 15000000;
  const units = deal.target_units || deal.deal_data?.target_units || 200;
  const city = deal.city || '';
  const state = deal.state || '';

  const assumptions = latestModel?.assumptions || {};
  const results = latestModel?.results || {};

  const avgRent = marketContext?.avg_rent || assumptions?.revenue?.rentGrowth?.[0] ? undefined : 1800;
  const monthlyRent = (assumptions?.dealInfo?.totalUnits || units) * (avgRent || assumptions?.unitMix?.[0]?.marketRent || 1970);

  const holdYears = strategy?.hold_period || assumptions?.holdPeriod || 7;
  const exitCap = strategy?.exit_cap || assumptions?.disposition?.exitCapRate || 0.055;

  const loans: Record<string, any> = {};
  const capOptions = Array.isArray(capitalStructure) ? capitalStructure : capitalStructure?.options || [];
  if (capOptions.length > 0) {
    capOptions.forEach((opt: any, idx: number) => {
      const key = opt.id || `loan${idx}`;
      loans[key] = {
        name: opt.name || opt.loan_type || opt.label || `Option ${idx + 1}`,
        ltv: opt.ltv || 0.65,
        rate: opt.rate || opt.interest_rate || opt.interestRate || 0.055,
        ioYears: opt.io_period_months ? opt.io_period_months / 12 : opt.ioPeriod || opt.ioYears || 2,
        amortYears: opt.amortization_years || opt.amortization || opt.amortYears || 30,
        proceeds: opt.proceeds || opt.loan_amount || opt.loanAmount || budget * (opt.ltv || 0.65),
      };
    });
  }
  if (Object.keys(loans).length === 0) {
    loans.senior = { name: 'Senior Debt', ltv: 0.65, rate: 0.055, ioYears: 2, amortYears: 30, proceeds: budget * 0.65 };
  }

  const scenarios: any = { base: {}, best: {}, worst: {} };
  if (results?.summary) {
    const s = results.summary;
    scenarios.base = {
      irr: s.irr || 0,
      equityMultiple: s.equityMultiple || 0,
      cashOnCash: Array.isArray(s.cashOnCash) ? s.cashOnCash[0] || 0 : s.cashOnCash || 0,
      noi: s.noiYear1 || 0,
      dscr: Array.isArray(s.dscr) ? s.dscr[0] || 0 : s.dscr || 0,
      yoc: s.yieldOnCost || 0,
      exitValue: s.exitValue || 0,
    };
    scenarios.best = {
      irr: (s.irr || 0) * 1.15,
      equityMultiple: (s.equityMultiple || 0) * 1.2,
      cashOnCash: ((Array.isArray(s.cashOnCash) ? s.cashOnCash[0] : s.cashOnCash) || 0) * 1.1,
      noi: (s.noiYear1 || 0) * 1.07,
      dscr: ((Array.isArray(s.dscr) ? s.dscr[0] : s.dscr) || 0) * 1.07,
      yoc: (s.yieldOnCost || 0) * 1.08,
      exitValue: (s.exitValue || 0) * 1.25,
    };
    scenarios.worst = {
      irr: (s.irr || 0) * 0.75,
      equityMultiple: (s.equityMultiple || 0) * 0.7,
      cashOnCash: ((Array.isArray(s.cashOnCash) ? s.cashOnCash[0] : s.cashOnCash) || 0) * 0.82,
      noi: (s.noiYear1 || 0) * 0.9,
      dscr: ((Array.isArray(s.dscr) ? s.dscr[0] : s.dscr) || 0) * 0.83,
      yoc: (s.yieldOnCost || 0) * 0.9,
      exitValue: (s.exitValue || 0) * 0.7,
    };
  }

  return {
    propertyName: deal.name || deal.deal_name || assumptions?.dealInfo?.dealName || 'Untitled Deal',
    meta: `${units} Units | ${city}${state ? ', ' + state : ''} | ${deal.project_type || 'Multifamily'}`,
    acquisition: {
      units,
      sqft: units * 1024,
      purchasePrice: budget,
      closingCostsPct: 0.02,
      acquisitionDate: deal.timeline_start ? new Date(deal.timeline_start).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'TBD',
    },
    capex: {
      interiorPerUnit: strategy?.capex_per_unit || 5000,
      unitsY1: Math.ceil(units * 0.25),
      unitsY2: Math.ceil(units * 0.2),
      unitsY3: Math.ceil(units * 0.15),
      unitsY4: Math.ceil(units * 0.1),
      unitsY5: Math.ceil(units * 0.05),
      renovationPremium: 85,
      exteriorCapex: Math.round(budget * 0.003),
      deferredMaintenance: Math.round(budget * 0.001),
      ongoingReservePerUnit: 200,
    },
    revenue: {
      currentMonthlyRent: monthlyRent,
      currentAvgRentOccupied: avgRent || 1970,
      currentAvgMarketRent: marketContext?.avg_rent || (avgRent ? avgRent * 1.05 : 2076),
      currentOccupancy: marketContext?.occupancy_rate || 0.93,
      stabilizedOccupancy: 0.95,
      rentGrowthY1: marketContext?.rent_growth || 0.04,
      rentGrowthY2: (marketContext?.rent_growth || 0.04) * 0.875,
      rentGrowthY3: 0.03,
      rentGrowthY4: 0.025,
      rentGrowthY5: 0.025,
    },
    debt: {
      selectedLoan: Object.keys(loans)[0],
      loans,
    },
    exit: { holdYears, exitCapRate: exitCap, saleCostPct: 0.015 },
    scenarios,
    _engineResults: results,
    _engineAssumptions: assumptions,
    _annualCashFlow: results?.annualCashFlow || [],
    _sensitivityAnalysis: results?.sensitivityAnalysis || {},
    _waterfallDistributions: results?.waterfallDistributions || [],
    _sourcesAndUses: results?.sourcesAndUses || {},
    _debtMetrics: results?.debtMetrics || {},
  };
}

function CompView({ model }: { model: any }) {
  const s = model.scenarios || {};
  const hasData = s.base?.irr > 0;
  if (!hasData) {
    return (
      <div className="cmp">
        <div className="cmp-hdr"><div><h3>Side-by-Side Model Comparison</h3><p>No model computed yet. Build a model from the Pro Forma tab first.</p></div></div>
      </div>
    );
  }
  return (
    <div className="cmp">
      <div className="cmp-hdr">
        <div><h3>Side-by-Side Model Comparison</h3><p>3 scenarios generated from upstream data</p></div>
        <span className="bgr">Auto-calculated</span>
      </div>
      <table className="cmp-tbl">
        <thead>
          <tr>
            <th className="th-lbl">METRIC</th>
            <th className="th-base"><div className="cn">Base Case</div><div className="cs">Pro Forma + Strategy + Traffic</div></th>
            <th className="th-best"><div className="cn">Best Case</div><div className="cs">Optimistic traffic + tight market</div></th>
            <th className="th-worst"><div className="cn">Worst Case</div><div className="cs">Weak traffic + rate pressure</div></th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map(m => {
            const bv = s.base?.[m.key] || 0;
            const bev = s.best?.[m.key] || 0;
            const wv = s.worst?.[m.key] || 0;
            const bd = bv !== 0 ? (((bev - bv) / bv) * 100).toFixed(1) : '0.0';
            const wd = bv !== 0 ? (((wv - bv) / bv) * 100).toFixed(1) : '0.0';
            return (
              <tr key={m.key}>
                <td className="cm cm-lbl">{m.label}</td>
                <td className="cm cb"><div className="cv">{m.fmt(bv)}</div></td>
                <td className="cm cbe"><div className="cv">{m.fmt(bev)}</div><div className="cd p">+{bd}%</div></td>
                <td className="cm cwo"><div className="cv">{m.fmt(wv)}</div><div className="cd n">{wd}%</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ai-call">
        <h4>&#x26A1; AI Model Intelligence</h4>
        <ul>
          {model._aiInsights ? model._aiInsights.map((ins: string, i: number) => (
            <li key={i}><span>&rarr;</span><span dangerouslySetInnerHTML={{ __html: ins }} /></li>
          )) : (
            <>
              <li><span>&rarr;</span><span><strong>IRR spread of {Math.abs((s.best?.irr || 0) - (s.worst?.irr || 0)).toFixed(1)}%</strong> between Best/Worst &mdash; deal is exit cap-sensitive.</span></li>
              <li><span>&rarr;</span><span><strong>Base DSCR at {(s.base?.dscr || 0).toFixed(2)}x</strong> provides {(s.base?.dscr || 0) >= 1.25 ? 'comfortable' : 'tight'} debt coverage.</span></li>
              <li><span>&rarr;</span><span><strong>Yield on Cost at {(s.base?.yoc || 0).toFixed(1)}%</strong> &mdash; {(s.base?.yoc || 0) > 6 ? 'strong value creation margin' : 'limited spread over going-in cap'}.</span></li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

function AssView({ model }: { model: any }) {
  const c = computeModel(model);
  if (!c) {
    return <div className="ass"><div className="slbl">No model data available</div></div>;
  }
  return (
    <div className="ass">
      <div className="slbl">ACQUISITION ASSUMPTIONS</div>
      <table className="dtbl">
        <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Value</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>Number of Units</td><td className="tv">{model.acquisition?.units || 0}</td><td className="tsc">Deal Library</td></tr>
          <tr><td>Total Square Feet</td><td className="tv">{(model.acquisition?.sqft || 0).toLocaleString()}</td><td className="tsc">Calculated</td></tr>
          <tr><td>Purchase Price</td><td className="thl">{fmt$(model.acquisition?.purchasePrice || 0)}</td><td className="tsc">Deal Library</td></tr>
          <tr><td>Price Per Unit</td><td className="tv">${model.acquisition?.units ? Math.round((model.acquisition?.purchasePrice || 0) / model.acquisition.units).toLocaleString() : 0}</td><td className="tsc"></td></tr>
          <tr><td>Closing Costs</td><td className="tv">{fmtPct(model.acquisition?.closingCostsPct || 0.02)} &mdash; {fmt$(c.closingCosts)}</td><td className="tsc"></td></tr>
        </tbody>
      </table>
      <div className="slbl">CAPITAL IMPROVEMENTS</div>
      <table className="dtbl">
        <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
        <tbody>
          <tr><td>Interior Reno $/Unit</td><td className="tv">${(model.capex?.interiorPerUnit || 0).toLocaleString()}</td></tr>
          <tr><td>Units Y1/Y2/Y3/Y4/Y5</td><td className="tv">{model.capex?.unitsY1 || 0}/{model.capex?.unitsY2 || 0}/{model.capex?.unitsY3 || 0}/{model.capex?.unitsY4 || 0}/{model.capex?.unitsY5 || 0}</td></tr>
          <tr><td>Total Interior CapEx</td><td className="thl">{fmt$(c.totalInteriorCapex)}</td></tr>
          <tr><td>Renovation Rent Premium</td><td className="tv">${model.capex?.renovationPremium || 0}/mo</td></tr>
          <tr><td>Total Day-1 CapEx Budget</td><td className="thl">{fmt$(c.totalDay1Capex)}</td></tr>
        </tbody>
      </table>
      <div className="slbl">REVENUE ASSUMPTIONS</div>
      <table className="dtbl">
        <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Value</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>Monthly Rent In-Place</td><td className="tv">{fmt$(model.revenue?.currentMonthlyRent || 0)}</td><td className="tsc">Rent Roll</td></tr>
          <tr><td>Current Avg Rent (Occupied)</td><td className="tv">${(model.revenue?.currentAvgRentOccupied || 0).toLocaleString()}</td><td className="tsc"></td></tr>
          <tr><td>Current Avg Market Rent</td><td className="tv">${(model.revenue?.currentAvgMarketRent || 0).toLocaleString()}</td><td className="tsc">Market Agent</td></tr>
          <tr><td>Current Occupancy</td><td className="tv">{fmtPct(model.revenue?.currentOccupancy || 0)}</td><td className="tsc">Traffic Module</td></tr>
          <tr><td>Stabilized Target</td><td className="tgr">{fmtPct(model.revenue?.stabilizedOccupancy || 0.95)}</td><td className="tsc"></td></tr>
          <tr><td>Rent Growth Y1/Y2/Y3</td><td className="tv">{fmtPct(model.revenue?.rentGrowthY1 || 0)}/{fmtPct(model.revenue?.rentGrowthY2 || 0)}/{fmtPct(model.revenue?.rentGrowthY3 || 0)}</td><td className="tsc">Market Agent</td></tr>
        </tbody>
      </table>
      <div className="slbl">DERIVED OUTPUTS</div>
      <table className="dtbl">
        <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
        <tbody>
          <tr><td>Total Acquisition Cost</td><td className="thl">{fmt$(c.totalCost)}</td></tr>
          <tr><td>Loan Proceeds ({c.loan.name})</td><td className="tv">{fmt$(c.loan.proceeds)}</td></tr>
          <tr><td>Required Equity</td><td className="tgr">{fmt$(c.equity)}</td></tr>
          <tr><td>Stabilized NOI (Y2)</td><td className="tgr">{fmt$(c.stabilizedNOI)}</td></tr>
          <tr><td>DSCR (Stabilized)</td><td className="tgr">{c.dscr.toFixed(2)}x</td></tr>
          <tr><td>Exit Value ({model.exit?.holdYears || 7}yr @ {fmtPct(model.exit?.exitCapRate || 0.055)})</td><td className="thl">{fmt$(c.exitValue)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function DebtView({ model, setModel }: { model: any; setModel: React.Dispatch<React.SetStateAction<any>> }) {
  const loans = model?.debt?.loans || {};
  if (Object.keys(loans).length === 0) {
    return <div className="dbt"><div className="slbl">No debt options available</div></div>;
  }
  return (
    <div className="dbt">
      <div className="slbl">LOAN OPTIONS &mdash; CLICK TO SELECT</div>
      <div className="lc">
        {Object.entries(loans).map(([key, loan]: [string, any]) => (
          <div key={key} className={`lcard${model.debt.selectedLoan === key ? ' sel' : ''}`} onClick={() => setModel((m: any) => ({ ...m, debt: { ...m.debt, selectedLoan: key } }))}>
            <div className="lch"><span>{loan.name}</span>{model.debt.selectedLoan === key && <div className="sd" />}</div>
            <div className="lr"><span className="lk">LTV</span><span className="lv">{(loan.ltv * 100).toFixed(0)}%</span></div>
            <div className="lr"><span className="lk">Rate</span><span className="lv">{(loan.rate * 100).toFixed(2)}%</span></div>
            <div className="lr"><span className="lk">IO Period</span><span className="lv">{loan.ioYears} yrs</span></div>
            <div className="lr"><span className="lk">Amortization</span><span className="lv">{loan.amortYears} yrs</span></div>
            <div className="lr"><span className="lk">Proceeds</span><span className="lv">{fmt$(loan.proceeds)}</span></div>
          </div>
        ))}
      </div>
      <div className="ai-call">
        <h4>&#x26A1; AI Debt Analysis</h4>
        <ul>
          <li><span>&rarr;</span><span><strong>{loans[model.debt?.selectedLoan]?.name || 'Selected loan'} active.</strong> {loans[model.debt?.selectedLoan]?.ioYears || 0}yr IO provides cash flow runway during stabilization ramp.</span></li>
          <li><span>&rarr;</span><span><strong>{(loans[model.debt?.selectedLoan]?.rate * 100 || 0).toFixed(2)}% rate</strong> locked for term &mdash; eliminates floating rate risk across the hold period.</span></li>
        </ul>
      </div>
    </div>
  );
}

function ProjectionsView({ model }: { model: any }) {
  const [holdFilter, setHoldFilter] = useState(model?.exit?.holdYears || 7);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const cashFlows = model?._annualCashFlow || [];
  const filteredCF = cashFlows.slice(0, holdFilter);
  const toggle = (section: string) => setCollapsed(p => ({ ...p, [section]: !p[section] }));

  if (filteredCF.length === 0) {
    return (
      <div className="ass">
        <div className="slbl">OPERATING STATEMENT PROJECTIONS</div>
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ba3b0', fontSize: '12px' }}>
          No projection data available. Build a model from the Pro Forma tab to generate annual cash flow projections.
        </div>
      </div>
    );
  }

  return (
    <div className="ass">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="slbl" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>OPERATING STATEMENT PROJECTIONS</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[3, 5, 7, 10].map(y => (
            <button key={y} onClick={() => setHoldFilter(y)} style={{
              padding: '3px 10px', borderRadius: 4, fontSize: '10.5px', fontWeight: holdFilter === y ? 700 : 400,
              border: `1px solid ${holdFilter === y ? '#111827' : '#e2e5ed'}`,
              background: holdFilter === y ? '#111827' : '#f9fafb',
              color: holdFilter === y ? '#fff' : '#6b7280', cursor: 'pointer',
            }}>{y}yr</button>
          ))}
        </div>
      </div>
      <table className="dtbl">
        <thead>
          <tr>
            <th style={{ textAlign: 'left', width: 200 }}>Line Item</th>
            {filteredCF.map((cf: any) => (
              <th key={cf.year} style={{ textAlign: 'right', minWidth: 90 }}>
                Year {cf.year}{cf.year === holdFilter && ' \u26A1'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr onClick={() => toggle('revenue')} style={{ cursor: 'pointer' }}>
            <td style={{ fontWeight: 700, color: '#1f2937' }}>{collapsed.revenue ? '\u25B6' : '\u25BC'} REVENUE</td>
            {filteredCF.map((cf: any) => <td key={cf.year} />)}
          </tr>
          {!collapsed.revenue && (
            <>
              <tr><td>Gross Potential Rent</td>{filteredCF.map((cf: any) => <td key={cf.year} className="tv">{fmt$(cf.potentialRent || 0)}</td>)}</tr>
              <tr><td>(Less) Vacancy</td>{filteredCF.map((cf: any) => <td key={cf.year} className="tv" style={{ color: '#dc2626' }}>({fmt$(cf.vacancy || 0)})</td>)}</tr>
              <tr><td>(Less) Collection Loss</td>{filteredCF.map((cf: any) => <td key={cf.year} className="tv" style={{ color: '#dc2626' }}>({fmt$(cf.collectionLoss || 0)})</td>)}</tr>
              <tr><td>Other Income</td>{filteredCF.map((cf: any) => <td key={cf.year} className="tv">{fmt$(cf.otherIncome || 0)}</td>)}</tr>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}><td style={{ fontWeight: 600 }}>Effective Gross Revenue</td>{filteredCF.map((cf: any) => <td key={cf.year} className="thl">{fmt$(cf.effectiveGrossRevenue || 0)}</td>)}</tr>
            </>
          )}
          <tr onClick={() => toggle('expenses')} style={{ cursor: 'pointer' }}>
            <td style={{ fontWeight: 700, color: '#1f2937' }}>{collapsed.expenses ? '\u25B6' : '\u25BC'} EXPENSES</td>
            {filteredCF.map((cf: any) => <td key={cf.year} />)}
          </tr>
          {!collapsed.expenses && (
            <>
              <tr><td>Total Operating Expenses</td>{filteredCF.map((cf: any) => <td key={cf.year} className="tv" style={{ color: '#dc2626' }}>({fmt$(cf.totalExpenses || 0)})</td>)}</tr>
            </>
          )}
          <tr style={{ borderBottom: '2px solid #111827', background: '#f9fafb' }}>
            <td style={{ fontWeight: 700, color: '#1f2937' }}>NET OPERATING INCOME</td>
            {filteredCF.map((cf: any) => <td key={cf.year} className="tgr" style={{ fontWeight: 700 }}>{fmt$(cf.noi || 0)}</td>)}
          </tr>
          <tr><td>Replacement Reserves</td>{filteredCF.map((cf: any) => <td key={cf.year} className="tv">({fmt$(cf.replacementReserves || 0)})</td>)}</tr>
          <tr><td style={{ fontWeight: 600 }}>NOI After Reserves</td>{filteredCF.map((cf: any) => <td key={cf.year} className="tgr">{fmt$(cf.noiAfterReserves || 0)}</td>)}</tr>
          <tr onClick={() => toggle('debt')} style={{ cursor: 'pointer' }}>
            <td style={{ fontWeight: 700, color: '#1f2937' }}>{collapsed.debt ? '\u25B6' : '\u25BC'} DEBT SERVICE</td>
            {filteredCF.map((cf: any) => <td key={cf.year} />)}
          </tr>
          {!collapsed.debt && (
            <>
              <tr><td>Total Debt Service</td>{filteredCF.map((cf: any) => <td key={cf.year} className="tv" style={{ color: '#dc2626' }}>({fmt$(cf.debtService || 0)})</td>)}</tr>
            </>
          )}
          <tr style={{ borderBottom: '2px solid #111827', background: '#f0fdf4' }}>
            <td style={{ fontWeight: 700, color: '#166534' }}>LEVERED CASH FLOW</td>
            {filteredCF.map((cf: any) => <td key={cf.year} className="tgr" style={{ fontWeight: 700 }}>{fmt$(cf.leveredCashFlow || cf.beforeTaxCashFlow || 0)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SensView({ model }: { model: any }) {
  const exitCaps = [.045, .050, .055, .060, .065];
  const rents = [.02, .03, .04, .05];
  const baseIrr = model.scenarios?.base?.irr || 18;
  const baseEM = model.scenarios?.base?.equityMultiple || 2.0;

  const hc = (irr: number) => irr > 40 ? { background: '#dcfce7', color: '#166534' } : irr > 35 ? { background: '#d1fae5', color: '#065f46' } : irr > 28 ? { background: '#dbeafe', color: '#1e40af' } : irr > 20 ? { background: '#fef9c3', color: '#854d0e' } : { background: '#fee2e2', color: '#991b1b' };
  const ec = (em: number) => em > 9 ? { background: '#dcfce7', color: '#166534' } : em > 6 ? { background: '#dbeafe', color: '#1e40af' } : em > 4 ? { background: '#fef9c3', color: '#854d0e' } : { background: '#fee2e2', color: '#991b1b' };
  const baseExitCap = model.exit?.exitCapRate || 0.055;
  const baseRentGrowth = model.revenue?.rentGrowthY1 || 0.04;
  const ai = (cap: number, rg: number) => Math.max(8, Math.min(55, baseIrr + (baseExitCap - cap) * 200 + (rg - baseRentGrowth) * 150));

  return (
    <div className="sns">
      <div className="slbl">IRR SENSITIVITY &mdash; EXIT CAP &times; RENT GROWTH</div>
      <div className="scard">
        <div className="stit">IRR (%) &middot; Exit Cap Rate (rows) vs Year 1 Rent Growth (columns)</div>
        <table className="ht">
          <thead><tr><th style={{ textAlign: 'left', padding: '7px 12px' }}>Exit Cap &darr; / Rent &rarr;</th>{rents.map(r => <th key={r}>{(r * 100).toFixed(0)}% Rent</th>)}</tr></thead>
          <tbody>{exitCaps.map(cap => <tr key={cap}><td className="rl" style={{ padding: '8px 12px' }}>{(cap * 100).toFixed(1)}% Cap</td>{rents.map(rg => { const irr = ai(cap, rg); return <td key={rg} style={{ ...hc(irr), padding: '8px 12px' }}>{irr.toFixed(1)}%</td>; })}</tr>)}</tbody>
        </table>
      </div>
      <div className="slbl">EQUITY MULTIPLE SENSITIVITY &mdash; HOLD PERIOD &times; EXIT CAP</div>
      <div className="scard">
        <div className="stit">Equity Multiple (x) &middot; Hold Period (rows) vs Exit Cap Rate (columns)</div>
        <table className="ht">
          <thead><tr><th style={{ textAlign: 'left', padding: '7px 12px' }}>Hold &darr; / Cap &rarr;</th>{exitCaps.map(c => <th key={c}>{(c * 100).toFixed(1)}%</th>)}</tr></thead>
          <tbody>{[5, 6, 7, 8].map(h => <tr key={h}><td className="rl" style={{ padding: '8px 12px' }}>{h}yr Hold</td>{exitCaps.map(cap => { const em = Math.max(1.5, Math.min(14, baseEM + ((model.exit?.holdYears || 7) - h) * -.8 + (baseExitCap - cap) * 60)); return <td key={cap} style={{ ...ec(em), padding: '8px 12px' }}>{em.toFixed(2)}x</td>; })}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function WaterfallView({ model }: { model: any }) {
  const distributions = model?._waterfallDistributions || [];
  const su = model?._sourcesAndUses || {};

  const totalLP = distributions.reduce((sum: number, d: any) => sum + (d.lpDistribution || 0), 0);
  const totalGP = distributions.reduce((sum: number, d: any) => sum + (d.gpDistribution || 0), 0);
  const totalPromote = distributions.reduce((sum: number, d: any) => sum + (d.gpPromote || 0), 0);
  const total = totalLP + totalGP;
  const lpPct = total > 0 ? (totalLP / total * 100).toFixed(0) : '0';
  const gpPct = total > 0 ? (totalGP / total * 100).toFixed(0) : '0';

  return (
    <div className="ass">
      <div className="slbl">SOURCES & USES</div>
      {(su.sources || su.uses) ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div>
            <table className="dtbl">
              <thead><tr><th>Sources</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {Object.entries(su.sources || {}).map(([k, v]: [string, any]) => (
                  <tr key={k}><td>{k}</td><td className="tv">{fmt$(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <table className="dtbl">
              <thead><tr><th>Uses</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {Object.entries(su.uses || {}).map(([k, v]: [string, any]) => (
                  <tr key={k}><td>{k}</td><td className="tv">{fmt$(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ba3b0', fontSize: '12px', marginBottom: 20 }}>
          Sources & Uses will appear after building a model.
        </div>
      )}

      <div className="slbl">LP / GP EQUITY DISTRIBUTION</div>
      {total > 0 ? (
        <>
          <div style={{ height: 32, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
            <div style={{ width: `${lpPct}%`, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>LP {lpPct}%</div>
            <div style={{ width: `${gpPct}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 11, fontWeight: 700 }}>GP {gpPct}%</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>LP RETURNS</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 2 }}>
                <div>Total LP: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmt$(totalLP)}</strong></div>
              </div>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 8 }}>GP RETURNS</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 2 }}>
                <div>Total GP: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmt$(totalGP)}</strong></div>
                <div>Promote: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmt$(totalPromote)}</strong></div>
              </div>
            </div>
          </div>
          {distributions.length > 0 && (
            <>
              <div className="slbl" style={{ marginTop: 20 }}>ANNUAL DISTRIBUTIONS</div>
              <table className="dtbl">
                <thead><tr><th>Year</th><th style={{ textAlign: 'right' }}>LP</th><th style={{ textAlign: 'right' }}>GP</th><th style={{ textAlign: 'right' }}>Promote</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {distributions.map((d: any) => (
                    <tr key={d.year}>
                      <td>Year {d.year}</td>
                      <td className="tv">{fmt$(d.lpDistribution || 0)}</td>
                      <td className="tv">{fmt$(d.gpDistribution || 0)}</td>
                      <td className="tv">{fmt$(d.gpPromote || 0)}</td>
                      <td className="thl">{fmt$(d.totalDistribution || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      ) : (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ba3b0', fontSize: '12px' }}>
          Waterfall distributions will appear after building a model with partnership structure.
        </div>
      )}
    </div>
  );
}

function DecView({ model, dealId }: { model: any; dealId: string }) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const loan = model?.debt?.loans?.[model?.debt?.selectedLoan] || {};
  const scenarios = model?.scenarios || {};

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post(`/api/v1/financial-dashboard/${dealId}/analyze`);
      if (res.data?.data) setAnalysis(res.data.data);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dealId && scenarios?.base?.irr > 0) {
      fetchAnalysis();
    }
  }, [dealId]);

  if (loading) {
    return (
      <div className="dec" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 12, color: '#9ba3b0' }}>Generating AI analysis...</div>
        <div className="fc-think" style={{ justifyContent: 'center', marginTop: 12 }}><span /><span /><span /></div>
      </div>
    );
  }

  if (analysis) {
    return (
      <div className="dec">
        <div className="win">
          <div>
            <h4>{analysis.recommendation === 'proceed' ? '\u2713' : analysis.recommendation === 'cautious' ? '\u26A0' : '\u26D4'} {analysis.recommendation === 'proceed' ? 'Proceed' : analysis.recommendation === 'cautious' ? 'Proceed with Caution' : 'Needs Review'}</h4>
            <p>{analysis.rationale?.[0] || 'AI-generated investment recommendation'}</p>
          </div>
          <span className={analysis.conviction === 'high' ? 'bgr' : 'bbl'}>{analysis.conviction ? analysis.conviction.charAt(0).toUpperCase() + analysis.conviction.slice(1) : 'Medium'} Conviction</span>
        </div>
        {analysis.rationale?.length > 0 && (
          <>
            <div className="slbl">DECISION RATIONALE</div>
            <div className="dc">
              <h4>&#x1F3C6; Investment Thesis</h4>
              <ul>
                {analysis.rationale.map((r: string, i: number) => (
                  <li key={i}><span>&#x2726;</span><span>{r}</span></li>
                ))}
              </ul>
            </div>
          </>
        )}
        {analysis.riskFlags?.length > 0 && (
          <div className="dc">
            <h4>&#x26A0;&#xFE0F; Risk Flags</h4>
            <ul>
              {analysis.riskFlags.map((r: string, i: number) => (
                <li key={i}><span style={{ color: '#f59e0b' }}>&blacktriangle;</span><span>{r}</span></li>
              ))}
            </ul>
          </div>
        )}
        {analysis.actionItems?.length > 0 && (
          <div className="dc">
            <h4>&#x1F4CB; Action Items</h4>
            <ul>
              {analysis.actionItems.map((a: string, i: number) => (
                <li key={i}><span style={{ color: '#059669' }}>&rarr;</span><span>{a}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dec">
      <div className="win">
        <div><h4>&#x2713; Recommended: {loan.name || 'N/A'}</h4><p>Selected by AI &mdash; IO period, rate, and turnaround cash flow match</p></div>
        <span className="bbl">High Conviction</span>
      </div>
      <div className="slbl">DECISION RATIONALE</div>
      <div className="dc">
        <h4>&#x1F3C6; Why {loan.name || 'Selected Option'} Wins</h4>
        <ul>
          <li><span>&#x2726;</span><span><strong>{fmt$(loan.proceeds || 0)} proceeds ({((loan.ltv || 0) * 100).toFixed(0)}% LTV)</strong> &mdash; Conservative leverage protects cash flow.</span></li>
          <li><span>&#x2726;</span><span><strong>{((loan.rate || 0) * 100).toFixed(2)}% fixed rate</strong> &mdash; Locked for term, eliminates rate risk across the hold period.</span></li>
          <li><span>&#x2726;</span><span><strong>{loan.ioYears || 0} years IO</strong> &mdash; Saves cash during stabilization ramp when cash flow is tightest.</span></li>
          <li><span>&#x2726;</span><span><strong>{loan.amortYears || 30}-yr amortization</strong> after IO &mdash; Low payments maintain healthy DSCR.</span></li>
        </ul>
      </div>
      <div className="dc">
        <h4>&#x26A0;&#xFE0F; Risk Flags</h4>
        <ul>
          <li><span style={{ color: '#f59e0b' }}>&blacktriangle;</span><span>Defeasance/Yield Maintenance prepay &mdash; exit before maturity carries a premium.</span></li>
          <li><span style={{ color: '#f59e0b' }}>&blacktriangle;</span><span>DSCR at {(scenarios.worst?.dscr || 0).toFixed(2)}x in Worst Case &mdash; limited buffer if occupancy recovery stalls.</span></li>
        </ul>
      </div>
      <div className="dc">
        <h4>&#x1F4CB; Action Items</h4>
        <ul>
          <li><span style={{ color: '#059669' }}>&rarr;</span><span>Lock term sheet within 14 days of PSA execution.</span></li>
          <li><span style={{ color: '#059669' }}>&rarr;</span><span>Commission contractor bids for Y1 renovation units before close.</span></li>
          <li><span style={{ color: '#059669' }}>&rarr;</span><span>Order Phase I ESA and Property Condition Report concurrently with DD.</span></li>
        </ul>
      </div>
      {scenarios?.base?.irr > 0 && (
        <button onClick={fetchAnalysis} style={{
          marginTop: 16, padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e5ed',
          background: '#f9fafb', color: '#374151', fontSize: 12, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        }}>&#x26A1; Generate AI Analysis</button>
      )}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');
.fd{display:flex;height:100%;font-family:'Inter',sans-serif;overflow:hidden;background:#f0f2f5;border-radius:10px}
.fc{width:380px;min-width:320px;display:flex;flex-direction:column;background:#0c0d10;border-right:1px solid #1c1e26;flex-shrink:0;border-radius:10px 0 0 10px}
.fc-top{padding:14px 16px 12px;border-bottom:1px solid #181a21;flex-shrink:0}
.fc-brand{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.fc-mark{width:24px;height:24px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#000;font-family:'Syne',sans-serif}
.fc-name{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#e1e4ea;letter-spacing:.04em}
.fc-name span{color:#f59e0b}
.fc-h{font-size:12px;font-weight:600;color:#c5cad4;margin-bottom:2px}
.fc-s{font-size:11px;color:#3e4455;line-height:1.4}
.fc-ctx{padding:7px 16px;border-bottom:1px solid #181a21;background:#09090c;display:flex;align-items:center;gap:6px;flex-shrink:0}
.fc-dot{width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 5px #22c55e;flex-shrink:0}
.fc-ctxt{font-size:10.5px;color:#3e4455;font-family:'JetBrains Mono',monospace}
.fc-ctxt b{color:#f59e0b;font-weight:500}
.fc-msgs{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:0;scrollbar-width:thin;scrollbar-color:#1c1e26 transparent}
.fc-msg{display:flex;gap:9px;padding:10px 0;border-bottom:1px solid #121419}
.fc-msg:last-child{border-bottom:none}
.fc-av{width:26px;height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px;font-family:'Syne',sans-serif}
.fc-av.u{background:#16244a;color:#60a5fa;border:1px solid #1d3461}
.fc-av.a{background:#38200a;color:#f59e0b;border:1px solid #78350f}
.fc-mi{flex:1;min-width:0}
.fc-mr{font-size:9.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:4px;color:#383d4a}
.fc-mr.a{color:#f59e0b}
.fc-mt{font-size:12.5px;line-height:1.65;color:#c5cad4}
.fc-mt p{margin-bottom:5px}
.fc-mt p:last-child{margin-bottom:0}
.fc-chip{display:inline-flex;align-items:center;gap:4px;margin-top:7px;padding:3px 9px;border-radius:4px;font-size:10.5px;font-family:'JetBrains Mono',monospace;background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.2);color:#4ade80}
.fc-think{display:flex;gap:3px;align-items:center;padding:3px 0}
.fc-think span{width:4px;height:4px;border-radius:50%;background:#f59e0b;animation:fp 1.2s ease-in-out infinite}
.fc-think span:nth-child(2){animation-delay:.2s}
.fc-think span:nth-child(3){animation-delay:.4s}
@keyframes fp{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
.fc-qp{padding:8px 14px 6px;border-top:1px solid #181a21;display:flex;flex-wrap:wrap;gap:5px;flex-shrink:0}
.fc-qb{padding:4px 9px;border-radius:3px;font-size:10.5px;cursor:pointer;border:1px solid #1c1e26;background:#11131a;color:#3e4455;transition:all .12s;font-family:'Inter',sans-serif}
.fc-qb:hover{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,.06)}
.fc-ia{padding:10px 14px 12px;border-top:1px solid #181a21;flex-shrink:0}
.fc-ii{display:flex;align-items:flex-end;gap:8px;background:#11131a;border:1px solid #1c1e26;border-radius:8px;padding:8px 10px;transition:border-color .12s}
.fc-ii:focus-within{border-color:#f59e0b}
.fc-ii textarea{flex:1;background:transparent;border:none;outline:none;color:#c5cad4;font-size:12.5px;font-family:'Inter',sans-serif;resize:none;line-height:1.5;max-height:100px;overflow-y:auto}
.fc-ii textarea::placeholder{color:#272b35}
.fc-sb{width:28px;height:28px;border-radius:5px;border:none;background:#f59e0b;color:#000;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;transition:all .12s}
.fc-sb:hover{background:#d97706}
.fc-sb:disabled{background:#1c1e26;color:#272b35;cursor:not-allowed}
@keyframes mi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.mi{animation:mi .2s ease-out}
.fm{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#f0f2f5}
.fm-tb{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:48px;background:#fff;border-bottom:1px solid #e2e5ed;flex-shrink:0}
.fm-tbl{display:flex;align-items:center;gap:8px}
.fm-logo{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:#111827}
.fm-logo span{color:#f59e0b}
.fm-sep{width:1px;height:14px;background:#e2e5ed}
.fm-bc{font-size:12px;color:#6b7280;display:flex;align-items:center;gap:5px}
.fm-bc strong{color:#111827}
.fm-tbr{display:flex;align-items:center;gap:6px}
.fm-bdg{padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:500;border:1px solid}
.fm-bdg.amb{background:#fffbeb;color:#b45309;border-color:#fcd34d}
.fm-bdg.grn{background:#f0fdf4;color:#166534;border-color:#86efac}
.fm-act{padding:5px 10px;border-radius:5px;font-size:11px;border:1px solid #e2e5ed;background:#f9fafb;color:#6b7280;cursor:pointer;transition:all .12s;font-family:'Inter',sans-serif}
.fm-act:hover{border-color:#d1d5db;color:#374151}
.fm-hero{margin:16px 20px 0;background:#13151c;border-radius:10px 10px 0 0;padding:18px 22px 16px;border:1px solid #1e2028;border-bottom:none;flex-shrink:0}
.fm-hl{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#4a8cf0;margin-bottom:8px;font-family:'JetBrains Mono',monospace}
.fm-ht{font-size:19px;font-weight:700;color:#eef0f5;font-family:'Syne',sans-serif;margin-bottom:5px;line-height:1.2}
.fm-hs{font-size:12px;color:#454d5e;line-height:1.4}
.fm-mb{margin:0 20px;background:#fff;border:1px solid #e2e5ed;border-top:none;padding:10px 16px;display:flex;align-items:center;gap:7px;flex-shrink:0;flex-wrap:wrap}
.fm-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:500;border:1.5px solid;cursor:pointer;transition:all .15s;font-family:'Inter',sans-serif;background:none}
.fm-pill.inactive{border-color:#e2e5ed;color:#9ba3b0;background:#f9fafb}
.fm-pill.inactive:hover{border-color:#d1d5db;color:#6b7280}
.fm-pill.live{border-color:#22c55e;color:#15803d;background:#f0fdf4}
.fm-pill.mock{border-color:#f59e0b;color:#b45309;background:#fffbeb}
.fm-pill.error{border-color:#ef4444;color:#b91c1c;background:#fef2f2}
.fp-icon{font-size:10px}
.fp-name{font-weight:600}
.fp-st{font-size:10px;font-weight:400;opacity:.8}
.fm-mc{margin-left:auto;font-size:11px;color:#9ba3b0;display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;white-space:nowrap}
.fm-mc b{color:#374151}
.fm-rfr{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;border:1px solid #e2e5ed;background:#f9fafb;color:#6b7280;font-size:11px;cursor:pointer;transition:all .12s;font-family:'Inter',sans-serif}
.fm-rfr:hover{border-color:#d1d5db;color:#374151}
.fm-md{margin:0 20px;background:#fff;border:1px solid #e2e5ed;border-top:1px solid #f3f4f6;overflow:hidden;max-height:0;transition:max-height .25s ease;flex-shrink:0}
.fm-md.open{max-height:220px}
.fm-mdi{padding:14px 16px}
.fm-mdi h4{font-size:12px;font-weight:700;color:#1f2937;margin-bottom:10px}
.fm-mg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.fm-mi{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px}
.fm-mil{font-size:9.5px;color:#9ba3b0;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px}
.fm-min{font-size:12px;font-weight:700;color:#1f2937;margin-bottom:4px}
.fm-mif{font-size:10.5px;color:#6b7280;line-height:1.5}
.fm-mist{display:inline-flex;align-items:center;gap:3px;margin-top:6px;padding:2px 7px;border-radius:99px;font-size:9.5px;font-weight:600}
.fm-mist.live{background:#dcfce7;color:#166534}
.fm-mist.mock{background:#fef3c7;color:#92400e}
.fm-mist.none{background:#f3f4f6;color:#6b7280}
.fm-tabs{margin:0 20px;border-bottom:1px solid #e2e5ed;background:#fff;display:flex;align-items:center;padding:0 4px;flex-shrink:0;overflow-x:auto;scrollbar-width:none}
.fm-tab{padding:11px 16px;font-size:12.5px;font-weight:500;color:#9ba3b0;cursor:pointer;border-bottom:2px solid transparent;transition:all .12s;white-space:nowrap;background:transparent;border-top:none;border-left:none;border-right:none;display:flex;align-items:center;gap:5px;font-family:'Inter',sans-serif}
.fm-tab:hover:not(.on){color:#4b5563}
.fm-tab.on{color:#111827;border-bottom-color:#111827;font-weight:600}
.fm-cnt{flex:1;overflow-y:auto;margin:0 20px 16px;background:#fff;border:1px solid #e2e5ed;border-top:none;border-radius:0 0 10px 10px;scrollbar-width:thin;scrollbar-color:#e2e5ed transparent}
.cmp{padding:24px}
.cmp-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px}
.cmp-hdr h3{font-size:16px;font-weight:700;color:#111827;margin-bottom:3px}
.cmp-hdr p{font-size:12px;color:#9ba3b0}
.cmp-tbl{width:100%;border-collapse:collapse}
.cmp-tbl thead tr{border-bottom:2px solid #f3f4f6}
.cmp-tbl thead th{padding:12px 16px;text-align:left;font-weight:400;vertical-align:top}
.th-lbl{width:160px;font-size:11px;color:#9ba3b0;text-transform:uppercase;letter-spacing:.06em;font-family:'JetBrains Mono',monospace}
.th-base{background:#eef2ff;border-radius:8px 8px 0 0}
.th-base .cn{font-size:15px;font-weight:700;color:#1e3a8a}
.th-base .cs{font-size:11px;color:#6b7280;margin-top:2px}
.th-best .cn{font-size:15px;font-weight:700;color:#111827}
.th-best .cs{font-size:11px;color:#9ba3b0;margin-top:2px}
.th-worst .cn{font-size:15px;font-weight:700;color:#111827}
.th-worst .cs{font-size:11px;color:#9ba3b0;margin-top:2px}
.cmp-tbl tbody tr{border-bottom:1px solid #f9fafb}
.cmp-tbl tbody tr:hover td{background:#fcfcfd}
.cmp-tbl tbody tr:hover .cb{background:#e8edff}
td.cm{padding:14px 16px;vertical-align:middle}
td.cm-lbl{font-size:13px;color:#374151}
td.cb{background:#eef2ff}
.cv{font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#111827}
td.cbe .cv{color:#059669}
td.cwo .cv{color:#dc2626}
.cd{font-size:11px;margin-top:2px;font-family:'JetBrains Mono',monospace}
.cd.p{color:#059669}
.cd.n{color:#dc2626}
.ai-call{margin-top:20px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px}
.ai-call h4{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b45309;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.ai-call ul{list-style:none;display:flex;flex-direction:column;gap:5px;padding:0;margin:0}
.ai-call li{font-size:12px;color:#78350f;display:flex;gap:7px;line-height:1.5}
.ai-call li strong{color:#451a03}
.ass{padding:24px}
.slbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ba3b0;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #f3f4f6;font-family:'JetBrains Mono',monospace}
.dtbl{width:100%;border-collapse:collapse;margin-bottom:22px}
.dtbl th{text-align:left;padding:7px 12px;font-size:10px;color:#9ba3b0;font-weight:600;letter-spacing:.05em;text-transform:uppercase;background:#f9fafb;border-bottom:1px solid #f3f4f6}
.dtbl td{padding:9px 12px;border-bottom:1px solid #f9fafb;font-size:12px;color:#374151}
.dtbl tr:last-child td{border-bottom:none}
.dtbl tr:hover td{background:#fcfcfd}
.tv{font-family:'JetBrains Mono',monospace;font-weight:600;color:#111827;text-align:right}
.thl{font-family:'JetBrains Mono',monospace;font-weight:700;color:#1d4ed8;text-align:right}
.tgr{font-family:'JetBrains Mono',monospace;font-weight:700;color:#059669;text-align:right}
.tsc{font-size:10px;color:#9ba3b0;font-style:italic}
.dbt{padding:24px}
.lc{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.lcard{border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .15s;background:#fff}
.lcard:hover{border-color:#93c5fd}
.lcard.sel{border-color:#2563eb}
.lch{padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
.lch span{font-size:12px;font-weight:700;color:#111827}
.lch .sd{width:8px;height:8px;border-radius:50%;background:#2563eb}
.lr{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f3f4f6}
.lr:last-child{border-bottom:none}
.lr .lk{font-size:11px;color:#9ba3b0}
.lr .lv{font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:600;color:#111827}
.sns{padding:24px}
.scard{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px}
.stit{padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#374151}
.ht{width:100%;border-collapse:collapse}
.ht th{padding:7px 12px;text-align:center;font-size:10.5px;color:#9ba3b0;border-bottom:1px solid #f3f4f6;font-family:'JetBrains Mono',monospace;background:#f9fafb}
.ht td{padding:8px 12px;text-align:center;font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:600;border-bottom:1px solid #f9fafb}
.rl{font-size:11px;color:#9ba3b0;background:#f9fafb;font-weight:400;border-right:1px solid #e5e7eb;text-align:left}
.dec{padding:24px}
.win{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;margin-bottom:20px}
.win h4{font-size:14px;font-weight:700;color:#1e40af}
.win p{font-size:11px;color:#6b7280;margin-top:2px}
.bbl{padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:600;background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd}
.bgr{padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:600;background:#dcfce7;color:#166534;border:1px solid #86efac}
.dc{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:12px}
.dc h4{font-size:13px;font-weight:700;color:#111827;margin-bottom:10px;display:flex;align-items:center;gap:7px}
.dc ul{list-style:none;padding:0;margin:0}
.dc li{font-size:12px;color:#6b7280;padding:6px 0;border-bottom:1px solid #e5e7eb;display:flex;align-items:flex-start;gap:8px;line-height:1.5}
.dc li:last-child{border-bottom:none}
@keyframes spin{to{transform:rotate(360deg)}}
`;

const FinancialDashboard: React.FC<DealProps> = ({ deal, dealId }) => {
  const id = dealId || deal?.id;
  const [model, setModel] = useState<any>(null);
  const [ms, setMs] = useState<Record<string, string>>({ strategy: 'none', traffic: 'none', proforma: 'none', debt: 'none' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [inp, setInp] = useState('');
  const [load, setLoad] = useState(false);
  const [tab, setTab] = useState('comparison');
  const [spin, setSpin] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, load]);

  useEffect(() => {
    if (id) loadSummary();
  }, [id]);

  const loadSummary = async () => {
    setInitialLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/financial-dashboard/${id}/summary`);
      const summary = res.data?.data;
      if (summary) {
        const m = buildModelFromSummary(summary);
        setModel(m);
        const modules = summary.modules || [];
        const moduleMap: Record<string, string> = {};
        modules.forEach((m: any) => {
          const key = m.name === 'Strategy' ? 'strategy' : m.name === 'Traffic' ? 'traffic' : m.name === 'Pro Forma' ? 'proforma' : m.name === 'Debt' ? 'debt' : m.name?.toLowerCase();
          if (key) moduleMap[key] = m.status || 'none';
        });
        setMs({
          strategy: moduleMap.strategy || 'none',
          traffic: moduleMap.traffic || 'none',
          proforma: moduleMap.proforma || 'none',
          debt: moduleMap.debt || 'none',
        });
        const liveModules = Object.values(moduleMap).filter((s: any) => s === 'live').length;
        setMsgs([{
          role: 'assistant',
          text: `${m.propertyName} loaded \u2014 ${m.acquisition?.units || 0} units, ${deal?.city || summary?.deal?.city || 'Unknown'}. ${liveModules} of 4 modules are live.\n\n${summary.model ? 'Financial model is computed. ' : 'No model built yet \u2014 go to Pro Forma tab to enter assumptions. '}Want me to stress-test the exit cap, swap debt, or run a scenario variation?`,
          update: null,
        }]);
      }
    } catch (err) {
      console.error('Failed to load financial summary:', err);
      const fallback = buildModelFromSummary({ deal: deal || {} });
      setModel(fallback);
      setMsgs([{
        role: 'assistant',
        text: `${fallback.propertyName} loaded with limited data. Some modules may not be connected yet.\n\nAsk me to model scenarios, stress test assumptions, or compare debt structures.`,
        update: null,
      }]);
    } finally {
      setInitialLoading(false);
    }
  };

  const refresh = () => {
    setSpin(true);
    loadSummary().finally(() => setTimeout(() => setSpin(false), 600));
  };

  const connCount = Object.values(ms).filter(s => s !== 'none').length;
  const pillCls = (mid: string) => { const s = ms[mid] || 'none'; return s === 'live' ? 'live' : s === 'mock' ? 'mock' : s === 'error' ? 'error' : 'inactive'; };
  const pillSt = (mid: string) => { const s = ms[mid] || 'none'; return s === 'live' ? 'live' : s === 'mock' ? 'mock data' : s === 'error' ? 'error' : 'no data'; };

  const send = useCallback(async (ov?: string) => {
    const t = (ov || inp).trim();
    if (!t || load || !model) return;
    setInp('');
    const um = { role: 'user', text: t, update: null };
    setMsgs(p => [...p, um]);
    setLoad(true);
    try {
      const res = await apiClient.post(`/api/v1/financial-dashboard/${id}/chat`, {
        messages: [...msgs, um].map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text })),
        systemPrompt: buildSysPrompt(model, ms),
      });
      const raw = res.data?.data?.content || res.data?.data?.text || 'No response.';
      const { text: ct, update } = parseResp(raw);
      setMsgs(p => [...p, { role: 'assistant', text: ct, update }]);
      if (update?.changes) setModel((p: any) => applyUpdate(p, update.changes));
    } catch {
      try {
        const hist = [...msgs, um].map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));
        const r = await fetch('/api/v1/financial-model/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          body: JSON.stringify({ messages: hist, systemPrompt: buildSysPrompt(model, ms) }),
        });
        const d = await r.json();
        const raw = d.data?.content || d.content?.map((c: any) => c.text || '').join('') || 'Connection error.';
        const { text: ct, update } = parseResp(raw);
        setMsgs(p => [...p, { role: 'assistant', text: ct, update }]);
        if (update?.changes) setModel((p: any) => applyUpdate(p, update.changes));
      } catch {
        setMsgs(p => [...p, { role: 'assistant', text: 'Connection error \u2014 check that the API key is configured.', update: null }]);
      }
    } finally {
      setLoad(false);
    }
  }, [inp, load, msgs, model, ms, id]);

  if (initialLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="fd" style={{ height: 'calc(100vh - 120px)', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="fc-think" style={{ justifyContent: 'center', marginBottom: 12 }}><span /><span /><span /></div>
            <div style={{ fontSize: 12, color: '#9ba3b0' }}>Loading financial model data...</div>
          </div>
        </div>
      </>
    );
  }

  if (!model) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="fd" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="fc">
          <div className="fc-top">
            <div className="fc-brand"><div className="fc-mark">J</div><div className="fc-name">JEDI <span>RE</span></div></div>
            <div className="fc-h">AI Financial Analyst</div>
            <div className="fc-s">Ask JEDI to stress test, build variations, or swap assumptions. Changes reflect live in the model.</div>
          </div>
          <div className="fc-ctx">
            <div className="fc-dot" />
            <div className="fc-ctxt"><b>{model.acquisition?.units || 0} units</b> &middot; <b>{fmt$(model.acquisition?.purchasePrice || 0)}</b> &middot; <b>{model.debt?.loans?.[model.debt?.selectedLoan]?.name || 'N/A'}</b></div>
          </div>
          <div className="fc-msgs">
            {msgs.map((m, i) => (
              <div key={i} className="fc-msg mi">
                <div className={`fc-av ${m.role === 'user' ? 'u' : 'a'}`}>{m.role === 'user' ? 'L' : 'J'}</div>
                <div className="fc-mi">
                  <div className={`fc-mr${m.role === 'assistant' ? ' a' : ''}`}>{m.role === 'user' ? 'YOU' : 'JEDI'}</div>
                  <div className="fc-mt">{m.text.split('\n').filter((l: string) => l.trim()).map((l: string, j: number) => <p key={j}>{l}</p>)}</div>
                  {m.update && <div className="fc-chip">&#x2713; {m.update.description}</div>}
                </div>
              </div>
            ))}
            {load && <div className="fc-msg mi"><div className="fc-av a">J</div><div className="fc-mi"><div className="fc-mr a">JEDI</div><div className="fc-think"><span /><span /><span /></div></div></div>}
            <div ref={endRef} />
          </div>
          <div className="fc-qp">{QP.map(p => <button key={p} className="fc-qb" onClick={() => send(p)}>{p}</button>)}</div>
          <div className="fc-ia">
            <div className="fc-ii">
              <textarea rows={1} value={inp} placeholder="Ask JEDI to model a scenario..." onChange={e => setInp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="fc-sb" disabled={!inp.trim() || load} onClick={() => send()}>&uarr;</button>
            </div>
          </div>
        </div>

        <div className="fm">
          <div className="fm-tb">
            <div className="fm-tbl">
              <div className="fm-logo">JEDI<span> RE</span></div>
              <div className="fm-sep" />
              <div className="fm-bc"><span>{model.propertyName}</span><span>/</span><strong>Financial Model</strong></div>
            </div>
            <div className="fm-tbr">
              <span className="fm-bdg amb">{model.meta}</span>
              <span className="fm-bdg grn">{model.acquisition?.acquisitionDate || 'TBD'}</span>
              <button className="fm-act" onClick={() => window.open(`/api/v1/financial-model/${id}/export/excel`, '_blank')}>&darr; Export</button>
            </div>
          </div>

          <div className="fm-hero">
            <div className="fm-hl">FINANCIAL MODULE DASHBOARD</div>
            <div className="fm-ht">Strategy + Traffic + Pro Forma + Debt &rarr; Model Variations</div>
            <div className="fm-hs">Auto-builds Base, Best, Worst, and strategy-specific scenarios from all upstream modules</div>
          </div>

          <div className="fm-mb">
            {MODULES_DEF.map(mod => (
              <button key={mod.id} className={`fm-pill ${pillCls(mod.id)}`} onClick={() => setExpanded(p => p === mod.id ? null : mod.id)}>
                <span className="fp-icon">{mod.icon}</span>
                <span className="fp-name">{mod.label}</span>
                <span className="fp-st">{pillSt(mod.id)}</span>
              </button>
            ))}
            <div className="fm-mc">
              <span><b>{connCount}</b>/{MODULES_DEF.length} modules feeding the model</span>
              <button className="fm-rfr" onClick={refresh}>
                <span style={{ display: 'inline-block', animation: spin ? 'spin .8s linear infinite' : 'none' }}>&orarr;</span> Refresh
              </button>
            </div>
          </div>

          <div className={`fm-md${expanded ? ' open' : ''}`}>
            {expanded && (
              <div className="fm-mdi">
                <h4>Module Pipeline Details &mdash; Data Sources Feeding This Model</h4>
                <div className="fm-mg">
                  {MODULES_DEF.map(m => {
                    const st = ms[m.id] || 'none';
                    return (
                      <div key={m.id} className="fm-mi">
                        <div className="fm-mil">{m.icon} {m.label}</div>
                        <div className="fm-min">{m.description}</div>
                        <div className="fm-mif">{m.fields.map((f, i) => <span key={i}>{f}{i < m.fields.length - 1 ? ' \u00B7 ' : ''}</span>)}</div>
                        <div className={`fm-mist ${st === 'live' ? 'live' : st === 'mock' ? 'mock' : 'none'}`}>
                          {st === 'live' ? '\u25CF Live Data' : st === 'mock' ? '\u25D0 Mock Data' : '\u25CB Not Connected'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="fm-tabs">
            {TABS.map(t => <button key={t.k} className={`fm-tab${tab === t.k ? ' on' : ''}`} onClick={() => setTab(t.k)}><span>{t.i}</span>{t.l}</button>)}
          </div>

          <div className="fm-cnt">
            {tab === 'comparison' && <CompView model={model} />}
            {tab === 'assumptions' && <AssView model={model} />}
            {tab === 'debt' && <DebtView model={model} setModel={setModel} />}
            {tab === 'projections' && <ProjectionsView model={model} />}
            {tab === 'sensitivity' && <SensView model={model} />}
            {tab === 'waterfall' && <WaterfallView model={model} />}
            {tab === 'decision' && <DecView model={model} dealId={id || ''} />}
          </div>
        </div>
      </div>
    </>
  );
};

export default FinancialDashboard;
