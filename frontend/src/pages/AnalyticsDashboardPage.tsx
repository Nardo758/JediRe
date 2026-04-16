import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, TrendingUp, TrendingDown, DollarSign, Home, BarChart3, PieChart, Calendar } from 'lucide-react';
import { BT } from '../components/deal/bloomberg-ui';

const portfolioMetrics = [
  { label: 'Total Portfolio Value', value: '$2,450,000', change: '+12.3%', up: true },
  { label: 'Total ROI', value: '18.5%', change: '+2.1%', up: true },
  { label: 'Monthly Cash Flow', value: '$8,450', change: '+5.2%', up: true },
  { label: 'Properties', value: '7', change: '+1', up: true },
];

const properties = [
  { name: '123 Oak Street', value: 425000, roi: 18.5, cashflow: 1200, strategy: 'Rental' },
  { name: '456 Pine Avenue', value: 385000, roi: 15.2, cashflow: 950, strategy: 'Rental' },
  { name: '789 Cedar Lane', value: 510000, roi: 22.1, cashflow: 0, strategy: 'Flip' },
  { name: '321 Maple Drive', value: 295000, roi: 12.8, cashflow: 1100, strategy: 'Airbnb' },
];

const marketTrends = [
  { month: 'Aug', value: 92 },
  { month: 'Sep', value: 88 },
  { month: 'Oct', value: 95 },
  { month: 'Nov', value: 91 },
  { month: 'Dec', value: 97 },
  { month: 'Jan', value: 102 },
];

export default function AnalyticsDashboardPage() {
  const [timeRange, setTimeRange] = useState('12m');

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const getStrategyStyle = (strategy: string): { background: string; color: string } => {
    if (strategy === 'Rental') return { background: BT.bg.active, color: BT.text.purple };
    if (strategy === 'Flip') return { background: BT.bg.active, color: BT.text.cyan };
    if (strategy === 'Airbnb') return { background: BT.bg.active, color: BT.text.orange };
    return { background: BT.bg.active, color: BT.text.green };
  };

  const getBarColor = (strategy: string): string => {
    if (strategy === 'Rental') return BT.text.purple;
    if (strategy === 'Flip') return BT.text.cyan;
    if (strategy === 'Airbnb') return BT.text.orange;
    return BT.text.green;
  };

  return (
    <div className="min-h-screen" style={{ background: BT.bg.terminal }}>
      <header className="sticky top-0 z-10" style={{ background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/app" style={{ color: BT.text.muted }}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-8 h-8" style={{ color: BT.text.cyan }} />
                <span className="text-xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>Analytics Dashboard</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {['7d', '30d', '12m', 'All'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className="px-3 py-1 text-sm font-medium"
                  style={{
                    borderRadius: 2,
                    background: timeRange === range ? BT.text.cyan : 'transparent',
                    color: timeRange === range ? BT.bg.terminal : BT.text.secondary,
                  }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {portfolioMetrics.map((metric, i) => (
            <div key={i} className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <p className="text-sm mb-1" style={{ color: BT.text.secondary }}>{metric.label}</p>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold" style={{ color: BT.text.primary }}>{metric.value}</span>
                <span className="flex items-center text-sm font-medium" style={{ color: metric.up ? BT.text.green : BT.text.red }}>
                  {metric.up ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {metric.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <h3 className="font-semibold mb-4" style={{ color: BT.text.primary }}>Portfolio Performance</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {marketTrends.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full"
                    style={{ height: `${(item.value / 110) * 100}%`, background: BT.text.cyan, borderRadius: 0 }}
                  />
                  <span className="text-xs mt-2" style={{ color: BT.text.secondary }}>{item.month}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <h3 className="font-semibold mb-4" style={{ color: BT.text.primary }}>Strategy Distribution</h3>
            <div className="space-y-4">
              {[
                { name: 'Rental', pct: 45, color: BT.text.purple },
                { name: 'Flip', pct: 25, color: BT.text.cyan },
                { name: 'Airbnb', pct: 20, color: BT.text.orange },
                { name: 'Build-to-Sell', pct: 10, color: BT.text.green },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: BT.text.secondary }}>{item.name}</span>
                    <span className="font-medium" style={{ color: BT.text.primary }}>{item.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden" style={{ background: BT.bg.hover, borderRadius: 1 }}>
                    <div className="h-full" style={{ width: `${item.pct}%`, background: item.color, borderRadius: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="p-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
            <h3 className="font-semibold" style={{ color: BT.text.primary }}>Property Performance</h3>
          </div>
          <table className="w-full">
            <thead style={{ background: BT.bg.header }}>
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: BT.text.secondary }}>Property</th>
                <th className="text-right px-4 py-3 text-sm font-medium" style={{ color: BT.text.secondary }}>Value</th>
                <th className="text-right px-4 py-3 text-sm font-medium" style={{ color: BT.text.secondary }}>ROI</th>
                <th className="text-right px-4 py-3 text-sm font-medium" style={{ color: BT.text.secondary }}>Cash Flow</th>
                <th className="text-right px-4 py-3 text-sm font-medium" style={{ color: BT.text.secondary }}>Strategy</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td className="px-4 py-3 font-medium" style={{ color: BT.text.primary }}>{p.name}</td>
                  <td className="px-4 py-3 text-right" style={{ color: BT.text.primary }}>{formatCurrency(p.value)}</td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: BT.text.green }}>{p.roi}%</td>
                  <td className="px-4 py-3 text-right" style={{ color: BT.text.primary }}>{p.cashflow > 0 ? `${formatCurrency(p.cashflow)}/mo` : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className="px-2 py-1 text-xs font-medium"
                      style={{ borderRadius: 2, ...getStrategyStyle(p.strategy) }}
                    >
                      {p.strategy}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
