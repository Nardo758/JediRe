/**
 * Market Intelligence Panel (M05 Enhancement)
 *
 * Submarket vitals with trend sparklines, rent comp grid with subject
 * property highlighted, and direct implications for proforma assumptions.
 *
 * Decision: "Is this submarket getting stronger or weaker — and how fast?"
 */

import React from 'react';

// ============================================================================
// Mock Data (inline for M05 enhancement)
// ============================================================================

interface MarketVital {
  id: string;
  label: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'flat';
  sparklineData: number[];
  formula: string;
  source: string;
}

const marketVitals: MarketVital[] = [
  {
    id: 'avg-rent',
    label: 'Avg Effective Rent',
    value: '$1,825/mo',
    trend: '+3.2% YoY',
    trendDirection: 'up',
    sparklineData: [1680, 1710, 1735, 1755, 1770, 1790, 1800, 1810, 1818, 1820, 1822, 1825],
    formula: 'Weighted avg from comp set',
    source: 'M05 apartments.com + RentCast',
  },
  {
    id: 'vacancy',
    label: 'Vacancy Rate',
    value: '5.8%',
    trend: 'from 6.4% 12mo ago',
    trendDirection: 'down',
    sparklineData: [6.4, 6.3, 6.2, 6.1, 6.0, 5.9, 5.9, 5.8, 5.8, 5.7, 5.8, 5.8],
    formula: 'Vacant units / total units in trade area',
    source: 'M05 apartments.com scraper',
  },
  {
    id: 'absorption',
    label: 'Quarterly Absorption',
    value: '255 units/qtr',
    trend: 'Steady',
    trendDirection: 'flat',
    sparklineData: [240, 260, 245, 270, 250, 255, 260, 248, 262, 255, 250, 255],
    formula: 'Net units absorbed / total per quarter',
    source: 'M05 quarterly calc',
  },
  {
    id: 'rent-growth',
    label: 'Rent Growth Trend',
    value: '+3.2%',
    trend: 'Accelerating from +2.8%',
    trendDirection: 'up',
    sparklineData: [2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.0, 3.1, 3.2],
    formula: '12-month rolling average rent change',
    source: 'M05 time series',
  },
  {
    id: 'submarket-rank',
    label: 'Submarket Rank',
    value: '78th pctl',
    trend: 'Top quartile',
    trendDirection: 'up',
    sparklineData: [72, 73, 74, 74, 75, 76, 76, 77, 77, 78, 78, 78],
    formula: 'F26: rent_growth×0.3 + absorption×0.25 + vacancy_inv×0.25 + pop_growth×0.2',
    source: 'M05 comparative',
  },
];

interface RentComp {
  id: string;
  name: string;
  isSubject: boolean;
  distance: number;
  units: number;
  yearBuilt: number;
  avgRent: number;
  rentPSF: number;
  occupancy: number;
  amenityScore: number;
  amenityMax: number;
  premiumDiscount: number;
}

const rentComps: RentComp[] = [
  { id: 'rc-subject', name: 'Subject Property', isSubject: true, distance: 0, units: 250, yearBuilt: 2018, avgRent: 1850, rentPSF: 1.98, occupancy: 94.2, amenityScore: 8, amenityMax: 10, premiumDiscount: 1.4 },
  { id: 'rc-1', name: 'Avalon Buckhead', isSubject: false, distance: 0.5, units: 300, yearBuilt: 2019, avgRent: 1925, rentPSF: 2.05, occupancy: 95.1, amenityScore: 10, amenityMax: 10, premiumDiscount: 5.5 },
  { id: 'rc-2', name: 'Modera Buckhead', isSubject: false, distance: 0.8, units: 280, yearBuilt: 2020, avgRent: 1875, rentPSF: 2.01, occupancy: 93.8, amenityScore: 9, amenityMax: 10, premiumDiscount: 2.7 },
  { id: 'rc-3', name: 'Post Parkside', isSubject: false, distance: 1.2, units: 200, yearBuilt: 2015, avgRent: 1725, rentPSF: 1.85, occupancy: 92.5, amenityScore: 6, amenityMax: 10, premiumDiscount: -5.5 },
  { id: 'rc-4', name: 'Broadstone Lenox', isSubject: false, distance: 1.5, units: 350, yearBuilt: 2017, avgRent: 1800, rentPSF: 1.92, occupancy: 94.0, amenityScore: 7, amenityMax: 10, premiumDiscount: -1.4 },
  { id: 'rc-5', name: 'Hanover Buckhead', isSubject: false, distance: 1.8, units: 275, yearBuilt: 2021, avgRent: 1950, rentPSF: 2.08, occupancy: 96.0, amenityScore: 10, amenityMax: 10, premiumDiscount: 6.8 },
];

const valueAddOpportunities = [
  { amenity: 'Package Lockers', currentComps: 4, totalComps: 5, rentLift: 35, capex: 45000, payback: '15 months' },
  { amenity: 'Dog Park/Pet Spa', currentComps: 3, totalComps: 5, rentLift: 40, capex: 85000, payback: '21 months' },
  { amenity: 'Coworking Space', currentComps: 2, totalComps: 5, rentLift: 50, capex: 120000, payback: '24 months' },
];

// ============================================================================
// Component
// ============================================================================

export const MarketIntelligence: React.FC = () => {
  const avgCompRent = rentComps.filter(c => !c.isSubject).reduce((sum, c) => sum + c.avgRent, 0) / (rentComps.length - 1);

  return (
    <div className="space-y-5">
      {/* Decision Banner */}
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
        <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">Is this submarket getting stronger or weaker — and how fast?</div>
      </div>

      {/* Market Vitals Dashboard */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-4">Market Vitals</h3>

        <div className="grid grid-cols-5 gap-4">
          {marketVitals.map(vital => (
            <div key={vital.id} className="border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{vital.label}</div>
              <div className="text-xl font-bold text-stone-900">{vital.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] font-medium ${
                  vital.trendDirection === 'up' ? 'text-emerald-600' :
                  vital.trendDirection === 'down' ? 'text-emerald-600' : // vacancy down = good
                  'text-stone-500'
                }`}>
                  {vital.trendDirection === 'up' ? '\u2191' : vital.trendDirection === 'down' ? '\u2193' : '\u2192'} {vital.trend}
                </span>
              </div>
              {/* Mini sparkline */}
              <div className="mt-2 h-6 flex items-end gap-px">
                {vital.sparklineData.slice(-12).map((v, i, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const range = max - min || 1;
                  const height = ((v - min) / range) * 100;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-amber-500' : 'bg-stone-200'}`}
                      style={{ height: `${Math.max(10, height)}%` }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            This submarket ranks in the 78th percentile — top quartile. Vacancy is trending DOWN (good),
            rent growth is ACCELERATING (great), and absorption is steady at 255 units/quarter. Momentum signal: STRONG.
          </p>
        </div>
      </div>

      {/* Rent Comp Grid */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-stone-900">Rent Comp Analysis</h3>
          <div className="text-xs text-stone-500">
            Subject premium vs comp avg: <span className="font-bold text-amber-700">+1.4%</span> ($1,850 vs ${avgCompRent.toFixed(0)} avg)
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-4">Subject property highlighted. Click any comp for detail.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-stone-200 text-[10px] font-mono text-stone-400">
                <th className="text-left py-2 px-2">Property</th>
                <th className="text-right py-2 px-2">Dist</th>
                <th className="text-right py-2 px-2">Units</th>
                <th className="text-right py-2 px-2">Year</th>
                <th className="text-right py-2 px-2">Avg Rent</th>
                <th className="text-right py-2 px-2">$/SF</th>
                <th className="text-right py-2 px-2">Occ</th>
                <th className="text-right py-2 px-2">Amenities</th>
                <th className="text-right py-2 px-2">Premium</th>
              </tr>
            </thead>
            <tbody>
              {rentComps.map(comp => (
                <tr
                  key={comp.id}
                  className={`border-b border-stone-100 ${comp.isSubject ? 'bg-amber-50 font-semibold' : 'hover:bg-stone-50'}`}
                >
                  <td className="py-2 px-2 text-stone-900">
                    {comp.isSubject && <span className="text-amber-500 mr-1">&#9670;</span>}
                    {comp.name}
                  </td>
                  <td className="text-right py-2 px-2 text-stone-600">{comp.distance > 0 ? `${comp.distance}mi` : '--'}</td>
                  <td className="text-right py-2 px-2 text-stone-600">{comp.units}</td>
                  <td className="text-right py-2 px-2 text-stone-600">{comp.yearBuilt}</td>
                  <td className="text-right py-2 px-2 font-mono text-stone-900">${comp.avgRent.toLocaleString()}</td>
                  <td className="text-right py-2 px-2 font-mono text-stone-600">${comp.rentPSF.toFixed(2)}</td>
                  <td className="text-right py-2 px-2 text-stone-600">{comp.occupancy}%</td>
                  <td className="text-right py-2 px-2 text-stone-600">{comp.amenityScore}/{comp.amenityMax}</td>
                  <td className={`text-right py-2 px-2 font-mono font-semibold ${
                    comp.premiumDiscount > 0 ? 'text-emerald-600' : comp.premiumDiscount < 0 ? 'text-red-500' : 'text-stone-500'
                  }`}>
                    {comp.premiumDiscount > 0 ? '+' : ''}{comp.premiumDiscount}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Value-Add Opportunities */}
        <div className="mt-5 border-t border-stone-200 pt-4">
          <div className="text-sm font-bold text-stone-900 mb-3">Value-Add Opportunities (Amenity Gap Analysis)</div>
          <div className="grid grid-cols-3 gap-3">
            {valueAddOpportunities.map((opp, idx) => (
              <div key={idx} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-emerald-800">{opp.amenity}</div>
                <div className="text-[11px] text-emerald-600 mt-1">
                  {opp.currentComps}/{opp.totalComps} comps have it
                </div>
                <div className="flex justify-between mt-2 text-[10px]">
                  <span className="text-emerald-700">Rent lift: <span className="font-bold">${opp.rentLift}/unit</span></span>
                  <span className="text-stone-500">Payback: {opp.payback}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-stone-500">
            Adding package lockers + dog park = $75/unit rent lift = $252K/year NOI boost for $130K capex. 1.9x return on investment.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketIntelligence;
