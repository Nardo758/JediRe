/**
 * Supply Intelligence Panel (M04 Enhancement)
 *
 * Supply pressure gauge with absorption context, competitive project
 * cards with threat scoring, and net demand/supply analysis.
 *
 * Decision: "Will new supply crush my rents or is the market absorbing it?"
 */

import React from 'react';

// ============================================================================
// Mock Data (inline for M04 enhancement)
// ============================================================================

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

const supplyPressure: SupplyPressureData = {
  pressureRatio: 0.85,
  pressureLabel: 'Manageable',
  monthsOfSupply: 14,
  pipelineUnits: 1200,
  existingUnits: 18500,
  annualAbsorption: 1020,
  monthlyAbsorption: 85,
  netAbsorption: 255,
  demandProjected: 1520,
  netDemandSupply: 320,
  verdict: '1,200 units in pipeline sounds scary — but at current absorption (85 units/month), the market clears them in 14 months. Net 320 units of EXCESS demand.',
};

interface CompetitorProject {
  id: string;
  name: string;
  distance: number;
  units: number;
  deliveryDate: string;
  deliveryMonths: number;
  avgRent: number;
  priceTierOverlap: boolean;
  threatLevel: 'high' | 'medium' | 'low';
  status: 'Permitted' | 'Under Construction' | 'Lease-Up' | 'Delivered';
  directCompetitor: boolean;
  notes: string;
}

const competitorProjects: CompetitorProject[] = [
  {
    id: 'cp-1',
    name: 'Peachtree Residences',
    distance: 0.8,
    units: 280,
    deliveryDate: '2027-03',
    deliveryMonths: 12,
    avgRent: 1950,
    priceTierOverlap: true,
    threatLevel: 'high',
    status: 'Under Construction',
    directCompetitor: true,
    notes: 'Same price tier, <1mi away, delivering before stabilization. Primary competitor.',
  },
  {
    id: 'cp-2',
    name: 'Midtown Commons',
    distance: 1.5,
    units: 190,
    deliveryDate: '2027-06',
    deliveryMonths: 15,
    avgRent: 1875,
    priceTierOverlap: true,
    threatLevel: 'high',
    status: 'Under Construction',
    directCompetitor: true,
    notes: 'Same price tier, delivering during your lease-up window.',
  },
  {
    id: 'cp-3',
    name: 'The Buckhead Grand',
    distance: 4.0,
    units: 350,
    deliveryDate: '2027-09',
    deliveryMonths: 18,
    avgRent: 2800,
    priceTierOverlap: false,
    threatLevel: 'low',
    status: 'Permitted',
    directCompetitor: false,
    notes: 'Luxury tier, different tenant pool. 4mi away — minimal overlap.',
  },
  {
    id: 'cp-4',
    name: 'Westside Lofts',
    distance: 2.8,
    units: 120,
    deliveryDate: '2026-12',
    deliveryMonths: 9,
    avgRent: 1650,
    priceTierOverlap: false,
    threatLevel: 'low',
    status: 'Lease-Up',
    directCompetitor: false,
    notes: 'Below your price tier. Already 40% leased — absorption validates demand.',
  },
  {
    id: 'cp-5',
    name: 'Piedmont Station',
    distance: 2.0,
    units: 260,
    deliveryDate: '2028-01',
    deliveryMonths: 22,
    avgRent: 2050,
    priceTierOverlap: true,
    threatLevel: 'medium',
    status: 'Permitted',
    directCompetitor: false,
    notes: 'Same price tier but 22 months out. You\'ll be stabilized by then.',
  },
];

// ============================================================================
// Component
// ============================================================================

export const SupplyIntelligence: React.FC = () => {
  const directCompetitors = competitorProjects.filter(p => p.directCompetitor);

  return (
    <div className="space-y-5">
      {/* Decision Banner */}
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
        <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">Will new supply crush my rents or is the market absorbing it?</div>
      </div>

      {/* Supply Pressure Gauge */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-stone-900">Supply Pressure Gauge</h3>
          <span className="text-[10px] font-mono text-stone-400 tracking-widest">F07: PIPELINE / (EXISTING x ABSORPTION)</span>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-4">
          {/* Gauge */}
          <div className="flex flex-col items-center">
            <PressureGauge value={supplyPressure.pressureRatio} />
            <div className="text-sm font-bold text-stone-900 mt-2">{supplyPressure.pressureRatio}x</div>
            <div className={`text-xs font-semibold mt-1 ${
              supplyPressure.pressureRatio < 1.0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {supplyPressure.pressureLabel}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="space-y-3">
            <MetricRow label="Pipeline Units" value={supplyPressure.pipelineUnits.toLocaleString()} />
            <MetricRow label="Monthly Absorption" value={`${supplyPressure.monthlyAbsorption} units/mo`} />
            <MetricRow label="Months to Clear" value={`${supplyPressure.monthsOfSupply} months`} />
            <MetricRow label="Quarterly Net Absorption" value={`${supplyPressure.netAbsorption} units/qtr`} />
          </div>

          {/* Net Demand/Supply */}
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <div className="text-[10px] font-mono text-emerald-600 tracking-widest mb-2">NET POSITION</div>
            <div className="text-2xl font-bold text-emerald-700">+{supplyPressure.netDemandSupply}</div>
            <div className="text-xs text-emerald-600 mt-1">units excess demand</div>
            <div className="mt-3 text-[11px] text-emerald-800 leading-relaxed">
              Demand: {supplyPressure.demandProjected.toLocaleString()} projected households<br />
              Supply: {supplyPressure.pipelineUnits.toLocaleString()} pipeline units<br />
              Net: <span className="font-bold">+{supplyPressure.netDemandSupply} units positive</span>
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 leading-relaxed">{supplyPressure.verdict}</p>
        </div>
      </div>

      {/* Competitive Project Cards */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-stone-900">Competitive Projects</h3>
          <span className="text-xs font-mono text-amber-600">
            {directCompetitors.length} of {competitorProjects.length} are direct competitors
          </span>
        </div>
        <p className="text-xs text-stone-500 mb-4">
          Direct competitor = same price tier AND &lt;2mi AND delivering &lt;18mo
        </p>

        <div className="space-y-3">
          {competitorProjects.map(project => (
            <CompetitorCard key={project.id} project={project} />
          ))}
        </div>

        {/* Insight */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 leading-relaxed">
            Of {competitorProjects.length} pipeline projects, only {directCompetitors.length} directly compete
            (same price tier, &lt;2mi, delivering before your stabilization).
            The 350-unit luxury tower 4mi away? Different tenant pool — ignore it.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

const PressureGauge: React.FC<{ value: number }> = ({ value }) => {
  const angle = Math.min(value / 2.0, 1) * 180; // 0-2x range mapped to 0-180deg
  const color = value < 0.8 ? '#10b981' : value < 1.2 ? '#d97706' : '#ef4444';

  return (
    <div className="relative" style={{ width: 120, height: 65 }}>
      <svg width="120" height="65" viewBox="0 0 120 65">
        {/* Background arc */}
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e7e5e4" strokeWidth="10" strokeLinecap="round" />
        {/* Value arc */}
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

const CompetitorCard: React.FC<{ project: CompetitorProject }> = ({ project }) => {
  const threatColors = {
    high: 'border-l-red-500 bg-red-50/50',
    medium: 'border-l-amber-500 bg-amber-50/50',
    low: 'border-l-stone-300 bg-stone-50/30',
  };
  const threatBadge = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-stone-100 text-stone-600',
  };

  return (
    <div className={`border border-stone-200 border-l-4 ${threatColors[project.threatLevel]} rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-stone-900">{project.name}</span>
            {project.directCompetitor && (
              <span className="text-[9px] font-bold bg-red-200 text-red-800 px-1.5 py-0.5 rounded">DIRECT</span>
            )}
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${threatBadge[project.threatLevel]}`}>
              {project.threatLevel.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-stone-500 mb-2">
            <span>{project.distance}mi away</span>
            <span>{project.units} units</span>
            <span>${project.avgRent.toLocaleString()}/mo avg</span>
            <span>{project.status}</span>
            <span>Delivering in {project.deliveryMonths}mo</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-relaxed">{project.notes}</p>
        </div>
      </div>
    </div>
  );
};

export default SupplyIntelligence;
