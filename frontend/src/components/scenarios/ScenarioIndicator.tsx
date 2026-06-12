import React, { useState, useEffect } from 'react';
import { Bot, GitBranch, ArrowRightLeft } from 'lucide-react';
import { BT } from '../deal/bloomberg-ui';
import { getActiveScenario, type UWScenario } from '../../services/underwriting-scenarios.api';

const MONO = BT.font.mono;

interface ScenarioIndicatorProps {
  dealId: string;
  onCompare?: () => void;
}

export const ScenarioIndicator: React.FC<ScenarioIndicatorProps> = ({ dealId, onCompare }) => {
  const [scenario, setScenario] = useState<UWScenario | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    setLoading(true);
    getActiveScenario(dealId)
      .then(s => { if (!cancelled) setScenario(s); })
      .catch(() => { if (!cancelled) setScenario(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return (
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
        SCENARIO …
      </span>
    );
  }
  if (!scenario) return null;

  const isAgent = scenario.created_by === 'agent';
  const color = isAgent ? '#8B5CF6' : '#F5A623';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>
        SCENARIO
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '1px 6px',
          borderRadius: 2,
          background: `${color}18`,
          border: `1px solid ${color}44`,
          fontFamily: MONO,
          fontSize: 9,
          color,
          letterSpacing: 0.5,
          fontWeight: 700,
        }}
        title={scenario.description ?? `${scenario.name} — ${isAgent ? 'Agent' : 'User'} attributed`}
      >
        {isAgent ? <Bot size={9} /> : <GitBranch size={9} />}
        {scenario.name}
      </span>
      {scenario.parent_id && (
        <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO }}>
          (FORK)
        </span>
      )}
      {onCompare && (
        <button
          onClick={onCompare}
          style={{
            background: 'transparent',
            border: `1px solid ${BT.border.subtle}`,
            color: BT.text.secondary,
            fontFamily: MONO,
            fontSize: 8,
            padding: '1px 5px',
            cursor: 'pointer',
            borderRadius: 2,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}
          title="Compare scenarios"
        >
          <ArrowRightLeft size={8} />
        </button>
      )}
    </div>
  );
};

export default ScenarioIndicator;
