import React, { useState, useEffect } from 'react';
import { X, Share2, CheckCircle, Copy, AlertTriangle, Loader2, ExternalLink, Link, User } from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { DivergenceDisagreementsSection } from './DivergenceDisagreementsSection';

interface ShareCapsuleModalProps {
  capsuleId: string;
  propertyAddress: string;
  onClose: () => void;
  onShareCreated?: () => void;
  /** The deal UUID for divergence analysis. Defaults to capsuleId when not provided
   *  (DealDetailPage passes dealId as capsuleId; other contexts should pass explicitly). */
  dealId?: string;
}

interface ShareResult {
  capsule_url: string;
  access_token: string;
  share_mode: string;
  label: string | null;
  recipient_email: string | null;
  share_type: string;
  share_id: string;
  email_queued: boolean;
}

interface BrandingSettings {
  can_remove_attribution: boolean;
  show_attribution: boolean;
}

type ShareMode = 'specific_recipient' | 'shareable_link';

const MONO = "'JetBrains Mono','Fira Code','IBM Plex Mono',monospace";
const BG      = '#0D1117';
const BG_PANEL = '#111827';
const BG_ROW   = '#0A0F1A';
const BORDER   = '#1E2A3A';
const BORDER_MID = '#2A3441';
const TEXT     = '#E8E6E1';
const TEXT_MID = '#9EA8B4';
const TEXT_DIM = '#6B7585';
const AMBER    = '#F59E0B';
const GREEN    = '#10B981';
const RED      = '#EF4444';
const BLUE     = '#3B82F6';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: BG_ROW,
  border: `1px solid ${BORDER_MID}`,
  borderRadius: 2,
  color: TEXT,
  fontFamily: MONO,
  fontSize: 11,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: MONO,
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 0.8,
  color: TEXT_DIM,
  textTransform: 'uppercase' as const,
  marginBottom: 5,
};

const ShareCapsuleModal: React.FC<ShareCapsuleModalProps> = ({
  capsuleId,
  propertyAddress,
  onClose,
  onShareCreated,
  dealId: dealIdProp,
}) => {
  // dealIdProp is the real deal UUID for divergence analysis.
  // DealDetailPage passes dealId as capsuleId (they are the same).
  // Other contexts (TerminalPage, DealSharesTab) pass dealId explicitly.
  const divergenceDealId = dealIdProp ?? capsuleId;
  const [shareMode, setShareMode] = useState<ShareMode>('specific_recipient');
  const [shareForm, setShareForm] = useState({
    recipient_email: '',
    recipient_name: '',
    label: '',
    share_type: 'external_agent_enabled' as 'external_view' | 'external_agent_enabled',
    preview_text: '',
    expires_at: '',
  });
  const [showAttributionOverride, setShowAttributionOverride] = useState<boolean>(true);
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [includeDisagreements, setIncludeDisagreements] = useState(false);

  useEffect(() => {
    apiClient.get('/api/v1/settings/branding')
      .then(res => {
        const d = res.data?.data;
        if (d) {
          setBrandingSettings({ can_remove_attribution: d.can_remove_attribution, show_attribution: d.show_attribution });
          setShowAttributionOverride(d.show_attribution ?? true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareLoading(true);
    setShareError(null);
    try {
      const payload: Record<string, unknown> = {
        share_mode: shareMode,
        share_type: shareForm.share_type,
      };
      if (shareMode === 'specific_recipient') {
        payload.recipient_email = shareForm.recipient_email;
        if (shareForm.recipient_name.trim()) payload.recipient_name = shareForm.recipient_name.trim();
      } else {
        if (shareForm.label.trim()) payload.label = shareForm.label.trim();
      }
      if (shareForm.preview_text.trim()) payload.preview_text = shareForm.preview_text.trim();
      if (shareForm.expires_at) payload.expires_at = shareForm.expires_at;
      if (brandingSettings?.can_remove_attribution) {
        payload.show_attribution_override = showAttributionOverride;
      }
      // Freeze the operator's divergence-inclusion decision into the share snapshot.
      // External render path checks preview_metadata.include_divergences at display time.
      payload.preview_metadata = { include_divergences: includeDisagreements };
      const res = await apiClient.post(`/api/v1/deals/${capsuleId}/share/external`, payload);
      setShareResult(res.data);
      onShareCreated?.();
    } catch (err: any) {
      setShareError(err.response?.data?.error ?? err.message ?? 'Failed to create share');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareResult) return;
    navigator.clipboard.writeText(shareResult.capsule_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canSubmit = shareMode === 'specific_recipient'
    ? !!shareForm.recipient_email
    : true;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.72)', padding: 16,
    }}>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_MID}`,
        borderRadius: 0,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${BORDER}`,
          background: BG,
        }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: AMBER }}>
              SHARE CAPSULE
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT_DIM, marginTop: 2, letterSpacing: 0.4 }}>
              {propertyAddress}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_DIM, padding: 4, lineHeight: 1 }}
          >
            <X size={14} />
          </button>
        </div>

        {shareResult ? (
          /* ── Success state ── */
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Status banner */}
            <div style={{
              background: `${GREEN}12`,
              border: `1px solid ${GREEN}40`,
              borderRadius: 2,
              padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <CheckCircle size={14} color={GREEN} />
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: 0.6 }}>
                  {shareResult.share_mode === 'shareable_link'
                    ? 'SHAREABLE LINK CREATED'
                    : shareResult.email_queued
                      ? `INVITATION EMAILED — ${shareResult.recipient_email}`
                      : `SHARE CREATED — ${shareResult.recipient_email}`}
                </span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT_DIM, paddingLeft: 22 }}>
                {shareResult.share_mode === 'shareable_link'
                  ? `Anyone with this link can access the deal.${shareResult.label ? ` Label: ${shareResult.label}` : ''}`
                  : shareResult.email_queued
                    ? 'You can also copy the link below to send via another channel.'
                    : 'Email delivery not yet enabled — copy the link and send directly.'}
              </div>
            </div>

            {/* Link row */}
            <div>
              <div style={labelStyle}>Capsule Link</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  readOnly
                  value={shareResult.capsule_url}
                  style={{ ...inputStyle, flex: 1, color: TEXT_MID }}
                />
                <button
                  onClick={handleCopy}
                  style={{
                    fontFamily: MONO, fontSize: 9, fontWeight: 600,
                    padding: '6px 12px', letterSpacing: 0.6,
                    background: copied ? `${GREEN}18` : BG_ROW,
                    border: `1px solid ${copied ? GREEN : BORDER_MID}`,
                    color: copied ? GREEN : TEXT_MID,
                    borderRadius: 2, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                    flexShrink: 0,
                  }}
                >
                  <Copy size={10} />
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>

            {/* Meta row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: BG_ROW, border: `1px solid ${BORDER}`, padding: '8px 12px' }}>
                <div style={labelStyle}>Share Type</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT }}>
                  {shareResult.share_type === 'external_agent_enabled' ? 'Agent Enabled' : 'View Only'}
                </div>
              </div>
              <div style={{ background: BG_ROW, border: `1px solid ${BORDER}`, padding: '8px 12px' }}>
                <div style={labelStyle}>Share ID</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shareResult.share_id}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: 0.6,
                  padding: '8px 0', background: 'transparent',
                  border: `1px solid ${BORDER_MID}`, color: TEXT_MID, borderRadius: 2, cursor: 'pointer',
                }}
              >
                DONE
              </button>
              <button
                onClick={() => setShareResult(null)}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: 0.6,
                  padding: '8px 0', background: `${AMBER}18`,
                  border: `1px solid ${AMBER}60`, color: AMBER, borderRadius: 2, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Share2 size={10} />
                SHARE AGAIN
              </button>
            </div>
          </div>
        ) : (
          /* ── Form state ── */
          <form onSubmit={handleSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Mode toggle */}
            <div>
              <div style={labelStyle}>Share Mode</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([
                  { mode: 'specific_recipient' as ShareMode, icon: <User size={10} />, label: 'SPECIFIC RECIPIENT', desc: 'Email required at creation' },
                  { mode: 'shareable_link' as ShareMode, icon: <Link size={10} />, label: 'SHAREABLE LINK', desc: 'Anyone with link can open' },
                ] as const).map(opt => {
                  const active = shareMode === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => setShareMode(opt.mode)}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                        background: active ? `${AMBER}12` : BG_ROW,
                        border: `1px solid ${active ? AMBER : BORDER_MID}`,
                        borderRadius: 2,
                        transition: 'border-color 0.1s',
                      }}
                    >
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                        color: active ? AMBER : TEXT_MID,
                      }}>
                        {opt.icon}{opt.label}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: active ? `${AMBER}90` : TEXT_DIM, letterSpacing: 0.3 }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recipient fields */}
            {shareMode === 'specific_recipient' && (
              <>
                <div>
                  <label style={labelStyle}>
                    Recipient Email <span style={{ color: RED }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={shareForm.recipient_email}
                    onChange={e => setShareForm(f => ({ ...f, recipient_email: e.target.value }))}
                    placeholder="investor@example.com"
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = AMBER; }}
                    onBlur={e => { e.currentTarget.style.borderColor = BORDER_MID; }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Recipient Name</label>
                  <input
                    type="text"
                    value={shareForm.recipient_name}
                    onChange={e => setShareForm(f => ({ ...f, recipient_name: e.target.value }))}
                    placeholder="Jane Smith"
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = AMBER; }}
                    onBlur={e => { e.currentTarget.style.borderColor = BORDER_MID; }}
                  />
                </div>
              </>
            )}

            {/* Label field (shareable link only) */}
            {shareMode === 'shareable_link' && (
              <div>
                <label style={labelStyle}>
                  Label <span style={{ color: TEXT_DIM, fontWeight: 400 }}>(optional, max 200)</span>
                </label>
                <input
                  type="text"
                  value={shareForm.label}
                  onChange={e => setShareForm(f => ({ ...f, label: e.target.value.slice(0, 200) }))}
                  placeholder="LP outreach Q2, Lender list — Atlanta deals…"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = AMBER; }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER_MID; }}
                />
              </div>
            )}

            {/* Access type */}
            <div>
              <div style={labelStyle}>Access Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { value: 'external_agent_enabled', label: 'AGENT ENABLED', desc: 'Recipient can query AI with their own API key' },
                  { value: 'external_view', label: 'VIEW ONLY', desc: 'Read-only access, no agent interaction' },
                ].map(opt => {
                  const active = shareForm.share_type === opt.value;
                  return (
                    <label
                      key={opt.value}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        padding: '10px 12px', cursor: 'pointer',
                        background: active ? `${BLUE}10` : BG_ROW,
                        border: `1px solid ${active ? BLUE : BORDER_MID}`,
                        borderRadius: 2,
                        transition: 'border-color 0.1s',
                      }}
                    >
                      <input
                        type="radio"
                        name="share_type"
                        value={opt.value}
                        checked={active}
                        onChange={() => setShareForm(f => ({ ...f, share_type: opt.value as typeof f.share_type }))}
                        style={{ display: 'none' }}
                      />
                      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: active ? BLUE : TEXT_MID }}>
                        {opt.label}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: active ? `${BLUE}99` : TEXT_DIM, letterSpacing: 0.3, lineHeight: 1.4 }}>
                        {opt.desc}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Preview pitch */}
            <div>
              <label style={labelStyle}>
                Preview Pitch <span style={{ color: TEXT_DIM, fontWeight: 400 }}>(optional, max 500)</span>
              </label>
              <textarea
                value={shareForm.preview_text}
                onChange={e => setShareForm(f => ({ ...f, preview_text: e.target.value.slice(0, 500) }))}
                placeholder="Short note to the recipient about this deal…"
                rows={3}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                onFocus={e => { e.currentTarget.style.borderColor = AMBER; }}
                onBlur={e => { e.currentTarget.style.borderColor = BORDER_MID; }}
              />
              <div style={{ fontFamily: MONO, fontSize: 8, color: TEXT_DIM, textAlign: 'right', marginTop: 3 }}>
                {shareForm.preview_text.length}/500
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label style={labelStyle}>
                Expires On <span style={{ color: TEXT_DIM, fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="date"
                value={shareForm.expires_at}
                onChange={e => setShareForm(f => ({ ...f, expires_at: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                style={{ ...inputStyle, colorScheme: 'dark' }}
                onFocus={e => { e.currentTarget.style.borderColor = AMBER; }}
                onBlur={e => { e.currentTarget.style.borderColor = BORDER_MID; }}
              />
            </div>

            {/* Source Disagreements — internal divergence preview with redact toggle */}
            <div>
              <div style={labelStyle}>Source Disagreements</div>
              <div style={{
                fontFamily: MONO, fontSize: 8, color: TEXT_DIM, marginBottom: 8, lineHeight: 1.5,
              }}>
                Fields where data sources disagree beyond materiality thresholds.
                Toggle inclusion to decide whether recipients see this analysis.
                Restricted vendor names are automatically redacted in external shares.
              </div>
              <DivergenceDisagreementsSection
                dealId={divergenceDealId}
                isInternal={false}
                showIncludeToggle={true}
                included={includeDisagreements}
                onIncludeChange={setIncludeDisagreements}
              />
            </div>

            {/* Attribution override — principal/institutional only */}
            {brandingSettings?.can_remove_attribution && (
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                padding: '10px 12px',
                background: BG_ROW,
                border: `1px solid ${BORDER_MID}`,
                borderRadius: 2,
              }}>
                <input
                  type="checkbox"
                  checked={showAttributionOverride}
                  onChange={e => setShowAttributionOverride(e.target.checked)}
                  style={{ marginTop: 1, accentColor: AMBER, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: 0.6, color: TEXT_MID }}>
                    SHOW JEDIRE ATTRIBUTION
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: TEXT_DIM, marginTop: 3, lineHeight: 1.4 }}>
                    Display "Powered by JediRe" on this share's landing page
                  </div>
                </div>
              </label>
            )}

            {/* Error */}
            {shareError && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: `${RED}10`, border: `1px solid ${RED}40`,
                borderRadius: 2, padding: '8px 12px',
              }}>
                <AlertTriangle size={12} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 9, color: RED, lineHeight: 1.5 }}>{shareError}</span>
              </div>
            )}

            {/* Submit row */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: 0.6,
                  padding: '8px 0', background: 'transparent',
                  border: `1px solid ${BORDER_MID}`, color: TEXT_MID, borderRadius: 2, cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={shareLoading || !canSubmit}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: 0.6,
                  padding: '8px 0',
                  background: shareLoading || !canSubmit ? `${AMBER}08` : `${AMBER}18`,
                  border: `1px solid ${shareLoading || !canSubmit ? BORDER_MID : AMBER}`,
                  color: shareLoading || !canSubmit ? TEXT_DIM : AMBER,
                  borderRadius: 2,
                  cursor: shareLoading || !canSubmit ? 'not-allowed' : 'pointer',
                  opacity: shareLoading || !canSubmit ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'opacity 0.1s',
                }}
              >
                {shareLoading ? (
                  <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> CREATING…</>
                ) : shareMode === 'shareable_link' ? (
                  <><Link size={10} /> GENERATE LINK</>
                ) : (
                  <><ExternalLink size={10} /> SHARE</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export { ShareCapsuleModal };
export default ShareCapsuleModal;
