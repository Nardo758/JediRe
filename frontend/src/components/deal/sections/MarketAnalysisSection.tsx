import React, { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Building2, Activity, FileText, BarChart3, PieChart } from 'lucide-react';
import { Deal } from '@/types';
import { ModuleUpsellBanner } from './ModuleUpsellBanner';
import { BT } from '@/components/deal/bloomberg-ui';

interface MarketAnalysisSectionProps {
  deal: Deal;
  enhanced?: boolean;
  onToggleModule?: () => void;
}

export function MarketAnalysisSection({ deal, enhanced = false, onToggleModule }: MarketAnalysisSectionProps) {
  const [editMode, setEditMode] = useState(false);
  const [marketData, setMarketData] = useState({
    occupancyRate: 0,
    avgRent: 0,
    classDistribution: { A: 0, B: 0, C: 0, D: 0 }
  });

  if (!enhanced) {
    return (
      <div className="space-y-6">
        {/* Basic Market Stats */}
        <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Market Statistics</h3>
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ color: BT.text.cyan, borderRadius: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>

          <div className="space-y-6">
            {/* Occupancy Rate */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>
                <Activity className="w-4 h-4" />
                Submarket Occupancy Rate
              </label>
              {editMode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={marketData.occupancyRate}
                    onChange={(e) => setMarketData({ ...marketData, occupancyRate: parseFloat(e.target.value) })}
                    className="w-32 px-3 py-2 focus:ring-2 focus:border-transparent"
                    style={{ background: BT.bg.input, border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.primary }}
                  />
                  <span className="text-sm" style={{ color: BT.text.secondary }}>%</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
                    {marketData.occupancyRate > 0 ? `${marketData.occupancyRate}%` : '—'}
                  </div>
                  {marketData.occupancyRate === 0 && (
                    <span className="text-sm italic" style={{ color: BT.text.secondary }}>Click Edit to enter data</span>
                  )}
                </div>
              )}
            </div>

            {/* Average Rent */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>
                <TrendingUp className="w-4 h-4" />
                Average Rent
              </label>
              {editMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: BT.text.secondary }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={marketData.avgRent}
                    onChange={(e) => setMarketData({ ...marketData, avgRent: parseFloat(e.target.value) })}
                    className="w-40 px-3 py-2 focus:ring-2 focus:border-transparent"
                    style={{ background: BT.bg.input, border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.primary }}
                  />
                  <span className="text-sm" style={{ color: BT.text.secondary }}>/month</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
                    {marketData.avgRent > 0 ? `$${marketData.avgRent.toLocaleString()}` : '—'}
                  </div>
                  {marketData.avgRent === 0 && (
                    <span className="text-sm italic" style={{ color: BT.text.secondary }}>Click Edit to enter data</span>
                  )}
                </div>
              )}
            </div>

            {/* Building Class Distribution */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>
                <Building2 className="w-4 h-4" />
                Building Class Distribution
              </label>
              {editMode ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(marketData.classDistribution).map(([cls, value]) => (
                    <div key={cls} className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Class {cls}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => setMarketData({
                            ...marketData,
                            classDistribution: {
                              ...marketData.classDistribution,
                              [cls]: parseFloat(e.target.value)
                            }
                          })}
                          className="w-full px-2 py-1.5 text-sm focus:ring-2 focus:border-transparent"
                          style={{ background: BT.bg.input, border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.primary }}
                        />
                        <span className="text-xs" style={{ color: BT.text.secondary }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(marketData.classDistribution).map(([cls, value]) => (
                    <div key={cls} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-16" style={{ color: BT.text.secondary }}>Class {cls}</span>
                      <div className="flex-1 h-6 overflow-hidden" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                        <div
                          className="h-full transition-all"
                          style={{ width: `${value}%`, background: BT.text.cyan, borderRadius: 0 }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>
                        {value > 0 ? `${value}%` : '—'}
                      </span>
                    </div>
                  ))}
                  {Object.values(marketData.classDistribution).every(v => v === 0) && (
                    <span className="text-sm italic" style={{ color: BT.text.secondary }}>Click Edit to enter distribution</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Entry Prompt */}
        {!editMode && Object.values(marketData).every(v =>
          typeof v === 'number' ? v === 0 : Object.values(v).every(x => x === 0)
        ) && (
          <div className="p-4" style={{ background: `${BT.text.cyan}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 mt-0.5" style={{ color: BT.text.cyan }} />
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: BT.text.cyan }}>
                  Manual Data Entry Required
                </p>
                <p className="text-sm" style={{ color: BT.text.secondary }}>
                  Enter your market research data manually or upgrade to Market Signals for automated tracking.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Module Upsell */}
        {onToggleModule && (
          <ModuleUpsellBanner
            moduleName="Market Signals"
            benefits={[
              'Supply pipeline monitoring (track new developments)',
              'Competitor intelligence (competing properties)',
              'Absorption rates and market velocity',
              'Early warning alerts for market shifts',
              'Historical trend analysis'
            ]}
            price="$39"
            onAddModule={onToggleModule}
            onLearnMore={() => {}}
          />
        )}
      </div>
    );
  }

  // Enhanced version with Market Signals
  return (
    <div className="space-y-6">
      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5" style={{ color: BT.text.green }} />
            <span className="text-sm font-medium" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Occupancy Rate</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>94.2%</p>
            <span className="flex items-center text-sm mb-1" style={{ color: BT.text.green }}>
              <TrendingUp className="w-4 h-4 mr-1" />
              +2.1%
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: BT.text.muted }}>vs. last quarter</p>
        </div>

        <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5" style={{ color: BT.text.cyan }} />
            <span className="text-sm font-medium" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Average Rent</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>$2,450</p>
            <span className="flex items-center text-sm mb-1" style={{ color: BT.text.green }}>
              <TrendingUp className="w-4 h-4 mr-1" />
              +5.3%
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: BT.text.muted }}>YoY growth</p>
        </div>

        <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5" style={{ color: BT.text.purple }} />
            <span className="text-sm font-medium" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Absorption Rate</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>87%</p>
            <span className="flex items-center text-sm mb-1" style={{ color: BT.text.secondary }}>
              <TrendingUp className="w-4 h-4 mr-1" />
              Stable
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: BT.text.muted }}>30-day average</p>
        </div>
      </div>

      {/* Supply Pipeline */}
      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
            <Building2 className="w-5 h-5" />
            Supply Pipeline
          </h3>
          <span className="px-2 py-1 text-xs font-medium" style={{ background: `${BT.text.cyan}22`, color: BT.text.cyan, borderRadius: 0 }}>
            5 developments tracked
          </span>
        </div>

        <div className="space-y-3">
          {[
            { name: 'Riverside Towers', units: 120, completion: '2024 Q3', status: 'construction' },
            { name: 'Park Place Lofts', units: 85, completion: '2024 Q4', status: 'planning' },
            { name: 'Downtown Commons', units: 200, completion: '2025 Q1', status: 'construction' },
            { name: 'Greenway Apartments', units: 60, completion: '2025 Q2', status: 'planning' },
            { name: 'Harbor View', units: 150, completion: '2025 Q3', status: 'planning' }
          ].map((dev, idx) => (
            <div key={idx} className="flex items-center justify-between p-3" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: BT.text.primary }}>{dev.name}</p>
                <p className="text-xs" style={{ color: BT.text.muted }}>{dev.units} units · Est. completion {dev.completion}</p>
              </div>
              <span className="px-2 py-1 text-xs font-medium" style={{
                background: dev.status === 'construction' ? `${BT.text.orange}22` : BT.bg.hover,
                color: dev.status === 'construction' ? BT.text.orange : BT.text.secondary,
                borderRadius: 0
              }}>
                {dev.status === 'construction' ? 'Under Construction' : 'Planning'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Intelligence */}
      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
            <PieChart className="w-5 h-5" />
            Competitor Intelligence
          </h3>
          <span className="px-2 py-1 text-xs font-medium" style={{ background: `${BT.text.purple}22`, color: BT.text.purple, borderRadius: 0 }}>
            3 competing properties
          </span>
        </div>

        <div className="space-y-3">
          {[
            { name: 'Oak Street Residences', avgRent: 2600, occupancy: 96, concessions: 'None' },
            { name: 'Metro Plaza', avgRent: 2350, occupancy: 92, concessions: '1 month free' },
            { name: 'Westside Commons', avgRent: 2500, occupancy: 89, concessions: '$500 off' }
          ].map((comp, idx) => (
            <div key={idx} className="p-4" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: BT.text.primary }}>{comp.name}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs" style={{ color: BT.text.secondary }}>Avg Rent: ${comp.avgRent}</span>
                    <span className="text-xs" style={{ color: BT.text.secondary }}>Occupancy: {comp.occupancy}%</span>
                  </div>
                </div>
              </div>
              {comp.concessions !== 'None' && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <AlertTriangle className="w-3 h-3" style={{ color: BT.text.orange }} />
                  <span className="font-medium" style={{ color: BT.text.orange }}>Active concessions: {comp.concessions}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Early Warning Alerts */}
      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
          <AlertTriangle className="w-5 h-5" style={{ color: BT.text.orange }} />
          Early Warning Alerts
        </h3>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3" style={{ background: `${BT.text.amber}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BT.text.amber }} />
            <div>
              <p className="text-sm font-medium" style={{ color: BT.text.amber }}>Supply Surge Expected</p>
              <p className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                3 major developments (435 units total) completing within next 6 months
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3" style={{ background: `${BT.text.cyan}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <TrendingUp className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BT.text.cyan }} />
            <div>
              <p className="text-sm font-medium" style={{ color: BT.text.cyan }}>Rent Growth Accelerating</p>
              <p className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                Market rents up 5.3% YoY, outpacing regional average of 3.8%
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3" style={{ background: `${BT.text.red}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <TrendingDown className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BT.text.red }} />
            <div>
              <p className="text-sm font-medium" style={{ color: BT.text.red }}>Competitor Concessions Rising</p>
              <p className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                2 of 3 competitors now offering move-in incentives
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Market Trend Charts Placeholder */}
      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Market Trends</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Occupancy Trend */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Occupancy Rate (12 months)</p>
            <div className="h-48 flex items-center justify-center" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="text-center" style={{ color: BT.text.muted }}>
                <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs">Chart visualization</p>
              </div>
            </div>
          </div>

          {/* Rent Growth Trend */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Average Rent Growth (12 months)</p>
            <div className="h-48 flex items-center justify-center" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="text-center" style={{ color: BT.text.muted }}>
                <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs">Chart visualization</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Report Button */}
      <div className="flex justify-center">
        <button className="inline-flex items-center gap-2 px-6 py-3 font-medium transition-colors" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>
          <FileText className="w-5 h-5" />
          View Full Market Report
        </button>
      </div>
    </div>
  );
}
