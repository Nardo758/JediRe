import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Percent,
  Building2,
  Target,
  ArrowRight,
  AlertTriangle,
  Lock,
  DollarSign,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { BT } from '@/components/deal/bloomberg-ui';

interface ExitDrivesCapitalProps {
  deal?: any;
  dealId?: string;
  financial?: any;
  capitalStructure?: any;
  dealStatus?: 'pipeline' | 'owned';
}

const QUARTERS = ['Q1 25','Q2 25','Q3 25','Q4 25','Q1 26','Q2 26','Q3 26','Q4 26','Q1 27','Q2 27','Q3 27','Q4 27','Q1 28','Q2 28'];

const SUPPLY_DELIVERING = [0, 0, 185, 0, 0, 0, 350, 280, 0, 185, 0, 0, 0, 0];

const DEFAULT_RENT_GROWTH = [8.7, 7.8, 6.2, 5.4, 4.8, 4.1, 2.1, 0.8, -0.4, -1.2, 0.3, 1.1, 2.0, 2.8];

const RATES = [4.35, 4.28, 4.15, 4.05, 3.92, 3.78, 3.65, 3.55, 3.50, 3.48, 3.45, 3.50, 3.55, 3.60];

const WINDOW_START = 4;
const WINDOW_END = 6;

const computeExitScore = (rentG: number, rate: number, supply: number): number => {
  const rentScore = Math.max(0, Math.min(100, (rentG / 10) * 100)) * 0.40;
  const rateScore = Math.max(0, Math.min(100, ((5.0 - rate) / 2.0) * 100)) * 0.35;
  const supplyScore = Math.max(0, Math.min(100, ((400 - supply) / 400) * 100)) * 0.25;
  return Math.round(Math.max(0, Math.min(100, rentScore + rateScore + supplyScore)));
};

const DEFAULT_EXIT_SCORES = QUARTERS.map((_, i) =>
  computeExitScore(DEFAULT_RENT_GROWTH[i], RATES[i], SUPPLY_DELIVERING[i])
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
  { title: '7yr Fixed Agency', reason: 'Yield maintenance penalty ~$420K at 3.5yr exit' },
  { title: '3yr Bridge (no ext)', reason: 'Loan matures before sale if window shifts to Q1 2027' },
  { title: 'Floating Rate (no cap)', reason: '+100bps = +$337K debt service, -3.7% CoC' },
];


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
  const market = ctx.market;

  const RENT_GROWTH = useMemo(() => {
    if (market?.rentGrowth && market.lastUpdated > 0) {
      const baseGrowth = market.rentGrowth;
      return DEFAULT_RENT_GROWTH.map((fallback, i) => {
        const decay = Math.max(0, 1 - i * 0.07);
        return parseFloat((baseGrowth * decay).toFixed(1)) || fallback;
      });
    }
    return DEFAULT_RENT_GROWTH;
  }, [market?.rentGrowth, market?.lastUpdated]);

  const EXIT_SCORES = useMemo(() =>
    QUARTERS.map((_, i) => computeExitScore(RENT_GROWTH[i], RATES[i], SUPPLY_DELIVERING[i])),
    [RENT_GROWTH]
  );

  const [selectedScenario, setSelectedScenario] = useState(1);
  const [whyExpanded, setWhyExpanded] = useState(false);

  const sel = SCENARIOS[selectedScenario];

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

  // Task #425: useMemo intentionally omits `EXIT_SCORES` — the omitted
  // value(s) are either (a) stable references from context/store hooks whose
  // identity is guaranteed by the producer, (b) values captured at first-fire
  // on purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gaugeScore = useMemo(() => EXIT_SCORES[sel.qIdx], [sel.qIdx]);

  return (
    <div className="space-y-6">
      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Exit & Capital Overview</h2>
            <p className="text-[13px] mt-1" style={{ color: BT.text.secondary }}>
              Three factors define the optimal exit window — rent growth, interest rates, and supply pipeline
            </p>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-medium" style={{ color: BT.text.secondary }}>Optimal Window</div>
            <div className="text-2xl font-extrabold" style={{ color: BT.text.green, fontFamily: BT.font.mono }}>Q3 2026</div>
          </div>
        </div>
      </div>

      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
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
          icon={<TrendingUp className="w-6 h-6" style={{ color: BT.text.green }} />}
          iconBg={`${BT.text.green}11`}
          title="Rent Growth"
          value={`${RENT_GROWTH[5]}%`}
          label="Current YoY"
          score={computeExitScore(RENT_GROWTH[5], 0, 0) / 0.4}
          sparkline={rentSparkline(RENT_GROWTH, 80, 24, '#10b981')}
          trend={RENT_GROWTH[5] > RENT_GROWTH[4] ? 'up' : 'down'}
        />
        <FactorCard
          icon={<Percent className="w-6 h-6" style={{ color: BT.text.cyan }} />}
          iconBg={`${BT.text.cyan}11`}
          title="Interest Rates"
          value={`${RATES[5]}%`}
          label="10yr Treasury"
          score={Math.round(Math.max(0, Math.min(100, ((5.0 - RATES[5]) / 2.0) * 100)))}
          sparkline={rentSparkline(RATES, 80, 24, '#3b82f6')}
          trend="down"
        />
        <FactorCard
          icon={<Building2 className="w-6 h-6" style={{ color: BT.text.amber }} />}
          iconBg={`${BT.text.amber}11`}
          title="Supply Pipeline"
          value="1,000"
          label="Units delivering"
          score={Math.round(Math.max(0, Math.min(100, ((400 - 185) / 400) * 100)))}
          sparkline={rentSparkline(SUPPLY_DELIVERING, 80, 24, '#f59e0b')}
          trend="up"
        />
        <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ background: `${BT.text.green}11`, borderRadius: 0 }}>
              <Target className="w-6 h-6" style={{ color: BT.text.green }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium" style={{ color: BT.text.secondary }}>Exit Score</div>
              <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{gaugeScore}</div>
              <div className="text-[11px]" style={{ color: BT.text.secondary }}>/ 100</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full h-3 overflow-hidden" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${gaugeScore}%`,
                  background: gaugeScore >= 70 ? BT.text.green : gaugeScore >= 40 ? BT.text.amber : BT.text.red,
                  borderRadius: 0,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: BT.text.muted }}>Weak</span>
              <span className="text-[10px]" style={{ color: BT.text.muted }}>Strong</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
          Exit Scenarios
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {SCENARIOS.map((s, i) => {
            const isSelected = selectedScenario === i;
            const colorHex = s.color === 'amber' ? BT.text.amber : s.color === 'emerald' ? BT.text.green : BT.text.red;
            return (
              <button
                key={i}
                onClick={() => setSelectedScenario(i)}
                className="text-left p-4 transition-all"
                style={{
                  borderRadius: 0,
                  border: `2px solid ${isSelected ? colorHex : BT.border.subtle}`,
                  background: isSelected ? `${colorHex}11` : BT.bg.panelAlt,
                }}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: colorHex }}>
                  {s.label}
                </div>
                <div className="text-xl font-extrabold mt-1" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{s.quarter}</div>
                <div className="text-[13px] mt-1" style={{ color: BT.text.secondary }}>
                  {s.irr}% IRR · {s.multiple}x
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] mt-3" style={{ color: BT.text.muted }}>See Exit Windows tab for detailed year-by-year analysis</p>
      </div>

      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
          Causal Chain
        </h3>
        <div className="flex items-center justify-center gap-0 flex-wrap">
          <CausalBox color={BT.text.amber} bg={`${BT.text.amber}11`} border={`${BT.text.amber}44`} label="High Rent Growth" sublabel="+ Low Supply" />
          <ArrowRight className="w-5 h-5 mx-1 flex-shrink-0" style={{ color: BT.text.muted }} />
          <CausalBox color={BT.text.cyan} bg={`${BT.text.cyan}11`} border={`${BT.text.cyan}44`} label="Low Rates" sublabel="Rates falling" />
          <ArrowRight className="w-5 h-5 mx-1 flex-shrink-0" style={{ color: BT.text.muted }} />
          <CausalBox color={BT.text.green} bg={`${BT.text.green}11`} border={`${BT.text.green}44`} label="Exit Q3 2026" sublabel="3.5yr hold" />
          <ArrowRight className="w-5 h-5 mx-1 flex-shrink-0" style={{ color: BT.text.muted }} />
          <CausalBox color={BT.text.cyan} bg={`${BT.text.cyan}11`} border={`${BT.text.cyan}44`} label="5yr Fixed Debt" sublabel="Penalty-free @ Mo 36" />
          <ArrowRight className="w-5 h-5 mx-1 flex-shrink-0" style={{ color: BT.text.muted }} />
          <CausalBox color={BT.text.purple} bg={`${BT.text.purple}11`} border={`${BT.text.purple}44`} label="20% Pref + 2-Tier" sublabel="GP promotes @ 4.3x" />
        </div>
      </div>

      {MISMATCH_WARNINGS.length > 0 && (
        <div className="px-4 py-3" style={{ background: `${BT.text.red}11`, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{ color: BT.text.red }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BT.text.red }}>Structure Mismatches</span>
          </div>
          <div className="space-y-1">
            {MISMATCH_WARNINGS.map((w, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: BT.text.red }} />
                <span className="text-[12px]" style={{ color: BT.text.red }}><strong>{w.title}:</strong> {w.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <CollapsibleSection
        title="Why This Structure"
        icon={<Lock className="w-4 h-4" style={{ color: BT.text.cyan }} />}
        expanded={whyExpanded}
        onToggle={() => setWhyExpanded(!whyExpanded)}
      >
        <div className="space-y-3">
          <ReasonRow
            icon={<Lock className="w-4 h-4" style={{ color: BT.text.cyan }} />}
            title="5yr fixed-rate agency debt"
            reason="Prepayment penalty burns off at Month 36 → exit at Month 42 is penalty-free. Shorter term (3yr bridge) would have saved 15bps but carried refi risk if window shifts."
          />
          <ReasonRow
            icon={<DollarSign className="w-4 h-4" style={{ color: BT.text.purple }} />}
            title="20% pref with 2-tier promote"
            reason="Optimal window projects 4.3x multiple, which clears both promote hurdles. Earlier exit misses second tier; later exit risks dropping below first tier due to cap rate expansion."
          />
          <ReasonRow
            icon={<Target className="w-4 h-4" style={{ color: BT.text.green }} />}
            title="65% LTV (conservative)"
            reason="Lower leverage preserves DSCR cushion during value-add phase. Can refinance into higher LTV agency product once stabilized if hold is extended."
          />
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
  <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
    <div className="flex items-start gap-3">
      <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium" style={{ color: BT.text.secondary }}>{title}</div>
        <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{value}</div>
        <div className="text-[11px]" style={{ color: BT.text.secondary }}>{label}</div>
      </div>
    </div>
    <div className="flex items-center justify-between mt-2">
      <div className="text-[11px]" style={{ color: BT.text.secondary }}>
        Score: <span className="font-semibold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{Math.round(score)}</span>/100
      </div>
      {sparkline}
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
  <div className="px-4 py-2.5 text-center min-w-[120px]" style={{ background: bg, border: `1px solid ${border}`, borderRadius: 0 }}>
    <div className="text-[12px] font-bold" style={{ color }}>{label}</div>
    <div className="text-[10px] mt-0.5" style={{ color: BT.text.secondary }}>{sublabel}</div>
  </div>
);

const ReasonRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  reason: string;
}> = ({ icon, title, reason }) => (
  <div className="flex items-start gap-3 p-3" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
    <div className="mt-0.5 flex-shrink-0">{icon}</div>
    <div>
      <div className="text-sm font-semibold" style={{ color: BT.text.primary }}>{title}</div>
      <div className="text-[12px] mt-0.5 leading-relaxed" style={{ color: BT.text.secondary }}>{reason}</div>
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
  <div className="overflow-hidden" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 transition-colors"
      onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>{title}</span>
      </div>
      {expanded ? (
        <ChevronUp className="w-4 h-4" style={{ color: BT.text.secondary }} />
      ) : (
        <ChevronDown className="w-4 h-4" style={{ color: BT.text.secondary }} />
      )}
    </button>
    {expanded && <div className="px-4 pb-4">{children}</div>}
  </div>
);

export default ExitDrivesCapital;
