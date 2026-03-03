import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Percent,
  Building2,
  Target,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lock,
  DollarSign,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { useDealModule } from '../../../contexts/DealModuleContext';

interface ExitDrivesCapitalProps {
  deal?: any;
  dealId?: string;
  financial?: any;
  capitalStructure?: any;
  dealStatus?: 'pipeline' | 'owned';
}

const QUARTERS = ['Q1 25','Q2 25','Q3 25','Q4 25','Q1 26','Q2 26','Q3 26','Q4 26','Q1 27','Q2 27','Q3 27','Q4 27','Q1 28','Q2 28'];

const SUPPLY_DELIVERING = [0, 0, 185, 0, 0, 0, 350, 280, 0, 185, 0, 0, 0, 0];

const RENT_GROWTH = [8.7, 7.8, 6.2, 5.4, 4.8, 4.1, 2.1, 0.8, -0.4, -1.2, 0.3, 1.1, 2.0, 2.8];

const RATES = [4.35, 4.28, 4.15, 4.05, 3.92, 3.78, 3.65, 3.55, 3.50, 3.48, 3.45, 3.50, 3.55, 3.60];

const WINDOW_START = 4;
const WINDOW_END = 6;

const computeExitScore = (rentG: number, rate: number, supply: number): number => {
  const rentScore = Math.max(0, Math.min(100, (rentG / 10) * 100)) * 0.40;
  const rateScore = Math.max(0, Math.min(100, ((5.0 - rate) / 2.0) * 100)) * 0.35;
  const supplyScore = Math.max(0, Math.min(100, ((400 - supply) / 400) * 100)) * 0.25;
  return Math.round(Math.max(0, Math.min(100, rentScore + rateScore + supplyScore)));
};

const EXIT_SCORES = QUARTERS.map((_, i) =>
  computeExitScore(RENT_GROWTH[i], RATES[i], SUPPLY_DELIVERING[i])
);

const SCENARIOS = [
  {
    label: 'Early Exit',
    quarter: 'Q4 2025',
    qIdx: 3,
    exitCap: 4.85,
    noi: 2840000,
    grossValue: 58556701,
    prepayPenalty: 345600,
    netProceeds: 38811101,
    irr: 25.1,
    multiple: 3.85,
    debtMatch: '3yr Bridge → Exit at Month 30',
    equityNote: 'Below promote threshold for some waterfalls',
    color: 'amber' as const,
    colorHex: '#f59e0b',
    risk: 'Prepay penalty still at 1.8% ($345K). Rates haven\'t dropped yet.',
  },
  {
    label: 'Optimal Window',
    quarter: 'Q3 2026',
    qIdx: 6,
    exitCap: 4.72,
    noi: 2960000,
    grossValue: 62711864,
    prepayPenalty: 0,
    netProceeds: 43511864,
    irr: 28.4,
    multiple: 4.30,
    debtMatch: '5yr Fixed → Exit at Year 3.5 (no penalty after Month 36)',
    equityNote: 'Clears 20% pref + first promote tier. GP effective ownership ~32%.',
    color: 'emerald' as const,
    colorHex: '#10b981',
    risk: 'Must close before 350-unit competitor delivers Q3 2026.',
  },
  {
    label: 'Late Exit',
    quarter: 'Q2 2027',
    qIdx: 9,
    exitCap: 5.25,
    noi: 2890000,
    grossValue: 55047619,
    prepayPenalty: 0,
    netProceeds: 35847619,
    irr: 21.2,
    multiple: 3.52,
    debtMatch: '5yr Fixed → Early payoff OK but left money on table',
    equityNote: 'Below top promote tier. GP effective ownership ~24%.',
    color: 'red' as const,
    colorHex: '#ef4444',
    risk: '630 new units delivered. Rent growth negative. Cap rates expanding.',
  },
];

const MISMATCH_WARNINGS = [
  { title: '7yr Fixed Agency', reason: 'Paying for 7 years of rate lock but exiting at 3.5 years. Yield maintenance penalty at exit would cost ~$420K.' },
  { title: '3yr Bridge (no extension)', reason: 'If exit window shifts to Q1 2027, loan matures before sale. Forced refi at potentially higher rates.' },
  { title: 'Floating Rate (no cap)', reason: 'If rates reverse course and rise 100bps, annual debt service increases $337K, compressing CoC by 3.7%.' },
];

const MONITOR_TRIGGERS = {
  accelerate: [
    'Rent growth exceeds 6% for 2 consecutive quarters',
    '10yr Treasury drops below 3.50%',
    'Competitor project delayed 6+ months',
  ],
  delay: [
    'Rent growth turns negative before Q1 2026',
    'Fed pauses rate cuts or reverses course',
    'New 500+ unit project announced in submarket',
  ],
};

const fmtM = (v: number): string => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const ExitDrivesCapital: React.FC<ExitDrivesCapitalProps> = ({
  deal,
  dealId,
  financial: financialProp,
  capitalStructure: capitalStructureProp,
  dealStatus = 'pipeline',
}) => {
  const ctx = useDealModule();
  const financial = financialProp || ctx.financial;
  const capitalStructure = capitalStructureProp || ctx.capitalStructure;

  const [selectedScenario, setSelectedScenario] = useState(1);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    whyStructure: false,
    mismatch: false,
    monitor: false,
  });

  const sel = SCENARIOS[selectedScenario];

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const chartW = 900;
  const chartH = 320;
  const padL = 56;
  const padR = 56;
  const padT = 40;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const barW = innerW / QUARTERS.length;

  const maxSupply = Math.max(...SUPPLY_DELIVERING) * 1.3;
  const rentMin = Math.min(...RENT_GROWTH) - 1.5;
  const rentMax = Math.max(...RENT_GROWTH) + 1.5;
  const rateMin = Math.min(...RATES) - 0.3;
  const rateMax = Math.max(...RATES) + 0.3;

  const scaleY = (val: number, min: number, max: number) =>
    padT + innerH - ((val - min) / (max - min)) * innerH;
  const scaleX = (i: number) => padL + i * barW + barW / 2;

  const rentPath = RENT_GROWTH.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${scaleX(i).toFixed(1)},${scaleY(v, rentMin, rentMax).toFixed(1)}`
  ).join(' ');

  const ratePath = RATES.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${scaleX(i).toFixed(1)},${scaleY(v, rateMin, rateMax).toFixed(1)}`
  ).join(' ');

  const scoreMin = 0;
  const scoreMax = 100;
  const scorePath = EXIT_SCORES.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${scaleX(i).toFixed(1)},${scaleY(v, scoreMin, scoreMax).toFixed(1)}`
  ).join(' ');

  const peakScore = Math.max(...EXIT_SCORES);
  const peakIdx = EXIT_SCORES.indexOf(peakScore);

  const rentSparkline = (data: number[], w: number, h: number, color: string) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return (
      <svg width={w} height={h} className="mt-1">
        <path d={points} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
    );
  };

  const gaugeScore = useMemo(() => EXIT_SCORES[sel.qIdx], [sel.qIdx]);

  return (
    <div className="space-y-6">
      <div className="bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold text-[#0f172a]">Exit & Capital Overview</h2>
            <p className="text-[13px] text-[#64748b] mt-1">
              Three factors define the optimal exit window — rent growth, interest rates, and supply pipeline
            </p>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-medium text-[#64748b]">Optimal Window</div>
            <div className="text-2xl font-extrabold text-emerald-600">Q3 2026</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-4">
          Three-Factor Convergence Chart
        </h3>
        <div className="flex justify-center overflow-x-auto">
          <svg width={chartW} height={chartH + 50} className="block">
            <rect
              x={padL + WINDOW_START * barW}
              y={padT - 6}
              width={(WINDOW_END - WINDOW_START + 1) * barW}
              height={innerH + 12}
              fill="rgba(16,185,129,0.08)"
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="6,4"
              rx={6}
            />
            <text
              x={padL + ((WINDOW_START + WINDOW_END + 1) / 2) * barW}
              y={padT - 12}
              textAnchor="middle"
              fill="#10b981"
              fontSize={11}
              fontWeight={700}
            >
              OPTIMAL WINDOW
            </text>

            {SUPPLY_DELIVERING.map((v, i) => {
              if (v === 0) return null;
              const maxH = innerH * 0.6;
              const h = (v / maxSupply) * maxH;
              return (
                <g key={`bar-${i}`}>
                  <rect
                    x={scaleX(i) - barW * 0.28}
                    y={padT + innerH - h}
                    width={barW * 0.56}
                    height={h}
                    fill="rgba(245,158,11,0.2)"
                    stroke="#f59e0b"
                    strokeWidth={1}
                    rx={3}
                  />
                  <text
                    x={scaleX(i)}
                    y={padT + innerH - h - 6}
                    textAnchor="middle"
                    fill="#f59e0b"
                    fontSize={10}
                    fontWeight={600}
                  >
                    {v}
                  </text>
                </g>
              );
            })}

            <path d={rentPath} fill="none" stroke="#10b981" strokeWidth={2} />
            {RENT_GROWTH.map((v, i) => (
              <circle
                key={`rg-${i}`}
                cx={scaleX(i)}
                cy={scaleY(v, rentMin, rentMax)}
                r={3.5}
                fill={v >= 0 ? '#10b981' : '#ef4444'}
              />
            ))}

            <path d={ratePath} fill="none" stroke="#3b82f6" strokeWidth={2} />
            {RATES.map((v, i) => (
              <circle
                key={`rt-${i}`}
                cx={scaleX(i)}
                cy={scaleY(v, rateMin, rateMax)}
                r={3.5}
                fill="#3b82f6"
              />
            ))}

            <path d={scorePath} fill="none" stroke="#059669" strokeWidth={3} />
            {EXIT_SCORES.map((v, i) => (
              <circle
                key={`sc-${i}`}
                cx={scaleX(i)}
                cy={scaleY(v, scoreMin, scoreMax)}
                r={i === peakIdx ? 5 : 3}
                fill="#059669"
              />
            ))}
            <text
              x={scaleX(peakIdx)}
              y={scaleY(peakScore, scoreMin, scoreMax) - 10}
              textAnchor="middle"
              fill="#059669"
              fontSize={11}
              fontWeight={700}
            >
              {peakScore}
            </text>

            <line
              x1={padL}
              y1={scaleY(0, rentMin, rentMax)}
              x2={chartW - padR}
              y2={scaleY(0, rentMin, rentMax)}
              stroke="#94a3b8"
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
            <text
              x={padL - 6}
              y={scaleY(0, rentMin, rentMax) + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize={9}
            >
              0%
            </text>

            {SCENARIOS.map((s, i) => (
              <line
                key={`sm-${i}`}
                x1={scaleX(s.qIdx)}
                y1={padT}
                x2={scaleX(s.qIdx)}
                y2={padT + innerH}
                stroke={s.colorHex}
                strokeWidth={1.5}
                strokeDasharray={i === 1 ? 'none' : '5,3'}
                opacity={selectedScenario === i ? 1 : 0.4}
              />
            ))}

            <text x={padL - 6} y={padT + 4} textAnchor="end" fill="#64748b" fontSize={9}>
              {rentMax.toFixed(0)}%
            </text>
            <text x={padL - 6} y={padT + innerH + 4} textAnchor="end" fill="#64748b" fontSize={9}>
              {rentMin.toFixed(0)}%
            </text>

            <text x={chartW - padR + 6} y={padT + 4} textAnchor="start" fill="#64748b" fontSize={9}>
              {Math.round(maxSupply)}
            </text>
            <text x={chartW - padR + 6} y={padT + innerH + 4} textAnchor="start" fill="#64748b" fontSize={9}>
              0
            </text>

            {QUARTERS.map((q, i) => (
              <text
                key={q}
                x={scaleX(i)}
                y={padT + innerH + 20}
                textAnchor="middle"
                fill="#64748b"
                fontSize={9}
              >
                {q}
              </text>
            ))}

            <g transform={`translate(${padL + 8}, ${padT + innerH + 32})`}>
              <line x1={0} y1={6} x2={16} y2={6} stroke="#10b981" strokeWidth={2} />
              <circle cx={8} cy={6} r={3} fill="#10b981" />
              <text x={22} y={10} fill="#64748b" fontSize={10}>Rent Growth %</text>

              <line x1={120} y1={6} x2={136} y2={6} stroke="#3b82f6" strokeWidth={2} />
              <circle cx={128} cy={6} r={3} fill="#3b82f6" />
              <text x={142} y={10} fill="#64748b" fontSize={10}>10yr Treasury %</text>

              <rect x={270} y={1} width={12} height={10} fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth={1} rx={2} />
              <text x={288} y={10} fill="#64748b" fontSize={10}>Supply (units)</text>

              <line x1={400} y1={6} x2={416} y2={6} stroke="#059669" strokeWidth={3} />
              <text x={422} y={10} fill="#64748b" fontSize={10}>Exit Score</text>

              <rect x={510} y={0} width={12} height={12} fill="rgba(16,185,129,0.08)" stroke="#10b981" strokeWidth={1} strokeDasharray="3,2" rx={2} />
              <text x={528} y={10} fill="#64748b" fontSize={10}>Optimal Window</text>
            </g>
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <FactorCard
          icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
          iconBg="bg-emerald-50"
          title="Rent Growth"
          value={`${RENT_GROWTH[5]}%`}
          label="Current YoY"
          score={computeExitScore(RENT_GROWTH[5], 0, 0) / 0.4}
          sparkline={rentSparkline(RENT_GROWTH, 80, 24, '#10b981')}
          trend={RENT_GROWTH[5] > RENT_GROWTH[4] ? 'up' : 'down'}
        />
        <FactorCard
          icon={<Percent className="w-6 h-6 text-blue-600" />}
          iconBg="bg-blue-50"
          title="Interest Rates"
          value={`${RATES[5]}%`}
          label="10yr Treasury"
          score={Math.round(Math.max(0, Math.min(100, ((5.0 - RATES[5]) / 2.0) * 100)))}
          sparkline={rentSparkline(RATES, 80, 24, '#3b82f6')}
          trend="down"
        />
        <FactorCard
          icon={<Building2 className="w-6 h-6 text-amber-600" />}
          iconBg="bg-amber-50"
          title="Supply Pipeline"
          value="1,000"
          label="Units delivering"
          score={Math.round(Math.max(0, Math.min(100, ((400 - 185) / 400) * 100)))}
          sparkline={rentSparkline(SUPPLY_DELIVERING, 80, 24, '#f59e0b')}
          trend="up"
        />
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#64748b]">Exit Score</div>
              <div className="text-2xl font-bold text-[#0f172a]">{gaugeScore}</div>
              <div className="text-[11px] text-[#64748b]">/ 100</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${gaugeScore}%`,
                  background: gaugeScore >= 70 ? '#10b981' : gaugeScore >= 40 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[#94a3b8]">Weak</span>
              <span className="text-[10px] text-[#94a3b8]">Strong</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-4">
          Exit Scenarios
        </h3>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {SCENARIOS.map((s, i) => {
            const isSelected = selectedScenario === i;
            const borderColor = s.color === 'amber' ? 'border-amber-400' : s.color === 'emerald' ? 'border-emerald-400' : 'border-red-400';
            const bgColor = s.color === 'amber' ? 'bg-amber-50' : s.color === 'emerald' ? 'bg-emerald-50' : 'bg-red-50';
            const textColor = s.color === 'amber' ? 'text-amber-600' : s.color === 'emerald' ? 'text-emerald-600' : 'text-red-600';
            return (
              <button
                key={i}
                onClick={() => setSelectedScenario(i)}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? `${borderColor} ${bgColor}`
                    : 'border-[#e2e8f0] bg-white hover:border-gray-300'
                }`}
              >
                <div className={`text-[11px] font-bold uppercase tracking-wider ${textColor}`}>
                  {s.label}
                </div>
                <div className="text-xl font-extrabold text-[#0f172a] mt-1">{s.quarter}</div>
                <div className="text-[13px] text-[#64748b] mt-1">
                  {s.irr}% IRR · {s.multiple}x
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-4">
            <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">
              Financial Outcome
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricBlock label="Exit Cap Rate" value={`${sel.exitCap}%`} />
              <MetricBlock label="Gross Value" value={fmtM(sel.grossValue)} />
              <MetricBlock label="Net Proceeds" value={fmtM(sel.netProceeds)} highlight />
              <MetricBlock
                label="Prepay Penalty"
                value={sel.prepayPenalty ? fmtM(sel.prepayPenalty) : 'None'}
                good={!sel.prepayPenalty}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <div className="flex-1 rounded-lg p-3 text-center" style={{ backgroundColor: `${sel.colorHex}10` }}>
                <div className="text-2xl font-extrabold" style={{ color: sel.colorHex }}>{sel.irr}%</div>
                <div className="text-[11px] text-[#64748b]">IRR</div>
              </div>
              <div className="flex-1 rounded-lg p-3 text-center" style={{ backgroundColor: `${sel.colorHex}10` }}>
                <div className="text-2xl font-extrabold" style={{ color: sel.colorHex }}>{sel.multiple}x</div>
                <div className="text-[11px] text-[#64748b]">Equity Multiple</div>
              </div>
            </div>
          </div>

          <div className="bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-4">
            <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">
              Capital Structure Implication
            </div>
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Lock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[12px] font-bold text-blue-600">DEBT MATCH</span>
              </div>
              <p className="text-[13px] text-[#334155] leading-relaxed">{sel.debtMatch}</p>
            </div>
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-[12px] font-bold text-purple-600">EQUITY IMPACT</span>
              </div>
              <p className="text-[13px] text-[#334155] leading-relaxed">{sel.equityNote}</p>
            </div>
            <div className="rounded-lg p-3 border" style={{ backgroundColor: `${sel.colorHex}08`, borderColor: `${sel.colorHex}30` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3" style={{ color: sel.colorHex }} />
                <span className="text-[11px] font-bold" style={{ color: sel.colorHex }}>KEY RISK</span>
              </div>
              <p className="text-[12px] text-[#475569] leading-relaxed">{sel.risk}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-4">
          Causal Chain
        </h3>
        <div className="flex items-center justify-center gap-0 flex-wrap">
          <CausalBox color="text-amber-600" bg="bg-amber-50" border="border-amber-200" label="High Rent Growth" sublabel="+ Low Supply" />
          <ArrowRight className="w-5 h-5 text-[#94a3b8] mx-1 flex-shrink-0" />
          <CausalBox color="text-blue-600" bg="bg-blue-50" border="border-blue-200" label="Low Rates" sublabel="Rates falling" />
          <ArrowRight className="w-5 h-5 text-[#94a3b8] mx-1 flex-shrink-0" />
          <CausalBox color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-200" label="Exit Q3 2026" sublabel="3.5yr hold" />
          <ArrowRight className="w-5 h-5 text-[#94a3b8] mx-1 flex-shrink-0" />
          <CausalBox color="text-blue-600" bg="bg-blue-50" border="border-blue-200" label="5yr Fixed Debt" sublabel="Penalty-free @ Mo 36" />
          <ArrowRight className="w-5 h-5 text-[#94a3b8] mx-1 flex-shrink-0" />
          <CausalBox color="text-purple-600" bg="bg-purple-50" border="border-purple-200" label="20% Pref + 2-Tier" sublabel="GP promotes @ 4.3x" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider mb-4">
          Capital Stack Summary
        </h3>
        <div className="flex rounded-lg overflow-hidden h-10 border border-[#e2e8f0]">
          <div className="bg-blue-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '65%' }}>
            Senior Debt 65%
          </div>
          <div className="bg-purple-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '28%' }}>
            LP Equity 28%
          </div>
          <div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '7%' }}>
            GP 7%
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div className="text-center">
            <div className="text-sm font-semibold text-[#0f172a]">$18.5M</div>
            <div className="text-[11px] text-[#64748b]">5yr Fixed, 4.25%</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-[#0f172a]">$8.0M</div>
            <div className="text-[11px] text-[#64748b]">20% Pref, 80/20 split</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-[#0f172a]">$2.0M</div>
            <div className="text-[11px] text-[#64748b]">Co-invest + promote</div>
          </div>
        </div>
      </div>

      <CollapsibleSection
        title="Why This Structure"
        icon={<Lock className="w-4 h-4 text-blue-500" />}
        expanded={expandedSections.whyStructure}
        onToggle={() => toggleSection('whyStructure')}
      >
        <div className="space-y-3">
          <ReasonRow
            icon={<Lock className="w-4 h-4 text-blue-500" />}
            title="5yr fixed-rate agency debt"
            reason="Prepayment penalty burns off at Month 36 → exit at Month 42 is penalty-free. Shorter term (3yr bridge) would have saved 15bps but carried refi risk if window shifts."
          />
          <ReasonRow
            icon={<DollarSign className="w-4 h-4 text-purple-500" />}
            title="20% pref with 2-tier promote"
            reason="Optimal window projects 4.3x multiple, which clears both promote hurdles. Earlier exit misses second tier; later exit risks dropping below first tier due to cap rate expansion."
          />
          <ReasonRow
            icon={<Target className="w-4 h-4 text-emerald-500" />}
            title="65% LTV (conservative)"
            reason="Lower leverage preserves DSCR cushion during value-add phase. Can refinance into higher LTV agency product once stabilized if hold is extended."
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Mismatch Warnings"
        icon={<ShieldAlert className="w-4 h-4 text-red-500" />}
        expanded={expandedSections.mismatch}
        onToggle={() => toggleSection('mismatch')}
        accentColor="red"
      >
        <div className="space-y-3">
          {MISMATCH_WARNINGS.map((w, i) => (
            <div key={i} className="flex items-start gap-3 bg-red-50 rounded-lg p-3 border border-red-100">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-red-700">{w.title}</div>
                <div className="text-[12px] text-red-600 mt-0.5 leading-relaxed">{w.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Monitoring Triggers"
        icon={<Activity className="w-4 h-4 text-blue-500" />}
        expanded={expandedSections.monitor}
        onToggle={() => toggleSection('monitor')}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2">
              Accelerate Exit If...
            </div>
            {MONITOR_TRIGGERS.accelerate.map((t, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span className="text-[13px] text-[#334155]">{t}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-2">
              Delay Exit If...
            </div>
            {MONITOR_TRIGGERS.delay.map((t, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <span className="text-[13px] text-[#334155]">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};

const FactorCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string;
  label: string;
  score: number;
  sparkline: React.ReactNode;
  trend: 'up' | 'down';
}> = ({ icon, iconBg, title, value, label, score, sparkline, trend }) => (
  <div className="bg-white rounded-lg border border-[#e2e8f0] p-4">
    <div className="flex items-start gap-3">
      <div className={`w-12 h-12 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#64748b]">{title}</div>
        <div className="text-2xl font-bold text-[#0f172a]">{value}</div>
        <div className="text-[11px] text-[#64748b]">{label}</div>
      </div>
    </div>
    <div className="flex items-center justify-between mt-2">
      <div className="text-[11px] text-[#64748b]">
        Score: <span className="font-semibold text-[#0f172a]">{Math.round(score)}</span>/100
      </div>
      {sparkline}
    </div>
  </div>
);

const MetricBlock: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
  good?: boolean;
}> = ({ label, value, highlight, good }) => (
  <div>
    <div className="text-[11px] text-[#64748b]">{label}</div>
    <div className={`text-base font-bold ${
      highlight ? 'text-emerald-600' : good ? 'text-emerald-600' : 'text-[#0f172a]'
    }`}>
      {value}
    </div>
  </div>
);

const CausalBox: React.FC<{
  color: string;
  bg: string;
  border: string;
  label: string;
  sublabel: string;
}> = ({ color, bg, border, label, sublabel }) => (
  <div className={`${bg} ${border} border rounded-lg px-4 py-2.5 text-center min-w-[120px]`}>
    <div className={`text-[12px] font-bold ${color}`}>{label}</div>
    <div className="text-[10px] text-[#64748b] mt-0.5">{sublabel}</div>
  </div>
);

const ReasonRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  reason: string;
}> = ({ icon, title, reason }) => (
  <div className="flex items-start gap-3 bg-[#f8fafc] rounded-lg p-3 border border-[#e2e8f0]">
    <div className="mt-0.5 flex-shrink-0">{icon}</div>
    <div>
      <div className="text-sm font-semibold text-[#0f172a]">{title}</div>
      <div className="text-[12px] text-[#475569] mt-0.5 leading-relaxed">{reason}</div>
    </div>
  </div>
);

const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  accentColor?: string;
  children: React.ReactNode;
}> = ({ title, icon, expanded, onToggle, accentColor, children }) => (
  <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-[#f8fafc] transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-[#0f172a] uppercase tracking-wider">{title}</span>
      </div>
      {expanded ? (
        <ChevronUp className="w-4 h-4 text-[#64748b]" />
      ) : (
        <ChevronDown className="w-4 h-4 text-[#64748b]" />
      )}
    </button>
    {expanded && <div className="px-4 pb-4">{children}</div>}
  </div>
);

export default ExitDrivesCapital;
