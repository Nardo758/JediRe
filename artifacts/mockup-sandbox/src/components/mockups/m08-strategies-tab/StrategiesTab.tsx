import { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Info, Zap, BarChart2, ArrowRight } from 'lucide-react';

const C = {
  bg: '#0a0a0c',
  panel: '#111114',
  panelAlt: '#13131a',
  border: '#1e1e24',
  borderMid: '#2a2a35',
  cyan: '#00e5a0',
  amber: '#f59e0b',
  purple: '#a855f7',
  red: '#ef4444',
  green: '#22c55e',
  orange: '#f97316',
  textPrimary: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#3a3a50',
};

const mono = { fontFamily: '"JetBrains Mono", monospace' };

function Pill({ children, color = C.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ ...mono, backgroundColor: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 2, padding: '1px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
      {children}
    </span>
  );
}

function SectionHeader({ label, accent = C.cyan }: { label: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 3, height: 16, backgroundColor: accent, borderRadius: 1 }} />
      <span style={{ ...mono, color: C.textMuted, fontSize: 10, letterSpacing: '0.12em', fontWeight: 700 }}>{label}</span>
    </div>
  );
}

// ─── Comp Stratification Table (per unit type) ───────────────────────────────
const stratData = {
  '1BR': {
    sf: 715, subjectRent: 937, subjectUnits: 144,
    tierA: [
      { name: 'Bexley at Anderson Mill', units: 192, sf: 702, rent: 1198, psf: 1.70 },
      { name: 'Broadstone 8 One Hundred', units: 268, sf: 674, rent: 1026, psf: 1.52 },
      { name: 'Camden Amber Oaks II', units: 132, sf: 733, rent: 1022, psf: 1.39 },
    ],
    tierAMedian: 1082, tierAPSF: 1.54,
    tierB: [
      { name: 'IMT Residences at Riata', units: 195, sf: 738, rent: 1326, psf: 1.80 },
      { name: 'Windsor Republic Place', units: 160, sf: 790, rent: 1227, psf: 1.55 },
    ],
    tierBMedian: 1277, tierBPSF: 1.68,
    tierC: 1326, tierCPSF: 1.80,
    ltl: 145, vc: 195, cg: 49,
  },
  '2BR': {
    sf: 1050, subjectRent: 1247, subjectUnits: 140,
    tierA: [
      { name: 'Bexley at Anderson Mill', units: 192, sf: 1024, rent: 1395, psf: 1.36 },
      { name: 'Camden Amber Oaks II', units: 132, sf: 1080, rent: 1312, psf: 1.21 },
      { name: 'Broadstone 8 One Hundred', units: 268, sf: 990, rent: 1302, psf: 1.31 },
    ],
    tierAMedian: 1367, tierAPSF: 1.30,
    tierB: [
      { name: 'IMT Residences at Riata', units: 195, sf: 1050, rent: 1589, psf: 1.51 },
      { name: 'Windsor Republic Place', units: 160, sf: 1120, rent: 1498, psf: 1.34 },
    ],
    tierBMedian: 1542, tierBPSF: 1.43,
    tierC: 1589, tierCPSF: 1.51,
    ltl: 120, vc: 175, cg: 47,
  },
  '3BR': {
    sf: 1285, subjectRent: 1485, subjectUnits: 40,
    tierA: [
      { name: 'Camden Amber Oaks II', units: 132, sf: 1280, rent: 1598, psf: 1.25 },
      { name: 'Broadstone 8 One Hundred', units: 268, sf: 1250, rent: 1572, psf: 1.26 },
    ],
    tierAMedian: 1580, tierAPSF: 1.25,
    tierB: [
      { name: 'IMT Residences at Riata', units: 195, sf: 1310, rent: 1762, psf: 1.34 },
    ],
    tierBMedian: 1762, tierBPSF: 1.37,
    tierC: 1762, tierCPSF: 1.37,
    ltl: 95, vc: 140, cg: 42,
  },
};

function CompStratTable({ type }: { type: '1BR' | '2BR' | '3BR' }) {
  const d = stratData[type];
  const tierColor: Record<string, string> = { A: '#64748b', B: C.cyan, C: C.amber };
  const rows = [
    ...d.tierB.map(c => ({ ...c, tiers: 'B' as const })),
    ...d.tierA.map(c => ({ ...c, tiers: 'A' as const })),
  ].sort((a, b) => b.rent - a.rent);
  // Insert tier C label if tierC > max tierB
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ backgroundColor: C.panelAlt, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 700 }}>{type} · {d.sf} SF · Subject avg {d.subjectUnits}u</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {(['A', 'B'] as const).map(t => (
            <span key={t} style={{ ...mono, fontSize: 10, color: tierColor[t] }}>
              Tier {t} {t === 'A' ? `med $${d.tierAMedian}` : `med $${d.tierBMedian}`}
            </span>
          ))}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: '#0d0d12' }}>
            {['Property', 'Units', 'Avg SF', 'Rent/Unit', 'PSF', 'Tier'].map(h => (
              <th key={h} style={{ ...mono, textAlign: h === 'Property' ? 'left' : 'right', padding: '4px 10px', color: C.textMuted, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : `${C.border}20`, cursor: 'pointer' }}>
              <td style={{ padding: '5px 10px', color: C.textPrimary }}>{r.name}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textMuted }}>{r.units}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textMuted }}>{r.sf}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textPrimary, fontWeight: 600 }}>${r.rent.toLocaleString()}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textMuted }}>${r.psf.toFixed(2)}</td>
              <td style={{ textAlign: 'right', padding: '5px 10px' }}>
                <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: tierColor[r.tiers], backgroundColor: `${tierColor[r.tiers]}18`, border: `1px solid ${tierColor[r.tiers]}40`, borderRadius: 2, padding: '1px 5px' }}>
                  {r.tiers}{r.tiers === 'B' && r.rent === d.tierC ? '+C' : ''}
                </span>
              </td>
            </tr>
          ))}
          {/* Subject row */}
          <tr style={{ backgroundColor: `${C.amber}10`, borderTop: `1px solid ${C.border}` }}>
            <td style={{ padding: '5px 10px', color: C.amber, fontWeight: 600 }}>Bell Tech Corridor ▶ SUBJECT</td>
            <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.amber }}>{d.subjectUnits}</td>
            <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.amber }}>{d.sf}</td>
            <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.amber, fontWeight: 700 }}>${d.subjectRent.toLocaleString()}</td>
            <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.amber }}>${(d.subjectRent / d.sf).toFixed(2)}</td>
            <td style={{ textAlign: 'right', padding: '5px 10px' }}>
              <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: C.amber, backgroundColor: `${C.amber}18`, border: `1px solid ${C.amber}40`, borderRadius: 2, padding: '1px 5px' }}>SUBJECT</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Rent Ladder visualization ────────────────────────────────────────────────
function RentLadder({ type }: { type: '1BR' | '2BR' | '3BR' }) {
  const d = stratData[type];
  const min = d.subjectRent;
  const max = d.tierC;
  const range = max - min;
  const pct = (v: number) => ((v - min) / range) * 100;

  const levels = [
    { label: 'Tier C ceiling', value: d.tierC, color: C.amber, psf: d.tierCPSF },
    { label: 'Tier B median (renovated)', value: d.tierBMedian, color: C.cyan, psf: d.tierBPSF },
    { label: 'Tier A median (unrenovated)', value: d.tierAMedian, color: C.textMuted, psf: d.tierAPSF },
    { label: 'Subject in-place', value: d.subjectRent, color: C.red, psf: parseFloat((d.subjectRent / d.sf).toFixed(2)) },
  ];

  const gaps = [
    { from: d.subjectRent, to: d.tierAMedian, label: `LTL +$${d.ltl}`, sublabel: 'captures at turn · no capex', color: C.textMuted, fromPct: 0, toPct: pct(d.tierAMedian) },
    { from: d.tierAMedian, to: d.tierBMedian, label: `VC +$${d.vc}`, sublabel: 'requires renovation', color: C.cyan, fromPct: pct(d.tierAMedian), toPct: pct(d.tierBMedian) },
    { from: d.tierBMedian, to: d.tierC, label: `CG +$${d.cg}`, sublabel: 'stretch / upside case', color: C.amber, fromPct: pct(d.tierBMedian), toPct: 100 },
  ];

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 16, marginBottom: 8, backgroundColor: C.panelAlt }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 700 }}>{type} RENT LADDER</span>
        <span style={{ ...mono, color: C.textMuted, fontSize: 10 }}>base-case upside: <span style={{ color: C.cyan }}>${(d.ltl + d.vc).toLocaleString()}/unit/mo</span></span>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Bar visual */}
        <div style={{ position: 'relative', width: 60, flexShrink: 0 }}>
          {levels.map((l, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${100 - pct(l.value)}%`, height: 2, backgroundColor: l.color, boxShadow: `0 0 6px ${l.color}` }} />
          ))}
          {gaps.map((g, i) => (
            <div key={i} style={{ position: 'absolute', left: 20, width: 12, top: `${100 - g.toPct}%`, height: `${g.toPct - g.fromPct}%`, backgroundColor: `${g.color}30`, borderLeft: `2px solid ${g.color}60`, borderRight: `2px solid ${g.color}60` }} />
          ))}
          <div style={{ width: '100%', height: 200, position: 'relative' }} />
        </div>

        {/* Labels */}
        <div style={{ flex: 1, position: 'relative', height: 200 }}>
          {levels.map((l, i) => (
            <div key={i} style={{ position: 'absolute', top: `${100 - pct(l.value)}%`, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 1, backgroundColor: l.color }} />
              <span style={{ ...mono, color: l.color, fontSize: 11, fontWeight: 700 }}>${l.value.toLocaleString()}</span>
              <span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>${l.psf.toFixed(2)}/SF</span>
              <span style={{ color: C.textMuted, fontSize: 10 }}>{l.label}</span>
            </div>
          ))}
          {gaps.map((g, i) => (
            <div key={i} style={{ position: 'absolute', left: 120, top: `${100 - (g.fromPct + g.toPct) / 2}%`, transform: 'translateY(-50%)' }}>
              <div style={{ ...mono, color: g.color, fontSize: 11, fontWeight: 700 }}>{g.label}</div>
              <div style={{ color: C.textMuted, fontSize: 9 }}>{g.sublabel}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Portfolio Impact Table ───────────────────────────────────────────────────
const portfolioRows = [
  { type: '1BR', units: 144, ltl: 145, vc: 195, cg: 49, annualLTL: 250560, annualVC: 336960, annualCG: 84672 },
  { type: '2BR', units: 140, ltl: 120, vc: 175, cg: 47, annualLTL: 201600, annualVC: 294000, annualCG: 78960 },
  { type: '3BR', units: 40, ltl: 95, vc: 140, cg: 42, annualLTL: 45600, annualVC: 67200, annualCG: 20160 },
];

function PortfolioImpact() {
  const totLTL = portfolioRows.reduce((s, r) => s + r.annualLTL, 0);
  const totVC = portfolioRows.reduce((s, r) => s + r.annualVC, 0);
  const totCG = portfolioRows.reduce((s, r) => s + r.annualCG, 0);
  const baseCase = totLTL + totVC;
  const upsideCase = baseCase + totCG;

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: '#0d0d12' }}>
            {['Unit Type', 'Units', 'LTL $/u/mo', 'VC $/u/mo', 'CG $/u/mo', 'Annual LTL', 'Annual VC', 'Annual CG', 'Base Total'].map(h => (
              <th key={h} style={{ ...mono, textAlign: h === 'Unit Type' ? 'left' : 'right', padding: '5px 10px', color: C.textMuted, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {portfolioRows.map((r, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : `${C.border}20` }}>
              <td style={{ ...mono, padding: '5px 10px', color: C.textPrimary, fontWeight: 600 }}>{r.type}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textMuted }}>{r.units}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textMuted }}>${r.ltl}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.cyan }}>${r.vc}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.amber }}>${r.cg}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textPrimary }}>${r.annualLTL.toLocaleString()}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.cyan }}>${r.annualVC.toLocaleString()}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.amber }}>${r.annualCG.toLocaleString()}</td>
              <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textPrimary, fontWeight: 600 }}>${(r.annualLTL + r.annualVC).toLocaleString()}</td>
            </tr>
          ))}
          {/* Totals */}
          <tr style={{ backgroundColor: `${C.border}40`, borderTop: `1px solid ${C.borderMid}` }}>
            <td colSpan={2} style={{ ...mono, padding: '6px 10px', color: C.textPrimary, fontWeight: 700, fontSize: 10 }}>PORTFOLIO TOTAL</td>
            <td colSpan={3} />
            <td style={{ ...mono, textAlign: 'right', padding: '6px 10px', color: C.textPrimary, fontWeight: 700 }}>${totLTL.toLocaleString()}</td>
            <td style={{ ...mono, textAlign: 'right', padding: '6px 10px', color: C.cyan, fontWeight: 700 }}>${totVC.toLocaleString()}</td>
            <td style={{ ...mono, textAlign: 'right', padding: '6px 10px', color: C.amber, fontWeight: 700 }}>${totCG.toLocaleString()}</td>
            <td style={{ ...mono, textAlign: 'right', padding: '6px 10px', color: C.green, fontWeight: 700 }}>${baseCase.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 32, backgroundColor: `${C.panel}` }}>
        <div>
          <div style={{ ...mono, color: C.green, fontSize: 13, fontWeight: 700 }}>${baseCase.toLocaleString()} / yr</div>
          <div style={{ color: C.textMuted, fontSize: 10 }}>Base-case at full capture (LTL + VC) · 41% uplift vs in-place GPR</div>
        </div>
        <div>
          <div style={{ ...mono, color: C.amber, fontSize: 13, fontWeight: 700 }}>${upsideCase.toLocaleString()} / yr</div>
          <div style={{ color: C.textMuted, fontSize: 10 }}>Upside case including ceiling gap (+CG)</div>
        </div>
        <div>
          <div style={{ ...mono, color: C.textPrimary, fontSize: 13, fontWeight: 700 }}>$1,350,000</div>
          <div style={{ color: C.textMuted, fontSize: 10 }}>Capex to capture VC · 75u × $18K · Reno ROI 52%</div>
        </div>
      </div>
    </div>
  );
}

// ─── Capture Schedule ─────────────────────────────────────────────────────────
const captureRows = [
  { year: 'Y1', ltl: 248880, vc: 174540, concession: -89000, net: 334420, ltlPct: 50, vcPct: 25 },
  { year: 'Y2', ltl: 398208, vc: 523620, concession: -45000, net: 876828, ltlPct: 80, vcPct: 75 },
  { year: 'Y3', ltl: 472872, vc: 698160, concession: -15000, net: 1156032, ltlPct: 95, vcPct: 100 },
  { year: 'Y4', ltl: 497760, vc: 698160, concession: 0, net: 1195920, ltlPct: 100, vcPct: 100 },
  { year: 'Y5', ltl: 497760, vc: 698160, concession: 0, net: 1195920, ltlPct: 100, vcPct: 100 },
];

function CaptureSchedule() {
  const maxNet = 1195920;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ backgroundColor: C.panelAlt, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>PER-YEAR CAPTURE SCHEDULE · 50% TURNOVER · 12 UNITS/MO RENO PACE</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Natural Turnover', 'Accelerated', 'Aggressive'].map((s, i) => (
            <button key={i} style={{ ...mono, fontSize: 9, padding: '2px 7px', backgroundColor: i === 0 ? `${C.cyan}18` : 'transparent', color: i === 0 ? C.cyan : C.textMuted, border: `1px solid ${i === 0 ? C.cyan + '50' : C.border}`, borderRadius: 2, cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: '#0d0d12' }}>
            {['Year', 'LTL Captured', 'LTL %', 'VC Captured', 'VC %', 'Concession Drag', 'Net Uplift', '% of Full'].map(h => (
              <th key={h} style={{ ...mono, textAlign: h === 'Year' ? 'left' : 'right', padding: '5px 10px', color: C.textMuted, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {captureRows.map((r, i) => {
            const barW = Math.round((r.net / maxNet) * 100);
            return (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : `${C.border}20` }}>
                <td style={{ ...mono, padding: '5px 10px', color: C.textPrimary, fontWeight: 700 }}>{r.year}</td>
                <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textMuted }}>${r.ltl.toLocaleString()}</td>
                <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.textMuted }}>{r.ltlPct}%</td>
                <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.cyan }}>${r.vc.toLocaleString()}</td>
                <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.cyan }}>{r.vcPct}%</td>
                <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: r.concession < 0 ? C.red : C.textMuted }}>{r.concession < 0 ? `-$${Math.abs(r.concession).toLocaleString()}` : '—'}</td>
                <td style={{ ...mono, textAlign: 'right', padding: '5px 10px', color: C.green, fontWeight: 600 }}>${r.net.toLocaleString()}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <div style={{ width: 60, height: 6, backgroundColor: C.border, borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ width: `${barW}%`, height: '100%', backgroundColor: C.green, borderRadius: 1 }} />
                    </div>
                    <span style={{ ...mono, fontSize: 9, color: C.textMuted }}>{barW}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, backgroundColor: `${C.green}08`, display: 'flex', gap: 8, alignItems: 'center' }}>
        <ArrowRight size={12} color={C.green} />
        <span style={{ color: C.textMuted, fontSize: 10 }}>These values flow to <span style={{ ...mono, color: C.cyan }}>F9 Assumptions → Revenue → Rent Growth + LTL Capture</span> as Platform-layer values. Y1 blended: <span style={{ ...mono, color: C.green }}>15.6%</span> (market 4.1% + capture 11.5%). Hover any year to see derivation.</span>
      </div>
    </div>
  );
}

// ─── VA Opportunity Score breakdown ──────────────────────────────────────────
function VAScoreBreakdown() {
  const components = [
    { label: 'Upside as % of in-place GPR', value: '41%', normalized: 92, weight: 40, contribution: 36.8, note: '92nd percentile vs submarket', color: C.green },
    { label: 'VC as % of total upside', value: '58%', normalized: 68, weight: 25, contribution: 17.0, note: 'Mid-range — classic value-add', color: C.cyan },
    { label: 'Y1 capture velocity', value: '28%', normalized: 54, weight: 20, contribution: 10.8, note: 'Moderate — 50% turnover + 12u/mo', color: C.cyan },
    { label: 'Renovation ROI', value: '13%', normalized: 38, weight: 15, contribution: 5.7, note: '⚠ Borderline — below typical 18-25%', color: C.amber },
  ];
  const total = components.reduce((s, c) => s + c.contribution, 0);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ backgroundColor: C.panelAlt, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>VA OPPORTUNITY SCORE DERIVATION</span>
        <span style={{ ...mono, color: C.cyan, fontSize: 14, fontWeight: 700 }}>76 <span style={{ fontSize: 10, color: C.textMuted }}>→ feeds F23 → final 81</span></span>
      </div>
      <div style={{ padding: 12 }}>
        {components.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 180, color: C.textMuted, fontSize: 10 }}>{c.label}</div>
            <div style={{ ...mono, color: c.color, width: 40, fontSize: 11, fontWeight: 600 }}>{c.value}</div>
            <div style={{ flex: 1, height: 6, backgroundColor: C.border, borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ width: `${c.normalized}%`, height: '100%', backgroundColor: c.color, borderRadius: 1 }} />
            </div>
            <div style={{ ...mono, color: C.textMuted, width: 60, textAlign: 'right', fontSize: 10 }}>×{c.weight}%</div>
            <div style={{ ...mono, color: c.color, width: 40, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{c.contribution.toFixed(1)}</div>
            <div style={{ color: C.textMuted, fontSize: 9, width: 200 }}>{c.note}</div>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={12} color={C.amber} />
          <span style={{ color: C.amber, fontSize: 10 }}>Reno scope borderline — ROI 13% below typical VA range 18-25%. Consider lighter scope at $14K/unit (+$65 lift) to improve ROI to 20%.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Strategy Comparison ──────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26, strokeW = 4, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={64} height={64} style={{ flexShrink: 0 }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke={`${color}25`} strokeWidth={strokeW} />
      <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={strokeW} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 32 32)" />
      <text x={32} y={36} textAnchor="middle" fill={color} style={{ ...mono, fontSize: 15, fontWeight: 700 }}>{score}</text>
    </svg>
  );
}

const strategies = [
  { name: 'MF VALUE-ADD', detected: true, score: 81, irr: '19.3%', coc: '8.2%', hold: '36mo', gate: 'QUALIFIED', gateColor: C.green, metrics: ['LTL: $145/u', 'VC: $195/u', 'Reno: $18K/u'], color: C.amber },
  { name: 'MF DEEP VALUE-ADD', detected: false, score: 67, irr: '22.1%', coc: '6.8%', hold: '48mo', gate: 'MARGINAL', gateColor: C.amber, metrics: ['Heavy scope +$245/u', 'CapEx: $32K/u', 'ROI 14%'], color: C.cyan },
  { name: 'MF CORE-PLUS', detected: false, score: 54, irr: '13.4%', coc: '9.1%', hold: '60mo', gate: 'REJECTED', gateColor: C.red, metrics: ['LTL only $145/u', 'No reno thesis', 'Low upside'], color: C.textMuted },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export function StrategiesTab() {
  const [activeCompType, setActiveCompType] = useState<'1BR' | '2BR' | '3BR'>('1BR');
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', color: C.textPrimary, fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.panel }}>
        <div>
          <div style={{ ...mono, color: C.textPrimary, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em' }}>STRATEGY INTELLIGENCE</div>
          <div style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>Comp-driven detection · Evidence layer · ProForma bridge</div>
        </div>
        <button style={{ backgroundColor: C.cyan, color: '#0a0a0c', border: 'none', borderRadius: 2, padding: '8px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={12} />
          Apply to ProForma
        </button>
      </div>

      <div style={{ padding: '16px 20px' }}>

        {/* 1. Detection Banner */}
        <div style={{ borderLeft: `3px solid ${C.cyan}`, backgroundColor: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.cyan}`, padding: '12px 16px', marginBottom: 16, borderRadius: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.06em' }}>DETECTED · MULTIFAMILY · VALUE-ADD</span>
                <Pill color={C.amber}>84% CONFIDENCE</Pill>
              </div>
              <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 10 }}>Garden-style · Class B · 2008 Vintage · 186 Units · Bell Tech Corridor, Austin TX</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {[
                  { label: 'Loss-to-Lease', value: '12%', threshold: '(>8% thr)', color: C.green },
                  { label: 'PCS Rank', value: '#28 of 41', threshold: '(btm half)', color: C.amber },
                  { label: 'Ops Score', value: '52', threshold: '(<60 thr)', color: C.red },
                  { label: 'Physical Occ', value: '89.1%', threshold: '(<94% stab)', color: C.amber },
                  { label: 'In-place GPR', value: '$2.9M', threshold: '41% below stab', color: C.cyan },
                ].map((s, i) => (
                  <div key={i} style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 2 }}>
                    <span style={{ color: C.textMuted, fontSize: 10 }}>{s.label}</span>
                    <span style={{ ...mono, color: s.color, fontSize: 11, fontWeight: 600 }}>{s.value}</span>
                    <span style={{ ...mono, color: C.textDim, fontSize: 9 }}>{s.threshold}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 16, flexShrink: 0 }}>
              <button style={{ ...mono, fontSize: 10, padding: '5px 10px', backgroundColor: `${C.cyan}15`, color: C.cyan, border: `1px solid ${C.cyan}40`, borderRadius: 2, cursor: 'pointer' }}>Confirm</button>
              <button style={{ ...mono, fontSize: 10, padding: '5px 10px', backgroundColor: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 2, cursor: 'pointer' }}>Adjust</button>
              <button style={{ ...mono, fontSize: 10, padding: '5px 10px', backgroundColor: 'transparent', color: C.red, border: `1px solid ${C.red}40`, borderRadius: 2, cursor: 'pointer' }}>Override</button>
            </div>
          </div>
        </div>

        {/* 2. Sub-Strategy Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {strategies.map((s, i) => (
            <div key={i} style={{ border: `1px solid ${s.detected ? C.amber + '60' : C.border}`, borderTop: `3px solid ${s.detected ? C.amber : C.border}`, backgroundColor: C.panel, padding: 14, borderRadius: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.08em' }}>{s.name}</div>
                  {s.detected && <Pill color={C.amber}>⚡ DETECTED</Pill>}
                </div>
                <ScoreRing score={s.score} color={s.color} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[['IRR', s.irr], ['CoC', s.coc], ['Hold', s.hold]].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ ...mono, fontSize: 13, color: C.textPrimary, fontWeight: 700 }}>{val}</div>
                    <div style={{ color: C.textMuted, fontSize: 9 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginBottom: 8 }}>
                {s.metrics.map((m, j) => (
                  <div key={j} style={{ ...mono, color: C.textMuted, fontSize: 9, marginBottom: 2 }}>· {m}</div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...mono, fontSize: 9, color: C.textMuted }}>GATE</span>
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: s.gateColor }}>{s.gate}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 3. Evidence Layer — Why This Strategy Wins */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
          <div onClick={() => setEvidenceOpen(!evidenceOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: C.panelAlt, cursor: 'pointer', borderBottom: evidenceOpen ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 16, backgroundColor: C.cyan, borderRadius: 1 }} />
              <span style={{ ...mono, color: C.cyan, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>EVIDENCE LAYER — WHY THIS STRATEGY WINS</span>
              <Pill color={C.cyan}>4 PANELS</Pill>
            </div>
            {evidenceOpen ? <ChevronDown size={14} color={C.textMuted} /> : <ChevronRight size={14} color={C.textMuted} />}
          </div>

          {evidenceOpen && (
            <div style={{ padding: 16 }}>

              {/* Panel 1 — Comp Stratification */}
              <SectionHeader label="PANEL 1 · COMP STRATIFICATION — TIER-TAGGED COMPS" />
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['1BR', '2BR', '3BR'] as const).map(t => (
                  <button key={t} onClick={() => setActiveCompType(t)} style={{ ...mono, fontSize: 10, padding: '4px 10px', backgroundColor: activeCompType === t ? `${C.cyan}15` : 'transparent', color: activeCompType === t ? C.cyan : C.textMuted, border: `1px solid ${activeCompType === t ? C.cyan + '50' : C.border}`, borderRadius: 2, cursor: 'pointer' }}>{t}</button>
                ))}
                <span style={{ ...mono, fontSize: 9, color: C.textMuted, marginLeft: 8, alignSelf: 'center' }}>Tier A = unrenovated ±5yr · Tier B = renovated ±5yr · Tier C = top-quartile ceiling</span>
              </div>
              <CompStratTable type={activeCompType} />

              {/* Panel 2 — Rent Ladder */}
              <SectionHeader label="PANEL 2 · THE THREE-GAP RENT LADDER" accent={C.cyan} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {(['1BR', '2BR', '3BR'] as const).map(t => <RentLadder key={t} type={t} />)}
              </div>

              {/* Panel 3 — Portfolio Impact */}
              <SectionHeader label="PANEL 3 · ANNUALIZED UPLIFT AT FULL CAPTURE" accent={C.green} />
              <PortfolioImpact />

              {/* Panel 4 — Capture Schedule */}
              <SectionHeader label="PANEL 4 · PER-YEAR CAPTURE SCHEDULE → PROFORMA INPUTS" accent={C.cyan} />
              <CaptureSchedule />

              {/* VA Score Derivation */}
              <SectionHeader label="VA OPPORTUNITY SCORE DERIVATION" accent={C.amber} />
              <VAScoreBreakdown />

            </div>
          )}
        </div>

        {/* 4. Execution Plan */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
          <div onClick={() => setPlanOpen(!planOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: C.panelAlt, cursor: 'pointer', borderBottom: planOpen ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 16, backgroundColor: C.amber, borderRadius: 1 }} />
              <span style={{ ...mono, color: C.amber, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>EXECUTION PLAN</span>
            </div>
            {planOpen ? <ChevronDown size={14} color={C.textMuted} /> : <ChevronRight size={14} color={C.textMuted} />}
          </div>
          {planOpen && (
            <div style={{ padding: 16 }}>
              {/* Entry */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 24 }}>
                <div><span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>ENTRY</span><br /><span style={{ ...mono, color: C.green, fontSize: 11 }}>Q2 2026 · Ceiling $42.8M · Bridge-to-perm 65% LTC</span></div>
                <div><span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>BASIS</span><br /><span style={{ ...mono, color: C.textPrimary, fontSize: 11 }}>$230,100/unit · 6.1% going-in cap</span></div>
              </div>
              {/* Phases */}
              {[
                { phase: 'M1–M3', label: 'STABILIZE OPS', actions: 'Replace PM · audit leases · stop concessions', color: C.cyan },
                { phase: 'M4–M9', label: 'LTL CAPTURE', actions: 'Renew all units at market · 12u/mo reno start · $145 LTL × turns', color: C.cyan },
                { phase: 'M10–24', label: 'RENO CAPTURE', actions: '12u/mo reno pace · $18K/unit · VC $195/unit post-reno', color: C.amber },
                { phase: 'M25–36', label: 'STABILIZED / EXIT PREP', actions: 'Reno complete · Y3 NOI $2.11M · Stage exit · Broker outreach', color: C.green },
              ].map((p, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${p.color}`, paddingLeft: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ ...mono, color: C.textMuted, fontSize: 10, width: 55 }}>{p.phase}</span>
                  <span style={{ ...mono, color: p.color, fontSize: 10, fontWeight: 700, width: 130 }}>{p.label}</span>
                  <span style={{ color: C.textMuted, fontSize: 10 }}>{p.actions}</span>
                </div>
              ))}
              {/* Exit */}
              <div style={{ border: `1px solid ${C.green}40`, backgroundColor: `${C.green}08`, borderRadius: 2, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const }}>
                  {[['EXIT', 'Q4 2028'], ['BUYER', 'Institutional — Cortland / Blackstone / Morgan Properties'], ['EXIT CAP', '5.25%'], ['LP IRR', '18.4–21.7%'], ['EM', '1.86–2.14×']].map(([l, v]) => (
                    <div key={l}><div style={{ ...mono, color: C.textMuted, fontSize: 9 }}>{l}</div><div style={{ ...mono, color: C.green, fontSize: 11, fontWeight: 700 }}>{v}</div></div>
                  ))}
                </div>
              </div>
              {/* Pivot */}
              <div style={{ border: `1px solid ${C.purple}50`, backgroundColor: `${C.purple}08`, borderRadius: 2, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Pill color={C.purple}>PIVOT CONDITION</Pill>
                  <span style={{ color: C.textMuted, fontSize: 10, marginLeft: 8 }}>If upzone Ord 27-156 passes (65% prob Q3 2026) → BTS pivot, IRR 26%</span>
                </div>
                <button style={{ ...mono, fontSize: 10, padding: '4px 10px', backgroundColor: `${C.purple}20`, color: C.purple, border: `1px solid ${C.purple}50`, borderRadius: 2, cursor: 'pointer' }}>Pivot Now</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
