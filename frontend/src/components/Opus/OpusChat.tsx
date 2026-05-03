/**
 * Opus Chat Interface - JEDI RE
 * Complete AI-powered chat interface with recommendation cards
 * 
 * Features:
 * - Recommendation card (score, insights, risks, opportunities)
 * - ChatGPT-style interface
 * - Streaming responses
 * - Mode-specific prompts (Acquisition vs Performance)
 * - Message history
 * - Suggested prompts
 */

import React, { useState, useEffect, useRef } from 'react';
import { opusService } from '../../services/opus.service';
import { opusMockService } from '../../services/opus.mock.service';
import type {
  OpusDealContext,
  OpusRecommendationResult,
  ChatMessage,
  ChatRequest,
  Risk,
  Opportunity,
  ActionItem
} from '../../types/opus.types';

interface OpusChatProps {
  dealContext: OpusDealContext;
  mode: 'acquisition' | 'performance';
  useMockData?: boolean;
  onAnalysisComplete?: (result: OpusRecommendationResult) => void;
}

// Mode-specific suggested prompts
const SUGGESTED_PROMPTS = {
  acquisition: [
    "What's the biggest risk in this deal?",
    "How's the deal structure?",
    "Can you do a sensitivity analysis?",
    "What should I negotiate on?",
    "Compare this to market comps"
  ],
  performance: [
    "How can I increase NOI?",
    "What's underperforming?",
    "What optimization strategies do you recommend?",
    "Should I refinance or sell?",
    "How can I reduce expenses?"
  ]
};

export const OpusChat: React.FC<OpusChatProps> = ({
  dealContext,
  mode,
  useMockData = true,
  onAnalysisComplete
}) => {
  // State
  const [recommendation, setRecommendation] = useState<OpusRecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get service based on mode
  const service = useMockData ? opusMockService : opusService;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Load initial analysis
  useEffect(() => {
    loadAnalysis();
  }, [dealContext.dealId]);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let result: OpusRecommendationResult;
      
      if (mode === 'acquisition') {
        result = await service.analyzeAcquisition(dealContext);
      } else {
        result = await service.analyzePerformance(dealContext);
      }
      
      setRecommendation(result);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }
      
      // Add welcome message
      const welcomeMsg: ChatMessage = {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content: `I've analyzed this ${mode === 'acquisition' ? 'acquisition opportunity' : 'asset'} and generated my recommendation. Feel free to ask me anything about the deal!`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMsg]);
      
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setError(err.message || 'Failed to analyze deal');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || inputMessage;
    if (!text.trim() || isSending) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsSending(true);

    try {
      const request: ChatRequest = {
        dealId: dealContext.dealId,
        message: text,
        includeContext: true,
        sessionId,
        temperature: 0.7
      };

      // Simulate streaming with chunks
      setStreamingMessage('');
      
      const response = await service.chat(request);
      
      // Simulate streaming effect
      const fullMessage = response.message.content;
      let currentText = '';
      const words = fullMessage.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? ' ' : '') + words[i];
        setStreamingMessage(currentText);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
      // Add complete message
      setMessages(prev => [...prev, response.message]);
      setStreamingMessage('');
      setSessionId(response.sessionId);
      
    } catch (err: any) {
      console.error('Chat failed:', err);
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInputMessage(prompt);
    handleSendMessage(prompt);
  };

  const handleReanalyze = async () => {
    setAnalyzing(true);
    await loadAnalysis();
    setAnalyzing(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Analyzing deal with Opus AI...</p>
          <p className="text-sm text-gray-400 mt-2">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !recommendation) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Failed</h3>
          <p className="text-gray-600 mb-4">{error || 'Unable to load recommendation'}</p>
          <button
            onClick={handleReanalyze}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  // Helper functions
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-blue-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-50 border-green-200';
    if (score >= 6) return 'bg-blue-50 border-blue-200';
    if (score >= 4) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getRecommendationBadge = (rec: string) => {
    const badges: Record<string, { text: string; class: string }> = {
      'strong-buy': { text: '💎 STRONG BUY', class: 'bg-green-600 text-white' },
      'buy': { text: '✅ BUY', class: 'bg-green-500 text-white' },
      'hold': { text: '⏸️ HOLD', class: 'bg-blue-600 text-white' },
      'pass': { text: '⛔ PASS', class: 'bg-red-600 text-white' },
      'optimize': { text: '🎯 OPTIMIZE', class: 'bg-purple-600 text-white' },
      'hold-asset': { text: '💼 HOLD', class: 'bg-blue-600 text-white' },
      'sell': { text: '📤 SELL', class: 'bg-orange-600 text-white' }
    };
    return badges[rec] || { text: rec.toUpperCase(), class: 'bg-gray-600 text-white' };
  };

  const badge = getRecommendationBadge(recommendation.recommendation);
  const suggestedPrompts = SUGGESTED_PROMPTS[mode];

  return (
    <div className="space-y-6">
      {/* Recommendation Card */}
      <div className={`border rounded-xl shadow-lg overflow-hidden ${getScoreBgColor(recommendation.score)}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🤖</div>
              <div>
                <h3 className="text-lg font-bold">Opus AI Recommendation</h3>
                <p className="text-sm text-blue-100">Powered by Claude 3 Opus</p>
              </div>
            </div>
            <button
              onClick={handleReanalyze}
              disabled={analyzing}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {analyzing ? '🔄 Analyzing...' : '🔄 Reanalyze'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 bg-white/90">
          {/* Score and Badge */}
          <div className="flex items-start gap-6 mb-6">
            {/* Score */}
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Deal Score</div>
              <div className={`text-5xl font-bold ${getScoreColor(recommendation.score)}`}>
                {recommendation.score.toFixed(1)}
              </div>
              <div className="text-sm text-gray-400">/10</div>
            </div>

            {/* Divider */}
            <div className="border-l border-gray-300 h-24"></div>

            {/* Recommendation & Confidence */}
            <div className="flex-1">
              <div className="mb-3">
                <span className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${badge.class}`}>
                  {badge.text}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-600">Confidence:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${recommendation.confidence}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold text-gray-900">{recommendation.confidence}%</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{recommendation.reasoning}</p>
            </div>
          </div>

          {/* Key Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Strengths */}
            <div className="border-l-4 border-green-400 bg-green-50 rounded-r-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                <span>💪</span> Strengths
              </h4>
              <ul className="space-y-1">
                {recommendation.strengths?.slice(0, 3).map((strength, idx) => (
                  <li key={idx} className="text-sm text-green-800">• {strength}</li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            <div className="border-l-4 border-red-400 bg-red-50 rounded-r-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <span>⚠️</span> Risks ({recommendation.risks.length})
              </h4>
              <ul className="space-y-1">
                {recommendation.risks.slice(0, 3).map((risk) => (
                  <li key={risk.id} className="text-sm text-red-800">
                    • {risk.description.substring(0, 50)}...
                  </li>
                ))}
              </ul>
            </div>

            {/* Opportunities */}
            <div className="border-l-4 border-blue-400 bg-blue-50 rounded-r-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <span>💡</span> Opportunities
              </h4>
              <ul className="space-y-1">
                {recommendation.opportunities.slice(0, 3).map((opp) => (
                  <li key={opp.id} className="text-sm text-blue-800">
                    • {opp.description.substring(0, 50)}...
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Items */}
          {recommendation.actionItems.length > 0 && (
            <div className="mt-4 border-l-4 border-purple-400 bg-purple-50 rounded-r-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <span>🎯</span> Priority Action Items
              </h4>
              <div className="space-y-2">
                {recommendation.actionItems.slice(0, 3).map((action) => (
                  <div key={action.id} className="flex items-start gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      action.priority === 'urgent' ? 'bg-red-600 text-white' :
                      action.priority === 'high' ? 'bg-orange-500 text-white' :
                      'bg-purple-200 text-purple-900'
                    }`}>
                      {action.priority}
                    </span>
                    <span className="text-sm text-purple-900">{action.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">💬 Chat with Opus</h3>
              <p className="text-sm text-gray-600">Ask anything about this {mode === 'acquisition' ? 'deal' : 'asset'}</p>
            </div>
            <button
              onClick={() => {
                setMessages([]);
                setSessionId(undefined);
              }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="h-96 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start gap-2 max-w-[80%] ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                
                {/* Message Bubble */}
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white border border-gray-200 text-gray-900 rounded-tl-none shadow-sm'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <div className={`text-xs mt-1 ${
                    msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Streaming Message */}
          {streamingMessage && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2 max-w-[80%]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center">
                  🤖
                </div>
                <div className="bg-white border border-gray-200 text-gray-900 rounded-2xl rounded-tl-none shadow-sm px-4 py-3">
                  <p className="text-sm leading-relaxed">{streamingMessage}<span className="animate-pulse">▋</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {isSending && !streamingMessage && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center">
                  🤖
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        {messages.length <= 1 && (
          <div className="px-6 py-3 bg-white border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  disabled={isSending}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 py-4 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ask Opus anything about this deal..."
              disabled={isSending}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isSending}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSending ? '...' : 'Send'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send • {useMockData ? '🟢 Mock Mode' : '🔴 Live API'}
          </p>
        </div>
      </div>

      {/* Analysis Metadata */}
      <div className="text-xs text-gray-400 text-center">
        Analysis completed {new Date(recommendation.analysisDate).toLocaleString()} • 
        Tokens: {recommendation.tokensUsed?.toLocaleString() || 'N/A'} • 
        Processing: {recommendation.processingTime ? `${(recommendation.processingTime / 1000).toFixed(1)}s` : 'N/A'}
      </div>
    </div>
  );
};

export default OpusChat;
