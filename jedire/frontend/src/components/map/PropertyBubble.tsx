import { Marker } from 'react-map-gl';
import { Property } from '@/types';
import { Pin } from 'lucide-react';

interface PropertyBubbleProps {
  property: Property;
  isSelected: boolean;
  onClick: () => void;
}

type Strategy = 'build-to-sell' | 'flip' | 'rental' | 'airbnb';

function getOptimalStrategy(_score: number): Strategy {
  const strategies: Strategy[] = ['build-to-sell', 'flip', 'rental', 'airbnb'];
  return strategies[Math.floor(Math.random() * strategies.length)];
}

function getStrategyColor(strategy: Strategy): { bg: string; border: string; text: string } {
  switch (strategy) {
    case 'build-to-sell':
      return { bg: 'bg-green-500', border: 'border-green-600', text: 'text-white' };
    case 'flip':
      return { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white' };
    case 'rental':
      return { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-white' };
    case 'airbnb':
      return { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white' };
    default:
      return { bg: 'bg-gray-500', border: 'border-gray-600', text: 'text-white' };
  }
}

export default function PropertyBubble({ property, isSelected, onClick }: PropertyBubbleProps) {
  const score = property.opportunityScore;
  const strategy = getOptimalStrategy(score);
  const colors = getStrategyColor(strategy);
  
  const baseSize = 28 + (score / 100) * 20;
  const size = isSelected ? baseSize + 12 : baseSize;
  
  const hasArbitrage = score >= 85;

  return (
    <Marker
      latitude={property.coordinates.lat}
      longitude={property.coordinates.lng}
      anchor="center"
    >
      <div
        onClick={onClick}
        className={`relative cursor-pointer transition-all duration-200 ${
          isSelected ? 'z-50' : 'z-10'
        }`}
        style={{
          width: size,
          height: size,
        }}
      >
        {/* Pin indicator if pinned */}
        {property.isPinned && (
          <div className="absolute -top-2 -right-2 z-10">
            <Pin className="w-4 h-4 fill-red-500 text-red-500" />
          </div>
        )}

        {/* Arbitrage ring for high opportunity */}
        {hasArbitrage && (
          <div className="absolute inset-[-4px] rounded-full border-2 border-red-500 animate-pulse" />
        )}

        {/* Bubble */}
        <div
          className={`
            w-full h-full rounded-full shadow-lg border-2 flex items-center justify-center
            transition-all duration-200
            ${isSelected ? 'ring-4 ring-white ring-opacity-50 scale-110' : ''}
            ${colors.bg}
            ${colors.border}
            hover:scale-110
          `}
        >
          <span className={`font-bold ${isSelected ? 'text-sm' : 'text-xs'} ${colors.text}`}>
            {score}
          </span>
        </div>

        {/* Address tooltip on hover */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
            <div className="font-medium">{property.address}</div>
            <div className="text-gray-300 capitalize">{strategy.replace('-', ' ')}</div>
          </div>
        </div>
      </div>
    </Marker>
  );
}
