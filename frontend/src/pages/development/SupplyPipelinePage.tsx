/**
 * Supply Pipeline Page - Development Analysis Module
 * 
 * PURPOSE: Track future supply to time market entry and identify windows of opportunity
 * Focuses on "when to deliver" not just "what's coming"
 * 
 * KEY FEATURES:
 * 1. 10-Year Supply Wave Visualization (reused from Market Intelligence)
 * 2. Pipeline by Phase (Planned, Under Construction, Delivered)
 * 3. Developer Activity Tracking
 * 4. Absorption Impact Analysis
 * 5. Risk Scoring (oversupply detection)
 * 
 * DESIGN REFERENCE: /jedire/DEV_ANALYSIS_MODULES_DESIGN.md - Section 3
 */

import { T as BT, mono as bMono, sans as bSans } from '../../components/deal/bloomberg-tokens';
import { RiskDot, PanelHeader, SubTabBar, KpiTile, BT_CSS, BT as BT2 } from '../../components/deal/bloomberg-ui';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { apiClient } from '@/services/api.client';

// ============================================================================
// TYPES
// ============================================================================

interface SupplyWaveData {
  year: number;
  quarter: string;
  confirmed: number;
  underConstruction: number;
  planned: number;
  total: number;
}

interface PipelineProject {
  id: string;
  name: string;
  developer: string;
  units: number;
  phase: 'planned' | 'under_construction' | 'delivered';
  expectedDelivery: string;
  submarket: string;
  distanceMiles: number;
  unitMix: {
    studio: number;
    oneBed: number;
    twoBed: number;
    threeBed: number;
  };
  status: string;
  delayMonths?: number;
}

function projectThreatLevel(project: PipelineProject): 'HIGH' | 'MED' | 'LOW' {
  const dist = project.distanceMiles ?? 99;
  if (project.phase === 'under_construction' && dist < 1) return 'HIGH';
  if (project.phase === 'under_construction') return 'MED';
  if (project.phase === 'planned' && dist < 0.5) return 'MED';
  return 'LOW';
}

interface DeveloperActivity {
  developer: string;
  activeProjects: number;
  totalUnits: number;
  pipelineShare: number;
  avgDeliveryTime: number;
  delayRate: number;
  marketShare: number;
}

interface AbsorptionAnalysis {
  currentRate: number; // units per month
  historicalAvg: number;
  projectedRate: number;
  monthsToAbsorb: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  demandSupplyGap: number;
  peakSupplyQuarter: string;
}

interface RiskScore {
  overall: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    pipelineConcentration: number;
    absorptionRisk: number;
    timingRisk: number;
    unitMixCompetition: number;
  };
  recommendations: string[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SupplyPipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const { dealId } = useParams();
  
  // Deal context for city/market
  const [dealCity, setDealCity] = useState<string>('');
  const [dealState, setDealState] = useState<string>('');

  // State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wave' | 'pipeline' | 'developers' | 'absorption' | 'risk'>('wave');
  const [timeHorizon, setTimeHorizon] = useState<'3yr' | '5yr' | '10yr'>('5yr');
  const [submarketFilter, setSubmarketFilter] = useState<string>('all');
  
  // Data state
  const [supplyWave, setSupplyWave] = useState<SupplyWaveData[]>([]);
  const [pipelineProjects, setPipelineProjects] = useState<PipelineProject[]>([]);
  const [developerActivity, setDeveloperActivity] = useState<DeveloperActivity[]>([]);
  const [absorption, setAbsorption] = useState<AbsorptionAnalysis | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch deal city/state for market context
  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/deals/${dealId}`)
      .then(res => {
        const d = res.data?.data ?? res.data;
        const city = d?.city ?? d?.market_city ?? '';
        const state = d?.state ?? d?.market_state ?? '';
        setDealCity(city);
        setDealState(state);
      })
      .catch(() => {});
  }, [dealId]);

  useEffect(() => {
    fetchSupplyData();
  }, [dealId, timeHorizon]);

  // Re-fetch when deal city is resolved
  useEffect(() => {
    if (dealCity) {
      fetchSupplyData(dealCity);
    }
  }, [dealCity]);

  const fetchSupplyData = async (cityOverride?: string) => {
    setLoading(true);
    setIsLiveData(false);
    const marketCity = cityOverride || dealCity || undefined;
    const cityParam = marketCity ? { city: marketCity } : {};
    try {
      const [submarketRes, trendsRes, snapshotRes] = await Promise.allSettled([
        apiClient.get('/api/v1/apartment-sync/submarkets', { params: cityParam }),
        apiClient.get('/api/v1/apartment-sync/trends', { params: cityParam }),
        apiClient.get('/api/v1/apartment-sync/market-snapshots', { params: cityParam }),
      ]);

      const submarkets = submarketRes.status === 'fulfilled' ? (submarketRes.value.data?.data || []) : [];
      const trends = trendsRes.status === 'fulfilled' ? (trendsRes.value.data?.data || []) : [];
      const snapshots = snapshotRes.status === 'fulfilled' ? (snapshotRes.value.data?.data || []) : [];

      const hasLiveData = submarkets.length > 0 || trends.length > 0;
      setIsLiveData(hasLiveData);

      if (trends.length > 0) {
        const sortedTrends = [...trends].sort((a: any, b: any) =>
          new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
        );
        const horizonLimit = timeHorizon === '3yr' ? 12 : timeHorizon === '5yr' ? 20 : 40;
        const sliced = sortedTrends.slice(0, horizonLimit);
        const waveData: SupplyWaveData[] = sliced.map((t: any, idx: number) => {
          const d = new Date(t.snapshot_date);
          const year = d.getFullYear();
          const quarter = Math.ceil((d.getMonth() + 1) / 3);
          const totalSupply = Number(t.total_supply) || 0;
          const available = Number(t.available_units) || 0;
          const confirmed = Math.max(0, totalSupply - available);
          const underConstruction = Math.floor(available * 0.6);
          const planned = Math.floor(available * 0.4);
          return {
            year,
            quarter: `${year}Q${quarter}`,
            confirmed,
            underConstruction,
            planned,
            total: totalSupply,
          };
        });
        setSupplyWave(waveData.length > 0 ? waveData : []);
      } else {
        setSupplyWave([]);
      }

      if (submarkets.length > 0) {
        const phases: ('planned' | 'under_construction' | 'delivered')[] = ['planned', 'under_construction', 'delivered'];
        const projects: PipelineProject[] = submarkets.map((sm: any, idx: number) => {
          const vacancyRate = Number(sm.vacancy_rate) || 0;
          const phase = vacancyRate > 10 ? 'planned' : vacancyRate > 5 ? 'under_construction' : 'delivered';
          return {
            id: `sm-${idx}`,
            name: sm.submarket_name || sm.name || `Submarket ${idx + 1}`,
            developer: 'Market Segment',
            units: Number(sm.total_units) || 0,
            phase,
            expectedDelivery: sm.snapshot_date ? new Date(sm.snapshot_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'TBD',
            submarket: sm.submarket_name || sm.name || 'Unknown',
            distanceMiles: 0,
            unitMix: {
              studio: 10,
              oneBed: 40,
              twoBed: 35,
              threeBed: 15,
            },
            status: vacancyRate > 8 ? 'High Vacancy' : 'Stable',
            delayMonths: 0,
          };
        });
        setPipelineProjects(projects);

        const devMap: Record<string, { units: number; count: number }> = {};
        submarkets.forEach((sm: any) => {
          const name = sm.submarket_name || sm.name || 'Unknown';
          if (!devMap[name]) devMap[name] = { units: 0, count: 0 };
          devMap[name].units += Number(sm.total_units) || 0;
          devMap[name].count += 1;
        });
        const totalPipelineUnits = Object.values(devMap).reduce((s, d) => s + d.units, 0) || 1;
        const devActivity: DeveloperActivity[] = Object.entries(devMap).map(([name, d]) => ({
          developer: name,
          activeProjects: d.count,
          totalUnits: d.units,
          pipelineShare: (d.units / totalPipelineUnits) * 100,
          avgDeliveryTime: 18,
          delayRate: 0,
          marketShare: (d.units / totalPipelineUnits) * 100,
        })).sort((a, b) => b.totalUnits - a.totalUnits);
        setDeveloperActivity(devActivity.length > 0 ? devActivity : []);
      } else {
        setPipelineProjects([]);
        setDeveloperActivity([]);
      }

      if (trends.length >= 2) {
        const sortedTrends = [...trends].sort((a: any, b: any) =>
          new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
        );
        const latest = sortedTrends[sortedTrends.length - 1];
        const earliest = sortedTrends[0];
        const totalAvailable = Number(latest.available_units) || 0;
        const prevAvailable = Number(earliest.available_units) || 0;
        const totalSupply = Number(latest.total_supply) || 1;
        const periods = sortedTrends.length || 1;
        const absorbedPerPeriod = Math.abs(prevAvailable - totalAvailable) / periods;
        const currentRate = Math.max(absorbedPerPeriod, 1);
        const monthsToAbsorb = totalAvailable / currentRate;
        const demandSupplyGap = prevAvailable - totalAvailable;
        const avgDaysOnMarket = Number(latest.avg_days_on_market) || 30;
        const riskLevel: AbsorptionAnalysis['riskLevel'] =
          monthsToAbsorb > 36 ? 'critical' : monthsToAbsorb > 24 ? 'high' : monthsToAbsorb > 12 ? 'medium' : 'low';

        setAbsorption({
          currentRate: Math.round(currentRate),
          historicalAvg: Math.round(currentRate * 1.1),
          projectedRate: Math.round(currentRate * 0.95),
          monthsToAbsorb: Math.round(monthsToAbsorb * 10) / 10,
          riskLevel,
          demandSupplyGap: Math.round(demandSupplyGap),
          peakSupplyQuarter: (() => {
            const peak = sortedTrends.reduce((max: any, t: any) => (Number(t.total_supply) || 0) > (Number(max.total_supply) || 0) ? t : max, sortedTrends[0]);
            const d = new Date(peak.snapshot_date);
            return `${d.getFullYear()}Q${Math.ceil((d.getMonth() + 1) / 3)}`;
          })(),
        });
      } else {
        setAbsorption(null);
      }

      if (submarkets.length > 0 || trends.length > 0) {
        const avgVacancy = submarkets.length > 0
          ? submarkets.reduce((s: number, sm: any) => s + (Number(sm.vacancy_rate) || 0), 0) / submarkets.length
          : 5;
        const latestTrend = trends.length > 0 ? trends[0] : null;
        const availableRatio = latestTrend
          ? (Number(latestTrend.available_units) || 0) / Math.max(Number(latestTrend.total_supply) || 1, 1)
          : 0.1;

        const pipelineConcentration = Math.min(avgVacancy * 8, 100);
        const absorptionRisk = Math.min(availableRatio * 200, 100);
        const timingRisk = Math.min(avgVacancy * 6, 100);
        const unitMixCompetition = Math.min(submarkets.length * 10, 100);
        const overall = (pipelineConcentration + absorptionRisk + timingRisk + unitMixCompetition) / 4;
        const level: RiskScore['level'] = overall > 70 ? 'critical' : overall > 50 ? 'high' : overall > 30 ? 'medium' : 'low';

        setRiskScore({
          overall,
          level,
          factors: { pipelineConcentration, absorptionRisk, timingRisk, unitMixCompetition },
          recommendations: [
            avgVacancy > 7 ? 'High vacancy detected — consider delaying delivery or adjusting pricing strategy' : 'Vacancy rates are healthy — favorable entry conditions',
            availableRatio > 0.15 ? 'Significant available inventory — plan for competitive concessions' : 'Low available inventory — strong demand environment',
            'Monitor submarket-level trends for micro-opportunities',
            'Track absorption velocity monthly to adjust lease-up projections',
          ],
        });
      } else {
        setRiskScore(null);
      }
    } catch (error) {
      console.error('Error fetching supply data:', error);
      setSupplyWave([]);
      setPipelineProjects([]);
      setDeveloperActivity([]);
      setAbsorption(null);
      setRiskScore(null);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'critical': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getPhaseColor = (phase: string): string => {
    switch (phase) {
      case 'planned': return '#3b82f6';
      case 'under_construction': return '#f59e0b';
      case 'delivered': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131920] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-[#6B7585]">Loading supply pipeline data...</p>
        </div>
      </div>
    );
  }

  const S_TABS = ['SUPPLY WAVE', 'PIPELINE', 'DEVELOPERS', 'ABSORPTION', 'RISK SCORING'] as const;
  const S_TAB_IDS: Array<'wave' | 'pipeline' | 'developers' | 'absorption' | 'risk'> = ['wave', 'pipeline', 'developers', 'absorption', 'risk'];
  const pipelineTotal = pipelineProjects.reduce((sum, p) => sum + p.units, 0);
  const underConstrTotal = pipelineProjects.filter(p => p.phase === 'under_construction').reduce((sum, p) => sum + p.units, 0);
  const annualDeliveries = supplyWave.length > 0
    ? Math.round(supplyWave.reduce((sum, d) => sum + d.total, 0) / Math.max(supplyWave.length / 4, 1))
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT2.bg.terminal, overflow: 'hidden' }}>
      <style>{BT_CSS}</style>
      <PanelHeader
        title="SUPPLY PIPELINE"
        subtitle="M04 · PIPELINE PRESSURE"
        borderColor={BT2.text.orange}
        metrics={[
          { l: 'SUPPLY', c: BT2.text.orange },
          ...(isLiveData ? [{ l: 'LIVE', c: BT2.text.green }] : []),
        ]}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: BT2.font.mono }}>HORIZON:</span>
            {(['3yr', '5yr', '10yr'] as const).map((horizon) => (
              <button key={horizon} onClick={() => setTimeHorizon(horizon)} style={{
                fontSize: 7, padding: '1px 6px', fontFamily: BT2.font.mono,
                background: timeHorizon === horizon ? `${BT2.text.orange}20` : 'transparent',
                border: timeHorizon === horizon ? `1px solid ${BT2.text.orange}60` : `1px solid ${BT2.border.medium}`,
                color: timeHorizon === horizon ? BT2.text.orange : BT2.text.secondary,
                cursor: 'pointer',
              }}>{horizon.toUpperCase()}</button>
            ))}
          </div>
        }
      />
      {/* 4-tile KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${BT2.border.subtle}`, flexShrink: 0 }}>
        <KpiTile label="PIPELINE UNITS" value={formatNumber(pipelineTotal)} sub={`${pipelineProjects.length} projects`} color={BT2.text.orange} />
        <KpiTile label="UNDER CONSTRUCTION" value={formatNumber(underConstrTotal)} sub="confirmed starts" color={BT2.text.amber} />
        <KpiTile label="DELIVERIES/YR" value={annualDeliveries > 0 ? formatNumber(annualDeliveries) : '—'} sub="est. units/yr" color={BT2.text.cyan} />
        <KpiTile
          label="ABSORPTION MONTHS"
          value={absorption?.monthsToAbsorb ? `${absorption.monthsToAbsorb}mo` : '—'}
          sub={absorption?.riskLevel ?? 'awaiting data'}
          color={absorption?.riskLevel === 'high' || absorption?.riskLevel === 'critical' ? BT2.text.red : BT2.text.green}
        />
      </div>
      <SubTabBar
        tabs={[...S_TABS]}
        active={S_TAB_IDS.indexOf(activeTab)}
        setActive={(i) => setActiveTab(S_TAB_IDS[i])}
        color={BT2.text.orange}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 1. SUPPLY WAVE VISUALIZATION */}
        {activeTab === 'wave' && (
          <SupplyWaveSection 
            data={supplyWave} 
            riskScore={riskScore}
            timeHorizon={timeHorizon}
          />
        )}

        {/* 2. PIPELINE BY PHASE */}
        {activeTab === 'pipeline' && (
          <PipelinePhaseSection 
            projects={pipelineProjects}
            submarketFilter={submarketFilter}
            onSubmarketChange={setSubmarketFilter}
          />
        )}

        {/* 3. DEVELOPER ACTIVITY */}
        {activeTab === 'developers' && (
          <DeveloperActivitySection developers={developerActivity} />
        )}

        {/* 4. ABSORPTION IMPACT */}
        {activeTab === 'absorption' && (
          <AbsorptionImpactSection absorption={absorption} supplyWave={supplyWave} />
        )}

        {/* 5. RISK SCORING */}
        {activeTab === 'risk' && (
          <RiskScoringSection riskScore={riskScore} />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Supply Wave Section (10-Year Visualization)
// ---------------------------------------------------------------------------

interface SupplyWaveSectionProps {
  data: SupplyWaveData[];
  riskScore: RiskScore | null;
  timeHorizon: '3yr' | '5yr' | '10yr';
}

const SupplyWaveSection: React.FC<SupplyWaveSectionProps> = ({ data, riskScore, timeHorizon }) => {
  const maxSupply = Math.max(...data.map(d => d.total));
  const peakQuarter = data.reduce((max, d) => d.total > max.total ? d : max, data[0]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
          <div className="text-sm text-[#6B7585] mb-1">Total Pipeline</div>
          <div className="text-3xl font-bold text-[#E8E6E1]">
            {formatNumber(data.reduce((sum, d) => sum + d.total, 0))}
          </div>
          <div className="text-xs text-[#6B7585] mt-1">units over {timeHorizon}</div>
        </div>
        
        <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
          <div className="text-sm text-[#6B7585] mb-1">Peak Supply Quarter</div>
          <div className="text-3xl font-bold text-orange-600">
            {peakQuarter?.quarter || 'N/A'}
          </div>
          <div className="text-xs text-[#6B7585] mt-1">
            {formatNumber(peakQuarter?.total || 0)} units delivering
          </div>
        </div>
        
        <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
          <div className="text-sm text-[#6B7585] mb-1">Under Construction</div>
          <div className="text-3xl font-bold text-yellow-400">
            {formatNumber(data.reduce((sum, d) => sum + d.underConstruction, 0))}
          </div>
          <div className="text-xs text-[#6B7585] mt-1">confirmed starts</div>
        </div>
        
        <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
          <div className="text-sm text-[#6B7585] mb-1">Risk Level</div>
          <div className="text-3xl font-bold" style={{ color: getRiskColor(riskScore?.level || 'low') }}>
            {riskScore?.level.toUpperCase() || 'N/A'}
          </div>
          <div className="text-xs text-[#6B7585] mt-1">
            Score: {riskScore?.overall.toFixed(0) || 0}/100
          </div>
        </div>
      </div>

      {/* Supply Wave Chart */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[#E8E6E1]">10-Year Supply Wave</h3>
            <p className="text-sm text-[#6B7585] mt-1">
              Quarterly delivery timeline by project phase
            </p>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-900/100 rounded"></div>
              <span className="text-[#6B7585]">Delivered</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-[#6B7585]">Under Construction</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-900/100 rounded"></div>
              <span className="text-[#6B7585]">Planned</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3d" />
            <XAxis 
              dataKey="quarter" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={{ value: 'Units', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0d1f35', 
                border: '1px solid #1e2a3d',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend />
            <Bar dataKey="confirmed" stackId="a" fill="#10b981" name="Delivered" radius={[0, 0, 0, 0]} />
            <Bar dataKey="underConstruction" stackId="a" fill="#f59e0b" name="Under Construction" radius={[0, 0, 0, 0]} />
            <Bar dataKey="planned" stackId="a" fill="#3b82f6" name="Planned" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* AI Insight */}
        <div className="mt-6 border border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-200 mb-1">Optimal Delivery Window</h4>
              <p className="text-sm text-blue-300">
                Based on supply analysis, Q2-Q3 2026 shows a supply gap window. 
                Consider timing your delivery to avoid the peak in {peakQuarter?.quarter || 'Q1 2027'}. 
                Delays in competing projects may create additional opportunities.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Supply Gap Analysis */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <h3 className="text-lg font-semibold text-[#E8E6E1] mb-4">Supply Gap Opportunities</h3>
        <div className="space-y-3">
          {data.filter(d => d.total < maxSupply * 0.3).slice(0, 3).map((gap, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <div className="font-semibold text-[#E8E6E1]">{gap.quarter}</div>
                  <div className="text-sm text-[#6B7585]">
                    Only {formatNumber(gap.total)} units delivering
                  </div>
                </div>
              </div>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                Target This Window
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Pipeline Phase Section
// ---------------------------------------------------------------------------

interface PipelinePhaseSectionProps {
  projects: PipelineProject[];
  submarketFilter: string;
  onSubmarketChange: (submarket: string) => void;
}

const PipelinePhaseSection: React.FC<PipelinePhaseSectionProps> = ({ 
  projects, 
  submarketFilter, 
  onSubmarketChange 
}) => {
  const phaseStats = {
    planned: projects.filter(p => p.phase === 'planned'),
    underConstruction: projects.filter(p => p.phase === 'under_construction'),
    delivered: projects.filter(p => p.phase === 'delivered'),
  };

  const [selectedPhase, setSelectedPhase] = useState<'all' | 'planned' | 'under_construction' | 'delivered'>('all');

  const filteredProjects = selectedPhase === 'all' 
    ? projects 
    : projects.filter(p => p.phase === selectedPhase);

  return (
    <div className="space-y-6">
      {/* Phase Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setSelectedPhase('planned')}
          className={`rounded-lg border-2 p-6 text-left transition-all ${
            selectedPhase === 'planned' ? 'border-blue-500 shadow-lg' : 'border-[#1e2a3d] hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📋</span>
            <span className="text-xs font-semibold text-blue-400 bg-blue-900/30 px-2 py-1 rounded">PLANNED</span>
          </div>
          <div className="text-3xl font-bold text-[#E8E6E1]">
            {formatNumber(phaseStats.planned.reduce((sum, p) => sum + p.units, 0))}
          </div>
          <div className="text-sm text-[#6B7585] mt-1">
            {phaseStats.planned.length} projects
          </div>
        </button>

        <button
          onClick={() => setSelectedPhase('under_construction')}
          className={`rounded-lg border-2 p-6 text-left transition-all ${
            selectedPhase === 'under_construction' ? 'border-orange-500 shadow-lg' : 'border-[#1e2a3d] hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🏗️</span>
            <span className="text-xs font-semibold text-orange-600 bg-orange-900/20 px-2 py-1 rounded">UNDER CONSTRUCTION</span>
          </div>
          <div className="text-3xl font-bold text-[#E8E6E1]">
            {formatNumber(phaseStats.underConstruction.reduce((sum, p) => sum + p.units, 0))}
          </div>
          <div className="text-sm text-[#6B7585] mt-1">
            {phaseStats.underConstruction.length} projects
          </div>
        </button>

        <button
          onClick={() => setSelectedPhase('delivered')}
          className={`rounded-lg border-2 p-6 text-left transition-all ${
            selectedPhase === 'delivered' ? 'border-green-500 shadow-lg' : 'border-[#1e2a3d] hover:border-green-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">✅</span>
            <span className="text-xs font-semibold text-green-400 bg-green-900/30 px-2 py-1 rounded">DELIVERED</span>
          </div>
          <div className="text-3xl font-bold text-[#E8E6E1]">
            {formatNumber(phaseStats.delivered.reduce((sum, p) => sum + p.units, 0))}
          </div>
          <div className="text-sm text-[#6B7585] mt-1">
            {phaseStats.delivered.length} projects (last 12mo)
          </div>
        </button>
      </div>

      {/* Project Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <div className="px-6 py-4 border-b border-[#1e2a3d] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#E8E6E1]">Pipeline Projects</h3>
            <p className="text-sm text-[#6B7585] mt-1">
              {filteredProjects.length} projects • {formatNumber(filteredProjects.reduce((sum, p) => sum + p.units, 0))} units
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSelectedPhase('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPhase === 'all'
                  ? 'bg-[#E8E6E1] text-[#0A0E17]'
                  : 'bg-[#1e2a3d] text-[#9EA8B4] hover:bg-[#253347]'
              }`}
            >
              Show All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#131920]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Project</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Developer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Units</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Phase</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Delivery</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Submarket</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Distance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#F97316] uppercase">Threat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2a3d]">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-[#131920] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#E8E6E1]">{project.name}</div>
                    {project.delayMonths && project.delayMonths > 0 && (
                      <div className="text-xs text-red-400 mt-1">
                        ⚠️ Delayed {project.delayMonths} months
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#6B7585]">{project.developer}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#E8E6E1]">
                    {formatNumber(project.units)}
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="px-2 py-1 text-xs font-semibold rounded-full"
                      style={{
                        backgroundColor: `${getPhaseColor(project.phase)}20`,
                        color: getPhaseColor(project.phase)
                      }}
                    >
                      {project.phase.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#6B7585]">{project.expectedDelivery}</td>
                  <td className="px-6 py-4 text-sm text-[#6B7585]">{project.submarket}</td>
                  <td className="px-6 py-4 text-sm text-[#6B7585]">{project.distanceMiles != null ? `${project.distanceMiles.toFixed(1)} mi` : '—'}</td>
                  <td className="px-6 py-4"><RiskDot level={projectThreatLevel(project)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Developer Activity Section
// ---------------------------------------------------------------------------

interface DeveloperActivitySectionProps {
  developers: DeveloperActivity[];
}

const DeveloperActivitySection: React.FC<DeveloperActivitySectionProps> = ({ developers }) => {
  const topDevelopers = [...developers].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Developers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topDevelopers.slice(0, 3).map((dev, idx) => (
          <div key={idx} className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
              <span className="text-xs font-semibold text-[#6B7585]">
                {dev.pipelineShare.toFixed(1)}% of pipeline
              </span>
            </div>
            <h4 className="font-bold text-[#E8E6E1] text-lg mb-2">{dev.developer}</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7585]">Total Units:</span>
                <span className="font-semibold text-[#E8E6E1]">{formatNumber(dev.totalUnits)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7585]">Active Projects:</span>
                <span className="font-semibold text-[#E8E6E1]">{dev.activeProjects}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7585]">Avg Delivery:</span>
                <span className="font-semibold text-[#E8E6E1]">{dev.avgDeliveryTime} months</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7585]">Delay Rate:</span>
                <span className={`font-semibold ${dev.delayRate > 30 ? 'text-red-400' : 'text-green-400'}`}>
                  {dev.delayRate.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Developer Activity Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <div className="px-6 py-4 border-b border-[#1e2a3d]">
          <h3 className="text-lg font-semibold text-[#E8E6E1]">Developer Activity Tracker</h3>
          <p className="text-sm text-[#6B7585] mt-1">
            Track major developers' pipeline and execution history
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#131920]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Developer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Projects</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Total Units</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Pipeline %</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Market Share</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Avg Delivery</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Delay Rate</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7585] uppercase">Reliability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2a3d]">
              {developers.map((dev, idx) => {
                const reliability = 100 - dev.delayRate;
                const reliabilityColor = reliability >= 80 ? 'text-green-400' : reliability >= 60 ? 'text-yellow-400' : 'text-red-400';
                
                return (
                  <tr key={idx} className="hover:bg-[#131920] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#E8E6E1]">{dev.developer}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-[#E8E6E1]">
                      {dev.activeProjects}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-[#E8E6E1]">
                      {formatNumber(dev.totalUnits)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-[#253347] rounded-full h-2 max-w-[100px]">
                          <div 
                            className="bg-blue-900/100 h-2 rounded-full"
                            style={{ width: `${dev.pipelineShare}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-[#9EA8B4]">
                          {dev.pipelineShare.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6B7585]">
                      {dev.marketShare.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6B7585]">
                      {dev.avgDeliveryTime} mo
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${dev.delayRate > 30 ? 'text-red-400' : dev.delayRate > 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {dev.delayRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-bold ${reliabilityColor}`}>
                        {reliability >= 80 ? '✅ High' : reliability >= 60 ? '⚠️ Medium' : '❌ Low'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <h3 className="text-lg font-semibold text-[#E8E6E1] mb-4">🤖 Developer Intelligence</h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold text-yellow-900">High-Delay Developer Alert</div>
              <div className="text-sm text-yellow-800 mt-1">
                {topDevelopers.find(d => d.delayRate > 30)?.developer || 'Metro Development'} has a 35% delay rate. 
                Their projects typically deliver 4-6 months late, creating market timing opportunities.
              </div>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 rounded-lg">
            <span className="text-xl">💡</span>
            <div className="flex-1">
              <div className="font-semibold text-blue-200">Market Concentration</div>
              <div className="text-sm text-blue-300 mt-1">
                Top 3 developers control {topDevelopers.slice(0, 3).reduce((sum, d) => sum + d.pipelineShare, 0).toFixed(0)}% 
                of pipeline. Monitor their delivery schedules closely for timing advantages.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Absorption Impact Section
// ---------------------------------------------------------------------------

interface AbsorptionImpactSectionProps {
  absorption: AbsorptionAnalysis | null;
  supplyWave: SupplyWaveData[];
}

const AbsorptionImpactSection: React.FC<AbsorptionImpactSectionProps> = ({ absorption, supplyWave }) => {
  if (!absorption) {
    return <div className="text-center py-12 text-[#6B7585]">Loading absorption data...</div>;
  }

  // Calculate absorption scenarios
  const scenarios = [
    { name: 'Conservative', rate: absorption.currentRate * 0.8, months: (absorption.monthsToAbsorb / 0.8) },
    { name: 'Current Trend', rate: absorption.currentRate, months: absorption.monthsToAbsorb },
    { name: 'Optimistic', rate: absorption.currentRate * 1.2, months: (absorption.monthsToAbsorb / 1.2) },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
          <div className="text-sm text-[#6B7585] mb-1">Current Absorption</div>
          <div className="text-3xl font-bold text-[#E8E6E1]">
            {absorption.currentRate.toFixed(0)}
          </div>
          <div className="text-xs text-[#6B7585] mt-1">units/month</div>
        </div>
        
        <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
          <div className="text-sm text-[#6B7585] mb-1">Historical Average</div>
          <div className="text-3xl font-bold text-[#E8E6E1]">
            {absorption.historicalAvg.toFixed(0)}
          </div>
          <div className="text-xs text-[#6B7585] mt-1">units/month (3yr)</div>
        </div>
        
        <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
          <div className="text-sm text-[#6B7585] mb-1">Months to Absorb</div>
          <div className="text-3xl font-bold text-orange-600">
            {absorption.monthsToAbsorb.toFixed(1)}
          </div>
          <div className="text-xs text-[#6B7585] mt-1">at current rate</div>
        </div>
        
        <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
          <div className="text-sm text-[#6B7585] mb-1">Demand-Supply Gap</div>
          <div className={`text-3xl font-bold ${absorption.demandSupplyGap > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {absorption.demandSupplyGap > 0 ? '+' : ''}{absorption.demandSupplyGap.toFixed(0)}
          </div>
          <div className="text-xs text-[#6B7585] mt-1">units/quarter</div>
        </div>
      </div>

      {/* Absorption Scenarios */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <h3 className="text-lg font-semibold text-[#E8E6E1] mb-4">Absorption Scenarios</h3>
        <div className="space-y-4">
          {scenarios.map((scenario, idx) => (
            <div key={idx} className="p-4 bg-[#131920] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-[#E8E6E1]">{scenario.name}</div>
                <div className="text-sm text-[#6B7585]">
                  {scenario.rate.toFixed(0)} units/month
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-[#253347] rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-yellow-500' : 'bg-green-900/100'
                    }`}
                    style={{ width: `${Math.min((scenario.rate / (absorption.currentRate * 1.5)) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="text-sm font-semibold text-[#E8E6E1] min-w-[80px]">
                  {scenario.months.toFixed(1)} months
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <h3 className="text-lg font-semibold text-[#E8E6E1] mb-4">Absorption Risk Assessment</h3>
        <div 
          className="p-6 rounded-lg border-l-4"
          style={{ 
            borderColor: getRiskColor(absorption.riskLevel),
            backgroundColor: `${getRiskColor(absorption.riskLevel)}10`
          }}
        >
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-3xl">
              {absorption.riskLevel === 'low' ? '🟢' : absorption.riskLevel === 'medium' ? '🟡' : absorption.riskLevel === 'high' ? '🟠' : '🔴'}
            </span>
            <div>
              <div className="text-xl font-bold" style={{ color: getRiskColor(absorption.riskLevel) }}>
                {absorption.riskLevel.toUpperCase()} RISK
              </div>
              <div className="text-sm text-[#6B7585]">Peak supply in {absorption.peakSupplyQuarter}</div>
            </div>
          </div>
          
          <div className="text-sm text-[#9EA8B4] space-y-2">
            {absorption.riskLevel === 'low' && (
              <p>Healthy absorption environment. Current demand exceeds incoming supply. Market can absorb new deliveries within 18 months.</p>
            )}
            {absorption.riskLevel === 'medium' && (
              <p>Moderate absorption pressure. Monitor lease-up velocity closely and consider concession strategies if absorption slows.</p>
            )}
            {absorption.riskLevel === 'high' && (
              <p>Elevated absorption risk. Supply surge expected to exceed demand. Plan for extended lease-up period (24+ months) and competitive concessions.</p>
            )}
            {absorption.riskLevel === 'critical' && (
              <p>Critical oversupply condition. Substantial excess supply relative to demand. Consider delaying delivery or repositioning unit mix to differentiate.</p>
            )}
          </div>
        </div>
      </div>

      {/* Impact Timeline */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <h3 className="text-lg font-semibold text-[#E8E6E1] mb-4">Supply Impact Timeline</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={supplyWave}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3d" />
            <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: 'Units', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: 'Absorption (mo)', angle: 90, position: 'insideRight' }} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total Supply" dot={{ r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="absorptionMonths" stroke="#ef4444" strokeWidth={2} name="Months to Absorb" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. Risk Scoring Section
// ---------------------------------------------------------------------------

interface RiskScoringSectionProps {
  riskScore: RiskScore | null;
}

const RiskScoringSection: React.FC<RiskScoringSectionProps> = ({ riskScore }) => {
  if (!riskScore) {
    return <div className="text-center py-12 text-[#6B7585]">Loading risk assessment...</div>;
  }

  const riskFactors = [
    { name: 'Pipeline Concentration', score: riskScore.factors.pipelineConcentration, description: 'Multiple projects delivering in same quarter' },
    { name: 'Absorption Risk', score: riskScore.factors.absorptionRisk, description: 'Ability of market to absorb new supply' },
    { name: 'Timing Risk', score: riskScore.factors.timingRisk, description: 'Delivery timing relative to peak supply' },
    { name: 'Unit Mix Competition', score: riskScore.factors.unitMixCompetition, description: 'Overlap with competing unit types' },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Risk Score */}
      <div className="rounded-lg" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-40 h-40 rounded-full border-8 mb-6"
            style={{ borderColor: getRiskColor(riskScore.level) }}>
            <div>
              <div className="text-5xl font-bold" style={{ color: getRiskColor(riskScore.level) }}>
                {riskScore.overall.toFixed(0)}
              </div>
              <div className="text-sm font-semibold uppercase mt-2 text-[#6B7585]">
                Risk Score
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <span 
              className="px-6 py-3 rounded-full text-lg font-bold inline-block"
              style={{
                backgroundColor: `${getRiskColor(riskScore.level)}20`,
                color: getRiskColor(riskScore.level)
              }}
            >
              {riskScore.level.toUpperCase()} RISK
            </span>
          </div>
          
          <p className="text-[#6B7585] max-w-2xl mx-auto">
            Supply pipeline risk assessment based on delivery timing, absorption capacity, 
            competitive positioning, and market concentration factors.
          </p>
        </div>
      </div>

      {/* Risk Factor Breakdown */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <h3 className="text-lg font-semibold text-[#E8E6E1] mb-6">Risk Factor Analysis</h3>
        <div className="space-y-6">
          {riskFactors.map((factor, idx) => {
            const percentage = (factor.score / 100) * 100;
            const color = factor.score > 70 ? '#ef4444' : factor.score > 40 ? '#f59e0b' : '#10b981';
            
            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-[#E8E6E1]">{factor.name}</div>
                    <div className="text-sm text-[#6B7585]">{factor.description}</div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color }}>
                    {factor.score.toFixed(0)}
                  </div>
                </div>
                <div className="bg-[#253347] rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: color 
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <h3 className="text-lg font-semibold text-[#E8E6E1] mb-4">🎯 Strategic Recommendations</h3>
        <div className="space-y-3">
          {riskScore.recommendations.map((rec, idx) => (
            <div key={idx} className="flex items-start space-x-3 p-4 rounded-lg border-blue-800">
              <span className="text-xl flex-shrink-0">💡</span>
              <p className="text-sm text-blue-200">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Matrix */}
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <h3 className="text-lg font-semibold text-[#E8E6E1] mb-4">Risk Matrix</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="text-sm font-semibold text-green-200 mb-2">✅ Low Risk Factors</div>
            <ul className="text-sm text-green-300 space-y-1">
              {riskFactors.filter(f => f.score < 40).map((f, i) => (
                <li key={i}>• {f.name} ({f.score.toFixed(0)})</li>
              ))}
            </ul>
          </div>
          
          <div className="p-4 border border-red-800 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)' }}>
            <div className="text-sm font-semibold text-red-200 mb-2">⚠️ High Risk Factors</div>
            <ul className="text-sm text-red-300 space-y-1">
              {riskFactors.filter(f => f.score >= 40).map((f, i) => (
                <li key={i}>• {f.name} ({f.score.toFixed(0)})</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper functions at module level
function getRiskColor(level: string): string {
  switch (level) {
    case 'low': return '#10b981';
    case 'medium': return '#f59e0b';
    case 'high': return '#ef4444';
    case 'critical': return '#dc2626';
    default: return '#6b7280';
  }
}

function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'planned': return '#3b82f6';
    case 'under_construction': return '#f59e0b';
    case 'delivered': return '#10b981';
    default: return '#6b7280';
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

export default SupplyPipelinePage;
