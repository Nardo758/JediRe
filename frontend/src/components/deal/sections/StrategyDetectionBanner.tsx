import React, { useState } from 'react';
import { BT, Bd } from '../bloomberg-ui';
import type { DetectionResult } from '../../../hooks/useStrategyAnalysisV2';
import { MONO, confColor, pct } from './strategy-v2.utils';

interface DetectionBannerProps {
  detection: DetectionResult;
  onConfirm: () => void;
  onAdjust: (subStrategyKey: string) => void;
  onOverride: (assetClass: string) => void;
}

export function DetectionBanner({ detection, onConfirm, onAdjust, onOverride }: DetectionBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [overrideInput, setOverrideInput] = useState('');
  const [adjustInput, setAdjustInput] = useState('');

  const conf = detection.confidence;
  const cColor = confColor(conf);
  const needsConfirmation = detection.requiresUserConfirmation && !detection.userConfirmed;
  const [lowConfModal, setLowConfModal] = useState(() => conf < 0.70 && needsConfirmation);

  return (
    <>
      {lowConfModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: BT.bg.panel, border: `2px solid ${BT.text.amber}`,
            borderTop: `3px solid ${BT.text.amber}`, padding: 28, width: 480,
            boxShadow: `0 0 40px ${BT.text.amber}30`,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: BT.text.amber, marginBottom: 6 }}>
              ⚠ LOW-CONFIDENCE DETECTION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, marginBottom: 12 }}>
              Confidence <span style={{ color: cColor, fontWeight: 700 }}>{pct(conf)}</span> is below the 70% threshold.
              Scoring, evidence gates, and plan generation are <span style={{ color: BT.text.amber }}>locked</span> until you resolve this.
            </div>
            <div style={{
              background: `${BT.bg.input}`, border: `1px solid ${BT.border.subtle}`,
              padding: '8px 10px', marginBottom: 16, fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
            }}>
              <div style={{ color: BT.text.primary, fontWeight: 700, marginBottom: 4 }}>DETECTED:</div>
              <div>{(detection.assetClass || '').toUpperCase()} · {(detection.detectedDealType || '').replace(/_/g, ' ').toUpperCase()}</div>
              <div style={{ color: BT.text.muted }}>[{(detection.detectedSubStrategy || '').replace(/_/g, ' ')}]</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setLowConfModal(false); setShowAdjustPanel(true); }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan,
                background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
                padding: '5px 14px', cursor: 'pointer',
              }}>ADJUST CLASSIFICATION</button>
              <button onClick={() => { setLowConfModal(false); setShowOverrideModal(true); }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber,
                background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
                padding: '5px 14px', cursor: 'pointer',
              }}>OVERRIDE CLASSIFICATION</button>
              <button onClick={() => { onConfirm(); setLowConfModal(false); }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green,
                background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
                padding: '5px 14px', cursor: 'pointer',
              }}>✓ CONFIRM &amp; PROCEED</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        borderLeft: `3px solid ${BT.text.cyan}`, background: `${BT.text.cyan}08`,
        padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>
            DETECTED
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.primary }}>
            {(detection.assetClass || '').toUpperCase().replace(/_/g, ' ')} · {(detection.detectedDealType || '').replace(/_/g, ' ').toUpperCase()}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
            [{(detection.detectedSubStrategy || '').replace(/_/g, ' ')}]
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>CONF</span>
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700, color: cColor,
              background: `${cColor}18`, border: `1px solid ${cColor}33`, padding: '1px 6px',
            }}>{pct(conf)}</span>
          </div>

          {detection.userConfirmed && <Bd c={BT.text.green}>✓ CONFIRMED</Bd>}
          {detection.userOverrideClassification && <Bd c={BT.text.purple}>OVERRIDDEN → {detection.userOverrideClassification}</Bd>}
          {needsConfirmation && <Bd c={BT.text.amber}>CONFIRMATION REQUIRED</Bd>}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {!detection.userConfirmed && (
              <button onClick={onConfirm} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green,
                background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
                padding: '2px 8px', cursor: 'pointer',
              }}>✓ CONFIRM</button>
            )}
            <button onClick={() => setShowAdjustPanel(v => !v)} style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan,
              background: showAdjustPanel ? `${BT.text.cyan}22` : 'transparent',
              border: `1px solid ${BT.text.cyan}55`,
              padding: '2px 8px', cursor: 'pointer',
            }}>ADJUST</button>
            <button onClick={() => setExpanded(v => !v)} style={{
              fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
              background: 'transparent', border: `1px solid ${BT.border.subtle}`,
              padding: '2px 8px', cursor: 'pointer',
            }}>
              {expanded ? '▲ SIGNALS' : '▼ SIGNALS'}
            </button>
            <button onClick={() => setShowOverrideModal(true)} style={{
              fontFamily: MONO, fontSize: 9, color: BT.text.amber,
              background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>OVERRIDE CLASSIFICATION</button>
          </div>
        </div>

        {showAdjustPanel && (
          <div style={{
            marginTop: 8, padding: '10px 12px',
            background: `${BT.text.cyan}0C`, border: `1px solid ${BT.text.cyan}33`,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan, marginBottom: 6 }}>
              ADJUST DETECTED CLASSIFICATION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, marginBottom: 8 }}>
              Refine the sub-strategy within the detected asset class without overriding the asset class itself.
              Enter a sub-strategy key (e.g. mf_value_add_standard, mf_core_plus_stabilized) or leave blank to keep detected.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={adjustInput}
                onChange={e => setAdjustInput(e.target.value)}
                placeholder={`Current: ${detection.detectedSubStrategy || 'none'}`}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: 9,
                  background: BT.bg.input, color: BT.text.primary,
                  border: `1px solid ${BT.border.medium}`, padding: '4px 8px',
                }}
              />
              <button onClick={() => {
                if (adjustInput.trim()) { onAdjust(adjustInput.trim()); }
                else { onConfirm(); }
                setShowAdjustPanel(false);
              }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan,
                background: `${BT.text.cyan}22`, border: `1px solid ${BT.text.cyan}55`,
                padding: '4px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>APPLY ADJUSTMENT</button>
              <button onClick={() => setShowAdjustPanel(false)} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
                background: 'transparent', border: `1px solid ${BT.border.subtle}`,
                padding: '4px 8px', cursor: 'pointer',
              }}>CANCEL</button>
            </div>
          </div>
        )}

        {needsConfirmation && !lowConfModal && (
          <div style={{
            marginTop: 8, padding: '6px 10px',
            background: `${BT.text.amber}15`, border: `1px solid ${BT.text.amber}44`,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
              ⚠ CONFIDENCE BELOW 70% — SCORING AND EVIDENCE GATES ARE LOCKED.
              Use CONFIRM, ADJUST, or OVERRIDE CLASSIFICATION to proceed.
            </span>
          </div>
        )}

        {expanded && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(detection.detectionSignals || []).map((sig, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 140, flexShrink: 0 }}>
                  {String(sig.signal).replace(/_/g, ' ').toUpperCase()}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, width: 80 }}>
                  {String(sig.value)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 120 }}>
                  thr: {String(sig.threshold)}
                </span>
                <div style={{ flex: 1, height: 3, background: BT.bg.hover, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    background: BT.text.cyan, opacity: 0.7,
                    width: `${Math.min(100, Math.abs(Number(sig.contribution ?? 0)) * 300)}%`,
                  }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan, width: 36, textAlign: 'right' }}>
                  {((sig.contribution ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
            {detection.confidenceBreakdown && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(detection.confidenceBreakdown).map(([k, v]) => (
                  <div key={k} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
                    <span style={{ color: BT.text.muted }}>{k.replace(/([A-Z])/g, ' $1').toUpperCase()}: </span>
                    <span style={{ color: BT.text.amber }}>{typeof v === 'number' ? (v * 100).toFixed(0) + '%' : String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {(detection.alternateSubStrategies || []).length > 0 && (
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>ALTERNATES: </span>
                {detection.alternateSubStrategies.map((alt, i) => (
                  <span key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, marginLeft: 8 }}>
                    {alt.key.replace(/_/g, ' ')} · {pct(alt.fit)} · {alt.reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showOverrideModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
            borderTop: `2px solid ${BT.text.amber}`, padding: 24, width: 400,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.amber, marginBottom: 8 }}>
              OVERRIDE CLASSIFICATION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginBottom: 12 }}>
              Enter correct asset class: multifamily · sfr · retail · office · industrial · hospitality
            </div>
            <input
              value={overrideInput}
              onChange={e => setOverrideInput(e.target.value)}
              placeholder="e.g. multifamily"
              style={{
                width: '100%', fontFamily: MONO, fontSize: 10,
                background: BT.bg.input, color: BT.text.primary,
                border: `1px solid ${BT.border.medium}`, padding: '6px 8px', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowOverrideModal(false)} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
                background: 'transparent', border: `1px solid ${BT.border.subtle}`,
                padding: '4px 12px', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={() => { onOverride(overrideInput); setShowOverrideModal(false); }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber,
                background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
                padding: '4px 12px', cursor: 'pointer',
              }}>APPLY OVERRIDE</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
