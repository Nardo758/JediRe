import React, { useState } from 'react';

interface Module {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: string;
  category: string;
  rating: number;
  reviews: number;
  installed: boolean;
  featured?: boolean;
}

export function ModuleMarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    'All Categories',
    'Financial & Analysis',
    'Development',
    'Due Diligence',
    'Market Intelligence',
    'Collaboration',
    'Portfolio Management'
  ];

  const modules: Module[] = [
    {
      id: '1',
      name: 'Strategy Arbitrage',
      icon: '🎯',
      description: 'Analyze 4 investment strategies simultaneously with JEDI\'s intelligence compression',
      price: 'FREE',
      category: 'Financial & Analysis',
      rating: 4.9,
      reviews: 234,
      installed: true,
      featured: true
    },
    {
      id: '31',
      name: 'Email Intelligence',
      icon: '📧',
      description: 'AI-powered email agent that auto-categorizes, extracts data, creates tasks, and integrates deal context',
      price: '$49/mo',
      category: 'Market Intelligence',
      rating: 5.0,
      reviews: 89,
      installed: false,
      featured: true
    },
    {
      id: '2',
      name: 'Financial Modeling',
      icon: '💰',
      description: 'Pro forma builder with sensitivity analysis and scenario modeling',
      price: '$29/mo',
      category: 'Financial & Analysis',
      rating: 4.7,
      reviews: 189,
      installed: false,
      featured: true
    },
    {
      id: '3',
      name: 'Development Budget',
      icon: '🏗️',
      description: 'Line-item construction budget with tracking and variance analysis',
      price: '$49/mo',
      category: 'Development',
      rating: 4.6,
      reviews: 142,
      installed: false,
      featured: true
    },
    {
      id: '4',
      name: 'Returns Calculator',
      icon: '📈',
      description: 'IRR, equity multiple, CoC, waterfall distributions calculator',
      price: '$19/mo',
      category: 'Financial & Analysis',
      rating: 4.8,
      reviews: 201,
      installed: false
    },
    {
      id: '5',
      name: 'Comp Analysis',
      icon: '🔍',
      description: 'Comparable sales and rents analysis using Market Data Layer',
      price: '$24/mo',
      category: 'Financial & Analysis',
      rating: 4.5,
      reviews: 156,
      installed: false
    },
    {
      id: '6',
      name: 'Zoning Analysis',
      icon: '📋',
      description: 'Automated zoning code compliance checker',
      price: '$34/mo',
      category: 'Development',
      rating: 4.4,
      reviews: 98,
      installed: false
    }
  ];

  const bundles = [
    {
      name: 'Flipper Bundle',
      price: '$79/mo',
      savings: 'Save 25%',
      modules: 6,
      description: 'Perfect for fix-and-flip investors'
    },
    {
      name: 'Developer Bundle',
      price: '$149/mo',
      savings: 'Save 30%',
      modules: 12,
      description: 'Complete toolkit for developers'
    },
    {
      name: 'Portfolio Manager Bundle',
      price: '$199/mo',
      savings: 'Save 40%',
      modules: 27,
      description: 'All premium modules included'
    }
  ];

  const filteredModules = modules.filter(module => {
    const matchesCategory = selectedCategory === 'all' || 
      module.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🛒 Module Marketplace
        </h1>
        <p className="text-gray-600">
          Purchase and install modules to extend your platform capabilities
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <input
          type="text"
          id="module-search"
          name="moduleSearch"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search modules..."
          aria-label="Search modules"
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          id="module-category"
          name="moduleCategory"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          aria-label="Filter by category"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat === 'All Categories' ? 'all' : cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Bundle Pricing */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Bundle Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bundles.map((bundle) => (
            <div
              key={bundle.name}
              className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {bundle.name}
                </h3>
                <p className="text-sm text-gray-600">{bundle.description}</p>
              </div>
              <div className="mb-4">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {bundle.price}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 font-semibold">
                    {bundle.savings}
                  </span>
                  <span className="text-sm text-gray-500">
                    • {bundle.modules} modules
                  </span>
                </div>
              </div>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Get Bundle
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Modules */}
      {searchQuery === '' && selectedCategory === 'all' && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Featured Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modules.filter(m => m.featured).map((module) => (
              <div
                key={module.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-4xl mb-3">{module.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {module.name}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {module.description}
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center text-yellow-500">
                    {'⭐'.repeat(Math.floor(module.rating))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {module.rating} ({module.reviews})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-gray-900">
                    {module.price}
                  </span>
                  {module.installed ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                      ✓ Installed
                    </span>
                  ) : (
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                      {module.price === 'FREE' ? 'Install' : 'Add to Plan'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Modules */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {selectedCategory === 'all' ? 'All Modules' : selectedCategory}
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {filteredModules.map((module) => (
            <div
              key={module.id}
              className="p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{module.icon}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {module.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {module.description}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-yellow-500">
                          {'⭐'.repeat(Math.floor(module.rating))}
                          <span className="text-sm text-gray-600 ml-1">
                            {module.rating} ({module.reviews} reviews)
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          • {module.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900 mb-2">
                        {module.price}
                      </div>
                      {module.installed ? (
                        <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium cursor-default">
                          ✓ Installed
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                            {module.price === 'FREE' ? 'Install' : 'Add to Plan'}
                          </button>
                          {module.price !== 'FREE' && (
                            <button className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                              Try Free
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              How Modules Work
            </h3>
            <p className="text-sm text-blue-800">
              Modules extend platform functionality. Install them here, then activate
              per-deal from the Create Deal Settings tab. Modules consume data from
              Intelligence Layers (Market Data + Assets Owned) to provide smart insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
