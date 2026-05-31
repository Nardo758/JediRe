/**
 * DealSharesTab — Task B Phase 1
 *
 * Bloomberg dark-mode share management panel, mounted as the "SHARES" tab on DealDetailPage.
 * Owner-only (never shown in recipient mode).
 *
 * Data flow:
 *   GET /api/v1/deals/:dealId/shares  → { capsule_id, shares[] }
 *   POST /api/v1/deals/:dealId/shares/:shareId/revoke
 *   ShareCapsuleModal for new-share creation (needs capsule_id)
 *   "Preview" button → window.open(share.share_url) in new tab
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw, Plus, Users2, Loader2, ShieldOff, Clock,
  Copy, Check, Link, ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { ShareCapsuleModal } from '../capsule/ShareCapsuleModal';

const MONO   = '"JetBrains Mono","Fira Mono",monospace';
const BG     = '#0A0E17';
const BG_NAV = '#0D1117';
const BORDER = '#1E2A3B';
const AMBER  = '#F0B429';
const GREEN  = '#3FB950';
const RED    = '#F85149';
const TEXT_DIM  = '#5A6A7E';
const TEXT_BASE = '#C9D1D9';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ShareItem {
  share_id: string;
  share_type: 'external_view' | 'external_agent_enabled';
  share_mode: 'specific_recipient' | 'shareable_link';
  label: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  preview_text: string | null;
  share_url: string | null;
  shortcode: string | null;
  share_status: 'active' | 'revoked' | 'expired';
}

interface Props {
  dealId: string;
  [k: string]: unknown;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function DealSharesTab({ dealId }: Props) {
  const [capsuleId,     setCapsuleId]     = useState<string | null>(null);
  const [shares,        setShares]        = useState<ShareItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [revokeId,      setRevokeId]      = useState<string | null>(null);
  const [copiedId,      setCopiedId]      = useState<string | null>(null);
  const [showModal,     setShowModal]     = useState(false);

  const loadShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ capsule_id: string | null; shares: ShareItem[] }>(
        `/api/v1/deals/${dealId}/shares`,
      );
      setCapsuleId(res.data.capsule_id);
      setShares(res.data.shares ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { loadShares(); }, [loadShares]);

  const revokeShare = async (shareId: string) => {
    setRevokeId(shareId);
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/shares/${shareId}/revoke`);
      await loadShares();
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to revoke share');
    } finally {
      setRevokeId(null);
    }
  };

  const copyLink = (share: ShareItem) => {
    if (!share.share_url) return;
    navigator.clipboard.writeText(share.share_url).then(() => {
      setCopiedId(share.share_id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const previewShare = (share: ShareItem) => {
    const url = share.share_url;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const activeCount  = shares.filter(s => s.share_status === 'active').length;
  const revokedCount = shares.filter(s => s.share_status === 'revoked').length;
  const agentCount   = shares.filter(s => s.share_type === 'external_agent_enabled').length;

  // ─── Render helpers ──────────────────────────────────────────────────────

  const StatusBadge = ({ status }: { status: ShareItem['share_status'] }) => {
    if (status === 'active') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontFamily: MONO, fontWeight: 600, background: `${GREEN}18`, color: GREEN, border: `1px solid ${GREEN}40` }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
        ACTIVE
      </span>
    );
    if (status === 'revoked') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontFamily: MONO, fontWeight: 600, background: '#2A1A1A', color: TEXT_DIM, border: `1px solid ${BORDER}` }}>
        <ShieldOff size={9} />
        REVOKED
      </span>
    );
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontFamily: MONO, fontWeight: 600, background: `${AMBER}12`, color: AMBER, border: `1px solid ${AMBER}40` }}>
        <Clock size={9} />
        EXPIRED
      </span>
    );
  };

  const TypeBadge = ({ type }: { type: ShareItem['share_type'] }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: MONO, fontWeight: 600, background: type === 'external_agent_enabled' ? '#1A2A3A' : '#1A1E2A', color: type === 'external_agent_enabled' ? '#58A6FF' : TEXT_DIM, border: `1px solid ${type === 'external_agent_enabled' ? '#58A6FF40' : BORDER}` }}>
      {type === 'external_agent_enabled' ? '⚡ AGENT' : '👁 VIEW'}
    </span>
  );

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 4px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: TEXT_BASE, letterSpacing: 0.5 }}>
            EXTERNAL SHARES
          </div>
          <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: MONO, marginTop: 3 }}>
            Recipients see live deal data · your edits after sharing are reflected immediately
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadShares}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT_DIM, fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}
          >
            <RotateCcw size={12} className={loading ? 'animate-spin' : ''} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            REFRESH
          </button>
          {capsuleId && (
            <button
              onClick={() => setShowModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: AMBER, border: 'none', borderRadius: 4, color: '#0A0E17', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={12} />
              NEW SHARE
            </button>
          )}
        </div>
      </div>

      {/* State: loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 0', color: TEXT_DIM, fontFamily: MONO, fontSize: 11 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          LOADING SHARES…
        </div>
      )}

      {/* State: error */}
      {!loading && error && (
        <div style={{ padding: 16, background: '#2A1A1A', border: `1px solid ${RED}40`, borderRadius: 6, color: RED, fontFamily: MONO, fontSize: 11 }}>
          {error}
        </div>
      )}

      {/* State: no capsule */}
      {!loading && !error && !capsuleId && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 0' }}>
          <Users2 size={36} style={{ color: TEXT_DIM }} />
          <div style={{ fontSize: 12, color: TEXT_DIM, fontFamily: MONO, textAlign: 'center' }}>
            NO CAPSULE FOUND
          </div>
          <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: MONO, textAlign: 'center', maxWidth: 340 }}>
            Open this deal and run a full analysis to generate a capsule, then return here to share it.
          </div>
        </div>
      )}

      {/* State: empty shares */}
      {!loading && !error && capsuleId && shares.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 0', background: BG_NAV, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
          <Users2 size={36} style={{ color: TEXT_DIM }} />
          <div style={{ fontSize: 12, color: TEXT_DIM, fontFamily: MONO }}>NO SHARES YET</div>
          <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: MONO, maxWidth: 340, textAlign: 'center' }}>
            Create a share link to give external parties access to this deal.
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: AMBER, border: 'none', borderRadius: 4, color: '#0A0E17', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}
          >
            <Plus size={12} />
            CREATE FIRST SHARE
          </button>
        </div>
      )}

      {/* Shares table */}
      {!loading && !error && shares.length > 0 && (
        <div style={{ background: BG_NAV, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 90px 90px 180px', padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, background: BG }}>
            {['RECIPIENT', 'TYPE', 'STATUS', 'CREATED', 'EXPIRES', 'ACTIONS'].map(h => (
              <div key={h} style={{ fontSize: 9, fontFamily: MONO, color: TEXT_DIM, letterSpacing: 1, fontWeight: 600 }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {shares.map((share, idx) => {
            const isActive   = share.share_status === 'active';
            const isRevoked  = share.share_status === 'revoked';
            const isCopied   = copiedId === share.share_id;
            const isRevoking = revokeId === share.share_id;

            const created = new Date(share.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
            const expires = share.expires_at
              ? new Date(share.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
              : '—';
            const expiringSoon = share.expires_at && isActive &&
              new Date(share.expires_at).getTime() - Date.now() < 7 * 86_400_000;

            return (
              <div
                key={share.share_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 90px 90px 90px 180px',
                  padding: '12px 16px',
                  borderBottom: idx < shares.length - 1 ? `1px solid ${BORDER}` : 'none',
                  background: isRevoked ? `${BG}80` : 'transparent',
                  opacity: isRevoked ? 0.65 : 1,
                }}
              >
                {/* Recipient */}
                <div style={{ minWidth: 0 }}>
                  {share.share_mode === 'shareable_link' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Link size={11} style={{ color: TEXT_DIM, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontFamily: MONO, color: TEXT_BASE, fontWeight: 600 }}>
                        {share.label || 'Shareable link'}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontFamily: MONO, color: TEXT_BASE, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {share.recipient_email}
                    </div>
                  )}
                  {share.recipient_name && (
                    <div style={{ fontSize: 10, color: TEXT_DIM, fontFamily: MONO, marginTop: 2 }}>{share.recipient_name}</div>
                  )}
                  {share.preview_text && (
                    <div style={{ fontSize: 10, color: TEXT_DIM, fontFamily: MONO, marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{share.preview_text.slice(0, 55)}{share.preview_text.length > 55 ? '…' : ''}"
                    </div>
                  )}
                </div>

                {/* Type */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <TypeBadge type={share.share_type} />
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <StatusBadge status={share.share_status} />
                </div>

                {/* Created */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontFamily: MONO, color: TEXT_DIM }}>
                  {created}
                </div>

                {/* Expires */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontFamily: MONO, color: expiringSoon ? AMBER : TEXT_DIM }}>
                  {expires}
                  {expiringSoon && <span style={{ fontSize: 9, color: AMBER, marginLeft: 4 }}>SOON</span>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Copy link */}
                  {share.share_url && (
                    <button
                      onClick={() => copyLink(share)}
                      title={share.share_url}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'none', border: `1px solid ${isCopied ? GREEN : BORDER}`, borderRadius: 3, color: isCopied ? GREEN : TEXT_DIM, fontFamily: MONO, fontSize: 9, cursor: 'pointer' }}
                    >
                      {isCopied ? <Check size={10} /> : <Copy size={10} />}
                      {isCopied ? 'COPIED' : 'COPY'}
                    </button>
                  )}

                  {/* Preview as recipient */}
                  {isActive && share.share_url && (
                    <button
                      onClick={() => previewShare(share)}
                      title="Preview as recipient"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 3, color: TEXT_DIM, fontFamily: MONO, fontSize: 9, cursor: 'pointer' }}
                    >
                      <ExternalLink size={10} />
                      PREVIEW
                    </button>
                  )}

                  {/* Revoke */}
                  {isActive && (
                    <button
                      onClick={() => revokeShare(share.share_id)}
                      disabled={isRevoking}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'none', border: `1px solid ${RED}60`, borderRadius: 3, color: RED, fontFamily: MONO, fontSize: 9, cursor: isRevoking ? 'not-allowed' : 'pointer', opacity: isRevoking ? 0.5 : 1 }}
                    >
                      {isRevoking ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldOff size={10} />}
                      REVOKE
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer stats */}
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${BORDER}`, background: BG, display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontFamily: MONO, color: GREEN }}>{activeCount} active</span>
            <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT_DIM }}>{revokedCount} revoked</span>
            <span style={{ fontSize: 10, fontFamily: MONO, color: '#58A6FF' }}>{agentCount} agent-enabled</span>
            <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT_DIM, marginLeft: 'auto' }}>
              recipients see live deal data
            </span>
          </div>
        </div>
      )}

      {/* Share creation modal */}
      {showModal && capsuleId && (
        <ShareCapsuleModal
          capsuleId={capsuleId}
          dealId={dealId}
          propertyAddress=""
          onClose={() => setShowModal(false)}
          onShareCreated={loadShares}
        />
      )}
    </div>
  );
}

export default DealSharesTab;
