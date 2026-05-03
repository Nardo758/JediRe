/**
 * Skills AI Settings Page
 * 
 * Configure the AI model and enable/disable individual skills.
 * 18 Skills to match original agent coverage.
 * 
 * @version 2.0.0
 * @date 2026-04-22
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, RotateCcw, Brain, Sparkles, Zap, Clock,
  Database, Search, FileText, Edit3, MessageSquare, BarChart3, FileOutput,
  ToggleLeft, ToggleRight, Info, DollarSign, Shield, Scale, FileSearch,
  TreeDeciduous, ClipboardCheck, TrendingUp, RefreshCw, LineChart, Megaphone,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import api from '../../lib/api';

// ============================================================================
// SKILL DEFINITIONS - 18 SKILLS
// ============================================================================

interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'analysis' | 'document' | 'action' | 'report' | 'advisor';
  icon: string;
  color: string;
  enabled: boolean;
  requiresConfirmation?: boolean;
}

const ADVISOR_COLOR = '#FF6FB5';

const ADVISOR_DEFS: { id: string; name: string; description: string }[] = [
  { id: 'consult_cfo',                name: 'CFO',                  description: 'Financial strategy, capital structure, risk-adjusted returns, value creation' },
  { id: 'consult_accountant',         name: 'Accountant',           description: 'GAAP treatment, audit-readiness, expense classification, reconciliations' },
  { id: 'consult_marketing_expert',   name: 'Marketing Expert',     description: 'Positioning, lease-up strategy, branding, competitive differentiation' },
  { id: 'consult_developer',          name: 'Developer',            description: 'Construction feasibility, value-add scope, hard/soft cost framing' },
  { id: 'consult_legal_advisor',      name: 'Legal Advisor',        description: 'Contract review, indemnification, structural risk, regulatory exposure' },
  { id: 'consult_lender',             name: 'Lender',               description: 'Debt sizing, DSCR/LTV, credit-committee perspective on the deal' },
  { id: 'consult_acquisitions',       name: 'Acquisitions',         description: 'Go/no-go on new deals, pricing strategy, LOI tactics' },
  { id: 'consult_asset_manager',      name: 'Asset Manager',        description: 'NOI optimization, expense control, value-creation initiatives' },
  { id: 'consult_property_manager',   name: 'Property Manager',     description: 'Day-to-day operations, retention, maintenance, staffing' },
  { id: 'consult_leasing_director',   name: 'Leasing Director',     description: 'Vacancy reduction, renewals, concession strategy, market rent' },
  { id: 'consult_facilities_manager', name: 'Facilities Manager',   description: 'CapEx planning, reserves, building systems, vendor management' },
  { id: 'consult_investment_analyst', name: 'Investment Analyst',   description: 'Hold/sell timing, refinance windows, IRR optimization' },
  { id: 'consult_esg_sustainability', name: 'ESG / Sustainability', description: 'Energy efficiency, certifications, ESG-linked financing' },
  { id: 'consult_compliance_officer', name: 'Compliance Officer',   description: 'Insurance, permits, ADA, fair housing, regulatory compliance' },
  { id: 'consult_tax_strategist',     name: 'Tax Strategist',       description: 'Cost segregation, 1031 exchange, depreciation, K-1 optimization' },
  { id: 'consult_researcher',         name: 'Researcher',           description: 'Demographics, employment trends, supply pipeline, competitive intelligence' },
];

const ADVISOR_SKILLS: SkillDefinition[] = ADVISOR_DEFS.map(a => ({
  id: a.id,
  name: a.name,
  description: a.description,
  category: 'advisor',
  icon: 'Brain',
  color: ADVISOR_COLOR,
  enabled: true,
}));

const DEFAULT_SKILLS: SkillDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA SKILLS (5)
  // ═══════════════════════════════════════════════════════════════════════════
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
    id: 'query_debt_market', 
    name: 'Query Debt Market', 
    description: 'Get CMBS spreads, agency rates, bank lending terms, life company debt options',
    category: 'data',
    icon: 'DollarSign',
    color: '#00B4D8',
    enabled: true,
  },
  { 
    id: 'query_tax_implications', 
    name: 'Tax Implications', 
    description: 'Analyze depreciation, 1031 exchange eligibility, cost segregation, tax projections',
    category: 'data',
    icon: 'DollarSign',
    color: '#00B4D8',
    enabled: true,
  },
  { 
    id: 'query_compliance_status', 
    name: 'Compliance Status', 
    description: 'Check insurance coverage, permits, inspections, and regulatory requirements',
    category: 'data',
    icon: 'Shield',
    color: '#00B4D8',
    enabled: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT SKILLS (4)
  // ═══════════════════════════════════════════════════════════════════════════
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
    id: 'review_contract', 
    name: 'Review Contract', 
    description: 'Analyze contracts for key terms, risks, compliance issues, and obligations',
    category: 'document',
    icon: 'Scale',
    color: '#F6A623',
    enabled: true,
  },
  { 
    id: 'analyze_appraisal', 
    name: 'Analyze Appraisal', 
    description: 'Extract comparable sales, income approach, and cost approach values from appraisals',
    category: 'document',
    icon: 'FileSearch',
    color: '#F6A623',
    enabled: true,
  },
  { 
    id: 'parse_environmental_report', 
    name: 'Environmental Report', 
    description: 'Parse Phase I/II environmental site assessments and flag concerns',
    category: 'document',
    icon: 'TreeDeciduous',
    color: '#F6A623',
    enabled: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION SKILLS (4)
  // ═══════════════════════════════════════════════════════════════════════════
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
    id: 'create_task', 
    name: 'Create Task', 
    description: 'Create tasks and action items for the deal team with due dates and assignees',
    category: 'action',
    icon: 'ClipboardCheck',
    color: '#00D26A',
    enabled: true,
  },
  { 
    id: 'update_deal_status', 
    name: 'Update Deal Status', 
    description: 'Move deals through pipeline stages (screening, underwriting, LOI, DD, closing)',
    category: 'action',
    icon: 'TrendingUp',
    color: '#00D26A',
    enabled: true,
    requiresConfirmation: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYSIS SKILLS (3)
  // ═══════════════════════════════════════════════════════════════════════════
  { 
    id: 'run_return_analysis', 
    name: 'Return Analysis', 
    description: 'Calculate IRR, equity multiple, cash-on-cash returns, and sensitivity analysis',
    category: 'analysis',
    icon: 'LineChart',
    color: '#B794F4',
    enabled: true,
  },
  { 
    id: 'run_refi_analysis', 
    name: 'Refinance Analysis', 
    description: 'Analyze cash-out proceeds, new loan terms, and impact on returns',
    category: 'analysis',
    icon: 'RefreshCw',
    color: '#B794F4',
    enabled: true,
  },
  { 
    id: 'run_hold_sell_analysis', 
    name: 'Hold/Sell Analysis', 
    description: 'Evaluate hold vs sell based on current market conditions and projections',
    category: 'analysis',
    icon: 'BarChart3',
    color: '#B794F4',
    enabled: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT SKILLS (2)
  // ═══════════════════════════════════════════════════════════════════════════
  { 
    id: 'generate_report', 
    name: 'Generate Report', 
    description: 'Create investment memos, quarterly updates, NOI waterfalls, and DD checklists',
    category: 'report',
    icon: 'FileOutput',
    color: '#E8F4FD',
    enabled: true,
  },
  { 
    id: 'generate_marketing_materials', 
    name: 'Marketing Materials', 
    description: 'Create property flyers, investor updates, disposition teasers, lease brochures',
    category: 'report',
    icon: 'Megaphone',
    color: '#E8F4FD',
    enabled: true,
  },
  ...ADVISOR_SKILLS,
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
  DollarSign, Shield, Scale, FileSearch, TreeDeciduous, ClipboardCheck, TrendingUp,
  RefreshCw, LineChart, Megaphone,
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Brain;
}

// ============================================================================
// Skill Card Component (compact grid card)
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
      borderRadius: 8,
      border: `1px solid ${skill.enabled ? skill.color + '44' : T.border.subtle}`,
      padding: '10px 12px',
      opacity: skill.enabled ? 1 : 0.55,
      transition: 'all 0.2s',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: `${skill.color}20`,
            border: `1.5px solid ${skill.enabled ? skill.color : T.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconComponent size={14} color={skill.enabled ? skill.color : T.text.muted} />
          </div>
          <span style={{
            color: T.text.primary,
            fontWeight: 600,
            fontSize: 11,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {skill.name}
          </span>
        </div>
        <button
          onClick={onToggle}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
        >
          {skill.enabled ? (
            <ToggleRight size={22} color={skill.color} />
          ) : (
            <ToggleLeft size={22} color={T.text.muted} />
          )}
        </button>
      </div>

      <p style={{
        color: T.text.muted,
        fontSize: 10,
        margin: 0,
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
      }}>
        {skill.description}
      </p>

      {skill.requiresConfirmation && (
        <span style={{
          fontSize: 9,
          padding: '1px 5px',
          borderRadius: 3,
          background: `${T.text.amber}20`,
          color: T.text.amber,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          alignSelf: 'flex-start',
        }}>
          <Info size={8} /> Requires Confirm
        </span>
      )}
    </div>
  );
};

// ============================================================================
// Collapsible Skill Section
// ============================================================================

interface SkillSectionProps {
  label: string;
  emoji: string;
  color: string;
  skills: SkillDefinition[];
  onToggle: (id: string) => void;
  collapsed: boolean;
  onCollapse: () => void;
}

const SkillSection: React.FC<SkillSectionProps> = ({ label, emoji, color, skills, onToggle, collapsed, onCollapse }) => {
  const enabledCount = skills.filter(s => s.enabled).length;

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={onCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 0',
          marginBottom: collapsed ? 0 : 12,
          width: '100%',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13 }}>{emoji}</span>
        <span style={{
          color,
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: 1,
          fontFamily: T.font.mono,
        }}>
          {label} ({skills.length})
        </span>
        <span style={{
          fontSize: 9,
          padding: '1px 6px',
          borderRadius: 3,
          background: enabledCount === skills.length ? `${color}20` : `${T.text.amber}20`,
          color: enabledCount === skills.length ? color : T.text.amber,
          marginLeft: 4,
        }}>
          {enabledCount}/{skills.length} on
        </span>
        <span style={{ flex: 1 }} />
        {collapsed
          ? <ChevronRight size={14} color={T.text.muted} />
          : <ChevronDown size={14} color={T.text.muted} />
        }
      </button>

      {!collapsed && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 8,
        }}>
          {skills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={() => onToggle(skill.id)}
            />
          ))}
        </div>
      )}
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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) =>
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

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
  const documentSkills = skills.filter(s => s.category === 'document');
  const actionSkills = skills.filter(s => s.category === 'action');
  const analysisSkills = skills.filter(s => s.category === 'analysis');
  const reportSkills = skills.filter(s => s.category === 'report');
  const advisorSkills = skills.filter(s => s.category === 'advisor');

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
              {skills.length} skills (18 capabilities + 16 advisors) — configure the AI assistant
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

      <SkillSection
        label="Data Skills"
        emoji="📊"
        color="#00B4D8"
        skills={dataSkills}
        onToggle={handleToggleSkill}
        collapsed={!!collapsedSections['data']}
        onCollapse={() => toggleSection('data')}
      />

      <SkillSection
        label="Document Skills"
        emoji="📄"
        color="#F6A623"
        skills={documentSkills}
        onToggle={handleToggleSkill}
        collapsed={!!collapsedSections['document']}
        onCollapse={() => toggleSection('document')}
      />

      <SkillSection
        label="Action Skills"
        emoji="⚡"
        color="#00D26A"
        skills={actionSkills}
        onToggle={handleToggleSkill}
        collapsed={!!collapsedSections['action']}
        onCollapse={() => toggleSection('action')}
      />

      <SkillSection
        label="Analysis Skills"
        emoji="📈"
        color="#B794F4"
        skills={analysisSkills}
        onToggle={handleToggleSkill}
        collapsed={!!collapsedSections['analysis']}
        onCollapse={() => toggleSection('analysis')}
      />

      <SkillSection
        label="Report Skills"
        emoji="📋"
        color="#E8F4FD"
        skills={reportSkills}
        onToggle={handleToggleSkill}
        collapsed={!!collapsedSections['report']}
        onCollapse={() => toggleSection('report')}
      />

      <SkillSection
        label="Advisor Personas"
        emoji="🧠"
        color={ADVISOR_COLOR}
        skills={advisorSkills}
        onToggle={handleToggleSkill}
        collapsed={!!collapsedSections['advisor']}
        onCollapse={() => toggleSection('advisor')}
      />
    </div>
  );
};

export default SkillsSettingsPage;
