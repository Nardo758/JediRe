import React, { useState, useEffect } from 'react';
import { apiClient } from '@/services/api.client';

interface SupplyPressureData {
  pressureRatio: number;
  pressureLabel: string;
  monthsOfSupply: number;
  pipelineUnits: number;
  existingUnits: number;
  annualAbsorption: number;
  monthlyAbsorption: number;
  netAbsorption: number;
  demandProjected: number;
  netDemandSupply: number;
  verdict: string;
}

interface SubmarketEntry {
  name: string;
  properties_count: number;
  total_units: number;
  vacancy_rate: number;
  avg_rent: number;
  rent_growth_30d: number;
  market_pressure: string;
}

interface TrendObs {
  date: string;
  avg_rent: number;
  vacancy_rate: number;
  total_supply: number;
  available_units: number;
  listings_active: number;
  concessions_prevalence: number;
  avg_days_on_market: number;
  search_activity_index: number;
  application_volume: number;
}

function computeSupplyPressure(trends: TrendObs[], submarkets: SubmarketEntry[]): SupplyPressureData {
  const totalUnits = submarkets.reduce((s, sm) => s + sm.total_units, 0);
  const availableUnits = trends.length > 0
    ? trends.sort((a, b) => b.date.localeCompare(a.date))[0].available_units
    : Math.round(totalUnits * 0.1);

  const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
  let monthlyAbsorption = 0;
  if (sorted.length >= 2) {
    const absorptionPerWeek = sorted.slice(1).map((t, i) => {
      const prevAvail = sorted[i].available_units;
      return prevAvail - t.available_units;
    });
    const avgWeeklyAbsorption = absorptionPerWeek.reduce((s, v) => s + v, 0) / absorptionPerWeek.length;
    monthlyAbsorption = Math.round(avgWeeklyAbsorption * 4.33);
  }

  if (monthlyAbsorption <= 0) monthlyAbsorption = Math.round(totalUnits * 0.005);

  const pipelineUnits = availableUnits;
  const monthsOfSupply = monthlyAbsorption > 0 ? Math.round(pipelineUnits / monthlyAbsorption) : 0;
  const annualAbsorption = monthlyAbsorption * 12;
  const netAbsorption = monthlyAbsorption * 3;
  const pressureRatio = annualAbsorption > 0 ? Math.round((pipelineUnits / annualAbsorption) * 100) / 100 : 0;

  const demandProjected = Math.round(annualAbsorption * 1.15);
  const netDemandSupply = demandProjected - pipelineUnits;

  const pressureLabel = pressureRatio < 0.8 ? 'Low Pressure' :
    pressureRatio < 1.2 ? 'Manageable' :
    pressureRatio < 1.8 ? 'Elevated' : 'High Pressure';

  const verdictParts = [
    `${pipelineUnits.toLocaleString()} available units in the market.`,
    monthlyAbsorption > 0 ? `At current absorption (${monthlyAbsorption} units/month), the market clears them in ${monthsOfSupply} months.` : '',
    netDemandSupply > 0 ? `Net ${netDemandSupply.toLocaleString()} units of EXCESS demand.` : `Net ${Math.abs(netDemandSupply).toLocaleString()} units of EXCESS supply.`,
  ].filter(Boolean);

  return {
    pressureRatio,
    pressureLabel,
    monthsOfSupply,
    pipelineUnits,
    existingUnits: totalUnits,
    annualAbsorption,
    monthlyAbsorption,
    netAbsorption,
    demandProjected,
    netDemandSupply,
    verdict: verdictParts.join(' '),
  };
}

export const SupplyIntelligence: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplyPressure, setSupplyPressure] = useState<SupplyPressureData | null>(null);
  const [submarkets, setSubmarkets] = useState<SubmarketEntry[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendsRes, subRes] = await Promise.allSettled([
        apiClient.get('/api/v1/apartment-sync/trends', { params: { city: 'Atlanta' } }),
        apiClient.get('/api/v1/apartment-sync/submarkets', { params: { city: 'Atlanta' } }),
      ]);

      let trendObs: TrendObs[] = [];
      if (trendsRes.status === 'fulfilled') {
        const raw = trendsRes.value.data?.data?.[0];
        if (raw?.data) {
          const parsed = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data;
          trendObs = parsed.observations || [];
        }
      }

      let subData: SubmarketEntry[] = [];
      if (subRes.status === 'fulfilled') {
        const raw = subRes.value.data?.data?.[0];
        if (raw?.data) {
          const parsed = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data;
          subData = parsed.submarkets || [];
        }
      }
      setSubmarkets(subData);

      if (trendObs.length > 0 || subData.length > 0) {
        setSupplyPressure(computeSupplyPressure(trendObs, subData));
      }
    } catch (err: any) {
      console.error('Failed to load supply data:', err);
      setError(err.message || 'Failed to load supply data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
          <div className="text-lg font-semibold">Will new supply crush my rents or is the market absorbing it?</div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-stone-200 rounded w-48 mx-auto mb-3"></div>
            <div className="text-xs text-stone-400">Loading supply intelligence...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !supplyPressure) {
    return (
      <div className="space-y-5">
        <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
          <div className="text-lg font-semibold">Will new supply crush my rents or is the market absorbing it?</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-800 font-medium mb-2">No supply data available</div>
          <div className="text-xs text-red-600 mb-3">{error || 'Sync apartment data first to see supply intelligence.'}</div>
          <button onClick={loadData} className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
        <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">Will new supply crush my rents or is the market absorbing it?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-stone-900">Supply Pressure Gauge</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">LIVE DATA</span>
            <span className="text-[10px] font-mono text-stone-400 tracking-widest">PIPELINE / (EXISTING x ABSORPTION)</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-4">
          <div className="flex flex-col items-center">
            <PressureGauge value={supplyPressure.pressureRatio} />
            <div className="text-sm font-bold text-stone-900 mt-2">{supplyPressure.pressureRatio}x</div>
            <div className={`text-xs font-semibold mt-1 ${
              supplyPressure.pressureRatio < 1.0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {supplyPressure.pressureLabel}
            </div>
          </div>

          <div className="space-y-3">
            <MetricRow label="Total Market Units" value={supplyPressure.existingUnits.toLocaleString()} />
            <MetricRow label="Available Units" value={supplyPressure.pipelineUnits.toLocaleString()} />
            <MetricRow label="Monthly Absorption" value={`${supplyPressure.monthlyAbsorption} units/mo`} />
            <MetricRow label="Months to Clear" value={`${supplyPressure.monthsOfSupply} months`} />
            <MetricRow label="Quarterly Net Absorption" value={`${supplyPressure.netAbsorption} units/qtr`} />
          </div>

          <div className={`rounded-lg p-4 border ${
            supplyPressure.netDemandSupply >= 0
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-[10px] font-mono tracking-widest mb-2 ${
              supplyPressure.netDemandSupply >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>NET POSITION</div>
            <div className={`text-2xl font-bold ${
              supplyPressure.netDemandSupply >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}>
              {supplyPressure.netDemandSupply >= 0 ? '+' : ''}{supplyPressure.netDemandSupply.toLocaleString()}
            </div>
            <div className={`text-xs mt-1 ${
              supplyPressure.netDemandSupply >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              units {supplyPressure.netDemandSupply >= 0 ? 'excess demand' : 'excess supply'}
            </div>
            <div className={`mt-3 text-[11px] leading-relaxed ${
              supplyPressure.netDemandSupply >= 0 ? 'text-emerald-800' : 'text-red-800'
            }`}>
              Demand: {supplyPressure.demandProjected.toLocaleString()} projected households<br />
              Supply: {supplyPressure.pipelineUnits.toLocaleString()} available units<br />
              Net: <span className="font-bold">{supplyPressure.netDemandSupply >= 0 ? '+' : ''}{supplyPressure.netDemandSupply.toLocaleString()} units</span>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 leading-relaxed">{supplyPressure.verdict}</p>
        </div>
      </div>

      {submarkets.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="text-lg font-bold text-stone-900 mb-4">Submarket Supply Breakdown</h3>
          <div className="space-y-3">
            {submarkets.map((sm, idx) => {
              const pressureColor = sm.market_pressure === 'seller_market' ? 'border-l-emerald-500 bg-emerald-50/50' :
                sm.market_pressure === 'buyer_market' ? 'border-l-red-500 bg-red-50/50' : 'border-l-amber-500 bg-amber-50/50';
              const pressureBadge = sm.market_pressure === 'seller_market' ? 'bg-emerald-100 text-emerald-700' :
                sm.market_pressure === 'buyer_market' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

              return (
                <div key={idx} className={`border border-stone-200 border-l-4 ${pressureColor} rounded-lg p-4`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-stone-900">{sm.name}</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${pressureBadge}`}>
                          {sm.market_pressure.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-stone-500">
                        <span>{sm.properties_count} properties</span>
                        <span>{sm.total_units.toLocaleString()} units</span>
                        <span>${sm.avg_rent.toLocaleString()}/mo avg</span>
                        <span>{(sm.vacancy_rate * 100).toFixed(1)}% vacancy</span>
                        <span className={sm.rent_growth_30d > 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                          {sm.rent_growth_30d > 0 ? '+' : ''}{(sm.rent_growth_30d * 100).toFixed(1)}% rent growth
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const PressureGauge: React.FC<{ value: number }> = ({ value }) => {
  const angle = Math.min(value / 2.0, 1) * 180;
  const color = value < 0.8 ? '#10b981' : value < 1.2 ? '#d97706' : '#ef4444';

  return (
    <div className="relative" style={{ width: 120, height: 65 }}>
      <svg width="120" height="65" viewBox="0 0 120 65">
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e7e5e4" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 157} 157`}
        />
      </svg>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs text-stone-500">{label}</span>
    <span className="text-xs font-semibold font-mono text-stone-900">{value}</span>
  </div>
);

export default SupplyIntelligence;
