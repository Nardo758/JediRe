/**
 * Custom Screen Tab — M08 Strategy Arbitrage Scoring
 * Shows M08 system strategy scores + arbitrage detection for the current deal
 */

import React, { useState, useEffect } from 'react';
import { T as BT, mono as bMono } from '../bloomberg-tokens';
import { apiClient } from '../../../services/api.client';

interface M08StrategyScore {
  strategy_id: string;
  strategy_name: string;
  overall_score: number;
  sub_scores: Record<string, number>;
  gate_result: 'PASS' | 'FAIL' | 'N/A';
  gate_failures: string[];
  soft_penalty: number;
  confidence: number;
  is_system_template?: boolean;
}

interface M08ArbitrageResult {
  winning_strategy_id: string | null;
  winning_strategy_name: string | null;
  runner_up_strategy_id: string | null;
  runner_up_strategy_name: string | null;
  winning_score: number;
  runner_up_score: number;
  delta: number;
  arbitrage_detected: boolean;
}

interface CustomScreenTabProps {
  dealId: string;
}

export const CustomScreenTab: React.FC<CustomScreenTabProps> = ({ dealId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [scores, setScores] = useState<M08StrategyScore[]>([]);
  const [arbitrage, setArbitrage] = useState<M08ArbitrageResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    apiClient.post(`/api/v1/strategies/score-deal/${dealId}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success) {
          const data: M08StrategyScore[] = res.data.data || [];
          setScores(data);
          setArbitrage(res.data.arbitrage || null);
        }
      })
      .catch((error: any) => {
        if (cancelled) return;
        setIsError(true);
        setErrorMessage(error?.response?.data?.error || 'Failed to score deal');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [dealId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
          <span className={`${bMono} text-xs text-[#7f8ea3]`}>SCORING STRATEGIES...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded border border-[#c0392b]/40 bg-[#c0392b]/10 p-4">
        <p className={`${bMono} text-xs text-[#c0392b] mb-2`}>ERROR LOADING STRATEGY SCORES</p>
        <p className="text-sm text-[#7f8ea3]">{errorMessage}</p>
        <button
          onClick={() => window.location.reload()}
          className={`mt-3 ${bMono} text-xs text-[#F5A623] border border-[#F5A623]/40 px-3 py-1 rounded hover:bg-[#F5A623]/10 transition`}
        >
          RETRY
        </button>
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className={`${bMono} text-xs text-[#7f8ea3] mb-2`}>NO STRATEGIES CONFIGURED</p>
        <p className="text-sm text-[#4a5568]">System strategy templates are loading.</p>
      </div>
    );
  }

  const passScores = scores.filter(s => s.gate_result === 'PASS').sort((a, b) => b.overall_score - a.overall_score);
  const naScores = scores.filter(s => s.gate_result === 'N/A');
  const failScores = scores.filter(s => s.gate_result === 'FAIL').sort((a, b) => b.overall_score - a.overall_score);

  return (
    <div className="space-y-4">
      {/* Arbitrage Alert */}
      {arbitrage?.arbitrage_detected && (
        <div className="rounded border border-[#F5A623]/60 bg-[#F5A623]/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-[#F5A623] text-lg flex-shrink-0">&#9889;</span>
            <div className="flex-1 min-w-0">
              <p className={`${bMono} text-xs text-[#F5A623] font-bold mb-1`}>
                ARBITRAGE DETECTED &mdash; +{arbitrage.delta.toFixed(1)}pt GAP
              </p>
              <p className="text-sm text-[#c8cdd4]">
                <span className="font-semibold text-[#F5A623]">{arbitrage.winning_strategy_name}</span>
                {' '}outscores{' '}
                <span className="font-semibold">{arbitrage.runner_up_strategy_name}</span>
                {' '}by{' '}{arbitrage.delta.toFixed(1)} points.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PASS strategies */}
      {passScores.length > 0 && (
        <section>
          <p className={`${bMono} text-[10px] text-[#27ae60] mb-2 tracking-wider`}>
            ELIGIBLE ({passScores.length})
          </p>
          <div className="space-y-2">
            {passScores.map(s => (
              <ScoreCard
                key={s.strategy_id}
                score={s}
                isExpanded={expandedId === s.strategy_id}
                onToggle={() => setExpandedId(expandedId === s.strategy_id ? null : s.strategy_id)}
                isWinner={arbitrage?.winning_strategy_id === s.strategy_id}
              />
            ))}
          </div>
        </section>
      )}

      {/* FAIL strategies */}
      {failScores.length > 0 && (
        <section>
          <p className={`${bMono} text-[10px] text-[#e74c3c] mb-2 tracking-wider`}>
            GATE FAIL ({failScores.length})
          </p>
          <div className="space-y-2">
            {failScores.map(s => (
              <ScoreCard
                key={s.strategy_id}
                score={s}
                isExpanded={expandedId === s.strategy_id}
                onToggle={() => setExpandedId(expandedId === s.strategy_id ? null : s.strategy_id)}
                isWinner={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* N/A strategies */}
      {naScores.length > 0 && (
        <section>
          <p className={`${bMono} text-[10px] text-[#7f8ea3] mb-2 tracking-wider`}>
            NOT APPLICABLE ({naScores.length})
          </p>
          <div className="space-y-2">
            {naScores.map(s => (
              <ScoreCard
                key={s.strategy_id}
                score={s}
                isExpanded={expandedId === s.strategy_id}
                onToggle={() => setExpandedId(expandedId === s.strategy_id ? null : s.strategy_id)}
                isWinner={false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

interface ScoreCardProps {
  score: M08StrategyScore;
  isExpanded: boolean;
  onToggle: () => void;
  isWinner: boolean;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ score, isExpanded, onToggle, isWinner }) => {
  const gateColor =
    score.gate_result === 'PASS' ? '#27ae60' :
    score.gate_result === 'N/A' ? '#7f8ea3' : '#e74c3c';

  const scoreColor =
    score.overall_score >= 75 ? '#27ae60' :
    score.overall_score >= 55 ? '#F5A623' :
    score.overall_score >= 35 ? '#e67e22' : '#e74c3c';

  const subScoreEntries = Object.entries(score.sub_scores || {});

  return (
    <div
      className={`rounded border transition-all cursor-pointer ${
        isWinner
          ? 'border-[#F5A623]/60 bg-[#F5A623]/5'
          : isExpanded
          ? 'border-[#1e2a3d] bg-[#0d1424]'
          : 'border-[#1a2233] bg-[#0a0e17] hover:border-[#1e2a3d]'
      }`}
    >
      <div onClick={onToggle} className="px-4 py-3 flex items-center gap-3">
        {/* Winner indicator */}
        {isWinner && (
          <span className="text-[#F5A623] text-xs flex-shrink-0" title="Recommended strategy">&#9733;</span>
        )}

        {/* Gate status */}
        <span
          className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
          style={{ color: gateColor, borderColor: `${gateColor}40` }}
        >
          {score.gate_result}
        </span>

        {/* Name */}
        <span className="flex-1 text-sm font-medium text-[#c8cdd4] truncate">
          {score.strategy_name}
        </span>

        {/* Score */}
        {score.gate_result !== 'N/A' && (
          <span className="font-mono text-sm font-bold flex-shrink-0" style={{ color: scoreColor }}>
            {score.overall_score.toFixed(1)}
          </span>
        )}

        {/* Confidence */}
        {score.gate_result === 'PASS' && (
          <span className="font-mono text-[10px] text-[#7f8ea3] flex-shrink-0">
            {score.confidence.toFixed(0)}% conf
          </span>
        )}

        <span className="text-[#4a5568] text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
      </div>

      {isExpanded && (
        <div className="border-t border-[#1a2233] px-4 py-3 space-y-2">
          {/* Sub-scores */}
          {subScoreEntries.length > 0 && (
            <div>
              <p className="font-mono text-[10px] text-[#7f8ea3] mb-2 tracking-wider">SIGNAL SCORES</p>
              <div className="space-y-1.5">
                {subScoreEntries.map(([signal, val]) => (
                  <div key={signal} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#4a5568] w-28 truncate">
                      {signal.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <div className="flex-1 h-1 bg-[#1a2233] rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${Math.min(100, val)}%`,
                          backgroundColor: val >= 70 ? '#27ae60' : val >= 50 ? '#F5A623' : '#e74c3c',
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-[#c8cdd4] w-8 text-right">
                      {val.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gate failures */}
          {score.gate_failures.length > 0 && (
            <div>
              <p className="font-mono text-[10px] text-[#7f8ea3] mb-1 tracking-wider">GATE FLAGS</p>
              {score.gate_failures.map((f, i) => (
                <p key={i} className="font-mono text-[10px] text-[#e74c3c]">&bull; {f}</p>
              ))}
            </div>
          )}

          {/* Soft penalty */}
          {score.soft_penalty > 0 && (
            <p className="font-mono text-[10px] text-[#e67e22]">
              SOFT PENALTY: &minus;{score.soft_penalty.toFixed(1)}pt
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomScreenTab;
