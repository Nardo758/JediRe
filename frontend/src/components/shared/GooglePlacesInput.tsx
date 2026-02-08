import React, { useEffect, useRef, useState } from 'react';

interface GooglePlacesInputProps {
  value: string;
  onChange: (value: string, coordinates?: [number, number]) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}

/**
 * Address input with Google Places Autocomplete
 * Provides instant address suggestions and geocoding
 */
export const GooglePlacesInput: React.FC<GooglePlacesInputProps> = ({
  value,
  onChange,
  placeholder = 'Enter property address',
  className = '',
  id = 'google-places-input',
  name = 'address',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Load Google Places API
  useEffect(() => {
    // Check if already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsGoogleLoaded(true);
      return;
    }

    // Load Google Places script
    const script = document.createElement('script');
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_MAPBOX_TOKEN;
    
    if (!apiKey) {
      console.warn('[GooglePlacesInput] No Google Maps API key found. Falling back to plain input.');
      return;
    }

    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsGoogleLoaded(true);
    script.onerror = () => {
      console.error('[GooglePlacesInput] Failed to load Google Maps API');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup not needed - Google Maps script stays loaded
    };
  }, []);

  // Initialize autocomplete when Google is loaded
  useEffect(() => {
    if (!isGoogleLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      // Initialize autocomplete
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' }, // Restrict to US addresses
        fields: ['formatted_address', 'geometry', 'address_components'],
      });

      // Listen for place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        
        if (!place || !place.geometry) {
          console.warn('[GooglePlacesInput] No geometry for selected place');
          return;
        }

        const address = place.formatted_address || '';
        const lat = place.geometry.location?.lat();
        const lng = place.geometry.location?.lng();

        console.log('[GooglePlacesInput] Place selected:', { address, lat, lng });

        if (lat && lng) {
          onChange(address, [lng, lat]);
        } else {
          onChange(address);
        }
      });

      console.log('[GooglePlacesInput] Autocomplete initialized');
    } catch (error) {
      console.error('[GooglePlacesInput] Error initializing autocomplete:', error);
    }
  }, [isGoogleLoaded, onChange]);

  // Handle manual input changes (when user types without selecting)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        aria-label="Property address"
        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
      />
      {isGoogleLoaded && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          <span title="Powered by Google">G</span>
        </div>
      )}
      {!isGoogleLoaded && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          Loading...
        </div>
      )}
    </div>
  );
};
