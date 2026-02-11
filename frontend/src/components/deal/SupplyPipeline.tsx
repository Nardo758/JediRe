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
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'critical': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'direct': return '#ef4444';
      case 'moderate': return '#f59e0b';
      case 'weak': return '#10b981';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading supply data: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-xl font-semibold text-gray-900">Supply Pipeline Analysis</h2>
        <p className="text-sm text-gray-600 mt-1">
          Competitive projects and supply risk assessment
        </p>
      </div>

      {/* View Tabs */}
      <div className="border-b border-gray-200 px-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setView('map')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              view === 'map'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Map View
          </button>
          <button
            onClick={() => setView('risk')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              view === 'risk'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Risk Analysis
          </button>
          <button
            onClick={() => setView('timeline')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              view === 'timeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Delivery Timeline
          </button>
          <button
            onClick={() => setView('table')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              view === 'table'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Project Table
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Map View */}
        {view === 'map' && (
          <div className="space-y-4">
            <div className="h-96 rounded-lg overflow-hidden border border-gray-300">
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
                  pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1 }}
                />
                <Circle
                  center={[dealLatitude, dealLongitude]}
                  radius={3218.69} // 2 miles
                  pathOptions={{ color: 'orange', fillColor: 'orange', fillOpacity: 0.05 }}
                />
                <Circle
                  center={[dealLatitude, dealLongitude]}
                  radius={4828.03} // 3 miles
                  pathOptions={{ color: 'yellow', fillColor: 'yellow', fillOpacity: 0.02 }}
                />

                {/* Competitive Projects */}
                {competitiveProjects.map((project) => (
                  <Marker
                    key={project.supplyEventId}
                    position={[dealLatitude + Math.random() * 0.05, dealLongitude + Math.random() * 0.05]} // TODO: Use actual lat/lng
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{project.projectName || 'Unnamed Project'}</strong>
                        <p>Units: {project.units}</p>
                        <p>Distance: {project.distanceMiles.toFixed(2)} mi</p>
                        <p className="font-semibold" style={{ color: getImpactColor(project.competitiveImpact) }}>
                          {project.competitiveImpact.toUpperCase()} Competition
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span>&lt; 1 mile (Direct)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <span>1-2 miles (Moderate)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span>2-3 miles (Weak)</span>
              </div>
            </div>
          </div>
        )}

        {/* Risk Analysis View */}
        {view === 'risk' && supplyRisk && (
          <div className="space-y-6">
            {/* Risk Gauge */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-48 h-48 rounded-full border-8"
                style={{ borderColor: getRiskColor(supplyRisk.riskLevel) }}>
                <div>
                  <div className="text-4xl font-bold" style={{ color: getRiskColor(supplyRisk.riskLevel) }}>
                    {supplyRisk.supplyRiskScore.toFixed(1)}%
                  </div>
                  <div className="text-sm font-semibold uppercase mt-2" style={{ color: getRiskColor(supplyRisk.riskLevel) }}>
                    {supplyRisk.riskLevel} Risk
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Pipeline Units</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {supplyRisk.pipelineUnits.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Weighted: {supplyRisk.weightedPipelineUnits.toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Existing Units</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {supplyRisk.existingUnits.toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Months to Absorb</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {supplyRisk.monthsToAbsorb?.toFixed(1) || 'N/A'}
                </div>
                <div className="text-xs text-gray-500 mt-1 capitalize">
                  {supplyRisk.absorptionRisk} absorption risk
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Demand-Supply Gap</div>
                <div className={`text-2xl font-bold mt-1 ${
                  (supplyRisk.demandSupplyGap || 0) > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {supplyRisk.demandSupplyGap?.toFixed(0) || 'N/A'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(supplyRisk.demandSupplyGap || 0) > 0 ? 'Demand exceeds supply' : 'Oversupply'}
                </div>
              </div>
            </div>

            {/* Risk Interpretation */}
            <div className={`rounded-lg p-4 border-l-4`} style={{ 
              borderColor: getRiskColor(supplyRisk.riskLevel),
              backgroundColor: `${getRiskColor(supplyRisk.riskLevel)}10`
            }}>
              <h3 className="font-semibold text-gray-900 mb-2">Risk Assessment</h3>
              <p className="text-sm text-gray-700">
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalUnits" fill="#3b82f6" name="Total Units" />
                <Bar dataKey="totalWeightedUnits" fill="#10b981" name="Weighted Units" />
              </BarChart>
            </ResponsiveContainer>

            {/* Quarter Details */}
            <div className="space-y-3">
              {deliveryTimeline.map((timeline) => (
                <div key={timeline.quarter} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{timeline.quarter}</h4>
                    <span className="text-sm text-gray-600">
                      {timeline.totalUnits} units ({timeline.totalWeightedUnits.toFixed(0)} weighted)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {timeline.projects.map((project, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{project.projectName || 'Unnamed Project'}</span>
                        <span className="text-gray-600">{project.units} units</span>
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timing</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price Match</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {competitiveProjects.map((project) => (
                  <tr key={project.supplyEventId}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {project.projectName || 'Unnamed Project'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {project.units.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {project.distanceMiles.toFixed(2)} mi
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 text-xs font-semibold rounded-full"
                        style={{
                          backgroundColor: `${getImpactColor(project.competitiveImpact)}20`,
                          color: getImpactColor(project.competitiveImpact)
                        }}
                      >
                        {project.competitiveImpact}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                      {project.deliveryTiming.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      {project.priceTierMatch ? (
                        <span className="text-green-600">✓ Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {competitiveProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500">
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
