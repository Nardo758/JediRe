/**
 * Market Research Page V2 - Full Design Spec Implementation
 * 
 * Global market research dashboard with 5 comprehensive tabs
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Building2, 
  Users, 
  Package, 
  Activity,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { MarketResearchLayout } from '../components/market-research/MarketResearchLayout';
import { HeroMetrics, MetricCard } from '../components/market-research/HeroMetrics';
import { InsightCard } from '../components/market-research/InsightCard';
import { SubmarketLeaderboard } from '../components/market-research/SubmarketLeaderboard';

type TabType = 'overview' | 'comparables' | 'demographics' | 'supply-demand' | 'traffic';

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'comparables', label: 'Comparables', icon: <Building2 className="w-4 h-4" /> },
  { id: 'demographics', label: 'Demographics', icon: <Users className="w-4 h-4" /> },
  { id: 'supply-demand', label: 'Supply & Demand', icon: <Package className="w-4 h-4" /> },
  { id: 'traffic', label: 'Traffic Analysis', icon: <Activity className="w-4 h-4" /> },
];

// Mock submarket performance data
const mockSubmarkets = [
  {
    id: 'buckhead',
    name: 'Buckhead',
    propertyCount: 42,
    metrics: {
      rentGrowth: 6.8,
      vacancyRate: 4.2,
      demandScore: 92,
      supplyPipeline: 28,
    },
    compositeScore: 88,
    rank: 1,
  },
  {
    id: 'midtown',
    name: 'Midtown',
    propertyCount: 38,
    metrics: {
      rentGrowth: 5.9,
      vacancyRate: 5.8,
      demandScore: 85,
      supplyPipeline: 35,
    },
    compositeScore: 82,
    rank: 2,
  },
  {
    id: 'sandy-springs',
    name: 'Sandy Springs',
    propertyCount: 26,
    metrics: {
      rentGrowth: 4.5,
      vacancyRate: 6.1,
      demandScore: 78,
      supplyPipeline: 42,
    },
    compositeScore: 74,
    rank: 3,
  },
  {
    id: 'downtown',
    name: 'Downtown',
    propertyCount: 35,
    metrics: {
      rentGrowth: 3.2,
      vacancyRate: 8.5,
      demandScore: 68,
      supplyPipeline: 58,
    },
    compositeScore: 62,
    rank: 4,
  },
  {
    id: 'decatur',
    name: 'Decatur',
    propertyCount: 18,
    metrics: {
      rentGrowth: 4.1,
      vacancyRate: 7.2,
      demandScore: 72,
      supplyPipeline: 45,
    },
    compositeScore: 68,
    rank: 5,
  },
];

// Mock data - to be replaced with real API calls
const mockData = {
  marketName: 'Atlanta',
  confidence: 'HIGH',
  sources: 4,
  lastUpdated: 'Feb 15, 2026',
  
  quickStats: {
    existingUnits: '900',
    pipeline: '425',
    futureSupply: '1,911',
    occupancy: '94.5%',
    rentGrowth: '+5.2%',
    population: '506,811',
    medianIncome: '$68,500'
  },

  overview: {
    avgRent: 1850,
    rentGrowth: 5.2,
    vacancyRate: 6.8,
    absorption: 420,
    newDeliveries: 245,
    avgConcession: 500,
  },

  comparables: [
    {
      id: 1,
      name: 'Park Avenue Apartments',
      units: 240,
      rent: 1920,
      occupancy: 95,
      distance: 0.8,
      similarity: 92,
    },
    {
      id: 2,
      name: 'Skyline Towers',
      units: 180,
      rent: 2100,
      occupancy: 92,
      distance: 1.2,
      similarity: 88,
    },
    {
      id: 3,
      name: 'Riverside Commons',
      units: 320,
      rent: 1750,
      occupancy: 97,
      distance: 1.5,
      similarity: 85,
    },
  ],

  demographics: {
    population: 506811,
    medianIncome: 68500,
    renterPercentage: 58,
    medianAge: 32,
    householdSize: 2.3,
    growthRate: 2.1,
  },

  supply: {
    existing: 900,
    underConstruction: 245,
    permitted: 180,
    vacantParcels: 1200,
    underutilized: 711,
    totalFuture: 2336,
    absorptionRate: 201,
    yearsToAbsorb: 11.6,
  },

  traffic: {
    weeklyWalkins: 2847,
    dailyAverage: 407,
    confidence: 78,
    revenueEstimate: 15372,
    peakHours: ['12pm-2pm', '5pm-7pm'],
  }
};

export function MarketDataPageV2() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedSubmarket, setSelectedSubmarket] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Get current submarket name for display
  const currentSubmarketName = selectedSubmarket === 'all' 
    ? 'All Atlanta' 
    : mockSubmarkets.find(s => s.id === selectedSubmarket)?.name || 'Atlanta';

  const quickStats = [
    {
      label: 'Existing Supply',
      value: mockData.quickStats.existingUnits,
      change: 'Current market',
      status: 'neutral' as const,
    },
    {
      label: 'Pipeline (0-2Y)',
      value: mockData.quickStats.pipeline,
      change: '47% ratio',
      status: 'warning' as const,
    },
    {
      label: 'Occupancy',
      value: mockData.quickStats.occupancy,
      change: 'Strong demand',
      status: 'good' as const,
    },
    {
      label: 'Rent Growth',
      value: mockData.quickStats.rentGrowth,
      change: 'YoY',
      status: 'good' as const,
    },
  ];

  const relatedLinks = [
    { label: 'JEDI Score', href: '/jedi-score', icon: '🎯' },
    { label: 'Traffic Analysis', href: '/traffic', icon: '🚦' },
    { label: 'Financial Models', href: '/financial', icon: '💰' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={mockData} />;
      case 'comparables':
        return <ComparablesTab data={mockData} />;
      case 'demographics':
        return <DemographicsTab data={mockData} />;
      case 'supply-demand':
        return <SupplyDemandTab data={mockData} />;
      case 'traffic':
        return <TrafficTab data={mockData} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Market Research</h1>
            <p className="text-sm text-gray-600 mt-1">
              {currentSubmarketName} • Generated: {mockData.lastUpdated} • Confidence: {mockData.confidence} ({mockData.sources}/5 sources)
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <MarketResearchLayout
        quickStats={quickStats}
        relatedLinks={relatedLinks}
        onRegenerate={() => console.log('Regenerate')}
        onExport={() => console.log('Export PDF')}
        onShare={() => console.log('Share')}
      >
        <div className="p-6">
          {/* Submarket Leaderboard */}
          <SubmarketLeaderboard
            city="Atlanta"
            submarkets={mockSubmarkets}
            selectedSubmarket={selectedSubmarket}
            onSubmarketChange={setSelectedSubmarket}
          />

          {/* Tab Content */}
          {renderTabContent()}
        </div>
      </MarketResearchLayout>
    </div>
  );
}

// Tab Components

function OverviewTab({ data }: { data: typeof mockData }) {
  const metrics: MetricCard[] = [
    {
      label: 'Avg Rent',
      value: `$${data.overview.avgRent.toLocaleString()}`,
      subtitle: `+${data.overview.rentGrowth}% YoY`,
      status: 'good',
      icon: <TrendingUp className="w-5 h-5 text-green-600" />,
    },
    {
      label: 'Vacancy Rate',
      value: `${data.overview.vacancyRate}%`,
      subtitle: 'Strong demand',
      status: 'good',
      icon: <Building2 className="w-5 h-5 text-green-600" />,
    },
    {
      label: 'Absorption',
      value: `${data.overview.absorption}`,
      subtitle: 'Units/year',
      status: 'neutral',
      icon: <Activity className="w-5 h-5 text-blue-600" />,
    },
    {
      label: 'New Deliveries',
      value: `${data.overview.newDeliveries}`,
      subtitle: 'Under construction',
      status: 'warning',
      icon: <Package className="w-5 h-5 text-yellow-600" />,
    },
  ];

  return (
    <div>
      <HeroMetrics metrics={metrics} />

      {/* Rent Trend Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Rent Growth Trends</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>Interactive chart will display here</p>
            <p className="text-sm text-gray-400 mt-1">
              12-month rent history by bedroom type
            </p>
          </div>
        </div>
      </div>

      {/* Market Health Score */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Market Health Score</h3>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl font-bold text-green-600">82/100</span>
            <span className="text-sm font-medium text-green-600">✅ HEALTHY</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-green-600 h-3 rounded-full" style={{ width: '82%' }}></div>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Occupancy', value: 94.5, points: 20 },
            { label: 'Rent Growth', value: 70, points: 15 },
            { label: 'Low Concessions', value: 40, points: 10 },
            { label: 'Demand Signals', value: 100, points: 20 },
          ].map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{item.label}</span>
                <span className="text-gray-600">{item.value}% (+{item.points} pts)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${item.value}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <InsightCard
        title="MARKET OVERVIEW INSIGHTS"
        insights={[
          'Strong fundamentals with 94.5% occupancy and healthy rent growth',
          'Low vacancy indicates undersupplied market',
          'Moderate pipeline risk (47% of existing)',
          'Rent growth accelerating (+5.2% YoY)',
        ]}
        recommendation="Current opportunity exists with strong demand fundamentals. Monitor new construction pipeline for potential oversupply in 2-3 years."
      />
    </div>
  );
}

function ComparablesTab({ data }: { data: typeof mockData }) {
  const metrics: MetricCard[] = [
    {
      label: 'Comparables Found',
      value: data.comparables.length.toString(),
      subtitle: 'Within 2 miles',
      status: 'neutral',
    },
    {
      label: 'Avg Rent',
      value: `$${Math.round(data.comparables.reduce((sum, c) => sum + c.rent, 0) / data.comparables.length)}`,
      subtitle: 'All comps',
      status: 'neutral',
    },
    {
      label: 'Avg Occupancy',
      value: `${Math.round(data.comparables.reduce((sum, c) => sum + c.occupancy, 0) / data.comparables.length)}%`,
      subtitle: 'Strong demand',
      status: 'good',
    },
    {
      label: 'Similarity Score',
      value: `${Math.round(data.comparables.reduce((sum, c) => sum + c.similarity, 0) / data.comparables.length)}%`,
      subtitle: 'High confidence',
      status: 'good',
    },
  ];

  return (
    <div>
      <HeroMetrics metrics={metrics} />

      {/* Comparables Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Comparable Properties</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Rent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Occupancy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Similarity
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.comparables.map((comp) => (
                <tr key={comp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{comp.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {comp.units}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    ${comp.rent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      comp.occupancy >= 95 ? 'text-green-600' :
                      comp.occupancy >= 90 ? 'text-blue-600' :
                      'text-yellow-600'
                    }`}>
                      {comp.occupancy}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {comp.distance} mi
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${comp.similarity}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">{comp.similarity}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InsightCard
        title="COMPARABLES INSIGHTS"
        insights={[
          'All comps show strong occupancy (92-97%), validating market demand',
          'Rent range: $1,750-$2,100 with average $1,923',
          'High similarity scores (85-92%) indicate reliable data',
          'All properties within 1.5 miles, ensuring local market relevance',
        ]}
        recommendation="Property aligns well with market comps. Consider targeting mid-range rent ($1,850-$1,950) for optimal occupancy."
      />
    </div>
  );
}

function DemographicsTab({ data }: { data: typeof mockData }) {
  const metrics: MetricCard[] = [
    {
      label: 'Population',
      value: data.demographics.population.toLocaleString(),
      subtitle: `+${data.demographics.growthRate}% annual growth`,
      status: 'good',
      icon: <Users className="w-5 h-5 text-blue-600" />,
    },
    {
      label: 'Median Income',
      value: `$${data.demographics.medianIncome.toLocaleString()}`,
      subtitle: 'Strong purchasing power',
      status: 'good',
      icon: <TrendingUp className="w-5 h-5 text-green-600" />,
    },
    {
      label: 'Renter Percentage',
      value: `${data.demographics.renterPercentage}%`,
      subtitle: 'Target market',
      status: 'good',
      icon: <Building2 className="w-5 h-5 text-blue-600" />,
    },
    {
      label: 'Median Age',
      value: `${data.demographics.medianAge}`,
      subtitle: 'Young professionals',
      status: 'neutral',
      icon: <Users className="w-5 h-5 text-gray-600" />,
    },
  ];

  return (
    <div>
      <HeroMetrics metrics={metrics} />

      {/* Demographics Breakdown */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Household Composition</h3>
          <div className="space-y-4">
            {[
              { label: 'Single', value: 35, color: 'bg-blue-600' },
              { label: 'Couples', value: 28, color: 'bg-green-600' },
              { label: 'Families', value: 22, color: 'bg-purple-600' },
              { label: 'Roommates', value: 15, color: 'bg-yellow-600' },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="text-gray-900 font-medium">{item.value}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`${item.color} h-2 rounded-full`}
                    style={{ width: `${item.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Income Distribution</h3>
          <div className="space-y-4">
            {[
              { label: '<$50k', value: 20, color: 'bg-red-600' },
              { label: '$50k-$75k', value: 30, color: 'bg-yellow-600' },
              { label: '$75k-$100k', value: 28, color: 'bg-green-600' },
              { label: '>$100k', value: 22, color: 'bg-blue-600' },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="text-gray-900 font-medium">{item.value}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`${item.color} h-2 rounded-full`}
                    style={{ width: `${item.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <InsightCard
        title="DEMOGRAPHICS INSIGHTS"
        insights={[
          'Growing population (+2.1% annually) indicates expanding market',
          'High renter percentage (58%) provides strong tenant pool',
          'Median income of $68.5k supports rent levels',
          'Young median age (32) aligns with rental demand profile',
          'Diverse household types enable flexible unit mix strategy',
        ]}
        recommendation="Target young professionals and couples with 1BR and 2BR units. Income levels support $1,800-$2,200 rent range."
      />
    </div>
  );
}

function SupplyDemandTab({ data }: { data: typeof mockData }) {
  const metrics: MetricCard[] = [
    {
      label: 'Existing Market',
      value: data.supply.existing.toString(),
      subtitle: '18 properties',
      status: 'neutral',
    },
    {
      label: 'Pipeline (0-2Y)',
      value: data.supply.underConstruction + data.supply.permitted + '',
      subtitle: '47% ratio',
      status: 'warning',
    },
    {
      label: 'Future (2-5Y)',
      value: data.supply.vacantParcels + data.supply.underutilized + '',
      subtitle: '212% ratio',
      status: 'bad',
    },
    {
      label: 'Years to Absorb',
      value: `${data.supply.yearsToAbsorb}`,
      subtitle: 'At current rate',
      status: 'bad',
    },
  ];

  return (
    <div>
      <HeroMetrics metrics={metrics} />

      {/* Supply Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Supply Timeline</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-gray-700">NOW</div>
            <div className="flex-1">
              <div className="bg-blue-600 text-white px-4 py-3 rounded-lg">
                <div className="font-semibold">{data.supply.existing} units</div>
                <div className="text-sm opacity-90">Current market</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-gray-700">0-2 YEARS</div>
            <div className="flex-1">
              <div className="bg-yellow-600 text-white px-4 py-3 rounded-lg">
                <div className="font-semibold">+{data.supply.underConstruction + data.supply.permitted} units</div>
                <div className="text-sm opacity-90">
                  Under construction: {data.supply.underConstruction} • Permitted: {data.supply.permitted}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-gray-700">2-5 YEARS</div>
            <div className="flex-1">
              <div className="bg-red-600 text-white px-4 py-3 rounded-lg">
                <div className="font-semibold">+{data.supply.vacantParcels + data.supply.underutilized} units</div>
                <div className="text-sm opacity-90">
                  Vacant parcels: {data.supply.vacantParcels} • Underutilized: {data.supply.underutilized}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supply Breakdown Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Supply Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % of Existing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timeline
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[
                { category: 'Current Market', units: data.supply.existing, percent: 100, timeline: 'Now', status: 'neutral' },
                { category: 'Under Construction', units: data.supply.underConstruction, percent: Math.round((data.supply.underConstruction / data.supply.existing) * 100), timeline: '6-12 mo', status: 'warning' },
                { category: 'Permitted', units: data.supply.permitted, percent: Math.round((data.supply.permitted / data.supply.existing) * 100), timeline: '12-24 mo', status: 'warning' },
                { category: 'Vacant Parcels', units: data.supply.vacantParcels, percent: Math.round((data.supply.vacantParcels / data.supply.existing) * 100), timeline: '2-3 years', status: 'bad' },
                { category: 'Underutilized', units: data.supply.underutilized, percent: Math.round((data.supply.underutilized / data.supply.existing) * 100), timeline: '3-5 years', status: 'bad' },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {row.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {row.units.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      row.status === 'bad' ? 'text-red-600' :
                      row.status === 'warning' ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      {row.percent}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {row.timeline}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InsightCard
        title="SUPPLY & DEMAND INSIGHTS"
        insights={[
          'Market is UNDERSUPPLIED today (5.5% vacancy)',
          'Pipeline adds 47% of existing market in 2 years (MEDIUM RISK)',
          'Long-term: 1,911 buildable units = 212% of existing (HIGH RISK)',
          'Absorption rate: 201 units/year',
          'Time to absorb all future supply: 11.6 years',
        ]}
        recommendation="Current opportunity exists with strong demand, but monitor future supply carefully. Consider shorter hold period (5-7 years) to exit before potential oversupply materializes."
      />
    </div>
  );
}

function TrafficTab({ data }: { data: typeof mockData }) {
  const metrics: MetricCard[] = [
    {
      label: 'Weekly Walk-ins',
      value: data.traffic.weeklyWalkins.toLocaleString(),
      subtitle: 'Predicted foot traffic',
      status: 'good',
      icon: <Activity className="w-5 h-5 text-green-600" />,
    },
    {
      label: 'Daily Average',
      value: data.traffic.dailyAverage.toString(),
      subtitle: 'Walk-ins per day',
      status: 'neutral',
      icon: <Users className="w-5 h-5 text-blue-600" />,
    },
    {
      label: 'Confidence',
      value: `${data.traffic.confidence}%`,
      subtitle: 'High',
      status: 'good',
      icon: <TrendingUp className="w-5 h-5 text-green-600" />,
    },
    {
      label: 'Revenue Est.',
      value: `$${data.traffic.revenueEstimate.toLocaleString()}`,
      subtitle: 'Weekly potential',
      status: 'neutral',
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
    },
  ];

  return (
    <div>
      <HeroMetrics metrics={metrics} />

      {/* Traffic Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Traffic Breakdown</h3>
        <div className="grid grid-cols-7 gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
            const traffic = [380, 390, 410, 420, 450, 480, 317][idx];
            const maxTraffic = 480;
            const height = (traffic / maxTraffic) * 100;
            
            return (
              <div key={day} className="text-center">
                <div className="h-32 flex flex-col justify-end mb-2">
                  <div 
                    className="bg-blue-600 rounded-t"
                    style={{ height: `${height}%` }}
                  ></div>
                </div>
                <div className="text-xs font-medium text-gray-700">{day}</div>
                <div className="text-xs text-gray-500">{traffic}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Peak Hours */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Peak Hours</h3>
        <div className="space-y-3">
          {data.traffic.peakHours.map((hours, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">{hours}</div>
                <div className="text-sm text-gray-600">High foot traffic expected</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <InsightCard
        title="TRAFFIC ANALYSIS INSIGHTS"
        insights={[
          'Property will generate 2,847 weekly walk-ins with 78% confidence',
          'Friday and Saturday show highest traffic (450-480 walk-ins)',
          'Peak hours: Lunch (12-2pm) and Evening (5-7pm)',
          'Estimated weekly revenue potential: $15,372',
          'Traffic supports robust leasing activity and tenant acquisition',
        ]}
        recommendation="Staff leasing office during peak hours (12-2pm, 5-7pm) to maximize conversions. Consider extended weekend hours for optimal capture."
      />
    </div>
  );
}
