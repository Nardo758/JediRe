import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, SectionPanel, DataRow, Bd, Spark, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { useStrategyArbitrage } from '../../hooks/useStrategyArbitrageM08';
import type { M08StrategyScore } from '../../stores/dealStore';
import { CustomScreenTab } from '../../components/deal/sections/CustomScreenTab';

interface StrategyArbitragePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

const MONO = BT.font.mono;

type StrategyColDef = { id: string; label: string; color: string; aliases: string[] };
const STRATEGY_COLS: StrategyColDef[] = [
  { id: 'bts',    label: 'BTS',    color: BT.text.purple, aliases: ['bts', 'build_to_suit', 'build-to-suit', 'build to suit'] },
  { id: 'flip',   label: 'FLIP',   color: BT.text.amber,  aliases: ['flip', 'fix_and_flip', 'fix-and-flip', 'wholesale'] },
  { id: 'rental', label: 'RENTAL', color: BT.met.occupancy, aliases: ['rental', 'long_term_rental', 'ltr', 'buy_and_hold', 'buy and hold'] },
  { id: 'str',    label: 'STR',    color: BT.text.cyan,   aliases: ['str', 'short_term_rental', 'vacation_rental', 'airbnb'] },
];

function matchStrategyCol(score: M08StrategyScore, col: StrategyColDef): boolean {
  const raw = ((score.strategy_type ?? score.strategy_id) as string || '').toLowerCase().trim();
  return col.aliases.some(a => raw === a);
}

const SIGNAL_KEYS   = ['demand', 'supply', 'market', 'policy', 'risk'] as const;
const SIGNAL_LABELS = ['D', 'S', 'M', 'P', 'R'];

const TAB_LABELS = ['ARBITRAGE SCORES', 'STRATEGY DETAIL'];

function ScoreRing({ score, color, size = 60 }: { score: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}20`} strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text
        x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={14} fontWeight={700} fontFamily={MONO}
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}

interface StrategyColProps {
  score: M08StrategyScore;
  isWinner: boolean;
  col: { id: string; label: string; color: string };
}

function StrategyCol({ score, isWinner, col }: StrategyColProps) {
  const irr = score.roi_estimate?.irr;
  const yoc = score.roi_estimate?.yoc;
  const em  = score.roi_estimate?.profit_margin;
  const timeline = typeof score.sub_scores?.['timeline'] === 'number'
    ? (score.sub_scores['timeline'] as number)
    : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderTop: isWinner ? `2px solid ${BT.text.amber}` : `1px solid ${BT.border.subtle}`,
      background: isWinner ? `${BT.text.amber}06` : BT.bg.panel,
      minWidth: 0, flex: 1,
    }}>
      <div style={{
        padding: '5px 8px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: col.color, letterSpacing: 0.5 }}>
          {col.label}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {isWinner && <Bd c={BT.text.amber}>WINNER</Bd>}
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: isWinner ? BT.text.amber : BT.text.primary }}>
            {(score.overall_score ?? 0).toFixed(0)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 8px 6px' }}>
        <ScoreRing score={score.overall_score} color={col.color} size={60} />
      </div>

      <DataRow label="IRR"      value={irr != null ? `${(irr * 100).toFixed(1)}%`  : '—'} valueColor={BT.met.financial} />
      <DataRow label="EM"       value={em  != null ? `${em.toFixed(2)}×`            : '—'} valueColor={BT.text.amber} />
      <DataRow label="YOC"      value={yoc != null ? `${(yoc * 100).toFixed(1)}%`  : '—'} valueColor={BT.met.occupancy} />
      <DataRow label="TIMELINE" value={timeline != null ? `${timeline}M`            : '—'} valueColor={BT.text.secondary} />

      <div style={{ borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 2, paddingBottom: 2 }}>
        {SIGNAL_KEYS.map((key, i) => {
          const v = (score.sub_scores?.[key] as number | undefined) ?? 0;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 8, flexShrink: 0 }}>
                {SIGNAL_LABELS[i]}
              </span>
              <div style={{ flex: 1, height: 3, background: BT.bg.hover, position: 'relative' as const }}>
                <div style={{
                  position: 'absolute' as const, left: 0, top: 0,
                  height: '100%', width: `${Math.min(100, v)}%`,
                  background: col.color, opacity: 0.75,
                }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, width: 20, textAlign: 'right' as const }}>
                {v.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '5px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, fontStyle: 'italic' }}>
          {score.gate_result === 'FAIL'
            ? (score.gate_failures?.[0] ?? 'Gates not met')
            : score.gate_result === 'PASS'
              ? 'Meets all investment gates'
              : 'Evaluation pending'}
        </span>
      </div>
    </div>
  );
}

export function StrategyArbitragePage({ dealId, deal: _deal, dealType: _dealType }: StrategyArbitragePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';
  const [activeTab, setActiveTab] = useState(0);
  const { scores, arbitrage, loading } = useStrategyArbitrage(resolvedDealId);

  const orderedCols = STRATEGY_COLS.map(col => ({
    col,
    score: scores.find(s => matchStrategyCol(s, col)) ?? null,
  }));

  const winnerIRR = arbitrage?.winning_strategy_id != null
    ? scores.find(s => s.strategy_id === arbitrage.winning_strategy_id)?.roi_estimate?.irr
    : null;
  const runnerIRR = arbitrage?.runner_up_strategy_id != null
    ? scores.find(s => s.strategy_id === arbitrage.runner_up_strategy_id)?.roi_estimate?.irr
    : null;
  const irrDelta = winnerIRR != null && runnerIRR != null ? winnerIRR - runnerIRR : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="STRATEGY ARBITRAGE"
        subtitle="M06 · BEST-USE MATRIX + IRR OPTIMIZER"
        borderColor={BT.text.amber}
        metrics={[
          { l: 'IRR', c: BT.met.financial },
          { l: 'EM', c: BT.text.amber },
          { l: 'YOC', c: BT.met.occupancy },
          { l: 'TIMELINE', c: BT.text.secondary },
        ]}
        right={
          loading
            ? <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>COMPUTING...</span>
            : arbitrage?.arbitrage_detected
              ? <Bd c={BT.text.amber}>ARBITRAGE DETECTED</Bd>
              : scores.length > 0
                ? <Bd c={BT.text.green}>SCORED</Bd>
                : <Bd c={BT.text.secondary}>NO SCORES</Bd>
        }
      />

      {arbitrage && (arbitrage.winning_strategy_name || arbitrage.arbitrage_detected) && (
        <div style={{
          padding: '5px 10px', background: `${BT.text.amber}10`,
          borderLeft: `2px solid ${BT.text.amber}`,
          borderBottom: `1px solid ${BT.border.subtle}`,
          display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: 1 }}>
            ARBITRAGE ALERT
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>
            {(arbitrage.winning_strategy_name ?? 'Winner').toUpperCase()} wins by {(arbitrage.delta ?? 0).toFixed(1)} pts over {(arbitrage.runner_up_strategy_name ?? 'Runner-up').toUpperCase()}
          </span>
          {irrDelta != null && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.green }}>
              +{(irrDelta * 100).toFixed(1)}% IRR advantage
            </span>
          )}
        </div>
      )}

      <SubTabBar
        tabs={TAB_LABELS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.text.amber}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <div style={{ padding: 1 }}>
            {loading && (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
                Computing strategy scores...
              </div>
            )}
            {!loading && scores.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
                No strategy scores available. Scores compute automatically on deal save.
              </div>
            )}
            {!loading && scores.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1, background: BT.border.subtle,
              }}>
                {orderedCols.map(({ col, score }) => {
                  if (!score) {
                    return (
                      <div key={col.id} style={{
                        background: BT.bg.panel, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: 24,
                        borderTop: `1px solid ${BT.border.subtle}`,
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{col.label} · N/A</span>
                      </div>
                    );
                  }
                  const isWinner = arbitrage?.winning_strategy_id === score.strategy_id;
                  return (
                    <StrategyCol key={col.id} score={score} isWinner={isWinner} col={col} />
                  );
                })}
              </div>
            )}
            {!loading && scores.length > 0 && (
              <div style={{ marginTop: 1, background: BT.border.subtle }}>
                <SectionPanel
                  title="COMPOSITE SCORE TREND"
                  subtitle="30-day strategy arbitrage trajectory"
                  borderColor={BT.text.amber}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(4, scores.length)}, 1fr)`,
                    gap: 1, background: BT.border.subtle,
                  }}>
                    {scores.slice(0, 4).map(s => {
                      const sType = ((s.strategy_type ?? s.strategy_id) as string || '').toLowerCase();
                      const sId = (s.strategy_id || '').toLowerCase();
                      const col = STRATEGY_COLS.find(c =>
                        sType.includes(c.id) || sId.includes(c.id)
                      ) ?? STRATEGY_COLS[0];
                      const spark = Object.values(s.sub_scores ?? {}).map(v => Number(v)).filter(n => !isNaN(n));
                      return (
                        <div key={s.strategy_id} style={{ background: BT.bg.panel, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: col.color, width: 40, flexShrink: 0 }}>
                            {col.label}
                          </span>
                          <Spark data={spark.length >= 2 ? spark : [s.overall_score, s.overall_score]} color={col.color} w={80} h={14} />
                          <span style={{ fontFamily: MONO, fontSize: 9, color: col.color, fontWeight: 700, marginLeft: 'auto' }}>
                            {(s.overall_score ?? 0).toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </SectionPanel>
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && (
          <BtTabWrapper>
            <CustomScreenTab dealId={resolvedDealId} />
          </BtTabWrapper>
        )}
      </div>
    </div>
  );
}

export default StrategyArbitragePage;
