/**
 * AI Model Settings Page
 * Allows users to configure their AI model preferences
 * 
 * Location: frontend/src/pages/settings/AIModelSettings.tsx
 * Add route in App.tsx: <Route path="/settings/ai" element={<AIModelSettings />} />
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

// Bloomberg Terminal tokens
const BT = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538', input: '#0D1117' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', cyan: '#00BCD4' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
};

const MONO = "'JetBrains Mono', 'Fira Code', monospace";

interface AIModel {
  modelId: string;
  displayName: string;
  provider: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsThinking: boolean;
}

interface AIPreferences {
  defaultModel: string;
  riskAnalysisModel: string;
  strategyModel: string;
  chatModel: string;
  enableStreaming: boolean;
  enableThinking: boolean;
  maxTokens: number;
  temperature: number;
  isDefault?: boolean;
}

export default function AIModelSettings() {
  const { user } = useAuth();
  const [models, setModels] = useState<AIModel[]>([]);
  const [preferences, setPreferences] = useState<AIPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [modelsRes, prefsRes] = await Promise.all([
        fetch('/api/v1/ai-preferences/models'),
        fetch('/api/v1/ai-preferences'),
      ]);

      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModels(data.models || []);
      }

      if (prefsRes.ok) {
        const data = await prefsRes.json();
        setPreferences(data);
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/v1/ai-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/v1/ai-preferences/reset', { method: 'POST' });
      if (res.ok) {
        await fetchData();
        setSuccess('Settings reset to defaults');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError('Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof AIPreferences, value: any) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  if (loading) {
    return (
      <div style={{ padding: 32, background: BT.bg.terminal, minHeight: '100vh', color: BT.text.primary }}>
        <span style={{ fontFamily: MONO, color: BT.text.amber }}>Loading AI settings...</span>
      </div>
    );
  }

  const ModelSelect = ({ 
    label, 
    value, 
    onChange,
    description 
  }: { 
    label: string; 
    value: string; 
    onChange: (v: string) => void;
    description: string;
  }) => (
    <div style={{ marginBottom: 24 }}>
      <label style={{ 
        display: 'block', 
        fontFamily: MONO, 
        fontSize: 11, 
        color: BT.text.amber, 
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: BT.bg.input,
          border: `1px solid ${BT.border.medium}`,
          borderRadius: 4,
          color: BT.text.primary,
          fontFamily: MONO,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {models.map((m) => (
          <option key={m.modelId} value={m.modelId}>
            {m.displayName} {m.supportsThinking ? '(+Thinking)' : ''}
          </option>
        ))}
      </select>
      <p style={{ 
        fontFamily: MONO, 
        fontSize: 10, 
        color: BT.text.muted, 
        marginTop: 4 
      }}>
        {description}
      </p>
    </div>
  );

  return (
    <div style={{ 
      padding: 32, 
      background: BT.bg.terminal, 
      minHeight: '100vh',
      color: BT.text.primary 
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ 
          fontFamily: MONO, 
          fontSize: 18, 
          color: BT.text.amber, 
          marginBottom: 8,
          fontWeight: 600 
        }}>
          AI MODEL PREFERENCES
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 12, color: BT.text.secondary }}>
          Configure which AI models JEDI uses for different tasks
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ 
          padding: 12, 
          background: '#FF475722', 
          border: '1px solid #FF4757', 
          borderRadius: 4, 
          marginBottom: 24 
        }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: '#FF4757' }}>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ 
          padding: 12, 
          background: '#00D26A22', 
          border: '1px solid #00D26A', 
          borderRadius: 4, 
          marginBottom: 24 
        }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: '#00D26A' }}>{success}</span>
        </div>
      )}

      {preferences && (
        <div style={{ 
          background: BT.bg.panel, 
          border: `1px solid ${BT.border.subtle}`, 
          borderRadius: 6, 
          padding: 24,
          maxWidth: 600 
        }}>
          {/* Model Selections */}
          <ModelSelect
            label="Default Model"
            value={preferences.defaultModel}
            onChange={(v) => updatePreference('defaultModel', v)}
            description="Used when no specific model is configured for a task"
          />

          <ModelSelect
            label="Risk Analysis Model"
            value={preferences.riskAnalysisModel}
            onChange={(v) => updatePreference('riskAnalysisModel', v)}
            description="Used for JEDI risk assessments and due diligence analysis"
          />

          <ModelSelect
            label="Strategy Model"
            value={preferences.strategyModel}
            onChange={(v) => updatePreference('strategyModel', v)}
            description="Used for strategy recommendations and arbitrage analysis"
          />

          <ModelSelect
            label="Chat Model"
            value={preferences.chatModel}
            onChange={(v) => updatePreference('chatModel', v)}
            description="Used for Opus Chat and general conversations"
          />

          {/* Divider */}
          <div style={{ 
            height: 1, 
            background: BT.border.subtle, 
            margin: '24px 0' 
          }} />

          {/* Advanced Settings */}
          <h3 style={{ 
            fontFamily: MONO, 
            fontSize: 12, 
            color: BT.text.amber, 
            marginBottom: 16,
            textTransform: 'uppercase' 
          }}>
            Advanced Settings
          </h3>

          {/* Streaming Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={preferences.enableStreaming}
              onChange={(e) => updatePreference('enableStreaming', e.target.checked)}
              style={{ marginRight: 10 }}
            />
            <label style={{ fontFamily: MONO, fontSize: 12, color: BT.text.primary }}>
              Enable streaming responses
            </label>
          </div>

          {/* Temperature Slider */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: 'block', 
              fontFamily: MONO, 
              fontSize: 11, 
              color: BT.text.secondary, 
              marginBottom: 8 
            }}>
              Temperature: {preferences.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.temperature}
              onChange={(e) => updatePreference('temperature', parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontFamily: MONO, 
              fontSize: 9, 
              color: BT.text.muted 
            }}>
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '10px 24px',
                background: saving ? BT.bg.header : BT.text.cyan,
                color: saving ? BT.text.muted : BT.bg.terminal,
                border: 'none',
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>

            <button
              onClick={handleReset}
              disabled={saving}
              style={{
                padding: '10px 24px',
                background: 'transparent',
                color: BT.text.secondary,
                border: `1px solid ${BT.border.medium}`,
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 12,
                cursor: saving ? 'wait' : 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* Model Info */}
      <div style={{ marginTop: 32, maxWidth: 600 }}>
        <h3 style={{ 
          fontFamily: MONO, 
          fontSize: 12, 
          color: BT.text.amber, 
          marginBottom: 16,
          textTransform: 'uppercase' 
        }}>
          Available Models
        </h3>
        <div style={{ 
          display: 'grid', 
          gap: 12 
        }}>
          {models.map((m) => (
            <div 
              key={m.modelId}
              style={{ 
                padding: 16, 
                background: BT.bg.panel, 
                border: `1px solid ${BT.border.subtle}`,
                borderRadius: 4 
              }}
            >
              <div style={{ 
                fontFamily: MONO, 
                fontSize: 13, 
                color: BT.text.primary,
                fontWeight: 600,
                marginBottom: 4 
              }}>
                {m.displayName}
              </div>
              <div style={{ 
                fontFamily: MONO, 
                fontSize: 10, 
                color: BT.text.muted 
              }}>
                {m.modelId}
              </div>
              <div style={{ 
                display: 'flex', 
                gap: 8, 
                marginTop: 8 
              }}>
                {m.supportsStreaming && (
                  <span style={{ 
                    padding: '2px 6px', 
                    background: BT.text.green + '22', 
                    color: BT.text.green,
                    fontFamily: MONO,
                    fontSize: 9,
                    borderRadius: 2 
                  }}>
                    STREAMING
                  </span>
                )}
                {m.supportsThinking && (
                  <span style={{ 
                    padding: '2px 6px', 
                    background: BT.text.amber + '22', 
                    color: BT.text.amber,
                    fontFamily: MONO,
                    fontSize: 9,
                    borderRadius: 2 
                  }}>
                    THINKING
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
