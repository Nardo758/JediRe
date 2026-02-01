import { Marker } from 'react-map-gl';
import { Property } from '@/types';
import { getScoreColor, getScoreBgColor } from '@/utils';
import { Pin } from 'lucide-react';

interface PropertyBubbleProps {
  property: Property;
  isSelected: boolean;
  onClick: () => void;
}

export default function PropertyBubble({ property, isSelected, onClick }: PropertyBubbleProps) {
  const score = property.opportunityScore;
  const size = isSelected ? 48 : 36;
  
  // Calculate bubble size based on score (larger = better opportunity)
  const bubbleSize = 24 + (score / 100) * 24;

  return (
    <Marker
      latitude={property.coordinates.lat}
      longitude={property.coordinates.lng}
      anchor="bottom"
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

        {/* Bubble */}
        <div
          className={`
            w-full h-full rounded-full shadow-lg border-2 flex items-center justify-center
            transition-all duration-200
            ${isSelected ? 'ring-4 ring-primary-500 ring-opacity-50' : ''}
            ${getScoreBgColor(score)}
            ${getScoreBorderColor(score)}
            hover:scale-110
          `}
        >
          <span
            className={`font-bold ${isSelected ? 'text-lg' : 'text-sm'} ${getScoreColor(score)}`}
          >
            {score}
          </span>
        </div>

        {/* Pulsing ring for high scores */}
        {score >= 80 && (
          <div
            className={`
              absolute inset-0 rounded-full border-2 border-green-500
              animate-ping opacity-75
            `}
          />
        )}

        {/* Address tooltip on hover */}
        {!isSelected && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {property.address}
            </div>
          </div>
        )}
      </div>
    </Marker>
  );
}

function getScoreBorderColor(score: number): string {
  if (score >= 80) return 'border-green-500';
  if (score >= 60) return 'border-blue-500';
  if (score >= 40) return 'border-yellow-500';
  return 'border-red-500';
}
