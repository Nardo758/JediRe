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
import { BT } from '@/components/deal/bloomberg-ui';

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
  const [statsError, setStatsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      setStatsError(false);
      const response = await apiClient.get('/api/v1/intelligence/user/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
      setStatsError(true);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await apiClient.put('/api/v1/intelligence/user/preferences', preferences);
      setSaveMessage({ type: 'success', text: 'Preferences saved successfully' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const generateEmbeddings = async () => {
    try {
      await apiClient.post('/api/v1/intelligence/user/generate-embeddings');
      loadStats();
      setSaveMessage({ type: 'success', text: 'Embeddings generation started' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      setSaveMessage({ type: 'error', text: 'Failed to generate embeddings' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8" style={{ border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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
    <div className="space-y-6" style={{ fontFamily: BT.font.label }}>
      {/* My Document Intelligence */}
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5" style={{ color: BT.text.cyan }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>My Document Intelligence</h2>
        </div>

        {stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div className="text-2xl font-bold" style={{ color: BT.text.cyan, fontFamily: BT.font.mono }}>{stats.myDocuments}</div>
                <div className="text-xs mt-1" style={{ color: BT.text.secondary }}>Documents Uploaded</div>
              </div>
              <div className="text-center p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div className="text-2xl font-bold" style={{ color: BT.text.green, fontFamily: BT.font.mono }}>{stats.documentsEmbedded}</div>
                <div className="text-xs mt-1" style={{ color: BT.text.secondary }}>With AI Embeddings</div>
              </div>
              <div className="text-center p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div className="text-2xl font-bold" style={{ color: BT.text.amber, fontFamily: BT.font.mono }}>{stats.pendingEmbeddings}</div>
                <div className="text-xs mt-1" style={{ color: BT.text.secondary }}>Pending Processing</div>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: BT.text.secondary }}>Embedding Progress</span>
                <span className="text-sm font-medium" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{embeddingPct}%</span>
              </div>
              <div className="w-full h-2" style={{ background: BT.bg.input, borderRadius: 0 }}>
                <div
                  className="h-2 transition-all"
                  style={{ width: `${embeddingPct}%`, background: BT.text.cyan, borderRadius: 0 }}
                />
              </div>
            </div>

            {stats.pendingEmbeddings > 0 && (
              <button
                onClick={generateEmbeddings}
                className="w-full px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}
              >
                <Zap className="w-4 h-4" />
                Generate Embeddings for {stats.pendingEmbeddings} Pending Docs
              </button>
            )}
          </div>
        ) : statsError ? (
          <div className="text-center py-4">
            <p className="text-sm mb-2" style={{ color: BT.text.red }}>Failed to load intelligence stats</p>
            <button
              onClick={loadStats}
              className="text-sm font-medium"
              style={{ color: BT.text.cyan }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="text-center py-4" style={{ color: BT.text.muted }}>Loading stats...</div>
        )}
      </div>

      {/* Semantic Search Preferences */}
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5" style={{ color: BT.text.purple }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Semantic Search Preferences</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.semanticSearchEnabled}
              onChange={(e) => setPreferences({ ...preferences, semanticSearchEnabled: e.target.checked })}
              className="mt-1 w-4 h-4"
              style={{ accentColor: BT.text.cyan }}
            />
            <div className="flex-1">
              <div className="font-medium" style={{ color: BT.text.primary }}>Enable Semantic Search</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                Uses AI to find more relevant documents based on meaning, not just keywords.
                Falls back to keyword search if unavailable.
              </div>
            </div>
          </label>

          {preferences.semanticSearchEnabled && (
            <div className="pl-7 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: BT.text.secondary }}>
                  Search Precision
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.semanticSearchThreshold === 0.8}
                      onChange={() => setPreferences({ ...preferences, semanticSearchThreshold: 0.8 })}
                      className="w-4 h-4"
                      style={{ accentColor: BT.text.cyan }}
                    />
                    <span className="text-sm" style={{ color: BT.text.secondary }}>
                      High (only very similar, 0.8+ match)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.semanticSearchThreshold === 0.6}
                      onChange={() => setPreferences({ ...preferences, semanticSearchThreshold: 0.6 })}
                      className="w-4 h-4"
                      style={{ accentColor: BT.text.cyan }}
                    />
                    <span className="text-sm" style={{ color: BT.text.secondary }}>
                      Medium (balanced, 0.6+ match) <span style={{ color: BT.text.muted }}>-- Recommended</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={preferences.semanticSearchThreshold === 0.4}
                      onChange={() => setPreferences({ ...preferences, semanticSearchThreshold: 0.4 })}
                      className="w-4 h-4"
                      style={{ accentColor: BT.text.cyan }}
                    />
                    <span className="text-sm" style={{ color: BT.text.secondary }}>
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
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" style={{ color: BT.text.green }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Agent Learning Preferences</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.contributeToLearning}
              onChange={(e) => setPreferences({ ...preferences, contributeToLearning: e.target.checked })}
              className="mt-1 w-4 h-4"
              style={{ accentColor: BT.text.cyan }}
            />
            <div className="flex-1">
              <div className="font-medium" style={{ color: BT.text.primary }}>Help improve agent accuracy</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                Your corrections help agents learn patterns and improve over time
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.requestFeedback}
              onChange={(e) => setPreferences({ ...preferences, requestFeedback: e.target.checked })}
              className="mt-1 w-4 h-4"
              style={{ accentColor: BT.text.cyan }}
            />
            <div className="flex-1">
              <div className="font-medium" style={{ color: BT.text.primary }}>Ask me to rate agent results</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                Quick thumbs up/down after each analysis to track accuracy
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.autoSubmitCorrections}
              onChange={(e) => setPreferences({ ...preferences, autoSubmitCorrections: e.target.checked })}
              className="mt-1 w-4 h-4"
              style={{ accentColor: BT.text.cyan }}
            />
            <div className="flex-1">
              <div className="font-medium" style={{ color: BT.text.primary }}>Auto-submit corrections (advanced)</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                When you edit agent outputs, automatically submit as training data
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Data Privacy */}
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5" style={{ color: BT.text.red }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Data Privacy</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.includeDocuments}
              onChange={(e) => setPreferences({ ...preferences, includeDocuments: e.target.checked })}
              className="mt-1 w-4 h-4"
              style={{ accentColor: BT.text.cyan }}
            />
            <div className="flex-1">
              <div className="font-medium" style={{ color: BT.text.primary }}>Include my documents in intelligence layer</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>
                Your documents help improve agent accuracy for similar deals.
                Documents remain private to your organization.
              </div>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BT.text.secondary }}>
              Keep agent task history for
            </label>
            <select
              value={String(preferences.taskHistoryRetentionDays ?? 90)}
              onChange={(e) => setPreferences({ ...preferences, taskHistoryRetentionDays: Number.parseInt(e.target.value, 10) })}
              className="w-full px-4 py-2 text-sm"
              style={{ background: BT.bg.input, color: BT.text.primary, border: `1px solid ${BT.border.medium}`, borderRadius: 0, fontFamily: BT.font.label }}
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days (recommended)</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
              <option value={730}>2 years</option>
              <option value={-1}>Forever</option>
            </select>
            <p className="text-xs mt-1" style={{ color: BT.text.muted }}>
              Older task history is automatically archived for compliance
            </p>
          </div>
        </div>
      </div>

      {/* My Intelligence Stats */}
      {stats && (
        <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: BT.text.secondary }} />
              <h2 className="text-lg font-semibold" style={{ color: BT.text.primary }}>My Intelligence Stats (Last 30 Days)</h2>
            </div>
            <a
              href="/admin/intelligence"
              className="text-sm font-medium"
              style={{ color: BT.text.cyan }}
            >
              View Detailed Analytics →
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
              <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{stats.agentTasksRun}</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>Agent Tasks Run</div>
            </div>
            <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
              <div className="text-2xl font-bold" style={{ color: BT.text.green, fontFamily: BT.font.mono }}>{stats.resultsApproved}</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>Results Approved ({approvalRate}%)</div>
            </div>
            <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
              <div className="text-2xl font-bold" style={{ color: BT.text.amber, fontFamily: BT.font.mono }}>{stats.correctionsMade}</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>Corrections Made</div>
            </div>
            <div className="p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
              <div className="text-2xl font-bold" style={{ color: BT.text.purple, fontFamily: BT.font.mono }}>{stats.patternsDiscovered}</div>
              <div className="text-sm mt-1" style={{ color: BT.text.secondary }}>Patterns Discovered</div>
            </div>
          </div>
        </div>
      )}

      {saveMessage && (
        <div className="px-4 py-3 text-sm" style={{
          background: BT.bg.panelAlt,
          color: saveMessage.type === 'success' ? BT.text.green : BT.text.red,
          border: `1px solid ${saveMessage.type === 'success' ? BT.text.green : BT.text.red}`,
          borderRadius: 0,
        }}>
          {saveMessage.text}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
        <div className="text-sm" style={{ color: BT.text.muted }}>
          Changes apply immediately to agent queries
        </div>
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}
        >
          {saving ? (
            <>
              <div className="h-4 w-4" style={{ border: `2px solid transparent`, borderBottom: `2px solid ${BT.bg.terminal}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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
