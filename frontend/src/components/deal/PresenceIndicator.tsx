import { useState, useEffect, useCallback } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';

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
  BT.text.cyan, BT.text.green, BT.text.purple, BT.text.amber,
  BT.text.cyan, BT.text.red, BT.text.purple, BT.text.cyan,
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
    <div className="flex items-center gap-1" style={{ fontFamily: BT.font.mono }}>
      <div className="flex -space-x-2">
        {visible.map((p) => (
          <div
            key={p.userId}
            className="relative"
            onMouseEnter={() => setShowTooltip(p.userId)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center cursor-default"
              style={{ background: getColorForUser(p.userId), color: BT.bg.terminal, fontSize: 10, fontWeight: 700, border: `2px solid ${BT.bg.panel}` }}
            >
              {getInitials(p.email)}
            </div>
            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ background: BT.text.green, border: `1px solid ${BT.bg.panel}`, animation: 'glow 2s infinite' }} />

            {showTooltip === p.userId && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 whitespace-nowrap z-50" style={{ background: BT.bg.header, border: `1px solid ${BT.border.subtle}`, fontSize: 10, color: BT.text.primary }}>
                <div style={{ fontWeight: 500 }}>{p.email}</div>
                {p.activeModule && (
                  <div style={{ color: BT.text.muted }}>Viewing: {p.activeModule}</div>
                )}
              </div>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: BT.bg.header, color: BT.text.secondary, fontSize: 10, fontWeight: 700, border: `2px solid ${BT.bg.panel}` }}>
            +{overflow}
          </div>
        )}
      </div>
      <span style={{ fontSize: 10, color: BT.text.muted, marginLeft: 4 }}>
        {participants.length} viewing
      </span>
    </div>
  );
}
