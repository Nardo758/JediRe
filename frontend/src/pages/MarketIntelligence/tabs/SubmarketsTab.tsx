import React, { useState } from 'react';
import OutputCard, { OutputSection } from '../components/OutputCard';
import { SIGNAL_GROUPS } from '../signalGroups';

interface SubmarketsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

const MAP_TOGGLES = ['JEDI', 'Demand', 'Supply Risk', 'Rent Growth', 'Cap Rate', 'Pricing Power', 'Constraint'] as const;

const mockSubmarkets = [
  {
    name: 'Buckhead',
    jedi: 92, demand: 88, supplyCount: 1240, saturation: 0.72, rentAccel: 3.1, trafficElasticity: 0.85,
    capacityRatio: 0.34, buildoutYrs: 6.2, supplyConstraint: 78, overhangRisk: 0.12, lastMover: true,
    pricingPower: 82, supplyAdjRent: 2180, physicalTraffic: 76,
  },
  {
    name: 'Midtown',
    jedi: 85, demand: 82, supplyCount: 980, saturation: 0.65, rentAccel: 2.4, trafficElasticity: 0.71,
    capacityRatio: 0.48, buildoutYrs: 8.5, supplyConstraint: 62, overhangRisk: 0.25, lastMover: false,
    pricingPower: 68, supplyAdjRent: 1950, physicalTraffic: 81,
  },
  {
    name: 'Downtown',
    jedi: 75, demand: 70, supplyCount: 1520, saturation: 0.88, rentAccel: 1.2, trafficElasticity: 0.52,
    capacityRatio: 0.61, buildoutYrs: 12.1, supplyConstraint: 41, overhangRisk: 0.38, lastMover: false,
    pricingPower: 45, supplyAdjRent: 1620, physicalTraffic: 90,
  },
  {
    name: 'Sandy Springs',
    jedi: 88, demand: 84, supplyCount: 620, saturation: 0.45, rentAccel: 3.8, trafficElasticity: 0.92,
    capacityRatio: 0.28, buildoutYrs: 4.8, supplyConstraint: 85, overhangRisk: 0.08, lastMover: true,
    pricingPower: 88, supplyAdjRent: 2340, physicalTraffic: 62,
  },
  {
    name: 'Decatur',
    jedi: 80, demand: 76, supplyCount: 410, saturation: 0.52, rentAccel: 2.0, trafficElasticity: 0.67,
    capacityRatio: 0.39, buildoutYrs: 7.3, supplyConstraint: 71, overhangRisk: 0.18, lastMover: false,
    pricingPower: 64, supplyAdjRent: 1780, physicalTraffic: 58,
  },
];

const SubmarketsTab: React.FC<SubmarketsTabProps> = ({ marketId, summary }) => {
  const [activeToggle, setActiveToggle] = useState<string>('JEDI');
  const [expandedSubmarket, setExpandedSubmarket] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);

  const toggleCompare = (name: string) => {
    setCompareSelection(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : prev.length < 3 ? [...prev, name] : prev
    );
  };

  const scoreColor = (score: number) => {
    if (score >= 85) return 'text-green-700 bg-green-100';
    if (score >= 75) return 'text-blue-700 bg-blue-100';
    return 'text-amber-700 bg-amber-100';
  };

  const detailOutputIds = [
    'DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-05', 'DC-07', 'DC-09', 'T-02', 'T-08',
  ];

  const comparedSubmarkets = mockSubmarkets.filter(s => compareSelection.includes(s.name));

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Submarket Map</h2>
            <p className="text-sm text-gray-500 mt-1">
              WHERE within {summary?.market?.display_name || marketId} — choropleth overlay
            </p>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
            Outputs: C-01, C-10
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {MAP_TOGGLES.map(toggle => (
            <button
              key={toggle}
              onClick={() => setActiveToggle(toggle)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeToggle === toggle
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {toggle}
            </button>
          ))}
        </div>

        <div className="w-full h-72 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
          <span className="text-gray-400 text-sm font-medium">Choropleth Map Placeholder</span>
          <span className="text-gray-300 text-xs mt-1">Active layer: {activeToggle}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <OutputCard outputId="C-01" status="mock" value={85} subtitle="Market-level JEDI" />
          <OutputCard outputId="C-10" status="mock" value="Ranked" subtitle="Submarket ranking report" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Submarket Ranking Table</h3>
              <p className="text-sm text-gray-500 mt-0.5">Key metrics across 5 Atlanta submarkets</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
              18 columns
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">Submarket</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">C-01 JEDI</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">D-09 Demand</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">S-01 Inv.</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">S-08 Sat.</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">M-02 Accel</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">M-07 Elast.</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider border-l-2 border-violet-200">DC-01 Cap.</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider">DC-02 Build</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider">DC-03 Constr.</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider">DC-04 Ovhng</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider">DC-05 Last</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider">DC-07 Power</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-violet-600 uppercase tracking-wider">DC-11 Rent</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 uppercase tracking-wider border-l-2 border-blue-200">T-02 Traffic</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Compare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mockSubmarkets.map(sub => (
                <tr key={sub.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900 sticky left-0 bg-white z-10">
                    <button
                      className="text-left hover:text-teal-600 transition-colors"
                      onClick={() => setExpandedSubmarket(expandedSubmarket === sub.name ? null : sub.name)}
                    >
                      {sub.name}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${scoreColor(sub.jedi)}`}>
                      {sub.jedi}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-gray-700">{sub.demand}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{sub.supplyCount.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-gray-600">{(sub.saturation * 100).toFixed(0)}%</td>
                  <td className="px-3 py-3 text-center text-gray-600">{sub.rentAccel.toFixed(1)}%</td>
                  <td className="px-3 py-3 text-center text-gray-600">{sub.trafficElasticity.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center text-violet-700 font-medium border-l-2 border-violet-100">{sub.capacityRatio.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center text-violet-700">{sub.buildoutYrs.toFixed(1)} yr</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${scoreColor(sub.supplyConstraint)}`}>
                      {sub.supplyConstraint}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-violet-700">{sub.overhangRisk.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center">
                    {sub.lastMover ? (
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">YES</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${scoreColor(sub.pricingPower)}`}>
                      {sub.pricingPower}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-violet-700 font-medium">${sub.supplyAdjRent.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-blue-700 font-medium border-l-2 border-blue-100">{sub.physicalTraffic}</td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={compareSelection.includes(sub.name)}
                      onChange={() => toggleCompare(sub.name)}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {expandedSubmarket && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setExpandedSubmarket(null)}
            className="w-full px-6 py-4 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <h3 className="text-base font-semibold text-gray-900">
                Submarket Detail: {expandedSubmarket}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">All signal groups + DC + Traffic aggregated</p>
            </div>
            <span className="text-gray-400 text-lg">&#x2715;</span>
          </button>
          <div className="p-4 space-y-4">
            <OutputSection
              title="Dev Capacity Signals"
              description={`Development capacity metrics for ${expandedSubmarket}`}
              outputIds={['DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-05', 'DC-07']}
              groupHighlight="DEV_CAPACITY"
            />
            <OutputSection
              title="Developer & Land Signals"
              description="Land bank and supply-adjusted metrics"
              outputIds={['DC-09']}
              groupHighlight="DEV_CAPACITY"
            />
            <OutputSection
              title="Traffic Signals (Averaged)"
              description="Physical traffic and generator proximity at submarket level"
              outputIds={['T-02', 'T-08']}
              groupHighlight="TRAFFIC"
            />
            <OutputSection
              title="Demand Signals"
              description="Demand momentum for this submarket"
              outputIds={['D-09', 'D-10']}
              groupHighlight="DEMAND"
            />
            <OutputSection
              title="Supply Signals"
              description="Supply pressure in this submarket"
              outputIds={['S-01', 'S-05', 'S-08']}
              groupHighlight="SUPPLY"
            />
            <OutputSection
              title="Momentum Signals"
              description="Rent and market momentum"
              outputIds={['M-02', 'M-07']}
              groupHighlight="MOMENTUM"
            />
            <OutputSection
              title="Composite Signals"
              description="AI-generated composite scores"
              outputIds={['C-01', 'C-10']}
              groupHighlight="COMPOSITE"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Submarket Comparison</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Select 2-3 submarkets from the ranking table to compare ({compareSelection.length}/3 selected)
              </p>
            </div>
            {compareSelection.length > 0 && (
              <button
                onClick={() => setCompareSelection([])}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="p-4">
          {comparedSubmarkets.length < 2 ? (
            <div className="h-40 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-sm">
                Check 2-3 submarkets in the "Compare" column above to see side-by-side metrics
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`grid gap-4 ${comparedSubmarkets.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {comparedSubmarkets.map(sub => (
                  <div key={sub.name} className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-3">{sub.name}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">JEDI (C-01)</span><span className="font-semibold">{sub.jedi}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Demand (D-09)</span><span className="font-semibold">{sub.demand}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Inventory (S-01)</span><span className="font-semibold">{sub.supplyCount.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Saturation (S-08)</span><span className="font-semibold">{(sub.saturation * 100).toFixed(0)}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Rent Accel (M-02)</span><span className="font-semibold">{sub.rentAccel.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Elasticity (M-07)</span><span className="font-semibold">{sub.trafficElasticity.toFixed(2)}</span></div>
                      <hr className="border-violet-100" />
                      <div className="flex justify-between"><span className="text-violet-600">Capacity (DC-01)</span><span className="font-semibold text-violet-700">{sub.capacityRatio.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Buildout (DC-02)</span><span className="font-semibold text-violet-700">{sub.buildoutYrs.toFixed(1)} yr</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Constraint (DC-03)</span><span className="font-semibold text-violet-700">{sub.supplyConstraint}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Overhang (DC-04)</span><span className="font-semibold text-violet-700">{sub.overhangRisk.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Last Mover (DC-05)</span><span className="font-semibold text-violet-700">{sub.lastMover ? 'Yes' : 'No'}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Pricing (DC-07)</span><span className="font-semibold text-violet-700">{sub.pricingPower}</span></div>
                      <div className="flex justify-between"><span className="text-violet-600">Adj Rent (DC-11)</span><span className="font-semibold text-violet-700">${sub.supplyAdjRent.toLocaleString()}</span></div>
                      <hr className="border-blue-100" />
                      <div className="flex justify-between"><span className="text-blue-600">Traffic (T-02)</span><span className="font-semibold text-blue-700">{sub.physicalTraffic}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-4">
                  <h4 className="text-sm font-semibold text-violet-800 mb-2">DC-03 Supply Constraint Comparison</h4>
                  <div className="space-y-2">
                    {comparedSubmarkets.map(sub => (
                      <div key={sub.name} className="flex items-center gap-2">
                        <span className="text-xs text-violet-600 w-28 truncate">{sub.name}</span>
                        <div className="flex-1 h-4 bg-violet-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${sub.supplyConstraint}%` }} />
                        </div>
                        <span className="text-xs font-bold text-violet-700 w-8 text-right">{sub.supplyConstraint}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-4">
                  <h4 className="text-sm font-semibold text-violet-800 mb-2">DC-07 Pricing Power Comparison</h4>
                  <div className="space-y-2">
                    {comparedSubmarkets.map(sub => (
                      <div key={sub.name} className="flex items-center gap-2">
                        <span className="text-xs text-violet-600 w-28 truncate">{sub.name}</span>
                        <div className="flex-1 h-4 bg-violet-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${sub.pricingPower}%` }} />
                        </div>
                        <span className="text-xs font-bold text-violet-700 w-8 text-right">{sub.pricingPower}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmarketsTab;
