import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Sparkles, Zap, Bug, Shield, ChevronRight } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  type: 'major' | 'minor' | 'patch';
  changes: { type: 'new' | 'improved' | 'fixed' | 'security'; text: string }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '2.5.0',
    date: 'Jan 28, 2026',
    title: 'Multi-Agent Analysis',
    type: 'major',
    changes: [
      { type: 'new', text: 'Multi-agent analysis with 6 specialized AI agents' },
      { type: 'new', text: 'Agent confidence indicators on property cards' },
      { type: 'improved', text: 'Faster property loading with lazy loading' },
      { type: 'fixed', text: 'Fixed score calculation edge cases' },
    ]
  },
  {
    version: '2.4.2',
    date: 'Jan 20, 2026',
    title: 'Performance & Security',
    type: 'patch',
    changes: [
      { type: 'improved', text: 'Map rendering performance improved by 40%' },
      { type: 'security', text: 'Updated authentication tokens for better security' },
      { type: 'fixed', text: 'Fixed mobile navigation menu on iOS' },
    ]
  },
  {
    version: '2.4.0',
    date: 'Jan 10, 2026',
    title: 'Zoning Intelligence',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Zoning lookup by address' },
      { type: 'new', text: 'Development potential calculator' },
      { type: 'new', text: 'Property analyzer sidebar' },
      { type: 'improved', text: 'Geocoding accuracy improvements' },
    ]
  },
  {
    version: '2.3.0',
    date: 'Dec 15, 2025',
    title: 'Strategy Arbitrage',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Strategy comparison cards (Build-to-Sell, Flip, Rental, Airbnb)' },
      { type: 'new', text: 'Arbitrage opportunity indicators' },
      { type: 'improved', text: 'ROI calculation methodology' },
    ]
  },
  {
    version: '2.2.0',
    date: 'Nov 20, 2025',
    title: 'Team Collaboration',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Real-time collaboration with team members' },
      { type: 'new', text: 'Cursor tracking and annotations' },
      { type: 'new', text: 'Team management dashboard' },
      { type: 'fixed', text: 'WebSocket connection stability improvements' },
    ]
  },
];

const getChangeIcon = (type: string) => {
  switch (type) {
    case 'new': return <Sparkles className="w-4 h-4 text-green-500" />;
    case 'improved': return <Zap className="w-4 h-4 text-blue-500" />;
    case 'fixed': return <Bug className="w-4 h-4 text-yellow-500" />;
    case 'security': return <Shield className="w-4 h-4 text-red-500" />;
    default: return null;
  }
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Changelog</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">What's New in JediRe</h1>
          <p className="text-gray-600">Keep up with the latest features and improvements</p>
        </div>

        <div className="space-y-8">
          {changelog.map((entry, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    entry.type === 'major' ? 'bg-purple-100 text-purple-700' :
                    entry.type === 'minor' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    v{entry.version}
                  </span>
                  <h3 className="font-semibold text-gray-900">{entry.title}</h3>
                </div>
                <span className="text-sm text-gray-500">{entry.date}</span>
              </div>
              <div className="px-6 py-4">
                <ul className="space-y-3">
                  {entry.changes.map((change, j) => (
                    <li key={j} className="flex items-start gap-3">
                      {getChangeIcon(change.type)}
                      <span className="text-gray-700">{change.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link to="/docs" className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1">
            View full documentation <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
