import React from 'react';
import { Zap, Droplet, Flame, Wifi, CheckCircle, AlertTriangle, XCircle, DollarSign, Calendar } from 'lucide-react';
import type { UtilityCapacity, UtilityService } from '../../types/development/dueDiligence.types';

interface UtilityCapacityGridProps {
  utilities: UtilityCapacity;
  dealId: string;
  onUpdate: (updated: UtilityCapacity) => void;
}

export const UtilityCapacityGrid: React.FC<UtilityCapacityGridProps> = ({
  utilities,
  dealId,
  onUpdate,
}) => {
  const getCapacityColor = (capacity: string) => {
    switch (capacity) {
      case 'adequate':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'marginal':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'insufficient':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCapacityIcon = (capacity: string) => {
    switch (capacity) {
      case 'adequate':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'marginal':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'insufficient':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-600" />;
    }
  };

  const utilityServices = [
    { key: 'water', label: 'Water', icon: Droplet, data: utilities.water },
    { key: 'sewer', label: 'Sewer', icon: Droplet, data: utilities.sewer },
    { key: 'electric', label: 'Electric', icon: Zap, data: utilities.electric },
    { key: 'gas', label: 'Gas', icon: Flame, data: utilities.gas },
    ...(utilities.telecom ? [{ key: 'telecom', label: 'Telecom', icon: Wifi, data: utilities.telecom }] : []),
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Utility Capacity</h2>
          </div>
          <div className={`px-4 py-2 rounded-lg font-semibold ${
            utilities.overallStatus === 'adequate' ? 'bg-green-100 text-green-800' :
            utilities.overallStatus === 'upgrade_needed' ? 'bg-yellow-100 text-yellow-800' :
            utilities.overallStatus === 'insufficient' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {utilities.overallStatus.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Infrastructure Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {utilityServices.map(({ key, label, icon: Icon, data }) => (
            <UtilityServiceCard
              key={key}
              label={label}
              icon={Icon}
              data={data}
              getCapacityColor={getCapacityColor}
              getCapacityIcon={getCapacityIcon}
            />
          ))}
        </div>

        {/* Upgrade Summary */}
        {utilities.overallStatus === 'upgrade_needed' && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Upgrades Required</h3>
                <div className="space-y-2">
                  {utilityServices
                    .filter(({ data }) => data.upgradeRequired)
                    .map(({ label, data }) => (
                      <div key={label} className="bg-white rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{label}</span>
                          <span className="text-sm text-gray-600">{data.provider}</span>
                        </div>
                        {data.upgradeCost && data.upgradeTimeline && (
                          <div className="flex items-center space-x-4 text-sm text-gray-700">
                            <div className="flex items-center space-x-1">
                              <DollarSign className="w-4 h-4" />
                              <span>${(data.upgradeCost / 1000).toFixed(0)}k</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{data.upgradeTimeline} weeks</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Utility Service Card Component
const UtilityServiceCard: React.FC<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  data: UtilityService;
  getCapacityColor: (capacity: string) => string;
  getCapacityIcon: (capacity: string) => React.ReactNode;
}> = ({ label, icon: Icon, data, getCapacityColor, getCapacityIcon }) => {
  return (
    <div className={`border-2 rounded-lg p-4 ${getCapacityColor(data.capacity)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Icon className="w-5 h-5" />
          <h3 className="font-semibold text-gray-900">{label}</h3>
        </div>
        {getCapacityIcon(data.capacity)}
      </div>

      <div className="space-y-2 bg-white bg-opacity-60 rounded p-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Available:</span>
          <span className="font-medium text-gray-900">{data.available ? 'Yes' : 'No'}</span>
        </div>

        {data.mainSize && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Main Size:</span>
            <span className="font-medium text-gray-900">{data.mainSize}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Capacity:</span>
          <span className="font-medium text-gray-900 capitalize">{data.capacity}</span>
        </div>

        {data.currentUtilization !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Current Use:</span>
            <span className="font-medium text-gray-900">{data.currentUtilization}%</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Upgrade Needed:</span>
          <span className="font-medium text-gray-900">{data.upgradeRequired ? 'Yes' : 'No'}</span>
        </div>

        {data.serviceVoltage && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Service Voltage:</span>
            <span className="font-medium text-gray-900">{data.serviceVoltage}</span>
          </div>
        )}

        {data.substationDistance !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Substation:</span>
            <span className="font-medium text-gray-900">{data.substationDistance} mi</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Provider:</span>
          <span className="font-medium text-gray-900">{data.provider}</span>
        </div>

        {data.notes && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-600">{data.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UtilityCapacityGrid;
