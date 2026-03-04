import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import apiClient from '../../services/api.client';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  actions?: { label: string; icon: string }[];
  timestamp: Date;
}

const SUGGESTED_QUERIES: Record<string, string[]> = {
  boundary_zoning: [
    'What can I build on this parcel?',
    'What density bonus programs apply here?',
    'Show me the full zoning code for this district',
  ],
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
  hbu: [
    'Which property type maximizes value here?',
    'What if I rezone for higher density?',
    'Compare multifamily vs mixed-use returns',
  ],
  risk: [
    'Are there any upcoming moratoriums in this market?',
    'How does rent control affect my rental strategy?',
    'What regulatory changes are pending?',
  ],
  timeline: [
    'What is my total time to shovel?',
    'Show me which markets have the fastest entitlement timelines',
    'What is the carrying cost difference between P50 and P75?',
  ],
  overview: [
    'Summarize the key risks for this deal',
    'What is the JEDI Score breakdown?',
    'What should I focus on next?',
  ],
  zoning: [
    'What can I build on this parcel?',
    'What is the current zoning designation?',
    'Are there any overlay districts?',
  ],
  financials: [
    'What are the pro forma assumptions?',
    'What is the projected IRR?',
    'How does the capital stack look?',
  ],
  'pro-forma': [
    'What are the pro forma assumptions?',
    'What is the projected NOI?',
    'Show me the sensitivity analysis',
  ],
  'capital-structure': [
    'What is the optimal debt-to-equity ratio?',
    'Compare different loan products',
    'What is the equity waterfall?',
  ],
  'market-intelligence': [
    'What are the market trends?',
    'How does supply compare to demand?',
    'What is the rent growth forecast?',
  ],
  'site-intelligence': [
    'What environmental risks exist?',
    'Describe the surrounding land uses',
    'What is the traffic count?',
  ],
  default: [
    'What can I build on this parcel?',
    'What are the zoning constraints?',
    'Summarize this deal for me',
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

  const suggestions = SUGGESTED_QUERIES[activeTab] || SUGGESTED_QUERIES.default;

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
      const response = await apiClient.post('/api/v1/zoning-intelligence/query', {
        query: text,
        districtCode,
        municipality,
        dealId,
        context: { activeTab },
      });

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: response.data.answer || response.data.response || 'I analyzed the data but could not generate a specific response. Try rephrasing your question.',
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
      <button
        onClick={() => setIsExpanded(true)}
        className="flex-shrink-0 w-10 bg-gray-900 hover:bg-gray-800 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer border-l border-gray-700"
        title="Open Zoning Agent"
      >
        <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
          <MessageCircle className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-white text-[9px] font-medium [writing-mode:vertical-lr] rotate-180 tracking-wider">
          ZONING AGENT
        </span>
        <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-[360px] bg-white border-l border-slate-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-medium text-sm">Zoning Agent</span>
            <p className="text-[10px] text-gray-400">AI-powered zoning assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Collapse panel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setIsExpanded(false); setMessages([]); }}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Close and clear"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600 mb-4">Ask me about zoning, development capacity, or deal analysis.</p>
            <div className="flex flex-col gap-2">
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2.5 ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-800'
            }`}>
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100">
                  {msg.actions.map((action, i) => (
                    <button
                      key={i}
                      className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
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
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Analyzing...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length > 0 && (
        <div className="px-4 py-2 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 2).map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="px-2 py-1 text-[10px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this deal..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
