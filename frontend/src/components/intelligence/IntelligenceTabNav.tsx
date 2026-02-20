/**
 * Intelligence Section Tab Navigation
 * Shared navigation component for all Intelligence pages
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Search, Newspaper } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  matchPaths: string[]; // Multiple paths that should highlight this tab
}

const tabs: Tab[] = [
  {
    id: 'market-data',
    label: 'Market Data',
    icon: <TrendingUp className="w-4 h-4" />,
    path: '/market-data',
    matchPaths: ['/market-data']
  },
  {
    id: 'market-research',
    label: 'Market Research',
    icon: <Search className="w-4 h-4" />,
    path: '/market-research',
    matchPaths: ['/market-research', '/market-research/active-owners', '/market-research/future-supply']
  },
  {
    id: 'news-intel',
    label: 'News Intel',
    icon: <Newspaper className="w-4 h-4" />,
    path: '/news-intel',
    matchPaths: ['/news-intel', '/news-intel/dashboard', '/news-intel/network', '/news-intel/alerts']
  }
];

export const IntelligenceTabNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActiveTab = (tab: Tab): boolean => {
    return tab.matchPaths.some(path => location.pathname.startsWith(path));
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Tabs */}
        <nav className="hidden md:flex -mb-px space-x-8" aria-label="Intelligence Navigation">
          {tabs.map((tab) => {
            const isActive = isActiveTab(tab);
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`
                  group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className={isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile Dropdown */}
        <div className="md:hidden py-3">
          <select
            value={tabs.find(tab => isActiveTab(tab))?.path || tabs[0].path}
            onChange={(e) => navigate(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.path}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceTabNav;
