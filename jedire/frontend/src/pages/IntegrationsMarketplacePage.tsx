import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Puzzle, Search, Star, Download, ChevronRight, Zap, Shield, Clock } from 'lucide-react';

interface AppIntegration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rating: number;
  installs: string;
  free: boolean;
  featured?: boolean;
  builtBy: string;
}

const apps: AppIntegration[] = [
  { id: '1', name: 'Zapier', description: 'Connect JediRe to 5,000+ apps with automated workflows', category: 'Automation', icon: '⚡', rating: 4.9, installs: '10K+', free: true, featured: true, builtBy: 'Zapier' },
  { id: '2', name: 'Google Sheets', description: 'Sync property data automatically to spreadsheets', category: 'Productivity', icon: '📊', rating: 4.8, installs: '8K+', free: true, featured: true, builtBy: 'JediRe' },
  { id: '3', name: 'QuickBooks', description: 'Sync financials and track investment expenses', category: 'Accounting', icon: '💰', rating: 4.7, installs: '5K+', free: false, builtBy: 'Intuit' },
  { id: '4', name: 'Slack', description: 'Get real-time alerts and updates in Slack', category: 'Communication', icon: '💬', rating: 4.8, installs: '7K+', free: true, builtBy: 'JediRe' },
  { id: '5', name: 'Salesforce', description: 'CRM integration for deal management', category: 'CRM', icon: '☁️', rating: 4.6, installs: '3K+', free: false, builtBy: 'Salesforce' },
  { id: '6', name: 'DocuSign', description: 'E-signatures for offers and contracts', category: 'Documents', icon: '✍️', rating: 4.7, installs: '4K+', free: false, builtBy: 'DocuSign' },
  { id: '7', name: 'Airtable', description: 'Custom databases and property tracking', category: 'Productivity', icon: '📋', rating: 4.5, installs: '2K+', free: true, builtBy: 'Airtable' },
  { id: '8', name: 'Webhooks', description: 'Custom integrations via webhooks', category: 'Developer', icon: '🔗', rating: 4.4, installs: '1K+', free: true, builtBy: 'JediRe' },
];

const categories = ['All', 'Featured', 'Automation', 'Productivity', 'Accounting', 'CRM', 'Communication', 'Developer'];

export default function IntegrationsMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredApps = apps.filter(app => {
    const matchesCategory = selectedCategory === 'All' || 
      (selectedCategory === 'Featured' ? app.featured : app.category === selectedCategory);
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Puzzle className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Integrations Marketplace</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Extend JediRe with Integrations</h1>
          <p className="text-gray-600">Connect your favorite tools and automate your workflow</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              id="marketplace-search"
              name="marketplaceSearch"
              aria-label="Search integrations"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map(app => (
            <div key={app.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-4xl">{app.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{app.name}</h3>
                    {app.featured && <Zap className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <p className="text-sm text-gray-500">by {app.builtBy}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">{app.description}</p>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="font-medium text-gray-900">{app.rating}</span>
                </div>
                <span className="text-sm text-gray-500">{app.installs} installs</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  app.free ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {app.free ? 'Free' : 'Premium'}
                </span>
              </div>
              <button className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                <Download className="w-4 h-4" /> Install
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Build Your Own Integration</h2>
          <p className="text-white/80 mb-6">Use our API to create custom integrations for your workflow</p>
          <Link to="/docs" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg font-medium">
            View API Docs <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
