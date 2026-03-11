/**
 * Property Intelligence Modal - Complete Property Flyout
 * Enhanced with Traffic, Trade Area, and Dev Capacity signals
 * 
 * Shows all relevant outputs for a single property:
 * - Municipal Record (P-01)
 * - Traffic Intelligence (T-01 through T-10)
 * - Trade Area Analysis (TA-01 through TA-04)
 * - Position & Ownership (P-02 through P-12)
 * - Market Position (M-01, M-03, M-06)
 * - Seller Motivation (P-05, R-09)
 * - Dev Capacity (DC-07 when relevant)
 */

import React, { useState } from 'react';
import { PropertyIntelligence, SIGNAL_GROUPS } from '../../types/marketIntelligence.types';
import DataSourceIndicator from './DataSourceIndicator';

interface PropertyIntelligenceModalProps {
  property: PropertyIntelligence;
  isOpen: boolean;
  onClose: () => void;
}

const PropertyIntelligenceModal: React.FC<PropertyIntelligenceModalProps> = ({
  property,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'traffic' | 'tradeArea' | 'financial' | 'ownership'>('overview');

  if (!isOpen) return null;

  const { position, traffic, tradeArea, composite, momentum, risk } = property;

  // Helper to format currency
  const formatCurrency = (value: number, decimals = 0) => 
    `$${value.toLocaleString('en-US', { maximumFractionDigits: decimals })}`;

  // Helper to format percentage
  const formatPercent = (value: number, decimals = 1) => 
    `${value.toFixed(decimals)}%`;

  // Helper to get signal group color
  const getSignalColor = (groupId: string) => 
    SIGNAL_GROUPS.find(g => g.id === groupId)?.color || '#6b7280';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

      {/* Modal */}
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{position.propertyCard.address}</h2>
              <p className="text-blue-100 mt-1">
                {position.propertyCard.city}, {position.propertyCard.state} {position.propertyCard.zip}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-xs text-blue-100">JEDI Score</div>
              <div className="text-2xl font-bold">{composite.jediScore.overallScore}</div>
              <div className="text-xs text-blue-100 mt-1">{composite.jediScore.tier}</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-xs text-blue-100">Units</div>
              <div className="text-2xl font-bold">{position.propertyCard.units.toLocaleString()}</div>
              <div className="text-xs text-blue-100 mt-1">{position.vintageClass.class} Class</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-xs text-blue-100">Year Built</div>
              <div className="text-2xl font-bold">{position.propertyCard.yearBuilt}</div>
              <div className="text-xs text-blue-100 mt-1">{position.vintageClass.ageYears} years old</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-xs text-blue-100">Walk-Ins/Week</div>
              <div className="text-2xl font-bold">{traffic.walkInPrediction.weeklyWalkIns.toLocaleString()}</div>
              <DataSourceIndicator metadata={traffic.walkInPrediction.metadata} light />
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-xs text-blue-100">Traffic Signal</div>
              <div className="text-xl font-bold">{traffic.trafficCorrelation.classification.replace('_', ' ')}</div>
              <div className="text-xs text-blue-100 mt-1">
                🚶 {traffic.physicalTrafficScore.score} | 💻 {traffic.digitalTrafficScore.score}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-gray-50 px-6">
          <nav className="flex space-x-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📋' },
              { id: 'traffic', label: 'Traffic Intelligence', icon: '🚶' },
              { id: 'tradeArea', label: 'Trade Area', icon: '🎯' },
              { id: 'financial', label: 'Financial', icon: '💰' },
              { id: 'ownership', label: 'Ownership', icon: '👥' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Municipal Record Section */}
              <section>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-1 h-6 rounded mr-3" style={{ backgroundColor: getSignalColor('position') }}></span>
                  Municipal Property Record (P-01)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Parcel ID</div>
                    <div className="font-mono text-sm mt-1">{position.propertyCard.parcelId}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Total Units</div>
                    <div className="text-xl font-bold">{position.propertyCard.units}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Building SF</div>
                    <div className="text-xl font-bold">{position.propertyCard.buildingSF.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Avg Unit Size</div>
                    <div className="text-xl font-bold">
                      {Math.round(position.propertyCard.buildingSF / position.propertyCard.units)} SF
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Lot Size</div>
                    <div className="text-xl font-bold">{position.propertyCard.lotSizeAcres} acres</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Stories / Parking</div>
                    <div className="text-xl font-bold">
                      {position.propertyCard.stories} stories / {position.propertyCard.parkingSpaces} spaces
                    </div>
                  </div>
                </div>
              </section>

              {/* Market Position Section */}
              <section>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-1 h-6 rounded mr-3" style={{ backgroundColor: getSignalColor('momentum') }}></span>
                  Current Market Position
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Market Rent (M-01)</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(position.lossToLease.marketRent)}/unit
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Vintage comp average</div>
                    <DataSourceIndicator metadata={momentum.rentByVintage.metadata} />
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">In-Place Rent</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(position.lossToLease.actualRent)}/unit
                    </div>
                    <div className="text-sm text-red-500 mt-1">
                      {formatPercent(position.lossToLease.lossPercentage)} below market
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Loss-to-Lease Opportunity (P-03)</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(position.lossToLease.lossPerUnit)}/unit/month
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {formatCurrency(position.lossToLease.totalAnnualLoss)}/year total
                    </div>
                    <DataSourceIndicator metadata={position.lossToLease.metadata} />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Occupancy Estimate (M-06)</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatPercent(momentum.occupancyProxy.estimatedOccupancy)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Trend: {momentum.occupancyProxy.trend}
                    </div>
                    <DataSourceIndicator metadata={momentum.occupancyProxy.metadata} />
                  </div>
                </div>
              </section>

              {/* Seller Motivation Section */}
              <section>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-1 h-6 rounded mr-3" style={{ backgroundColor: getSignalColor('position') }}></span>
                  Seller Motivation Score: {position.sellerMotivation.score}/100 (P-05)
                </h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-yellow-500 h-3 rounded-full transition-all"
                        style={{ width: `${position.sellerMotivation.score}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-sm mb-3">{position.sellerMotivation.assessment}</div>
                  <div className="space-y-2">
                    {position.sellerMotivation.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-start">
                        <span className={`mr-2 ${
                          factor.impact === 'HIGH' ? 'text-red-600' : 
                          factor.impact === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-600'
                        }`}>
                          {factor.impact === 'HIGH' ? '🔴' : factor.impact === 'MEDIUM' ? '🟡' : '⚪'}
                        </span>
                        <div>
                          <div className="font-medium text-sm">{factor.factor}</div>
                          <div className="text-xs text-gray-600">{factor.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <DataSourceIndicator metadata={position.sellerMotivation.metadata} />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'traffic' && (
            <div className="space-y-6">
              {/* Traffic Correlation - Hidden Gem Detection */}
              <section>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-1 h-6 rounded mr-3" style={{ backgroundColor: getSignalColor('traffic') }}></span>
                  Traffic Correlation Signal (T-04)
                </h3>
                <div className={`border-2 rounded-lg p-6 ${
                  traffic.trafficCorrelation.classification === 'HIDDEN_GEM' ? 'bg-green-50 border-green-400' :
                  traffic.trafficCorrelation.classification === 'VALIDATED' ? 'bg-blue-50 border-blue-400' :
                  traffic.trafficCorrelation.classification === 'HYPE_CHECK' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-gray-50 border-gray-400'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-2xl font-bold">{traffic.trafficCorrelation.classification.replace('_', ' ')}</div>
                      <div className="text-sm text-gray-600 mt-1">{traffic.trafficCorrelation.interpretation}</div>
                    </div>
                    <div className="text-6xl">
                      {traffic.trafficCorrelation.classification === 'HIDDEN_GEM' ? '💎' :
                       traffic.trafficCorrelation.classification === 'VALIDATED' ? '✅' :
                       traffic.trafficCorrelation.classification === 'HYPE_CHECK' ? '⚠️' : '❌'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="text-sm text-gray-600">Physical Traffic Score (T-02)</div>
                      <div className="text-3xl font-bold">{traffic.physicalTrafficScore.score}</div>
                      <div className="text-sm text-gray-500">{traffic.physicalTrafficScore.tier}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Digital Traffic Score (T-03)</div>
                      <div className="text-3xl font-bold">{traffic.digitalTrafficScore.score}</div>
                      <div className="text-sm text-gray-500">{traffic.digitalTrafficScore.tier}</div>
                    </div>
                  </div>
                  <DataSourceIndicator metadata={traffic.trafficCorrelation.metadata} />
                </div>
              </section>

              {/* Weekly Walk-In Prediction */}
              <section>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-1 h-6 rounded mr-3" style={{ backgroundColor: getSignalColor('traffic') }}></span>
                  Weekly Walk-In Prediction (T-01)
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <div className="text-sm text-gray-600">Weekly Walk-Ins</div>
                      <div className="text-4xl font-bold text-blue-600">
                        {traffic.walkInPrediction.weeklyWalkIns.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Daily Average</div>
                      <div className="text-4xl font-bold text-blue-600">
                        {traffic.walkInPrediction.dailyAverage}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Confidence</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {traffic.walkInPrediction.confidence}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{traffic.walkInPrediction.methodology}</div>
                    </div>
                  </div>
                  <DataSourceIndicator metadata={traffic.walkInPrediction.metadata} />
                </div>
              </section>

              {/* Physical Traffic Details */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Physical Traffic Score (T-02)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">AADT (Vehicles/Day)</div>
                    <div className="text-2xl font-bold">{traffic.physicalTrafficScore.aadt.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Road Class</div>
                    <div className="text-xl font-bold">{traffic.physicalTrafficScore.roadClass}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Intersection Type</div>
                    <div className="text-xl font-bold">{traffic.physicalTrafficScore.intersectionType}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Capture Rate (T-06)</div>
                    <div className="text-2xl font-bold">{formatPercent(traffic.captureRate.rate)}</div>
                    <DataSourceIndicator metadata={traffic.captureRate.metadata} />
                  </div>
                </div>
              </section>

              {/* Generator Proximity */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Generator Proximity Score: {traffic.generatorProximity.score}/100 (T-08)</h3>
                <div className="space-y-2">
                  {traffic.generatorProximity.generators.map((gen, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{gen.name}</div>
                        <div className="text-sm text-gray-600">{gen.type} • {gen.distanceMiles} miles</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Traffic Contribution</div>
                        <div className="text-xl font-bold text-blue-600">+{gen.trafficContribution} walk-ins/week</div>
                      </div>
                    </div>
                  ))}
                </div>
                <DataSourceIndicator metadata={traffic.generatorProximity.metadata} />
              </section>

              {/* Traffic Trajectory */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Property Traffic Trajectory (T-07)</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-600">8-Week Trend</div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      traffic.trafficTrajectory.trend === 'ACCELERATING' ? 'bg-green-100 text-green-800' :
                      traffic.trafficTrajectory.trend === 'STABLE' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {traffic.trafficTrajectory.trend}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {traffic.trafficTrajectory.eightWeekTimeSeries.map((week, idx) => (
                      <div key={idx} className="flex items-center">
                        <div className="w-24 text-sm text-gray-600">{week.week}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                          <div
                            className="bg-blue-500 h-6 rounded-full transition-all flex items-center justify-end pr-2 text-white text-xs font-medium"
                            style={{ width: `${(week.walkIns / 2000) * 100}%` }}
                          >
                            {week.walkIns.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <DataSourceIndicator metadata={traffic.trafficTrajectory.metadata} />
                </div>
              </section>

              {/* Competitive Traffic Share */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Competitive Traffic Share (T-09)</h3>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Property Walk-Ins</div>
                      <div className="text-2xl font-bold">{traffic.competitiveTrafficShare.propertyWalkIns.toLocaleString()}/week</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Trade Area Total</div>
                      <div className="text-2xl font-bold">{traffic.competitiveTrafficShare.tradeAreaTotalWalkIns.toLocaleString()}/week</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Market Share</div>
                      <div className="text-2xl font-bold text-purple-600">{formatPercent(traffic.competitiveTrafficShare.sharePercentage)}</div>
                      <div className="text-sm text-gray-500">Rank #{traffic.competitiveTrafficShare.rank}</div>
                    </div>
                  </div>
                  <DataSourceIndicator metadata={traffic.competitiveTrafficShare.metadata} />
                </div>
              </section>

              {/* Validation Confidence */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Traffic Validation Confidence (T-10)</h3>
                <div className={`border-2 rounded-lg p-4 ${
                  traffic.validationConfidence.status === 'VALIDATED' ? 'bg-green-50 border-green-400' :
                  traffic.validationConfidence.status === 'PENDING' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-gray-50 border-gray-400'
                }`}>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Confidence</div>
                      <div className="text-2xl font-bold">{traffic.validationConfidence.confidence}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Predicted</div>
                      <div className="text-xl font-bold">{traffic.validationConfidence.predictedValue}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Actual</div>
                      <div className="text-xl font-bold">{traffic.validationConfidence.userActuals || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Variance</div>
                      <div className="text-xl font-bold">
                        {traffic.validationConfidence.variance ? formatPercent(traffic.validationConfidence.variance) : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className={`mt-3 px-3 py-1 rounded-full text-sm font-medium inline-block ${
                    traffic.validationConfidence.status === 'VALIDATED' ? 'bg-green-100 text-green-800' :
                    traffic.validationConfidence.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {traffic.validationConfidence.status}
                  </div>
                  <DataSourceIndicator metadata={traffic.validationConfidence.metadata} />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'tradeArea' && (
            <div className="space-y-6">
              {/* Trade Area Definition */}
              <section>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-1 h-6 rounded mr-3" style={{ backgroundColor: getSignalColor('tradeArea') }}></span>
                  Trade Area Definition (TA-01)
                </h3>
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Type</div>
                      <div className="text-xl font-bold">{tradeArea.tradeAreaDefinition.type}</div>
                    </div>
                    {tradeArea.tradeAreaDefinition.radiusMiles && (
                      <div>
                        <div className="text-sm text-gray-600">Radius</div>
                        <div className="text-xl font-bold">{tradeArea.tradeAreaDefinition.radiusMiles} miles</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 bg-white rounded p-4 text-sm text-gray-600">
                    <div className="font-medium mb-2">Boundary Coordinates:</div>
                    <div className="font-mono text-xs">
                      {tradeArea.tradeAreaDefinition.boundary.slice(0, 3).map((coord, idx) => (
                        <div key={idx}>
                          Point {idx + 1}: {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
                        </div>
                      ))}
                      <div className="text-gray-400">...and {tradeArea.tradeAreaDefinition.boundary.length - 3} more points</div>
                    </div>
                  </div>
                  <DataSourceIndicator metadata={tradeArea.tradeAreaDefinition.metadata} />
                </div>
              </section>

              {/* Trade Area Supply-Demand Balance */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Trade Area Supply-Demand Balance (TA-03)</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Total Units</div>
                      <div className="text-2xl font-bold">{tradeArea.tradeAreaBalance.totalUnits.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Renter HHs</div>
                      <div className="text-2xl font-bold">{tradeArea.tradeAreaBalance.renterHouseholds.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Jobs/Apt Ratio</div>
                      <div className="text-2xl font-bold">{tradeArea.tradeAreaBalance.jobsToApartments.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Saturation</div>
                      <div className={`text-2xl font-bold ${
                        tradeArea.tradeAreaBalance.assessment === 'BALANCED' ? 'text-blue-600' :
                        tradeArea.tradeAreaBalance.assessment === 'UNDERSUPPLIED' ? 'text-green-600' :
                        'text-red-600'
                      }`}>
                        {tradeArea.tradeAreaBalance.saturation.toFixed(2)}x
                      </div>
                    </div>
                  </div>
                  <div className={`mt-3 px-3 py-1 rounded-full text-sm font-medium inline-block ${
                    tradeArea.tradeAreaBalance.assessment === 'BALANCED' ? 'bg-blue-100 text-blue-800' :
                    tradeArea.tradeAreaBalance.assessment === 'UNDERSUPPLIED' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {tradeArea.tradeAreaBalance.assessment}
                  </div>
                  <DataSourceIndicator metadata={tradeArea.tradeAreaBalance.metadata} />
                </div>
              </section>

              {/* Competitive Set */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Competitive Set (TA-02)</h3>
                <div className="text-sm text-gray-600 mb-3">
                  {tradeArea.competitiveSet.properties.length} properties competing for the same renters
                </div>
                <div className="space-y-2">
                  {tradeArea.competitiveSet.properties.map((comp, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{comp.name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {comp.address} • {comp.units} units • Built {comp.yearBuilt}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-sm text-gray-600">Relevance Score</div>
                          <div className="text-xl font-bold text-pink-600">{comp.relevanceScore}/100</div>
                          <div className="text-xs text-gray-500 mt-1">{comp.distanceMiles} miles away</div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          comp.class === 'A' ? 'bg-green-100 text-green-800' :
                          comp.class === 'A-' ? 'bg-blue-100 text-blue-800' :
                          comp.class === 'B+' ? 'bg-indigo-100 text-indigo-800' :
                          comp.class === 'B' ? 'bg-purple-100 text-purple-800' :
                          comp.class === 'B-' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          Class {comp.class}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <DataSourceIndicator metadata={tradeArea.competitiveSet.metadata} />
              </section>

              {/* Digital Competitive Intel */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Digital Competitive Intelligence (TA-04)</h3>
                <div className="space-y-2">
                  {tradeArea.digitalCompetitiveIntel.properties.map((comp, idx) => {
                    const propertyName = tradeArea.competitiveSet.properties.find(p => p.propertyId === comp.propertyId)?.name || comp.propertyId;
                    return (
                      <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-medium">{propertyName}</div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            comp.competitivePosition === 'LEADER' ? 'bg-green-100 text-green-800' :
                            comp.competitivePosition === 'CHALLENGER' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {comp.competitivePosition}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Website Traffic</div>
                            <div className="font-bold">{comp.websiteTraffic.toLocaleString()}/mo</div>
                          </div>
                          <div>
                            <div className="text-gray-600">SEO Score</div>
                            <div className="font-bold">{comp.seoScore}/100</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Ad Spend</div>
                            <div className="font-bold">${comp.adSpend.toLocaleString()}/mo</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <DataSourceIndicator metadata={tradeArea.digitalCompetitiveIntel.metadata} />
              </section>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="space-y-6">
              {/* Loss-to-Lease */}
              <section>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-1 h-6 rounded mr-3" style={{ backgroundColor: getSignalColor('position') }}></span>
                  Loss-to-Lease Analysis (P-03)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Per Unit/Month</div>
                    <div className="text-3xl font-bold text-green-600">
                      {formatCurrency(position.lossToLease.lossPerUnit)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{formatPercent(position.lossToLease.lossPercentage)} below market</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Total Annual Opportunity</div>
                    <div className="text-3xl font-bold text-green-600">
                      {formatCurrency(position.lossToLease.totalAnnualLoss)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Revenue upside from market rent</div>
                  </div>
                </div>
              </section>

              {/* Tax Assessment */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Tax Assessment & Step-Up Risk (P-06)</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Current Assessment</div>
                      <div className="text-2xl font-bold">{formatCurrency(position.taxAssessment.currentAssessedValue)}</div>
                      <div className="text-sm text-gray-500 mt-1">Current Tax: {formatCurrency(position.taxAssessment.currentAnnualTax)}/year</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Post-Acquisition Estimate</div>
                      <div className="text-2xl font-bold">{formatCurrency(position.taxAssessment.estimatedPostAcquisitionValue)}</div>
                      <div className="text-sm text-gray-500 mt-1">New Tax: {formatCurrency(position.taxAssessment.estimatedPostAcquisitionTax)}/year</div>
                    </div>
                  </div>
                  <div className="bg-white rounded p-3">
                    <div className="text-sm text-red-600 font-medium">⚠️ Tax Step-Up Warning</div>
                    <div className="text-lg font-bold text-red-600 mt-1">
                      +{formatCurrency(position.taxAssessment.stepUpAmount)}/year ({formatCurrency(position.taxAssessment.stepUpPerUnit)}/unit)
                    </div>
                    <div className="text-xs text-gray-600 mt-1">This is often missed in broker OMs</div>
                  </div>
                  <DataSourceIndicator metadata={position.taxAssessment.metadata} />
                </div>
              </section>

              {/* Price Benchmarks */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Price/Unit Benchmarks (P-07)</h3>
                <div className="space-y-2">
                  {position.priceBenchmarks.recentSales.map((sale, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{sale.address}</div>
                        <div className="text-sm text-gray-600">Sale Date: {sale.saleDate}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{formatCurrency(sale.pricePerUnit)}/unit</div>
                        <div className="text-sm text-gray-600">{formatCurrency(sale.pricePerSF)}/SF</div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Submarket Average</div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">{formatCurrency(position.priceBenchmarks.submarketAvgPricePerUnit)}/unit</div>
                        <div className="text-sm text-gray-600">{formatCurrency(position.priceBenchmarks.submarketAvgPricePerSF)}/SF</div>
                      </div>
                    </div>
                  </div>
                </div>
                <DataSourceIndicator metadata={position.priceBenchmarks.metadata} />
              </section>

              {/* Deferred Maintenance */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Deferred Maintenance Estimate (R-06)</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Total Estimated Capex Needs</div>
                      <div className="text-3xl font-bold text-yellow-600">{formatCurrency(risk.deferredMaintenance.estimatedCapexNeeds)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Per Unit</div>
                      <div className="text-3xl font-bold text-yellow-600">{formatCurrency(risk.deferredMaintenance.perUnitEstimate)}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {risk.deferredMaintenance.majorItems.map((item, idx) => (
                      <div key={idx} className="bg-white rounded p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{item.item}</div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.urgency === 'IMMEDIATE' ? 'bg-red-100 text-red-800' :
                            item.urgency === 'NEAR_TERM' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.urgency}
                          </span>
                        </div>
                        <div className="text-xl font-bold">{formatCurrency(item.estimatedCost)}</div>
                      </div>
                    ))}
                  </div>
                  <DataSourceIndicator metadata={risk.deferredMaintenance.metadata} />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'ownership' && (
            <div className="space-y-6">
              {/* Ownership Profile */}
              <section>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-1 h-6 rounded mr-3" style={{ backgroundColor: getSignalColor('position') }}></span>
                  Ownership Profile & Hold Period (P-04)
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm text-gray-600">Owner</div>
                      <div className="text-2xl font-bold">{position.ownership.ownerName}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        <span className="px-2 py-1 bg-gray-100 rounded">{position.ownership.ownerEntityType}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Hold Period</div>
                      <div className="text-2xl font-bold">{position.ownership.holdPeriodYears.toFixed(1)} years</div>
                      <div className="text-sm text-gray-500 mt-1">Since {position.ownership.purchaseDate}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Purchase Price</div>
                      <div className="text-2xl font-bold">{formatCurrency(position.ownership.purchasePrice)}</div>
                      <div className="text-sm text-gray-500 mt-1">{formatCurrency(position.ownership.pricePerUnit)}/unit</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Market vs Cycle (R-09)</div>
                      <div className="text-2xl font-bold">{risk.holdPeriodCycle.marketAvgHoldPeriod.toFixed(1)} years avg</div>
                      <div className="text-sm text-gray-500 mt-1">Debt maturity: {risk.holdPeriodCycle.likelyDebtMaturity}</div>
                    </div>
                  </div>
                  <DataSourceIndicator metadata={position.ownership.metadata} />
                </div>
              </section>

              {/* Seller Motivation (Full Detail) */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Seller Motivation Analysis (P-05)</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-4xl font-bold text-yellow-600">{position.sellerMotivation.score}/100</div>
                      <div className="text-sm text-gray-600 mt-1">Motivation Score</div>
                    </div>
                    <div className="text-6xl">📊</div>
                  </div>
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-yellow-500 h-4 rounded-full transition-all"
                        style={{ width: `${position.sellerMotivation.score}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="bg-white rounded p-4 mb-4">
                    <div className="font-medium mb-2">Assessment:</div>
                    <div className="text-gray-700">{position.sellerMotivation.assessment}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="font-medium">Key Factors:</div>
                    {position.sellerMotivation.factors.map((factor, idx) => (
                      <div key={idx} className="bg-white rounded p-4">
                        <div className="flex items-start">
                          <span className={`mr-3 text-2xl ${
                            factor.impact === 'HIGH' ? 'text-red-600' : 
                            factor.impact === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-600'
                          }`}>
                            {factor.impact === 'HIGH' ? '🔴' : factor.impact === 'MEDIUM' ? '🟡' : '⚪'}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{factor.factor}</div>
                            <div className="text-sm text-gray-600 mt-1">{factor.description}</div>
                            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                              factor.impact === 'HIGH' ? 'bg-red-100 text-red-800' :
                              factor.impact === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {factor.impact} IMPACT
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <DataSourceIndicator metadata={position.sellerMotivation.metadata} />
                </div>
              </section>

              {/* Ownership Concentration Risk */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Ownership Concentration Risk (R-07)</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Top 3 Owners Market Share</div>
                      <div className="text-2xl font-bold">{formatPercent(risk.ownershipConcentration.top3OwnerMarketShare)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Herfindahl Index</div>
                      <div className="text-2xl font-bold">{risk.ownershipConcentration.herfindahlIndex.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Assessment</div>
                      <div className={`text-xl font-bold ${
                        risk.ownershipConcentration.assessment === 'LOW' ? 'text-green-600' :
                        risk.ownershipConcentration.assessment === 'MODERATE' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {risk.ownershipConcentration.assessment}
                      </div>
                    </div>
                  </div>
                  <DataSourceIndicator metadata={risk.ownershipConcentration.metadata} />
                </div>
              </section>

              {/* News & Alerts */}
              <section>
                <h3 className="text-lg font-semibold mb-4">Recent News & Alerts (R-10)</h3>
                <div className="space-y-2">
                  {risk.newsSentiment.alerts.map((alert, idx) => (
                    <div key={idx} className={`border-l-4 rounded-lg p-4 ${
                      alert.impact === 'POSITIVE' ? 'bg-green-50 border-green-400' :
                      alert.impact === 'NEGATIVE' ? 'bg-red-50 border-red-400' :
                      'bg-gray-50 border-gray-400'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="text-2xl mr-2">
                              {alert.impact === 'POSITIVE' ? '✅' : alert.impact === 'NEGATIVE' ? '❌' : 'ℹ️'}
                            </span>
                            <div className="font-medium">{alert.title}</div>
                          </div>
                          <div className="text-sm text-gray-600 mt-2">{alert.summary}</div>
                          <div className="text-xs text-gray-500 mt-2">{alert.date}</div>
                        </div>
                        <span className={`ml-4 px-2 py-1 rounded text-xs font-medium ${
                          alert.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Overall News Sentiment</div>
                  <div className="flex items-center mt-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          risk.newsSentiment.overallSentiment > 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.abs(risk.newsSentiment.overallSentiment)}%` }}
                      ></div>
                    </div>
                    <div className="ml-4 font-bold">{risk.newsSentiment.overallSentiment > 0 ? '+' : ''}{risk.newsSentiment.overallSentiment}</div>
                  </div>
                </div>
                <DataSourceIndicator metadata={risk.newsSentiment.metadata} />
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Last updated: {new Date(property.lastUpdated).toLocaleString()}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyIntelligenceModal;
