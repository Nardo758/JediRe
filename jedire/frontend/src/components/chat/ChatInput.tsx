import React, { useState, KeyboardEvent } from 'react';
import { Button } from '../shared/Button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSend, 
  disabled = false,
  placeholder = "Ask me anything..." 
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 border-t border-gray-200 bg-white">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Message input"
      />
      <button
        onClick={() => {/* Voice input - Phase 2 */}}
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
        disabled={disabled}
        aria-label="Voice input"
      >
        🎤
      </button>
      <Button
        onClick={handleSend}
        disabled={!input.trim() || disabled}
        variant="agent"
        aria-label="Send message"
      >
        →
      </Button>
    </div>
  );
}
