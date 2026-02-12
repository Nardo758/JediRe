/**
 * Opus Integration Example Component
 * 
 * Demonstrates how to integrate Opus AI analysis into deal pages
 * This is an example/reference component - adapt for your specific UI
 */

import React, { useState } from 'react';
import { opusService } from '../services/opus.service';
import { opusMockService } from '../services/opus.mock.service';
import type {
  OpusDealContext,
  OpusRecommendationResult,
  ChatMessage,
  Risk,
  Opportunity,
  ActionItem
} from '../types/opus.types';

interface OpusIntegrationExampleProps {
  deal: any; // Your Deal type
  useMockData?: boolean;
}

export const OpusIntegrationExample: React.FC<OpusIntegrationExampleProps> = ({
  deal,
  useMockData = true
}) => {
  const [analysis, setAnalysis] = useState<OpusRecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sessionId, setSessionId] = useState<string>();

  // Build deal context from your deal data
  const buildDealContext = (): OpusDealContext => {
    // This is where you map your deal data to the Opus data contract
    // Add data from each tab as it becomes available
    return {
      dealId: deal.id,
      dealName: deal.name,
      status: deal.status === 'EXECUTION' || deal.status === 'POST_CLOSE' ? 'owned' : 'pipeline',
      
      // Overview tab data
      overview: {
        propertySpecs: {
          address: deal.propertyAddress || deal.address || 'Unknown',
          propertyType: deal.projectType || deal.propertyType || 'multifamily',
          units: deal.targetUnits,
          yearBuilt: deal.yearBuilt,
          squareFeet: deal.squareFeet,
          condition: deal.condition,
        },
        metrics: {
          purchasePrice: deal.dealValue,
          capRate: deal.capRate,
          cashOnCash: deal.cashOnCash,
          irr: deal.irr,
        },
        location: deal.boundary?.center ? {
          lat: deal.boundary.center.lat,
          lng: deal.boundary.center.lng,
          city: deal.city || '',
          state: deal.state || '',
          zip: deal.zip || '',
        } : undefined,
      },
      
      // Add financial data if available
      financial: deal.proForma ? {
        proForma: {
          revenue: {
            grossRent: deal.proForma.grossRent,
            vacancy: deal.proForma.vacancy,
            effectiveGrossIncome: deal.proForma.egi,
          },
          expenses: {
            operating: deal.proForma.opex,
            totalExpenses: deal.proForma.totalExpenses,
          },
          noi: deal.proForma.noi,
          debtService: deal.proForma.debtService,
          cashFlow: deal.proForma.cashFlow,
        }
      } : undefined,
      
      // Add other tab data as you implement them:
      // competition: getCompetitionData(deal),
      // supply: getSupplyData(deal),
      // debt: getDebtData(deal),
      // market: getMarketData(deal),
      // strategy: getStrategyData(deal),
    };
  };

  // Run analysis
  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const context = buildDealContext();
      const service = useMockData ? opusMockService : opusService;
      
      const result = context.status === 'pipeline'
        ? await service.analyzeAcquisition(context)
        : await service.analyzePerformance(context);

      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
      console.error('Opus analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    // Add user message to UI
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    try {
      const service = useMockData ? opusMockService : opusService;
      const response = await service.chat({
        dealId: deal.id,
        message: chatInput,
        sessionId,
        includeContext: true
      });

      setSessionId(response.sessionId);
      setChatMessages(prev => [...prev, response.message]);
    } catch (err: any) {
      console.error('Chat error:', err);
    }
  };

  return (
    <div className="opus-integration-example p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold">AI Analysis (Opus)</h2>
        <p className="text-gray-600 mt-1">
          {useMockData ? '🔵 Mock Mode - No API key required' : '🟢 Live Mode - Using Anthropic API'}
        </p>
      </div>

      {/* Analysis Section */}
      <div className="space-y-4">
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Analyzing Deal...' : 'Run AI Analysis'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {analysis && (
          <div className="space-y-6">
            {/* Score Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-bold text-blue-900">
                    {analysis.score.toFixed(1)}/10
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {analysis.confidence}% confidence
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-4 py-2 bg-white border-2 border-blue-600 rounded-lg">
                    <span className="text-lg font-bold uppercase text-blue-900">
                      {analysis.recommendation}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Executive Summary */}
            {analysis.executiveSummary && (
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h4 className="font-semibold text-lg mb-3">Executive Summary</h4>
                <p className="text-gray-700 leading-relaxed">{analysis.executiveSummary}</p>
              </div>
            )}

            {/* Key Insights */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className="font-semibold text-lg mb-3">Key Insights</h4>
              <ul className="space-y-2">
                {analysis.keyInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">💡</span>
                    <span className="text-gray-700">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className="font-semibold text-lg mb-3">
                Risks ({analysis.risks.length})
              </h4>
              <div className="space-y-3">
                {analysis.risks.map((risk: Risk) => (
                  <div
                    key={risk.id}
                    className={`border-l-4 pl-4 py-2 ${
                      risk.level === 'critical' ? 'border-red-600' :
                      risk.level === 'high' ? 'border-orange-500' :
                      risk.level === 'medium' ? 'border-yellow-500' :
                      'border-gray-400'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-medium text-gray-900">
                          {risk.category}: {risk.description}
                        </h5>
                        <div className="text-sm text-gray-600 mt-1">
                          Impact: <span className="font-medium">{risk.impact}</span> | 
                          Probability: <span className="font-medium">{risk.probability}%</span>
                        </div>
                        {risk.mitigation && (
                          <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded">
                            <strong>Mitigation:</strong> {risk.mitigation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opportunities */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className="font-semibold text-lg mb-3">
                Opportunities ({analysis.opportunities.length})
              </h4>
              <div className="space-y-3">
                {analysis.opportunities.map((opp: Opportunity) => (
                  <div key={opp.id} className="border-l-4 border-green-500 pl-4 py-2">
                    <h5 className="font-medium text-gray-900">
                      {opp.type}: {opp.description}
                    </h5>
                    <div className="text-sm text-gray-600 mt-1 flex gap-4">
                      {opp.potentialValue && (
                        <span>
                          Value: <span className="font-medium text-green-700">
                            ${opp.potentialValue.toLocaleString()}
                          </span>
                        </span>
                      )}
                      <span>
                        Probability: <span className="font-medium">{opp.probability}%</span>
                      </span>
                    </div>
                    {opp.requirements.length > 0 && (
                      <div className="text-sm text-gray-700 mt-2">
                        <strong>Requirements:</strong>{' '}
                        {opp.requirements.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Items */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className="font-semibold text-lg mb-3">
                Action Items ({analysis.actionItems.length})
              </h4>
              <div className="space-y-2">
                {analysis.actionItems.map((item: ActionItem) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded ${
                      item.priority === 'urgent' ? 'bg-red-50' :
                      item.priority === 'high' ? 'bg-orange-50' :
                      item.priority === 'medium' ? 'bg-yellow-50' :
                      'bg-gray-50'
                    }`}
                  >
                    <input type="checkbox" className="mt-1" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.action}</p>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">{item.priority}</span> | {item.timeframe}
                        {item.owner && ` | ${item.owner}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Section */}
      <div className="border-t pt-6">
        <h3 className="text-xl font-semibold mb-4">Chat with AI</h3>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-96 overflow-y-auto mb-4">
          {chatMessages.length === 0 ? (
            <p className="text-gray-500 text-center mt-20">
              Ask questions about this deal...
            </p>
          ) : (
            <div className="space-y-3">
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
            placeholder="Ask about risks, opportunities, strategy..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendChatMessage}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Send
          </button>
        </div>
      </div>

      {/* Usage Metrics (only in live mode) */}
      {!useMockData && (
        <div className="border-t pt-4">
          <button
            onClick={() => {
              const metrics = opusService.getUsageMetrics();
              console.log('Opus Usage:', metrics);
              alert(`Tokens: ${metrics.totalTokensUsed} | Cost: $${metrics.totalCost.toFixed(2)}`);
            }}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            View Usage Metrics
          </button>
        </div>
      )}
    </div>
  );
};

export default OpusIntegrationExample;
