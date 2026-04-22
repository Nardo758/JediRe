/**
 * Skills AI Settings Page
 * 
 * Configure the AI model and enable/disable individual skills.
 * Skills are tools the AI assistant uses to help analysts.
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, RotateCcw, Brain, Sparkles, Zap, Clock,
  Database, Search, FileText, Edit3, MessageSquare, BarChart3, FileOutput,
  ToggleLeft, ToggleRight, Info
} from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import api from '../../lib/api';

// ============================================================================
// SKILL DEFINITIONS
// ============================================================================

interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'analysis' | 'document' | 'action' | 'report';
  icon: string;
  color: string;
  enabled: boolean;
  requiresConfirmation?: boolean;
}

const DEFAULT_SKILLS: SkillDefinition[] = [
  { 
    id: 'query_deal_data', 
    name: 'Query Deal Data', 
    description: 'Fetch financials, rent roll, assumptions, comps, occupancy, debt, and investor data for deals',
    category: 'data',
    icon: 'Database',
    color: '#00B4D8',
    enabled: true,
  },
  { 
    id: 'search_market_data', 
    name: 'Search Market Data', 
    description: 'Look up MSA-level metrics, rent comps, supply pipeline, and employment data',
    category: 'data',
    icon: 'Search',
    color: '#00B4D8',
    enabled: true,
  },
  { 
    id: 'extract_document', 
    name: 'Extract Document', 
    description: 'Parse uploaded files to extract T-12 income, rent roll, OM details, and appraisal data',
    category: 'document',
    icon: 'FileText',
    color: '#F6A623',
    enabled: true,
  },
  { 
    id: 'update_assumption', 
    name: 'Update Assumption', 
    description: 'Modify underwriting inputs like cap rate, exit year, rent growth, and expense ratios',
    category: 'action',
    icon: 'Edit3',
    color: '#00D26A',
    enabled: true,
    requiresConfirmation: true,
  },
  { 
    id: 'add_note', 
    name: 'Add Note', 
    description: 'Add analyst notes, risk flags, and action items to the deal timeline',
    category: 'action',
    icon: 'MessageSquare',
    color: '#00D26A',
    enabled: true,
  },
  { 
    id: 'run_analysis', 
    name: 'Run Analysis', 
    description: 'Execute IRR sensitivity, refi scenarios, hold period optimization, and comparable analysis',
    category: 'analysis',
    icon: 'BarChart3',
    color: '#B794F4',
    enabled: true,
  },
  { 
    id: 'generate_report', 
    name: 'Generate Report', 
    description: 'Create investment memos, quarterly updates, NOI waterfalls, and custom summaries',
    category: 'report',
    icon: 'FileOutput',
    color: '#E8F4FD',
    enabled: true,
  },
];

// AI Models for the skill engine
const AI_MODELS = {
  'claude-sonnet-4': { name: 'Claude Sonnet 4', provider: 'Anthropic', speed: 'Fast', cost: '$' },
  'claude-opus-4': { name: 'Claude Opus 4', provider: 'Anthropic', speed: 'Medium', cost: '$$$' },
  'gpt-4o': { name: 'GPT-4o', provider: 'OpenAI', speed: 'Fast', cost: '$$' },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', provider: 'OpenAI', speed: 'Medium', cost: '$$' },
};

type AIModel = keyof typeof AI_MODELS;

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Database, Search, FileText, Edit3, MessageSquare, BarChart3, FileOutput, Brain,
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Brain;
}

// ============================================================================
// Skill Card Component
// ============================================================================

interface SkillCardProps {
  skill: SkillDefinition;
  onToggle: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, onToggle }) => {
  const IconComponent = getIconComponent(skill.icon);

  return (
    <div style={{
      background: T.bg.panelAlt,
      borderRadius: 12,
      border: `1px solid ${skill.enabled ? skill.color + '44' : T.border.subtle}`,
      padding: 16,
      opacity: skill.enabled ? 1 : 0.6,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${skill.color}20`,
          border: `2px solid ${skill.enabled ? skill.color : T.border.subtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <IconComponent size={20} color={skill.enabled ? skill.color : T.text.muted} />
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <div style={{ 
              color: T.text.primary, 
              fontWeight: 600, 
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {skill.name}
              <span style={{
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                background: `${skill.color}20`,
                color: skill.color,
                textTransform: 'uppercase',
              }}>
                {skill.category}
              </span>
              {skill.requiresConfirmation && (
                <span style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: `${T.text.amber}20`,
                  color: T.text.amber,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}>
                  <Info size={8} /> Requires Confirmation
                </span>
              )}
            </div>
            
            <button
              onClick={onToggle}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {skill.enabled ? (
                <ToggleRight size={28} color={skill.color} />
              ) : (
                <ToggleLeft size={28} color={T.text.muted} />
              )}
            </button>
          </div>
          
          <p style={{ 
            color: T.text.secondary, 
            fontSize: 11, 
            margin: 0,
            lineHeight: 1.4,
          }}>
            {skill.description}
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

export const SkillsSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillDefinition[]>(DEFAULT_SKILLS);
  const [selectedModel, setSelectedModel] = useState<AIModel>('claude-sonnet-4');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/skills');
      if (response.data?.success) {
        setSelectedModel(response.data.model || 'claude-sonnet-4');
        if (response.data.skills) {
          setSkills(skills.map(s => ({
            ...s,
            enabled: response.data.skills[s.id]?.enabled ?? s.enabled,
          })));
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSkill = (skillId: string) => {
    setSkills(prev => prev.map(s => 
      s.id === skillId ? { ...s, enabled: !s.enabled } : s
    ));
    setHasChanges(true);
  };

  const handleModelChange = (model: AIModel) => {
    setSelectedModel(model);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/skills', {
        model: selectedModel,
        skills: Object.fromEntries(skills.map(s => [s.id, { enabled: s.enabled }])),
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSkills(DEFAULT_SKILLS);
    setSelectedModel('claude-sonnet-4');
    setHasChanges(true);
  };

  const dataSkills = skills.filter(s => s.category === 'data');
  const actionSkills = skills.filter(s => s.category === 'action');
  const analysisSkills = skills.filter(s => s.category === 'analysis' || s.category === 'document' || s.category === 'report');

  const enabledCount = skills.filter(s => s.enabled).length;

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
      maxWidth: 1000,
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
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <Sparkles size={24} color={T.text.cyan} />
              AI Skills Settings
            </h1>
            <p style={{ color: T.text.muted, fontSize: 13, margin: '4px 0 0' }}>
              Configure the AI assistant's capabilities
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
            Reset
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

      {/* AI Model Selection */}
      <div style={{
        background: T.bg.panelAlt,
        borderRadius: 12,
        padding: 20,
        marginBottom: 32,
        border: `1px solid ${T.border.subtle}`,
      }}>
        <h2 style={{ 
          color: T.text.primary, 
          fontSize: 14, 
          fontWeight: 700,
          margin: '0 0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Brain size={16} color={T.text.cyan} />
          AI Model
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {Object.entries(AI_MODELS).map(([key, model]) => {
            const isSelected = key === selectedModel;
            return (
              <button
                key={key}
                onClick={() => handleModelChange(key as AIModel)}
                style={{
                  padding: '14px 16px',
                  background: isSelected ? `${T.text.cyan}15` : T.bg.terminal,
                  border: `2px solid ${isSelected ? T.text.cyan : T.border.subtle}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ 
                  color: T.text.primary, 
                  fontWeight: 600, 
                  fontSize: 13,
                  marginBottom: 4,
                }}>
                  {model.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                  <span style={{ color: T.text.muted }}>{model.provider}</span>
                  <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 3,
                    color: model.speed === 'Fast' ? T.text.green : T.text.amber,
                  }}>
                    <Zap size={10} /> {model.speed}
                  </span>
                  <span style={{ 
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
      </div>

      {/* Skills Status */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        padding: '12px 16px',
        background: T.bg.panelAlt,
        borderRadius: 8,
        fontSize: 12,
        alignItems: 'center',
      }}>
        <span style={{ color: T.text.muted }}>Skills Enabled:</span>
        <span style={{ 
          color: enabledCount === skills.length ? T.text.green : T.text.amber,
          fontWeight: 600,
        }}>
          {enabledCount} / {skills.length}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: T.text.muted, fontSize: 10 }}>
          Disabled skills will not be available to the AI assistant
        </span>
      </div>

      {/* Data Skills */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          color: '#00B4D8', 
          fontSize: 14, 
          fontWeight: 700,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Data Skills
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dataSkills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={() => handleToggleSkill(skill.id)}
            />
          ))}
        </div>
      </div>

      {/* Action Skills */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          color: '#00D26A', 
          fontSize: 14, 
          fontWeight: 700,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Action Skills
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {actionSkills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={() => handleToggleSkill(skill.id)}
            />
          ))}
        </div>
      </div>

      {/* Analysis & Report Skills */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          color: '#B794F4', 
          fontSize: 14, 
          fontWeight: 700,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          Analysis & Report Skills
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {analysisSkills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={() => handleToggleSkill(skill.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkillsSettingsPage;
