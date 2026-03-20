import { Building2, Home, Ruler, ParkingCircle } from 'lucide-react';
import { ZoningInsight } from '@/types';
import { formatNumber } from '@/utils';

interface ZoningPanelProps {
  zoning: ZoningInsight;
}

export default function ZoningPanel({ zoning }: ZoningPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold text-gray-900">Zoning Analysis</h3>
        <span className={`badge ${
          zoning.confidence === 'high' ? 'badge-success' :
          zoning.confidence === 'medium' ? 'badge-warning' : 'badge-danger'
        }`}>
          {zoning.confidence} confidence
        </span>
      </div>

      {/* District Info */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="text-sm text-gray-600 mb-1">Zoning District</div>
        <div className="text-xl font-bold text-blue-600">
          {zoning.districtCode}
        </div>
        <div className="text-sm text-gray-700 mt-1">
          {zoning.districtName}
        </div>
      </div>

      {/* Development Potential */}
      <div className="card bg-green-50 border-green-200">
        <h4 className="font-semibold text-green-900 mb-3">Development Potential</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">Max Units</div>
            <div className="text-2xl font-bold text-green-600">
              {zoning.maxUnits}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Max GFA</div>
            <div className="text-lg font-bold text-green-600">
              {formatNumber(zoning.maxGfaSqft)}
              <span className="text-xs text-gray-600 ml-1">sq ft</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Max Height</div>
            <div className="text-lg font-bold text-green-600">
              {zoning.maxHeightFt}
              <span className="text-xs text-gray-600 ml-1">ft</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Max Stories</div>
            <div className="text-lg font-bold text-green-600">
              {zoning.maxStories}
            </div>
          </div>
        </div>
      </div>

      {/* Setbacks */}
      <div className="card bg-yellow-50 border-yellow-200">
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="w-4 h-4 text-yellow-600" />
          <h4 className="font-semibold text-yellow-900">Setbacks</h4>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-600 mb-1">Front</div>
            <div className="text-lg font-bold text-yellow-600">
              {zoning.setbacks.frontFt}'
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Side</div>
            <div className="text-lg font-bold text-yellow-600">
              {zoning.setbacks.sideFt}'
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Rear</div>
            <div className="text-lg font-bold text-yellow-600">
              {zoning.setbacks.rearFt}'
            </div>
          </div>
        </div>
      </div>

      {/* Parking */}
      <div className="card bg-purple-50 border-purple-200">
        <div className="flex items-center gap-2 mb-2">
          <ParkingCircle className="w-4 h-4 text-purple-600" />
          <h4 className="font-semibold text-purple-900">Parking Required</h4>
        </div>
        <div className="text-3xl font-bold text-purple-600">
          {zoning.parkingRequired}
          <span className="text-sm text-gray-600 ml-2">spaces</span>
        </div>
      </div>

      {/* AI Reasoning */}
      {zoning.reasoning && (
        <div className="card bg-gray-50">
          <h4 className="font-semibold text-gray-900 mb-2 text-sm">AI Analysis</h4>
          <p className="text-sm text-gray-700 leading-relaxed">
            {zoning.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
