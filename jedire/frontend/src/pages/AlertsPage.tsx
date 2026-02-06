import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Bell, Plus, Trash2, Edit2, MapPin, DollarSign, Home, TrendingUp, CheckCircle, X } from 'lucide-react';

interface Alert {
  id: string;
  name: string;
  type: string;
  criteria: string;
  status: 'active' | 'paused';
  matches: number;
  lastTriggered: string;
}

const initialAlerts: Alert[] = [
  { id: '1', name: 'Austin MF Under $500k', type: 'Price Drop', criteria: 'Austin, TX • Multi-Family • < $500,000', status: 'active', matches: 12, lastTriggered: '2 hours ago' },
  { id: '2', name: 'High ROI Opportunities', type: 'Score', criteria: 'Any Market • Score > 85 • ROI > 15%', status: 'active', matches: 5, lastTriggered: '1 day ago' },
  { id: '3', name: 'Airbnb Potential', type: 'Strategy', criteria: 'Austin, TX • Airbnb Score > 80', status: 'paused', matches: 0, lastTriggered: 'Never' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [showCreate, setShowCreate] = useState(false);

  const toggleStatus = (id: string) => {
    setAlerts(alerts.map(a => 
      a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a
    ));
  };

  const deleteAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/app" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Bell className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Alerts & Watchlists</span>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Create Alert
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {alerts.map(alert => (
            <div key={alert.id} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    alert.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{alert.name}</h3>
                    <p className="text-sm text-gray-500">{alert.criteria}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(alert.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      alert.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {alert.status === 'active' ? 'Active' : 'Paused'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-500">
                    <span className="font-medium text-gray-900">{alert.matches}</span> matches
                  </span>
                  <span className="text-gray-500">
                    Last triggered: <span className="text-gray-700">{alert.lastTriggered}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteAlert(alert.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {alerts.length === 0 && (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts yet</h3>
            <p className="text-gray-500 mb-6">Create your first alert to get notified about new opportunities.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Create Alert
            </button>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Create New Alert</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alert Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Austin Under $400k"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option>New Listing</option>
                    <option>Price Drop</option>
                    <option>Score Change</option>
                    <option>Market Alert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option>Austin, TX</option>
                    <option>Dallas, TX</option>
                    <option>Houston, TX</option>
                    <option>San Antonio, TX</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Price</label>
                    <input
                      type="number"
                      placeholder="$0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
                    <input
                      type="number"
                      placeholder="$500,000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Score</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="70"
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Create Alert
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
