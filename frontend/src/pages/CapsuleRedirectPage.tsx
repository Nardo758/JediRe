/**
 * CapsuleRedirectPage — Task B Phase 2
 *
 * Mounted at /capsules/:id (replacing CapsuleDetailPage).
 * Resolves capsule_id → deal_id via the backend, then redirects to
 * /deals/:dealId/detail?tab=shares.
 *
 * If the deal cannot be resolved (capsule_id unknown, permission denied,
 * or user not authenticated) → redirect to /deals (pipeline).
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';

const MONO   = '"JetBrains Mono","Fira Mono",monospace';
const BG     = '#0A0E17';
const TEXT_DIM = '#5A6A7E';

export default function CapsuleRedirectPage() {
  const { id: capsuleId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'resolving' | 'redirecting' | 'fallback'>('resolving');

  useEffect(() => {
    if (!capsuleId) { navigate('/deals', { replace: true }); return; }

    apiClient.get<{ deal_id: string }>(`/api/v1/capsules-ext/${capsuleId}/resolve-deal`)
      .then(res => {
        const dealId = res.data?.deal_id;
        if (dealId) {
          setStatus('redirecting');
          navigate(`/deals/${dealId}/detail?tab=shares`, { replace: true });
        } else {
          setStatus('fallback');
          navigate('/deals', { replace: true });
        }
      })
      .catch(() => {
        setStatus('fallback');
        navigate('/deals', { replace: true });
      });
  }, [capsuleId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      height: '100vh', background: BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12,
    }}>
      <div style={{ fontSize: 11, fontFamily: MONO, color: TEXT_DIM, letterSpacing: 1 }}>
        {status === 'resolving'   && 'RESOLVING CAPSULE…'}
        {status === 'redirecting' && 'REDIRECTING TO DEAL…'}
        {status === 'fallback'    && 'REDIRECTING TO PIPELINE…'}
      </div>
    </div>
  );
}
