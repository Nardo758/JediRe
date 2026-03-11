import React from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Building,
  FileText,
} from 'lucide-react';
import type { DueDiligenceState, ParcelDueDiligence, DDStatus } from '../../types/development/dueDiligence.types';

interface MultiParcelDashboardProps {
  dueDiligence: DueDiligenceState;
  onUpdate: (updated: DueDiligenceState) => void;
}

export const MultiParcelDashboard: React.FC<MultiParcelDashboardProps> = ({
  dueDiligence,
  onUpdate,
}) => {
  const getStatusIcon = (status: DDStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'issue':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'blocked':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadgeColor = (status: DDStatus) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'issue':
        return 'bg-orange-100 text-orange-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getParcelTypeLabel = (type: string) => {
    switch (type) {
      case 'main':
        return 'Main Site';
      case 'adjacent':
        return 'Adjacent';
      case 'assemblage':
        return 'Assemblage';
      default:
        return type;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Multi-Parcel DD Dashboard</h2>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Overall Progress</div>
            <div className="text-2xl font-bold text-blue-600">{dueDiligence.overallProgress}%</div>
          </div>
        </div>

        {/* Overall Assemblage Risk */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">Overall Assemblage Risk</div>
              <div className="text-lg font-semibold text-gray-900 capitalize mt-1">
                {dueDiligence.overallRisk}
              </div>
            </div>
            {dueDiligence.criticalPathItem && (
              <div className="text-right">
                <div className="text-sm text-gray-600">Critical Path Item</div>
                <div className="text-sm font-medium text-orange-600 mt-1">
                  {dueDiligence.criticalPathItem}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Parcel Cards Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dueDiligence.parcels.map((parcel) => (
            <ParcelCard key={parcel.parcelId} parcel={parcel} getStatusIcon={getStatusIcon} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Parcel Card Component
const ParcelCard: React.FC<{
  parcel: ParcelDueDiligence;
  getStatusIcon: (status: DDStatus) => React.ReactNode;
}> = ({ parcel, getStatusIcon }) => {
  const getParcelTypeBadge = (type: string) => {
    const colors = {
      main: 'bg-blue-100 text-blue-800',
      adjacent: 'bg-purple-100 text-purple-800',
      assemblage: 'bg-green-100 text-green-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm mb-1">{parcel.address}</h3>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getParcelTypeBadge(parcel.parcelType)}`}>
            {parcel.parcelType === 'main' ? 'Main Site' : parcel.parcelType === 'adjacent' ? 'Adjacent' : 'Assemblage'}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Progress</span>
          <span className="text-xs font-semibold text-gray-900">{parcel.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${parcel.progress}%` }}
          />
        </div>
      </div>

      {/* DD Items Checklist */}
      <div className="space-y-2">
        {[
          { key: 'title', label: 'Title' },
          { key: 'survey', label: 'Survey' },
          { key: 'environmental', label: 'Environmental' },
          { key: 'geotechnical', label: 'Geotech' },
          { key: 'zoning', label: 'Zoning' },
          { key: 'utilities', label: 'Utilities' },
        ].map(({ key, label }) => {
          const item = parcel[key as keyof ParcelDueDiligence] as any;
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{label}</span>
              <div className="flex items-center space-x-1">
                {getStatusIcon(item.status)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultiParcelDashboard;
