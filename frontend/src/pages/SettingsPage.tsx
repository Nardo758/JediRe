import { useState } from 'react';
import { X, User, Layers, CreditCard, Users, Key, Settings, Check, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type SettingsTab = 'profile' | 'modules' | 'billing' | 'team' | 'api' | 'settings';

interface SettingsPageProps {
  onClose: () => void;
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('modules');
  const { user } = useAuth();

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'modules' as SettingsTab, label: 'Modules', icon: Layers },
    { id: 'billing' as SettingsTab, label: 'Billing', icon: CreditCard },
    { id: 'team' as SettingsTab, label: 'Team', icon: Users },
    { id: 'api' as SettingsTab, label: 'API Access', icon: Key },
    { id: 'settings' as SettingsTab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex overflow-hidden">
        <div className="w-56 bg-gray-50 border-r border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Settings</h2>
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {activeTab === tab.id && <Check className="w-4 h-4 ml-auto" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'modules' && <ModulesPanel />}
            {activeTab === 'profile' && <ProfilePanel user={user} />}
            {activeTab === 'billing' && <BillingPanel />}
            {activeTab === 'team' && <TeamPanel />}
            {activeTab === 'api' && <APIPanel />}
            {activeTab === 'settings' && <SettingsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModulesPanel() {
  const [showAgentConfig, setShowAgentConfig] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Your Active Modules</h4>
        
        <div className="space-y-4">
          <ModuleCard
            name="JEDI CORE"
            description="Base Service"
            price={97}
            isActive
            isCore
            agents={[
              { name: 'Supply Agent', status: 'active' },
              { name: 'Demand Agent', status: 'active' },
              { name: 'Price Agent', status: 'active' },
              { name: 'News Agent', status: 'active' },
              { name: 'Event Agent', status: 'active' },
            ]}
            stats={{ lastUpdated: '2 min ago', status: 'All systems operational' }}
            onConfigure={() => setShowAgentConfig(true)}
          />

          <ModuleCard
            name="SINGLE FAMILY STRATEGY"
            description="Build/Flip/Rental/Airbnb Analysis"
            price={47}
            isActive
            agents={[{ name: 'Strategy Agent', status: 'active' }]}
            stats={{
              propertiesAnalyzed: 1247,
              arbitrageOpps: 23,
              avgROI: '18.4%',
            }}
            onConfigure={() => {}}
            onDeactivate={() => {}}
          />

          <ModuleCard
            name="CASH FLOW OPTIMIZATION"
            description="Rent Gap Analysis & Value-Add ROI"
            price={57}
            isActive
            agents={[{ name: 'Cash Flow Agent', status: 'active' }]}
            stats={{
              optimizations: 67,
              avgNOIIncrease: '$847/mo',
            }}
            onConfigure={() => {}}
            onDeactivate={() => {}}
          />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Available Modules</h4>
        
        <div className="space-y-4">
          <ModuleCard
            name="DEVELOPMENT MODULE"
            description="Land development & entitlement analysis"
            price={67}
            isActive={false}
            onAdd={() => {}}
            onLearnMore={() => {}}
          />

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <h5 className="font-bold text-gray-900 mb-1">BUNDLE RECOMMENDATION</h5>
                <p className="text-sm text-gray-600 mb-3">
                  Add Development Module + Debt Optimization and save 15%!
                </p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-gray-400 line-through">$171/mo</span>
                  <span className="text-xl font-bold text-blue-600">$145/mo</span>
                  <span className="text-sm text-green-600 font-medium">Save $26/month ($312/year)</span>
                </div>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                  View Bundle Details <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Current Monthly Total</div>
          <div className="text-2xl font-bold text-gray-900">$201</div>
          <div className="text-xs text-gray-500">Next billing date: Mar 1, 2026</div>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
            Manage Billing
          </button>
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
            Usage Analytics
          </button>
        </div>
      </div>

      {showAgentConfig && <AgentConfigModal onClose={() => setShowAgentConfig(false)} />}
    </div>
  );
}

interface ModuleCardProps {
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  isCore?: boolean;
  agents?: { name: string; status: string }[];
  stats?: Record<string, string | number>;
  onConfigure?: () => void;
  onDeactivate?: () => void;
  onAdd?: () => void;
  onLearnMore?: () => void;
}

function ModuleCard({ name, description, price, isActive, isCore, agents, stats, onConfigure, onDeactivate, onAdd, onLearnMore }: ModuleCardProps) {
  return (
    <div className={`border rounded-xl p-4 ${isActive ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${isActive ? '✅' : '⭕'}`}>{isActive ? '✅' : '⭕'}</span>
          <div>
            <h5 className="font-bold text-gray-900">{name}</h5>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">${price}</div>
          <div className="text-xs text-gray-500">/month</div>
        </div>
      </div>

      {agents && (
        <div className="mb-3 space-y-1">
          {agents.map((agent) => (
            <div key={agent.name} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-gray-700">{agent.name}</span>
              <span className="text-green-600 text-xs">Active</span>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="text-sm text-gray-600 mb-3 space-y-1">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {isActive && onConfigure && (
          <button
            onClick={onConfigure}
            className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
          >
            {isCore ? 'Configure Agents' : 'Configure'}
          </button>
        )}
        {isActive && !isCore && onDeactivate && (
          <button
            onClick={onDeactivate}
            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
          >
            Deactivate
          </button>
        )}
        {!isActive && onAdd && (
          <button
            onClick={onAdd}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Add Module
          </button>
        )}
        {!isActive && onLearnMore && (
          <button
            onClick={onLearnMore}
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
          >
            Learn More
          </button>
        )}
      </div>
    </div>
  );
}

function AgentConfigModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Configure Supply Agent</h3>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              Save
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Data Sources</h4>
            <div className="space-y-2">
              {[
                { name: 'MLS Data', updated: 'Every 15 min' },
                { name: 'Building Permits', updated: 'Daily' },
                { name: 'Zoning Changes', updated: 'Weekly' },
                { name: 'Construction Pipeline', updated: 'Monthly' },
              ].map((source) => (
                <label key={source.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                    <span className="text-sm text-gray-700">{source.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">Updated: {source.updated}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Update Frequency</h4>
            <div className="flex gap-4">
              {['Hourly', 'Real-time (recommended)', 'Daily'].map((freq, i) => (
                <label key={freq} className="flex items-center gap-2">
                  <input type="radio" name="frequency" defaultChecked={i === 1} className="text-blue-600" />
                  <span className="text-sm text-gray-700">{freq}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Alert Thresholds</h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Low Supply Alert when:</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>&lt; 3 months of inventory</option>
                  <option>&lt; 2 months of inventory</option>
                  <option>&lt; 4 months of inventory</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Pipeline Changes Alert when:</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option>&gt; 20% change in 30 days</option>
                  <option>&gt; 15% change in 30 days</option>
                  <option>&gt; 25% change in 30 days</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Advanced Settings</h4>
            <div className="space-y-2">
              {['5-Year Pipeline Forecasting', 'Seasonal Adjustments', 'Market Comparisons'].map((setting) => (
                <label key={setting} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{setting}</span>
                  <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePanel({ user }: { user: any }) {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
          {user?.name?.charAt(0) || 'U'}
        </div>
        <div>
          <h4 className="font-bold text-gray-900">{user?.name || 'User'}</h4>
          <p className="text-sm text-gray-500">{user?.email || 'user@example.com'}</p>
          <button className="text-sm text-blue-600 hover:text-blue-700 mt-1">Change photo</button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input type="text" defaultValue={user?.name} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" defaultValue={user?.email} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="tel" placeholder="+1 (555) 000-0000" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          Save Changes
        </button>
      </div>
    </div>
  );
}

function BillingPanel() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-80">Current Plan</div>
            <div className="text-2xl font-bold">Jedi Pro Bundle</div>
            <div className="text-sm opacity-80 mt-1">$201/month</div>
          </div>
          <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium">
            Upgrade Plan
          </button>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Payment Method</h4>
        <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
          <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
            VISA
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">•••• •••• •••• 4242</div>
            <div className="text-sm text-gray-500">Expires 12/2027</div>
          </div>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Edit</button>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Billing History</h4>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {[
            { date: 'Feb 1, 2026', amount: '$201.00', status: 'Paid' },
            { date: 'Jan 1, 2026', amount: '$201.00', status: 'Paid' },
            { date: 'Dec 1, 2025', amount: '$154.00', status: 'Paid' },
          ].map((invoice, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
              <div className="text-sm text-gray-900">{invoice.date}</div>
              <div className="text-sm font-medium text-gray-900">{invoice.amount}</div>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                {invoice.status}
              </span>
              <button className="text-blue-600 hover:text-blue-700 text-sm">Download</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamPanel() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Team Members</h4>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          Invite Member
        </button>
      </div>

      <div className="space-y-3">
        {[
          { name: 'John Smith', email: 'john@company.com', role: 'Owner' },
          { name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Admin' },
          { name: 'Mike Chen', email: 'mike@company.com', role: 'Member' },
        ].map((member, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
              {member.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{member.name}</div>
              <div className="text-sm text-gray-500">{member.email}</div>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              member.role === 'Owner' ? 'bg-purple-100 text-purple-700' :
              member.role === 'Admin' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {member.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function APIPanel() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div>
          <div className="font-medium text-yellow-800">API Access</div>
          <div className="text-sm text-yellow-700">Keep your API keys secure. Never share them publicly.</div>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">API Keys</h4>
        <div className="space-y-3">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">Production Key</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Active</span>
            </div>
            <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">sk_live_••••••••••••••••</code>
            <div className="flex gap-2 mt-3">
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Reveal</button>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Regenerate</button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Usage</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">12,450</div>
            <div className="text-sm text-gray-500">API Calls (This Month)</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">50,000</div>
            <div className="text-sm text-gray-500">Monthly Limit</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">75%</div>
            <div className="text-sm text-gray-500">Remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Notifications</h4>
        <div className="space-y-3">
          {[
            { label: 'Email notifications for new opportunities', checked: true },
            { label: 'Push notifications for price changes', checked: true },
            { label: 'Weekly market summary emails', checked: false },
            { label: 'Team activity notifications', checked: true },
          ].map((setting, i) => (
            <label key={i} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-700">{setting.label}</span>
              <input type="checkbox" defaultChecked={setting.checked} className="rounded text-blue-600" />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Display</h4>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Default Map View</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option>Satellite</option>
              <option>Streets</option>
              <option>Hybrid</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Currency</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option>USD ($)</option>
              <option>EUR (€)</option>
              <option>GBP (£)</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Data & Privacy</h4>
        <div className="space-y-2">
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Download my data</button>
          <button className="text-red-600 hover:text-red-700 text-sm font-medium block">Delete account</button>
        </div>
      </div>
    </div>
  );
}
