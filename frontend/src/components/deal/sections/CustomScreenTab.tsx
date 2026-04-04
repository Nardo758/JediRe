import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../services/api.client';
import { useNavigate } from 'react-router-dom';
import { BT, Bd } from '../bloomberg-ui';

const MONO = BT.font.mono;

interface CustomStrategyScore {
  strategyId: string;
  strategyName: string;
  score: number;
  matched: boolean;
  conditionResults: Array<{
    conditionId: string;
    metricId: string;
    actualValue: number;
    passed: boolean;
    score: number;
  }>;
}

interface CustomScreenTabProps {
  dealId: string;
}

export const CustomScreenTab: React.FC<CustomScreenTabProps> = ({ dealId }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [customStrategies, setCustomStrategies] = useState<CustomStrategyScore[]>([]);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  useEffect(() => {
    const loadCustomStrategies = async () => {
      try {
        setIsLoading(true);
        setIsError(false);

        const response = await apiClient.post(`/api/v1/strategies/score-deal/${dealId}`);

        if (response.data.success && response.data.data) {
          setCustomStrategies(response.data.data);
        } else {
          setCustomStrategies([]);
        }
      } catch (error: any) {
        console.error('Error loading custom strategies:', error);
        setIsError(true);
        setErrorMessage(error.response?.data?.error || 'Failed to load custom strategies');
        setCustomStrategies([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (dealId) {
      loadCustomStrategies();
    }
  }, [dealId]);

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
          Evaluating strategies...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{
        background: `${BT.text.red}10`, border: `1px solid ${BT.text.red}33`,
        padding: '8px 12px',
      }}>
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.red, marginBottom: 4 }}>
          FAILED TO LOAD STRATEGIES
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{errorMessage}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 6, fontFamily: MONO, fontSize: 9, fontWeight: 600,
            color: BT.text.red, background: 'transparent', border: `1px solid ${BT.text.red}44`,
            padding: '2px 8px', cursor: 'pointer',
          }}
        >
          RETRY
        </button>
      </div>
    );
  }

  if (customStrategies.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.primary, marginBottom: 6 }}>
          NO CUSTOM STRATEGIES
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginBottom: 12 }}>
          Create your first custom strategy to evaluate this deal against your specific criteria.
        </div>
        <button
          onClick={() => navigate('/strategies')}
          style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            color: BT.bg.terminal, background: BT.text.cyan,
            border: 'none', padding: '4px 14px', cursor: 'pointer',
            letterSpacing: 0.5,
          }}
        >
          + CREATE STRATEGY
        </button>
      </div>
    );
  }

  const matchedStrategies = customStrategies.filter(s => s.matched);
  const unmatchedStrategies = customStrategies.filter(s => !s.matched);

  return (
    <div>
      {matchedStrategies.length > 0 && (
        <div style={{ marginBottom: 2 }}>
          <div style={{
            padding: '4px 10px', background: BT.bg.header,
            borderBottom: `1px solid ${BT.border.subtle}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: BT.text.green }} />
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 0.5 }}>
              MATCHED ({matchedStrategies.length})
            </span>
          </div>
          {matchedStrategies.map((strategy) => (
            <StrategyCard
              key={strategy.strategyId}
              strategy={strategy}
              isExpanded={expandedStrategy === strategy.strategyId}
              onToggleExpand={() =>
                setExpandedStrategy(
                  expandedStrategy === strategy.strategyId ? null : strategy.strategyId
                )
              }
            />
          ))}
        </div>
      )}

      {unmatchedStrategies.length > 0 && (
        <div style={{ marginBottom: 2 }}>
          <div style={{
            padding: '4px 10px', background: BT.bg.header,
            borderBottom: `1px solid ${BT.border.subtle}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: BT.text.muted }} />
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 0.5 }}>
              DIDN'T MATCH ({unmatchedStrategies.length})
            </span>
          </div>
          {unmatchedStrategies.map((strategy) => (
            <StrategyCard
              key={strategy.strategyId}
              strategy={strategy}
              isExpanded={expandedStrategy === strategy.strategyId}
              onToggleExpand={() =>
                setExpandedStrategy(
                  expandedStrategy === strategy.strategyId ? null : strategy.strategyId
                )
              }
            />
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/strategies')}
        style={{
          width: '100%', marginTop: 4, padding: '6px 0',
          border: `1px dashed ${BT.border.medium}`,
          background: 'transparent', fontFamily: MONO,
          fontSize: 9, fontWeight: 600, color: BT.text.secondary,
          cursor: 'pointer', letterSpacing: 0.5,
        }}
      >
        + CREATE NEW STRATEGY
      </button>
    </div>
  );
};

interface StrategyCardProps {
  strategy: CustomStrategyScore;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy, isExpanded, onToggleExpand }) => {
  function scoreColor(score: number): string {
    if (score >= 80) return BT.text.green;
    if (score >= 60) return BT.text.cyan;
    if (score >= 40) return BT.text.amber;
    return BT.text.red;
  }

  return (
    <div style={{
      borderBottom: `1px solid ${BT.border.subtle}`,
      background: isExpanded ? BT.bg.panelAlt : BT.bg.panel,
    }}>
      <div
        onClick={onToggleExpand}
        style={{
          padding: '5px 10px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: MONO, fontSize: 10, fontWeight: 700,
            color: strategy.matched ? BT.text.green : BT.text.muted,
          }}>
            {strategy.matched ? 'PASS' : 'FAIL'}
          </span>
          <span style={{
            fontFamily: MONO, fontSize: 10, color: BT.text.primary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {strategy.strategyName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {strategy.matched && (
            <Bd c={scoreColor(strategy.score)}>{strategy.score.toFixed(1)}</Bd>
          )}
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            {isExpanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </div>

      {isExpanded && strategy.conditionResults.length > 0 && (
        <div style={{
          borderTop: `1px solid ${BT.border.subtle}`,
          padding: '4px 10px', background: BT.bg.header,
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 8, fontWeight: 600,
            color: BT.text.muted, letterSpacing: 0.8, marginBottom: 4,
          }}>
            CONDITION RESULTS
          </div>
          {strategy.conditionResults.map((condition) => (
            <div
              key={condition.conditionId}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '2px 0', fontFamily: MONO, fontSize: 9,
              }}
            >
              <span style={{
                width: 12, textAlign: 'center', fontWeight: 700, flexShrink: 0,
                color: condition.passed ? BT.text.green : BT.text.red,
              }}>
                {condition.passed ? 'P' : 'F'}
              </span>
              <span style={{ color: BT.text.muted, flex: 1 }}>
                {condition.metricId}
              </span>
              <span style={{ color: BT.text.primary, fontWeight: 600 }}>
                {condition.actualValue.toFixed(2)}
              </span>
              {condition.passed && (
                <span style={{ color: scoreColor(condition.score), fontWeight: 700, width: 30, textAlign: 'right' }}>
                  +{condition.score.toFixed(0)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomScreenTab;
