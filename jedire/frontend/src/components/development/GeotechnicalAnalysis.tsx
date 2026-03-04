import React from 'react';
import { MapPin, TrendingDown, DollarSign, FileText, AlertTriangle, Droplet, Shield } from 'lucide-react';
import type { GeotechnicalReport } from '../../types/development/dueDiligence.types';

interface GeotechnicalAnalysisProps {
  geotechnical: GeotechnicalReport[];
  dealId: string;
  onUpdate: (updated: GeotechnicalReport[]) => void;
}

export const GeotechnicalAnalysis: React.FC<GeotechnicalAnalysisProps> = ({
  geotechnical,
  dealId,
  onUpdate,
}) => {
  if (geotechnical.length === 0) {
    return null;
  }

  const report = geotechnical[0]; // Display first report for now

  const getFoundationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      spread_footing: 'Spread Footing',
      mat: 'Mat Foundation',
      auger_cast_piles: 'Auger Cast Piles',
      driven_piles: 'Driven Piles',
      other: 'Other',
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MapPin className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-semibold text-gray-900">Geotechnical Analysis</h2>
          </div>
          {report.reportDocId && (
            <button className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>View Full Report</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Soil Conditions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Soil Conditions</h3>
          <div className="space-y-2">
            {report.soilConditions.map((layer, idx) => (
              <div key={idx} className="flex items-start space-x-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
                <div className="flex-shrink-0 w-24">
                  <div className="text-xs text-gray-600">Depth</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {layer.depthStart}-{layer.depthEnd} ft
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{layer.description}</div>
                  {layer.bearingCapacity && (
                    <div className="text-xs text-gray-600 mt-1">
                      Bearing Capacity: {layer.bearingCapacity} psf
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Water Table */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center space-x-3">
            <Droplet className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-sm text-gray-600">Water Table Depth</div>
              <div className="text-lg font-semibold text-gray-900">{report.waterTableDepth} ft</div>
            </div>
          </div>
        </div>

        {/* Foundation Recommendation */}
        <div className="border-2 border-orange-200 rounded-lg p-6 bg-orange-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Foundation Recommendation</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Recommended Type</div>
              <div className="text-lg font-semibold text-gray-900">
                {getFoundationTypeLabel(report.foundationRecommendation.type)}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Required Depth</div>
              <div className="text-lg font-semibold text-gray-900">
                {report.foundationRecommendation.depth} ft
              </div>
            </div>
          </div>

          {/* Cost Impact */}
          {report.foundationRecommendation.costImpact > 0 && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-5 h-5 text-orange-600" />
                <h4 className="font-semibold text-gray-900">Cost Impact</h4>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                +${(report.foundationRecommendation.costImpact / 1000).toFixed(0)}k
              </div>
              <p className="text-sm text-gray-600 mt-1">Above standard foundation costs</p>
            </div>
          )}

          {/* Special Requirements */}
          {report.foundationRecommendation.specialRequirements.length > 0 && (
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Special Requirements</h4>
              <ul className="space-y-2">
                {report.foundationRecommendation.specialRequirements.map((req, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm text-gray-700">
                    <Shield className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Flags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {report.foundationRecommendation.dewateringRequired && (
              <span className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                <Droplet className="w-4 h-4" />
                <span>Dewatering Required</span>
              </span>
            )}
            {report.foundationRecommendation.shoringRequired && (
              <span className="inline-flex items-center space-x-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                <Shield className="w-4 h-4" />
                <span>Shoring Required</span>
              </span>
            )}
          </div>
        </div>

        {/* Special Considerations */}
        {report.specialConsiderations.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Special Considerations</h4>
                <ul className="space-y-1">
                  {report.specialConsiderations.map((consideration, idx) => (
                    <li key={idx} className="text-sm text-gray-700">• {consideration}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Integration with 3D Design */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
          <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2">
            <MapPin className="w-5 h-5" />
            <span>Update 3D Foundation Design</span>
          </button>
          <p className="text-xs text-gray-600 text-center mt-2">
            Integrate geotechnical findings into 3D building model
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeotechnicalAnalysis;
