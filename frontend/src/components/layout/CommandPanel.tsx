import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandPanelProps {
  open: boolean;
  onClose: () => void;
}

const COMMANDS = [
  { label: 'Go to Dashboard', action: '/', shortcut: 'G D' },
  { label: 'Go to Market Intelligence', action: '/markets', shortcut: 'G M' },
  { label: 'Go to Settings', action: '/settings', shortcut: 'G S' },
];

export const CommandPanel: React.FC<CommandPanelProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.8)', zIndex: 9998,
          backdropFilter: 'blur(4px)',
        }}
      />
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 560,
        maxWidth: '90vw',
        background: '#0d1326',
        border: '1px solid #1e2a45',
        borderRadius: 8,
        zIndex: 9999,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2a45', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#4a5568', fontSize: 14 }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e8eaf0',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
          <kbd style={{ fontSize: 10, color: '#4a5568', background: '#111827', padding: '2px 6px', borderRadius: 3, border: '1px solid #1e2a45' }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#4a5568', fontSize: 12 }}>No commands found</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={i}
              onClick={() => { navigate(cmd.action); onClose(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #111827',
                color: '#e8eaf0',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111827'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <span>{cmd.label}</span>
              <kbd style={{ fontSize: 10, color: '#4a5568', background: '#0a0e1a', padding: '2px 6px', borderRadius: 3, border: '1px solid #1e2a45', fontFamily: 'monospace' }}>
                {cmd.shortcut}
              </kbd>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default CommandPanel;
