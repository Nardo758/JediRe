import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, BarChart3, Calendar, Users, Building2,
  ArrowUpRight, ArrowDownRight, Minus, Info, Edit3, Save, X, AlertTriangle,
} from 'lucide-react';
import { useDealType } from '../../../../stores/dealStore';
import { useDealModule } from '../../../../contexts/DealModuleContext';
import type { DealType } from '../../../../shared/config/deal-type-visibility';

interface AbsorptionScheduleTabProps {
  dealId: string;
  deal?: any;
  totalUnits?: number;
  currentOccupancy?: number;
}

interface AbsorptionPeriod {
  month: number;
  label: string;
  unitsAbsorbed: number;
  cumulativeLeased: number;
  occupancyPct: number;
  oneBR: number;
  twoBR: number;
  threeBR: number;
}

interface UnitMixInput {
  label: string;
  units: number;
  monthlyRent: number;
}

const DEFAULT_UNIT_MIX: UnitMixInput[] = [
  { label: '1BR/1BA', units: 0, monthlyRent: 1450 },
  { label: '2BR/2BA', units: 0, monthlyRent: 1850 },
  { label: '3BR/2BA', units: 0, monthlyRent: 2250 },
];

function generateAbsorptionSchedule(
  totalUnits: number,
  unitMix: UnitMixInput[],
  monthlyVelocity: number,
  startOccupancy: number,
  targetOccupancy: number,
  rampUpMonths: number,
): AbsorptionPeriod[] {
  const periods: AbsorptionPeriod[] = [];
  const startLeased = Math.round(totalUnits * startOccupancy);
  let cumLeased = startLeased;
  const targetLeased = Math.round(totalUnits * targetOccupancy);
  const totalToAbsorb = targetLeased - startLeased;

  if (totalToAbsorb <= 0) return periods;

  const unitMixTotal = unitMix.reduce((s, u) => s + u.units, 0) || totalUnits;
  const mixRatios = unitMix.map(u => unitMixTotal > 0 ? u.units / unitMixTotal : 1 / unitMix.length);

  for (let m = 1; m <= 36; m++) {
    if (cumLeased >= targetLeased) break;

    const rampFactor = m <= rampUpMonths ? (m / rampUpMonths) * 0.7 + 0.3 : 1.0;
    const velocityThisMonth = Math.min(
      Math.round(monthlyVelocity * rampFactor),
      targetLeased - cumLeased,
    );

    cumLeased += velocityThisMonth;

    periods.push({
      month: m,
      label: `Mo ${m}`,
      unitsAbsorbed: velocityThisMonth,
      cumulativeLeased: cumLeased,
      occupancyPct: totalUnits > 0 ? cumLeased / totalUnits : 0,
      oneBR: Math.round(velocityThisMonth * (mixRatios[0] || 0.5)),
      twoBR: Math.round(velocityThisMonth * (mixRatios[1] || 0.35)),
      threeBR: Math.round(velocityThisMonth * (mixRatios[2] || 0.15)),
    });
  }

  return periods;
}

function generateDisplacementSchedule(
  totalUnits: number,
  unitMix: UnitMixInput[],
  monthlyVelocity: number,
  currentOccupancy: number,
  targetOccupancy: number,
  offlineUnits: number,
  renovationMonths: number,
): AbsorptionPeriod[] {
  const periods: AbsorptionPeriod[] = [];
  const currentLeased = Math.round(totalUnits * currentOccupancy);
  const targetLeased = Math.round(totalUnits * targetOccupancy);
  let netOccupied = currentLeased;

  const unitMixTotal = unitMix.reduce((s, u) => s + u.units, 0) || totalUnits;
  const mixRatios = unitMix.map(u => unitMixTotal > 0 ? u.units / unitMixTotal : 1 / unitMix.length);

  const offlinePerMonth = Math.ceil(offlineUnits / Math.max(renovationMonths, 1));

  for (let m = 1; m <= 48; m++) {
    const isRenovating = m <= renovationMonths;
    const unitsGoingOffline = isRenovating ? Math.min(offlinePerMonth, offlineUnits - (offlinePerMonth * (m - 1))) : 0;
    const effectiveOffline = Math.max(0, unitsGoingOffline);
    const returning = !isRenovating ? Math.round(monthlyVelocity * 1.2) : Math.round(monthlyVelocity * 0.5);
    const netChange = returning - effectiveOffline;

    netOccupied = Math.min(targetLeased, Math.max(0, netOccupied + netChange));

    periods.push({
      month: m,
      label: `Mo ${m}`,
      unitsAbsorbed: netChange,
      cumulativeLeased: netOccupied,
      occupancyPct: totalUnits > 0 ? netOccupied / totalUnits : 0,
      oneBR: Math.round(Math.abs(netChange) * (mixRatios[0] || 0.5)),
      twoBR: Math.round(Math.abs(netChange) * (mixRatios[1] || 0.35)),
      threeBR: Math.round(Math.abs(netChange) * (mixRatios[2] || 0.15)),
    });

    if (netOccupied >= targetLeased && !isRenovating) break;
  }

  return periods;
}

const OccupancyRampChart: React.FC<{ periods: AbsorptionPeriod[]; targetOcc: number }> = ({ periods, targetOcc }) => {
  if (periods.length === 0) return null;

  const w = 600;
  const h = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const maxMonth = periods[periods.length - 1].month;
  const xScale = (m: number) => pad.left + (m / maxMonth) * plotW;
  const yScale = (pct: number) => pad.top + plotH - (pct * plotH);

  const points = periods.map(p => `${xScale(p.month)},${yScale(p.occupancyPct)}`).join(' ');
  const fillPoints = `${xScale(periods[0].month)},${yScale(0)} ${points} ${xScale(periods[periods.length - 1].month)},${yScale(0)}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <line x1={pad.left} y1={yScale(targetOcc)} x2={w - pad.right} y2={yScale(targetOcc)}
        stroke="#059669" strokeDasharray="6 3" strokeWidth={1.5} opacity={0.6} />
      <text x={w - pad.right - 2} y={yScale(targetOcc) - 4} fontSize={9} fill="#059669" textAnchor="end">
        Target {(targetOcc * 100).toFixed(0)}%
      </text>

      <polygon points={fillPoints} fill="url(#occGradient)" opacity={0.3} />
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth={2} />

      {periods.filter((_, i) => i % Math.max(1, Math.floor(periods.length / 8)) === 0 || i === periods.length - 1).map(p => (
        <g key={p.month}>
          <circle cx={xScale(p.month)} cy={yScale(p.occupancyPct)} r={3} fill="#2563eb" />
          <text x={xScale(p.month)} y={h - 8} fontSize={9} fill="#78716c" textAnchor="middle">
            {p.label}
          </text>
        </g>
      ))}

      {[0, 0.25, 0.5, 0.75, 1].map(tick => (
        <text key={tick} x={pad.left - 4} y={yScale(tick) + 3} fontSize={9} fill="#a8a29e" textAnchor="end">
          {(tick * 100).toFixed(0)}%
        </text>
      ))}

      <defs>
        <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const AbsorptionScheduleTab: React.FC<AbsorptionScheduleTabProps> = ({
  dealId,
  deal,
  totalUnits: propTotalUnits,
  currentOccupancy: propCurrentOcc,
}) => {
  const dealType = useDealType();
  const dealUnits = propTotalUnits || deal?.units || deal?.target_units || deal?.deal_data?.units || 200;
  const dealOcc = propCurrentOcc ?? (deal?.deal_data?.broker_occupancy ? deal.deal_data.broker_occupancy / 100 : 0);

  const [editing, setEditing] = useState(false);
  const [totalUnits, setTotalUnits] = useState(dealUnits);
  const [unitMix, setUnitMix] = useState<UnitMixInput[]>(() => {
    const mix = [...DEFAULT_UNIT_MIX];
    mix[0].units = Math.round(dealUnits * 0.5);
    mix[1].units = Math.round(dealUnits * 0.35);
    mix[2].units = dealUnits - mix[0].units - mix[1].units;
    return mix;
  });

  const isDev = dealType === 'development';
  const isRedev = dealType === 'redevelopment';
  const isExisting = dealType === 'existing';

  const { emitEvent, updateAbsorptionData, market } = useDealModule();

  const [monthlyVelocity, setMonthlyVelocity] = useState(isDev ? Math.max(5, Math.round(dealUnits * 0.06)) : Math.max(3, Math.round(dealUnits * 0.04)));
  const [startOccupancy, setStartOccupancy] = useState(isDev ? 0 : dealOcc || 0.82);
  const [targetOccupancy, setTargetOccupancy] = useState(0.94);
  const [rampUpMonths, setRampUpMonths] = useState(isDev ? 3 : 2);
  const [offlineUnits, setOfflineUnits] = useState(isRedev ? Math.round(dealUnits * 0.4) : 0);
  const [renovationMonths, setRenovationMonths] = useState(isRedev ? 12 : 0);
  const marketAbsorptionDefault = useMemo(() => {
    if (market?.captureRate && market.captureRate > 0) {
      return Math.max(1, Math.round(market.captureRate * dealUnits / 12));
    }
    return isDev ? Math.max(8, Math.round(dealUnits * 0.05)) : Math.max(5, Math.round(dealUnits * 0.03));
  }, [market, dealUnits, isDev]);
  const [marketAbsorptionRate, setMarketAbsorptionRate] = useState<number>(marketAbsorptionDefault);

  useEffect(() => {
    if (market?.captureRate && market.captureRate > 0) {
      setMarketAbsorptionRate(Math.max(1, Math.round(market.captureRate * dealUnits / 12)));
    }
  }, [market?.captureRate, dealUnits]);
  const [supplyPressureFactor, setSupplyPressureFactor] = useState<number>(1.0);

  const effectiveVelocity = Math.max(1, Math.round(monthlyVelocity * supplyPressureFactor));

  const periods = useMemo(() => {
    if (isRedev) {
      return generateDisplacementSchedule(
        totalUnits, unitMix, effectiveVelocity, startOccupancy, targetOccupancy, offlineUnits, renovationMonths,
      );
    }
    return generateAbsorptionSchedule(
      totalUnits, unitMix, effectiveVelocity, startOccupancy, targetOccupancy, rampUpMonths,
    );
  }, [totalUnits, unitMix, effectiveVelocity, startOccupancy, targetOccupancy, rampUpMonths, offlineUnits, renovationMonths, isRedev]);

  const monthsToStabilization = periods.length > 0 ? periods[periods.length - 1].month : 0;
  const totalAbsorbed = periods.reduce((s, p) => s + Math.max(0, p.unitsAbsorbed), 0);
  const avgMonthlyVelocity = periods.length > 0 ? totalAbsorbed / periods.length : 0;
  const peakMonth = periods.reduce((max, p) => p.unitsAbsorbed > max.unitsAbsorbed ? p : max, periods[0] || { month: 0, unitsAbsorbed: 0 });

  const breakEvenOccupancy = useMemo(() => {
    const avgRent = unitMix.reduce((s, u) => s + u.units * u.monthlyRent, 0) / (totalUnits || 1);
    const estimatedExpensePerUnit = avgRent * 0.45;
    return totalUnits > 0 ? Math.min(0.99, estimatedExpensePerUnit / avgRent) : 0;
  }, [unitMix, totalUnits]);

  useEffect(() => {
    if (periods.length === 0) return;
    const data = {
      monthsToStabilization,
      totalAbsorbed,
      avgMonthlyVelocity,
      concessionPeriodMonths: monthsToStabilization,
      eligibleUnitsPct: totalUnits > 0 ? totalAbsorbed / totalUnits : 0,
      marketAbsorptionRate,
      supplyPressureFactor,
      breakEvenOccupancy,
      dealType,
    };
    updateAbsorptionData(data);
    emitEvent({
      source: 'absorption-schedule',
      type: 'absorption-updated',
      payload: data,
    });
  }, [monthsToStabilization, totalAbsorbed, avgMonthlyVelocity, marketAbsorptionRate, supplyPressureFactor, breakEvenOccupancy, dealType]);

  const showForExisting = isExisting && (dealOcc < 0.92 || startOccupancy < 0.92);

  if (isExisting && !showForExisting && !editing) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
        <Building2 size={32} className="text-stone-300 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-stone-700 mb-1">Absorption Schedule Not Required</h3>
        <p className="text-xs text-stone-500 mb-4">
          This asset is at {((dealOcc || startOccupancy) * 100).toFixed(1)}% occupancy.
          Absorption modeling is most useful when occupancy is below 92%.
        </p>
        <button
          onClick={() => { setEditing(true); setStartOccupancy(dealOcc || 0.82); }}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Model anyway
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-stone-900">
            {isDev ? 'Lease-Up Absorption Schedule' : isRedev ? 'Displacement & Re-Leasing Schedule' : 'Occupancy Recovery Model'}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {isDev && 'Projected lease-up velocity from certificate of occupancy to stabilization'}
            {isRedev && 'Units offline during renovation + re-leasing curve to stabilized occupancy'}
            {isExisting && 'Monthly leasing velocity needed to recover from current occupancy to market'}
          </p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">
              <Save size={12} /> Apply
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 bg-stone-200 text-stone-700 rounded-lg text-xs hover:bg-stone-300">
              <X size={12} /> Close
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs hover:bg-stone-200">
            <Edit3 size={12} /> Edit Assumptions
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="text-stone-400 font-mono text-[10px] uppercase tracking-wider mb-1">Months to Stabilization</div>
          <div className="text-2xl font-bold text-stone-900">{monthsToStabilization}</div>
          <div className="text-xs text-stone-500 mt-1">
            {monthsToStabilization > 0 ? `${(monthsToStabilization / 12).toFixed(1)} years` : 'Already stabilized'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="text-stone-400 font-mono text-[10px] uppercase tracking-wider mb-1">Total Units to Absorb</div>
          <div className="text-2xl font-bold text-stone-900">{totalAbsorbed}</div>
          <div className="text-xs text-stone-500 mt-1">of {totalUnits} total</div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="text-stone-400 font-mono text-[10px] uppercase tracking-wider mb-1">Avg Monthly Velocity</div>
          <div className="text-2xl font-bold text-blue-700">{avgMonthlyVelocity.toFixed(1)}</div>
          <div className="text-xs text-stone-500 mt-1">units/month</div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="text-stone-400 font-mono text-[10px] uppercase tracking-wider mb-1">Peak Absorption</div>
          <div className="text-2xl font-bold text-emerald-700">{peakMonth?.unitsAbsorbed || 0}</div>
          <div className="text-xs text-stone-500 mt-1">{peakMonth ? `Month ${peakMonth.month}` : '—'}</div>
        </div>
      </div>

      {editing && (
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-5">
          <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-4">Absorption Assumptions</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-medium text-stone-600 block mb-1">Total Units</label>
              <input type="number" value={totalUnits} onChange={e => setTotalUnits(parseInt(e.target.value) || 0)}
                className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-stone-600 block mb-1">Monthly Velocity (units/mo)</label>
              <input type="number" value={monthlyVelocity} onChange={e => setMonthlyVelocity(parseInt(e.target.value) || 1)}
                className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-stone-600 block mb-1">Target Occupancy</label>
              <input type="number" value={targetOccupancy} step={0.01} onChange={e => setTargetOccupancy(parseFloat(e.target.value) || 0.94)}
                className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-stone-600 block mb-1">
                {isDev ? 'Start Occupancy (at CO)' : 'Current Occupancy'}
              </label>
              <input type="number" value={startOccupancy} step={0.01} onChange={e => setStartOccupancy(parseFloat(e.target.value) || 0)}
                className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
            </div>
            {!isRedev && (
              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">Ramp-Up Months</label>
                <input type="number" value={rampUpMonths} onChange={e => setRampUpMonths(parseInt(e.target.value) || 1)}
                  className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
              </div>
            )}
            {isRedev && (
              <>
                <div>
                  <label className="text-[11px] font-medium text-stone-600 block mb-1">Units Taken Offline</label>
                  <input type="number" value={offlineUnits} onChange={e => setOfflineUnits(parseInt(e.target.value) || 0)}
                    className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-stone-600 block mb-1">Renovation Duration (months)</label>
                  <input type="number" value={renovationMonths} onChange={e => setRenovationMonths(parseInt(e.target.value) || 1)}
                    className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-stone-200">
            <h5 className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-3">Market & Competitive Factors</h5>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">
                  Market Absorption Rate (units/mo)
                  <span className="text-[9px] text-stone-400 block">Submarket benchmark from M05 comps</span>
                </label>
                <input type="number" value={marketAbsorptionRate} onChange={e => setMarketAbsorptionRate(parseInt(e.target.value) || 1)}
                  className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">
                  Supply Pressure Factor
                  <span className="text-[9px] text-stone-400 block">1.0 = neutral; &lt;1 = oversupply drag; &gt;1 = limited supply tailwind</span>
                </label>
                <input type="number" value={supplyPressureFactor} step={0.05} min={0.5} max={1.5}
                  onChange={e => setSupplyPressureFactor(parseFloat(e.target.value) || 1.0)}
                  className="w-full text-xs font-mono border border-stone-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none" />
              </div>
              {isExisting && (
                <div>
                  <label className="text-[11px] font-medium text-stone-600 block mb-1">
                    Break-Even Occupancy
                    <span className="text-[9px] text-stone-400 block">Occupancy to cover operating expenses</span>
                  </label>
                  <div className="text-sm font-mono font-semibold text-stone-800 mt-1">
                    {(breakEvenOccupancy * 100).toFixed(1)}%
                    {startOccupancy < breakEvenOccupancy && (
                      <span className="ml-2 text-[10px] text-red-600 font-normal flex items-center gap-0.5 inline-flex">
                        <AlertTriangle size={10} /> Below break-even
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h5 className="text-[11px] font-medium text-stone-600 mb-2">Unit Mix</h5>
            <div className="grid grid-cols-3 gap-3">
              {unitMix.map((um, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-500 w-16">{um.label}</span>
                  <input type="number" value={um.units} onChange={e => {
                    const updated = [...unitMix];
                    updated[i] = { ...um, units: parseInt(e.target.value) || 0 };
                    setUnitMix(updated);
                  }}
                    className="w-16 text-xs font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none"
                    placeholder="units" />
                  <span className="text-[10px] text-stone-400">@</span>
                  <input type="number" value={um.monthlyRent} onChange={e => {
                    const updated = [...unitMix];
                    updated[i] = { ...um, monthlyRent: parseInt(e.target.value) || 0 };
                    setUnitMix(updated);
                  }}
                    className="w-20 text-xs font-mono border border-stone-200 rounded px-1.5 py-1 focus:border-blue-400 outline-none"
                    placeholder="$/mo" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h4 className="text-sm font-semibold text-stone-800 mb-4">Occupancy Ramp</h4>
        <OccupancyRampChart periods={periods} targetOcc={targetOccupancy} />
      </div>

      {periods.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <h4 className="text-sm font-semibold text-stone-800">Monthly Absorption Detail</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr style={{ backgroundColor: '#3C4A3B' }}>
                  <th className="text-left px-4 py-2.5 text-white/60 text-[10px] uppercase tracking-wider">Period</th>
                  <th className="text-right px-4 py-2.5 text-white/60 text-[10px] uppercase tracking-wider">Units Absorbed</th>
                  <th className="text-right px-4 py-2.5 text-white/60 text-[10px] uppercase tracking-wider">1BR</th>
                  <th className="text-right px-4 py-2.5 text-white/60 text-[10px] uppercase tracking-wider">2BR</th>
                  <th className="text-right px-4 py-2.5 text-white/60 text-[10px] uppercase tracking-wider">3BR</th>
                  <th className="text-right px-4 py-2.5 text-white/60 text-[10px] uppercase tracking-wider">Cumulative</th>
                  <th className="text-right px-4 py-2.5 text-white/60 text-[10px] uppercase tracking-wider">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => {
                  const isStabilized = p.occupancyPct >= targetOccupancy;
                  return (
                    <tr key={p.month} className={`border-b border-stone-100 ${isStabilized ? 'bg-emerald-50' : i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}`}>
                      <td className="px-4 py-2 text-stone-700 font-medium">{p.label}</td>
                      <td className={`px-4 py-2 text-right ${p.unitsAbsorbed >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {p.unitsAbsorbed >= 0 ? `+${p.unitsAbsorbed}` : p.unitsAbsorbed}
                      </td>
                      <td className="px-4 py-2 text-right text-stone-600">{p.oneBR}</td>
                      <td className="px-4 py-2 text-right text-stone-600">{p.twoBR}</td>
                      <td className="px-4 py-2 text-right text-stone-600">{p.threeBR}</td>
                      <td className="px-4 py-2 text-right text-stone-800 font-semibold">{p.cumulativeLeased}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${isStabilized ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {(p.occupancyPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-sm font-semibold text-blue-900">
            {isDev && 'Development Absorption Model'}
            {isRedev && 'Redevelopment Displacement Model'}
            {isExisting && 'Occupancy Recovery Model'}
          </div>
          <p className="text-[11px] text-blue-700 mt-1">
            {isDev && 'Absorption velocity is ramped during the initial lease-up period, then runs at full speed. The schedule feeds the concessions calculator in Pro Forma (M09) to estimate free-rent burn during lease-up.'}
            {isRedev && 'Units are taken offline in phases during renovation, then re-leased at repositioned rents. The displacement curve feeds the Pro Forma to calculate temporary revenue loss and concession costs.'}
            {isExisting && 'Models the leasing velocity needed to bring occupancy from current levels to market stabilization. Links to Pro Forma concessions to estimate renewal incentives needed.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AbsorptionScheduleTab;
