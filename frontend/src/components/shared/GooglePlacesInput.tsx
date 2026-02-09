import React, { useEffect, useRef, useState, useCallback } from 'react';

interface GooglePlacesInputProps {
  value: string;
  onChange: (value: string, coordinates?: [number, number]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}

interface MapboxFeature {
  place_name: string;
  center: [number, number];
}

export const GooglePlacesInput: React.FC<GooglePlacesInputProps> = ({
  value,
  onChange,
  placeholder = 'Enter property address',
  className = '',
  id = 'google-places-input',
  name = 'address',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3 || !mapboxToken) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=us&types=address&limit=5&autocomplete=true`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        setSuggestions(data.features);
        setShowDropdown(true);
        setHighlightedIndex(-1);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error('[AddressInput] Geocoding error:', err);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, [mapboxToken]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (feature: MapboxFeature) => {
    const [lng, lat] = feature.center;
    onChange(feature.place_name, [lng, lat]);
    setSuggestions([]);
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        placeholder={placeholder}
        aria-label="Property address"
        autoComplete="off"
        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
      />
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((feature, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(feature)}
              className={`w-full text-left px-4 py-3 text-sm transition ${
                idx === highlightedIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'text-gray-700 hover:bg-gray-50'
              } ${idx < suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{feature.place_name}</span>
              </div>
            </button>
          ))}
          <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 rounded-b-lg">
            Powered by Mapbox
          </div>
        </div>
      )}
    </div>
  );
};
