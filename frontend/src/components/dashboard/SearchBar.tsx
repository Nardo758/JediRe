import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { propertyAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { debounce } from '@/utils';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { setProperties, setIsLoading, setMapCenter } = useAppStore();

  const performSearch = debounce(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    setIsLoading(true);

    try {
      const result = await propertyAPI.search(searchQuery);
      setProperties(result.properties);
      
      // Center map on first result if available
      if (result.properties.length > 0) {
        const first = result.properties[0];
        setMapCenter([first.coordinates.lng, first.coordinates.lat]);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  }, 500);

  useEffect(() => {
    performSearch(query);
  }, [query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address or city..."
          aria-label="Search address or city"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}
