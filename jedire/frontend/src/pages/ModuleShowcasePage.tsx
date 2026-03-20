import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ShowcaseDataService from '../services/showcase.service';
import { FinancialModelingPro } from '../components/showcase/FinancialModelingPro';
import { StrategyArbitrageEngine } from '../components/showcase/StrategyArbitrageEngine';
import { DueDiligenceSuite } from '../components/showcase/DueDiligenceSuite';

export function ModuleShowcasePage() {
  const { moduleId } = useParams<{ moduleId?: string }>();
  const navigate = useNavigate();
  const modules = ShowcaseDataService.getModules();
  const [selectedModule, setSelectedModule] = useState(moduleId || 'module-1');

  const module = modules.find(m => m.id === selectedModule);

  const renderModuleContent = () => {
    switch (selectedModule) {
      case 'module-1': // Financial Modeling Pro
        return <FinancialModelingPro />;
      
      case 'module-2': // Strategy Arbitrage Engine
        return <StrategyArbitrageEngine />;
      
      case 'module-3': // Due Diligence Suite
        return <DueDiligenceSuite />;
      
      case 'module-4': // Market Signals
        return <MarketSignalsModule />;
      
      case 'module-5': // Development Tracker
        return <DevelopmentTrackerModule />;
      
      default:
        return <div>Module content coming soon...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/showcase')}
                className="text-gray-400 hover:text-gray-600"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Premium Modules</h1>
                <p className="text-sm text-gray-600">Explore all 5 modules with full functionality</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto py-4">
            {modules.map(mod => (
              <button
                key={mod.id}
                onClick={() => setSelectedModule(mod.id)}
                className={`flex items-center gap-3 px-6 py-3 rounded-lg whitespace-nowrap transition-all ${
                  selectedModule === mod.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="text-2xl">{mod.icon}</span>
                <div className="text-left">
                  <div className="font-semibold">{mod.name}</div>
                  <div className={`text-xs ${selectedModule === mod.id ? 'text-blue-100' : 'text-gray-500'}`}>
                    ${mod.price}/mo
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Module Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {module && (
          <div className="mb-6 p-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{module.icon}</span>
                  <div>
                    <h2 className="text-3xl font-bold">{module.name}</h2>
                    <p className="text-blue-100">{module.description}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {module.features.map((feature, i) => (
                    <span key={i} className="px-3 py-1 bg-white/20 rounded-full text-sm">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-4xl font-bold mb-2">${module.price}</div>
                <div className="text-sm text-blue-100 mb-4">per month</div>
                <button className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-bold">
                  Activate Module
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8">
          {renderModuleContent()}
        </div>
      </div>
    </div>
  );
}

// Market Signals Module (Visual Placeholder)
function MarketSignalsModule() {
  const signals = ShowcaseDataService.getMarketSignals().slice(0, 8);
  const pipeline = ShowcaseDataService.getSupplyPipeline().slice(0, 12);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Market Signals Dashboard</h2>
        <p className="text-gray-600 mb-6">
          Real-time intelligence on supply, demand, pricing, and competitive activity
        </p>
      </div>

      {/* Supply Pipeline Map (Visual Placeholder) */}
      <div className="p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
        <h3 className="text-xl font-bold text-blue-900 mb-4">Supply Pipeline Map</h3>
        <div className="aspect-video bg-gradient-to-br from-blue-200 to-blue-400 rounded-lg flex items-center justify-center relative overflow-hidden">
          {/* Map placeholder with dots */}
          <div className="absolute inset-0">
            {pipeline.slice(0, 8).map((unit, i) => (
              <div
                key={unit.id}
                className="absolute w-4 h-4 bg-red-500 rounded-full cursor-pointer hover:scale-150 transition-transform"
                style={{
                  left: `${20 + i * 10}%`,
                  top: `${30 + (i % 3) * 20}%`
                }}
                title={`${unit.name} - ${unit.units} units`}
              />
            ))}
          </div>
          <div className="relative z-10 text-white text-center">
            <div className="text-6xl font-bold mb-2">{pipeline.reduce((sum, u) => sum + u.units, 0)}+</div>
            <div className="text-xl">Total Units in Pipeline</div>
            <div className="text-sm opacity-80 mt-2">Within 5-mile radius</div>
          </div>
        </div>
      </div>

      {/* Pipeline Details */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Pipeline Projects</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pipeline.map(unit => (
            <div key={unit.id} className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{unit.name}</h4>
                  <p className="text-sm text-gray-600">{unit.address}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                  unit.status === 'under-construction' ? 'bg-orange-100 text-orange-800' :
                  unit.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                  unit.status === 'planned' ? 'bg-gray-100 text-gray-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {unit.status}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-gray-600">Units</div>
                  <div className="font-semibold">{unit.units}</div>
                </div>
                <div>
                  <div className="text-gray-600">Distance</div>
                  <div className="font-semibold">{unit.distance.toFixed(1)} mi</div>
                </div>
                <div>
                  <div className="text-gray-600">Completion</div>
                  <div className="font-semibold">{new Date(unit.completionDate).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Signals */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Active Signals</h3>
        <div className="space-y-3">
          {signals.map(signal => (
            <div key={signal.id} className="p-4 border-2 border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 text-xs rounded-full font-bold uppercase ${
                      signal.severity === 'critical' ? 'bg-red-600 text-white' :
                      signal.severity === 'alert' ? 'bg-orange-100 text-orange-800' :
                      signal.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {signal.severity}
                    </span>
                    <span className="text-sm text-gray-500 capitalize">{signal.type}</span>
                  </div>
                  
                  <h4 className="font-bold text-gray-900 mb-1">{signal.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{signal.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>📍 {signal.location}</span>
                    <span>🎯 {signal.confidence}% confidence</span>
                    <span>📅 {new Date(signal.detectedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="text-4xl ml-4">
                  {signal.impact === 'positive' ? '📈' : signal.impact === 'negative' ? '📉' : '➡️'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Early Warning System */}
      <div className="p-6 bg-red-50 rounded-lg border-2 border-red-200">
        <h3 className="text-xl font-bold text-red-900 mb-4">⚠️ Early Warning Alerts</h3>
        <div className="space-y-3">
          {[
            { title: 'Oversupply Risk', desc: '800+ units completing within 12 months', severity: 'High' },
            { title: 'Rent Decline Trend', desc: 'Average rents down 2.3% QoQ', severity: 'Medium' },
            { title: 'Absorption Slowdown', desc: 'Average lease-up time increased 45 days', severity: 'Medium' }
          ].map((alert, i) => (
            <div key={i} className="p-3 bg-white rounded border-l-4 border-red-500">
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="font-bold text-gray-900">{alert.title}</h5>
                  <p className="text-sm text-gray-600">{alert.desc}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded font-semibold ${
                  alert.severity === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {alert.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Development Tracker Module (Visual Placeholder)
function DevelopmentTrackerModule() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Development Tracker</h2>
        <p className="text-gray-600 mb-6">
          Gantt charts, permit tracking, construction budgets, and site plan analysis
        </p>
      </div>

      {/* Gantt Chart (Visual Placeholder) */}
      <div className="p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Project Timeline (Gantt Chart)</h3>
        <div className="space-y-3">
          {[
            { phase: 'Site Preparation', progress: 100, start: 'Jan 2025', end: 'Feb 2025', color: 'bg-green-500' },
            { phase: 'Foundation & Structure', progress: 75, start: 'Feb 2025', end: 'May 2025', color: 'bg-blue-500' },
            { phase: 'MEP Installation', progress: 40, start: 'Apr 2025', end: 'Aug 2025', color: 'bg-yellow-500' },
            { phase: 'Interior Finishes', progress: 15, start: 'Jun 2025', end: 'Oct 2025', color: 'bg-purple-500' },
            { phase: 'Exterior & Landscaping', progress: 0, start: 'Sep 2025', end: 'Nov 2025', color: 'bg-gray-400' }
          ].map((phase, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-48">
                <div className="font-semibold text-gray-900">{phase.phase}</div>
                <div className="text-xs text-gray-500">{phase.start} - {phase.end}</div>
              </div>
              <div className="flex-1">
                <div className="h-8 bg-gray-200 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full ${phase.color} flex items-center justify-center text-white text-sm font-semibold transition-all`}
                    style={{ width: `${phase.progress}%` }}
                  >
                    {phase.progress}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permit Status */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">🏛️ Permit Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { type: 'Building Permit', status: 'approved', date: '2025-01-10', expiry: '2026-01-10' },
            { type: 'Electrical Permit', status: 'approved', date: '2025-02-01', expiry: '2026-02-01' },
            { type: 'Plumbing Permit', status: 'under-review', date: '2025-02-15', expiry: null },
            { type: 'Certificate of Occupancy', status: 'applied', date: '2025-02-20', expiry: null }
          ].map((permit, i) => (
            <div key={i} className="p-4 border-2 border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-gray-900">{permit.type}</h4>
                <span className={`px-2 py-1 text-xs rounded-full font-semibold capitalize ${
                  permit.status === 'approved' ? 'bg-green-100 text-green-800' :
                  permit.status === 'under-review' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {permit.status}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <div>Applied: {new Date(permit.date).toLocaleDateString()}</div>
                {permit.expiry && <div>Expires: {new Date(permit.expiry).toLocaleDateString()}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Construction Budget */}
      <div className="grid grid-cols-2 gap-6">
        <div className="p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-4">Budget Overview</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Budget</span>
              <span className="font-bold text-gray-900">$12,500,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Spent to Date</span>
              <span className="font-bold text-gray-900">$6,750,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Remaining</span>
              <span className="font-bold text-green-600">$5,750,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Variance</span>
              <span className="font-bold text-green-600">+2.3%</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-green-50 rounded-lg border-2 border-green-200">
          <h4 className="font-semibold text-green-900 mb-4">Site Plan Capacity</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Buildable Area</span>
              <span className="font-bold text-gray-900">285,000 SF</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Planned Units</span>
              <span className="font-bold text-gray-900">86 units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Parking Spaces</span>
              <span className="font-bold text-gray-900">128 spaces</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Zoning Compliance</span>
              <span className="font-bold text-green-600">✓ Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModuleShowcasePage;
