import React, { useState, useMemo } from 'react';

interface DebtProduct {
  id: string;
  name: string;
  productType: string;
  rateRange: { min: number; max: number };
  ltvMax: number;
  term: { min: number; max: number };
  keyBenefit?: string;
  keyRisk?: string;
}

interface DebtProductsChartProps {
  products?: DebtProduct[];
  targetRate?: number;
  exitWindowMonths?: number;
}

const PRODUCT_COLORS: Record<string, string> = {
  agency: '#3b82f6',
  cmbs: '#8b5cf6',
  bridge: '#d97706',
  life_company: '#16a34a',
  hard_money: '#dc2626',
  construction: '#06b6d4',
  dscr_loan: '#ec4899',
  mezz: '#f59e0b',
};

const PRODUCT_LABELS: Record<string, string> = {
  agency: 'Agency',
  cmbs: 'CMBS',
  bridge: 'Bridge',
  life_company: 'Life Co',
  hard_money: 'Hard Money',
  construction: 'Construction',
  dscr_loan: 'DSCR',
  mezz: 'Mezzanine',
};

const DEFAULT_PRODUCTS: DebtProduct[] = [
  { id: 'dp-agency', name: 'Fannie Mae DUS', productType: 'agency', rateRange: { min: 5.25, max: 6.25 }, ltvMax: 75, term: { min: 60, max: 120 }, keyBenefit: 'Lowest rates, non-recourse', keyRisk: 'Yield maintenance' },
  { id: 'dp-cmbs', name: 'CMBS Conduit', productType: 'cmbs', rateRange: { min: 6.50, max: 7.50 }, ltvMax: 75, term: { min: 60, max: 120 }, keyBenefit: 'Non-recourse, higher proceeds', keyRisk: 'Lockbox, inflexible docs' },
  { id: 'dp-bridge', name: 'Bridge Loan', productType: 'bridge', rateRange: { min: 7.50, max: 10.50 }, ltvMax: 80, term: { min: 24, max: 36 }, keyBenefit: 'IO period, high leverage', keyRisk: 'Floating rate, maturity risk' },
  { id: 'dp-life', name: 'Life Company', productType: 'life_company', rateRange: { min: 5.50, max: 6.50 }, ltvMax: 65, term: { min: 84, max: 180 }, keyBenefit: 'Lowest rates, longest terms', keyRisk: 'Low leverage, slow close' },
  { id: 'dp-hard', name: 'Fix & Flip', productType: 'hard_money', rateRange: { min: 10, max: 13 }, ltvMax: 85, term: { min: 6, max: 18 }, keyBenefit: 'Fast close, no DSCR req', keyRisk: 'Full recourse, high rates' },
  { id: 'dp-const', name: 'Construction', productType: 'construction', rateRange: { min: 7.75, max: 9.50 }, ltvMax: 65, term: { min: 24, max: 36 }, keyBenefit: 'Draw-based, interest reserve', keyRisk: 'Cost overrun, guarantees' },
  { id: 'dp-dscr', name: 'DSCR Rental', productType: 'dscr_loan', rateRange: { min: 7.0, max: 9.0 }, ltvMax: 75, term: { min: 60, max: 84 }, keyBenefit: 'No income verification', keyRisk: 'Higher rates, prepay penalty' },
];

export const DebtProductsChart: React.FC<DebtProductsChartProps> = ({
  products,
  targetRate = 6.5,
  exitWindowMonths = 60,
}) => {
  const [view, setView] = useState<'scatter' | 'bar'>('scatter');
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  const items = products || DEFAULT_PRODUCTS;

  const grouped = useMemo(() => {
    const map = new Map<string, DebtProduct[]>();
    items.forEach(p => {
      const existing = map.get(p.productType) || [];
      existing.push(p);
      map.set(p.productType, existing);
    });
    return Array.from(map.entries()).map(([type, prods]) => ({
      type,
      color: PRODUCT_COLORS[type] || '#6b7280',
      label: PRODUCT_LABELS[type] || type,
      avgRate: (prods[0].rateRange.min + prods[0].rateRange.max) / 2,
      avgTerm: (prods[0].term.min + prods[0].term.max) / 2,
      ltvMax: Math.max(...prods.map(p => p.ltvMax)),
      rateRange: { min: Math.min(...prods.map(p => p.rateRange.min)), max: Math.max(...prods.map(p => p.rateRange.max)) },
      termRange: { min: Math.min(...prods.map(p => p.term.min)), max: Math.max(...prods.map(p => p.term.max)) },
      products: prods,
    }));
  }, [items]);

  const W = 900, H = 340, pad = 55;
  const maxTerm = 200, minTerm = 0;
  const maxRate = 14, minRate = 4;
  const termRange = maxTerm - minTerm;
  const rateRange = maxRate - minRate;

  const xScale = (term: number) => pad + ((term - minTerm) / termRange) * (W - 2 * pad);
  const yScale = (rate: number) => H - pad - ((rate - minRate) / rateRange) * (H - 2 * pad);

  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-6" style={{ borderRadius: 8 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Debt Products Comparison
          </h4>
          <p className="text-xs text-[#64748b] mt-0.5">
            Visual comparison of rate, term, and leverage across product types
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setView('scatter')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'scatter' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Scatter
          </button>
          <button
            onClick={() => setView('bar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'bar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Bar Chart
          </button>
        </div>
      </div>

      {view === 'scatter' ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoveredProduct(null)}>
          {[6, 8, 10, 12].map(v => (
            <g key={v}>
              <line x1={pad} y1={yScale(v)} x2={W - pad} y2={yScale(v)} stroke="#f1f5f9" strokeWidth={0.5} />
              <text x={pad - 6} y={yScale(v) + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">{v}%</text>
            </g>
          ))}

          {[0, 24, 48, 72, 96, 120, 180].map(t => (
            <g key={t}>
              <line x1={xScale(t)} y1={pad} x2={xScale(t)} y2={H - pad} stroke="#f1f5f9" strokeWidth={0.5} />
              <text x={xScale(t)} y={H - pad + 16} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                {t < 12 ? `${t}mo` : `${Math.round(t / 12)}yr`}
              </text>
            </g>
          ))}

          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="500">Term</text>
          <text x={14} y={H / 2} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="500"
            transform={`rotate(-90, 14, ${H / 2})`}>Rate %</text>

          <line x1={pad} y1={yScale(targetRate)} x2={W - pad} y2={yScale(targetRate)}
            stroke="#16a34a" strokeWidth={1} strokeDasharray="6 3" />
          <text x={W - pad + 4} y={yScale(targetRate) + 4} fontSize="8" fill="#16a34a" fontWeight="600">
            Target {targetRate}%
          </text>

          <line x1={xScale(exitWindowMonths)} y1={pad} x2={xScale(exitWindowMonths)} y2={H - pad}
            stroke="#3b82f6" strokeWidth={1} strokeDasharray="6 3" />
          <text x={xScale(exitWindowMonths)} y={pad - 6} textAnchor="middle" fontSize="8" fill="#3b82f6" fontWeight="600">
            Exit Window
          </text>

          {grouped.map((g) => {
            const cx = xScale(g.avgTerm);
            const cy = yScale(g.avgRate);
            const r = 8 + (g.ltvMax / 100) * 20;
            const isHovered = hoveredProduct === g.type;

            return (
              <g key={g.type} onMouseEnter={() => setHoveredProduct(g.type)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={r}
                  fill={g.color} fillOpacity={isHovered ? 0.35 : 0.2}
                  stroke={g.color} strokeWidth={isHovered ? 2.5 : 1.5}
                  style={{ transition: 'all 0.2s ease' }}
                />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill={g.color}>
                  {g.label}
                </text>

                {isHovered && (
                  <g>
                    <rect x={cx + r + 8} y={cy - 42} width={155} height={80} rx={6}
                      fill="white" stroke="#e2e8f0" strokeWidth={1}
                      style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.1))' }} />
                    <text x={cx + r + 16} y={cy - 26} fontSize="10" fontWeight="700" fill="#0f172a">{g.products[0].name}</text>
                    <text x={cx + r + 16} y={cy - 12} fontSize="8" fill="#64748b">Rate: {g.rateRange.min}% – {g.rateRange.max}%</text>
                    <text x={cx + r + 16} y={cy + 1} fontSize="8" fill="#64748b">Term: {g.termRange.min}–{g.termRange.max}mo</text>
                    <text x={cx + r + 16} y={cy + 14} fontSize="8" fill="#64748b">Max LTV: {g.ltvMax}%</text>
                    {g.products[0].keyBenefit && (
                      <text x={cx + r + 16} y={cy + 28} fontSize="7" fill="#16a34a">✓ {g.products[0].keyBenefit}</text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {['Rate (%)', 'Max LTV (%)', 'Term (months)'].map((label, colIdx) => (
              <div key={label} className="bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-4">
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-3">{label}</div>
                <div className="space-y-2">
                  {grouped.map(g => {
                    let value: number, maxVal: number, displayVal: string;
                    if (colIdx === 0) {
                      value = g.avgRate;
                      maxVal = 14;
                      displayVal = `${g.rateRange.min}–${g.rateRange.max}%`;
                    } else if (colIdx === 1) {
                      value = g.ltvMax;
                      maxVal = 100;
                      displayVal = `${g.ltvMax}%`;
                    } else {
                      value = g.avgTerm;
                      maxVal = 180;
                      displayVal = `${g.termRange.min}–${g.termRange.max}mo`;
                    }
                    const pct = Math.min((value / maxVal) * 100, 100);
                    return (
                      <div key={g.type}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[10px] font-medium" style={{ color: g.color }}>{g.label}</span>
                          <span className="text-[10px] text-gray-500">{displayVal}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div className="h-full rounded-full" style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${g.color}66, ${g.color})`,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {grouped.map(g => (
          <div key={g.type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: g.color, opacity: 0.7 }} />
            <span className="text-[10px] text-gray-500">{g.label}</span>
          </div>
        ))}
        <div className="w-px h-4 bg-gray-200" />
        <div className="text-[10px] text-gray-400">Bubble size = Max LTV</div>
      </div>
    </div>
  );
};

export default DebtProductsChart;
