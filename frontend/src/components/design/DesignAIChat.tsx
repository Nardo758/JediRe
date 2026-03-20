import React, { useState } from 'react';
import { T as BT, mono } from '../deal/bloomberg-tokens';

interface DesignAIChatProps {
  dealId?: string;
  onSuggestion?: (suggestion: any) => void;
  parcelData?: any;
  buildingProgram?: any;
}

export const DesignAIChat: React.FC<DesignAIChatProps> = ({ dealId, onSuggestion, parcelData, buildingProgram }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Hello! I can help optimize your building design. Describe your goals or constraints and I will suggest improvements.' },
  ]);

  const send = () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }, { role: 'ai', text: 'Analyzing design parameters…' }]);
    if (onSuggestion) onSuggestion({ query: msg });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BT.border}`, fontSize: 10, fontWeight: 700, color: BT.violL, letterSpacing: 2, textTransform: 'uppercase', ...mono }}>
        Design AI
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ padding: '8px 12px', borderRadius: 4, fontSize: 11, ...mono, background: m.role === 'ai' ? BT.bgPanel : BT.bg.terminal, color: m.role === 'ai' ? BT.ts : BT.cyanL, alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', border: `1px solid ${BT.border}` }}>
            {m.text}
          </div>
        ))}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${BT.border}`, display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Describe design goal or constraint…"
          style={{ flex: 1, background: BT.bg.terminal, border: `1px solid ${BT.border}`, color: BT.text.white, padding: '6px 10px', borderRadius: 4, fontSize: 11, outline: 'none', ...mono }}
        />
        <button onClick={send} style={{ padding: '6px 12px', background: BT.bg.terminal, border: `1px solid ${BT.cyanL}`, color: BT.cyanL, borderRadius: 4, fontSize: 10, cursor: 'pointer', ...mono }}>Send</button>
      </div>
    </div>
  );
};

export default DesignAIChat;
