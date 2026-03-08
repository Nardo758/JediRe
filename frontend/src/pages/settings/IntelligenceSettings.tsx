/**
 * Intelligence & Data Settings
 * User preferences for semantic search, agent learning, and data privacy
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, Database, Shield, TrendingUp, 
  CheckCircle, Settings, FileText, Zap 
} from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface IntelligencePreferences {
  semanticSearchEnabled: boolean;
  semanticSearchThreshold: number;
  contributeToLearning: boolean;
  requestFeedback: boolean;
  autoSubmitCorrections: boolean;
  includeDocuments: boolean;
  taskHistoryRetentionDays: number;
}

interface UserStats {
  myDocuments: number;
  documentsEmbedded: number;
  pendingEmbeddings: number;
  agentTasksRun: number;
  resultsApproved: number;
  correctionsMade: number;
  patternsDiscovered: number;
}

export function IntelligenceSettings() {
  const [preferences, setPreferences] = useState<IntelligencePreferences>({
    semanticSearchEnabled: true,
    semanticSearchThreshold: 0.6,
    contributeToLearning: true,
    requestFeedback: true,
    autoSubmitCorrections: false,
    includeDocuments: true,
    taskHistoryRetentionDays: 90,
  });

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
    loadStats();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await apiClient.get('/api/v1/intelligence/user/preferences');
      if (response.data) {
        setPreferences(response.data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get('/api/v1/intelligence/user/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/v1/intelligence/user/preferences', preferences);
      // Show success toast
    } catch (error) {
      console.error('Error saving preferences:', error);
      // Show error toast
    } finally {
      setSaving(false);
    }
  };

  const generateEmbeddings = async () => {
    try {
      await apiClient.post('/api/v1/intelligence/user/generate-embeddings');
      loadStats(); // Refresh stats
      // Show success toast
    } catch (error) {
      console.error('Error generating embeddings:', error);
      // Show error toast
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const approvalRate = stats && stats.agentTasksRun > 0
    ? Math.round((stats.resultsApproved / stats.agentTasksRun) * 100)
    : 0;

  const embeddingPct = stats && stats.myDocuments > 0
    ? Math.round((stats.documentsEmbedded / stats.myDocuments) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* My Document Intelligence */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">My Document Intelligence</h2>
        </div>

        {stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.myDocuments}</div>
                <div className="text-xs text-gray-600 mt-1">Documents Uploaded</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.documentsEmbedded}</div>
                <div className="text-xs text-gray-600 mt-1">With AI Embeddings</div>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">{stats.pendingEmbeddings}</div>
                <div className="text-xs text-gray-600 mt-1">Pending Processing</div>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Embedding Progress</span>
                <span className="text-sm font-medium text-gray-900">{embeddingPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${embeddingPct}%` }}
                />
              </div>
            </div>

            {stats.pendingEmbeddings > 0 && (
              <button
                onClick={generateEmbeddings}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Generate Embeddings for {stats.pendingEmbeddings} Pending Docs
              </button>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">Loading stats...</div>
        )}
      </div>

      {/* Semantic Search Preferences */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Semantic Search Preferences</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.semanticSearchEnabled}
              onChange={(e) => setPreferences({ ...preferences, semanticSearchEnabled: e.target.checked })}
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Enable Semantic Search</div>
              <div className="text-sm text-gray-600 mt-1">
                Uses AI to find more relevant documents based on meaning, not just keywords.
                Falls back to keyword search if unavailable.
              </div>
            </div>
          </label>

          {preferences.semanticSearchEnabled && (
            <div className="pl-7 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Precision
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.semanticSearchThreshold === 0.8}
                      onChange={() => setPreferences({ ...preferences, semanticSearchThreshold: 0.8 })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">
                      High (only very similar, 0.8+ match)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.semanticSearchThreshold === 0.6}
                      onChange={() => setPreferences({ ...preferences, semanticSearchThreshold: 0.6 })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">
                      Medium (balanced, 0.6+ match) <span className="text-gray-500">— Recommended</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.semanticSearchThreshold === 0.4}
                      onChange={() => setPreferences({ ...preferences, semanticSearchThreshold: 0.4 })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">
                      Low (cast wide net, 0.4+ match)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent Learning Preferences */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Agent Learning Preferences</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.contributeToLearning}
              onChange={(e) => setPreferences({ ...preferences, contributeToLearning: e.target.checked })}
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Help improve agent accuracy</div>
              <div className="text-sm text-gray-600 mt-1">
                Your corrections help agents learn patterns and improve over time
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.requestFeedback}
              onChange={(e) => setPreferences({ ...preferences, requestFeedback: e.target.checked })}
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Ask me to rate agent results</div>
              <div className="text-sm text-gray-600 mt-1">
                Quick thumbs up/down after each analysis to track accuracy
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.autoSubmitCorrections}
              onChange={(e) => setPreferences({ ...preferences, autoSubmitCorrections: e.target.checked })}
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Auto-submit corrections (advanced)</div>
              <div className="text-sm text-gray-600 mt-1">
                When you edit agent outputs, automatically submit as training data
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Data Privacy */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900">Data Privacy</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.includeDocuments}
              onChange={(e) => setPreferences({ ...preferences, includeDocuments: e.target.checked })}
              className="mt-1 w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Include my documents in intelligence layer</div>
              <div className="text-sm text-gray-600 mt-1">
                Your documents help improve agent accuracy for similar deals.
                Documents remain private to your organization.
              </div>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keep agent task history for
            </label>
            <select
              value={preferences.taskHistoryRetentionDays}
              onChange={(e) => setPreferences({ ...preferences, taskHistoryRetentionDays: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days (recommended)</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
              <option value={730}>2 years</option>
              <option value={-1}>Forever</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Older task history is automatically archived for compliance
            </p>
          </div>
        </div>
      </div>

      {/* My Intelligence Stats */}
      {stats && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">My Intelligence Stats (Last 30 Days)</h2>
            </div>
            <a
              href="/admin/intelligence"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Detailed Analytics →
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.agentTasksRun}</div>
              <div className="text-sm text-gray-600 mt-1">Agent Tasks Run</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.resultsApproved}</div>
              <div className="text-sm text-gray-600 mt-1">Results Approved ({approvalRate}%)</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{stats.correctionsMade}</div>
              <div className="text-sm text-gray-600 mt-1">Corrections Made</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.patternsDiscovered}</div>
              <div className="text-sm text-gray-600 mt-1">Patterns Discovered</div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          Changes apply immediately to agent queries
        </div>
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
}
