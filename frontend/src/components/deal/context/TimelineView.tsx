import React from 'react';
import { TimelineEvent } from '../../../types/activity';
import { format } from 'date-fns';

interface TimelineViewProps {
  events: TimelineEvent[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ events }) => {
  return (
    <div className="relative py-6">
      {/* Timeline Line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300" />

      {/* Events */}
      {events.map((event, index) => (
        <div key={index} className="relative pl-20 pb-8">
          {/* Timeline Dot */}
          <div
            className={`
              absolute left-6 w-5 h-5 rounded-full border-4
              ${event.type === 'past' ? 'bg-green-500 border-green-800/50' : ''}
              ${event.type === 'current' ? 'bg-blue-500 border-blue-900/50 animate-pulse' : ''}
              ${event.type === 'future' ? 'bg-gray-300 border-[#1e2a3d]' : ''}
            `}
          />

          {/* Event Card */}
          <div
            className={`
              border-2 rounded-lg p-4 bg-[#0F1319]
              ${event.type === 'past' ? 'border-green-800/50' : ''}
              ${event.type === 'current' ? 'border-blue-400 shadow-lg' : ''}
              ${event.type === 'future' ? 'border-[#1e2a3d]' : ''}
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-[#E8E6E1] text-lg">{event.title}</h3>
                <p className="text-sm text-[#6B7585]">
                  {format(new Date(event.date), 'MMMM d, yyyy')}
                </p>
              </div>
              {event.completed !== undefined && (
                <span
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium
                    ${event.completed ? 'bg-[#022c22] text-green-400' : 'bg-[#131920] text-[#9EA8B4]'}
                  `}
                >
                  {event.completed ? '✓ Complete' : 'Pending'}
                </span>
              )}
            </div>

            {/* Activities */}
            {event.activities && event.activities.length > 0 && (
              <div className="mt-3 space-y-2">
                {event.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="text-sm text-[#9EA8B4] pl-4 border-l-2 border-[#1e2a3d]"
                  >
                    {activity.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          No timeline events yet
        </div>
      )}
    </div>
  );
};
