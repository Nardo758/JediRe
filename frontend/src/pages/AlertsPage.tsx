import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Bell, Plus, Trash2, Edit2, MapPin, DollarSign, Home, TrendingUp, CheckCircle, X } from 'lucide-react';
import { BT } from '../components/deal/bloomberg-ui';

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
    <div className="min-h-screen" style={{ background: BT.bg.terminal }}>
      <header className="sticky top-0 z-10" style={{ background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/app" style={{ color: BT.text.muted }}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Bell className="w-8 h-8" style={{ color: BT.text.cyan }} />
                <span className="text-xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>Alerts & Watchlists</span>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
              style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
            >
              <Plus className="w-4 h-4" /> Create Alert
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {alerts.map(alert => (
            <div key={alert.id} className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 flex items-center justify-center"
                    style={{
                      borderRadius: 2,
                      background: alert.status === 'active' ? BT.bg.active : BT.bg.hover,
                      color: alert.status === 'active' ? BT.text.green : BT.text.muted,
                    }}
                  >
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ color: BT.text.primary }}>{alert.name}</h3>
                    <p className="text-sm" style={{ color: BT.text.secondary }}>{alert.criteria}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(alert.id)}
                    className="px-3 py-1 text-xs font-medium"
                    style={{
                      borderRadius: 2,
                      background: alert.status === 'active' ? BT.bg.active : BT.bg.hover,
                      color: alert.status === 'active' ? BT.text.green : BT.text.secondary,
                    }}
                  >
                    {alert.status === 'active' ? 'Active' : 'Paused'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                <div className="flex items-center gap-6 text-sm">
                  <span style={{ color: BT.text.secondary }}>
                    <span className="font-medium" style={{ color: BT.text.primary }}>{alert.matches}</span> matches
                  </span>
                  <span style={{ color: BT.text.secondary }}>
                    Last triggered: <span style={{ color: BT.text.primary }}>{alert.lastTriggered}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2" style={{ color: BT.text.muted, borderRadius: 2 }}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-2"
                    style={{ color: BT.text.muted, borderRadius: 2 }}
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
            <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: BT.text.muted }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: BT.text.primary }}>No alerts yet</h3>
            <p className="mb-6" style={{ color: BT.text.secondary }}>Create your first alert to get notified about new opportunities.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 font-medium"
              style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
            >
              Create Alert
            </button>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-lg" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <h3 className="font-semibold" style={{ color: BT.text.primary }}>Create New Alert</h3>
                <button onClick={() => setShowCreate(false)} style={{ color: BT.text.muted }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: BT.text.secondary }}>Alert Name</label>
                  <input
                    id="alert-name"
                    name="alertName"
                    type="text"
                    placeholder="e.g., Austin Under $400k"
                    aria-label="Alert name"
                    className="w-full px-4 py-2"
                    style={{ background: BT.bg.input, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, outline: 'none' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: BT.text.secondary }}>Alert Type</label>
                  <select
                    id="alert-type"
                    name="alertType"
                    aria-label="Alert type"
                    className="w-full px-4 py-2"
                    style={{ background: BT.bg.input, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}
                  >
                    <option>New Listing</option>
                    <option>Price Drop</option>
                    <option>Score Change</option>
                    <option>Market Alert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: BT.text.secondary }}>Market</label>
                  <select
                    id="alert-market"
                    name="alertMarket"
                    aria-label="Market"
                    className="w-full px-4 py-2"
                    style={{ background: BT.bg.input, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}
                  >
                    <option>Austin, TX</option>
                    <option>Dallas, TX</option>
                    <option>Houston, TX</option>
                    <option>San Antonio, TX</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: BT.text.secondary }}>Min Price</label>
                    <input
                      id="alert-min-price"
                      name="alertMinPrice"
                      type="number"
                      placeholder="$0"
                      aria-label="Minimum price"
                      className="w-full px-4 py-2"
                      style={{ background: BT.bg.input, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: BT.text.secondary }}>Max Price</label>
                    <input
                      id="alert-max-price"
                      name="alertMaxPrice"
                      type="number"
                      placeholder="$500,000"
                      aria-label="Maximum price"
                      className="w-full px-4 py-2"
                      style={{ background: BT.bg.input, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, outline: 'none' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: BT.text.secondary }}>Minimum Score</label>
                  <input
                    id="alert-min-score"
                    name="alertMinScore"
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="70"
                    aria-label="Minimum score"
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs" style={{ color: BT.text.secondary }}>
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2"
                  style={{ border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, borderRadius: 2, background: 'transparent' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 font-medium"
                  style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
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
