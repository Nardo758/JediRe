import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import axios from 'axios';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  actions?: { label: string; icon: string }[];
  timestamp: Date;
}

const SUGGESTED_QUERIES: Record<string, string[]> = {
  lookup: [
    'What can I build on this parcel?',
    'What density bonus programs apply here?',
    'Show me the full zoning code for this district',
  ],
  tracker: [
    'What entitlements are at highest risk?',
    'How long does a rezone take in this market?',
    'What documents do I need for a variance application?',
  ],
  capacity: [
    'Compare by-right vs variance capacity',
    'Calculate parking for mixed-use development',
    'What is the financial delta between scenarios?',
  ],
  risk: [
    'Are there any upcoming moratoriums in this market?',
    'How does rent control affect my rental strategy?',
    'What regulatory changes are pending?',
  ],
  comparator: [
    'Compare zoning between Atlanta and Charlotte',
    'Which district allows higher density?',
    'What are the impact fee differences?',
  ],
  timeline: [
    'What is my total time to shovel?',
    'Show me which markets have the fastest entitlement timelines',
    'What is the carrying cost difference between P50 and P75?',
  ],
};

interface ZoningAgentChatProps {
  activeTab: string;
  dealId?: string;
  districtCode?: string;
  municipality?: string;
}

export const ZoningAgentChat: React.FC<ZoningAgentChatProps> = ({
  activeTab,
  dealId,
  districtCode,
  municipality,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = SUGGESTED_QUERIES[activeTab] || SUGGESTED_QUERIES.lookup;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/v1/zoning-intelligence/query', {
        query: text,
        districtCode,
        municipality,
        dealId,
        context: { activeTab },
      });

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: response.data.answer || response.data.response || 'I analyzed the zoning data but could not generate a specific response. Try rephrasing your question.',
        actions: [
          { label: 'Run Dev Feasibility', icon: '📊' },
          { label: 'Deep Dive Zoning Code', icon: '🔍' },
        ],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: 'I encountered an issue processing your query. Please try again or rephrase your question.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isExpanded) {
    return (
      <div
        className="absolute bottom-0 left-0 right-0 z-30 bg-gray-900 text-white cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="font-medium">Zoning Agent</span>
            <span className="text-gray-400 text-sm hidden sm:inline">Ask anything about zoning, entitlements, or development capacity</span>
          </div>
          <ChevronUp className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-blue-600 shadow-2xl" style={{ maxHeight: '50%', height: '400px' }}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-3 bg-gray-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="font-medium">Zoning Agent</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setIsExpanded(false); setMessages([]); }}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-gray-600 mb-6">Ask me about zoning regulations, development capacity, or entitlement timelines.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    {msg.actions.map((action, i) => (
                      <button
                        key={i}
                        className="px-3 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        {action.icon} {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  Analyzing...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {messages.length > 0 && (
          <div className="px-6 py-2 bg-white border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 3).map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-3 bg-white border-t border-gray-200">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about zoning, entitlements, or development capacity..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
