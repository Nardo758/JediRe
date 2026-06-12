import React, { useState, useEffect } from 'react';
import { Check, X, Clock, AlertTriangle, Lightbulb, ShieldAlert, TrendingUp, Hammer, Banknote, Building, ArrowRight } from 'lucide-react';
import { BT } from '../deal/bloomberg-ui';
import { getScenario, updateScenarioMeta } from '../../services/underwriting-scenarios.api';

const MONO = BT.font.mono;

interface CIEFinding {
  finding_id: string;
  domain: string;
  finding_type: string;
  severity: string;
  subject: {
    field_path: string;
    current_value: number | null;
    projected_value: number | null;
    current_state_description: string;
  };
  cohort: {
    cohort_n: number;
    cohort_match_quality: string;
    distribution: { p50: number; p75: number };
  };
  finding: {
    direction: string;
    gap_magnitude: number;
    gap_significance: string;
  };
  action: {
    type: string;
    estimated_annual_impact: number;
    estimated_capex_required: number;
    estimated_payback_months: number | null;
    implementation_difficulty: string;
  };
  evidence_narrative: string;
  confidence: string;
  sponsor_state: 'unreviewed' | 'accepted' | 'declined' | 'deferred';
  sponsor_reason?: string;
  sponsor_action_taken?: string;
  sponsor_reviewed_at?: string;
}

interface ScenarioCIFindingsProps {
  dealId: string;
  scenarioId: string;
}

const DOMAIN_ICON: Record<string, React.ReactNode> = {
  revenue: <TrendingUp size={10} />,
  opex: <Building size={10} />,
  capex: <Hammer size={10} />,
  debt: <Banknote size={10} />,
  operating: <Building size={10} />,
  exit: <ArrowRight size={10} />,
};

const SEVERITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  opportunity_major: { bg: '#10B98120', color: '#10B981', label: 'OPPORTUNITY · MAJOR' },
  opportunity_minor: { bg: '#10B98110', color: '#10B981', label: 'OPPORTUNITY · MINOR' },
  risk_major: { bg: '#EF444420', color: '#EF4444', label: 'RISK · MAJOR' },
  risk_minor: { bg: '#F59E0B20', color: '#F59E0B', label: 'RISK · MINOR' },
  informational: { bg: '#6B758520', color: '#6B7585', label: 'INFO' },
};

const STATE_ICON: Record<string, React.ReactNode> = {
  unreviewed: <Clock size={10} color={BT.text.muted} />,
  accepted: <Check size={10} color="#10B981" />,
  declined: <X size={10} color="#EF4444" />,
  deferred: <Clock size={10} color="#F59E0B" />,
};

export const ScenarioCIFindings: React.FC<ScenarioCIFindingsProps> = ({ dealId, scenarioId }) => {
  const [findings, setFindings] = useState<CIEFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId || !scenarioId) return;
    let cancelled = false;
    setLoading(true);
    getScenario(dealId, scenarioId)
      .then(scenario => {
        if (cancelled) return;
        const raw = (scenario?.year1?._ci_findings ?? scenario?.year1?.ci_findings ?? []) as CIEFinding[];
        setFindings(Array.isArray(raw) ? raw : []);
      })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Failed to load findings'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dealId, scenarioId]);

  const handleStateChange = async (findingId: string, newState: CIEFinding['sponsor_state']) => {
    const updated = findings.map(f =>
      f.finding_id === findingId
        ? { ...f, sponsor_state: newState, sponsor_reviewed_at: new Date().toISOString() }
        : f
    );
    setFindings(updated);
    try {
      await updateScenarioMeta(dealId, scenarioId, {
        notes: JSON.stringify({ _ci_findings: updated }),
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save finding state');
    }
  };

  if (loading) {
    return (
      <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: 10 }}>
        Loading CIE findings…
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div style={{
        padding: '12px 10px',
        background: BT.bg.panel,
        border: `1px dashed ${BT.border.subtle}`,
        borderRadius: 2,
        fontFamily: MONO,
        fontSize: 9,
        color: BT.text.muted,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Lightbulb size={12} color={BT.text.muted} />
          <span style={{ fontWeight: 700 }}>NO CIE FINDINGS YET</span>
        </div>
        <div style={{ lineHeight: 1.5 }}>
          Competitive Intelligence Engine findings will appear here after the CIE post-pass runs.
          Findings compare this scenario against archive cohorts to surface opportunities and risks.
        </div>
      </div>
    );
  }

  const grouped = findings.reduce((acc, f) => {
    acc[f.domain] = acc[f.domain] ?? [];
    acc[f.domain].push(f);
    return acc;
  }, {} as Record<string, CIEFinding[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && (
        <div style={{
          padding: '4px 8px', background: '#EF444410',
          border: `1px solid #EF444444`, fontFamily: MONO, fontSize: 9, color: '#EF4444',
        }}>
          {error}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: MONO, fontSize: 9, color: BT.text.muted,
      }}>
        <ShieldAlert size={10} />
        <span>{findings.length} FINDING{findings.length !== 1 ? 'S' : ''} · {findings.filter(f => f.sponsor_state === 'unreviewed').length} UNREVIEWED</span>
      </div>
      {Object.entries(grouped).map(([domain, domainFindings]) => (
        <div key={domain} style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.subtle}`,
          borderRadius: 2,
        }}>
          <div style={{
            padding: '4px 8px',
            background: BT.bg.header,
            borderBottom: `1px solid ${BT.border.subtle}`,
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            color: BT.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            {DOMAIN_ICON[domain] ?? <Lightbulb size={10} />}
            {domain}
          </div>
          <div style={{ padding: '4px 0' }}>
            {domainFindings.map(f => {
              const style = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.informational;
              return (
                <div key={f.finding_id} style={{
                  padding: '6px 8px',
                  borderBottom: `1px solid ${BT.border.subtle}10`,
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '1px 4px', borderRadius: 2, fontSize: 8, fontWeight: 700,
                      background: style.bg, color: style.color, letterSpacing: 0.4,
                    }}>
                      {style.label}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, fontWeight: 700 }}>
                      {f.finding_type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
                      {STATE_ICON[f.sponsor_state]}
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, textTransform: 'uppercase' }}>
                        {f.sponsor_state}
                      </span>
                    </span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.4 }}>
                    {f.evidence_narrative}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {f.subject.current_value != null && (
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                        SUBJECT: {f.subject.current_value.toLocaleString()}
                      </span>
                    )}
                    {f.cohort?.distribution?.p50 != null && (
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                        COHORT P50: {f.cohort.distribution.p50.toLocaleString()} ({f.cohort.cohort_n} deals)
                      </span>
                    )}
                    {f.action?.estimated_annual_impact != null && (
                      <span style={{ fontFamily: MONO, fontSize: 8, color: f.action.estimated_annual_impact > 0 ? '#10B981' : '#EF4444' }}>
                        IMPACT: {f.action.estimated_annual_impact > 0 ? '+' : ''}{f.action.estimated_annual_impact.toLocaleString()}/yr
                      </span>
                    )}
                    {f.action?.estimated_capex_required > 0 && (
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>
                        CAPEX: {f.action.estimated_capex_required.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    {(['accepted', 'declined', 'deferred'] as const).map(state => (
                      <button
                        key={state}
                        onClick={() => handleStateChange(f.finding_id, state)}
                        style={{
                          background: f.sponsor_state === state ? `${BT.text.green}20` : 'transparent',
                          border: `1px solid ${f.sponsor_state === state ? BT.text.green : BT.border.subtle}`,
                          color: f.sponsor_state === state ? BT.text.green : BT.text.secondary,
                          fontFamily: MONO, fontSize: 8, padding: '1px 6px',
                          cursor: 'pointer', borderRadius: 2, textTransform: 'uppercase',
                        }}
                      >
                        {state}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ScenarioCIFindings;
