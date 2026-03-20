import React from 'react';
import { useNavigate } from 'react-router-dom';
import ShowcaseDataService from '../services/showcase.service';

export function ShowcaseLandingPage() {
  const navigate = useNavigate();
  const deals = ShowcaseDataService.getDeals();
  const modules = ShowcaseDataService.getModules();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Header */}
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold mb-4">
            🎨 FEATURE SHOWCASE - VISUAL PROTOTYPE
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            JEDI RE - Complete Vision
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore the full platform with all features visible. This is a visual mockup showing what we're building.
          </p>
        </div>

        {/* Feature Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">10</div>
            <div className="text-sm text-gray-600">Deal Sections</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">39</div>
            <div className="text-sm text-gray-600">Strategies Analyzed</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">7</div>
            <div className="text-sm text-gray-600">Context Tracker Components</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">5</div>
            <div className="text-sm text-gray-600">Premium Modules</div>
          </div>
        </div>

        {/* Sample Deals */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">📊 Sample Deals</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {deals.map(deal => (
              <div
                key={deal.id}
                onClick={() => navigate(`/showcase/deal/${deal.id}`)}
                className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition-all transform hover:-translate-y-1"
              >
                <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-400 relative">
                  <img 
                    src={deal.imageUrl} 
                    alt={deal.name} 
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 rounded-full bg-white text-gray-900 text-xs font-semibold capitalize">
                      {deal.status}
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{deal.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {deal.address}, {deal.city}, {deal.state}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">Price</div>
                      <div className="font-bold text-gray-900">${(deal.purchasePrice / 1000000).toFixed(2)}M</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Target IRR</div>
                      <div className="font-bold text-green-600">{deal.targetIRR}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Units</div>
                      <div className="font-bold text-gray-900">{deal.units}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Days Active</div>
                      <div className="font-bold text-gray-900">{deal.daysInDeal}</div>
                    </div>
                  </div>
                  
                  <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    Explore Deal →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Modules */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🎯 Premium Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map(module => (
              <div
                key={module.id}
                onClick={() => navigate(`/showcase/modules/${module.id}`)}
                className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-2xl transition-all transform hover:-translate-y-1"
              >
                <div className="text-4xl mb-4">{module.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{module.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{module.description}</p>
                
                <div className="space-y-2 mb-4">
                  {module.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-green-600">✓</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-2xl font-bold text-gray-900">${module.price}/mo</span>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Context Tracker Preview */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🎯 Deal Context Tracker Components</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: '📋', name: 'Activity Timeline', desc: '30+ events tracked' },
              { icon: '👥', name: 'Contact Map', desc: 'Responsiveness tracking' },
              { icon: '📄', name: 'Document Vault', desc: 'AI extraction ready' },
              { icon: '💰', name: 'Financial Snapshot', desc: 'Real-time metrics' },
              { icon: '📅', name: 'Key Dates', desc: 'Critical milestones' },
              { icon: '🎯', name: 'Decision Log', desc: 'AI vs Actual tracking' },
              { icon: '⚠️', name: 'Risk Flags', desc: 'Auto-detection system' }
            ].map((component, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-2xl transition-all"
              >
                <div className="text-4xl mb-3">{component.icon}</div>
                <h4 className="font-bold text-gray-900 mb-1">{component.name}</h4>
                <p className="text-xs text-gray-600">{component.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">💎 Basic vs Enhanced</h2>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-4 font-bold text-gray-900">Feature</th>
                  <th className="text-center p-4 font-bold text-gray-900">Basic (Free)</th>
                  <th className="text-center p-4 font-bold text-blue-900 bg-blue-50">Enhanced (Premium)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Financial Analysis', basic: 'Simple calculator', enhanced: '13-component modeling suite' },
                  { feature: 'Strategy Analysis', basic: 'View primary strategy', enhanced: '39 strategies with ROI comparison' },
                  { feature: 'Due Diligence', basic: 'Basic checklist (10 tasks)', enhanced: 'Smart checklist (40+ contextual tasks)' },
                  { feature: 'Document Management', basic: 'File list', enhanced: 'AI extraction + version control' },
                  { feature: 'Market Analysis', basic: 'Basic metrics', enhanced: 'Supply pipeline + early warnings' },
                  { feature: 'Contact Tracking', basic: 'Contact list', enhanced: 'Responsiveness tracking + history' },
                  { feature: 'Timeline', basic: 'Simple timeline', enhanced: 'Full activity feed + decision log' }
                ].map((row, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="p-4 font-medium text-gray-900">{row.feature}</td>
                    <td className="p-4 text-center text-gray-600">{row.basic}</td>
                    <td className="p-4 text-center text-blue-900 font-semibold bg-blue-50">{row.enhanced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-2xl p-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to Explore?</h2>
          <p className="text-xl mb-8 opacity-90">
            Click any deal above to see ALL 10 sections with Basic vs Enhanced toggles
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/showcase/deal/deal-1')}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-bold text-lg"
            >
              🚀 Start Full Tour
            </button>
            <button
              onClick={() => navigate('/showcase/modules')}
              className="px-8 py-4 bg-blue-800 text-white rounded-lg hover:bg-blue-900 font-bold text-lg"
            >
              📚 Browse Modules
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center text-gray-600 text-sm">
          <p className="mb-2">
            🎨 This is a <strong>visual prototype</strong> showcasing the complete JEDI RE vision.
          </p>
          <p>
            All features, data, and interactions are mockups for demonstration purposes.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ShowcaseLandingPage;
