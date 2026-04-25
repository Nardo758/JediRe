import React, { useState } from 'react';
import { BT } from '../theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface RefreshIntelligenceButtonProps {
  entityType: 'msa' | 'submarket';
  entityId: string;
  onQueued?: () => void;
}

interface QueuedTask { id: string; taskType: string; }
interface RefreshResponse { entityType: string; entityId: string; queued: QueuedTask[]; }

export const RefreshIntelligenceButton: React.FC<RefreshIntelligenceButtonProps> = ({
  entityType, entityId, onQueued,
}) => {
  const [status, setStatus] = useState<'idle' | 'queuing' | 'queued' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const handleClick = async (): Promise<void> => {
    setStatus('queuing');
    setMessage('');
    try {
      const token = localStorage.getItem('authToken') ?? '';
      const r = await fetch(
        `/api/v1/intelligence/refresh/${entityType}/${encodeURIComponent(entityId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as RefreshResponse;
      setStatus('queued');
      setMessage(`Queued ${body.queued.length} task${body.queued.length === 1 ? '' : 's'}`);
      onQueued?.();
      setTimeout(() => setStatus('idle'), 4000);
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const colors: Record<typeof status, { bg: string; fg: string; border: string }> = {
    idle:    { bg: `${BT.text.cyan}14`,  fg: BT.text.cyan,  border: `${BT.text.cyan}66` },
    queuing: { bg: `${BT.text.amber}14`, fg: BT.text.amber, border: `${BT.text.amber}66` },
    queued:  { bg: `${BT.text.green}14`, fg: BT.text.green, border: `${BT.text.green}66` },
    error:   { bg: `${BT.accent.red}14`, fg: BT.accent.red, border: `${BT.accent.red}66` },
  };
  const c = colors[status];

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'queuing'}
        style={{
          width: '100%',
          padding: '6px 10px',
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          borderRadius: 3,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: status === 'queuing' ? 'wait' : 'pointer',
          ...mono,
        }}
      >
        {status === 'queuing' ? 'Queuing…' : 'Refresh Intelligence'}
      </button>
      {message && (
        <div style={{ fontSize: 9, color: c.fg, ...mono, marginTop: 4, textAlign: 'center' }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default RefreshIntelligenceButton;
