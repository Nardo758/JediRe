import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Upload,
  DollarSign,
  Calendar,
  Shield,
} from 'lucide-react';
import type { EnvironmentalAssessment } from '../../types/development/dueDiligence.types';

interface EnvironmentalChecklistProps {
  environmental: EnvironmentalAssessment[];
  dealId: string;
  onUpdate: (updated: EnvironmentalAssessment[]) => void;
}

export const EnvironmentalChecklist: React.FC<EnvironmentalChecklistProps> = ({
  environmental,
  dealId,
  onUpdate,
}) => {
  const [selectedParcel, setSelectedParcel] = useState(0);

  const getFindingsColor = (findings: string) => {
    switch (findings) {
      case 'clean':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'rec':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'concern':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getFindingsIcon = (findings: string) => {
    switch (findings) {
      case 'clean':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rec':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'concern':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  if (environmental.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Environmental Assessments</h3>
        <p className="text-gray-600 mb-4">Start by uploading Phase I ESA reports</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Add Assessment
        </button>
      </div>
    );
  }

  const current = environmental[selectedParcel];

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Environmental Tracker</h2>
          </div>
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <span>Upload Report</span>
          </button>
        </div>

        {/* Parcel Tabs (if multiple) */}
        {environmental.length > 1 && (
          <div className="flex space-x-2 mt-4">
            {environmental.map((env, idx) => (
              <button
                key={env.id}
                onClick={() => setSelectedParcel(idx)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedParcel === idx
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Parcel {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Overall Risk Badge */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm text-gray-600 mb-1">Overall Environmental Risk</div>
            <div className="text-xl font-bold text-gray-900 capitalize">{current.overallRisk}</div>
          </div>
          <div className={`px-4 py-2 rounded-lg font-semibold ${
            current.overallRisk === 'low' ? 'bg-green-100 text-green-800' :
            current.overallRisk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            current.overallRisk === 'high' ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            {current.overallRisk.toUpperCase()}
          </div>
        </div>

        {/* Phase I ESA */}
        <div className={`border-2 rounded-lg ${getFindingsColor(current.phaseI.findings)}`}>
          <div className="p-4 bg-white bg-opacity-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {getFindingsIcon(current.phaseI.findings)}
                <h3 className="text-lg font-semibold text-gray-900">Phase I ESA</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  current.phaseI.status === 'complete' ? 'bg-green-100 text-green-800' :
                  current.phaseI.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {current.phaseI.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-1">Findings</div>
                <div className="text-sm font-semibold text-gray-900 uppercase">
                  {current.phaseI.findings}
                </div>
              </div>

              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-1">Cost</div>
                <div className="text-sm font-semibold text-gray-900">
                  ${(current.phaseI.cost / 1000).toFixed(1)}k
                </div>
              </div>

              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-1">Phase II Required</div>
                <div className="text-sm font-semibold text-gray-900">
                  {current.phaseI.phaseIIRequired ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {/* RECs */}
            {current.phaseI.recognizedEnvironmentalConditions.length > 0 && (
              <div className="mt-4 bg-white rounded-lg p-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Recognized Environmental Conditions (RECs)
                </h4>
                <ul className="space-y-1">
                  {current.phaseI.recognizedEnvironmentalConditions.map((rec, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-sm text-gray-700">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {current.phaseI.reportDocId && (
              <div className="mt-4">
                <button className="text-sm text-blue-600 hover:underline flex items-center space-x-1">
                  <FileText className="w-4 h-4" />
                  <span>View Phase I Report</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Phase II ESA (if required) */}
        {current.phaseII && (
          <div className="border-2 border-orange-200 rounded-lg">
            <div className="p-4 bg-orange-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Phase II ESA</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  current.phaseII.status === 'complete' ? 'bg-green-100 text-green-800' :
                  current.phaseII.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {current.phaseII.status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-1">Estimated Cost</div>
                  <div className="text-sm font-semibold text-gray-900">
                    ${(current.phaseII.estimatedCost / 1000).toFixed(0)}k
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-1">Timeline</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {current.phaseII.timeline} weeks
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-1">Remediation Needed</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {current.phaseII.remediationRequired ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>

              {current.phaseII.contaminantsFound.length > 0 && (
                <div className="mt-4 bg-white rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Contaminants Found</h4>
                  <div className="flex flex-wrap gap-2">
                    {current.phaseII.contaminantsFound.map((contaminant, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium"
                      >
                        {contaminant}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remediation Plan (if required) */}
        {current.remediation && (
          <div className="border-2 border-red-200 rounded-lg">
            <div className="p-4 bg-red-50">
              <div className="flex items-center space-x-3 mb-4">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Remediation Plan</h3>
              </div>

              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700 mb-4">{current.remediation.description}</p>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <div>
                      <div className="text-xs text-gray-600">Estimated Cost</div>
                      <div className="text-sm font-semibold text-gray-900">
                        ${(current.remediation.estimatedCost / 1000).toFixed(0)}k
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <div>
                      <div className="text-xs text-gray-600">Timeline</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {current.remediation.timeline} weeks
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-gray-600" />
                    <div>
                      <div className="text-xs text-gray-600">Impact</div>
                      <div className="text-sm font-semibold text-gray-900 capitalize">
                        {current.remediation.impact}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {current.remediation.contractor && (
                <div className="bg-white rounded-lg p-3">
                  <div className="text-xs text-gray-600 mb-1">Contractor</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {current.remediation.contractor}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnvironmentalChecklist;
