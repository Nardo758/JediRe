import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace" };

const PREMIUM_TIERS = ['enterprise'];

interface BrandingData {
  company_name: string | null;
  logo_url: string | null;
  show_attribution: boolean;
  can_remove_attribution: boolean;
  tier: string;
}

export function BrandingSettings() {
  const [data, setData] = useState<BrandingData | null>(null);
  const [form, setForm] = useState({
    company_name: '',
    logo_url: '',
    show_attribution: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/api/v1/settings/branding')
      .then(res => {
        const d: BrandingData = res.data.data;
        setData(d);
        setForm({
          company_name: d.company_name ?? '',
          logo_url: d.logo_url ?? '',
          show_attribution: d.show_attribution ?? true,
        });
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load branding settings' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        company_name: form.company_name.trim() || null,
        logo_url: form.logo_url.trim() || null,
      };
      if (data?.can_remove_attribution) {
        payload.show_attribution = form.show_attribution;
      }
      const res = await apiClient.put('/api/v1/settings/branding', payload);
      const updated: BrandingData = res.data.data;
      setData(updated);
      setForm({
        company_name: updated.company_name ?? '',
        logo_url: updated.logo_url ?? '',
        show_attribution: updated.show_attribution ?? true,
      });
      setMessage({ type: 'success', text: res.data.data.warning ?? 'Branding settings saved' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save branding settings' });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 12,
    background: BT.bg.input,
    border: `1px solid ${BT.border.medium}`,
    color: BT.text.primary,
    outline: 'none',
    ...mono,
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: BT.text.muted, ...mono }}>
        Loading...
      </div>
    );
  }

  const canRemove = data?.can_remove_attribution ?? false;

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: BT.text.primary, letterSpacing: 1, marginBottom: 6, ...mono }}>
        🏷️ BRANDING SETTINGS
      </div>
      <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 28, ...mono }}>
        Customize how your shared deals appear to recipients
      </div>

      {message && (
        <div style={{
          padding: '10px 14px', marginBottom: 20, fontSize: 11, ...mono,
          background: message.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${message.type === 'success' ? '#10B981' : '#EF4444'}40`,
          color: message.type === 'success' ? '#10B981' : '#EF4444',
        }}>
          {message.text}
        </div>
      )}

      {/* Company Name */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1, color: BT.text.muted, marginBottom: 6, ...mono }}>
          COMPANY NAME
        </label>
        <input
          type="text"
          value={form.company_name}
          onChange={e => setForm(f => ({ ...f, company_name: e.target.value.slice(0, 120) }))}
          placeholder="Acme Capital"
          maxLength={120}
          style={inputStyle}
        />
        <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 5, ...mono }}>
          Displayed in the deal header for recipients. All tiers.
        </div>
      </div>

      {/* Logo URL */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1, color: BT.text.muted, marginBottom: 6, ...mono }}>
          LOGO URL
        </label>
        <input
          type="url"
          value={form.logo_url}
          onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
          placeholder="https://example.com/logo.png"
          style={inputStyle}
        />
        {form.logo_url && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={form.logo_url}
              alt="logo preview"
              style={{ height: 28, objectFit: 'contain', borderRadius: 2, background: '#0d1117', padding: 2 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}>Preview</span>
          </div>
        )}
        <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 5, ...mono }}>
          Direct URL to your logo image. Shown alongside your company name. All tiers.
        </div>
      </div>

      {/* Attribution toggle — premium only */}
      <div style={{
        padding: '16px 18px',
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: BT.text.primary, marginBottom: 5, ...mono }}>
              JEDIRE ATTRIBUTION
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted, lineHeight: 1.5, ...mono }}>
              {canRemove
                ? 'When enabled, recipients see "Powered by JediRe" on shared deals.'
                : 'JediRe attribution is visible on all your shared deals. Upgrade to Enterprise to customize.'}
            </div>
          </div>
          {canRemove ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={form.show_attribution}
                onChange={e => setForm(f => ({ ...f, show_attribution: e.target.checked }))}
                style={{ accentColor: BT.text.cyan, width: 14, height: 14 }}
              />
              <span style={{ fontSize: 10, color: form.show_attribution ? BT.text.cyan : BT.text.muted, ...mono }}>
                {form.show_attribution ? 'VISIBLE' : 'HIDDEN'}
              </span>
            </label>
          ) : (
            <div style={{
              fontSize: 9, fontWeight: 600, letterSpacing: 0.6, ...mono,
              padding: '4px 10px',
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.25)',
              color: '#EAB308',
            }}>
              ENTERPRISE
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 24px',
          fontSize: 11, fontWeight: 700, letterSpacing: 1,
          background: saving ? BT.bg.active : BT.text.cyan,
          color: saving ? BT.text.muted : '#000',
          border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
          ...mono,
        }}
      >
        {saving ? 'SAVING…' : 'SAVE BRANDING'}
      </button>
    </div>
  );
}
