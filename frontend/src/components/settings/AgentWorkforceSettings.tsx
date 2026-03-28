/**
 * AgentWorkforceSettings - Manage AI agent workforce configuration
 * Allows users to select number of agents and configure their behavior
 */

import React, { useState, useEffect } from 'react';
import { 
  TASK_AGENTS, 
  ANALYST_AGENTS, 
  ALL_AGENTS,
  WorkforceConfig, 
  DEFAULT_WORKFORCE_CONFIG,
  TIER_LIMITS,
  AgentDefinition,
  AI_MODELS,
  AIModelTier,
  getModelById,
} from '../../config/agentWorkforce';
import { BT } from '../deal/bloomberg-ui';

interface AgentWorkforceSettingsProps {
  currentTier?: 'free' | 'pro' | 'enterprise';
  onSave?: (config: WorkforceConfig) => void;
}

export const AgentWorkforceSettings: React.FC<AgentWorkforceSettingsProps> = ({
  currentTier = 'pro',
  onSave,
}) => {
  const [config, setConfig] = useState<WorkforceConfig>(DEFAULT_WORKFORCE_CONFIG);
  const [activeTab, setActiveTab] = useState<'task' | 'analyst'>('task');
  const [hasChanges, setHasChanges] = useState(false);

  const tierLimits = TIER_LIMITS[currentTier];

  const toggleAgent = (agentId: string) => {
    setConfig(prev => {
      const isEnabled = prev.enabledAgents.includes(agentId);
      const newEnabled = isEnabled
        ? prev.enabledAgents.filter(id => id !== agentId)
        : [...prev.enabledAgents, agentId];
      
      return { ...prev, enabledAgents: newEnabled };
    });
    setHasChanges(true);
  };

  const setAutonomy = (agentId: string, level: 'full' | 'supervised' | 'manual') => {
    setConfig(prev => ({
      ...prev,
      agentAutonomyOverrides: {
        ...prev.agentAutonomyOverrides,
        [agentId]: level,
      },
    }));
    setHasChanges(true);
  };

  const setAgentModel = (agentId: string, model: AIModelTier) => {
    setConfig(prev => ({
      ...prev,
      agentModelOverrides: {
        ...prev.agentModelOverrides,
        [agentId]: model,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave?.(config);
    setHasChanges(false);
  };

  const enabledTaskCount = config.enabledAgents.filter(id => 
    TASK_AGENTS.some(a => a.id === id)
  ).length;

  const enabledAnalystCount = config.enabledAgents.filter(id => 
    ANALYST_AGENTS.some(a => a.id === id)
  ).length;

  const renderAgentCard = (agent: AgentDefinition) => {
    const isEnabled = config.enabledAgents.includes(agent.id);
    const autonomyLevel = config.agentAutonomyOverrides[agent.id] || config.globalAutonomy;
    const agentModel = config.agentModelOverrides[agent.id] || config.globalModel;
    const modelInfo = getModelById(agentModel);
    const canEnable = agent.category === 'task' 
      ? enabledTaskCount < tierLimits.maxTaskAgents || isEnabled
      : enabledAnalystCount < tierLimits.maxAnalystAgents || isEnabled;

    return (
      <div
        key={agent.id}
        style={{
          background: isEnabled ? `${BT.text.cyan}08` : BT.bg.panel,
          border: `1px solid ${isEnabled ? BT.text.cyan + '44' : BT.border.subtle}`,
          padding: 16,
          opacity: canEnable ? 1 : 0.5,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{agent.icon}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ 
                  fontSize: 9, 
                  fontWeight: 700, 
                  color: BT.text.amber, 
                  padding: '2px 6px', 
                  background: BT.bg.active,
                  fontFamily: BT.font.mono,
                }}>
                  {agent.code}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: BT.text.primary }}>
                  {agent.name}
                </span>
              </div>
              <div style={{ fontSize: 10, color: BT.text.secondary, marginTop: 2 }}>
                {agent.description}
              </div>
            </div>
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', cursor: canEnable ? 'pointer' : 'not-allowed' }}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={() => canEnable && toggleAgent(agent.id)}
              disabled={!canEnable}
              style={{ 
                width: 18, 
                height: 18, 
                accentColor: BT.text.cyan,
                cursor: canEnable ? 'pointer' : 'not-allowed',
              }}
            />
          </label>
        </div>

        {/* Capabilities */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {agent.capabilities.map((cap, i) => (
            <span
              key={i}
              style={{
                fontSize: 9,
                padding: '2px 6px',
                background: BT.bg.active,
                color: BT.text.secondary,
                fontFamily: BT.font.mono,
              }}
            >
              {cap}
            </span>
          ))}
        </div>

        {/* Autonomy Level & Model Selection */}
        {isEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Autonomy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: BT.text.muted, width: 60 }}>Autonomy:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['full', 'supervised', 'manual'] as const).map(level => {
                  const isAllowed = tierLimits.autonomyLevels.includes(level);
                  const isActive = autonomyLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => isAllowed && setAutonomy(agent.id, level)}
                      disabled={!isAllowed}
                      style={{
                        fontSize: 9,
                        padding: '3px 8px',
                        border: 'none',
                        cursor: isAllowed ? 'pointer' : 'not-allowed',
                        fontFamily: BT.font.mono,
                        fontWeight: isActive ? 700 : 400,
                        background: isActive 
                          ? level === 'full' ? BT.text.green 
                          : level === 'supervised' ? BT.text.amber 
                          : BT.text.secondary
                          : BT.bg.input,
                        color: isActive ? BT.bg.terminal : BT.text.secondary,
                        opacity: isAllowed ? 1 : 0.4,
                      }}
                    >
                      {level.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Model Selection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: BT.text.muted, width: 60 }}>Model:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {AI_MODELS.map(model => {
                  const isActive = agentModel === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => setAgentModel(agent.id, model.id)}
                      title={model.description}
                      style={{
                        fontSize: 9,
                        padding: '3px 8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: BT.font.mono,
                        fontWeight: isActive ? 700 : 400,
                        background: isActive ? model.color : BT.bg.input,
                        color: isActive ? BT.bg.terminal : BT.text.secondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>{model.icon}</span>
                      {model.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modules */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: BT.text.muted }}>Modules:</span>
          <span style={{ fontSize: 9, color: BT.text.cyan, fontFamily: BT.font.mono }}>
            {agent.modules.join(' · ')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      background: BT.bg.terminal, 
      minHeight: '100%',
      fontFamily: BT.font.mono,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.medium}`,
        borderTop: `2px solid ${BT.text.purple}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, margin: 0, letterSpacing: 1 }}>
              AGENT WORKFORCE
            </h2>
            <p style={{ fontSize: 10, color: BT.text.secondary, margin: '4px 0 0' }}>
              Configure your AI team — select agents and set their autonomy levels
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Current Tier</div>
              <div style={{ 
                fontSize: 11, 
                fontWeight: 700, 
                color: currentTier === 'enterprise' ? BT.text.amber : BT.text.cyan,
                textTransform: 'uppercase',
              }}>
                {currentTier}
              </div>
            </div>
            
            {hasChanges && (
              <button
                onClick={handleSave}
                style={{
                  padding: '8px 16px',
                  background: BT.text.green,
                  color: BT.bg.terminal,
                  border: 'none',
                  fontFamily: BT.font.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                SAVE CHANGES
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        gap: 1,
        background: BT.border.subtle,
        padding: 1,
      }}>
        <div style={{ flex: 1, padding: '12px 16px', background: BT.bg.panel }}>
          <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 4 }}>TASK AGENTS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.cyan }}>
            {enabledTaskCount} <span style={{ fontSize: 11, color: BT.text.secondary }}>/ {tierLimits.maxTaskAgents}</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', background: BT.bg.panel }}>
          <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 4 }}>ANALYST AGENTS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.purple }}>
            {enabledAnalystCount} <span style={{ fontSize: 11, color: BT.text.secondary }}>/ {tierLimits.maxAnalystAgents}</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', background: BT.bg.panel }}>
          <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 4 }}>TOTAL WORKFORCE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.amber }}>
            {enabledTaskCount + enabledAnalystCount} <span style={{ fontSize: 11, color: BT.text.secondary }}>agents</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', background: BT.bg.panel }}>
          <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 4 }}>AUTONOMY MODE</div>
          <div style={{ 
            fontSize: 12, 
            fontWeight: 700, 
            color: config.globalAutonomy === 'full' ? BT.text.green 
              : config.globalAutonomy === 'supervised' ? BT.text.amber 
              : BT.text.secondary,
            textTransform: 'uppercase',
          }}>
            {config.globalAutonomy}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BT.border.medium}` }}>
        {[
          { id: 'task', label: 'Task Agents', count: TASK_AGENTS.length, icon: '⚙️' },
          { id: 'analyst', label: 'Analyst Agents', count: ANALYST_AGENTS.length, icon: '🧠' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'task' | 'analyst')}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.id ? BT.bg.active : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${BT.text.amber}` : '2px solid transparent',
              color: activeTab === tab.id ? BT.text.amber : BT.text.secondary,
              fontFamily: BT.font.mono,
              fontSize: 11,
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
            <span style={{
              fontSize: 9,
              padding: '2px 6px',
              background: activeTab === tab.id ? BT.text.amber + '22' : BT.bg.input,
              color: activeTab === tab.id ? BT.text.amber : BT.text.muted,
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      <div style={{ padding: 16 }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
          gap: 12,
        }}>
          {(activeTab === 'task' ? TASK_AGENTS : ANALYST_AGENTS).map(renderAgentCard)}
        </div>
      </div>

      {/* Global Settings */}
      <div style={{
        margin: 16,
        padding: 16,
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
      }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: BT.text.primary, marginBottom: 12 }}>
          GLOBAL SETTINGS
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <label style={{ fontSize: 10, color: BT.text.secondary, display: 'block', marginBottom: 6 }}>
              Default Autonomy Level
            </label>
            <select
              value={config.globalAutonomy}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, globalAutonomy: e.target.value as any }));
                setHasChanges(true);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: BT.bg.input,
                border: `1px solid ${BT.border.subtle}`,
                color: BT.text.primary,
                fontFamily: BT.font.mono,
                fontSize: 11,
              }}
            >
              {tierLimits.autonomyLevels.map(level => (
                <option key={level} value={level}>{level.toUpperCase()}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ fontSize: 10, color: BT.text.secondary, display: 'block', marginBottom: 6 }}>
              Default AI Model
            </label>
            <select
              value={config.globalModel}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, globalModel: e.target.value as AIModelTier }));
                setHasChanges(true);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: BT.bg.input,
                border: `1px solid ${BT.border.subtle}`,
                color: BT.text.primary,
                fontFamily: BT.font.mono,
                fontSize: 11,
              }}
            >
              {AI_MODELS.map(model => (
                <option key={model.id} value={model.id}>{model.icon} {model.name} — {model.description}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ fontSize: 10, color: BT.text.secondary, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.notifyOnComplete}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, notifyOnComplete: e.target.checked }));
                  setHasChanges(true);
                }}
                style={{ accentColor: BT.text.cyan }}
              />
              Notify on task completion
            </label>
            <label style={{ fontSize: 10, color: BT.text.secondary, display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.notifyOnError}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, notifyOnError: e.target.checked }));
                  setHasChanges(true);
                }}
                style={{ accentColor: BT.text.red }}
              />
              Notify on errors
            </label>
          </div>
          
          <div>
            <label style={{ fontSize: 10, color: BT.text.secondary, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.notifyOnInsight}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, notifyOnInsight: e.target.checked }));
                  setHasChanges(true);
                }}
                style={{ accentColor: BT.text.amber }}
              />
              Notify on AI insights
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentWorkforceSettings;
