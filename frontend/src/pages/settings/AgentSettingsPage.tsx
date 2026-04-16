/**
 * Agent AI Settings Page
 * 
 * Allows users to configure which AI model powers each agent role.
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, RotateCcw, Brain, Target, Building2, 
  TrendingUp, BarChart3, Newspaper, ShieldAlert, 
  Landmark, DollarSign, Map, Sparkles, Zap, Clock
} from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import api from '../../lib/api';
import { 
  AGENT_DEFINITIONS, 
  AI_MODELS, 
  AIModel, 
  AgentDefinition,
  AgentCategory 
} from '../../services/agentRegistry';

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Brain, Target, Building2, TrendingUp, BarChart3, 
  Newspaper, ShieldAlert, Landmark, DollarSign, Map,
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Brain;
}

// ============================================================================
// Model Selector
// ============================================================================

interface ModelSelectorProps {
  agent: AgentDefinition;
  selectedModel: AIModel;
  onChange: (model: AIModel) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ agent, selectedModel, onChange }) => {
  const [open, setOpen] = useState(false);
  const IconComponent = getIconComponent(agent.icon);

  return (
    <div style={{
      background: T.bg.panelAlt,
      borderRadius: 12,
      border: `1px solid ${T.border.subtle}`,
      overflow: 'hidden',
    }}>
      {/* Agent header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${T.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${agent.color}20`,
          border: `2px solid ${agent.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <IconComponent size={20} color={agent.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            color: T.text.primary, 
            fontWeight: 600, 
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {agent.name}
            <span style={{
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 4,
              background: `${agent.color}20`,
              color: agent.color,
              textTransform: 'uppercase',
            }}>
              {agent.category}
            </span>
          </div>
          <div style={{ color: T.text.muted, fontSize: 11, marginTop: 2 }}>
            {agent.description}
          </div>
        </div>
      </div>

      {/* Model selector */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ 
          fontSize: 10, 
          color: T.text.muted, 
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          AI Model
        </div>
        
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: T.bg.terminal,
            border: `1px solid ${T.border.medium}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: T.text.primary,
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} color={T.text.amber} />
            <span>{AI_MODELS[selectedModel].name}</span>
            <span style={{ 
              fontSize: 10, 
              color: T.text.muted,
              padding: '2px 6px',
              background: T.bg.panelAlt,
              borderRadius: 4,
            }}>
              {AI_MODELS[selectedModel].provider}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ 
              fontSize: 10, 
              color: AI_MODELS[selectedModel].cost === '$' ? T.text.green : 
                     AI_MODELS[selectedModel].cost === '$$' ? T.text.amber : T.text.orange,
            }}>
              {AI_MODELS[selectedModel].cost}
            </span>
          </div>
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{
            marginTop: 8,
            background: T.bg.terminal,
            border: `1px solid ${T.border.medium}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {Object.entries(AI_MODELS).map(([key, model]) => {
              const isSelected = key === selectedModel;
              const isRecommended = agent.recommendedModels.includes(key as AIModel);
              
              return (
                <button
                  key={key}
                  onClick={() => {
                    onChange(key as AIModel);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: isSelected ? `${agent.color}15` : 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${T.border.subtle}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    color: T.text.primary,
                    fontSize: 12,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{model.name}</span>
                    <span style={{ fontSize: 10, color: T.text.muted }}>{model.provider}</span>
                    {isRecommended && (
                      <span style={{ 
                        fontSize: 9, 
                        color: T.text.green,
                        padding: '1px 4px',
                        background: `${T.text.green}20`,
                        borderRadius: 3,
                      }}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} color={T.text.muted} />
                      <span style={{ fontSize: 10, color: T.text.muted }}>{model.speed}</span>
                    </div>
                    <span style={{ 
                      fontSize: 10, 
                      color: model.cost === '$' ? T.text.green : 
                             model.cost === '$$' ? T.text.amber : T.text.orange,
                    }}>
                      {model.cost}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Capabilities preview */}
        <div style={{ marginTop: 12 }}>
          <div style={{ 
            fontSize: 10, 
            color: T.text.muted, 
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Capabilities
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {agent.capabilities.slice(0, 3).map((cap, i) => (
              <span key={i} style={{
                fontSize: 10,
                padding: '3px 8px',
                background: T.bg.terminal,
                borderRadius: 4,
                color: T.text.secondary,
              }}>
                {cap}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

export const AgentSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, AIModel>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/agents/models');
      if (response.data?.success && response.data.data) {
        // Map from {globalModel, agentOverrides} to flat Record
        const data = response.data.data;
        const loaded: Record<string, AIModel> = {};
        AGENT_DEFINITIONS.forEach(agent => {
          loaded[agent.code] = (data.agentOverrides?.[agent.code] || data.globalModel || agent.defaultModel) as AIModel;
        });
        setSettings(loaded);
      } else {
        // Use defaults
        const defaults: Record<string, AIModel> = {};
        AGENT_DEFINITIONS.forEach(agent => {
          defaults[agent.code] = agent.defaultModel;
        });
        setSettings(defaults);
      }
    } catch {
      // Use defaults on error
      const defaults: Record<string, AIModel> = {};
      AGENT_DEFINITIONS.forEach(agent => {
        defaults[agent.code] = agent.defaultModel;
      });
      setSettings(defaults);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (agentCode: string, model: AIModel) => {
    setSettings(prev => ({ ...prev, [agentCode]: model }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert flat settings to {globalModel, agentOverrides} format
      const globalModel = settings['ORCHESTRATOR'] || 'claude-3-sonnet';
      const agentOverrides: Record<string, string> = {};
      
      Object.entries(settings).forEach(([code, model]) => {
        // Only store overrides that differ from global
        if (model !== globalModel) {
          agentOverrides[code] = model;
        }
      });

      await api.put('/settings/agents/models', {
        globalModel,
        agentOverrides,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaults: Record<string, AIModel> = {};
    AGENT_DEFINITIONS.forEach(agent => {
      defaults[agent.code] = agent.defaultModel;
    });
    setSettings(defaults);
    setHasChanges(true);
  };

  const coreAgents = AGENT_DEFINITIONS.filter(a => a.category === 'core');
  const analystAgents = AGENT_DEFINITIONS.filter(a => a.category === 'analyst');
  const specialistAgents = AGENT_DEFINITIONS.filter(a => a.category === 'specialist');

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        color: T.text.muted,
      }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{
      padding: 24,
      maxWidth: 1200,
      margin: '0 auto',
      fontFamily: T.font.mono,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent',
              border: 'none',
              color: T.text.muted,
              cursor: 'pointer',
              padding: 8,
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ 
              color: T.text.primary, 
              fontSize: 24, 
              fontWeight: 700,
              margin: 0,
            }}>
              Agent AI Settings
            </h1>
            <p style={{ color: T.text.muted, fontSize: 13, margin: '4px 0 0' }}>
              Configure which AI model powers each agent role
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleReset}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: `1px solid ${T.border.medium}`,
              borderRadius: 8,
              color: T.text.secondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
            }}
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              padding: '10px 20px',
              background: hasChanges ? T.text.cyan : T.bg.panelAlt,
              border: 'none',
              borderRadius: 8,
              color: hasChanges ? '#000' : T.text.muted,
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Cost legend */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        padding: '12px 16px',
        background: T.bg.panelAlt,
        borderRadius: 8,
        fontSize: 11,
      }}>
        <span style={{ color: T.text.muted }}>Cost:</span>
        <span style={{ color: T.text.green }}>$ Low</span>
        <span style={{ color: T.text.amber }}>$$ Medium</span>
        <span style={{ color: T.text.orange }}>$$$ High</span>
        <span style={{ color: T.text.muted, marginLeft: 16 }}>|</span>
        <span style={{ color: T.text.muted, marginLeft: 8 }}>Speed:</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.text.secondary }}>
          <Zap size={12} /> Fast
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.text.secondary }}>
          <Clock size={12} /> Medium/Slow
        </span>
      </div>

      {/* Core Agents */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          color: T.text.cyan, 
          fontSize: 14, 
          fontWeight: 700,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Core Agents
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: 16 
        }}>
          {coreAgents.map(agent => (
            <ModelSelector
              key={agent.code}
              agent={agent}
              selectedModel={settings[agent.code] || agent.defaultModel}
              onChange={(model) => handleModelChange(agent.code, model)}
            />
          ))}
        </div>
      </div>

      {/* Analyst Agents */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          color: T.text.green, 
          fontSize: 14, 
          fontWeight: 700,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Analyst Agents
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: 16 
        }}>
          {analystAgents.map(agent => (
            <ModelSelector
              key={agent.code}
              agent={agent}
              selectedModel={settings[agent.code] || agent.defaultModel}
              onChange={(model) => handleModelChange(agent.code, model)}
            />
          ))}
        </div>
      </div>

      {/* Specialist Agents */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          color: T.text.purple, 
          fontSize: 14, 
          fontWeight: 700,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Specialist Agents
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: 16 
        }}>
          {specialistAgents.map(agent => (
            <ModelSelector
              key={agent.code}
              agent={agent}
              selectedModel={settings[agent.code] || agent.defaultModel}
              onChange={(model) => handleModelChange(agent.code, model)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AgentSettingsPage;
