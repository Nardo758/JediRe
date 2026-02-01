import { X, Pin, MapPin, Building2, DollarSign, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store';
import { formatCurrency, formatNumber, formatPercent, getScoreColor } from '@/utils';
import ZoningPanel from './ZoningPanel';
import SupplyPanel from './SupplyPanel';
import CashFlowPanel from './CashFlowPanel';
import AnnotationSection from './AnnotationSection';

export default function PropertyDetail() {
  const { selectedProperty, setSelectedProperty, updateProperty, activeModules } = useAppStore();

  if (!selectedProperty) return null;

  const handleClose = () => {
    setSelectedProperty(null);
  };

  const handleTogglePin = async () => {
    // API call would go here
    updateProperty(selectedProperty.id, {
      isPinned: !selectedProperty.isPinned,
    });
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-40 overflow-y-auto animate-slide-in">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900">
                {selectedProperty.address}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedProperty.municipality}
              </span>
              {selectedProperty.districtCode && (
                <span className="badge badge-info">
                  {selectedProperty.districtCode}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePin}
              className={`p-2 rounded-lg transition-colors ${
                selectedProperty.isPinned
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={selectedProperty.isPinned ? 'Unpin' : 'Pin property'}
            >
              <Pin className={`w-5 h-5 ${selectedProperty.isPinned ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Opportunity Score */}
        <div className="mt-4 p-4 bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">
                Opportunity Score
              </div>
              <div className={`text-4xl font-bold ${getScoreColor(selectedProperty.opportunityScore)}`}>
                {selectedProperty.opportunityScore}
                <span className="text-xl text-gray-400">/100</span>
              </div>
            </div>
            <div className="flex-1 ml-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    selectedProperty.opportunityScore >= 80
                      ? 'bg-green-500'
                      : selectedProperty.opportunityScore >= 60
                      ? 'bg-blue-500'
                      : selectedProperty.opportunityScore >= 40
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${selectedProperty.opportunityScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Property Summary */}
        <div className="grid grid-cols-2 gap-4">
          {selectedProperty.lotSizeSqft && (
            <div className="card">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <Building2 className="w-4 h-4" />
                <span>Lot Size</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(selectedProperty.lotSizeSqft)}
                <span className="text-sm text-gray-500 ml-1">sq ft</span>
              </div>
            </div>
          )}

          {selectedProperty.currentUse && (
            <div className="card">
              <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                <span>Current Use</span>
              </div>
              <div className="text-lg font-bold text-gray-900">
                {selectedProperty.currentUse}
              </div>
            </div>
          )}
        </div>

        {/* Module Insights */}
        {activeModules.includes('zoning') && selectedProperty.zoning && (
          <ZoningPanel zoning={selectedProperty.zoning} />
        )}

        {activeModules.includes('supply') && selectedProperty.supply && (
          <SupplyPanel supply={selectedProperty.supply} />
        )}

        {activeModules.includes('cashflow') && selectedProperty.cashFlow && (
          <CashFlowPanel cashFlow={selectedProperty.cashFlow} />
        )}

        {/* Annotations */}
        <AnnotationSection
          propertyId={selectedProperty.id}
          annotations={selectedProperty.annotations || []}
        />
      </div>
    </div>
  );
}
