/**
 * Skills Bar - Compact skills selector for AI capabilities
 * 
 * Features:
 * - Scrollable row of skill icons by category
 * - Core skills always visible
 * - Analysis/Document skills in expandable section
 * - Click to see skill info or trigger it
 * 
 * Renamed from AgentBar - Skills are tools the AI uses, not separate agents
 * 
 * @version 4.0.0
 * @date 2026-04-22
 */

import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Settings,
  Database, Search, FileText, Edit3, MessageSquare, BarChart3, FileOutput,
  Brain, Sparkles, Zap, Activity, Layers
} from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import api from '../../lib/api';

// ============================================================================
// SKILL DEFINITIONS
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
  // Data Skills
  { 
    id: 'query_deal_data', 
    name: 'Query Deal Data', 
    shortName: 'DATA',
    description: 'Fetch financials, rent roll, assumptions, comps',
    category: 'data',
    icon: 'Database',
    color: '#00B4D8',
  },
  { 
    id: 'search_market_data', 
    name: 'Search Market', 
    shortName: 'MARKET',
    description: 'MSA metrics, supply pipeline, employment',
    category: 'data',
    icon: 'Search',
    color: '#00B4D8',
  },
  
  // Document Skills
  { 
    id: 'extract_document', 
    name: 'Extract Document', 
    shortName: 'EXTRACT',
    description: 'Parse T-12, rent roll, OM from files',
    category: 'document',
    icon: 'FileText',
    color: '#F6A623',
  },
  
  // Action Skills
  { 
    id: 'update_assumption', 
    name: 'Update Assumption', 
    shortName: 'UPDATE',
    description: 'Change underwriting inputs with confirmation',
    category: 'action',
    icon: 'Edit3',
    color: '#00D26A',
  },
  { 
    id: 'add_note', 
    name: 'Add Note', 
    shortName: 'NOTE',
    description: 'Add analyst notes to deal timeline',
    category: 'action',
    icon: 'MessageSquare',
    color: '#00D26A',
  },
  
  // Analysis Skills
  { 
    id: 'run_analysis', 
    name: 'Run Analysis', 
    shortName: 'ANALYZE',
    description: 'IRR sensitivity, refi scenarios, hold optimization',
    category: 'analysis',
    icon: 'BarChart3',
    color: '#B794F4',
  },
  
  // Report Skills
  { 
    id: 'generate_report', 
    name: 'Generate Report', 
    shortName: 'REPORT',
    description: 'Investment memos, NOI waterfalls, summaries',
    category: 'report',
    icon: 'FileOutput',
    color: '#E8F4FD',
  },
];

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Database, Search, FileText, Edit3, MessageSquare, BarChart3, FileOutput,
  Brain, Sparkles, Zap, Activity, Layers,
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
  dealId?: string;
}

const SkillInfoPanel: React.FC<SkillInfoPanelProps> = ({ skill, onClose, dealId }) => {
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
      {/* Header */}
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

      {/* Content */}
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
          Ask questions in the chat and the AI will use this skill when needed.
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

  const coreSkills = SKILLS.filter(s => s.category === 'data' || s.category === 'action');
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
            <span style={{ fontSize: 9, padding: '1px 5px', background: `${T.text.cyan}20`, color: T.text.cyan, borderRadius: 3 }}>
              {SKILLS.length}
            </span>
          </div>

          {expanded && (
            <>
              <div style={{ width: 1, height: 14, background: T.border.subtle }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {coreSkills.map(skill => (
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
                }}
              >
                <Layers size={10} />
                +{moreSkills.length} MORE
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
              {moreSkills.map(skill => (
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
          dealId={dealId}
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
