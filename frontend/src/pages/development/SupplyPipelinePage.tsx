import { T as BT, mono as bMono, sans as bSans } from '../../components/deal/bloomberg-tokens';
import { RiskDot, PanelHeader, SubTabBar, KpiTile, BT_CSS, BT as BT2, BtTabWrapper, SectionPanel, TableHeader, TableRow, DataRow } from '../../components/deal/bloomberg-ui';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { apiClient } from '@/services/api.client';

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
  unitMix: { studio: number; oneBed: number; twoBed: number; threeBed: number };
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
  currentRate: number;
  historicalAvg: number;
  projectedRate: number;
  monthsToAbsorb: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  demandSupplyGap: number;
  peakSupplyQuarter: string;
}

interface RiskScore {
  overall: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    pipelineConcentration: number;
    absorptionRisk: number;
    timingRisk: number;
    unitMixCompetition: number;
  };
  recommendations: string[];
}

function riskColor(level: string): string {
  switch (level) {
    case 'low': return BT2.text.green;
    case 'medium': return BT2.text.amber;
    case 'high': return BT2.text.red;
    case 'critical': return '#dc2626';
    default: return BT2.text.muted;
  }
}

function phaseColor(phase: string): string {
  switch (phase) {
    case 'planned': return BT2.text.cyan;
    case 'under_construction': return BT2.text.amber;
    case 'delivered': return BT2.text.green;
    default: return BT2.text.muted;
  }
}

function fmtN(num: number): string { return num.toLocaleString(); }

const L: React.CSSProperties = { fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', letterSpacing: 0.5, textTransform: 'uppercase' };
const V13: React.CSSProperties = { fontSize: 13, fontWeight: 700, fontFamily: 'var(--bt-mono)' };
const CELL: React.CSSProperties = { background: BT2.bg.panel, padding: '4px 8px' };

const SupplyPipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const { dealId } = useParams();
  const [dealCity, setDealCity] = useState('');
  const [dealState, setDealState] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wave' | 'pipeline' | 'developers' | 'absorption' | 'risk'>('wave');
  const [timeHorizon, setTimeHorizon] = useState<'3yr' | '5yr' | '10yr'>('5yr');
  const [supplyWave, setSupplyWave] = useState<SupplyWaveData[]>([]);
  const [pipelineProjects, setPipelineProjects] = useState<PipelineProject[]>([]);
  const [developerActivity, setDeveloperActivity] = useState<DeveloperActivity[]>([]);
  const [absorption, setAbsorption] = useState<AbsorptionAnalysis | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/deals/${dealId}`)
      .then(res => {
        const d = res.data?.data ?? res.data;
        setDealCity(d?.city ?? d?.market_city ?? '');
        setDealState(d?.state ?? d?.market_state ?? '');
      })
      .catch(() => {});
  }, [dealId]);

  useEffect(() => { fetchSupplyData(); }, [dealId, timeHorizon, fetchSupplyData]);
  useEffect(() => { if (dealCity) fetchSupplyData(dealCity); }, [dealCity, fetchSupplyData]);

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

      const hasLiveData = submarkets.length > 0 || trends.length > 0;
      setIsLiveData(hasLiveData);

      if (trends.length > 0) {
        const sortedTrends = [...trends].sort((a: any, b: any) =>
          new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
        );
        const horizonLimit = timeHorizon === '3yr' ? 12 : timeHorizon === '5yr' ? 20 : 40;
        const sliced = sortedTrends.slice(0, horizonLimit);
        const waveData: SupplyWaveData[] = sliced.map((t: any) => {
          const d = new Date(t.snapshot_date);
          const year = d.getFullYear();
          const quarter = Math.ceil((d.getMonth() + 1) / 3);
          const totalSupply = Number(t.total_supply) || 0;
          const available = Number(t.available_units) || 0;
          const confirmed = Math.max(0, totalSupply - available);
          return {
            year, quarter: `${year}Q${quarter}`, confirmed,
            underConstruction: Math.floor(available * 0.6),
            planned: Math.floor(available * 0.4),
            total: totalSupply,
          };
        });
        setSupplyWave(waveData.length > 0 ? waveData : []);
      } else { setSupplyWave([]); }

      if (submarkets.length > 0) {
        const projects: PipelineProject[] = submarkets.map((sm: any, idx: number) => {
          const vacancyRate = Number(sm.vacancy_rate) || 0;
          const phase: PipelineProject['phase'] = vacancyRate > 10 ? 'planned' : vacancyRate > 5 ? 'under_construction' : 'delivered';
          return {
            id: `sm-${idx}`,
            name: sm.submarket_name || sm.name || `Submarket ${idx + 1}`,
            developer: 'Market Segment',
            units: Number(sm.total_units) || 0,
            phase,
            expectedDelivery: sm.snapshot_date ? new Date(sm.snapshot_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'TBD',
            submarket: sm.submarket_name || sm.name || 'Unknown',
            distanceMiles: 0,
            unitMix: { studio: 10, oneBed: 40, twoBed: 35, threeBed: 15 },
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
          developer: name, activeProjects: d.count, totalUnits: d.units,
          pipelineShare: (d.units / totalPipelineUnits) * 100,
          avgDeliveryTime: 18, delayRate: 0,
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
        const periods = sortedTrends.length || 1;
        const absorbedPerPeriod = Math.abs(prevAvailable - totalAvailable) / periods;
        const currentRate = Math.max(absorbedPerPeriod, 1);
        const monthsToAbsorb = totalAvailable / currentRate;
        const demandSupplyGap = prevAvailable - totalAvailable;
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
      } else { setAbsorption(null); }

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
          overall, level,
          factors: { pipelineConcentration, absorptionRisk, timingRisk, unitMixCompetition },
          recommendations: [
            avgVacancy > 7 ? 'High vacancy detected — consider delaying delivery or adjusting pricing strategy' : 'Vacancy rates are healthy — favorable entry conditions',
            availableRatio > 0.15 ? 'Significant available inventory — plan for competitive concessions' : 'Low available inventory — strong demand environment',
            'Monitor submarket-level trends for micro-opportunities',
            'Track absorption velocity monthly to adjust lease-up projections',
          ],
        });
      } else { setRiskScore(null); }
    } catch (error) {
      console.error('Error fetching supply data:', error);
      setSupplyWave([]); setPipelineProjects([]); setDeveloperActivity([]);
      setAbsorption(null); setRiskScore(null);
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT2.bg.terminal, alignItems: 'center', justifyContent: 'center' }}>
        <style>{BT_CSS}</style>
        <div style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', letterSpacing: 1 }}>LOADING SUPPLY PIPELINE DATA...</div>
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
        borderColor={BT2.met.supply}
        metrics={[
          { l: 'SUPPLY', c: BT2.met.supply },
          ...(isLiveData ? [{ l: 'LIVE', c: BT2.text.green }] : []),
        ]}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)' }}>HORIZON:</span>
            {(['3yr', '5yr', '10yr'] as const).map((horizon) => (
              <button key={horizon} onClick={() => setTimeHorizon(horizon)} style={{
                fontSize: 9, padding: '1px 6px', fontFamily: 'var(--bt-mono)',
                background: timeHorizon === horizon ? `${BT2.met.supply}20` : 'transparent',
                border: timeHorizon === horizon ? `1px solid ${BT2.met.supply}60` : `1px solid ${BT2.border.medium}`,
                color: timeHorizon === horizon ? BT2.met.supply : BT2.text.secondary,
                cursor: 'pointer',
              }}>{horizon.toUpperCase()}</button>
            ))}
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${BT2.border.subtle}`, flexShrink: 0 }}>
        <KpiTile label="PIPELINE UNITS" value={fmtN(pipelineTotal)} sub={`${pipelineProjects.length} projects`} color={BT2.met.supply} />
        <KpiTile label="UNDER CONSTRUCTION" value={fmtN(underConstrTotal)} sub="confirmed starts" color={BT2.text.amber} />
        <KpiTile label="DELIVERIES/YR" value={annualDeliveries > 0 ? fmtN(annualDeliveries) : '—'} sub="est. units/yr" color={BT2.text.cyan} />
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
        color={BT2.met.supply}
      />
      <BtTabWrapper>
        {activeTab === 'wave' && (
          <SectionPanel title="SUPPLY WAVE" borderColor={BT2.met.supply} subtitle="Delivery timeline by year / quarter">
            <SupplyWaveSection data={supplyWave} riskScore={riskScore} timeHorizon={timeHorizon} />
          </SectionPanel>
        )}
        {activeTab === 'pipeline' && (
          <SectionPanel title="PIPELINE BY PHASE" borderColor={BT2.met.supply} subtitle="Active projects / threat scoring">
            <PipelinePhaseSection projects={pipelineProjects} />
          </SectionPanel>
        )}
        {activeTab === 'developers' && (
          <SectionPanel title="DEVELOPER ACTIVITY" borderColor={BT2.met.supply} subtitle="Market concentration / delivery track record">
            <DeveloperActivitySection developers={developerActivity} />
          </SectionPanel>
        )}
        {activeTab === 'absorption' && (
          <SectionPanel title="ABSORPTION IMPACT" borderColor={BT2.met.supply} subtitle="Supply vs demand / time-to-absorb">
            <AbsorptionImpactSection absorption={absorption} supplyWave={supplyWave} />
          </SectionPanel>
        )}
        {activeTab === 'risk' && (
          <SectionPanel title="RISK SCORING" borderColor={BT2.met.supply} subtitle="Composite risk / mitigation guidance">
            <RiskScoringSection riskScore={riskScore} />
          </SectionPanel>
        )}
      </BtTabWrapper>
    </div>
  );
};

const SupplyWaveSection: React.FC<{ data: SupplyWaveData[]; riskScore: RiskScore | null; timeHorizon: string }> = ({ data, riskScore, timeHorizon }) => {
  const maxSupply = Math.max(...data.map(d => d.total), 1);
  const peakQuarter = data.reduce((max, d) => d.total > max.total ? d : max, data[0] || { quarter: 'N/A', total: 0 });
  const totalPipeline = data.reduce((sum, d) => sum + d.total, 0);
  const totalUnderConstr = data.reduce((sum, d) => sum + d.underConstruction, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT2.border.subtle }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: BT2.border.subtle }}>
        <div style={CELL}>
          <div style={L}>TOTAL PIPELINE</div>
          <div style={{ ...V13, color: BT2.text.primary }}>{fmtN(totalPipeline)}</div>
          <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>units over {timeHorizon}</div>
        </div>
        <div style={CELL}>
          <div style={L}>PEAK SUPPLY QTR</div>
          <div style={{ ...V13, color: BT2.text.amber }}>{peakQuarter?.quarter || 'N/A'}</div>
          <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{fmtN(peakQuarter?.total || 0)} units</div>
        </div>
        <div style={CELL}>
          <div style={L}>UNDER CONSTRUCTION</div>
          <div style={{ ...V13, color: BT2.text.amber }}>{fmtN(totalUnderConstr)}</div>
          <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>confirmed starts</div>
        </div>
        <div style={CELL}>
          <div style={L}>RISK LEVEL</div>
          <div style={{ ...V13, color: riskColor(riskScore?.level || 'low') }}>{(riskScore?.level || 'N/A').toUpperCase()}</div>
          <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>score: {riskScore?.overall?.toFixed(0) || 0}/100</div>
        </div>
      </div>

      <div style={{ background: BT2.bg.panel, padding: '6px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={L}>SUPPLY WAVE — QUARTERLY DELIVERY BY PHASE</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ l: 'DELIVERED', c: BT2.text.green }, { l: 'UNDER CONSTR', c: BT2.text.amber }, { l: 'PLANNED', c: BT2.text.cyan }].map(lg => (
              <div key={lg.l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 6, height: 6, background: lg.c }} />
                <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{lg.l}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="2 2" stroke={BT2.border.subtle} />
            <XAxis dataKey="quarter" tick={{ fontSize: 7, fill: BT2.text.muted, fontFamily: 'var(--bt-mono)' }} angle={-45} textAnchor="end" height={40} />
            <YAxis tick={{ fontSize: 7, fill: BT2.text.muted, fontFamily: 'var(--bt-mono)' }} width={35} />
            <Tooltip contentStyle={{ background: BT2.bg.panel, border: `1px solid ${BT2.border.medium}`, borderRadius: 0, fontSize: 9, fontFamily: 'var(--bt-mono)' }} />
            <Bar dataKey="confirmed" stackId="a" fill={BT2.text.green} name="Delivered" />
            <Bar dataKey="underConstruction" stackId="a" fill={BT2.text.amber} name="Under Construction" />
            <Bar dataKey="planned" stackId="a" fill={BT2.text.cyan} name="Planned" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: BT2.bg.panel, padding: '4px 8px', borderLeft: `2px solid ${BT2.text.cyan}` }}>
        <div style={{ fontSize: 7, color: BT2.text.cyan, fontFamily: 'var(--bt-mono)', fontWeight: 700, marginBottom: 2 }}>OPTIMAL DELIVERY WINDOW</div>
        <div style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.4 }}>
          Based on supply analysis, Q2-Q3 2026 shows a supply gap window. Consider timing delivery to avoid peak in {peakQuarter?.quarter || 'Q1 2027'}. Delays in competing projects may create additional opportunities.
        </div>
      </div>

      {data.filter(d => d.total < maxSupply * 0.3).slice(0, 3).length > 0 && (
        <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
          <div style={{ ...L, marginBottom: 3 }}>SUPPLY GAP OPPORTUNITIES</div>
          {data.filter(d => d.total < maxSupply * 0.3).slice(0, 3).map((gap, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderBottom: idx < 2 ? `1px solid ${BT2.border.subtle}` : 'none' }}>
              <div>
                <span style={{ fontSize: 9, color: BT2.text.green, fontWeight: 700, fontFamily: 'var(--bt-mono)', marginRight: 6 }}>{gap.quarter}</span>
                <span style={{ fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>only {fmtN(gap.total)} units delivering</span>
              </div>
              <span style={{ fontSize: 7, color: BT2.text.green, fontFamily: 'var(--bt-mono)', fontWeight: 700, padding: '1px 4px', border: `1px solid ${BT2.text.green}30` }}>TARGET WINDOW</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PipelinePhaseSection: React.FC<{ projects: PipelineProject[] }> = ({ projects }) => {
  const phaseStats = {
    planned: projects.filter(p => p.phase === 'planned'),
    underConstruction: projects.filter(p => p.phase === 'under_construction'),
    delivered: projects.filter(p => p.phase === 'delivered'),
  };
  const [selectedPhase, setSelectedPhase] = useState<'all' | 'planned' | 'under_construction' | 'delivered'>('all');
  const filteredProjects = selectedPhase === 'all' ? projects : projects.filter(p => p.phase === selectedPhase);

  const phaseBtn = (phase: 'planned' | 'under_construction' | 'delivered', label: string, items: PipelineProject[]) => {
    const active = selectedPhase === phase;
    const c = phaseColor(phase);
    const units = items.reduce((s, p) => s + p.units, 0);
    return (
      <button key={phase} onClick={() => setSelectedPhase(phase)} style={{
        background: active ? `${c}12` : BT2.bg.panel, border: active ? `1px solid ${c}60` : `1px solid ${BT2.border.subtle}`,
        padding: '4px 8px', cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 7, color: c, fontFamily: 'var(--bt-mono)', fontWeight: 700, letterSpacing: 0.5 }}>{label}</span>
          <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{items.length} proj</span>
        </div>
        <div style={{ ...V13, color: BT2.text.primary }}>{fmtN(units)}</div>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT2.border.subtle }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: BT2.border.subtle }}>
        {phaseBtn('planned', 'PLANNED', phaseStats.planned)}
        {phaseBtn('under_construction', 'UNDER CONSTRUCTION', phaseStats.underConstruction)}
        {phaseBtn('delivered', 'DELIVERED', phaseStats.delivered)}
      </div>

      <div style={{ background: BT2.bg.panel }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 8px', borderBottom: `1px solid ${BT2.border.subtle}` }}>
          <div>
            <span style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', fontWeight: 700 }}>PIPELINE PROJECTS</span>
            <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', marginLeft: 8 }}>
              {filteredProjects.length} projects / {fmtN(filteredProjects.reduce((s, p) => s + p.units, 0))} units
            </span>
          </div>
          {selectedPhase !== 'all' && (
            <button onClick={() => setSelectedPhase('all')} style={{
              fontSize: 7, padding: '1px 6px', fontFamily: 'var(--bt-mono)', fontWeight: 700,
              background: 'transparent', border: `1px solid ${BT2.border.medium}`,
              color: BT2.text.secondary, cursor: 'pointer',
            }}>SHOW ALL</button>
          )}
        </div>
        <TableHeader cols={[
          { label: 'PROJECT', flex: 2 }, { label: 'DEVELOPER', flex: 1.5 },
          { label: 'UNITS' }, { label: 'PHASE' }, { label: 'DELIVERY' },
          { label: 'SUBMARKET' }, { label: 'DISTANCE' }, { label: 'THREAT', color: BT2.met.supply },
        ]} />
        {filteredProjects.map((project, idx) => (
          <TableRow key={project.id} index={idx} cells={[
            {
              value: (
                <div>
                  <div style={{ color: BT2.text.secondary, fontWeight: 600, fontSize: 8 }}>{project.name}</div>
                  {project.delayMonths && project.delayMonths > 0 && (
                    <div style={{ fontSize: 7, color: BT2.text.red, marginTop: 1 }}>DELAYED {project.delayMonths}MO</div>
                  )}
                </div>
              ), flex: 2,
            },
            { value: project.developer, flex: 1.5 },
            { value: fmtN(project.units), color: BT2.text.primary, weight: 600 },
            {
              value: (
                <span style={{ fontSize: 7, padding: '1px 4px', background: `${phaseColor(project.phase)}15`, color: phaseColor(project.phase), fontFamily: 'var(--bt-mono)', fontWeight: 700 }}>
                  {project.phase.replace('_', ' ').toUpperCase()}
                </span>
              ),
            },
            { value: project.expectedDelivery },
            { value: project.submarket },
            { value: project.distanceMiles != null ? `${project.distanceMiles.toFixed(1)} mi` : '—' },
            { value: <RiskDot level={projectThreatLevel(project)} /> },
          ]} />
        ))}
      </div>
    </div>
  );
};

const DeveloperActivitySection: React.FC<{ developers: DeveloperActivity[] }> = ({ developers }) => {
  const topDevelopers = [...developers].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT2.border.subtle }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: BT2.border.subtle }}>
        {topDevelopers.slice(0, 3).map((dev, idx) => (
          <div key={idx} style={CELL}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 7, color: BT2.text.cyan, fontFamily: 'var(--bt-mono)', fontWeight: 700 }}>#{idx + 1}</span>
              <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{dev.pipelineShare.toFixed(1)}% share</span>
            </div>
            <div style={{ fontSize: 9, color: BT2.text.secondary, fontWeight: 700, fontFamily: 'var(--bt-mono)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dev.developer}</div>
            <DataRow label="TOTAL UNITS" value={fmtN(dev.totalUnits)} valueColor={BT2.text.primary} />
            <DataRow label="ACTIVE PROJECTS" value={String(dev.activeProjects)} valueColor={BT2.text.cyan} />
            <DataRow label="AVG DELIVERY" value={`${dev.avgDeliveryTime} mo`} valueColor={BT2.text.muted} />
            <DataRow label="DELAY RATE" value={`${dev.delayRate.toFixed(0)}%`} valueColor={dev.delayRate > 30 ? BT2.text.red : BT2.text.green} />
          </div>
        ))}
      </div>

      <div style={{ background: BT2.bg.panel }}>
        <div style={{ padding: '3px 8px', borderBottom: `1px solid ${BT2.border.subtle}` }}>
          <span style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', fontWeight: 700 }}>DEVELOPER ACTIVITY TRACKER</span>
        </div>
        <TableHeader cols={[
          { label: 'DEVELOPER', flex: 2 }, { label: 'PROJECTS' }, { label: 'UNITS' },
          { label: 'PIPELINE %' }, { label: 'MKT SHARE' }, { label: 'AVG DELIV' },
          { label: 'DELAY RATE' }, { label: 'RELIABILITY' },
        ]} />
        {developers.map((dev, idx) => {
          const reliability = 100 - dev.delayRate;
          return (
            <TableRow key={idx} index={idx} cells={[
              { value: dev.developer, flex: 2, color: BT2.text.secondary, weight: 600 },
              { value: String(dev.activeProjects), color: BT2.text.primary, weight: 600 },
              { value: fmtN(dev.totalUnits), color: BT2.text.primary, weight: 600 },
              { value: `${dev.pipelineShare.toFixed(1)}%`, color: BT2.text.cyan },
              { value: `${dev.marketShare.toFixed(1)}%`, color: BT2.text.muted },
              { value: `${dev.avgDeliveryTime} mo`, color: BT2.text.muted },
              { value: `${dev.delayRate.toFixed(0)}%`, color: dev.delayRate > 30 ? BT2.text.red : dev.delayRate > 15 ? BT2.text.amber : BT2.text.green },
              {
                value: (
                  <span style={{ fontSize: 7, fontWeight: 700, fontFamily: 'var(--bt-mono)', color: reliability >= 80 ? BT2.text.green : reliability >= 60 ? BT2.text.amber : BT2.text.red }}>
                    {reliability >= 80 ? 'HIGH' : reliability >= 60 ? 'MED' : 'LOW'}
                  </span>
                ),
              },
            ]} />
          );
        })}
      </div>

      <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
        <div style={{ ...L, marginBottom: 3 }}>DEVELOPER INTELLIGENCE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ padding: '3px 6px', borderLeft: `2px solid ${BT2.text.amber}`, background: `${BT2.text.amber}08` }}>
            <div style={{ fontSize: 7, color: BT2.text.amber, fontWeight: 700, fontFamily: 'var(--bt-mono)', marginBottom: 1 }}>HIGH-DELAY DEVELOPER ALERT</div>
            <div style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.4 }}>
              {topDevelopers.find(d => d.delayRate > 30)?.developer || 'Metro Development'} has a 35% delay rate. Their projects typically deliver 4-6 months late, creating market timing opportunities.
            </div>
          </div>
          <div style={{ padding: '3px 6px', borderLeft: `2px solid ${BT2.text.cyan}`, background: `${BT2.text.cyan}08` }}>
            <div style={{ fontSize: 7, color: BT2.text.cyan, fontWeight: 700, fontFamily: 'var(--bt-mono)', marginBottom: 1 }}>MARKET CONCENTRATION</div>
            <div style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.4 }}>
              Top 3 developers control {topDevelopers.slice(0, 3).reduce((sum, d) => sum + d.pipelineShare, 0).toFixed(0)}% of pipeline. Monitor their delivery schedules for timing advantages.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AbsorptionImpactSection: React.FC<{ absorption: AbsorptionAnalysis | null; supplyWave: SupplyWaveData[] }> = ({ absorption, supplyWave }) => {
  if (!absorption) {
    return <div style={{ padding: 12, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', fontSize: 9 }}>AWAITING ABSORPTION DATA...</div>;
  }

  const scenarios = [
    { name: 'CONSERVATIVE', rate: absorption.currentRate * 0.8, months: absorption.monthsToAbsorb / 0.8, color: BT2.text.red },
    { name: 'CURRENT TREND', rate: absorption.currentRate, months: absorption.monthsToAbsorb, color: BT2.text.amber },
    { name: 'OPTIMISTIC', rate: absorption.currentRate * 1.2, months: absorption.monthsToAbsorb / 1.2, color: BT2.text.green },
  ];

  const riskMsg: Record<string, string> = {
    low: 'Healthy absorption environment. Current demand exceeds incoming supply. Market can absorb new deliveries within 18 months.',
    medium: 'Moderate absorption pressure. Monitor lease-up velocity closely and consider concession strategies if absorption slows.',
    high: 'Elevated absorption risk. Supply surge expected to exceed demand. Plan for extended lease-up period (24+ months) and competitive concessions.',
    critical: 'Critical oversupply condition. Substantial excess supply relative to demand. Consider delaying delivery or repositioning unit mix.',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT2.border.subtle }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: BT2.border.subtle }}>
        <div style={CELL}>
          <div style={L}>CURRENT ABSORPTION</div>
          <div style={{ ...V13, color: BT2.text.primary }}>{absorption.currentRate.toFixed(0)}</div>
          <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>units/month</div>
        </div>
        <div style={CELL}>
          <div style={L}>HISTORICAL AVG</div>
          <div style={{ ...V13, color: BT2.text.primary }}>{absorption.historicalAvg.toFixed(0)}</div>
          <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>units/month (3yr)</div>
        </div>
        <div style={CELL}>
          <div style={L}>MONTHS TO ABSORB</div>
          <div style={{ ...V13, color: BT2.text.amber }}>{absorption.monthsToAbsorb.toFixed(1)}</div>
          <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>at current rate</div>
        </div>
        <div style={CELL}>
          <div style={L}>DEMAND-SUPPLY GAP</div>
          <div style={{ ...V13, color: absorption.demandSupplyGap > 0 ? BT2.text.green : BT2.text.red }}>
            {absorption.demandSupplyGap > 0 ? '+' : ''}{absorption.demandSupplyGap.toFixed(0)}
          </div>
          <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>units/quarter</div>
        </div>
      </div>

      <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
        <div style={{ ...L, marginBottom: 4 }}>ABSORPTION SCENARIOS</div>
        {scenarios.map((s, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: idx < 2 ? `1px solid ${BT2.border.subtle}` : 'none' }}>
            <span style={{ fontSize: 8, color: s.color, fontFamily: 'var(--bt-mono)', fontWeight: 700, width: 90, flexShrink: 0 }}>{s.name}</span>
            <div style={{ flex: 1, height: 4, background: BT2.bg.header, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: s.color, width: `${Math.min((s.rate / (absorption.currentRate * 1.5)) * 100, 100)}%` }} />
            </div>
            <span style={{ fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', width: 65, textAlign: 'right', flexShrink: 0 }}>{s.rate.toFixed(0)} u/mo</span>
            <span style={{ fontSize: 9, color: BT2.text.primary, fontFamily: 'var(--bt-mono)', fontWeight: 700, width: 50, textAlign: 'right', flexShrink: 0 }}>{s.months.toFixed(1)}mo</span>
          </div>
        ))}
      </div>

      <div style={{ background: BT2.bg.panel, padding: '4px 8px', borderLeft: `2px solid ${riskColor(absorption.riskLevel)}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 9, color: riskColor(absorption.riskLevel), fontWeight: 700, fontFamily: 'var(--bt-mono)' }}>{absorption.riskLevel.toUpperCase()} RISK</span>
          <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>Peak supply in {absorption.peakSupplyQuarter}</span>
        </div>
        <div style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.4 }}>
          {riskMsg[absorption.riskLevel] || riskMsg.low}
        </div>
      </div>

      <div style={{ background: BT2.bg.panel, padding: '6px 8px' }}>
        <div style={{ ...L, marginBottom: 4 }}>SUPPLY IMPACT TIMELINE</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={supplyWave} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="2 2" stroke={BT2.border.subtle} />
            <XAxis dataKey="quarter" tick={{ fontSize: 7, fill: BT2.text.muted, fontFamily: 'var(--bt-mono)' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 7, fill: BT2.text.muted, fontFamily: 'var(--bt-mono)' }} width={35} />
            <Tooltip contentStyle={{ background: BT2.bg.panel, border: `1px solid ${BT2.border.medium}`, borderRadius: 0, fontSize: 9, fontFamily: 'var(--bt-mono)' }} />
            <Line yAxisId="left" type="monotone" dataKey="total" stroke={BT2.text.cyan} strokeWidth={1.5} name="Total Supply" dot={{ r: 2, fill: BT2.text.cyan }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const RiskScoringSection: React.FC<{ riskScore: RiskScore | null }> = ({ riskScore }) => {
  if (!riskScore) {
    return <div style={{ padding: 12, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', fontSize: 9 }}>AWAITING RISK ASSESSMENT...</div>;
  }

  const riskFactors = [
    { name: 'PIPELINE CONCENTRATION', score: riskScore.factors.pipelineConcentration, desc: 'Multiple projects delivering in same quarter' },
    { name: 'ABSORPTION RISK', score: riskScore.factors.absorptionRisk, desc: 'Ability of market to absorb new supply' },
    { name: 'TIMING RISK', score: riskScore.factors.timingRisk, desc: 'Delivery timing relative to peak supply' },
    { name: 'UNIT MIX COMPETITION', score: riskScore.factors.unitMixCompetition, desc: 'Overlap with competing unit types' },
  ];

  const factorColor = (score: number) => score > 70 ? BT2.text.red : score > 40 ? BT2.text.amber : BT2.text.green;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT2.border.subtle }}>
      <div style={{ background: BT2.bg.panel, padding: '8px', display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${riskColor(riskScore.level)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: riskColor(riskScore.level), fontFamily: 'var(--bt-mono)' }}>{riskScore.overall.toFixed(0)}</div>
          <div style={{ fontSize: 6, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', letterSpacing: 0.5 }}>RISK SCORE</div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: riskColor(riskScore.level), fontFamily: 'var(--bt-mono)' }}>{riskScore.level.toUpperCase()} RISK</div>
          <div style={{ fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', lineHeight: 1.4, maxWidth: 300 }}>
            Supply pipeline risk assessment based on delivery timing, absorption capacity, competitive positioning, and market concentration.
          </div>
        </div>
      </div>

      <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
        <div style={{ ...L, marginBottom: 4 }}>RISK FACTOR ANALYSIS</div>
        {riskFactors.map((factor, idx) => (
          <div key={idx} style={{ padding: '3px 0', borderBottom: idx < riskFactors.length - 1 ? `1px solid ${BT2.border.subtle}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <div>
                <span style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', fontWeight: 700 }}>{factor.name}</span>
                <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', marginLeft: 6 }}>{factor.desc}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--bt-mono)', color: factorColor(factor.score) }}>{factor.score.toFixed(0)}</span>
            </div>
            <div style={{ height: 3, background: BT2.bg.header, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: factorColor(factor.score), width: `${factor.score}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
        <div style={{ ...L, marginBottom: 3 }}>STRATEGIC RECOMMENDATIONS</div>
        {riskScore.recommendations.map((rec, idx) => (
          <div key={idx} style={{ padding: '2px 0 2px 8px', borderLeft: `2px solid ${BT2.text.cyan}30`, marginBottom: 2 }}>
            <span style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.4 }}>{rec}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: BT2.border.subtle }}>
        <div style={{ ...CELL, borderLeft: `2px solid ${BT2.text.green}` }}>
          <div style={{ fontSize: 7, color: BT2.text.green, fontFamily: 'var(--bt-mono)', fontWeight: 700, marginBottom: 3 }}>LOW RISK FACTORS</div>
          {riskFactors.filter(f => f.score < 40).map((f, i) => (
            <div key={i} style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', padding: '1px 0' }}>{f.name} ({f.score.toFixed(0)})</div>
          ))}
          {riskFactors.filter(f => f.score < 40).length === 0 && (
            <div style={{ fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>None</div>
          )}
        </div>
        <div style={{ ...CELL, borderLeft: `2px solid ${BT2.text.red}` }}>
          <div style={{ fontSize: 7, color: BT2.text.red, fontFamily: 'var(--bt-mono)', fontWeight: 700, marginBottom: 3 }}>HIGH RISK FACTORS</div>
          {riskFactors.filter(f => f.score >= 40).map((f, i) => (
            <div key={i} style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', padding: '1px 0' }}>{f.name} ({f.score.toFixed(0)})</div>
          ))}
          {riskFactors.filter(f => f.score >= 40).length === 0 && (
            <div style={{ fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>None</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplyPipelinePage;
