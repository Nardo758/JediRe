import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { TimelineEvent } from '../../../types/activity';
import { format } from 'date-fns';

interface TimelineViewProps {
  events: TimelineEvent[];
}

const dotStyle = (type: string): React.CSSProperties => {
  if (type === 'past') return { background: BT.text.green, borderColor: `${BT.text.green}44` };
  if (type === 'current') return { background: BT.text.cyan, borderColor: `${BT.text.cyan}44`, animation: 'pulse 2s infinite' };
  return { background: BT.text.muted, borderColor: `${BT.text.muted}44` };
};

const cardBorder = (type: string): string => {
  if (type === 'past') return `${BT.text.green}44`;
  if (type === 'current') return BT.text.cyan;
  return BT.border.subtle;
};

export const TimelineView: React.FC<TimelineViewProps> = ({ events }) => {
  return (
    <div className="relative py-6" style={{ fontFamily: BT.font.mono }}>
      {/* Timeline Line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5" style={{ background: BT.border.medium }} />

      {/* Events */}
      {events.map((event, index) => (
        <div key={index} className="relative pl-20 pb-8">
          {/* Timeline Dot */}
          <div
            className="absolute left-6 w-5 h-5 rounded-full"
            style={{ ...dotStyle(event.type), borderWidth: 4, borderStyle: 'solid' }}
          />

          {/* Event Card */}
          <div
            className="p-4"
            style={{
              background: BT.bg.panel,
              border: `1px solid ${cardBorder(event.type)}`,
              borderRadius: 0,
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 style={{ fontWeight: 600, color: BT.text.primary, fontSize: 14, fontFamily: BT.font.display }}>{event.title}</h3>
                <p style={{ fontSize: 10, color: BT.text.secondary }}>
                  {format(new Date(event.date), 'MMMM d, yyyy')}
                </p>
              </div>
              {event.completed !== undefined && (
                <span
                  className="px-3 py-1"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 2,
                    background: event.completed ? `${BT.text.green}22` : `${BT.text.muted}22`,
                    color: event.completed ? BT.text.green : BT.text.muted,
                  }}
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
                    className="pl-4"
                    style={{ fontSize: 10, color: BT.text.secondary, borderLeft: `2px solid ${BT.border.subtle}` }}
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
        <div className="text-center py-12" style={{ color: BT.text.muted }}>
          No timeline events yet
        </div>
      )}
    </div>
  );
};
