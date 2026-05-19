import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BT } from '@/components/deal/bloomberg-ui';
import RecipientConnectModal from '../components/capsule/RecipientConnectModal';

const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
};

interface ShareLandingData {
  shortcode: string;
  share: {
    share_type: string;
    agent_enabled: boolean;
    expires_at: string | null;
    preview_text: string | null;
    recipient_email: string | null;
  };
  capsule: {
    id: string;
    property_address: string | null;
    asset_class: string | null;
    jedi_score: number | null;
  };
  attribution_visible: boolean;
  sender_display_name: string | null;
  sender_branding: {
    company_name: string | null;
    logo_url: string | null;
  };
}

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs <= 0) return 'This link has expired';
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return 'Link expires in 1 day';
  if (diffDays < 30) return `Link expires in ${diffDays} days`;
  return `Link expires ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function assetClassLabel(raw: string | null): string {
  if (!raw) return '';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ShareLandingPage() {
  const { shortcode } = useParams<{ shortcode: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ShareLandingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);

  useEffect(() => {
    if (!shortcode) { setError('Invalid share link.'); setLoading(false); return; }
    fetch(`/api/v1/shares/${shortcode}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? 'Share link is invalid or has expired.');
        }
        return r.json() as Promise<ShareLandingData>;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message ?? 'Failed to load share.'); setLoading(false); });
  }, [shortcode]);

  // After share data loads, check if an API key is already connected
  useEffect(() => {
    if (!shortcode || !data?.share.agent_enabled) return;
    fetch(`/api/v1/shares/${shortcode}/connection`)
      .then(r => r.ok ? r.json() : { connected: false })
      .then(body => setAgentConnected(body.connected === true))
      .catch(() => {});
  }, [shortcode, data?.share.agent_enabled]);

  const page: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0a0d16',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    ...mono,
  };

  if (loading) {
    return (
      <div style={{ ...page, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 11, color: BT.text.muted, letterSpacing: 1 }}>LOADING…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...page, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', letterSpacing: 1, marginBottom: 12 }}>
            LINK UNAVAILABLE
          </div>
          <div style={{ fontSize: 13, color: BT.text.muted, lineHeight: 1.6 }}>
            {error ?? 'This share link is invalid, expired, or has been revoked.'}
          </div>
          <div style={{ marginTop: 24, fontSize: 10, color: BT.text.muted }}>
            If you believe this is an error, contact the sender directly.
          </div>
        </div>
      </div>
    );
  }

  const { share, capsule, attribution_visible, sender_display_name, sender_branding } = data;
  const companyName = sender_branding.company_name ?? sender_display_name ?? 'Shared Deal';
  const expiryText = formatExpiry(share.expires_at);

  return (
    <div style={page}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: `1px solid ${BT.border.subtle}`,
        background: '#080b13',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Sender identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sender_branding.logo_url && (
            <img
              src={sender_branding.logo_url}
              alt={companyName}
              style={{ height: 28, objectFit: 'contain', borderRadius: 2 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: BT.text.primary, letterSpacing: 0.5 }}>
              {companyName}
            </div>
            {sender_branding.company_name && sender_display_name && (
              <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 1 }}>
                {sender_display_name}
              </div>
            )}
          </div>
        </div>

        {/* Attribution */}
        {attribution_visible && (
          <div style={{
            fontSize: 9,
            color: BT.text.muted,
            letterSpacing: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              display: 'inline-block',
              width: 6, height: 6,
              background: BT.text.cyan,
              borderRadius: '50%',
            }} />
            POWERED BY JEDIRE
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px 32px',
      }}>
        <div style={{ width: '100%', maxWidth: 580 }}>

          {/* Deal identity */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              color: BT.text.muted,
              marginBottom: 10,
            }}>
              DEAL SHARED WITH YOU
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              color: BT.text.primary,
              lineHeight: 1.3,
              marginBottom: 12,
              wordBreak: 'break-word',
            }}>
              {capsule.property_address ?? 'Property Deal'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {capsule.asset_class && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  padding: '4px 10px',
                  background: 'rgba(6,182,212,0.08)',
                  border: `1px solid rgba(6,182,212,0.25)`,
                  color: BT.text.cyan,
                }}>
                  {assetClassLabel(capsule.asset_class)}
                </span>
              )}
              {capsule.jedi_score != null && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  padding: '4px 10px',
                  background: 'rgba(234,179,8,0.08)',
                  border: '1px solid rgba(234,179,8,0.25)',
                  color: '#EAB308',
                }}>
                  JEDI {capsule.jedi_score}
                </span>
              )}
            </div>
          </div>

          {/* Preview pitch */}
          {share.preview_text && (
            <div style={{
              padding: '18px 20px',
              background: '#0f1623',
              border: `1px solid ${BT.border.subtle}`,
              borderLeft: `3px solid ${BT.text.cyan}`,
              marginBottom: 36,
            }}>
              <div style={{
                fontSize: 11,
                color: BT.text.primary,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {share.preview_text}
              </div>
              <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 12 }}>
                — {companyName}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>

            {/* PRIMARY — View the deal */}
            <button
              onClick={() => navigate(`/share/${shortcode}/deal`)}
              style={{
                width: '100%',
                padding: '16px 24px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.5,
                background: BT.text.cyan,
                color: '#000',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                ...mono,
              }}
            >
              VIEW THE DEAL
              <span style={{ fontSize: 14 }}>→</span>
            </button>

            {/* SECONDARY — Connect API key (only shown for agent-enabled shares) */}
            {share.agent_enabled && (
              agentConnected ? (
                <button
                  onClick={() => navigate(`/share/${shortcode}/deal`)}
                  style={{
                    width: '100%',
                    padding: '13px 24px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    background: 'rgba(16,185,129,0.08)',
                    color: '#10B981',
                    border: '1px solid rgba(16,185,129,0.3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    ...mono,
                  }}
                >
                  <span>✓</span>
                  AGENT CONNECTED — OPEN DEAL VIEW →
                </button>
              ) : (
                <button
                  onClick={() => setShowConnectModal(true)}
                  style={{
                    width: '100%',
                    padding: '13px 24px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    background: 'transparent',
                    color: BT.text.cyan,
                    border: `1px solid ${BT.text.cyan}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    ...mono,
                  }}
                >
                  CONNECT API KEY
                  <span style={{
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: 1,
                    padding: '2px 6px',
                    background: 'rgba(6,182,212,0.1)',
                    border: `1px solid rgba(6,182,212,0.3)`,
                    color: BT.text.cyan,
                  }}>
                    AI
                  </span>
                </button>
              )
            )}

            {/* TERTIARY — Sign up / Log in */}
            <div style={{ textAlign: 'center', paddingTop: 4 }}>
              <span style={{ fontSize: 10, color: BT.text.muted }}>
                Want full access to JediRe?{' '}
                <Link
                  to={`/login?mode=register`}
                  onClick={() => {
                    if (shortcode) sessionStorage.setItem('jedi_pending_share', shortcode);
                  }}
                  style={{
                    color: BT.text.cyan,
                    textDecoration: 'none',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                  onMouseEnter={e => (e.target as HTMLAnchorElement).style.textDecoration = 'underline'}
                  onMouseLeave={e => (e.target as HTMLAnchorElement).style.textDecoration = 'none'}
                >
                  Create a free account →
                </Link>
                <span style={{ color: BT.text.muted }}> or </span>
                <Link
                  to="/login"
                  onClick={() => {
                    if (shortcode) sessionStorage.setItem('jedi_pending_share', shortcode);
                  }}
                  style={{
                    color: BT.text.muted,
                    textDecoration: 'underline',
                    fontWeight: 600,
                  }}
                >
                  log in
                </Link>
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${BT.border.subtle}`, marginBottom: 24 }} />

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div>
              {expiryText && (
                <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>
                  {expiryText}
                </div>
              )}
              <div style={{ fontSize: 10, color: BT.text.muted }}>
                Shared by {companyName}
              </div>
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted, textAlign: 'right' }}>
              Questions?{' '}
              <a
                href="mailto:support@jedire.com"
                style={{ color: BT.text.muted, textDecoration: 'underline' }}
              >
                support@jedire.com
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* ── Connect API Key Modal ── */}
      {showConnectModal && shortcode && (
        <RecipientConnectModal
          shortcode={shortcode}
          onConnected={() => {
            setAgentConnected(true);
            setShowConnectModal(false);
            navigate(`/share/${shortcode}/deal`);
          }}
          onClose={() => setShowConnectModal(false)}
        />
      )}
    </div>
  );
}

