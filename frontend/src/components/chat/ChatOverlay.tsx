import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Message } from '../../stores/chatStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export function ChatOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: "Hi! I'm JediRe AI — your real estate intelligence assistant. I can analyze markets, run financials, check zoning, and search properties. What would you like to know?",
      created_at: new Date().toISOString(),
      agent_name: 'JediRe AI'
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const resp = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Server error: ${resp.status}`);
      }

      const data = await resp.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      let agentLabel = 'JediRe AI';
      if (data.toolsUsed && data.toolsUsed.length > 0) {
        const toolNames = data.toolsUsed.map((t: string) => {
          if (t === 'analyze_market_supply') return 'Market Analysis';
          if (t === 'analyze_cashflow') return 'Financial Analysis';
          if (t === 'analyze_zoning') return 'Zoning Analysis';
          if (t === 'search_properties') return 'Property Search';
          return t;
        });
        const unique = [...new Set(toolNames)];
        agentLabel = `JediRe AI · ${unique.join(', ')}`;
      }

      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: data.response || 'No response received.',
        created_at: new Date().toISOString(),
        agent_name: agentLabel
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `Connection error: ${err.message}. Please try again.`,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl z-50"
      >
        💬
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 transition-all flex flex-col ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
      }`}
    >
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <div className="font-semibold text-sm">JediRe AI</div>
            <div className="text-xs opacity-90">
              {isTyping ? 'Analyzing...' : 'Real Estate Intelligence'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMessages([messages[0]]);
              setConversationId(null);
            }}
            className="p-1 hover:bg-white/20 rounded text-xs"
            title="New conversation"
          >
            ↻
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/20 rounded"
          >
            {isMinimized ? '□' : '─'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded"
          >
            ×
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="flex gap-2">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white text-sm">🤖</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs text-gray-500 mb-1 ml-1">JediRe AI</div>
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-200 flex-shrink-0">
            <ChatInput
              onSend={handleSend}
              disabled={isTyping}
              placeholder={isTyping ? 'Analyzing...' : 'Ask about markets, deals, zoning...'}
            />
          </div>
        </>
      )}
    </div>
  );
}
