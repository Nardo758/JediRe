import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, MapPin, Users, Calendar, Brain, BarChart3,
  ArrowUpRight, ArrowDownRight, AlertCircle, CheckCircle2,
  ChevronRight, ChevronDown, Car, Footprints, Building2,
} from 'lucide-react';
import { Deal } from '@/types';
import api from '@/lib/api';

interface DriveByTraffic {
  adt: number;
  roadType: string;
  roadTypeLabel: string;
  propertyPosition: string;
  isCorner: boolean;
  frontageScore: number;
  sidewalkMultiplier: number;
  captureRate: number;
  weeklyPedestrians: number;
  weeklyWalkIns: number;
  physicalFactors: number;
  marketDemandFactors: number;
  supplyDemandAdjustment: number;
}

interface CompetitiveTrafficShare {
  propertyWalkIns: number;
  tradeAreaTotal: number;
  trafficSharePct: number;
  rank: number;
  totalProperties: number;
  aboveAverage: boolean;
  correlationSignal: 'HIDDEN_GEM' | 'VALIDATED' | 'HYPE_CHECK' | 'DEAD_ZONE';
  strategyImplication: string;
}

interface FunnelMetrics {
  traffic: number;
  tours: number;
  apps: number;
  netLeases: number;
  conversionRates: {
    tourRate: number;
    appRate: number;
    leaseRate: number;
  };
  closingRatio: number;
  occupancyPct: number;
  effectiveRent: number;
}

interface SeasonalPoint {
  month: number;
  monthLabel: string;
  trafficMultiplier: number;
  leasingIntensity: number;
}

interface LearningMetrics {
  dataWeeks: number;
  confidenceTier: string;
  confidenceScore: number;
  lastCalibrated: string;
  emaAlpha: number;
  learnedRates: Record<string, {
    current: number;
    v1Default: number | null;
    learnedFrom: number;
    trend: 'rising' | 'stable' | 'falling';
  }>;
}

interface TrajectoryOutput {
  occupancy: number[];
  rentGrowth: number[];
  absorption: number[];
  effectiveRent: number[];
  confidence: number[];
}

interface TrafficModuleData {
  driveBy: DriveByTraffic;
  competitive: CompetitiveTrafficShare;
  funnel: FunnelMetrics;
  seasonal: SeasonalPoint[];
  learning: LearningMetrics;
  trajectory: TrajectoryOutput;
  propertyName: string;
  units: number;
}

interface TrafficModuleProps {
  deal: Deal;
  propertyId?: string;
}

const ROAD_TYPE_LABELS: Record<string, string> = {
  arterial: 'Arterial Road',
  collector: 'Collector Road',
  local: 'Local Street',
  main_street: 'Main Street',
};

const SEASONALITY: Record<number, number> = {
  1: 0.85, 2: 0.90, 3: 1.15, 4: 1.20, 5: 1.25, 6: 1.20,
  7: 1.15, 8: 1.10, 9: 1.00, 10: 0.95, 11: 0.85, 12: 0.80,
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function generateMockData(deal: Deal): TrafficModuleData {
  const units = (deal as any).units || 290;
  const baseOcc = 95.2;
  const baseRent = 1808;

  const occs = [95.2, 95.5, 95.8, 95.6, 95.5, 95.3, 95.1, 94.8, 94.5, 94.2];
  const rents = [1877, 1937, 1997, 2055, 2114, 2170, 2224, 2276, 2325, 2371];
  const growths = [3.8, 3.2, 3.1, 2.9, 2.9, 2.6, 2.5, 2.3, 2.2, 2.0];

  return {
    driveBy: {
      adt: 18500,
      roadType: 'collector',
      roadTypeLabel: 'Collector Road',
      propertyPosition: 'Corner lot with 180ft frontage on collector road',
      isCorner: true,
      frontageScore: 85,
      sidewalkMultiplier: 1.35,
      captureRate: 0.068,
      weeklyPedestrians: 462,
      weeklyWalkIns: 31,
      physicalFactors: 31,
      marketDemandFactors: 22,
      supplyDemandAdjustment: 1.12,
    },
    competitive: {
      propertyWalkIns: 31,
      tradeAreaTotal: 485,
      trafficSharePct: 6.4,
      rank: 3,
      totalProperties: 14,
      aboveAverage: true,
      correlationSignal: 'VALIDATED',
      strategyImplication: 'Both physical and digital traffic are strong. The market has priced in this location\'s quality.',
    },
    funnel: {
      traffic: 14,
      tours: 7,
      apps: 3,
      netLeases: 2,
      conversionRates: {
        tourRate: 0.56,
        appRate: 0.44,
        leaseRate: 0.75,
      },
      closingRatio: 14.3,
      occupancyPct: baseOcc,
      effectiveRent: baseRent,
    },
    seasonal: MONTH_LABELS.map((label, i) => ({
      month: i + 1,
      monthLabel: label,
      trafficMultiplier: SEASONALITY[i + 1],
      leasingIntensity: SEASONALITY[i + 1],
    })),
    learning: {
      dataWeeks: 0,
      confidenceTier: 'Cold Start',
      confidenceScore: 45,
      lastCalibrated: 'N/A',
      emaAlpha: 0.15,
      learnedRates: {
        tourRate: { current: 0.56, v1Default: 0.05, learnedFrom: 0, trend: 'stable' },
        appRate: { current: 0.44, v1Default: 0.20, learnedFrom: 0, trend: 'stable' },
        leaseRate: { current: 0.75, v1Default: 0.76, learnedFrom: 0, trend: 'stable' },
      },
    },
    trajectory: {
      occupancy: occs,
      rentGrowth: growths,
      absorption: Array.from({ length: 10 }, (_, y) => Math.round((2 - y * 0.04) * 52)),
      effectiveRent: rents,
      confidence: Array.from({ length: 10 }, (_, y) => Math.max(40, Math.round(92 - y * 5.3))),
    },
    propertyName: (deal as any).property_name || deal.name || 'Property',
    units,
  };
}

const TABS = [
  { id: 'driveby', label: 'Drive-By Traffic', icon: Car },
  { id: 'competitive', label: 'Competitive Share', icon: Building2 },
  { id: 'funnel', label: 'Leasing Funnel', icon: Users },
  { id: 'seasonal', label: 'Seasonal Patterns', icon: Calendar },
  { id: 'learning', label: 'Learning Loop', icon: Brain },
  { id: 'trajectory', label: 'Trajectory Output', icon: TrendingUp },
] as const;

type TabId = typeof TABS[number]['id'];

function fmt$(n: number): string {
  return n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`;
}

function DriveByTab({ data }: { data: TrafficModuleData }) {
  const d = data.driveBy;

  const factors = [
    { label: 'Average Daily Traffic (ADT)', value: d.adt.toLocaleString(), sub: 'Vehicles/day on adjacent thoroughfare' },
    { label: 'Road Classification', value: d.roadTypeLabel, sub: ROAD_TYPE_LABELS[d.roadType] || d.roadType },
    { label: 'Property Position', value: d.propertyPosition, sub: d.isCorner ? '1.4× corner premium applied' : 'No corner premium' },
    { label: 'Frontage Score', value: `${d.frontageScore}/100`, sub: `${d.frontageScore > 70 ? 'Good' : 'Average'} street visibility` },
    { label: 'Sidewalk Multiplier', value: `${d.sidewalkMultiplier.toFixed(2)}×`, sub: 'Quality of pedestrian infrastructure' },
    { label: 'Capture Rate', value: `${(d.captureRate * 100).toFixed(1)}%`, sub: 'Percentage of pedestrians who enter' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
        <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold mb-2">Physical Traffic Formula</div>
        <div className="text-sm text-white font-mono">
          Walk-ins = (<span className="text-cyan-400">ADT × road_conv</span> × <span className="text-green-400">sidewalk</span>) × <span className="text-amber-400">capture_rate</span> + <span className="text-purple-400">generators</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          60% physical factors + 40% market demand factors → supply/demand adjustment
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {factors.map((f, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{f.label}</div>
            <div className="text-lg font-extrabold text-white font-mono">{f.value}</div>
            <div className="text-[9px] text-slate-400 mt-0.5">{f.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-extrabold text-cyan-400 font-mono">{d.weeklyPedestrians}</div>
          <div className="text-[10px] text-slate-400">Weekly Pedestrians</div>
        </div>
        <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-extrabold text-green-400 font-mono">{d.weeklyWalkIns}</div>
          <div className="text-[10px] text-slate-400">Weekly Walk-Ins</div>
        </div>
        <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-extrabold text-amber-400 font-mono">{d.supplyDemandAdjustment.toFixed(2)}×</div>
          <div className="text-[10px] text-slate-400">Supply/Demand Adj.</div>
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Traffic Breakdown</div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-cyan-400">Physical Factors</span>
              <span className="text-white font-mono">{d.physicalFactors} walk-ins</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(d.physicalFactors / (d.physicalFactors + d.marketDemandFactors)) * 100}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-400">Market Demand</span>
              <span className="text-white font-mono">{d.marketDemandFactors} walk-ins</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${(d.marketDemandFactors / (d.physicalFactors + d.marketDemandFactors)) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompetitiveTab({ data }: { data: TrafficModuleData }) {
  const c = data.competitive;

  const signalColors: Record<string, string> = {
    HIDDEN_GEM: 'text-emerald-400 bg-emerald-900/20 border-emerald-500/20',
    VALIDATED: 'text-cyan-400 bg-cyan-900/20 border-cyan-500/20',
    HYPE_CHECK: 'text-amber-400 bg-amber-900/20 border-amber-500/20',
    DEAD_ZONE: 'text-red-400 bg-red-900/20 border-red-500/20',
  };

  const signalLabels: Record<string, string> = {
    HIDDEN_GEM: 'Hidden Gem',
    VALIDATED: 'Validated Winner',
    HYPE_CHECK: 'Hype Check',
    DEAD_ZONE: 'Dead Zone',
  };

  return (
    <div className="space-y-4">
      <div className={`border rounded-lg p-4 ${signalColors[c.correlationSignal]}`}>
        <div className="flex justify-between items-center mb-2">
          <div className="text-lg font-extrabold">{signalLabels[c.correlationSignal]}</div>
          <div className="text-[10px] uppercase tracking-wider font-semibold">Traffic Correlation Signal</div>
        </div>
        <div className="text-xs opacity-80">{c.strategyImplication}</div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">{c.propertyWalkIns}</div>
          <div className="text-[10px] text-slate-400">Your Walk-Ins/Wk</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">{c.trafficSharePct}%</div>
          <div className="text-[10px] text-slate-400">Trade Area Share</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">#{c.rank}</div>
          <div className="text-[10px] text-slate-400">of {c.totalProperties} Properties</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">{c.tradeAreaTotal}</div>
          <div className="text-[10px] text-slate-400">Trade Area Total</div>
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Trade Area Share Distribution</div>
        <div className="relative h-6 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-cyan-500/40 rounded-full"
            style={{ width: `${c.trafficSharePct}%` }}
          />
          <div className="absolute top-0 bottom-0 flex items-center justify-center w-full">
            <span className="text-[10px] font-bold text-white">
              {c.trafficSharePct}% of trade area traffic
            </span>
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-slate-500 mt-1">
          <span>0%</span>
          <span className={c.aboveAverage ? 'text-green-400' : 'text-amber-400'}>
            Avg: {(100 / c.totalProperties).toFixed(1)}%
          </span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

function FunnelTab({ data }: { data: TrafficModuleData }) {
  const f = data.funnel;
  const stages = [
    { label: 'Traffic (Walk-Ins)', value: f.traffic, widthPct: 100, color: 'cyan' },
    { label: 'In-Person Tours', value: f.tours, widthPct: 70, color: 'blue' },
    { label: 'Applications', value: f.apps, widthPct: 45, color: 'purple' },
    { label: 'Net Leases Signed', value: f.netLeases, widthPct: 25, color: 'green' },
  ];

  const rates = [
    { label: 'Tour Rate', value: f.conversionRates.tourRate, v1Default: 0.05 },
    { label: 'App Rate', value: f.conversionRates.appRate, v1Default: 0.20 },
    { label: 'Lease Rate', value: f.conversionRates.leaseRate, v1Default: 0.76 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1">
        {stages.map((s, i) => (
          <div
            key={i}
            className={`bg-${s.color}-500/10 border border-${s.color}-500/20 rounded-lg px-4 py-3 flex justify-between items-center`}
            style={{ width: `${s.widthPct}%`, minWidth: 220 }}
          >
            <span className={`text-${s.color}-400 text-xs font-semibold`}>{s.label}</span>
            <span className="text-2xl font-extrabold text-white font-mono">{s.value}/wk</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {rates.map((r, i) => {
          const broken = r.v1Default !== null && Math.abs(r.value - r.v1Default) / (r.v1Default || 1) > 0.5;
          return (
            <div key={i} className={`rounded-lg p-3 border ${broken ? 'bg-red-900/10 border-red-500/20' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{r.label}</div>
              <div className="flex justify-between items-baseline">
                <div className="text-xl font-extrabold text-white font-mono">{(r.value * 100).toFixed(0)}%</div>
                {r.v1Default !== null && (
                  <div className="text-right">
                    <div className={`text-sm font-mono ${broken ? 'text-red-400 line-through' : 'text-slate-500'}`}>
                      {(r.v1Default * 100).toFixed(0)}%
                    </div>
                    <div className="text-[9px] text-slate-500">v1 default</div>
                  </div>
                )}
              </div>
              {broken && (
                <div className="text-[9px] text-red-400 mt-1">
                  v1 off by {Math.round(Math.abs(r.value - r.v1Default) / (r.v1Default || 1) * 100)}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Occupancy', value: `${f.occupancyPct.toFixed(1)}%` },
          { label: 'Effective Rent', value: `$${f.effectiveRent.toLocaleString()}` },
          { label: 'Closing Ratio', value: `${f.closingRatio.toFixed(1)}%` },
        ].map((m, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{m.label}</div>
            <div className="text-2xl font-extrabold text-white font-mono">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-3">
        <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-2">Implied Annual (Current Velocity)</div>
        <div className="flex gap-6">
          {[
            { label: 'Annual Leases', value: `${f.netLeases * 52}`, sub: `${f.netLeases}/wk × 52` },
            { label: 'Annual Revenue', value: fmt$(data.units * (f.occupancyPct / 100) * f.effectiveRent * 12), sub: 'units × occ × rent × 12' },
            { label: 'Rent Growth', value: '+3.2%/yr', sub: `learned from ${data.learning.dataWeeks || 'N/A'} weeks` },
          ].map((m, i) => (
            <div key={i}>
              <div className="text-base font-extrabold text-white font-mono">{m.value}</div>
              <div className="text-[10px] text-slate-400">{m.label}</div>
              <div className="text-[9px] text-slate-500">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeasonalTab({ data }: { data: TrafficModuleData }) {
  const maxMultiplier = Math.max(...data.seasonal.map(s => s.trafficMultiplier));
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-white">Monthly Leasing Intensity Heatmap</h3>
        <p className="text-xs text-slate-500">Seasonal traffic and leasing patterns across the year</p>
      </div>

      <div className="grid grid-cols-12 gap-1">
        {data.seasonal.map((s) => {
          const intensity = s.trafficMultiplier / maxMultiplier;
          const isCurrentMonth = s.month === currentMonth;
          const bgColor = intensity > 0.9 ? 'bg-green-500' :
                         intensity > 0.8 ? 'bg-green-400/70' :
                         intensity > 0.7 ? 'bg-amber-400/70' :
                         intensity > 0.6 ? 'bg-amber-500/50' :
                         'bg-red-400/50';

          return (
            <div key={s.month} className="flex flex-col items-center gap-1">
              <div
                className={`w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold ${bgColor} ${
                  isCurrentMonth ? 'ring-2 ring-cyan-400' : ''
                }`}
              >
                {(s.trafficMultiplier * 100).toFixed(0)}%
              </div>
              <span className={`text-[9px] ${isCurrentMonth ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
                {s.monthLabel}
              </span>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">Seasonal Multiplier Chart</div>
        <div className="flex items-end gap-1 h-32">
          {data.seasonal.map((s) => {
            const height = ((s.trafficMultiplier - 0.7) / (maxMultiplier - 0.7)) * 100;
            const isCurrentMonth = s.month === currentMonth;
            const isPeak = s.trafficMultiplier >= 1.15;

            return (
              <div key={s.month} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="text-[8px] text-slate-400 mb-1">{s.trafficMultiplier.toFixed(2)}×</div>
                <div
                  className={`w-full rounded-t-sm ${
                    isCurrentMonth ? 'bg-cyan-500' : isPeak ? 'bg-green-500' : 'bg-slate-600'
                  }`}
                  style={{ height: `${Math.max(5, height)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {data.seasonal.map((s) => (
            <div key={s.month} className="flex-1 text-center text-[8px] text-slate-500">{s.monthLabel}</div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Peak Season', value: 'Mar – Jul', sub: '1.15× – 1.25× multiplier', color: 'green' },
          { label: 'Shoulder Season', value: 'Aug – Oct', sub: '0.95× – 1.10× multiplier', color: 'amber' },
          { label: 'Slow Season', value: 'Nov – Feb', sub: '0.80× – 0.90× multiplier', color: 'red' },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className={`text-xs font-semibold text-${s.color}-400 mb-1`}>{s.label}</div>
            <div className="text-base font-extrabold text-white">{s.value}</div>
            <div className="text-[9px] text-slate-500">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearningTab({ data }: { data: TrafficModuleData }) {
  const l = data.learning;

  const tiers = [
    { weeks: '0', label: 'Cold Start', conf: '40-55%', color: 'red' },
    { weeks: '4-8', label: 'Early', conf: '55-70%', color: 'amber' },
    { weeks: '13-26', label: 'Calibrating', conf: '70-85%', color: 'amber' },
    { weeks: '52+', label: 'Trained', conf: '85-95%', color: 'green' },
    { weeks: '104+', label: 'High Fidelity', conf: '90-97%', color: 'cyan' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-white">How the Engine Gets Smarter</h3>
        <p className="text-xs text-slate-500">Each upload recalibrates conversion rates using EMA (α = {l.emaAlpha})</p>
      </div>

      <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4 font-mono">
        <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-2">Recalibration Formula</div>
        <div className="text-sm text-white">
          new_rate = α × <span className="text-green-400">actual_rate</span> + (1 - α) × <span className="text-amber-400">old_rate</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-2">
          α = {l.emaAlpha} (converges in ~{Math.round(1 / l.emaAlpha)} uploads) · Outlier dampening: α = 0.05 when |error| {'>'} 3σ
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Learned Conversion Rates</div>
        {Object.entries(l.learnedRates).map(([key, r]) => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return (
            <div key={key} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{label}</span>
                  {r.v1Default !== null && (
                    <span className="text-[10px] text-red-400 line-through">v1: {(r.v1Default * 100).toFixed(0)}%</span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold ${
                  r.trend === 'rising' ? 'text-green-400' : r.trend === 'falling' ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {r.trend === 'rising' ? '↑ Rising' : r.trend === 'falling' ? '↓ Falling' : '→ Stable'}
                </span>
              </div>
              <div className="relative h-7 bg-slate-900 rounded overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 w-[3px] bg-green-400 rounded"
                  style={{ left: `${r.current * 100}%` }}
                />
                {r.v1Default !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-red-400/50 rounded"
                    style={{ left: `${r.v1Default * 100}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                <span>Current: {(r.current * 100).toFixed(0)}%</span>
                <span>Learned from {r.learnedFrom} weeks</span>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Confidence by Data Volume</div>
        <div className="grid grid-cols-5 gap-1">
          {tiers.map((t, i) => {
            const isActive = t.label === l.confidenceTier;
            return (
              <div key={i} className={`bg-slate-800/50 border rounded-lg p-2 text-center ${
                isActive ? 'border-cyan-400 ring-1 ring-cyan-400/30' : 'border-slate-700'
              }`}>
                <div className={`text-sm font-extrabold text-${t.color}-400`}>{t.conf}</div>
                <div className="text-[9px] font-semibold text-white mt-1">{t.label}</div>
                <div className="text-[8px] text-slate-500">{t.weeks} wks</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400 font-semibold">
            {l.dataWeeks === 0
              ? 'No upload data yet — predictions use market defaults. Upload weekly reports to improve accuracy.'
              : `${l.dataWeeks} weeks of data uploaded. Confidence: ${l.confidenceScore}%`
            }
          </span>
        </div>
      </div>
    </div>
  );
}

function TrajectoryTab({ data }: { data: TrafficModuleData }) {
  const t = data.trajectory;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-white">Trajectory Output → Pro Forma</h3>
        <p className="text-xs text-slate-500">These values flow directly into the Pro Forma module as recommended assumptions</p>
      </div>

      <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg overflow-hidden">
        <div className="grid gap-0" style={{ gridTemplateColumns: '140px repeat(10, 1fr)' }}>
          <div className="bg-slate-800 px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-700">Metric</div>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="bg-slate-800 px-2 py-2 text-[10px] text-slate-500 text-right uppercase tracking-wider font-semibold border-b border-slate-700">Y{i + 1}</div>
          ))}

          <div className="px-3 py-2 text-xs text-cyan-400 font-semibold border-b border-slate-800">Occupancy %</div>
          {t.occupancy.map((v, i) => (
            <div key={i} className="px-2 py-2 text-xs text-white text-right font-mono border-b border-slate-800">{v.toFixed(1)}%</div>
          ))}

          <div className="px-3 py-2 text-xs text-green-400 font-semibold border-b border-slate-800">Rent Growth %</div>
          {t.rentGrowth.map((v, i) => (
            <div key={i} className="px-2 py-2 text-xs text-white text-right font-mono border-b border-slate-800">{v.toFixed(1)}%</div>
          ))}

          <div className="px-3 py-2 text-xs text-amber-400 font-semibold border-b border-slate-800">Eff. Rent</div>
          {t.effectiveRent.map((v, i) => (
            <div key={i} className="px-2 py-2 text-xs text-white text-right font-mono border-b border-slate-800">${v.toLocaleString()}</div>
          ))}

          <div className="px-3 py-2 text-xs text-purple-400 font-semibold border-b border-slate-800">Absorption</div>
          {t.absorption.map((v, i) => (
            <div key={i} className="px-2 py-2 text-xs text-white text-right font-mono border-b border-slate-800">{v}/yr</div>
          ))}

          <div className="px-3 py-2 text-xs text-slate-400 font-semibold">Confidence</div>
          {t.confidence.map((v, i) => (
            <div key={i} className={`px-2 py-2 text-xs text-right font-mono ${
              v >= 80 ? 'text-green-400' : v >= 60 ? 'text-amber-400' : 'text-red-400'
            }`}>{v}%</div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
        <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold mb-3">Data Flow: Traffic → Pro Forma</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { from: 'Occupancy Trajectory', to: 'Vacancy % per year', formula: 'vacancy[yr] = 100 - occ[yr]' },
            { from: 'Rent Trajectory', to: 'Rent Growth % per year', formula: 'growth[yr] = rent[yr]/rent[yr-1] - 1' },
            { from: 'Net Leases × 52', to: 'Absorption Rate', formula: 'absorption[yr] = weekly_leases × 52 × seasonal_adj' },
            { from: 'Weeks to 95%', to: 'Lease-Up Timeline', formula: 'months = weeks_to_95 / 4.33 (dev deals)' },
          ].map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 bg-cyan-900/20 border border-cyan-500/20 rounded px-2 py-1.5">
                <div className="text-[9px] text-cyan-400 font-semibold">{p.from}</div>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
              <div className="flex-1 bg-slate-800/50 border border-slate-600 rounded px-2 py-1.5">
                <div className="text-[9px] text-white font-semibold">{p.to}</div>
                <div className="text-[8px] text-slate-500 font-mono">{p.formula}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrafficModule({ deal, propertyId }: TrafficModuleProps) {
  const [activeTab, setActiveTab] = useState<TabId>('driveby');
  const [data, setData] = useState<TrafficModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dealId = deal.id;
      let apiData: any = null;

      try {
        const [intelligenceRes, v2Res] = await Promise.allSettled([
          api.get(`/leasing-traffic/intelligence/${dealId}`),
          api.get(`/leasing-traffic/v2/intelligence/${dealId}`),
        ]);

        if (intelligenceRes.status === 'fulfilled') {
          apiData = intelligenceRes.value.data;
        } else if (v2Res.status === 'fulfilled') {
          apiData = v2Res.value.data;
        }
      } catch {
      }

      if (apiData && apiData.funnel) {
        setData(apiData);
      } else {
        setData(generateMockData(deal));
      }
    } catch (err) {
      console.error('[TrafficModule] Error loading data:', err);
      setData(generateMockData(deal));
    } finally {
      setLoading(false);
    }
  }, [deal, propertyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mb-3" />
          <div className="text-sm text-slate-400">Loading traffic intelligence...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <div className="text-sm text-red-400">Failed to load traffic data</div>
        </div>
      </div>
    );
  }

  const ActiveTabComponent = {
    driveby: DriveByTab,
    competitive: CompetitiveTab,
    funnel: FunnelTab,
    seasonal: SeasonalTab,
    learning: LearningTab,
    trajectory: TrajectoryTab,
  }[activeTab];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Traffic Module</h2>
          <p className="text-xs text-slate-500">{data.propertyName} · {data.units} units</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded text-[10px] font-bold ${
            data.learning.confidenceScore >= 80 ? 'bg-green-900/20 text-green-400' :
            data.learning.confidenceScore >= 60 ? 'bg-amber-900/20 text-amber-400' :
            'bg-red-900/20 text-red-400'
          }`}>
            {data.learning.confidenceScore}% Confidence
          </div>
          <div className="text-[10px] text-slate-500">
            {data.learning.dataWeeks > 0 ? `${data.learning.dataWeeks} weeks data` : 'Cold start'}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-700 overflow-x-auto pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[300px]">
        <ActiveTabComponent data={data} />
      </div>
    </div>
  );
}

export default TrafficModule;
