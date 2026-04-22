/**
 * Skills Bar - Compact skills selector for AI capabilities
 * 
 * Features:
 * - 18 skills matching original agent coverage
 * - Scrollable row of skill icons by category
 * - Core skills always visible
 * - Click to see skill info
 * 
 * @version 4.0.0
 * @date 2026-04-22
 */

import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Settings,
  Database, Search, FileText, Edit3, MessageSquare, BarChart3, FileOutput,
  Brain, Sparkles, Layers, DollarSign, Shield, Scale, FileSearch,
  TreeDeciduous, ClipboardCheck, TrendingUp, RefreshCw, LineChart, Megaphone
} from 'lucide-react';
import { T } from '../../styles/terminal-tokens';

// ============================================================================
// SKILL DEFINITIONS - 18 SKILLS
// ============================================================================

interface SkillDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: 'data' | 'analysis' | 'document' | 'action' | 'report';
  icon: string;
  color: string;
}

const SKILLS: SkillDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA SKILLS (5)
  // ═══════════════════════════════════════════════════════════════════════════
  { 
    id: 'query_deal_data', 
    name: 'Query Deal Data', 
    shortName: 'DATA',
    description: 'Fetch financials, rent roll, assumptions, comps, occupancy, debt, and investor data',
    category: 'data',
    icon: 'Database',
    color: '#00B4D8',
  },
  { 
    id: 'search_market_data', 
    name: 'Search Market', 
    shortName: 'MARKET',
    description: 'MSA metrics, rent comps, supply pipeline, employment data',
    category: 'data',
    icon: 'Search',
    color: '#00B4D8',
  },
  { 
    id: 'query_debt_market', 
    name: 'Debt Market', 
    shortName: 'DEBT',
    description: 'CMBS spreads, agency rates, bank lending terms, life company options',
    category: 'data',
    icon: 'DollarSign',
    color: '#00B4D8',
  },
  { 
    id: 'query_tax_implications', 
    name: 'Tax Analysis', 
    shortName: 'TAX',
    description: 'Depreciation, 1031 exchange, cost segregation, tax projections',
    category: 'data',
    icon: 'DollarSign',
    color: '#00B4D8',
  },
  { 
    id: 'query_compliance_status', 
    name: 'Compliance Check', 
    shortName: 'COMPLY',
    description: 'Insurance, permits, inspections, regulatory requirements',
    category: 'data',
    icon: 'Shield',
    color: '#00B4D8',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT SKILLS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  { 
    id: 'extract_document', 
    name: 'Extract Document', 
    shortName: 'EXTRACT',
    description: 'Parse T-12, rent roll, OM from uploaded files',
    category: 'document',
    icon: 'FileText',
    color: '#F6A623',
  },
  { 
    id: 'review_contract', 
    name: 'Review Contract', 
    shortName: 'CONTRACT',
    description: 'Analyze contracts for key terms, risks, and compliance',
    category: 'document',
    icon: 'Scale',
    color: '#F6A623',
  },
  { 
    id: 'analyze_appraisal', 
    name: 'Analyze Appraisal', 
    shortName: 'APPRAISAL',
    description: 'Extract comparable sales, income approach, cost approach values',
    category: 'document',
    icon: 'FileSearch',
    color: '#F6A623',
  },
  { 
    id: 'parse_environmental_report', 
    name: 'Environmental Report', 
    shortName: 'ENVIRON',
    description: 'Parse Phase I/II environmental site assessments',
    category: 'document',
    icon: 'TreeDeciduous',
    color: '#F6A623',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION SKILLS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  { 
    id: 'update_assumption', 
    name: 'Update Assumption', 
    shortName: 'UPDATE',
    description: 'Change cap rate, exit year, rent growth, expense ratios',
    category: 'action',
    icon: 'Edit3',
    color: '#00D26A',
  },
  { 
    id: 'add_note', 
    name: 'Add Note', 
    shortName: 'NOTE',
    description: 'Add analyst notes, risk flags, and action items',
    category: 'action',
    icon: 'MessageSquare',
    color: '#00D26A',
  },
  { 
    id: 'create_task', 
    name: 'Create Task', 
    shortName: 'TASK',
    description: 'Create tasks and action items for the deal team',
    category: 'action',
    icon: 'ClipboardCheck',
    color: '#00D26A',
  },
  { 
    id: 'update_deal_status', 
    name: 'Update Status', 
    shortName: 'STATUS',
    description: 'Move deal through pipeline stages',
    category: 'action',
    icon: 'TrendingUp',
    color: '#00D26A',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYSIS SKILLS (3)
  // ═══════════════════════════════════════════════════════════════════════════
  { 
    id: 'run_return_analysis', 
    name: 'Return Analysis', 
    shortName: 'RETURNS',
    description: 'Calculate IRR, equity multiple, cash-on-cash, sensitivity',
    category: 'analysis',
    icon: 'LineChart',
    color: '#B794F4',
  },
  { 
    id: 'run_refi_analysis', 
    name: 'Refinance Analysis', 
    shortName: 'REFI',
    description: 'Analyze cash-out proceeds, new loan terms, impact on returns',
    category: 'analysis',
    icon: 'RefreshCw',
    color: '#B794F4',
  },
  { 
    id: 'run_hold_sell_analysis', 
    name: 'Hold/Sell Analysis', 
    shortName: 'HOLD/SELL',
    description: 'Evaluate hold vs sell based on market conditions',
    category: 'analysis',
    icon: 'BarChart3',
    color: '#B794F4',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT SKILLS (2)
  // ═══════════════════════════════════════════════════════════════════════════
  { 
    id: 'generate_report', 
    name: 'Generate Report', 
    shortName: 'REPORT',
    description: 'Investment memos, NOI waterfalls, DD checklists',
    category: 'report',
    icon: 'FileOutput',
    color: '#E8F4FD',
  },
  { 
    id: 'generate_marketing_materials', 
    name: 'Marketing Materials', 
    shortName: 'MARKETING',
    description: 'Property flyers, investor updates, disposition teasers',
    category: 'report',
    icon: 'Megaphone',
    color: '#E8F4FD',
  },
];

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Database, Search, FileText, Edit3, MessageSquare, BarChart3, FileOutput,
  Brain, Sparkles, Layers, DollarSign, Shield, Scale, FileSearch,
  TreeDeciduous, ClipboardCheck, TrendingUp, RefreshCw, LineChart, Megaphone
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Brain;
}

// ============================================================================
// Skill Chip
// ============================================================================

interface SkillChipProps {
  skill: SkillDefinition;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}

const SkillChip: React.FC<SkillChipProps> = ({ skill, isActive, onClick, compact = false }) => {
  const [hover, setHover] = useState(false);
  const IconComponent = getIconComponent(skill.icon);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={skill.description}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '4px 8px' : '6px 10px',
        borderRadius: 6,
        border: isActive ? `2px solid ${skill.color}` : `1px solid ${T.border.subtle}`,
        background: isActive ? `${skill.color}20` : hover ? `${skill.color}10` : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      <IconComponent size={compact ? 14 : 16} color={isActive || hover ? skill.color : T.text.muted} />
      <span style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: isActive || hover ? skill.color : T.text.secondary }}>
        {skill.shortName}
      </span>
    </button>
  );
};

// ============================================================================
// Skills Info Panel
// ============================================================================

interface SkillInfoPanelProps {
  skill: SkillDefinition;
  onClose: () => void;
}

const SkillInfoPanel: React.FC<SkillInfoPanelProps> = ({ skill, onClose }) => {
  const IconComponent = getIconComponent(skill.icon);

  return (
    <div style={{
      position: 'fixed',
      bottom: 50,
      right: 20,
      width: 320,
      background: T.bg.panel,
      border: `1px solid ${T.border.medium}`,
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      fontFamily: T.font.mono,
      zIndex: 1000,
    }}>
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
          background: `${skill.color}20`,
          border: `2px solid ${skill.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <IconComponent size={20} color={skill.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.text.primary, fontWeight: 600, fontSize: 14 }}>
            {skill.name}
          </div>
          <div style={{ 
            display: 'inline-block',
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 4,
            background: `${skill.color}20`,
            color: skill.color,
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            {skill.category}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: T.text.muted,
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <p style={{ color: T.text.secondary, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          {skill.description}
        </p>
        
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: T.bg.terminal, 
          borderRadius: 6,
          fontSize: 10,
          color: T.text.muted,
        }}>
          <div style={{ color: T.text.cyan, marginBottom: 6 }}>USAGE</div>
          This skill is automatically invoked by the AI assistant when relevant to your request.
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Skills Bar
// ============================================================================

function useDealContext() {
  const location = useLocation();
  const match = location.pathname.match(/\/deals\/([a-f0-9-]+)/i);
  return match ? match[1] : undefined;
}

export const SkillsBar: React.FC = () => {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const dealId = useDealContext();

  // Core skills: Data + Action (shown by default)
  const coreSkills = SKILLS.filter(s => s.category === 'data' || s.category === 'action');
  // More skills: Document + Analysis + Report
  const moreSkills = SKILLS.filter(s => s.category === 'analysis' || s.category === 'document' || s.category === 'report');

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    }
  };

  const selectedSkillDef = SKILLS.find(s => s.id === selectedSkill);

  return (
    <>
      <div style={{
        background: T.bg.panel,
        borderTop: `1px solid ${T.border.medium}`,
        fontFamily: T.font.mono,
        flexShrink: 0,
      }}>
        <div style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <button 
            onClick={() => setExpanded(!expanded)} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: T.text.muted, 
              cursor: 'pointer', 
              padding: 2, 
              flexShrink: 0 
            }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={12} color={T.text.cyan} />
            <span style={{ color: T.text.cyan, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>SKILLS</span>
            <span style={{ fontSize: 9, padding: '1px 5px', background: `${T.text.green}20`, color: T.text.green, borderRadius: 3 }}>
              {SKILLS.length}
            </span>
          </div>

          {expanded && (
            <>
              <div style={{ width: 1, height: 14, background: T.border.subtle }} />

              {/* Scrollable core skills */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4, 
                overflowX: 'auto',
                maxWidth: 'calc(100vw - 400px)',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}>
                {coreSkills.slice(0, 6).map(skill => (
                  <SkillChip
                    key={skill.id}
                    skill={skill}
                    isActive={selectedSkill === skill.id}
                    onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)}
                    compact
                  />
                ))}
              </div>

              <div style={{ width: 1, height: 14, background: T.border.subtle }} />

              <button
                onClick={() => setShowMore(!showMore)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px',
                  background: showMore ? `${T.text.purple}15` : 'transparent',
                  border: `1px solid ${showMore ? T.text.purple + '55' : T.border.subtle}`,
                  borderRadius: 4,
                  color: showMore ? T.text.purple : T.text.muted,
                  cursor: 'pointer', fontSize: 9, fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                <Layers size={10} />
                +{SKILLS.length - 6} MORE
                {showMore ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            </>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={() => navigate('/terminal/settings?tab=skills')}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '3px 7px', background: 'transparent',
              border: `1px solid ${T.border.subtle}`, borderRadius: 3,
              color: T.text.muted, cursor: 'pointer', fontSize: 9,
            }}
          >
            <Settings size={10} />
            AI
          </button>
        </div>

        {expanded && showMore && (
          <div style={{
            padding: '5px 12px',
            borderTop: `1px solid ${T.border.subtle}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <button 
              onClick={() => scroll('left')} 
              style={{ background: 'transparent', border: 'none', color: T.text.muted, cursor: 'pointer', padding: 2 }}
            >
              <ChevronLeft size={12} />
            </button>
            <div ref={scrollRef} style={{
              flex: 1, display: 'flex', gap: 4,
              overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}>
              {/* Show remaining core skills + all more skills */}
              {[...coreSkills.slice(6), ...moreSkills].map(skill => (
                <SkillChip 
                  key={skill.id} 
                  skill={skill} 
                  isActive={selectedSkill === skill.id}
                  onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)} 
                  compact 
                />
              ))}
            </div>
            <button 
              onClick={() => scroll('right')} 
              style={{ background: 'transparent', border: 'none', color: T.text.muted, cursor: 'pointer', padding: 2 }}
            >
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>

      {selectedSkillDef && (
        <SkillInfoPanel
          skill={selectedSkillDef}
          onClose={() => setSelectedSkill(null)}
        />
      )}

      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
};

// Keep AgentBar as alias for backward compatibility
export const AgentBar = SkillsBar;

export default SkillsBar;
