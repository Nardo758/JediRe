import React from 'react';
import { Building, TrendingUp, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import type { AssemblageDueDiligence } from '../../types/development/dueDiligence.types';

interface AssemblageDDProps {
  assemblageDD: AssemblageDueDiligence;
  onUpdate: (updated: AssemblageDueDiligence) => void;
}

export const AssemblageDD: React.FC<AssemblageDDProps> = ({ assemblageDD, onUpdate }) => {
  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'simultaneous':
        return 'bg-green-100 text-green-800';
      case 'sequential':
        return 'bg-blue-100 text-blue-800';
      case 'contingent':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Multi-Parcel Assemblage DD</h2>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Overall Progress</div>
            <div className="text-2xl font-bold text-purple-600">{assemblageDD.overallProgress}%</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Strategy & Cost */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">Closing Strategy</div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getStrategyColor(assemblageDD.closingStrategy)}`}>
              {assemblageDD.closingStrategy.replace('_', ' ').toUpperCase()}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {assemblageDD.closingStrategy === 'simultaneous' && 'All parcels close at once'}
              {assemblageDD.closingStrategy === 'sequential' && 'Parcels close in order'}
              {assemblageDD.closingStrategy === 'contingent' && 'Each closing depends on prior'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">Estimated Total Cost</div>
            <div className="text-2xl font-bold text-gray-900">
              ${(assemblageDD.estimatedTotalCost / 1_000_000).toFixed(2)}M
            </div>
            <p className="text-xs text-gray-600 mt-2">All parcels combined</p>
          </div>
        </div>

        {/* Critical Path Parcel */}
        {assemblageDD.criticalPathParcel && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Critical Path Parcel</h3>
                <p className="text-sm text-gray-700">{assemblageDD.criticalPathParcel}</p>
                <p className="text-xs text-gray-600 mt-1">
                  This parcel is controlling the overall assemblage timeline
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Synchronization Risks */}
        {assemblageDD.synchronizationRisks.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Synchronization Risks</h3>
            <ul className="space-y-2">
              {assemblageDD.synchronizationRisks.map((risk, idx) => (
                <li key={idx} className="flex items-start space-x-2 text-sm text-gray-700">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Parcel Progress Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Parcel DD Progress</h3>
          <div className="space-y-3">
            {assemblageDD.parcels.map((parcel) => (
              <div key={parcel.parcelId} className="flex items-center space-x-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 mb-1">{parcel.address}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${parcel.progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900 w-12 text-right">
                  {parcel.progress}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssemblageDD;
