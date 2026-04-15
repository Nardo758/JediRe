/**
 * StrategyTab - Investment strategy analysis and decision support
 * Includes: strategy comparison, risk factors, exit scenarios, action items
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  XCircle, Clock, DollarSign, Percent, Building2, ArrowRight,
  Shield, Zap, Award, BarChart3, Activity
} from 'lucide-react';
import { BT, fmt, terminalStyles } from '../theme';
import { M35EventCard, M35EventCardData } from '../../m35/M35EventCard';

interface StrategyTabProps {
  dealId: string;
  deal: any;
}

interface Strategy {
  id: string;
  name: string;
  type: 'core' | 'value-add' | 'opportunistic' | 'development';
  score: number;
  irr: number;
  multiple: number;
  holdPeriod: number;
  riskLevel: 'low' | 'medium' | 'high';
  trafficGate: 'qualified' | 'marginal' | 'disqualified';
  pros: string[];
  cons: string[];
}

interface RiskFactor {
  id: string;
  name: string;
  category: 'market' | 'execution' | 'financial' | 'regulatory';
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  impact: string;
  mitigation: string;
}

interface ExitScenario {
  id: string;
  name: string;
  probability: number;
  exitValue: number;
  irr: number;
  multiple: number;
  timeline: string;
}

interface ActionItem {
  id: string;
  task: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'complete';
  dueDate?: string;
  owner?: string;
}

export const StrategyTab: React.FC<StrategyTabProps> = ({ dealId, deal }) => {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('value-add');
  const [expandedSection, setExpandedSection] = useState<string | null>('recommendation');
  const [dealEvents, setDealEvents] = useState<M35EventCardData[]>([]);

  useEffect(() => {
    if (!dealId) return;
    fetch(`/api/v1/m35/deals/${dealId}/events`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then(data => setDealEvents((data.events ?? []).slice(0, 4)))
      .catch(() => setDealEvents([]));
  }, [dealId]);

  // Strategy options
  const strategies: Strategy[] = useMemo(() => [
    {
      id: 'core',
      name: 'Core / Stabilized',
      type: 'core',
      score: 72,
      irr: 8.5,
      multiple: 1.45,
      holdPeriod: 7,
      riskLevel: 'low',
      trafficGate: 'qualified',
      pros: ['Stable cash flow', 'Lower risk profile', 'Predictable returns'],
      cons: ['Lower upside potential', 'Requires higher entry price', 'Market-dependent'],
    },
    {
      id: 'value-add',
      name: 'Value-Add',
      type: 'value-add',
      score: 88,
      irr: 16.2,
      multiple: 1.85,
      holdPeriod: 5,
      riskLevel: 'medium',
      trafficGate: 'qualified',
      pros: ['Strong traffic supports renovation thesis', 'Significant rent upside', 'Active management opportunity'],
      cons: ['Execution risk on renovations', 'Capital intensive', 'Lease-up timing uncertainty'],
    },
    {
      id: 'opportunistic',
      name: 'Opportunistic',
      type: 'opportunistic',
      score: 65,
      irr: 22.5,
      multiple: 2.10,
      holdPeriod: 4,
      riskLevel: 'high',
      trafficGate: 'marginal',
      pros: ['Highest return potential', 'Market dislocation opportunity'],
      cons: ['Traffic barely meets threshold', 'High execution risk', 'Significant capital requirement'],
    },
    {
      id: 'development',
      name: 'Ground-Up Development',
      type: 'development',
      score: 45,
      irr: 18.0,
      multiple: 1.65,
      holdPeriod: 6,
      riskLevel: 'high',
      trafficGate: 'disqualified',
      pros: ['Control over product', 'Premium positioning possible'],
      cons: ['Insufficient traffic for lease-up', 'High construction risk', 'Long timeline'],
    },
  ], []);

  // Risk factors
  const riskFactors: RiskFactor[] = useMemo(() => [
    {
      id: '1',
      name: 'Interest Rate Volatility',
      category: 'financial',
      severity: 'medium',
      probability: 0.65,
      impact: 'Higher debt service could compress returns by 150-200 bps',
      mitigation: 'Lock in fixed-rate financing or use interest rate caps',
    },
    {
      id: '2',
      name: 'Construction Cost Overruns',
      category: 'execution',
      severity: 'medium',
      probability: 0.45,
      impact: 'Renovation budget could exceed by 10-15%',
      mitigation: 'Fixed-price GC contract with 10% contingency reserve',
    },
    {
      id: '3',
      name: 'Supply Pipeline Competition',
      category: 'market',
      severity: 'low',
      probability: 0.35,
      impact: '680 new units delivering within 1 mile by Q4 2027',
      mitigation: 'Premium positioning and amenity differentiation',
    },
    {
      id: '4',
      name: 'Lease-Up Velocity',
      category: 'execution',
      severity: 'medium',
      probability: 0.40,
      impact: 'Slower absorption extends stabilization by 3-6 months',
      mitigation: 'Phased renovation approach, aggressive concessions if needed',
    },
    {
      id: '5',
      name: 'Regulatory Changes',
      category: 'regulatory',
      severity: 'low',
      probability: 0.15,
      impact: 'State rent control preemption provides protection',
      mitigation: 'Monitor legislative activity, engage with industry groups',
    },
  ], []);

  // Exit scenarios
  const exitScenarios: ExitScenario[] = useMemo(() => [
    { id: '1', name: 'Base Case', probability: 0.55, exitValue: 52500000, irr: 16.2, multiple: 1.85, timeline: 'Year 5' },
    { id: '2', name: 'Upside Case', probability: 0.25, exitValue: 61000000, irr: 21.5, multiple: 2.15, timeline: 'Year 4' },
    { id: '3', name: 'Downside Case', probability: 0.15, exitValue: 44000000, irr: 9.8, multiple: 1.45, timeline: 'Year 6' },
    { id: '4', name: 'Hold / Refinance', probability: 0.05, exitValue: 0, irr: 11.2, multiple: 0, timeline: 'Year 7+' },
  ], []);

  // Action items
  const actionItems: ActionItem[] = useMemo(() => [
    { id: '1', task: 'Complete physical due diligence inspection', priority: 'critical', status: 'in_progress', dueDate: 'Mar 30', owner: 'John S.' },
    { id: '2', task: 'Finalize debt term sheet with preferred lender', priority: 'critical', status: 'pending', dueDate: 'Apr 5', owner: 'Finance Team' },
    { id: '3', task: 'Environmental Phase I review', priority: 'high', status: 'complete' },
    { id: '4', task: 'GC bid package for renovation scope', priority: 'high', status: 'pending', dueDate: 'Apr 10', owner: 'Development' },
    { id: '5', task: 'Market rent study validation', priority: 'medium', status: 'in_progress', dueDate: 'Apr 2', owner: 'Asset Mgmt' },
    { id: '6', task: 'Legal review of title and survey', priority: 'high', status: 'complete' },
    { id: '7', task: 'Insurance quote and coverage analysis', priority: 'medium', status: 'pending', dueDate: 'Apr 8' },
    { id: '8', task: 'IC memo preparation', priority: 'critical', status: 'pending', dueDate: 'Apr 15', owner: 'Acquisitions' },
  ], []);

  const selectedStrategyData = strategies.find(s => s.id === selectedStrategy)!;

  const getTrafficGateColor = (gate: string) => {
    if (gate === 'qualified') return BT.text.green;
    if (gate === 'marginal') return BT.text.amber;
    return BT.text.red;
  };

  const getTrafficGateIcon = (gate: string) => {
    if (gate === 'qualified') return <CheckCircle2 size={14} color={BT.text.green} />;
    if (gate === 'marginal') return <AlertTriangle size={14} color={BT.text.amber} />;
    return <XCircle size={14} color={BT.text.red} />;
  };

  const getRiskColor = (level: string) => {
    if (level === 'low') return BT.text.green;
    if (level === 'medium') return BT.text.amber;
    if (level === 'high' || level === 'critical') return BT.text.red;
    return BT.text.muted;
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'critical') return BT.text.red;
    if (priority === 'high') return BT.text.amber;
    if (priority === 'medium') return BT.text.cyan;
    return BT.text.muted;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'complete') return <CheckCircle2 size={14} color={BT.text.green} />;
    if (status === 'in_progress') return <Clock size={14} color={BT.text.amber} />;
    return <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${BT.text.muted}` }} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* AI Recommendation Banner */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
        background: `linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, ${BT.bg.card} 100%)`,
        borderColor: BT.text.green,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: `rgba(16, 185, 129, 0.2)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Award size={24} color={BT.text.green} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: 10, 
              color: BT.text.green, 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              marginBottom: 4,
            }}>
              Recommended Strategy
            </div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 700, 
              color: BT.text.primary,
              marginBottom: 4,
            }}>
              Value-Add Acquisition
            </div>
            <div style={{ fontSize: 12, color: BT.text.secondary }}>
              Strong traffic fundamentals support renovation thesis with 16.2% projected IRR
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              fontSize: 28, 
              fontWeight: 700, 
              color: BT.text.green,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              88
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>Strategy Score</div>
          </div>
        </div>
      </div>

      {/* Strategy Comparison */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 16,
          color: BT.text.amber,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <Target size={14} />
          Strategy Comparison
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              onClick={() => setSelectedStrategy(strategy.id)}
              style={{
                padding: 12,
                background: selectedStrategy === strategy.id ? BT.bg.highlight : BT.bg.cardHover,
                borderRadius: 8,
                border: `2px solid ${selectedStrategy === strategy.id ? BT.text.amber : BT.border.subtle}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                opacity: strategy.trafficGate === 'disqualified' ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {getTrafficGateIcon(strategy.trafficGate)}
                <span style={{ 
                  fontSize: 11, 
                  fontWeight: 600, 
                  color: BT.text.primary,
                }}>
                  {strategy.name}
                </span>
              </div>
              
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700, 
                color: strategy.score >= 80 ? BT.text.green : 
                       strategy.score >= 60 ? BT.text.amber : BT.text.red,
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: 8,
              }}>
                {strategy.score}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: BT.text.muted }}>IRR</span>
                  <span style={{ color: BT.text.green, fontWeight: 600 }}>{strategy.irr}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: BT.text.muted }}>Multiple</span>
                  <span style={{ color: BT.text.cyan, fontWeight: 600 }}>{strategy.multiple}x</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: BT.text.muted }}>Hold</span>
                  <span style={{ color: BT.text.secondary }}>{strategy.holdPeriod}yr</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Strategy Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          padding: 16,
          background: BT.bg.cardHover,
          borderRadius: 8,
        }}>
          <div>
            <div style={{ 
              fontSize: 11, 
              color: BT.text.green, 
              fontWeight: 600, 
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <CheckCircle2 size={12} />
              Strengths
            </div>
            {selectedStrategyData.pros.map((pro, i) => (
              <div key={i} style={{ 
                fontSize: 11, 
                color: BT.text.secondary, 
                marginBottom: 4,
                paddingLeft: 12,
                position: 'relative',
              }}>
                <span style={{ 
                  position: 'absolute', 
                  left: 0, 
                  color: BT.text.green 
                }}>+</span>
                {pro}
              </div>
            ))}
          </div>
          <div>
            <div style={{ 
              fontSize: 11, 
              color: BT.text.red, 
              fontWeight: 600, 
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <AlertTriangle size={12} />
              Risks
            </div>
            {selectedStrategyData.cons.map((con, i) => (
              <div key={i} style={{ 
                fontSize: 11, 
                color: BT.text.secondary, 
                marginBottom: 4,
                paddingLeft: 12,
                position: 'relative',
              }}>
                <span style={{ 
                  position: 'absolute', 
                  left: 0, 
                  color: BT.text.red 
                }}>−</span>
                {con}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Analysis */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 16,
          color: BT.text.red,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <Shield size={14} />
          Risk Analysis
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {riskFactors.map((risk) => (
            <div key={risk.id} style={{
              padding: 12,
              background: BT.bg.cardHover,
              borderRadius: 6,
              borderLeft: `3px solid ${getRiskColor(risk.severity)}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: BT.text.primary 
                  }}>
                    {risk.name}
                  </span>
                  <span style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    background: `${getRiskColor(risk.severity)}20`,
                    color: getRiskColor(risk.severity),
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}>
                    {risk.severity}
                  </span>
                </div>
                <span style={{ 
                  fontSize: 11, 
                  color: BT.text.muted,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {(risk.probability * 100).toFixed(0)}% prob
                </span>
              </div>
              <div style={{ fontSize: 11, color: BT.text.secondary, marginBottom: 4 }}>
                <strong>Impact:</strong> {risk.impact}
              </div>
              <div style={{ fontSize: 11, color: BT.text.green }}>
                <strong>Mitigation:</strong> {risk.mitigation}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exit Scenarios */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 16,
          color: BT.text.cyan,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <BarChart3 size={14} />
          Exit Scenarios
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: 12,
          }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: BT.text.muted, fontWeight: 500 }}>Scenario</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: BT.text.muted, fontWeight: 500 }}>Probability</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: BT.text.muted, fontWeight: 500 }}>Exit Value</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: BT.text.muted, fontWeight: 500 }}>IRR</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: BT.text.muted, fontWeight: 500 }}>Multiple</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: BT.text.muted, fontWeight: 500 }}>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {exitScenarios.map((scenario) => (
                <tr key={scenario.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '10px 12px', color: BT.text.primary, fontWeight: 500 }}>
                    {scenario.name}
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '10px 12px', 
                    color: BT.text.secondary,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {(scenario.probability * 100).toFixed(0)}%
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '10px 12px', 
                    color: BT.text.cyan,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {scenario.exitValue > 0 ? `$${(scenario.exitValue / 1000000).toFixed(1)}M` : '—'}
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '10px 12px', 
                    color: scenario.irr >= 15 ? BT.text.green : 
                           scenario.irr >= 10 ? BT.text.amber : BT.text.red,
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {scenario.irr.toFixed(1)}%
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '10px 12px', 
                    color: BT.text.secondary,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {scenario.multiple > 0 ? `${scenario.multiple.toFixed(2)}x` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: BT.text.muted }}>
                    {scenario.timeline}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Weighted Average Returns */}
        <div style={{
          marginTop: 16,
          padding: 12,
          background: BT.bg.highlight,
          borderRadius: 6,
          display: 'flex',
          justifyContent: 'space-around',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Weighted Avg IRR</div>
            <div style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: BT.text.green,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              15.8%
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Weighted Avg Multiple</div>
            <div style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: BT.text.cyan,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              1.82x
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Expected Hold</div>
            <div style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: BT.text.amber,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              5.1yr
            </div>
          </div>
        </div>
      </div>

      {/* Action Items / DD Checklist */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            color: BT.text.amber,
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <Zap size={14} />
            Action Items
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>
            {actionItems.filter(a => a.status === 'complete').length}/{actionItems.length} Complete
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {actionItems.map((item) => (
            <div key={item.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: item.status === 'complete' ? 'transparent' : BT.bg.cardHover,
              borderRadius: 4,
              opacity: item.status === 'complete' ? 0.6 : 1,
            }}>
              {getStatusIcon(item.status)}
              <span style={{ 
                flex: 1, 
                fontSize: 12, 
                color: BT.text.primary,
                textDecoration: item.status === 'complete' ? 'line-through' : 'none',
              }}>
                {item.task}
              </span>
              <span style={{
                fontSize: 9,
                padding: '2px 6px',
                background: `${getPriorityColor(item.priority)}20`,
                color: getPriorityColor(item.priority),
                borderRadius: 3,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                {item.priority}
              </span>
              {item.dueDate && (
                <span style={{ fontSize: 10, color: BT.text.muted }}>
                  {item.dueDate}
                </span>
              )}
              {item.owner && (
                <span style={{ fontSize: 10, color: BT.text.dim }}>
                  {item.owner}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Investment Decision Summary */}
      <div style={{
        ...terminalStyles.panel,
        padding: 16,
        background: `linear-gradient(135deg, ${BT.bg.card} 0%, rgba(245, 158, 11, 0.08) 100%)`,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          marginBottom: 12,
          color: BT.text.amber,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <Activity size={14} />
          Investment Decision
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Recommendation</div>
            <div style={{ 
              fontSize: 16, 
              fontWeight: 700, 
              color: BT.text.green,
            }}>
              PROCEED
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Confidence Level</div>
            <div style={{ 
              fontSize: 16, 
              fontWeight: 700, 
              color: BT.text.primary,
            }}>
              HIGH (88%)
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Next Milestone</div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: BT.text.amber,
            }}>
              IC Meeting Apr 15
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Bid Deadline</div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: BT.text.cyan,
            }}>
              Apr 20, 2026
            </div>
          </div>
        </div>
      </div>

      {/* M35 Events — active market events affecting this deal's strategy */}
      {dealEvents.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.dim, letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
            M35 EVENTS — STRATEGY IMPACT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dealEvents.map(ev => (
              <M35EventCard key={ev.id} event={ev} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyTab;
