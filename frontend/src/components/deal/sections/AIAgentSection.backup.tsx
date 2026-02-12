/**
 * AI Agent (Opus) Section - JEDI RE Enhanced Deal Page
 * Complete implementation with recommendations, insights, and chat
 */

import React, { useState, useEffect, useRef } from 'react';
import { Deal } from '../../../types/deal';
import { 
  OpusRecommendationResult,
  ChatMessage, 
  ChatSession,
  Risk,
  Opportunity,
  ActionItem,
  OpusRecommendation as RecommendationType,
  RiskLevel
} from '../../../types/opus.types';
import { opusService } from '../../../services/opus.service';

interface AIAgentSectionProps {
  deal: Deal;
  mode?: 'acquisition' | 'performance';
}

// ============================================================================
// Recommendation Card Component
// ============================================================================

interface RecommendationCardProps {
  recommendation: OpusRecommendation;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ 
  recommendation, 
  onRefresh,
  isRefreshing 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number): string => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-blue-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 8) return 'bg-green-50 border-green-200';
    if (score >= 6) return 'bg-blue-50 border-blue-200';
    if (score >= 4) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getRecommendationBadge = (type: RecommendationType) => {
    const badges: Record<RecommendationType, { label: string; className: string }> = {
      STRONG_BUY: { label: 'STRONG BUY', className: 'bg-green-600 text-white' },
      BUY: { label: 'BUY', className: 'bg-green-500 text-white' },
      HOLD: { label: 'HOLD', className: 'bg-blue-500 text-white' },
      OPTIMIZE: { label: 'OPTIMIZE', className: 'bg-purple-500 text-white' },
      PASS: { label: 'PASS', className: 'bg-yellow-500 text-white' },
      STRONG_PASS: { label: 'STRONG PASS', className: 'bg-red-600 text-white' }
    };
    return badges[type];
  };

  const badge = getRecommendationBadge(recommendation.recommendation);
  const lastUpdatedTime = new Date(recommendation.lastUpdated).toLocaleString();

  return (
    <div className={`border rounded-lg p-6 transition-all ${getScoreBgColor(recommendation.score)}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="text-5xl">🤖</div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Opus Recommendation</h3>
            <div className="flex items-center gap-3">
              <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-full ${badge.className}`}>
                {badge.label}
              </span>
              <span className="text-sm text-gray-600">
                {recommendation.mode === 'acquisition' ? 'Acquisition Analysis' : 'Performance Analysis'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh analysis"
        >
          <span className={isRefreshing ? 'animate-spin inline-block' : ''}>
            🔄
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white/70 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Deal Score</div>
          <div className={`text-4xl font-bold ${getScoreColor(recommendation.score)}`}>
            {recommendation.score.toFixed(1)}<span className="text-2xl text-gray-400">/10</span>
          </div>
        </div>
        <div className="bg-white/70 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Confidence</div>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-bold text-gray-900">{recommendation.confidence}%</div>
            <div className="text-sm text-gray-500">
              {recommendation.confidence >= 80 ? 'High' : recommendation.confidence >= 60 ? 'Medium' : 'Low'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/70 rounded-lg p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="font-semibold text-gray-900">Key Reasoning</span>
          <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
        </button>
        {isExpanded && (
          <p className="mt-3 text-sm text-gray-700 leading-relaxed">
            {recommendation.reasoning}
          </p>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Last updated: {lastUpdatedTime}
      </div>
    </div>
  );
};

// ============================================================================
// Insights Section Component
// ============================================================================

interface InsightsSectionProps {
  insights: Insight[];
}

const InsightsSection: React.FC<InsightsSectionProps> = ({ insights }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<InsightCategory>>(
    new Set(['strength', 'risk', 'opportunity', 'action'])
  );

  const toggleCategory = (category: InsightCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryConfig = (category: InsightCategory) => {
    const configs = {
      strength: { icon: '✅', label: 'Strengths', color: 'green' },
      risk: { icon: '⚠️', label: 'Risks', color: 'red' },
      opportunity: { icon: '💡', label: 'Opportunities', color: 'blue' },
      action: { icon: '🎯', label: 'Action Items', color: 'purple' }
    };
    return configs[category];
  };

  const getImpactBadge = (impact: ImpactLevel) => {
    const badges = {
      HIGH: 'bg-red-100 text-red-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      LOW: 'bg-gray-100 text-gray-800'
    };
    return badges[impact];
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return '';
    const badges = {
      CRITICAL: 'bg-red-600 text-white',
      HIGH: 'bg-orange-500 text-white',
      MEDIUM: 'bg-yellow-500 text-white',
      LOW: 'bg-gray-500 text-white'
    };
    return badges[priority as keyof typeof badges] || '';
  };

  const categories: InsightCategory[] = ['strength', 'risk', 'opportunity', 'action'];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">📊 Key Insights</h3>
      
      {categories.map(category => {
        const config = getCategoryConfig(category);
        const categoryInsights = insights.filter(i => i.category === category);
        const isExpanded = expandedCategories.has(category);

        if (categoryInsights.length === 0) return null;

        return (
          <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className={`w-full px-4 py-3 flex items-center justify-between bg-${config.color}-50 hover:bg-${config.color}-100 transition-colors`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{config.icon}</span>
                <span className="font-semibold text-gray-900">{config.label}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-${config.color}-200 text-${config.color}-800`}>
                  {categoryInsights.length}
                </span>
              </div>
              <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
            </button>

            {isExpanded && (
              <div className="p-4 space-y-3">
                {categoryInsights.map(insight => (
                  <div
                    key={insight.id}
                    className={`border-l-4 border-${config.color}-400 bg-gray-50 rounded-r-lg p-4`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                      <div className="flex gap-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getImpactBadge(insight.impact)}`}>
                          {insight.impact}
                        </span>
                        {insight.priority && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityBadge(insight.priority)}`}>
                            {insight.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{insight.description}</p>
                    {insight.dataPoints && insight.dataPoints.length > 0 && (
                      <div className="space-y-1">
                        {insight.dataPoints.map((point, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="text-gray-400">•</span>
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// Chat Interface Component
// ============================================================================

interface ChatInterfaceProps {
  dealId: string;
  mode: 'acquisition' | 'performance';
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ dealId, mode }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Load chat history from localStorage
    const history = opusService.getChatHistory(dealId);
    if (history) {
      setMessages(history.messages);
    }
  }, [dealId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getSuggestedQuestions = () => {
    if (mode === 'acquisition') {
      return [
        "Should I buy this deal?",
        "What's a fair price?",
        "What are the biggest risks?",
        "Which strategy is optimal?"
      ];
    } else {
      return [
        "How is performance vs budget?",
        "What's causing the variance?",
        "When should I refinance?",
        "What value-add opportunities remain?"
      ];
    }
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsSending(true);

    try {
      const response = await opusService.chat({
        dealId,
        message: text,
        history: newMessages
      });

      const updatedMessages = [...newMessages, response.message];
      setMessages(updatedMessages);

      // Save to localStorage
      const history: ChatHistory = {
        dealId,
        messages: updatedMessages,
        lastUpdated: new Date().toISOString()
      };
      opusService.saveChatHistory(history);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error message
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear all chat history for this deal?')) {
      setMessages([]);
      opusService.clearChatHistory(dealId);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>💬</span> Chat with Opus
        </h3>
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Suggested Questions */}
      {messages.length === 0 && (
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <p className="text-xs font-medium text-blue-900 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {getSuggestedQuestions().map((question, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(question)}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white hover:bg-blue-100 border border-blue-200 rounded-full transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-2">🤖</div>
              <p className="text-sm">Ask Opus anything about this deal...</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                      <span className="font-semibold">Opus</span>
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="hover:text-gray-700 transition-colors"
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </div>
                  <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse delay-100">●</span>
                    <span className="animate-pulse delay-200">●</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Opus anything about this deal..."
            disabled={isSending}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isSending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-right">
          {input.length} characters
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main AI Agent Section Component
// ============================================================================

export const AIAgentSection: React.FC<AIAgentSectionProps> = ({ 
  deal, 
  mode = 'acquisition' 
}) => {
  const [recommendation, setRecommendation] = useState<OpusRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendation = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = mode === 'acquisition'
        ? await opusService.analyzeAcquisition({ dealId: deal.id, dealData: deal, mode })
        : await opusService.analyzePerformance({ dealId: deal.id, dealData: deal, mode });
      
      setRecommendation(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendation');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadRecommendation();
  }, [deal.id, mode]);

  const handleRefresh = () => {
    loadRecommendation(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton loader */}
        <div className="bg-gray-100 border border-gray-200 rounded-lg p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gray-300 rounded"></div>
            <div className="flex-1">
              <div className="h-6 bg-gray-300 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-32"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="h-24 bg-gray-300 rounded"></div>
            <div className="h-24 bg-gray-300 rounded"></div>
          </div>
          <div className="h-20 bg-gray-300 rounded"></div>
        </div>
        <div className="h-64 bg-gray-100 border border-gray-200 rounded-lg animate-pulse"></div>
        <div className="h-96 bg-gray-100 border border-gray-200 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">⚠️</span>
          <h3 className="text-lg font-semibold text-red-900">Failed to Load Analysis</h3>
        </div>
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button
          onClick={() => loadRecommendation()}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!recommendation) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Recommendation Card */}
      <RecommendationCard 
        recommendation={recommendation}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Insights Section */}
      <InsightsSection insights={recommendation.insights} />

      {/* Chat Interface */}
      <ChatInterface dealId={deal.id} mode={mode} />
    </div>
  );
};
