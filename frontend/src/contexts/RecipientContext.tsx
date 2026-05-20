/**
 * RecipientContext — Phase 1 of Task #907
 *
 * Provides state and overlay helpers for DealDetailPage in recipient mode.
 * Recipients access deals via /share/:shortcode. Legacy /capsule-link/:token
 * URLs are redirected server-side (301) to /share/:shortcode by the backend.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SharePermissions {
  share_type: string;
  allow_agent_interaction: boolean;
  allow_document_download: boolean;
  expires_at: string | null;
  preview_text?: string | null;
  recipient_email?: string | null;
}

export interface RecipientCapsule {
  id: string;
  property_address: string;
  asset_class: string;
  status: string;
  jedi_score: number | null;
  collision_score: number | null;
  deal_data: Record<string, unknown>;
  platform_intel: Record<string, unknown>;
  user_adjustments: Record<string, unknown>;
  module_outputs: Record<string, unknown>;
  snapshot_taken_at: string | null;
  created_at: string;
}

export interface RecipientDealBook {
  shortcode: string;
  share: SharePermissions;
  capsule: RecipientCapsule;
  overlay: Record<string, unknown>;
  attribution_visible: boolean;
  sender_display_name: string | null;
  sender_branding: {
    company_name: string | null;
    logo_url: string | null;
  };
}

interface RecipientContextValue {
  isRecipient: boolean;
  shortcode: string;
  dealBook: RecipientDealBook | null;
  overlay: Record<string, unknown>;
  permissions: SharePermissions | null;
  patchOverlay: (path: string, value: number) => Promise<void>;
  resetOverlay: (path?: string) => Promise<void>;
}

// ─── applyOverlay — pure, applies overlay patches onto a capsule snapshot ────

export function applyOverlay(
  capsule: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.keys(overlay).length === 0) return capsule;
  const result = JSON.parse(JSON.stringify(capsule)) as Record<string, unknown>;
  for (const [path, value] of Object.entries(overlay)) {
    const parts = path.split('.');
    let obj: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null || typeof obj[parts[i]] !== 'object') {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]] as Record<string, unknown>;
    }
    obj[parts[parts.length - 1]] = value;
  }
  return result;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RecipientContext = createContext<RecipientContextValue>({
  isRecipient: false,
  shortcode: '',
  dealBook: null,
  overlay: {},
  permissions: null,
  patchOverlay: async () => {},
  resetOverlay: async () => {},
});

export function useRecipient(): RecipientContextValue {
  return useContext(RecipientContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RecipientProvider({
  children,
  dealBook,
}: {
  children: React.ReactNode;
  dealBook: RecipientDealBook;
}) {
  const [overlay, setOverlay] = useState<Record<string, unknown>>(dealBook.overlay ?? {});
  const sc = dealBook.shortcode;

  const overlayUrl = (path?: string) => path
    ? `/api/v1/shares/${sc}/overlay?path=${encodeURIComponent(path)}`
    : `/api/v1/shares/${sc}/overlay`;

  const patchOverlay = useCallback(async (path: string, value: number) => {
    const previous = overlay[path];
    setOverlay(prev => ({ ...prev, [path]: value }));
    try {
      const res = await fetch(overlayUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [path]: value }),
      });
      if (res.ok) {
        const body = await res.json();
        setOverlay(body.overlay_data ?? {});
      } else {
        setOverlay(prev => {
          const next = { ...prev };
          if (previous === undefined) delete next[path]; else next[path] = previous;
          return next;
        });
      }
    } catch { /* keep optimistic */ }
  }, [sc, overlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetOverlay = useCallback(async (path?: string) => {
    const previous = { ...overlay };
    if (path) setOverlay(prev => { const n = { ...prev }; delete n[path]; return n; });
    else setOverlay({});
    try {
      const url = overlayUrl(path);
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) setOverlay(previous);
    } catch { /* keep optimistic */ }
  }, [sc, overlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: RecipientContextValue = {
    isRecipient: true,
    shortcode: sc,
    dealBook,
    overlay,
    permissions: dealBook.share,
    patchOverlay,
    resetOverlay,
  };

  return (
    <RecipientContext.Provider value={value}>
      {children}
    </RecipientContext.Provider>
  );
}

export default RecipientContext;
