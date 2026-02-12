import React from 'react';
import { useNavigate } from 'react-router-dom';

export function DashboardContentsPage() {
  const navigate = useNavigate();

  const sections = [
    { icon: '📊', label: 'Dashboard', path: '/dashboard', description: 'Portfolio overview and key metrics' },
    { icon: '📧', label: 'Email', path: '/dashboard/email', description: 'Synced email inbox with deal linking' },
    { icon: '📊', label: 'Pipeline', path: '/deals', description: 'Deal tracking grid with stages and scores' },
    { icon: '🏢', label: 'Assets Owned', path: '/assets-owned', description: 'Owned asset performance tracking' },
    { icon: '📈', label: 'Market Data', path: '/market-data', description: 'Market trends, comps, and demographics' },
    { icon: '📰', label: 'News Intel', path: '/news-intel', description: 'Real-time news intelligence and alerts' },
    { icon: '📈', label: 'Reports', path: '/reports', description: 'Portfolio and deal reports' },
    { icon: '👥', label: 'Team', path: '/team', description: 'Team management and collaboration' },
    { icon: '⚙️', label: 'Settings', path: '/settings', description: 'Account and platform settings' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contents</h1>
        <p className="text-sm text-gray-600 mt-1">Quick navigation to all platform sections</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <button
            key={section.path}
            onClick={() => navigate(section.path)}
            className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:shadow-md hover:border-blue-300 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{section.icon}</span>
              <span className="font-semibold text-gray-900 group-hover:text-blue-600">{section.label}</span>
            </div>
            <p className="text-sm text-gray-600">{section.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default DashboardContentsPage;
