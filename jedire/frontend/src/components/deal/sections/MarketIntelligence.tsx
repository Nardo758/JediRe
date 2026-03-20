import React, { useState, useEffect } from 'react';
import { apiClient } from '@/services/api.client';

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

interface SubmarketData {
  name: string;
  properties_count: number;
  total_units: number;
  vacancy_rate: number;
  avg_rent: number;
  rent_growth_30d: number;
  market_pressure: string;
  avg_opportunity_score: number;
  negotiation_success_rate: number;
}

interface TrendObservation {
  date: string;
  avg_rent: number;
  vacancy_rate: number;
  total_supply: number;
  available_units: number;
  listings_active: number;
  avg_opportunity_score: number;
  concessions_prevalence: number;
  avg_days_on_market: number;
  negotiation_success_rate: number;
  search_activity_index: number;
  application_volume: number;
  seasonal_factor: number;
}

function buildVitalsFromData(
  snapshot: any,
  trends: TrendObservation[],
  submarkets: SubmarketData[]
): MarketVital[] {
  const sortedTrends = [...trends].sort((a, b) => a.date.localeCompare(b.date));
  const rentHistory = sortedTrends.map(t => t.avg_rent);
  const vacancyHistory = sortedTrends.map(t => t.vacancy_rate * 100);
  const absorptionHistory = sortedTrends.map(t => t.total_supply - t.available_units);
  const rentGrowthHistory = sortedTrends.map((t, i) => {
    if (i === 0) return 0;
    return ((t.avg_rent - sortedTrends[i-1].avg_rent) / sortedTrends[i-1].avg_rent) * 100;
  });

  const latestRent = rentHistory.length > 0 ? rentHistory[rentHistory.length - 1] : 0;
  const latestVacancy = vacancyHistory.length > 0 ? vacancyHistory[vacancyHistory.length - 1] : 0;
  const firstVacancy = vacancyHistory.length > 0 ? vacancyHistory[0] : 0;

  const totalProps = submarkets.reduce((s, sm) => s + sm.properties_count, 0);
  const totalUnits = submarkets.reduce((s, sm) => s + sm.total_units, 0);
  const weightedAvgRent = totalUnits > 0
    ? submarkets.reduce((s, sm) => s + sm.avg_rent * sm.total_units, 0) / totalUnits
    : latestRent;

  const rentGrowth90d = snapshot?.rent_growth_90d ? (parseFloat(snapshot.rent_growth_90d) * 100).toFixed(1) : '0.0';
  const vacancyDir: 'up' | 'down' | 'flat' = latestVacancy < firstVacancy ? 'down' : latestVacancy > firstVacancy ? 'up' : 'flat';

  const avgAbsorption = absorptionHistory.length > 0
    ? Math.round(absorptionHistory.reduce((s, v) => s + v, 0) / absorptionHistory.length)
    : 0;

  const submarketScores = submarkets.map(sm => {
    const rentWeight = sm.rent_growth_30d > 0 ? 1 : 0;
    const vacWeight = sm.vacancy_rate < 0.08 ? 1 : 0;
    return (rentWeight + vacWeight) / 2;
  });
  const avgSubScore = submarketScores.length > 0
    ? Math.round((submarketScores.reduce((s, v) => s + v, 0) / submarketScores.length) * 100)
    : 50;

  return [
    {
      id: 'avg-rent',
      label: 'Avg Effective Rent',
      value: `$${Math.round(weightedAvgRent).toLocaleString()}/mo`,
      trend: `+${rentGrowth90d}% (90d)`,
      trendDirection: parseFloat(rentGrowth90d) > 0 ? 'up' : parseFloat(rentGrowth90d) < 0 ? 'down' : 'flat',
      sparklineData: rentHistory.length > 0 ? rentHistory : [0],
      formula: 'Unit-weighted avg across submarkets',
      source: 'Apartment Locator AI',
    },
    {
      id: 'vacancy',
      label: 'Vacancy Rate',
      value: `${latestVacancy.toFixed(1)}%`,
      trend: `from ${firstVacancy.toFixed(1)}% 12wk ago`,
      trendDirection: vacancyDir,
      sparklineData: vacancyHistory.length > 0 ? vacancyHistory : [0],
      formula: 'Available units / total units in trade area',
      source: 'Apartment Locator AI',
    },
    {
      id: 'absorption',
      label: 'Avg Absorbed Units',
      value: `${avgAbsorption.toLocaleString()} units`,
      trend: 'Weekly average',
      trendDirection: 'flat',
      sparklineData: absorptionHistory.length > 0 ? absorptionHistory : [0],
      formula: 'Total supply - available units per observation',
      source: 'Apartment Locator AI',
    },
    {
      id: 'rent-growth',
      label: 'Rent Growth Trend',
      value: `+${rentGrowth90d}%`,
      trend: parseFloat(rentGrowth90d) > 2 ? 'Accelerating' : 'Steady',
      trendDirection: parseFloat(rentGrowth90d) > 0 ? 'up' : 'flat',
      sparklineData: rentGrowthHistory.length > 1 ? rentGrowthHistory.slice(1) : [0],
      formula: '90-day rolling rent change',
      source: 'Apartment Locator AI',
    },
    {
      id: 'submarket-rank',
      label: 'Submarket Strength',
      value: `${avgSubScore}th pctl`,
      trend: avgSubScore >= 75 ? 'Top quartile' : avgSubScore >= 50 ? 'Above median' : 'Below median',
      trendDirection: avgSubScore >= 50 ? 'up' : 'down',
      sparklineData: submarketScores.map(s => s * 100),
      formula: 'Composite: rent growth + vacancy score',
      source: 'Apartment Locator AI',
    },
  ];
}

interface DemandData {
  userStats: any;
  demandSignals: any;
  searchTrends: any;
  userPreferences: any;
}

export const MarketIntelligence: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketVitals, setMarketVitals] = useState<MarketVital[]>([]);
  const [submarkets, setSubmarkets] = useState<SubmarketData[]>([]);
  const [rentComps, setRentComps] = useState<RentComp[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [demandData, setDemandData] = useState<DemandData | null>(null);
  const [demandLoading, setDemandLoading] = useState(true);

  useEffect(() => {
    loadMarketData();
  }, []);

  useEffect(() => {
    loadDemandData();
  }, []);

  const loadDemandData = async () => {
    setDemandLoading(true);
    try {
      const res = await apiClient.get('/api/v1/apartment-sync/user-analytics');
      const entries = res.data?.data || res.data || [];
      const parsed: DemandData = {
        userStats: null,
        demandSignals: null,
        searchTrends: null,
        userPreferences: null,
      };
      for (const entry of entries) {
        const type = entry.analytics_type || entry.data_type;
        const data = typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data;
        if (type === 'user-stats') parsed.userStats = data;
        else if (type === 'demand-signals') parsed.demandSignals = data;
        else if (type === 'search-trends') parsed.searchTrends = data;
        else if (type === 'user-preferences') parsed.userPreferences = data;
      }
      setDemandData(parsed);
    } catch (err) {
      console.error('Failed to load demand data:', err);
    } finally {
      setDemandLoading(false);
    }
  };

  const loadMarketData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapshotsRes, trendsRes, submarketsRes, compsRes] = await Promise.allSettled([
        apiClient.get('/api/v1/apartment-sync/market-snapshots', { params: { city: 'Atlanta', state: 'GA' } }),
        apiClient.get('/api/v1/apartment-sync/trends', { params: { city: 'Atlanta' } }),
        apiClient.get('/api/v1/apartment-sync/submarkets', { params: { city: 'Atlanta' } }),
        apiClient.get('/api/v1/apartment-sync/rent-comps', { params: { city: 'Atlanta', state: 'GA' } }),
      ]);

      const snapshotData = snapshotsRes.status === 'fulfilled' ? snapshotsRes.value.data?.data?.[0] : null;
      setSnapshot(snapshotData);

      let trendObs: TrendObservation[] = [];
      if (trendsRes.status === 'fulfilled') {
        const trendsRaw = trendsRes.value.data?.data?.[0];
        if (trendsRaw?.data) {
          const parsed = typeof trendsRaw.data === 'string' ? JSON.parse(trendsRaw.data) : trendsRaw.data;
          trendObs = parsed.observations || parsed.data?.observations || [];
        }
      }

      let subData: SubmarketData[] = [];
      if (submarketsRes.status === 'fulfilled') {
        const subRaw = submarketsRes.value.data?.data?.[0];
        if (subRaw?.data) {
          const parsed = typeof subRaw.data === 'string' ? JSON.parse(subRaw.data) : subRaw.data;
          subData = parsed.submarkets || parsed || [];
        }
      }
      setSubmarkets(subData);

      let compData: RentComp[] = [];
      if (compsRes.status === 'fulfilled') {
        const rawComps = compsRes.value.data?.data || [];
        compData = rawComps.map((c: any, i: number) => ({
          id: `rc-${i}`,
          name: c.property_name || c.name || `Property ${i + 1}`,
          isSubject: false,
          distance: 0,
          units: c.total_units || 0,
          yearBuilt: c.year_built || 0,
          avgRent: parseFloat(c.rent) || 0,
          rentPSF: parseFloat(c.rent_per_sqft) || 0,
          occupancy: parseFloat(c.occupancy) || 0,
          amenityScore: 0,
          amenityMax: 10,
          premiumDiscount: 0,
        }));
      }

      if (compData.length === 0 && subData.length > 0) {
        compData = subData.map((sm, i) => ({
          id: `sm-${i}`,
          name: `${sm.name} Submarket`,
          isSubject: false,
          distance: 0,
          units: sm.total_units,
          yearBuilt: 0,
          avgRent: sm.avg_rent,
          rentPSF: 0,
          occupancy: (1 - sm.vacancy_rate) * 100,
          amenityScore: Math.round(sm.avg_opportunity_score),
          amenityMax: 10,
          premiumDiscount: 0,
        }));
        const avgRent = compData.reduce((s, c) => s + c.avgRent, 0) / compData.length;
        compData = compData.map(c => ({
          ...c,
          premiumDiscount: Math.round(((c.avgRent - avgRent) / avgRent) * 1000) / 10,
        }));
      }
      setRentComps(compData);

      const vitals = buildVitalsFromData(snapshotData, trendObs, subData);
      setMarketVitals(vitals);
    } catch (err: any) {
      console.error('Failed to load market data:', err);
      setError(err.message || 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
          <div className="text-lg font-semibold">Is this submarket getting stronger or weaker — and how fast?</div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-stone-200 rounded w-48 mx-auto mb-3"></div>
            <div className="text-xs text-stone-400">Loading market intelligence from Apartment Locator AI...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
          <div className="text-lg font-semibold">Is this submarket getting stronger or weaker — and how fast?</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-800 font-medium mb-2">Failed to load market data</div>
          <div className="text-xs text-red-600 mb-3">{error}</div>
          <button
            onClick={loadMarketData}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const avgCompRent = rentComps.length > 0
    ? rentComps.reduce((sum, c) => sum + c.avgRent, 0) / rentComps.length
    : 0;

  const totalProps = submarkets.reduce((s, sm) => s + sm.properties_count, 0);
  const totalUnits = submarkets.reduce((s, sm) => s + sm.total_units, 0);

  const momentumSignal = marketVitals.find(v => v.id === 'rent-growth');
  const momentumLabel = momentumSignal && parseFloat(momentumSignal.value) > 2 ? 'STRONG' :
    momentumSignal && parseFloat(momentumSignal.value) > 0 ? 'MODERATE' : 'WEAK';

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
        <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">Is this submarket getting stronger or weaker — and how fast?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Market Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">LIVE DATA</span>
            <span className="text-[10px] text-stone-400">{totalProps} properties | {totalUnits.toLocaleString()} units tracked</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {marketVitals.map(vital => (
            <div key={vital.id} className="border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{vital.label}</div>
              <div className="text-xl font-bold text-stone-900">{vital.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] font-medium ${
                  vital.trendDirection === 'up' ? 'text-emerald-600' :
                  vital.trendDirection === 'down' ? (vital.id === 'vacancy' ? 'text-emerald-600' : 'text-red-500') :
                  'text-stone-500'
                }`}>
                  {vital.trendDirection === 'up' ? '\u2191' : vital.trendDirection === 'down' ? '\u2193' : '\u2192'} {vital.trend}
                </span>
              </div>
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
            Tracking {submarkets.length} submarkets with {totalProps} properties and {totalUnits.toLocaleString()} total units.
            {' '}Momentum signal: <span className="font-bold">{momentumLabel}</span>.
            {submarkets.length > 0 && (
              <> Top submarket: {submarkets.sort((a, b) => b.avg_rent - a.avg_rent)[0]?.name} (${submarkets.sort((a, b) => b.avg_rent - a.avg_rent)[0]?.avg_rent.toLocaleString()} avg rent).</>
            )}
          </p>
        </div>
      </div>

      {submarkets.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="text-lg font-bold text-stone-900 mb-4">Submarket Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-stone-200 text-[10px] font-mono text-stone-400">
                  <th className="text-left py-2 px-2">Submarket</th>
                  <th className="text-right py-2 px-2">Properties</th>
                  <th className="text-right py-2 px-2">Units</th>
                  <th className="text-right py-2 px-2">Avg Rent</th>
                  <th className="text-right py-2 px-2">Vacancy</th>
                  <th className="text-right py-2 px-2">Rent Growth (30d)</th>
                  <th className="text-right py-2 px-2">Opportunity</th>
                  <th className="text-right py-2 px-2">Pressure</th>
                </tr>
              </thead>
              <tbody>
                {submarkets.map((sm, idx) => (
                  <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-2 px-2 font-medium text-stone-900">{sm.name}</td>
                    <td className="text-right py-2 px-2 text-stone-600">{sm.properties_count}</td>
                    <td className="text-right py-2 px-2 text-stone-600">{sm.total_units.toLocaleString()}</td>
                    <td className="text-right py-2 px-2 font-mono text-stone-900">${sm.avg_rent.toLocaleString()}</td>
                    <td className="text-right py-2 px-2 text-stone-600">{(sm.vacancy_rate * 100).toFixed(1)}%</td>
                    <td className={`text-right py-2 px-2 font-mono font-semibold ${
                      sm.rent_growth_30d > 0 ? 'text-emerald-600' : sm.rent_growth_30d < 0 ? 'text-red-500' : 'text-stone-500'
                    }`}>
                      {sm.rent_growth_30d > 0 ? '+' : ''}{(sm.rent_growth_30d * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-2 px-2 text-stone-600">{sm.avg_opportunity_score.toFixed(1)}/10</td>
                    <td className="text-right py-2 px-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        sm.market_pressure === 'seller_market' ? 'bg-emerald-100 text-emerald-700' :
                        sm.market_pressure === 'buyer_market' ? 'bg-red-100 text-red-700' :
                        'bg-stone-100 text-stone-600'
                      }`}>
                        {sm.market_pressure.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rentComps.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-stone-900">
              {rentComps[0]?.name?.includes('Submarket') ? 'Submarket Rent Analysis' : 'Rent Comp Analysis'}
            </h3>
            {avgCompRent > 0 && (
              <div className="text-xs text-stone-500">
                Market avg: <span className="font-bold text-amber-700">${Math.round(avgCompRent).toLocaleString()}</span>/mo
              </div>
            )}
          </div>
          <p className="text-xs text-stone-500 mb-4">
            {rentComps[0]?.name?.includes('Submarket')
              ? 'Aggregated submarket data — individual property comps will appear once property data syncs.'
              : 'Individual property comparables from Apartment Locator AI.'}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-stone-200 text-[10px] font-mono text-stone-400">
                  <th className="text-left py-2 px-2">Property</th>
                  <th className="text-right py-2 px-2">Units</th>
                  {rentComps.some(c => c.yearBuilt > 0) && <th className="text-right py-2 px-2">Year</th>}
                  <th className="text-right py-2 px-2">Avg Rent</th>
                  {rentComps.some(c => c.rentPSF > 0) && <th className="text-right py-2 px-2">$/SF</th>}
                  <th className="text-right py-2 px-2">Occ</th>
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
                    <td className="text-right py-2 px-2 text-stone-600">{comp.units > 0 ? comp.units.toLocaleString() : '--'}</td>
                    {rentComps.some(c => c.yearBuilt > 0) && (
                      <td className="text-right py-2 px-2 text-stone-600">{comp.yearBuilt > 0 ? comp.yearBuilt : '--'}</td>
                    )}
                    <td className="text-right py-2 px-2 font-mono text-stone-900">${comp.avgRent.toLocaleString()}</td>
                    {rentComps.some(c => c.rentPSF > 0) && (
                      <td className="text-right py-2 px-2 font-mono text-stone-600">{comp.rentPSF > 0 ? `$${comp.rentPSF.toFixed(2)}` : '--'}</td>
                    )}
                    <td className="text-right py-2 px-2 text-stone-600">{comp.occupancy > 0 ? `${comp.occupancy.toFixed(1)}%` : '--'}</td>
                    <td className={`text-right py-2 px-2 font-mono font-semibold ${
                      comp.premiumDiscount > 0 ? 'text-emerald-600' : comp.premiumDiscount < 0 ? 'text-red-500' : 'text-stone-500'
                    }`}>
                      {comp.premiumDiscount > 0 ? '+' : ''}{comp.premiumDiscount.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {demandLoading ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-stone-200 rounded w-48 mx-auto mb-3"></div>
            <div className="text-xs text-stone-400">Loading demand intelligence...</div>
          </div>
        </div>
      ) : demandData && (demandData.userStats || demandData.demandSignals || demandData.searchTrends) ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-stone-900">Demand Intelligence</h3>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono tracking-widest">DEMAND DATA</span>
          </div>

          {demandData.userStats && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="border border-stone-200 rounded-lg p-3">
                <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">Active Renters (30d)</div>
                <div className="text-2xl font-bold text-stone-900">{(demandData.userStats.activeUsers30d || 0).toLocaleString()}</div>
              </div>
              <div className="border border-stone-200 rounded-lg p-3">
                <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">Total Users</div>
                <div className="text-2xl font-bold text-stone-900">{(demandData.userStats.totalUsers || 0).toLocaleString()}</div>
              </div>
              <div className="border border-stone-200 rounded-lg p-3">
                <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">Renters vs Landlords</div>
                <div className="text-sm font-bold text-stone-900 mt-1">
                  {demandData.userStats.byType ? (
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600">{(demandData.userStats.byType.renter || 0).toLocaleString()} renters</span>
                      <span className="text-stone-300">|</span>
                      <span className="text-stone-600">{(demandData.userStats.byType.landlord || 0).toLocaleString()} landlords</span>
                    </div>
                  ) : '--'}
                </div>
              </div>
            </div>
          )}

          {demandData.demandSignals?.budgetDistribution && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-stone-700 mb-3">Budget Distribution</div>
              <div className="space-y-2">
                {Object.entries(demandData.demandSignals.budgetDistribution).map(([range, count]: [string, any]) => {
                  const allCounts = Object.values(demandData.demandSignals.budgetDistribution) as number[];
                  const maxCount = Math.max(...allCounts, 1);
                  const pct = (Number(count) / maxCount) * 100;
                  return (
                    <div key={range} className="flex items-center gap-3">
                      <div className="w-28 text-[11px] font-mono text-stone-500 text-right shrink-0">{range}</div>
                      <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(pct, 8)}%` }}
                        >
                          <span className="text-[10px] font-bold text-white">{Number(count).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-6">
            {demandData.demandSignals?.bedroomPreferences && (
              <div>
                <div className="text-xs font-semibold text-stone-700 mb-3">Top Unit Types</div>
                <div className="space-y-2">
                  {Object.entries(demandData.demandSignals.bedroomPreferences).map(([type, count]: [string, any]) => {
                    const allCounts = Object.values(demandData.demandSignals.bedroomPreferences) as number[];
                    const maxCount = Math.max(...allCounts, 1);
                    const pct = (Number(count) / maxCount) * 100;
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <div className="w-16 text-[11px] font-mono text-stone-500 text-right shrink-0">{type}</div>
                        <div className="flex-1 bg-stone-100 rounded h-4 overflow-hidden">
                          <div
                            className="h-full bg-stone-700 rounded"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <div className="w-10 text-[10px] font-mono text-stone-500 text-right">{Number(count).toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {demandData.demandSignals?.moveInTimelines && (
              <div>
                <div className="text-xs font-semibold text-stone-700 mb-3">Move-in Timeline</div>
                <div className="space-y-2">
                  {Object.entries(demandData.demandSignals.moveInTimelines).map(([timeline, count]: [string, any]) => {
                    const allCounts = Object.values(demandData.demandSignals.moveInTimelines) as number[];
                    const maxCount = Math.max(...allCounts, 1);
                    const pct = (Number(count) / maxCount) * 100;
                    return (
                      <div key={timeline} className="flex items-center gap-2">
                        <div className="w-24 text-[11px] font-mono text-stone-500 text-right shrink-0">{timeline}</div>
                        <div className="flex-1 bg-stone-100 rounded h-4 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <div className="w-10 text-[10px] font-mono text-stone-500 text-right">{Number(count).toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {demandData.demandSignals?.topAmenities && demandData.demandSignals.topAmenities.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-stone-700 mb-3">Top Amenity Searches</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {demandData.demandSignals.topAmenities.slice(0, 8).map((amenity: any, idx: number) => {
                  const name = amenity.name || amenity.amenity || amenity.label || '';
                  const count = amenity.count || amenity.searches || amenity.value || 0;
                  return (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-stone-100">
                      <span className="text-xs text-stone-700">{name}</span>
                      <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{Number(count).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {demandData.searchTrends?.unmetDemand && demandData.searchTrends.unmetDemand.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-700 mb-3">Unmet Demand — Locations with Searches but No Matches</div>
              <div className="grid grid-cols-3 gap-2">
                {demandData.searchTrends.unmetDemand.map((item: any, idx: number) => {
                  const location = item.location || item.area || item.name || item;
                  const searches = item.searches || item.count || item.volume || 0;
                  return (
                    <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                      <div className="text-xs font-medium text-red-800">{typeof location === 'string' ? location : JSON.stringify(location)}</div>
                      {searches > 0 && (
                        <div className="text-[10px] text-red-600 mt-0.5">{Number(searches).toLocaleString()} searches, 0 matches</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default MarketIntelligence;
