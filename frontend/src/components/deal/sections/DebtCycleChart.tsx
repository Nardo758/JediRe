import React, { useState, useMemo } from 'react';

interface DebtCycleChartProps {
  currentRates?: {
    fedFunds: number;
    treasury10Y: number;
    sofr: number;
    cyclePhase?: string;
  };
  rateForecast?: Array<{
    months: number;
    treasury10Y: number;
    sofr: number;
    confidence: number;
  }>;
}

interface QuarterPoint {
  q: number;
  label: string;
  fedFunds: number;
  treasury10Y: number;
  sofr: number;
  capRate: number;
  phase: 'tightening' | 'peak' | 'easing' | 'trough';
}

const PHASE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  tightening: { bg: '#fef2f2', text: '#dc2626', label: 'Tightening' },
  peak: { bg: '#fefce8', text: '#d97706', label: 'Peak' },
  easing: { bg: '#f0fdf4', text: '#16a34a', label: 'Easing' },
  trough: { bg: '#eff6ff', text: '#3b82f6', label: 'Trough' },
};

const fmtPct = (v: number): string => `${v.toFixed(2)}%`;

function generateCycleData(currentFed: number, current10Y: number, currentSofr: number): QuarterPoint[] {
  const points: QuarterPoint[] = [];
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4'];

  const fedPath = [
    5.50, 5.50, 5.50, 5.25,
    5.00, 4.75, 4.50, 4.50,
    4.25, 4.00, 3.75, 3.50,
    3.25, 3.00, 2.75, 2.75,
    2.75, 3.00, 3.25, 3.50,
    3.75, 4.00, 4.25, 4.50,
    4.75, 5.00, 5.25, 5.25,
    5.00, 4.75, 4.50, 4.25,
    4.00, 3.75, 3.50, 3.25,
    3.00, 2.75, 2.75, 2.75,
  ];

  const phases: QuarterPoint['phase'][] = [
    'peak', 'peak', 'peak', 'easing',
    'easing', 'easing', 'easing', 'easing',
    'easing', 'easing', 'easing', 'trough',
    'trough', 'trough', 'trough', 'trough',
    'trough', 'tightening', 'tightening', 'tightening',
    'tightening', 'tightening', 'tightening', 'peak',
    'peak', 'peak', 'peak', 'easing',
    'easing', 'easing', 'easing', 'easing',
    'easing', 'easing', 'trough', 'trough',
    'trough', 'trough', 'trough', 'trough',
  ];

  for (let i = 0; i < 40; i++) {
    const year = Math.floor(i / 4) + 1;
    const q = i % 4;
    const fed = fedPath[i];
    const t10y = fed - 0.15 + Math.sin(i * 0.3) * 0.2;
    const sofr = fed + 0.05 + Math.sin(i * 0.25) * 0.1;
    const capRate = 4.0 + (fed - 2.75) * 0.35 + Math.sin(i * 0.15) * 0.15;

    points.push({
      q: i + 1,
      label: `Y${year} ${qLabels[q]}`,
      fedFunds: Math.round(fed * 100) / 100,
      treasury10Y: Math.round(t10y * 100) / 100,
      sofr: Math.round(sofr * 100) / 100,
      capRate: Math.round(capRate * 100) / 100,
      phase: phases[i],
    });
  }

  return points;
}

export const DebtCycleChart: React.FC<DebtCycleChartProps> = ({
  currentRates,
  rateForecast,
}) => {
  const [hoveredQ, setHoveredQ] = useState<number | null>(null);

  const fed = currentRates?.fedFunds ?? 4.50;
  const t10y = currentRates?.treasury10Y ?? 4.28;
  const sofr = currentRates?.sofr ?? 4.33;

  const data = useMemo(() => generateCycleData(fed, t10y, sofr), [fed, t10y, sofr]);

  const currentQ = 7;

  const troughQ = useMemo(() => {
    let minFed = Infinity;
    let minIdx = 0;
    data.forEach((d, i) => {
      if (i > currentQ && d.fedFunds < minFed) {
        minFed = d.fedFunds;
        minIdx = i;
      }
    });
    return minIdx + 1;
  }, [data, currentQ]);

  const troughData = data[troughQ - 1];
  const monthsToTrough = (troughQ - currentQ) * 3;

  const optimalWindowStart = troughQ - 2;
  const optimalWindowEnd = troughQ + 2;

  const W = 900, H = 300, pad = 50;
  const maxRate = 6.5, minRate = 2.0;
  const range = maxRate - minRate;

  const xScale = (q: number) => pad + ((q - 1) / 39) * (W - 2 * pad);
  const yScale = (v: number) => H - pad - ((v - minRate) / range) * (H - 2 * pad);

  const linePath = (series: number[]) =>
    series.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i + 1)},${yScale(v)}`).join(' ');

  const fedLine = linePath(data.map(d => d.fedFunds));
  const t10yLine = linePath(data.map(d => d.treasury10Y));
  const sofrLine = linePath(data.map(d => d.sofr));
  const capLine = linePath(data.map(d => d.capRate));

  const priorCycleFed = data.map(d => d.fedFunds + 0.5 + Math.sin(d.q * 0.2) * 0.3);
  const priorLine = linePath(priorCycleFed);

  let phaseRects: Array<{ start: number; end: number; phase: string }> = [];
  let curPhase = data[0].phase;
  let curStart = 1;
  for (let i = 1; i < data.length; i++) {
    if (data[i].phase !== curPhase) {
      phaseRects.push({ start: curStart, end: i, phase: curPhase });
      curPhase = data[i].phase;
      curStart = i + 1;
    }
  }
  phaseRects.push({ start: curStart, end: 40, phase: curPhase });

  const hovered = hoveredQ ? data[hoveredQ - 1] : null;

  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-6" style={{ borderRadius: 8 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            10-Year Debt Cycle
          </h4>
          <p className="text-xs text-[#64748b] mt-0.5">
            Rate projections across the full cycle with optimal exit window
          </p>
        </div>
        <div className="flex gap-4">
          {[
            { color: '#dc2626', label: 'Fed Funds' },
            { color: '#3b82f6', label: '10yr Treasury' },
            { color: '#8b5cf6', label: 'SOFR' },
            { color: '#d97706', label: 'MF Cap Rate' },
            { color: '#9ca3af', label: 'Prior Cycle', dashed: true },
          ].map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded-sm" style={{
                background: l.color,
                borderTop: l.dashed ? `1px dashed ${l.color}` : 'none',
                opacity: l.dashed ? 0.5 : 1,
              }} />
              <span className="text-[10px] text-gray-400">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoveredQ(null)}>
        {phaseRects.map((pr, i) => {
          const cfg = PHASE_COLORS[pr.phase];
          return (
            <g key={i}>
              <rect
                x={xScale(pr.start)} y={pad}
                width={xScale(pr.end) - xScale(pr.start)}
                height={H - 2 * pad}
                fill={cfg.bg} fillOpacity={0.6}
              />
              <text
                x={(xScale(pr.start) + xScale(pr.end)) / 2}
                y={pad + 14}
                textAnchor="middle" fontSize="8" fontWeight="600"
                fill={cfg.text} opacity={0.7}
              >
                {cfg.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {optimalWindowStart > 0 && (
          <rect
            x={xScale(optimalWindowStart)} y={pad}
            width={xScale(optimalWindowEnd) - xScale(optimalWindowStart)}
            height={H - 2 * pad}
            fill="#16a34a" fillOpacity={0.08}
            stroke="#16a34a" strokeWidth={1} strokeDasharray="4 3"
            rx={4}
          />
        )}
        {optimalWindowStart > 0 && (
          <text
            x={(xScale(optimalWindowStart) + xScale(optimalWindowEnd)) / 2}
            y={pad + 28}
            textAnchor="middle" fontSize="9" fontWeight="700"
            fill="#16a34a"
          >
            OPTIMAL EXIT
          </text>
        )}

        {[2, 3, 4, 5, 6].map(v => (
          <g key={v}>
            <line x1={pad} y1={yScale(v)} x2={W - pad} y2={yScale(v)}
              stroke="#f1f5f9" strokeWidth={0.5} />
            <text x={pad - 6} y={yScale(v) + 4} textAnchor="end"
              fontSize="9" fill="#9CA3AF">{v}%</text>
          </g>
        ))}

        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(yr => {
          const x = xScale(yr * 4);
          return (
            <g key={yr}>
              <line x1={x} y1={pad} x2={x} y2={H - pad}
                stroke="#f1f5f9" strokeWidth={0.5} />
              <text x={x} y={H - pad + 16} textAnchor="middle"
                fontSize="10" fill="#9CA3AF">Y{yr}</text>
            </g>
          );
        })}

        <path d={priorLine} fill="none" stroke="#9ca3af" strokeWidth={1}
          strokeDasharray="3 3" opacity={0.35} />

        <path d={fedLine} fill="none" stroke="#dc2626" strokeWidth={2} strokeLinejoin="round" />
        <path d={t10yLine} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
        <path d={sofrLine} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4 2" />
        <path d={capLine} fill="none" stroke="#d97706" strokeWidth={1.5} strokeLinejoin="round" />

        <g>
          <line x1={xScale(currentQ)} y1={pad} x2={xScale(currentQ)} y2={H - pad}
            stroke="#0f172a" strokeWidth={2} strokeDasharray="4 3" />
          <rect x={xScale(currentQ) - 32} y={pad - 16} width={64} height={16}
            rx={4} fill="#0f172a" />
          <text x={xScale(currentQ)} y={pad - 5} textAnchor="middle"
            fontSize="8" fontWeight="700" fill="white">YOU ARE HERE</text>
          <circle cx={xScale(currentQ)} cy={yScale(data[currentQ - 1].fedFunds)}
            r={5} fill="#dc2626" stroke="white" strokeWidth={2} />
        </g>

        {data.map((d, i) => (
          <rect key={i}
            x={xScale(i + 1) - (W - 2 * pad) / 80}
            y={pad}
            width={(W - 2 * pad) / 40}
            height={H - 2 * pad}
            fill="transparent"
            onMouseEnter={() => setHoveredQ(i + 1)}
          />
        ))}

        {hovered && hoveredQ && (
          <g>
            <line x1={xScale(hoveredQ)} y1={pad} x2={xScale(hoveredQ)} y2={H - pad}
              stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2 2" />
            <circle cx={xScale(hoveredQ)} cy={yScale(hovered.fedFunds)} r={3} fill="#dc2626" />
            <circle cx={xScale(hoveredQ)} cy={yScale(hovered.treasury10Y)} r={3} fill="#3b82f6" />
            <circle cx={xScale(hoveredQ)} cy={yScale(hovered.sofr)} r={3} fill="#8b5cf6" />
            <circle cx={xScale(hoveredQ)} cy={yScale(hovered.capRate)} r={3} fill="#d97706" />
            <rect x={xScale(hoveredQ) + 8} y={yScale(hovered.fedFunds) - 40} width={120} height={72} rx={6}
              fill="white" stroke="#e2e8f0" strokeWidth={1}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))' }} />
            <text x={xScale(hoveredQ) + 16} y={yScale(hovered.fedFunds) - 26} fontSize="9" fontWeight="700" fill="#0f172a">{hovered.label}</text>
            <text x={xScale(hoveredQ) + 16} y={yScale(hovered.fedFunds) - 13} fontSize="8" fill="#dc2626">Fed: {fmtPct(hovered.fedFunds)}</text>
            <text x={xScale(hoveredQ) + 16} y={yScale(hovered.fedFunds)} fontSize="8" fill="#3b82f6">10Y: {fmtPct(hovered.treasury10Y)}</text>
            <text x={xScale(hoveredQ) + 16} y={yScale(hovered.fedFunds) + 13} fontSize="8" fill="#8b5cf6">SOFR: {fmtPct(hovered.sofr)}</text>
            <text x={xScale(hoveredQ) + 16} y={yScale(hovered.fedFunds) + 26} fontSize="8" fill="#d97706">Cap: {fmtPct(hovered.capRate)}</text>
          </g>
        )}
      </svg>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {[
          {
            icon: '📊',
            iconBg: 'bg-red-50',
            label: 'Current Fed Rate',
            value: fmtPct(data[currentQ - 1].fedFunds),
            sub: currentRates?.cyclePhase ? `Phase: ${currentRates.cyclePhase}` : 'Phase: Easing',
          },
          {
            icon: '📉',
            iconBg: 'bg-blue-50',
            label: 'Projected Low',
            value: fmtPct(troughData.fedFunds),
            sub: `At ${troughData.label}`,
          },
          {
            icon: '⏱',
            iconBg: 'bg-amber-50',
            label: 'Months to Trough',
            value: `${monthsToTrough}mo`,
            sub: `~${Math.round(monthsToTrough / 3)} quarters`,
          },
          {
            icon: '🏢',
            iconBg: 'bg-green-50',
            label: 'Cap Rate at Trough',
            value: fmtPct(troughData.capRate),
            sub: `vs current ${fmtPct(data[currentQ - 1].capRate)}`,
          },
        ].map((card, i) => (
          <div key={i} className="bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-4 flex items-start gap-3" style={{ borderRadius: 8 }}>
            <div className={`w-12 h-12 ${card.iconBg} rounded-lg flex items-center justify-center text-xl flex-shrink-0`}>
              {card.icon}
            </div>
            <div>
              <div className="text-[13px] font-medium text-[#64748b]">{card.label}</div>
              <div className="text-[24px] font-bold text-[#0f172a] leading-tight">{card.value}</div>
              <div className="text-[11px] text-[#94a3b8] mt-0.5">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DebtCycleChart;
