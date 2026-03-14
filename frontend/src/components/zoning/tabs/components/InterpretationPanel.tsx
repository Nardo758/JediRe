import React, { useState } from 'react';
import { MunicodeLink } from '../SourceCitation';

export interface InterpretationDecision {
  parameter: string;
  value_used: number;
  interpretation: 'conservative' | 'moderate' | 'aggressive';
  rationale: string;
  source: string | null;
  confidence: 'high' | 'medium' | 'low';
  alternative_value?: number;
  alternative_rationale?: string;
  ambiguity?: string;
}

export interface InterpretationPanelProps {
  decisions: InterpretationDecision[];
  warnings: string[];
  userOverrides: Record<string, number>;
  onOverrideChange: (parameter: string, value: number | null) => void;
  onModeChange: (mode: 'conservative' | 'moderate' | 'aggressive') => void;
  currentMode: 'conservative' | 'moderate' | 'aggressive';
  unitCounts: {
    conservative: number;
    moderate: number;
    aggressive: number;
  };
}

const T = {
  bg: "#0a0f1a",
  bgCard: "#0f1729",
  bgCardAlt: "#111d33",
  bgHover: "#162040",
  border: "#1e2d4a",
  borderLit: "#2a4070",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#475569",
  accent: "#3b82f6",
  accentDim: "#1e40af",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

const FONT = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  body: "'IBM Plex Sans', -apple-system, sans-serif",
};

function getConfidenceColor(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return T.green;
    case 'medium':
      return T.amber;
    case 'low':
      return T.red;
  }
}

function renderConfidenceDots(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return '●●●● High';
    case 'medium':
      return '●●●○ Medium';
    case 'low':
      return '●●○○ Low';
  }
}

export default function InterpretationPanel({
  decisions,
  warnings,
  userOverrides,
  onOverrideChange,
  onModeChange,
  currentMode,
  unitCounts,
}: InterpretationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedParameter, setExpandedParameter] = useState<string | null>(null);
  const [editingParameter, setEditingParameter] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const ambiguityCount = decisions.filter(d => d.ambiguity).length;
  const overrideCount = Object.keys(userOverrides).length;

  const summaryText = `${decisions.length} interpretation decisions · ${ambiguityCount} ambiguit${ambiguityCount !== 1 ? 'ies' : 'y'} · ${overrideCount} override${overrideCount !== 1 ? 's' : ''}`;

  const handleOverrideStart = (parameter: string, currentValue: number) => {
    setEditingParameter(parameter);
    setEditingValue((userOverrides[parameter] ?? currentValue).toString());
  };

  const handleOverrideSave = (parameter: string) => {
    const value = parseFloat(editingValue);
    if (!isNaN(value)) {
      onOverrideChange(parameter, value);
    }
    setEditingParameter(null);
  };

  const handleOverrideClear = (parameter: string) => {
    onOverrideChange(parameter, null);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ═══ COLLAPSIBLE HEADER ═══ */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          padding: 12,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = T.bgCardAlt;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = T.bgCard;
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT.mono, color: T.accent, marginBottom: 4 }}>
            INTERPRETATION DECISIONS
          </div>
          <div style={{ fontSize: 10, color: T.textDim, fontFamily: FONT.mono }}>
            {summaryText}
          </div>
        </div>
        <div style={{ fontSize: 16, color: T.textMuted }}>
          {isExpanded ? '▼' : '▶'}
        </div>
      </div>

      {/* ═══ EXPANDED CONTENT ═══ */}
      {isExpanded && (
        <div style={{ marginTop: 12 }}>
          {/* Mode Toggle */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT.mono, color: T.text, marginBottom: 8 }}>
              INTERPRETATION MODE:
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['conservative', 'moderate', 'aggressive'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onModeChange(mode)}
                  style={{
                    padding: '8px 12px',
                    background: currentMode === mode ? T.bgCardAlt : 'transparent',
                    border: `1px solid ${currentMode === mode ? T.accent : T.border}`,
                    color: currentMode === mode ? T.accent : T.textMuted,
                    cursor: 'pointer',
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 4,
                    transition: 'all 0.2s',
                  }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}: {unitCounts[mode]} units
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: T.textDim, fontFamily: FONT.body, marginTop: 6 }}>
              Conservative uses worst-case interpretation. Moderate is platform's best reading. Aggressive uses developer-favorable.
            </div>
          </div>

          {/* Decisions */}
          <div style={{ background: T.bgCardAlt, border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            {decisions.map((decision, idx) => {
              const hasOverride = userOverrides[decision.parameter] !== undefined;
              const originalValue = decision.value_used;
              const overrideValue = userOverrides[decision.parameter];
              const isEditing = editingParameter === decision.parameter;

              return (
                <div key={idx} style={{ borderBottom: idx < decisions.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <div
                    onClick={() => setExpandedParameter(expandedParameter === decision.parameter ? null : decision.parameter)}
                    style={{
                      padding: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: expandedParameter === decision.parameter ? T.bgCard : 'transparent',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = T.bgCard;
                    }}
                    onMouseLeave={(e) => {
                      if (expandedParameter !== decision.parameter) {
                        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      }
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT.mono, color: T.text }}>
                          ⚙ {decision.parameter}
                        </span>
                        {hasOverride && (
                          <span
                            style={{
                              fontSize: 7,
                              fontWeight: 700,
                              color: T.accent,
                              background: T.accentDim,
                              padding: '2px 6px',
                              borderRadius: 3,
                              fontFamily: FONT.mono,
                            }}
                          >
                            OVERRIDE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT.body }}>
                        {hasOverride ? (
                          <span>
                            <span style={{ color: T.text }}>Platform: {originalValue}</span>
                            <span style={{ color: T.accent }}> → Override: {overrideValue}</span>
                            <span style={{ color: T.green }}>
                              ({((overrideValue! / originalValue - 1) * 100).toFixed(1)}%)
                            </span>
                          </span>
                        ) : (
                          <span>{originalValue}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>
                      {expandedParameter === decision.parameter ? '▼' : '▶'}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedParameter === decision.parameter && (
                    <div style={{ background: T.bgCard, padding: 12, borderTop: `1px solid ${T.border}`, fontSize: 10 }}>
                      {/* Rationale */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, color: T.text, fontFamily: FONT.mono, marginBottom: 4 }}>
                          Rationale
                        </div>
                        <div style={{ color: T.textMuted, fontFamily: FONT.body, lineHeight: 1.5 }}>
                          {decision.rationale}
                        </div>
                      </div>

                      {/* Source */}
                      {decision.source && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, color: T.text, fontFamily: FONT.mono, marginBottom: 4 }}>
                            Source
                          </div>
                          <MunicodeLink sectionNumber={decision.source} />
                        </div>
                      )}

                      {/* Confidence */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, color: T.text, fontFamily: FONT.mono, marginBottom: 4 }}>
                          Confidence
                        </div>
                        <div style={{ color: getConfidenceColor(decision.confidence), fontFamily: FONT.mono }}>
                          {renderConfidenceDots(decision.confidence)}
                        </div>
                      </div>

                      {/* Ambiguity */}
                      {decision.ambiguity && (
                        <div style={{ marginBottom: 10, padding: 8, background: T.bgCardAlt, borderLeft: `3px solid ${T.amber}` }}>
                          <div style={{ fontWeight: 600, color: T.amber, fontFamily: FONT.mono, marginBottom: 2 }}>
                            ⚠ Ambiguity
                          </div>
                          <div style={{ color: T.textMuted, fontFamily: FONT.body }}>
                            {decision.ambiguity}
                          </div>
                        </div>
                      )}

                      {/* Alternative */}
                      {decision.alternative_value !== undefined && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, color: T.text, fontFamily: FONT.mono, marginBottom: 4 }}>
                            Alternative Reading
                          </div>
                          <div style={{ color: T.textMuted, fontFamily: FONT.body }}>
                            {decision.alternative_value} — {decision.alternative_rationale}
                          </div>
                        </div>
                      )}

                      {/* Override input */}
                      <div style={{ paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="number"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '6px 8px',
                                background: T.bgCardAlt,
                                border: `1px solid ${T.accent}`,
                                color: T.text,
                                fontFamily: FONT.mono,
                                fontSize: 10,
                                borderRadius: 3,
                              }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleOverrideSave(decision.parameter);
                                if (e.key === 'Escape') setEditingParameter(null);
                              }}
                            />
                            <button
                              onClick={() => handleOverrideSave(decision.parameter)}
                              style={{
                                padding: '6px 10px',
                                background: T.accent,
                                color: T.bg,
                                border: 'none',
                                fontFamily: FONT.mono,
                                fontSize: 9,
                                fontWeight: 600,
                                borderRadius: 3,
                                cursor: 'pointer',
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingParameter(null)}
                              style={{
                                padding: '6px 10px',
                                background: 'transparent',
                                color: T.textMuted,
                                border: `1px solid ${T.border}`,
                                fontFamily: FONT.mono,
                                fontSize: 9,
                                fontWeight: 600,
                                borderRadius: 3,
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleOverrideStart(decision.parameter, originalValue)}
                              style={{
                                flex: 1,
                                padding: '6px 8px',
                                background: 'transparent',
                                color: T.accent,
                                border: `1px solid ${T.accent}`,
                                fontFamily: FONT.mono,
                                fontSize: 9,
                                fontWeight: 600,
                                borderRadius: 3,
                                cursor: 'pointer',
                              }}
                            >
                              {hasOverride ? 'Edit Override' : 'Add Override'}
                            </button>
                            {hasOverride && (
                              <button
                                onClick={() => handleOverrideClear(decision.parameter)}
                                style={{
                                  padding: '6px 10px',
                                  background: 'transparent',
                                  color: T.red,
                                  border: `1px solid ${T.red}`,
                                  fontFamily: FONT.mono,
                                  fontSize: 9,
                                  fontWeight: 600,
                                  borderRadius: 3,
                                  cursor: 'pointer',
                                }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {warnings.map((warning, idx) => (
                <div
                  key={idx}
                  style={{
                    background: T.bgCardAlt,
                    border: `1px solid ${T.amber}60`,
                    borderLeft: `3px solid ${T.amber}`,
                    borderRadius: 4,
                    padding: 10,
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 14, marginTop: 1 }}>⚠</div>
                  <div style={{ color: T.textMuted, fontFamily: FONT.body, fontSize: 10, lineHeight: 1.5 }}>
                    {warning}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
