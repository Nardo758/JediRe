import { Marker } from 'react-map-gl';
import { CollaborationUser } from '@/types';
import { MousePointer } from 'lucide-react';

interface CollaboratorCursorProps {
  user: CollaborationUser;
  lat: number;
  lng: number;
}

export default function CollaboratorCursor({ user, lat, lng }: CollaboratorCursorProps) {
  return (
    <Marker latitude={lat} longitude={lng} anchor="top-left">
      <div className="relative pointer-events-none">
        {/* Cursor icon */}
        <MousePointer
          className="w-5 h-5"
          style={{ color: user.color }}
          fill={user.color}
        />
        
        {/* User name label */}
        <div
          className="absolute top-6 left-2 text-xs font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap"
          style={{
            backgroundColor: user.color,
            color: 'white',
          }}
        >
          {user.name}
        </div>
      </div>
    </Marker>
  );
}
