import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, CheckCircle, AlertCircle, XCircle, 
  Bell, Calendar, Clock, ChevronDown, ChevronUp
} from 'lucide-react';

type StatusType = 'operational' | 'degraded' | 'outage' | 'maintenance';

interface Component {
  name: string;
  status: StatusType;
  uptime: string;
}

interface Incident {
  id: string;
  title: string;
  status: 'resolved' | 'investigating' | 'identified' | 'monitoring';
  date: string;
  updates: { time: string; message: string }[];
}

interface Maintenance {
  id: string;
  title: string;
  scheduled: string;
  duration: string;
  components: string[];
}

const components: Component[] = [
  { name: 'API', status: 'operational', uptime: '99.99%' },
  { name: 'Web Application', status: 'operational', uptime: '99.98%' },
  { name: 'Mobile App', status: 'operational', uptime: '99.95%' },
  { name: 'Database', status: 'operational', uptime: '99.99%' },
  { name: 'AI Agents', status: 'operational', uptime: '99.90%' },
  { name: 'Webhooks', status: 'operational', uptime: '99.97%' },
  { name: 'Authentication', status: 'operational', uptime: '99.99%' },
  { name: 'CDN', status: 'operational', uptime: '100%' },
];

const incidents: Incident[] = [
  {
    id: '1',
    title: 'Elevated API Latency',
    status: 'resolved',
    date: 'Jan 25, 2026',
    updates: [
      { time: '14:30 UTC', message: 'Issue resolved. All systems operating normally.' },
      { time: '14:00 UTC', message: 'Fix deployed. Monitoring for stability.' },
      { time: '13:30 UTC', message: 'Root cause identified as database connection pool exhaustion.' },
      { time: '13:00 UTC', message: 'Investigating reports of slow API responses.' },
    ]
  },
  {
    id: '2',
    title: 'Mobile App Login Issues',
    status: 'resolved',
    date: 'Jan 18, 2026',
    updates: [
      { time: '10:00 UTC', message: 'Issue resolved. Auth service restored.' },
      { time: '09:30 UTC', message: 'Deploying fix to authentication service.' },
      { time: '09:00 UTC', message: 'Investigating login failures on mobile app.' },
    ]
  },
];

const scheduledMaintenance: Maintenance[] = [
  {
    id: '1',
    title: 'Database Infrastructure Upgrade',
    scheduled: 'Feb 8, 2026 02:00-04:00 UTC',
    duration: '2 hours',
    components: ['Database', 'API']
  }
];

const statusConfig: Record<StatusType, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  operational: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-5 h-5" />, label: 'Operational' },
  degraded: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <AlertCircle className="w-5 h-5" />, label: 'Degraded' },
  outage: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-5 h-5" />, label: 'Outage' },
  maintenance: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Clock className="w-5 h-5" />, label: 'Maintenance' },
};

function getOverallStatus(components: Component[]): StatusType {
  if (components.some(c => c.status === 'outage')) return 'outage';
  if (components.some(c => c.status === 'degraded')) return 'degraded';
  if (components.some(c => c.status === 'maintenance')) return 'maintenance';
  return 'operational';
}

export default function StatusPage() {
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const overallStatus = getOverallStatus(components);
  const overall = statusConfig[overallStatus];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe Status</span>
            </Link>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Bell className="w-4 h-4" />
              Subscribe to Updates
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`${overall.bg} rounded-2xl p-8 mb-8 text-center`}>
          <div className={`w-16 h-16 ${overall.bg} rounded-full flex items-center justify-center mx-auto mb-4 ${overall.color}`}>
            {overall.icon}
          </div>
          <h1 className={`text-2xl font-bold ${overall.color}`}>
            {overallStatus === 'operational' ? 'All Systems Operational' : overall.label}
          </h1>
          <p className="text-gray-600 mt-2">
            Last updated: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
          </p>
        </div>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">System Components</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
            {components.map((component, i) => {
              const config = statusConfig[component.status];
              return (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={config.color}>{config.icon}</span>
                    <span className="font-medium text-gray-900">{component.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{component.uptime} uptime</span>
                    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Uptime Statistics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { period: '24 hours', value: '100%' },
              { period: '7 days', value: '99.99%' },
              { period: '30 days', value: '99.97%' },
              { period: '90 days', value: '99.95%' },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 text-center">
                <div className="text-2xl font-bold text-green-600">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.period}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            Scheduled Maintenance
          </h2>
          {scheduledMaintenance.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200">
              {scheduledMaintenance.map((maint, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{maint.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{maint.scheduled}</p>
                      <p className="text-sm text-gray-500">Duration: {maint.duration}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {maint.components.map((comp, j) => (
                          <span key={j} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">{comp}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">
              No scheduled maintenance
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Incident History</h2>
          <div className="space-y-4">
            {incidents.map((incident) => (
              <div key={incident.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedIncident(expandedIncident === incident.id ? null : incident.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        incident.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {incident.status}
                      </span>
                      <h3 className="font-medium text-gray-900">{incident.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{incident.date}</p>
                  </div>
                  {expandedIncident === incident.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedIncident === incident.id && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="space-y-3">
                      {incident.updates.map((update, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-sm text-gray-500 w-20 flex-shrink-0">{update.time}</span>
                          <p className="text-sm text-gray-700">{update.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Status API</h2>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-gray-600 mb-4">
              Programmatically check system status via our Status API.
            </p>
            <div className="bg-gray-900 text-gray-100 rounded-lg p-3 font-mono text-sm">
              GET https://status.jedire.com/api/v1/status
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Returns current status of all components in JSON format.
            </p>
          </div>
        </section>

        <section className="bg-blue-50 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Stay Informed</h2>
          <p className="text-gray-600 mb-4">
            Get notified about incidents and maintenance via email or Slack.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              Subscribe to Email
            </button>
            <button className="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium text-gray-700">
              Add to Slack
            </button>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t border-gray-200 mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-gray-900">JediRe</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <Link to="/" className="hover:text-gray-900">Home</Link>
              <Link to="/help" className="hover:text-gray-900">Help Center</Link>
              <Link to="/contact" className="hover:text-gray-900">Contact</Link>
            </div>
            <p className="text-sm text-gray-500">© 2026 JediRe</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
