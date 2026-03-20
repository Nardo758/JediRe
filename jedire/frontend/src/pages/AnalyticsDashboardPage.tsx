import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, TrendingUp, TrendingDown, DollarSign, Home, BarChart3, PieChart, Calendar } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/app" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Analytics Dashboard</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {['7d', '30d', '12m', 'All'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    timeRange === range ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
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
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">{metric.label}</p>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-gray-900">{metric.value}</span>
                <span className={`flex items-center text-sm font-medium ${metric.up ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.up ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {metric.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Portfolio Performance</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {marketTrends.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${(item.value / 110) * 100}%` }}
                  />
                  <span className="text-xs text-gray-500 mt-2">{item.month}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Strategy Distribution</h3>
            <div className="space-y-4">
              {[
                { name: 'Rental', pct: 45, color: 'bg-purple-500' },
                { name: 'Flip', pct: 25, color: 'bg-blue-500' },
                { name: 'Airbnb', pct: 20, color: 'bg-orange-500' },
                { name: 'Build-to-Sell', pct: 10, color: 'bg-green-500' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.name}</span>
                    <span className="font-medium">{item.pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Property Performance</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Property</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Value</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">ROI</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Cash Flow</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {properties.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(p.value)}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{p.roi}%</td>
                  <td className="px-4 py-3 text-right text-gray-900">{p.cashflow > 0 ? `${formatCurrency(p.cashflow)}/mo` : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      p.strategy === 'Rental' ? 'bg-purple-100 text-purple-700' :
                      p.strategy === 'Flip' ? 'bg-blue-100 text-blue-700' :
                      p.strategy === 'Airbnb' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
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
