/**
 * AI Agent (Opus) Section - JEDI RE Enhanced Deal Page
 * Simplified working implementation using existing type system
 */

import React, { useState, useEffect, useRef } from 'react';
import { Deal } from '../../../types/deal';
import { 
  OpusRecommendationResult,
  ChatMessage,
  Risk,
  Opportunity,
  ActionItem
} from '../../../types/opus.types';

interface AIAgentSectionProps {
  deal: Deal;
  mode?: 'acquisition' | 'performance';
}

// Simple mock data generator
const generateMockRecommendation = (dealId: string, mode: 'acquisition' | 'performance'): OpusRecommendationResult => {
  return {
    score: mode === 'acquisition' ? 8.5 : 7.2,
    confidence: mode === 'acquisition' ? 87 : 82,
    recommendation: mode === 'acquisition' ? 'strong-buy' : 'optimize',
    reasoning: mode === 'acquisition'
      ? 'Strong fundamentals with clear value-add potential. Property underpriced relative to market. Recommend proceeding.'
      : 'Solid performance but below potential. Priority: accelerate renovations and implement expense reduction initiatives.',
    keyInsights: [
      'Market fundamentals are strong',
      'Property underpriced by 12% relative to comps',
      'Supply risk elevated - monitor pipeline',
      'Lock interest rate cap immediately'
    ],
    executiveSummary: 'Compelling opportunity with manageable risks',
    risks: [
      {
        id: '1',
        category: 'Market',
        description: 'Elevated supply pipeline with 2,450 units under construction',
        level: 'high',
        impact: 'high',
        probability: 75,
        mitigation: 'Accelerate lease-up timeline',
        priority: 9
      }
    ],
    opportunities: [
      {
        id: '1',
        type: 'value-add',
        description: 'Unit upgrade program can command $150/month premium',
        potentialValue: 336000,
        probability: 85,
        requirements: ['$8K/unit investment', 'contractor lined up'],
        timeline: '18 months',
        priority: 8
      }
    ],
    actionItems: [
      {
        id: '1',
        action: 'Lock interest rate cap today',
        category: 'Financing',
        priority: 'urgent',
        timeframe: 'This week',
        owner: 'Finance Team'
      }
    ],
    strengths: ['Strong location', 'Underpriced asset', 'Value-add potential'],
    weaknesses: ['Supply competition', 'Rate exposure'],
    assumptions: ['4.2% rent growth', 'Q3 lease-up', 'Market remains stable'],
    analysisDate: new Date().toISOString(),
    modelVersion: 'opus-mock-v1',
    tokensUsed: 15420,
    processingTime: 2340
  };
};

export const AIAgentSection: React.FC<AIAgentSectionProps> = ({ deal, mode = 'acquisition' }) => {
  const [recommendation, setRecommendation] = useState<OpusRecommendationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Load recommendation
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setRecommendation(generateMockRecommendation(deal.id, mode));
        setIsLoading(false);
      }, 1000);
    };
    loadData();
  }, [deal.id, mode]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsSending(true);

    // Simulate response
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `msg_${Date.now()}_ai`,
        role: 'assistant',
        content: 'Based on the deal analysis, I recommend proceeding with this acquisition. The fundamentals are strong despite the supply risk.',
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, aiMsg]);
      setIsSending(false);
    }, 800);
  };

  if (isLoading || !recommendation) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 bg-gray-100 rounded-lg"></div>
        <div className="h-64 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-blue-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBadgeColor = (rec: string) => {
    if (rec.includes('buy')) return 'bg-green-600 text-white';
    if (rec === 'optimize') return 'bg-purple-600 text-white';
    if (rec === 'hold' || rec === 'hold-asset') return 'bg-blue-600 text-white';
    return 'bg-red-600 text-white';
  };

  return (
    <div className="space-y-6">
      {/* Recommendation Card */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-5xl">🤖</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Opus Recommendation</h3>
            <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${getBadgeColor(recommendation.recommendation)}`}>
              {recommendation.recommendation.toUpperCase().replace('-', ' ')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white/80 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Deal Score</div>
            <div className={`text-4xl font-bold ${getScoreColor(recommendation.score)}`}>
              {recommendation.score.toFixed(1)}<span className="text-2xl text-gray-400">/10</span>
            </div>
          </div>
          <div className="bg-white/80 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Confidence</div>
            <div className="text-4xl font-bold text-gray-900">{recommendation.confidence}%</div>
          </div>
        </div>

        <div className="bg-white/80 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Reasoning</h4>
          <p className="text-sm text-gray-700">{recommendation.reasoning}</p>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Risks */}
          {recommendation.risks.length > 0 && (
            <div className="border-l-4 border-red-400 bg-red-50 rounded-r-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2">⚠️ Risks</h4>
              <ul className="space-y-2">
                {recommendation.risks.slice(0, 3).map(risk => (
                  <li key={risk.id} className="text-sm text-red-800">
                    • {risk.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Opportunities */}
          {recommendation.opportunities.length > 0 && (
            <div className="border-l-4 border-blue-400 bg-blue-50 rounded-r-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">💡 Opportunities</h4>
              <ul className="space-y-2">
                {recommendation.opportunities.slice(0, 3).map(opp => (
                  <li key={opp.id} className="text-sm text-blue-800">
                    • {opp.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {recommendation.actionItems.length > 0 && (
            <div className="border-l-4 border-purple-400 bg-purple-50 rounded-r-lg p-4 md:col-span-2">
              <h4 className="font-semibold text-purple-900 mb-2">🎯 Action Items</h4>
              <ul className="space-y-2">
                {recommendation.actionItems.slice(0, 5).map(action => (
                  <li key={action.id} className="text-sm text-purple-800 flex items-start gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      action.priority === 'urgent' ? 'bg-red-600 text-white' : 'bg-purple-200 text-purple-900'
                    }`}>
                      {action.priority}
                    </span>
                    <span>{action.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">💬 Chat with Opus</h3>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">🤖</div>
                <p className="text-sm">Ask Opus anything about this deal...</p>
              </div>
            </div>
          ) : (
            chatMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex gap-1">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse delay-100">●</span>
                  <span className="animate-pulse delay-200">●</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask Opus anything..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAgentSection;
