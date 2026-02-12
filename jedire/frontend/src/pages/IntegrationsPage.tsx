import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Plug, Check, ExternalLink, Settings, X, Zap } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  connected: boolean;
  popular?: boolean;
}

const integrations: Integration[] = [
  { id: '1', name: 'Google Sheets', description: 'Sync property data to spreadsheets', category: 'Productivity', icon: '📊', connected: true },
  { id: '2', name: 'QuickBooks', description: 'Sync financials and expenses', category: 'Accounting', icon: '💰', connected: true },
  { id: '3', name: 'Salesforce', description: 'CRM integration for deals', category: 'CRM', icon: '☁️', connected: false, popular: true },
  { id: '4', name: 'Zapier', description: 'Connect to 5,000+ apps', category: 'Automation', icon: '⚡', connected: false, popular: true },
  { id: '5', name: 'Slack', description: 'Get alerts in Slack channels', category: 'Communication', icon: '💬', connected: false },
  { id: '6', name: 'HubSpot', description: 'Marketing and CRM tools', category: 'CRM', icon: '🟠', connected: false },
  { id: '7', name: 'Airtable', description: 'Database and spreadsheet hybrid', category: 'Productivity', icon: '📋', connected: false },
  { id: '8', name: 'Notion', description: 'Notes and documentation', category: 'Productivity', icon: '📝', connected: false },
  { id: '9', name: 'Xero', description: 'Accounting software', category: 'Accounting', icon: '📒', connected: false },
  { id: '10', name: 'Monday.com', description: 'Project management', category: 'Productivity', icon: '📅', connected: false },
];

const categories = ['All', 'Productivity', 'Accounting', 'CRM', 'Automation', 'Communication'];

export default function IntegrationsPage() {
  const [items, setItems] = useState<Integration[]>(integrations);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIntegrations = items.filter(i => {
    const matchesCategory = selectedCategory === 'All' || i.category === selectedCategory;
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleConnection = (id: string) => {
    setItems(items.map(i => 
      i.id === id ? { ...i, connected: !i.connected } : i
    ));
  };

  const connectedCount = items.filter(i => i.connected).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/settings" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Plug className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Integrations</span>
              </div>
            </div>
            <span className="text-sm text-gray-500">{connectedCount} connected</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <input
            type="text"
            id="integrations-search"
            name="integrationsSearch"
            aria-label="Search integrations"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {connectedCount > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.filter(i => i.connected).map(integration => (
                <div key={integration.id} className="bg-white rounded-xl p-4 border border-green-200 relative">
                  <div className="absolute top-3 right-3">
                    <span className="w-2 h-2 bg-green-500 rounded-full block" />
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{integration.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                      <p className="text-sm text-gray-500 mb-3">{integration.description}</p>
                      <div className="flex gap-2">
                        <button className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm">
                          <Settings className="w-3 h-3" /> Settings
                        </button>
                        <button 
                          onClick={() => toggleConnection(integration.id)}
                          className="flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                        >
                          <X className="w-3 h-3" /> Disconnect
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Integrations</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegrations.filter(i => !i.connected).map(integration => (
              <div key={integration.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{integration.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                      {integration.popular && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Popular
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{integration.description}</p>
                    <button 
                      onClick={() => toggleConnection(integration.id)}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                    >
                      <Plug className="w-3 h-3" /> Connect
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredIntegrations.filter(i => !i.connected).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No integrations found matching your search.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
