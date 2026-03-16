import { useState, useEffect, useCallback } from 'react';

interface PresenceUser {
  userId: string;
  email: string;
  activeModule?: string;
  joinedAt: number;
}

interface PresenceIndicatorProps {
  dealId: string;
  currentModule?: string;
}

function getInitials(email: string): string {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
  'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500',
];

function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function PresenceIndicator({ dealId, currentModule }: PresenceIndicatorProps) {
  const [participants, setParticipants] = useState<PresenceUser[]>([]);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const handlePresenceUpdate = useCallback((data: { dealId: string; participants: PresenceUser[] }) => {
    if (data.dealId === dealId) {
      setParticipants(data.participants);
    }
  }, [dealId]);

  useEffect(() => {
    const win = window as any;
    const socket = win.__jediSocket;
    if (!socket) return;

    socket.emit('deal:join', { dealId, activeModule: currentModule });
    socket.on('deal:presence', handlePresenceUpdate);

    return () => {
      socket.emit('deal:leave', { dealId });
      socket.off('deal:presence', handlePresenceUpdate);
    };
  }, [dealId, handlePresenceUpdate]);

  useEffect(() => {
    const win = window as any;
    const socket = win.__jediSocket;
    if (!socket) return;
    socket.emit('deal:module_change', { dealId, activeModule: currentModule });
  }, [dealId, currentModule]);

  if (participants.length === 0) return null;

  const maxVisible = 5;
  const visible = participants.slice(0, maxVisible);
  const overflow = participants.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2">
        {visible.map((p) => (
          <div
            key={p.userId}
            className="relative"
            onMouseEnter={() => setShowTooltip(p.userId)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div
              className={`w-7 h-7 rounded-full ${getColorForUser(p.userId)} flex items-center justify-center text-white text-[10px] font-bold border-2 border-white cursor-default`}
            >
              {getInitials(p.email)}
            </div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-white" />

            {showTooltip === p.userId && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 shadow-lg">
                <div className="font-medium">{p.email}</div>
                {p.activeModule && (
                  <div className="text-slate-400">Viewing: {p.activeModule}</div>
                )}
              </div>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-[10px] font-bold border-2 border-white">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-[10px] text-slate-400 ml-1">
        {participants.length} viewing
      </span>
    </div>
  );
}
