/**
 * Submarket Selector - Choose submarkets within a metro area
 */

import React from 'react';
import { MapPin } from 'lucide-react';

interface Submarket {
  id: string;
  name: string;
  propertyCount: number;
}

interface SubmarketSelectorProps {
  city: string;
  submarkets: Submarket[];
  selectedSubmarket: string;
  onSubmarketChange: (submarketId: string) => void;
}

export function SubmarketSelector({ 
  city, 
  submarkets, 
  selectedSubmarket, 
  onSubmarketChange 
}: SubmarketSelectorProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-blue-600" />
        <h3 className="font-semibold text-gray-900">{city} Submarkets</h3>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSubmarketChange('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedSubmarket === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All {city}
        </button>
        
        {submarkets.map((submarket) => (
          <button
            key={submarket.id}
            onClick={() => onSubmarketChange(submarket.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedSubmarket === submarket.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {submarket.name}
            <span className="ml-1.5 text-xs opacity-75">
              ({submarket.propertyCount})
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
