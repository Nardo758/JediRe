import { X, Pin, MapPin, Share2, Calendar, Download } from 'lucide-react';
import { useAppStore } from '@/store';
import { formatNumber, getScoreColor } from '@/utils';
import ZoningPanel from './ZoningPanel';
import SupplyPanel from './SupplyPanel';
import CashFlowPanel from './CashFlowPanel';
import AnnotationSection from './AnnotationSection';
import StrategyCard from './StrategyCard';
import AgentInsights from './AgentInsights';

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
        {/* Property Overview */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Property Overview</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-medium text-gray-800">{selectedProperty.currentUse || 'Single Family'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Size</span>
              <span className="font-medium text-gray-800">{formatNumber(selectedProperty.lotSizeSqft || 0)} sqft</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Year Built</span>
              <span className="font-medium text-gray-800">1985</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Lot</span>
              <span className="font-medium text-gray-800">{((selectedProperty.lotSizeSqft || 0) / 43560).toFixed(2)} acres</span>
            </div>
          </div>
        </div>

        {/* Strategy Arbitrage Comparison */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Strategy Comparison</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              18% Arbitrage
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <StrategyCard
              name="BUILD-TO-SELL"
              annualROI={22}
              investment={380000}
              timeline="18 months"
              profit="$42K"
              profitLabel="Net Profit"
              riskLevel="Medium"
            />
            <StrategyCard
              name="FLIP"
              annualROI={24}
              investment={330000}
              timeline="6 months"
              profit="$39K"
              profitLabel="Net Profit"
              riskLevel="Medium"
            />
            <StrategyCard
              name="RENTAL"
              annualROI={42}
              investment={300000}
              timeline="Ongoing"
              profit="$1,050/mo"
              profitLabel="Monthly NOI"
              riskLevel="Low"
              isOptimal={true}
            />
            <StrategyCard
              name="AIRBNB"
              annualROI={31}
              investment={315000}
              timeline="Ongoing"
              profit="$785/mo"
              profitLabel="Monthly NOI"
              riskLevel="Medium"
            />
          </div>

          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <p className="text-sm text-blue-700">
                <strong>Arbitrage Opportunity:</strong> Converting to rental generates $850/month more NOI than typical investor would expect from Airbnb strategy
              </p>
            </div>
          </div>
        </div>

        {/* Agent Insights */}
        <AgentInsights />

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

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Download className="w-4 h-4" />
            Save
          </button>
          <button className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            <Calendar className="w-4 h-4" />
            Tour
          </button>
        </div>

        {/* Annotations */}
        <AnnotationSection
          propertyId={selectedProperty.id}
          annotations={selectedProperty.annotations || []}
        />
      </div>
    </div>
  );
}
