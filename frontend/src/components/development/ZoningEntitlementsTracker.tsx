import React, { useState } from 'react';
import {
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  FileText,
  Plus,
  Edit,
  ArrowRight,
} from 'lucide-react';
import type { ZoningAnalysis } from '../../types/development/dueDiligence.types';

interface ZoningEntitlementsTrackerProps {
  zoningAnalysis: ZoningAnalysis;
  dealId: string;
  onUpdate: (updated: ZoningAnalysis) => void;
}

export const ZoningEntitlementsTracker: React.FC<ZoningEntitlementsTrackerProps> = ({
  zoningAnalysis,
  dealId,
  onUpdate,
}) => {
  const [showUpzoningDetails, setShowUpzoningDetails] = useState(false);

  const getSupportColor = (support: string) => {
    switch (support) {
      case 'supportive':
        return 'text-green-600 bg-green-50';
      case 'neutral':
        return 'text-gray-600 bg-gray-50';
      case 'opposed':
        return 'text-red-600 bg-red-50';
      case 'mixed':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Entitlement Feasibility</h2>
          </div>
          <button className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center space-x-2">
            <Edit className="w-4 h-4" />
            <span>Edit Analysis</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Current Zoning - By-Right */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Current Zoning (By-Right)</h3>
            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
              {zoningAnalysis.currentZoning}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Max Units</div>
              <div className="text-2xl font-bold text-gray-900">{zoningAnalysis.byRightUnits}</div>
              <div className="text-xs text-gray-500 mt-1">By-right allowance</div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Max Height</div>
              <div className="text-2xl font-bold text-gray-900">{zoningAnalysis.byRightHeight} ft</div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.floor(zoningAnalysis.byRightHeight / 10)} stories approx
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Max FAR</div>
              <div className="text-2xl font-bold text-gray-900">{zoningAnalysis.byRightFAR}</div>
              <div className="text-xs text-gray-500 mt-1">Floor Area Ratio</div>
            </div>
          </div>
        </div>

        {/* Upzoning Potential */}
        {zoningAnalysis.upzoningPotential && (
          <div className="border-2 border-purple-200 rounded-lg">
            <div
              className="p-6 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors"
              onClick={() => setShowUpzoningDetails(!showUpzoningDetails)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Upzoning Potential</h3>
                    <p className="text-sm text-gray-600">
                      {zoningAnalysis.upzoningPotential.proposedZoning} • +
                      {zoningAnalysis.upzoningPotential.proposedUnits - zoningAnalysis.byRightUnits} units
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className={`w-5 h-5 text-purple-600 transition-transform ${
                    showUpzoningDetails ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </div>

            {showUpzoningDetails && (
              <div className="p-6 border-t border-purple-200 space-y-4">
                {/* Upzoning Stats Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-purple-100">
                    <div className="text-xs text-gray-600 mb-1">Proposed Units</div>
                    <div className="text-xl font-bold text-purple-600">
                      {zoningAnalysis.upzoningPotential.proposedUnits}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      +{zoningAnalysis.upzoningPotential.proposedUnits - zoningAnalysis.byRightUnits} units
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-purple-100">
                    <div className="text-xs text-gray-600 mb-1">Proposed Height</div>
                    <div className="text-xl font-bold text-purple-600">
                      {zoningAnalysis.upzoningPotential.proposedHeight} ft
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      +{zoningAnalysis.upzoningPotential.proposedHeight - zoningAnalysis.byRightHeight} ft
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-purple-100">
                    <div className="text-xs text-gray-600 mb-1">Process Timeline</div>
                    <div className="text-xl font-bold text-purple-600">
                      {zoningAnalysis.upzoningPotential.processTimeline} mo
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Estimated duration</div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-purple-100">
                    <div className="text-xs text-gray-600 mb-1">Success Likelihood</div>
                    <div className="text-xl font-bold text-purple-600">
                      {zoningAnalysis.upzoningPotential.successLikelihood}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Probability</div>
                  </div>
                </div>

                {/* Cost & Requirements */}
                <div className="bg-white rounded-lg p-4 border border-purple-100">
                  <div className="flex items-center space-x-2 mb-3">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-gray-900">Estimated Cost</h4>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${(zoningAnalysis.upzoningPotential.estimatedCost / 1000).toFixed(0)}k
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Legal, consulting, and application fees</p>
                </div>

                {/* Key Requirements */}
                {zoningAnalysis.upzoningPotential.keyRequirements.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-purple-100">
                    <h4 className="font-semibold text-gray-900 mb-3">Key Requirements</h4>
                    <ul className="space-y-2">
                      {zoningAnalysis.upzoningPotential.keyRequirements.map((req, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Impact Modeling Button */}
                <button className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Model Upzoning Impact on Returns</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Community & Political Support */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-lg p-4 ${getSupportColor(zoningAnalysis.communitySupport)}`}>
            <div className="flex items-center space-x-2 mb-2">
              <Users className="w-5 h-5" />
              <h4 className="font-semibold">Community Support</h4>
            </div>
            <div className="text-2xl font-bold capitalize">{zoningAnalysis.communitySupport}</div>
            <p className="text-sm mt-1 opacity-75">Based on local sentiment analysis</p>
          </div>

          {zoningAnalysis.councilMemberPosition && (
            <div className={`rounded-lg p-4 ${getSupportColor(zoningAnalysis.councilMemberPosition)}`}>
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-5 h-5" />
                <h4 className="font-semibold">Council Member</h4>
              </div>
              <div className="text-2xl font-bold capitalize">{zoningAnalysis.councilMemberPosition}</div>
              <p className="text-sm mt-1 opacity-75">District representative stance</p>
            </div>
          )}
        </div>

        {/* Entitlement Checklist Preview */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Entitlement Checklist</h4>
            <button className="text-sm text-blue-600 hover:underline">View Full Checklist →</button>
          </div>
          <div className="space-y-2">
            {[
              { name: 'Site Plan Approval', status: 'complete' },
              { name: 'Conditional Use Permit', status: 'in_progress' },
              { name: 'Building Permit', status: 'not_started' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white rounded p-3">
                <span className="text-sm text-gray-700">{item.name}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  item.status === 'complete' ? 'bg-green-100 text-green-800' :
                  item.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {item.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoningEntitlementsTracker;
