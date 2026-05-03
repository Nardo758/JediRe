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
  // Task #425: useEffect intentionally omits `currentModule` — the omitted
  // value(s) are either (a) stable references from context/store hooks whose
  // identity is guaranteed by the producer, (b) values captured at first-fire
  // on purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: BT.font.mono }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {visible.map((p, i) => (
          <div
            key={p.userId}
            style={{ position: 'relative', marginLeft: i > 0 ? -6 : 0 }}
            onMouseEnter={() => setShowTooltip(p.userId)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <div
              style={{
                width: 20, height: 20, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: getColorForUser(p.userId), color: BT.bg.terminal,
                fontSize: 8, fontWeight: 700, cursor: 'default',
                border: `1.5px solid ${BT.bg.panel}`,
              }}
            >
              {getInitials(p.email)}
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 6, height: 6, borderRadius: '50%',
              background: BT.text.green, border: `1px solid ${BT.bg.panel}`,
            }} />

            {showTooltip === p.userId && (
              <div style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                marginTop: 4, padding: '3px 8px', whiteSpace: 'nowrap', zIndex: 50,
                background: BT.bg.header, border: `1px solid ${BT.border.subtle}`,
                fontSize: 9, color: BT.text.primary,
              }}>
                <div style={{ fontWeight: 500 }}>{p.email}</div>
                {p.activeModule && (
                  <div style={{ color: BT.text.muted }}>Viewing: {p.activeModule}</div>
                )}
              </div>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div style={{
            width: 20, height: 20, borderRadius: '50%', marginLeft: -6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: BT.bg.header, color: BT.text.secondary,
            fontSize: 8, fontWeight: 700, border: `1.5px solid ${BT.bg.panel}`,
          }}>
            +{overflow}
          </div>
        )}
      </div>
      <span style={{ fontSize: 9, color: BT.text.muted, letterSpacing: 0.3 }}>
        {participants.length} viewing
      </span>
    </div>
  );
}
