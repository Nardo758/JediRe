import React, { useState } from 'react';
import { useDesignDashboardStore } from '../../../stores/DesignDashboardStore';
import { 
  Search, 
  FileText, 
  TrendingUp, 
  Newspaper, 
  Users,
  ExternalLink,
  Trash2,
  Plus,
  RefreshCw
} from 'lucide-react';

const typeIcons = {
  permit: FileText,
  market: TrendingUp,
  news: Newspaper,
  demographic: Users,
};

const typeColors = {
  permit: 'text-orange-600',
  market: 'text-blue-600',
  news: 'text-purple-600',
  demographic: 'text-green-600',
};

export const ResearchPanel: React.FC = () => {
  const {
    researchItems,
    addResearchItem,
    removeResearchItem,
  } = useDesignDashboardStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'permit' | 'market' | 'news' | 'demographic'>('all');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    // Simulate API search
    setTimeout(() => {
      // Add mock search results
      const mockResults = [
        {
          id: Date.now().toString(),
          type: 'permit' as const,
          title: `Building permits for ${searchQuery}`,
          content: 'Recent building permit activity shows 5 new multifamily projects approved...',
          date: new Date(),
          source: 'City Planning Dept',
          url: 'https://example.com/permits',
        },
        {
          id: (Date.now() + 1).toString(),
          type: 'market' as const,
          title: `Market trends in ${searchQuery} area`,
          content: 'Rental rates have increased 3.5% YoY with vacancy at historic lows...',
          date: new Date(),
          source: 'CoStar Analytics',
          url: 'https://example.com/market',
        },
      ];
      
      mockResults.forEach(result => addResearchItem(result));
      setIsSearching(false);
    }, 1500);
  };

  const filteredItems = researchItems.filter(item => 
    activeTab === 'all' || item.type === activeTab
  );

  const itemCounts = researchItems.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <div className="p-4 border-b">
        <div className="relative">
          <input
            type="text"
            placeholder="Search permits, market data, news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-10 py-2 text-sm border rounded-lg"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="absolute right-2 top-1.5 p-1 text-blue-600 hover:text-blue-700 disabled:text-gray-400"
          >
            {isSearching ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Quick Search Suggestions */}
        <div className="mt-2 flex flex-wrap gap-1">
          {['nearby permits', 'market trends', 'zoning changes', 'demographic shifts'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setSearchQuery(suggestion);
                handleSearch();
              }}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-gray-50">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          All ({researchItems.length})
        </button>
        {(['permit', 'market', 'news', 'demographic'] as const).map((type) => {
          const Icon = typeIcons[type];
          const count = itemCounts[type] || 0;
          return (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === type
                  ? `${typeColors[type]} border-current`
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline capitalize">{type}</span>
              <span>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Research Items */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No research items found</p>
            <p className="text-xs mt-1">Try searching for permits, market data, or news</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredItems.map((item) => {
              const Icon = typeIcons[item.type];
              return (
                <div key={item.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-2 flex-1">
                      <Icon className={`w-5 h-5 mt-0.5 ${typeColors[item.type]}`} />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-1">{item.title}</h4>
                        <p className="text-xs text-gray-600 line-clamp-2">{item.content}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeResearchItem(item.id)}
                      className="p-1 text-red-600 hover:text-red-700 ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{new Date(item.date).toLocaleDateString()}</span>
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Data Sources */}
      <div className="p-4 border-t bg-gray-50">
        <h4 className="text-sm font-medium mb-2">Data Sources</h4>
        <div className="grid grid-cols-2 gap-2">
          <button className="px-3 py-2 text-xs bg-white border rounded hover:bg-gray-50">
            CoStar Data
          </button>
          <button className="px-3 py-2 text-xs bg-white border rounded hover:bg-gray-50">
            City Permits
          </button>
          <button className="px-3 py-2 text-xs bg-white border rounded hover:bg-gray-50">
            Census/ACS
          </button>
          <button className="px-3 py-2 text-xs bg-white border rounded hover:bg-gray-50">
            News Feeds
          </button>
        </div>
      </div>
    </div>
  );
};