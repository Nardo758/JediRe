import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, FileText, Download, Calendar, Building2, Ruler, Car, Home } from 'lucide-react';
import { Deal } from '../../../types';
import ModuleUpsellBanner from './ModuleUpsellBanner';
import api from '../../../services/api';

export interface DevelopmentSectionProps {
  deal: Deal;
  enhanced: boolean;
  onToggleModule?: () => void;
}

// Type definitions for capacity analysis API response
interface SetbackRequirements {
  front?: number;
  side?: number;
  rear?: number;
  frontFt?: number;
  sideFt?: number;
  rearFt?: number;
}

interface ComplianceCheck {
  item: string;
  status: 'compliant' | 'warning' | 'violation';
  message: string;
  details?: string;
}

interface ZoningCodeReference {
  section: string;
  title: string;
  url?: string;
}

interface CapacityAnalysis {
  parcelId: string;
  districtCode: string;
  districtName: string;
  
  // Capacity metrics
  maxUnits: number;
  maxUnitsByRight: boolean;
  
  // Physical constraints
  maxHeightFt: number;
  maxStories: number;
  lotCoveragePercent: number;
  lotCoverageSqft: number;
  availableCoverageSqft: number;
  
  // Parking
  parkingRequired: number;
  parkingRatio: number;
  
  // Setbacks
  setbacks: SetbackRequirements;
  
  // Compliance
  complianceChecks: ComplianceCheck[];
  overallCompliance: 'compliant' | 'warning' | 'violation';
  
  // Recommendations
  recommendations: string[];
  
  // References
  zoningReferences: ZoningCodeReference[];
  
  // Additional data
  lotSizeSqft?: number;
  analysisDate?: string;
}

const ComplianceIcon: React.FC<{ status: 'compliant' | 'warning' | 'violation' }> = ({ status }) => {
  switch (status) {
    case 'compliant':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    case 'violation':
      return <XCircle className="w-5 h-5 text-red-600" />;
  }
};

const ComplianceStatusBadge: React.FC<{ status: 'compliant' | 'warning' | 'violation' }> = ({ status }) => {
  const styles = {
    compliant: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    violation: 'bg-red-100 text-red-800 border-red-200',
  };
  
  const labels = {
    compliant: 'Compliant',
    warning: 'Warning',
    violation: 'Violation',
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${styles[status]}`}>
      <ComplianceIcon status={status} />
      {labels[status]}
    </span>
  );
};

export const DevelopmentSection: React.FC<DevelopmentSectionProps> = ({
  deal,
  enhanced,
  onToggleModule
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityData, setCapacityData] = useState<CapacityAnalysis | null>(null);

  // Load capacity analysis data when enhanced mode is active
  useEffect(() => {
    if (enhanced && deal.id) {
      loadCapacityAnalysis();
    }
  }, [enhanced, deal.id]);

  const loadCapacityAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await api.get('/pipeline/capacity-analysis', {
        params: { parcelId: deal.id }
      });
      
      setCapacityData(data);
    } catch (err: any) {
      console.error('Failed to load capacity analysis:', err);
      setError(err.response?.data?.message || 'Failed to load capacity analysis');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleViewFullReport = () => {
    console.log('View full report clicked');
    // TODO: Navigate to full report page or open modal
  };

  const handleExportPDF = () => {
    console.log('Export PDF clicked');
    // TODO: Generate and download PDF report
  };

  const handleSchedulePreApp = () => {
    console.log('Schedule pre-app clicked');
    // TODO: Open scheduling interface
  };

  // Enhanced version with Zoning Interpreter module
  if (enhanced) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Development Analysis</h2>
            <p className="text-sm text-gray-600 mt-1">
              Zoning capacity and compliance analysis for {deal.name}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="bg-white rounded-lg shadow p-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Analyzing zoning capacity...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-6">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Failed to Load Analysis</h3>
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={loadCapacityAnalysis}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State - No Parcel Data */}
          {!loading && !error && !capacityData && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-12">
              <div className="text-center">
                <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Parcel Data Available</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add property address and parcel information to generate capacity analysis
                </p>
                <button
                  onClick={() => console.log('Add parcel data')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Add Property Details
                </button>
              </div>
            </div>
          )}

          {/* Capacity Analysis Results */}
          {!loading && !error && capacityData && (
            <>
              {/* Zoning District Header */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {capacityData.districtCode} - {capacityData.districtName}
                        </h3>
                        <p className="text-sm text-gray-600">Zoning District</p>
                      </div>
                    </div>
                  </div>
                  <ComplianceStatusBadge status={capacityData.overallCompliance} />
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Maximum Units */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Home className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">Maximum Units</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {formatNumber(capacityData.maxUnits)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {capacityData.maxUnitsByRight ? 'By-right' : 'With approval'}
                  </div>
                </div>

                {/* Height Limit */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Ruler className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-gray-600">Height Limit</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {capacityData.maxHeightFt}'
                  </div>
                  <div className="text-xs text-gray-500">
                    {capacityData.maxStories} {capacityData.maxStories === 1 ? 'story' : 'stories'}
                  </div>
                </div>

                {/* Lot Coverage */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-600">Lot Coverage</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {capacityData.lotCoveragePercent}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatNumber(capacityData.availableCoverageSqft)} sqft available
                  </div>
                </div>

                {/* Parking Required */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-gray-600">Parking Required</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {formatNumber(capacityData.parkingRequired)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {capacityData.parkingRatio} per unit
                  </div>
                </div>
              </div>

              {/* Setback Requirements */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-gray-700" />
                  Setback Requirements
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Front Setback</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {capacityData.setbacks.frontFt || capacityData.setbacks.front || 0}'
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Side Setback</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {capacityData.setbacks.sideFt || capacityData.setbacks.side || 0}'
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Rear Setback</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {capacityData.setbacks.rearFt || capacityData.setbacks.rear || 0}'
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance Checks */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Compliance Checks</h3>
                <div className="space-y-3">
                  {capacityData.complianceChecks.map((check, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 ${
                        check.status === 'compliant'
                          ? 'bg-green-50 border-green-200'
                          : check.status === 'warning'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <ComplianceIcon status={check.status} />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1">{check.item}</div>
                          <p className="text-sm text-gray-700">{check.message}</p>
                          {check.details && (
                            <p className="text-xs text-gray-600 mt-2">{check.details}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {capacityData.recommendations.length > 0 && (
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">Recommendations</h3>
                  <ul className="space-y-2">
                    {capacityData.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-blue-900">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Zoning Code References */}
              {capacityData.zoningReferences.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-700" />
                    Zoning Code References
                  </h3>
                  <div className="space-y-2">
                    {capacityData.zoningReferences.map((ref, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        {ref.url ? (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between text-sm"
                          >
                            <div>
                              <span className="font-semibold text-blue-600">{ref.section}</span>
                              <span className="text-gray-600 ml-2">— {ref.title}</span>
                            </div>
                            <span className="text-blue-600">→</span>
                          </a>
                        ) : (
                          <div className="text-sm">
                            <span className="font-semibold text-gray-900">{ref.section}</span>
                            <span className="text-gray-600 ml-2">— {ref.title}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Next Steps</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={handleViewFullReport}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    View Full Report
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Export PDF
                  </button>
                  <button
                    onClick={handleSchedulePreApp}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Pre-App
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Basic version (no module)
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Development Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">
            Basic zoning information for {deal.name}
          </p>
        </div>

        {/* Module Upsell Banner */}
        <ModuleUpsellBanner
          moduleName="Zoning Interpreter"
          price="$54"
          benefits={[
            'Automated capacity analysis with maximum units by-right',
            'Height limits, lot coverage, and parking calculations',
            'Real-time compliance checks with status indicators',
            'Setback requirements and buildable envelope analysis',
            'Zoning code references with clickable sections',
            'Professional PDF reports for presentations',
            'Pre-application meeting scheduling integration'
          ]}
          bundleInfo={{
            name: 'Developer Bundle',
            price: '$149',
            savings: '25%'
          }}
          onAddModule={onToggleModule}
          onUpgradeBundle={() => console.log('Upgrade to bundle clicked')}
          onLearnMore={() => console.log('Learn more clicked')}
        />

        {/* Basic Zoning Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Zoning District
          </h3>
          
          <div className="space-y-4">
            {/* District Name */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-600 mb-1">Current Zoning</div>
              <div className="text-xl font-bold text-blue-900">
                R-4 - Residential Medium Density
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Example zoning district. Add property address to get actual zoning data.
              </p>
            </div>

            {/* Basic Metrics (Manual) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Maximum Units</div>
                <div className="text-lg font-semibold text-gray-900">
                  Check local codes manually
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Height Limit</div>
                <div className="text-lg font-semibold text-gray-900">
                  Check local codes manually
                </div>
              </div>
            </div>

            {/* Manual Lookup Message */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-yellow-900 mb-1">
                    Manual Zoning Lookup Required
                  </div>
                  <p className="text-sm text-yellow-800">
                    Contact your local planning department or zoning office to obtain:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-800">
                    <li>• Maximum allowed units and density</li>
                    <li>• Height and story limitations</li>
                    <li>• Setback requirements (front, side, rear)</li>
                    <li>• Parking requirements per unit</li>
                    <li>• Lot coverage maximums</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">
            📚 Understanding Development Constraints
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li><strong>Zoning District:</strong> Determines the allowed land uses and development standards</li>
            <li><strong>Density:</strong> Maximum number of dwelling units allowed per acre or lot</li>
            <li><strong>Height Limit:</strong> Maximum building height in feet or number of stories</li>
            <li><strong>Setbacks:</strong> Minimum required distances from property lines</li>
            <li><strong>Lot Coverage:</strong> Percentage of lot that can be covered by buildings</li>
            <li><strong>Parking:</strong> Required number of parking spaces per dwelling unit</li>
          </ul>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-900">
              💡 <span className="font-semibold">Tip:</span> Upgrade to Zoning Interpreter to automatically analyze capacity and generate compliance reports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevelopmentSection;
