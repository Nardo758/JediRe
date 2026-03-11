import { Map, List, Star, Settings } from 'lucide-react';

export type MobileTab = 'map' | 'list' | 'saved' | 'settings';

interface MobileNavigationProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileNavigation({ activeTab, onTabChange }: MobileNavigationProps) {
  const tabs = [
    { id: 'map' as MobileTab, label: 'Map', icon: Map, emoji: '🗺️' },
    { id: 'list' as MobileTab, label: 'List', icon: List, emoji: '📋' },
    { id: 'saved' as MobileTab, label: 'Saved', icon: Star, emoji: '⭐' },
    { id: 'settings' as MobileTab, label: 'Settings', icon: Settings, emoji: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-lg mb-0.5">{tab.emoji}</span>
            <span className="text-xs font-medium">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 w-12 h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
