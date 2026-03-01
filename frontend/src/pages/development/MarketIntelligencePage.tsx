import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  TrendingUp, Users, Newspaper, FileText, Building2, MapPin,
  Briefcase, Factory, ChevronDown, ChevronUp, Upload,
  AlertTriangle, CheckCircle2, XCircle, HelpCircle,
  RefreshCw, Activity, DollarSign, Home
} from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface MarketIntelData {
  economy: any;
  demographics: any;
  news: any[];
  supplyContext: any;
  documentIntelligence: any;
}

const TABS = [
  { id: 'economy', label: 'Local Economy', icon: Briefcase },
  { id: 'documents', label: 'Document Intelligence', icon: FileText },
  { id: 'demographics', label: 'Demographics & Demand', icon: Users },
  { id: 'news', label: 'News Feed', icon: Newspaper },
] as const;

type TabId = typeof TABS[number]['id'];

export const MarketIntelligencePage: React.FC = () => {
  const { dealId: paramDealId } = useParams<{ dealId: string }>();
  const dealId = paramDealId || '';
  const [activeTab, setActiveTab] = useState<TabId>('economy');
  const [data, setData] = useState<MarketIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchData = async (refresh = false) => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/v1/deals/${dealId}/market-intelligence${refresh ? '?refresh=true' : ''}`;
      const response = await apiClient.get(url) as any;
      setData(response?.data?.data || null);
      setCached(response?.data?.cached || false);
    } catch (err: any) {
      setError(err.message || 'Failed to load market intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dealId]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => fetchData()} />;
  if (!data) return <ErrorState message="No data available" onRetry={() => fetchData()} />;

  return (
    <div className="space-y-0">
      <div className="bg-stone-900 border-l-4 border-violet-500 rounded-t-lg px-5 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-bold tracking-tight">Market Intelligence</h2>
          <p className="text-stone-400 text-xs mt-0.5">Economic drivers, demand signals, and competitive landscape</p>
        </div>
        <div className="flex items-center gap-2">
          {cached && (
            <span className="text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded">Cached</span>
          )}
          <button
            onClick={() => fetchData(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-md hover:bg-violet-500/20 transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white border border-stone-200 border-t-0 rounded-b-lg">
        <div className="flex border-b border-stone-200">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  isActive
                    ? 'border-violet-600 text-violet-700 bg-violet-50/50'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === 'economy' && <EconomyTab data={data.economy} />}
          {activeTab === 'documents' && <DocumentIntelligenceTab data={data.documentIntelligence} />}
          {activeTab === 'demographics' && <DemographicsTab data={data.demographics} supply={data.supplyContext} />}
          {activeTab === 'news' && <NewsTab events={data.news} />}
        </div>
      </div>
    </div>
  );
};

function EconomyTab({ data }: { data: any }) {
  if (!data) return <EmptySection message="Economic data not available for this deal." />;

  const healthColor = data.healthScore >= 70 ? 'text-emerald-600' : data.healthScore >= 50 ? 'text-amber-600' : 'text-red-600';
  const healthBg = data.healthScore >= 70 ? 'bg-emerald-50 border-emerald-200' : data.healthScore >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  const metrics = [
    { label: 'Economic Health', value: data.healthScore?.toString() || 'N/A', unit: '/100', trend: data.healthTrend, icon: Activity, color: healthColor },
    { label: 'Jobs Added (12mo)', value: data.metrics?.jobsAdded?.value || 'N/A', unit: '', trend: data.metrics?.jobsAdded?.trend, icon: Briefcase, color: 'text-emerald-600' },
    { label: 'Wage Growth', value: data.metrics?.wageGrowth?.value || 'N/A', unit: '', trend: data.metrics?.wageGrowth?.trend, icon: DollarSign, color: 'text-emerald-600' },
    { label: 'Net Migration', value: data.metrics?.netMigration?.value || 'N/A', unit: '', trend: data.metrics?.netMigration?.trend, icon: Users, color: 'text-violet-600' },
    { label: 'Affordability', value: data.metrics?.affordabilityRatio?.value || 'N/A', unit: '', trend: data.metrics?.affordabilityRatio?.detail, icon: Home, color: data.metrics?.affordabilityRatio?.status === 'green' ? 'text-emerald-600' : data.metrics?.affordabilityRatio?.status === 'red' ? 'text-red-600' : 'text-amber-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-3">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
              <Icon size={16} className={`mx-auto mb-1 ${m.color}`} />
              <div className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider mt-0.5">{m.label}{m.unit}</div>
              {m.trend && <div className="text-[10px] text-stone-400 mt-1 truncate" title={m.trend}>{m.trend}</div>}
            </div>
          );
        })}
      </div>

      {data.healthInsight && (
        <div className={`px-4 py-2.5 rounded-lg border text-sm ${healthBg}`}>
          <span className="font-medium">{data.healthInsight}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <EmployersSection employers={data.employers} />
        <div className="space-y-4">
          <PipelineSection pipeline={data.developmentPipeline} />
          <IndustryComposition industries={data.industryComposition} />
        </div>
      </div>

      <WageRentAlignment alignment={data.wageRentAlignment} />
    </div>
  );
}

function EmployersSection({ employers }: { employers: any[] }) {
  if (!employers?.length) return (
    <div className="border border-stone-200 rounded-lg p-4">
      <SectionTitle icon={Building2} title="Major Employers & Anchors" />
      <p className="text-sm text-stone-400 mt-3">No employer data available. Upload an OM or enable news intelligence to populate.</p>
    </div>
  );

  const statusColors: Record<string, string> = {
    expanding: 'text-emerald-600 bg-emerald-50',
    stable: 'text-blue-600 bg-blue-50',
    watch: 'text-amber-600 bg-amber-50',
    contracting: 'text-red-600 bg-red-50',
  };

  const statusIcons: Record<string, string> = {
    expanding: '▲',
    stable: '●',
    watch: '◆',
    contracting: '▼',
  };

  return (
    <div className="border border-stone-200 rounded-lg p-4">
      <SectionTitle icon={Building2} title="Major Employers & Anchors" badge={`${employers.length} tracked`} />
      <div className="space-y-2 mt-3">
        {employers.map((emp, i) => (
          <div key={i} className={`bg-stone-50 rounded-lg p-3 border-l-3 ${
            emp.status === 'expanding' ? 'border-l-emerald-500' :
            emp.status === 'watch' ? 'border-l-amber-500' :
            emp.status === 'contracting' ? 'border-l-red-500' : 'border-l-blue-500'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-stone-800">{emp.name}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{emp.industry}</span>
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{emp.sourceType}</span>
            </div>
            <div className="flex gap-4 text-[11px] text-stone-500">
              <span>👥 {emp.employees}</span>
              {emp.distance && <span>📍 {emp.distance}</span>}
              <span className={statusColors[emp.status] || 'text-stone-600'}>
                {statusIcons[emp.status] || '●'} {emp.statusText}
              </span>
              <span className="text-emerald-600 font-medium">→ {emp.demandImpact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineSection({ pipeline }: { pipeline: any[] }) {
  if (!pipeline?.length) return (
    <div className="border border-stone-200 rounded-lg p-4">
      <SectionTitle icon={Factory} title="Development Pipeline" />
      <p className="text-sm text-stone-400 mt-3">No pipeline data available.</p>
    </div>
  );

  return (
    <div className="border border-stone-200 rounded-lg p-4">
      <SectionTitle icon={Factory} title="Development Pipeline" badge={`${pipeline.length} projects`} />
      <div className="space-y-2 mt-3">
        {pipeline.map((proj, i) => (
          <div key={i} className="bg-stone-50 rounded-lg p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center text-lg shrink-0">
              {proj.type === 'Infrastructure' ? '🚲' : proj.type === 'Corporate' ? '🏢' : proj.type === 'Residential' ? '🏠' : '🏗️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-stone-800 truncate">{proj.project}</div>
              <div className="text-[11px] text-stone-500 truncate">{proj.impact}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-semibold text-violet-700">{proj.timeline}</div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                proj.confidence === 'HIGH' ? 'bg-emerald-50 text-emerald-700' :
                proj.confidence === 'LOW' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}>{proj.confidence}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndustryComposition({ industries }: { industries: any[] }) {
  if (!industries?.length) return null;

  const trendColors: Record<string, string> = {
    up: 'text-emerald-600',
    down: 'text-red-600',
    flat: 'text-stone-500',
  };

  const barColors = ['bg-violet-500', 'bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-400', 'bg-stone-400'];

  return (
    <div className="border border-stone-200 rounded-lg p-4">
      <SectionTitle icon={TrendingUp} title="Industry Composition" />
      <div className="space-y-1.5 mt-3">
        {industries.map((ind, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-stone-500 w-28 text-right truncate">{ind.name}</span>
            <div className="flex-1 h-3.5 bg-stone-100 rounded overflow-hidden">
              <div className={`h-full rounded ${barColors[i % barColors.length]} opacity-60`} style={{ width: `${ind.pct}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-stone-700 w-8 font-mono">{ind.pct}%</span>
            <span className={`text-[10px] font-semibold w-10 font-mono ${trendColors[ind.trend] || 'text-stone-500'}`}>{ind.growth}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WageRentAlignment({ alignment }: { alignment: any }) {
  if (!alignment) return null;

  const items = [
    { label: 'Wage Growth', value: alignment.wageGrowth, color: 'text-emerald-600' },
    { label: 'Rent Growth', value: alignment.rentGrowth, color: 'text-violet-600' },
    { label: 'Traffic Surge', value: alignment.trafficSurge, color: 'text-amber-600' },
    { label: 'Search Momentum', value: alignment.searchMomentum, color: 'text-blue-600' },
  ];

  return (
    <div className="border border-stone-200 rounded-lg p-4">
      <SectionTitle icon={Activity} title="Wage-Rent-Traffic Alignment" badge="CORRELATION ENGINE" />
      <div className="grid grid-cols-4 gap-4 mt-3">
        {items.map((item, i) => (
          <div key={i} className="text-center">
            <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value || 'N/A'}</div>
            <div className="text-[10px] text-stone-500 font-semibold mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>
      {alignment.insight && (
        <div className="mt-3 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
          <p className="text-xs text-violet-800 leading-relaxed">{alignment.insight}</p>
        </div>
      )}
    </div>
  );
}

function DocumentIntelligenceTab({ data }: { data: any }) {
  const [expandedClaim, setExpandedClaim] = useState<number | null>(null);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-2xl bg-violet-50 border-2 border-dashed border-violet-300 flex items-center justify-center mb-4">
          <Upload size={32} className="text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold text-stone-800 mb-1">Document Intelligence</h3>
        <p className="text-sm text-stone-500 text-center max-w-md mb-4">
          Upload an Offering Memorandum or broker package to unlock AI-powered claim verification.
          Every market claim will be extracted and checked against platform data.
        </p>
        <p className="text-xs text-stone-400">
          Supported formats: PDF, DOCX
        </p>
      </div>
    );
  }

  const claims = data.claims || [];
  const summary = data.summary || {};

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    verified: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Verified' },
    partial: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Partially True' },
    contradicted: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Contradicted' },
    unverifiable: { icon: HelpCircle, color: 'text-stone-500', bg: 'bg-stone-50 border-stone-200', label: 'Unverifiable' },
  };

  return (
    <div className="space-y-5">
      <div className="bg-violet-50/50 border border-violet-200 rounded-lg p-5">
        <SectionTitle icon={FileText} title="OM Verification Report" badge="DOCUMENT INTELLIGENCE" />

        <div className="grid grid-cols-4 gap-3 mt-4">
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = summary[key] || 0;
            return (
              <div key={key} className={`text-center p-3 rounded-lg border ${cfg.bg}`}>
                <div className={`text-2xl font-bold font-mono ${cfg.color}`}>{count}</div>
                <div className={`text-[10px] font-semibold flex items-center justify-center gap-1 ${cfg.color}`}>
                  <Icon size={10} /> {cfg.label}
                </div>
              </div>
            );
          })}
        </div>

        {data.verdict && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Platform vs Broker Verdict</div>
            <p className="text-xs text-blue-800 leading-relaxed">{data.verdict}</p>
          </div>
        )}
      </div>

      {claims.length > 0 && (
        <div className="border border-stone-200 rounded-lg p-4">
          <SectionTitle icon={CheckCircle2} title="Claim-by-Claim Verification" />
          <div className="space-y-2 mt-3">
            {claims.map((claim: any, i: number) => {
              const isExpanded = expandedClaim === i;
              const cfg = statusConfig[claim.status] || statusConfig.unverifiable;
              const Icon = cfg.icon;

              return (
                <div
                  key={i}
                  onClick={() => setExpandedClaim(isExpanded ? null : i)}
                  className={`bg-stone-50 rounded-lg p-3 cursor-pointer transition-colors hover:bg-stone-100 border-l-3 ${
                    claim.status === 'verified' ? 'border-l-emerald-500' :
                    claim.status === 'partial' ? 'border-l-amber-500' :
                    claim.status === 'contradicted' ? 'border-l-red-500' : 'border-l-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 shrink-0">{claim.category}</span>
                      <span className="text-sm text-stone-700 truncate">"{claim.claim}"</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`flex items-center gap-1 text-[10px] font-semibold ${cfg.color}`}>
                        <Icon size={12} /> {cfg.label}
                      </span>
                      {isExpanded ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 p-3 bg-white rounded border border-stone-200">
                      <p className="text-xs text-stone-600 leading-relaxed mb-2">
                        <span className="font-semibold text-violet-700">Platform Finding: </span>
                        {claim.finding}
                      </p>
                      <span className="text-[10px] text-stone-400">Source: {claim.source}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DemographicsTab({ data, supply }: { data: any; supply: any }) {
  if (!data) return <EmptySection message="Demographic data not available for this deal." />;

  const funnel = data.renterDemandFunnel;
  const census = data.census;

  return (
    <div className="space-y-5">
      {census && (
        <div className="border border-stone-200 rounded-lg p-4">
          <SectionTitle icon={MapPin} title="Census Data — Trade Area" badge="U.S. Census ACS" />
          <div className="grid grid-cols-4 gap-4 mt-3">
            {[
              { label: 'Population', value: census.population?.toLocaleString(), icon: Users },
              { label: 'Median Income', value: census.medianIncome ? `$${census.medianIncome.toLocaleString()}` : 'N/A', icon: DollarSign },
              { label: 'Housing Units', value: census.totalHousingUnits?.toLocaleString(), icon: Home },
              { label: 'Median Rent', value: census.medianRent ? `$${census.medianRent.toLocaleString()}` : 'N/A', icon: DollarSign },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="bg-stone-50 rounded-lg p-3 text-center">
                  <Icon size={14} className="mx-auto mb-1 text-violet-600" />
                  <div className="text-lg font-bold text-stone-800">{item.value || 'N/A'}</div>
                  <div className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider">{item.label}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-right text-[10px] text-stone-400">Source: U.S. Census ACS 5-Year Estimates</div>
        </div>
      )}

      {data.submarket && (
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-stone-200 rounded-lg p-4">
            <SectionTitle icon={MapPin} title={`Submarket: ${data.submarket.name}`} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <StatCard label="Occupancy" value={data.submarket.avg_occupancy ? `${data.submarket.avg_occupancy}%` : 'N/A'} />
              <StatCard label="Avg Rent" value={data.submarket.avg_rent ? `$${Math.round(data.submarket.avg_rent).toLocaleString()}` : 'N/A'} />
              <StatCard label="Properties" value={data.submarket.properties_count?.toString() || 'N/A'} />
              <StatCard label="Total Units" value={data.submarket.total_units?.toLocaleString() || 'N/A'} />
            </div>
          </div>
          {data.msa && (
            <div className="border border-stone-200 rounded-lg p-4">
              <SectionTitle icon={MapPin} title={`MSA: ${data.msa.name}`} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <StatCard label="Occupancy" value={data.msa.avg_occupancy ? `${data.msa.avg_occupancy}%` : 'N/A'} />
                <StatCard label="Avg Rent" value={data.msa.avg_rent ? `$${Math.round(data.msa.avg_rent).toLocaleString()}` : 'N/A'} />
                <StatCard label="Properties" value={data.msa.total_properties?.toString() || 'N/A'} />
                <StatCard label="Population" value={data.msa.population?.toLocaleString() || 'N/A'} />
              </div>
            </div>
          )}
        </div>
      )}

      {funnel && <DemandFunnel funnel={funnel} />}

      {supply?.competingProperties && (
        <div className="border border-stone-200 rounded-lg p-4">
          <SectionTitle icon={Building2} title="Competitive Supply Context" badge={`${supply.radiusMiles}mi radius`} />
          <div className="grid grid-cols-5 gap-3 mt-3">
            <StatCard label="Properties" value={supply.competingProperties.count?.toString()} />
            <StatCard label="Avg Units" value={supply.competingProperties.avgUnits?.toString()} />
            <StatCard label="Avg Occupancy" value={supply.competingProperties.avgOccupancy ? `${supply.competingProperties.avgOccupancy}%` : 'N/A'} />
            <StatCard label="Avg Rent" value={supply.competingProperties.avgRent ? `$${supply.competingProperties.avgRent.toLocaleString()}` : 'N/A'} />
            <StatCard label="Total Units" value={supply.competingProperties.totalPipelineUnits?.toLocaleString()} />
          </div>
        </div>
      )}
    </div>
  );
}

function DemandFunnel({ funnel }: { funnel: any }) {
  const steps = [
    { label: 'Total Population', value: funnel.totalPopulation, pct: 100, color: 'bg-stone-600' },
    { label: 'Renters', value: funnel.renters, pct: funnel.renterPct, color: 'bg-violet-600' },
    { label: 'Income Qualified', value: funnel.incomeQualified, pct: funnel.incomeQualifiedPct, color: 'bg-violet-500' },
    { label: 'Age Appropriate', value: funnel.ageAppropriate, pct: funnel.ageAppropriatePct, color: 'bg-blue-500' },
    { label: 'Unit Type Match', value: funnel.unitTypeMatch, pct: funnel.unitTypeMatchPct, color: 'bg-emerald-500' },
  ];

  return (
    <div className="border border-stone-200 rounded-lg p-4">
      <SectionTitle icon={Users} title="Renter Demand Quantification" badge="DEMAND FUNNEL" />
      <div className="mt-4 space-y-2">
        {steps.map((step, i) => {
          const width = i === 0 ? 100 : steps.slice(1, i + 1).reduce((acc, s) => acc * (s.pct / 100), 100);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[11px] text-stone-500 w-28 text-right shrink-0">{step.label}</span>
              <div className="flex-1 h-7 bg-stone-100 rounded-md overflow-hidden relative">
                <div className={`h-full rounded-md ${step.color} opacity-70 transition-all duration-500`} style={{ width: `${width}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-sm">
                  {step.value}
                </span>
              </div>
              {i > 0 && <span className="text-[10px] text-stone-400 w-8 shrink-0">{step.pct}%</span>}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-emerald-700 font-mono">{funnel.demandPool}</div>
          <div className="text-[10px] text-emerald-600 font-semibold uppercase">Qualified Demand Pool</div>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-violet-700 font-mono">{funnel.captureRate}</div>
          <div className="text-[10px] text-violet-600 font-semibold uppercase">Capture Rate</div>
        </div>
      </div>
      {funnel.captureInsight && (
        <div className="mt-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
          <p className="text-xs text-violet-800">{funnel.captureInsight}</p>
        </div>
      )}
    </div>
  );
}

function NewsTab({ events }: { events: any[] }) {
  if (!events?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Newspaper size={40} className="text-stone-300 mb-3" />
        <h3 className="text-base font-semibold text-stone-700 mb-1">No News Events</h3>
        <p className="text-sm text-stone-400 text-center max-w-md">
          No news events tracked for this trade area yet. Events will appear here as the platform detects employment, development, and economic activity near this property.
        </p>
      </div>
    );
  }

  const typeConfig: Record<string, { color: string; bg: string; icon: string }> = {
    DEMAND: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '📈' },
    SUPPLY: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '🏗️' },
    INFRASTRUCTURE: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '🚇' },
    ECONOMIC: { color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', icon: '💼' },
    RISK: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '⚠️' },
    REGULATORY: { color: 'text-stone-700', bg: 'bg-stone-50 border-stone-200', icon: '⚖️' },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-2">
        {Object.entries(typeConfig).map(([type, cfg]) => {
          const count = events.filter(e => e.type === type).length;
          if (count === 0) return null;
          return (
            <span key={type} className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
              {cfg.icon} {type} ({count})
            </span>
          );
        })}
      </div>

      {events.map((event, i) => {
        const cfg = typeConfig[event.type] || typeConfig.ECONOMIC;
        return (
          <div key={i} className={`rounded-lg p-4 border ${cfg.bg}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} border`}>
                    {cfg.icon} {event.type}
                  </span>
                  <span className="text-[10px] text-stone-400">{event.category}/{event.eventType?.replace(/_/g, ' ')}</span>
                </div>
                <h4 className="text-sm font-semibold text-stone-800 mb-1">{event.headline}</h4>
                {event.extractedData && (
                  <div className="text-xs text-stone-500 space-x-3">
                    {event.extractedData.company_name && <span>Company: {event.extractedData.company_name}</span>}
                    {event.extractedData.employee_count && <span>Employees: {event.extractedData.employee_count.toLocaleString()}</span>}
                    {event.extractedData.unit_count && <span>Units: {event.extractedData.unit_count}</span>}
                    {event.extractedData.total_investment && <span>Investment: ${(event.extractedData.total_investment / 1000000).toFixed(0)}M</span>}
                    {event.extractedData.salary_range && <span>Salary: ${(event.extractedData.salary_range[0] / 1000).toFixed(0)}K-${(event.extractedData.salary_range[1] / 1000).toFixed(0)}K</span>}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-stone-400">{event.date ? new Date(event.date).toLocaleDateString() : ''}</div>
                <div className="text-[10px] text-stone-400">{event.city}, {event.state}</div>
                {event.source && <div className="text-[10px] text-stone-400 mt-0.5">via {event.source}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, badge }: { icon: any; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={15} className="text-violet-600" />
      <span className="text-sm font-bold text-stone-800">{title}</span>
      {badge && <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200">{badge}</span>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-stone-50 rounded-lg p-2.5 text-center">
      <div className="text-base font-bold text-stone-800">{value || 'N/A'}</div>
      <div className="text-[10px] text-stone-500 font-medium">{label}</div>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-stone-400">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertTriangle size={32} className="text-red-400 mb-3" />
      <p className="text-sm text-stone-600 mb-3">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-md hover:bg-violet-100"
      >
        <RefreshCw size={12} />
        Retry
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      <div className="bg-stone-900 border-l-4 border-violet-500 rounded-t-lg px-5 py-3">
        <div className="h-5 w-48 bg-stone-700 rounded animate-pulse" />
        <div className="h-3 w-72 bg-stone-800 rounded animate-pulse mt-1.5" />
      </div>
      <div className="bg-white border border-stone-200 border-t-0 rounded-b-lg p-5">
        <div className="flex gap-4 border-b border-stone-200 pb-3 mb-5">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-8 w-32 bg-stone-100 rounded animate-pulse" />)}
        </div>
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-stone-50 border border-stone-200 rounded-lg animate-pulse" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-stone-50 border border-stone-200 rounded-lg animate-pulse" />
          <div className="h-64 bg-stone-50 border border-stone-200 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default MarketIntelligencePage;
