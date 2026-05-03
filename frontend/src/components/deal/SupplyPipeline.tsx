/**
 * Supply Pipeline Component
 * Visualize competitive projects and supply risk for a deal
 *
 * Features:
 * - Map view: Show competitive projects near deal
 * - Timeline view: Supply delivery schedule
 * - Risk gauge: Visual supply risk indicator
 * - Table view: Pipeline details with status
 */

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BT } from '@/components/deal/bloomberg-ui';
import 'leaflet/dist/leaflet.css';

interface CompetitiveProject {
  dealId: string;
  supplyEventId: string;
  projectName?: string;
  units: number;
  distanceMiles: number;
  competitiveImpact: 'direct' | 'moderate' | 'weak';
  impactWeight: number;
  priceTierMatch: boolean;
  deliveryTiming: string;
  expectedDeliveryDate?: string;
}

interface SupplyRiskScore {
  tradeAreaId: number;
  tradeAreaName?: string;
  quarter: string;
  pipelineUnits: number;
  weightedPipelineUnits: number;
  existingUnits: number;
  supplyRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  monthsToAbsorb?: number;
  absorptionRisk?: 'low' | 'medium' | 'high' | 'critical';
  demandUnits?: number;
  demandSupplyGap?: number;
  netMarketPressure?: number;
}

interface SupplyDeliveryTimeline {
  quarter: string;
  quarterStart: string;
  quarterEnd: string;
  projects: {
    projectName?: string;
    units: number;
    weightedUnits: number;
    status: string;
  }[];
  totalUnits: number;
  totalWeightedUnits: number;
}

interface SupplyPipelineProps {
  dealId: string;
  tradeAreaId: number;
  dealLatitude: number;
  dealLongitude: number;
}

const SupplyPipeline: React.FC<SupplyPipelineProps> = ({
  dealId,
  tradeAreaId,
  dealLatitude,
  dealLongitude
}) => {
  const [view, setView] = useState<'map' | 'timeline' | 'risk' | 'table'>('map');
  const [competitiveProjects, setCompetitiveProjects] = useState<CompetitiveProject[]>([]);
  const [supplyRisk, setSupplyRisk] = useState<SupplyRiskScore | null>(null);
  const [deliveryTimeline, setSupplyDeliveryTimeline] = useState<SupplyDeliveryTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSupplyData();
  // hook intentionally omits fetchSupplyData — it's an inline function recreated each render; including it would cause an infinite re-fetch loop. The function close over the listed primitive deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, tradeAreaId]);

  const fetchSupplyData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch competitive projects
      const competitiveRes = await fetch(`/api/v1/supply/competitive/${dealId}?max_distance=3.0`);
      const competitiveData = await competitiveRes.json();
      if (competitiveData.success) {
        setCompetitiveProjects(competitiveData.data);
      }

      // Fetch supply risk
      const riskRes = await fetch(`/api/v1/supply/trade-area/${tradeAreaId}/risk?quarter=2028-Q1`);
      const riskData = await riskRes.json();
      if (riskData.success) {
        setSupplyRisk(riskData.data);
      }

      // Fetch delivery timeline
      const timelineRes = await fetch(`/api/v1/supply/timeline/${tradeAreaId}?start_quarter=2027-Q1&end_quarter=2028-Q4`);
      const timelineData = await timelineRes.json();
      if (timelineData.success) {
        setSupplyDeliveryTimeline(timelineData.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'low': return BT.text.green;
      case 'medium': return BT.text.amber;
      case 'high': return BT.text.red;
      case 'critical': return BT.text.red;
      default: return BT.text.muted;
    }
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'direct': return BT.text.red;
      case 'moderate': return BT.text.amber;
      case 'weak': return BT.text.green;
      default: return BT.text.muted;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8" style={{ borderRadius: '50%', borderBottom: `2px solid ${BT.text.cyan}` }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4" style={{ background: BT.bg.panel, border: `1px solid ${BT.text.red}`, borderRadius: 0 }}>
        <p style={{ color: BT.text.red, fontFamily: BT.font.label, fontSize: '11px' }}>Error loading supply data: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, borderRadius: 0 }}>
      {/* Header */}
      <div className="p-4" style={{ borderBottom: `1px solid ${BT.border.medium}` }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono }}>Supply Pipeline Analysis</h2>
        <p style={{ fontSize: '11px', color: BT.text.secondary, fontFamily: BT.font.label, marginTop: '4px' }}>
          Competitive projects and supply risk assessment
        </p>
      </div>

      {/* View Tabs */}
      <div className="px-4" style={{ borderBottom: `1px solid ${BT.border.medium}` }}>
        <div className="flex space-x-4">
          {(['map', 'risk', 'timeline', 'table'] as const).map((tab) => {
            const labels = { map: 'Map View', risk: 'Risk Analysis', timeline: 'Delivery Timeline', table: 'Project Table' };
            return (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className="px-4 py-2 transition-colors"
                style={{
                  fontFamily: BT.font.mono,
                  fontSize: '10px',
                  fontWeight: 500,
                  color: view === tab ? BT.text.cyan : BT.text.secondary,
                  borderBottom: view === tab ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
                  background: 'transparent',
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Map View */}
        {view === 'map' && (
          <div className="space-y-4">
            <div className="h-96 overflow-hidden" style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 0 }}>
              <MapContainer
                center={[dealLatitude, dealLongitude]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                {/* Deal Location (Blue) */}
                <Marker position={[dealLatitude, dealLongitude]}>
                  <Popup>
                    <strong>Your Deal</strong>
                  </Popup>
                </Marker>

                {/* Competition Radius Circles */}
                <Circle
                  center={[dealLatitude, dealLongitude]}
                  radius={1609.34} // 1 mile in meters
                  pathOptions={{ color: BT.text.red, fillColor: BT.text.red, fillOpacity: 0.1 }}
                />
                <Circle
                  center={[dealLatitude, dealLongitude]}
                  radius={3218.69} // 2 miles
                  pathOptions={{ color: BT.text.orange, fillColor: BT.text.orange, fillOpacity: 0.05 }}
                />
                <Circle
                  center={[dealLatitude, dealLongitude]}
                  radius={4828.03} // 3 miles
                  pathOptions={{ color: BT.text.amber, fillColor: BT.text.amber, fillOpacity: 0.02 }}
                />

                {/* Competitive Projects */}
                {competitiveProjects.map((project) => (
                  <Marker
                    key={project.supplyEventId}
                    position={[dealLatitude + Math.random() * 0.05, dealLongitude + Math.random() * 0.05]} // TODO: Use actual lat/lng
                  >
                    <Popup>
                      <div style={{ fontSize: '11px', fontFamily: BT.font.label }}>
                        <strong>{project.projectName || 'Unnamed Project'}</strong>
                        <p>Units: {project.units}</p>
                        <p>Distance: {project.distanceMiles.toFixed(2)} mi</p>
                        <p style={{ fontWeight: 600, color: getImpactColor(project.competitiveImpact) }}>
                          {project.competitiveImpact.toUpperCase()} Competition
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-6" style={{ fontSize: '10px', fontFamily: BT.font.label }}>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4" style={{ borderRadius: '50%', background: BT.text.red }}></div>
                <span style={{ color: BT.text.secondary }}>&lt; 1 mile (Direct)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4" style={{ borderRadius: '50%', background: BT.text.orange }}></div>
                <span style={{ color: BT.text.secondary }}>1-2 miles (Moderate)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4" style={{ borderRadius: '50%', background: BT.text.amber }}></div>
                <span style={{ color: BT.text.secondary }}>2-3 miles (Weak)</span>
              </div>
            </div>
          </div>
        )}

        {/* Risk Analysis View */}
        {view === 'risk' && supplyRisk && (
          <div className="space-y-6">
            {/* Risk Gauge */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-48 h-48"
                style={{ borderRadius: '50%', border: `8px solid ${getRiskColor(supplyRisk.riskLevel)}` }}>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: getRiskColor(supplyRisk.riskLevel), fontFamily: BT.font.mono }}>
                    {supplyRisk.supplyRiskScore.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginTop: '8px', color: getRiskColor(supplyRisk.riskLevel), fontFamily: BT.font.mono }}>
                    {supplyRisk.riskLevel} Risk
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label }}>Pipeline Units</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginTop: '4px' }}>
                  {supplyRisk.pipelineUnits.toLocaleString()}
                </div>
                <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label, marginTop: '4px' }}>
                  Weighted: {supplyRisk.weightedPipelineUnits.toLocaleString()}
                </div>
              </div>

              <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label }}>Existing Units</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginTop: '4px' }}>
                  {supplyRisk.existingUnits.toLocaleString()}
                </div>
              </div>

              <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label }}>Months to Absorb</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginTop: '4px' }}>
                  {supplyRisk.monthsToAbsorb?.toFixed(1) || 'N/A'}
                </div>
                <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label, marginTop: '4px', textTransform: 'capitalize' }}>
                  {supplyRisk.absorptionRisk} absorption risk
                </div>
              </div>

              <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label }}>Demand-Supply Gap</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: BT.font.mono, marginTop: '4px', color: (supplyRisk.demandSupplyGap || 0) > 0 ? BT.text.green : BT.text.red }}>
                  {supplyRisk.demandSupplyGap?.toFixed(0) || 'N/A'}
                </div>
                <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label, marginTop: '4px' }}>
                  {(supplyRisk.demandSupplyGap || 0) > 0 ? 'Demand exceeds supply' : 'Oversupply'}
                </div>
              </div>
            </div>

            {/* Risk Interpretation */}
            <div className="p-4" style={{
              borderRadius: 0,
              borderLeft: `4px solid ${getRiskColor(supplyRisk.riskLevel)}`,
              background: BT.bg.panelAlt,
            }}>
              <h3 style={{ fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px', marginBottom: '8px' }}>Risk Assessment</h3>
              <p style={{ fontSize: '11px', color: BT.text.secondary, fontFamily: BT.font.label }}>
                {supplyRisk.riskLevel === 'low' && 'Healthy market with manageable supply. Pipeline represents less than 10% of existing inventory.'}
                {supplyRisk.riskLevel === 'medium' && 'Moderate supply pressure. Monitor absorption rates and adjust rent expectations accordingly.'}
                {supplyRisk.riskLevel === 'high' && 'Elevated supply risk. Pipeline exceeds 20% of existing units. Consider pricing strategy carefully.'}
                {supplyRisk.riskLevel === 'critical' && 'Critical oversupply risk. Pipeline exceeds 35% of existing inventory. Significant absorption challenges expected.'}
              </p>
            </div>
          </div>
        )}

        {/* Timeline View */}
        {view === 'timeline' && (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deliveryTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke={BT.border.subtle} />
                <XAxis dataKey="quarter" tick={{ fill: BT.text.secondary, fontSize: 10 }} />
                <YAxis tick={{ fill: BT.text.secondary, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.primary, fontSize: '10px' }} />
                <Legend wrapperStyle={{ fontSize: '10px', color: BT.text.secondary }} />
                <Bar dataKey="totalUnits" fill={BT.text.cyan} name="Total Units" />
                <Bar dataKey="totalWeightedUnits" fill={BT.text.green} name="Weighted Units" />
              </BarChart>
            </ResponsiveContainer>

            {/* Quarter Details */}
            <div className="space-y-3">
              {deliveryTimeline.map((timeline) => (
                <div key={timeline.quarter} className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 style={{ fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px' }}>{timeline.quarter}</h4>
                    <span style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label }}>
                      {timeline.totalUnits} units ({timeline.totalWeightedUnits.toFixed(0)} weighted)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {timeline.projects.map((project, idx) => (
                      <div key={idx} className="flex items-center justify-between" style={{ fontSize: '10px' }}>
                        <span style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>{project.projectName || 'Unnamed Project'}</span>
                        <span style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>{project.units} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table View */}
        {view === 'table' && (
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: BT.bg.header }}>
                  <th className="px-4 py-3 text-left" style={{ fontSize: '9px', fontWeight: 500, color: BT.text.muted, textTransform: 'uppercase', fontFamily: BT.font.mono }}>Project</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: '9px', fontWeight: 500, color: BT.text.muted, textTransform: 'uppercase', fontFamily: BT.font.mono }}>Units</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: '9px', fontWeight: 500, color: BT.text.muted, textTransform: 'uppercase', fontFamily: BT.font.mono }}>Distance</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: '9px', fontWeight: 500, color: BT.text.muted, textTransform: 'uppercase', fontFamily: BT.font.mono }}>Impact</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: '9px', fontWeight: 500, color: BT.text.muted, textTransform: 'uppercase', fontFamily: BT.font.mono }}>Timing</th>
                  <th className="px-4 py-3 text-left" style={{ fontSize: '9px', fontWeight: 500, color: BT.text.muted, textTransform: 'uppercase', fontFamily: BT.font.mono }}>Price Match</th>
                </tr>
              </thead>
              <tbody>
                {competitiveProjects.map((project) => (
                  <tr key={project.supplyEventId} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td className="px-4 py-3" style={{ fontSize: '11px', color: BT.text.primary, fontFamily: BT.font.label }}>
                      {project.projectName || 'Unnamed Project'}
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: '11px', color: BT.text.primary, fontFamily: BT.font.mono }}>
                      {project.units.toLocaleString()}
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: '11px', color: BT.text.primary, fontFamily: BT.font.mono }}>
                      {project.distanceMiles.toFixed(2)} mi
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1"
                        style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          borderRadius: '2px',
                          background: BT.bg.active,
                          color: getImpactColor(project.competitiveImpact),
                          fontFamily: BT.font.mono,
                        }}
                      >
                        {project.competitiveImpact}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: '11px', color: BT.text.primary, fontFamily: BT.font.label, textTransform: 'capitalize' }}>
                      {project.deliveryTiming.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      {project.priceTierMatch ? (
                        <span style={{ color: BT.text.green, fontSize: '11px' }}>✓ Yes</span>
                      ) : (
                        <span style={{ color: BT.text.muted, fontSize: '11px' }}>No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {competitiveProjects.length === 0 && (
              <div className="text-center py-8" style={{ color: BT.text.muted, fontSize: '11px', fontFamily: BT.font.label }}>
                No competitive projects found within 3 miles
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplyPipeline;
