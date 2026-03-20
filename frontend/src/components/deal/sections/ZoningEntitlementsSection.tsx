import React, { useEffect, useState } from 'react';
import axios from 'axios';
import type {
  Entitlement,
  RegulatoryAlert,
  CapacityScenario,
  DealTimeline,
  ZoningDistrict,
  StrategyAlignment,
  AlertSeverity,
  RiskLevel,
} from '../../../types/zoning.types';

interface ZoningEntitlementsSectionProps {
  dealId: string;
}

interface ZoningCapsuleData {
  zoning: {
    district: ZoningDistrict | null;
    strategyAlignment: StrategyAlignment[];
    byRightCapacity: number | null;
  } | null;
  entitlements: Entitlement[];
  capacityScenarios: CapacityScenario[];
  regulatoryAlerts: RegulatoryAlert[];
  timeline: DealTimeline | null;
}

const severityColors: Record<AlertSeverity, string> = {
  critical: 'bg-[#1c0a0a] text-red-300 border-red-800/50',
  warning: 'bg-[#1a1200] text-amber-300 border-amber-800/50',
  watch: 'bg-[#0d1e3d] text-blue-300 border-blue-900/50',
  info: 'bg-[#131920] text-[#9EA8B4] border-[#1e2a3d]',
};

const severityDots: Record<AlertSeverity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  watch: 'bg-blue-500',
  info: 'bg-gray-400',
};

const riskColors: Record<RiskLevel, string> = {
  low: 'text-green-400 bg-[#022c22]',
  medium: 'text-amber-400 bg-[#1a1200]',
  high: 'text-red-400 bg-[#1c0a0a]',
};

const strategyIcons: Record<string, string> = {
  BTS: '🏗️',
  Flip: '🔄',
  Rental: '🏠',
  STR: '🏨',
  'Build-to-Sell': '🏗️',
  'Build-to-Rent': '🏠',
  'Short-Term Rental': '🏨',
};

const compatIcons: Record<string, { icon: string; color: string }> = {
  compatible: { icon: '✅', color: 'text-green-600' },
  conditional: { icon: '⚠️', color: 'text-amber-400' },
  incompatible: { icon: '❌', color: 'text-red-400' },
};

function SyncLabel() {
  return (
    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1e2a3d]">
      <span className="text-[10px] text-gray-400 italic flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Auto-synced from Zoning Module
      </span>
    </div>
  );
}

function SubSectionCard({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0F1319] rounded-lg border border-[#1e2a3d] p-4">
      <h4 className="text-sm font-semibold text-[#E8E6E1] mb-3 flex items-center gap-2">
        <span className="text-xs font-bold text-purple-600 bg-[#1a0d3d] rounded px-1.5 py-0.5">{number}</span>
        {title}
      </h4>
      {children}
      <SyncLabel />
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-xs text-[#6B7585]">{label}</span>
      <span className="text-xs font-medium text-[#E8E6E1]">{value ?? '—'}</span>
    </div>
  );
}

export const ZoningEntitlementsSection: React.FC<ZoningEntitlementsSectionProps> = ({ dealId }) => {
  const [data, setData] = useState<ZoningCapsuleData>({
    zoning: null,
    entitlements: [],
    capacityScenarios: [],
    regulatoryAlerts: [],
    timeline: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [entRes, zoningRes] = await Promise.allSettled([
          axios.get(`/api/v1/entitlements`, { params: { dealId } }),
          axios.get(`/api/v1/zoning/lookup`, { params: { dealId } }),
        ]);

        if (!cancelled) {
          const entData = entRes.status === 'fulfilled' ? entRes.value.data : {};
          const zonData = zoningRes.status === 'fulfilled' ? zoningRes.value.data : {};

          setData({
            zoning: zonData?.district ? {
              district: zonData.district ?? null,
              strategyAlignment: zonData.strategyAlignment ?? [],
              byRightCapacity: zonData.variancePotential?.byRightUnits ?? zonData.district?.maxDensityPerAcre ?? null,
            } : null,
            entitlements: entData?.entitlements ?? entData?.data ?? (Array.isArray(entData) ? entData : []),
            capacityScenarios: zonData?.capacityScenarios ?? [],
            regulatoryAlerts: zonData?.regulatoryAlerts ?? entData?.regulatoryAlerts ?? [],
            timeline: zonData?.timeline ?? entData?.timeline ?? null,
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load zoning data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[#E8E6E1] flex items-center gap-2">
          <span>🏛️</span> Section 3: Regulatory & Land Use
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-[#0F1319] rounded-lg border border-[#1e2a3d] p-4 animate-pulse">
              <div className="h-4 bg-[#1e2a3d] rounded w-2/3 mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-[#131920] rounded w-full" />
                <div className="h-3 bg-[#131920] rounded w-4/5" />
                <div className="h-3 bg-[#131920] rounded w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[#E8E6E1] flex items-center gap-2">
          <span>🏛️</span> Section 3: Regulatory & Land Use
        </h3>
        <div className="bg-[#1c0a0a] border border-red-800/50 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const { zoning, entitlements, capacityScenarios, regulatoryAlerts, timeline } = data;
  const activeEntitlement = entitlements.find(e => e.status !== 'approved' && e.status !== 'denied' && e.status !== 'withdrawn') ?? entitlements[0] ?? null;
  const selectedScenario = capacityScenarios[0] ?? null;
  const activeAlerts = regulatoryAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning');
  const strategies = zoning?.strategyAlignment ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#E8E6E1] flex items-center gap-2">
          <span>🏛️</span> Section 3: Regulatory & Land Use
        </h3>
        <span className="text-xs text-gray-400 italic">Property & Zoning tab</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SubSectionCard number="3.1" title="Zoning Classification">
          {zoning?.district ? (
            <div className="space-y-1">
              <DataRow label="District" value={`${zoning.district.code} — ${zoning.district.name}`} />
              <DataRow label="Municipality" value={zoning.district.municipality} />
              <DataRow label="By-Right Capacity" value={zoning.byRightCapacity != null ? `${zoning.byRightCapacity} units/acre` : '—'} />
              <DataRow label="Max Height" value={zoning.district.maxHeightFeet != null ? `${zoning.district.maxHeightFeet} ft` : '—'} />
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No zoning data available</p>
          )}
        </SubSectionCard>

        <SubSectionCard number="3.2" title="Entitlement Status">
          {activeEntitlement ? (
            <div className="space-y-1">
              <DataRow label="Type" value={activeEntitlement.type.replace(/_/g, ' ').toUpperCase()} />
              <DataRow
                label="Status"
                value={
                  <span className="capitalize">{activeEntitlement.status.replace(/_/g, ' ')}</span>
                }
              />
              <DataRow label="Filed Date" value={activeEntitlement.filedDate ? new Date(activeEntitlement.filedDate).toLocaleDateString() : '—'} />
              <DataRow label="Next Milestone" value={activeEntitlement.nextMilestone ?? '—'} />
              <DataRow
                label="Risk Level"
                value={
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${riskColors[activeEntitlement.riskLevel]}`}>
                    {activeEntitlement.riskLevel}
                  </span>
                }
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No active entitlements</p>
          )}
        </SubSectionCard>

        <SubSectionCard number="3.3" title="Development Capacity Summary">
          {selectedScenario ? (
            <div className="space-y-1">
              <DataRow label="Scenario" value={selectedScenario.label} />
              <DataRow label="Units" value={selectedScenario.maxUnits} />
              <DataRow label="Est. Value" value={selectedScenario.estimatedValue ? `$${selectedScenario.estimatedValue.toLocaleString()}` : '—'} />
              <DataRow
                label="Delta vs By-Right"
                value={
                  selectedScenario.deltaVsByRight !== 0 ? (
                    <span className={selectedScenario.deltaVsByRight > 0 ? 'text-green-600' : 'text-red-400'}>
                      {selectedScenario.deltaVsByRight > 0 ? '+' : ''}{selectedScenario.deltaVsByRight} units ({selectedScenario.deltaPercent > 0 ? '+' : ''}{selectedScenario.deltaPercent}%)
                    </span>
                  ) : (
                    <span className="text-[#6B7585]">Baseline</span>
                  )
                }
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No capacity scenarios available</p>
          )}
        </SubSectionCard>

        <SubSectionCard number="3.4" title="Regulatory Risk Flags">
          {activeAlerts.length > 0 ? (
            <div className="space-y-2">
              {activeAlerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className={`flex items-start gap-2 px-2 py-1.5 rounded border text-xs ${severityColors[alert.severity]}`}>
                  <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${severityDots[alert.severity]}`} />
                  <span className="font-medium leading-tight">{alert.title}</span>
                </div>
              ))}
              {activeAlerts.length > 4 && (
                <p className="text-[10px] text-gray-400">+{activeAlerts.length - 4} more alerts</p>
              )}
            </div>
          ) : regulatoryAlerts.length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <span>✅</span> No critical/warning alerts
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No regulatory alerts</p>
          )}
        </SubSectionCard>

        <SubSectionCard number="3.5" title="Strategy Impact">
          {strategies.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {strategies.map((s) => {
                const compat = compatIcons[s.status] ?? compatIcons.conditional;
                const icon = strategyIcons[s.strategy] ?? '📊';
                return (
                  <div key={s.strategy} className="flex items-center gap-2 px-2 py-1.5 bg-[#0F1319] rounded text-xs">
                    <span>{icon}</span>
                    <span className="font-medium text-[#E8E6E1] truncate">{s.strategy}</span>
                    <span className={`ml-auto ${compat.color}`}>{compat.icon}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {['BTS', 'Flip', 'Rental', 'STR'].map((s) => (
                <div key={s} className="flex items-center gap-2 px-2 py-1.5 bg-[#0F1319] rounded text-xs">
                  <span>{strategyIcons[s]}</span>
                  <span className="font-medium text-[#E8E6E1]">{s}</span>
                  <span className="ml-auto text-gray-400">—</span>
                </div>
              ))}
            </div>
          )}
        </SubSectionCard>

        <SubSectionCard number="3.6" title="Time-to-Shovel & Deal Length">
          {timeline ? (
            <div className="space-y-1">
              <DataRow
                label="Shovel Date"
                value={
                  timeline.phases?.length > 0
                    ? (() => {
                        const preConPhases = timeline.phases.filter(p => p.status !== 'completed');
                        const totalPreCon = preConPhases.reduce((sum, p) => sum + p.durationMonths, 0);
                        const shovelDate = new Date();
                        shovelDate.setMonth(shovelDate.getMonth() + totalPreCon);
                        return shovelDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                      })()
                    : '—'
                }
              />
              <DataRow label="Total Deal Length" value={`${timeline.totalMonths} months`} />
              <DataRow
                label="Pre-Construction"
                value={
                  timeline.phases?.length > 0
                    ? `${timeline.phases.filter(p => p.name.toLowerCase().includes('entitlement') || p.name.toLowerCase().includes('permit') || p.name.toLowerCase().includes('pre')).reduce((s, p) => s + p.durationMonths, 0) || timeline.expected?.months || '—'} months`
                    : `${timeline.expected?.months ?? '—'} months`
                }
              />
              <DataRow
                label="Carrying Cost"
                value={
                  timeline.expected?.carryingCosts?.total != null
                    ? `$${timeline.expected.carryingCosts.total.toLocaleString()}`
                    : '—'
                }
              />
              <DataRow
                label="Delay Risk"
                value={
                  timeline.delayed && timeline.expected ? (
                    <span className={timeline.delayed.months > timeline.expected.months * 1.3 ? 'text-red-400' : 'text-amber-400'}>
                      +{timeline.delayed.months - timeline.expected.months} months
                    </span>
                  ) : '—'
                }
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No timeline data available</p>
          )}
        </SubSectionCard>
      </div>
    </div>
  );
};

export default ZoningEntitlementsSection;
