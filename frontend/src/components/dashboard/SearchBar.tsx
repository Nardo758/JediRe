import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { propertyAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { debounce } from '@/utils';
import { BT } from '@/components/deal/bloomberg-ui';

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
  }, [query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color: BT.text.muted }}
        />
        <input
          id="dashboard-search"
          name="dashboardSearch"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address or city..."
          aria-label="Search address or city"
          className="w-full pl-10 pr-4 py-2.5 transition-all focus:outline-none"
          style={{
            background: BT.bg.input,
            border: `1px solid ${BT.border.subtle}`,
            borderRadius: 0,
            color: BT.text.primary,
            fontFamily: BT.font.mono,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = BT.text.cyan)}
          onBlur={(e) => (e.currentTarget.style.borderColor = BT.border.subtle)}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div
              className="w-5 h-5 border-2 border-t-transparent animate-spin"
              style={{ borderColor: BT.text.cyan, borderTopColor: 'transparent', borderRadius: '50%' }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}
