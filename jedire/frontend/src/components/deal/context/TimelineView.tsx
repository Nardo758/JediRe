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
              ${event.type === 'past' ? 'bg-green-500 border-green-200' : ''}
              ${event.type === 'current' ? 'bg-blue-500 border-blue-200 animate-pulse' : ''}
              ${event.type === 'future' ? 'bg-gray-300 border-gray-100' : ''}
            `}
          />

          {/* Event Card */}
          <div
            className={`
              border-2 rounded-lg p-4 bg-white
              ${event.type === 'past' ? 'border-green-200' : ''}
              ${event.type === 'current' ? 'border-blue-400 shadow-lg' : ''}
              ${event.type === 'future' ? 'border-gray-200' : ''}
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">{event.title}</h3>
                <p className="text-sm text-gray-500">
                  {format(new Date(event.date), 'MMMM d, yyyy')}
                </p>
              </div>
              {event.completed !== undefined && (
                <span
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium
                    ${event.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
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
                    className="text-sm text-gray-600 pl-4 border-l-2 border-gray-200"
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
