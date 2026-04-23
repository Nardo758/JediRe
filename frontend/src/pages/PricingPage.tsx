import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import { Check, Zap, BarChart3, Globe, Lock } from 'lucide-react';

const T = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', panelAlt: '#131821', header: '#1A1F2E', hover: '#1E2538', topBar: '#050810' },
  text: { primary: '#E8ECF1', secondary: '#A0ABBE', muted: '#6B7A8D', amber: '#F5A623', amberBright: '#FFD166', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4', purple: '#A78BFA' },
  border: { subtle: '#1E2538', medium: '#2A3348', bright: '#3B4A6B' },
  font: { mono: "'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

interface Tier {
  id: 'scout' | 'operator' | 'principal' | 'institutional';
  label: string;
  price: number | null;
  credits: number | null;
  color: string;
  highlight: boolean;
  icon: React.ReactNode;
  tagline: string;
  features: string[];
  limits: { deals: string; automation: string; surfaces: string };
}

const TIERS: Tier[] = [
  {
    id: 'scout',
    label: 'SCOUT',
    price: 97,
    credits: 100,
    color: T.text.secondary,
    highlight: false,
    icon: <Zap size={18} />,
    tagline: 'For solo analysts exploring deals',
    features: [
      '100 AI credits / month',
      'Up to 5 active deals',
      'AI chat interface',
      'Deal scoring & pipeline',
      'Market intelligence',
      'Basic underwriting tools',
    ],
    limits: { deals: '5 deals', automation: 'Level 1', surfaces: 'Chat only' },
  },
  {
    id: 'operator',
    label: 'OPERATOR',
    price: 197,
    credits: 500,
    color: T.text.cyan,
    highlight: true,
    icon: <BarChart3 size={18} />,
    tagline: 'For active deal teams running pipeline',
    features: [
      '500 AI credits / month',
      'Up to 25 active deals',
      'AI chat + web surface',
      'Full underwriting suite',
      'News intelligence',
      'Document analysis',
      'Email integration',
      'Strategy builder',
    ],
    limits: { deals: '25 deals', automation: 'Level 2', surfaces: 'Chat + Web' },
  },
  {
    id: 'principal',
    label: 'PRINCIPAL',
    price: 397,
    credits: 2000,
    color: T.text.amber,
    highlight: false,
    icon: <Globe size={18} />,
    tagline: 'For investment principals & fund managers',
    features: [
      '2,000 AI credits / month',
      'Unlimited active deals',
      'Chat + Web + API surfaces',
      'Full automation suite',
      'Portfolio analytics',
      'Advanced comps engine',
      'Multi-market coverage',
      'Priority AI processing',
      'Custom report templates',
    ],
    limits: { deals: 'Unlimited', automation: 'Level 3', surfaces: 'Chat + Web + API' },
  },
  {
    id: 'institutional',
    label: 'INSTITUTIONAL',
    price: null,
    credits: null,
    color: T.text.purple,
    highlight: false,
    icon: <Lock size={18} />,
    tagline: 'Custom pricing for large platforms',
    features: [
      'Negotiated credit volume',
      'Unlimited active deals',
      'Full platform access',
      'Level 4 automation',
      'Dedicated infrastructure',
      'SLA guarantees',
      'White-label options',
      'Custom integrations',
      'Account management',
    ],
    limits: { deals: 'Unlimited', automation: 'Level 4', surfaces: 'All surfaces' },
  },
];

const FEATURE_TABLE: { label: string; values: Record<string, string | boolean> }[] = [
  { label: 'Monthly AI Credits', values: { scout: '100', operator: '500', principal: '2,000', institutional: 'Custom' } },
  { label: 'Active Deals', values: { scout: '5', operator: '25', principal: 'Unlimited', institutional: 'Unlimited' } },
  { label: 'AI Chat', values: { scout: true, operator: true, principal: true, institutional: true } },
  { label: 'Web Surface', values: { scout: false, operator: true, principal: true, institutional: true } },
  { label: 'API Access', values: { scout: false, operator: false, principal: true, institutional: true } },
  { label: 'Automation Level', values: { scout: 'Level 1', operator: 'Level 2', principal: 'Level 3', institutional: 'Level 4' } },
  { label: 'Document Analysis', values: { scout: false, operator: true, principal: true, institutional: true } },
  { label: 'Portfolio Analytics', values: { scout: false, operator: false, principal: true, institutional: true } },
  { label: 'Strategy Builder', values: { scout: false, operator: true, principal: true, institutional: true } },
  { label: 'Priority Processing', values: { scout: false, operator: false, principal: true, institutional: true } },
  { label: 'SLA Guarantee', values: { scout: false, operator: false, principal: false, institutional: true } },
];

export function PricingPage() {
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (tierId: 'scout' | 'operator' | 'principal' | 'institutional') => {
    if (tierId === 'institutional') {
      window.location.href = 'mailto:sales@jedire.com?subject=Institutional Plan Inquiry';
      return;
    }

    setLoadingTier(tierId);
    setError(null);

    try {
      const res = await apiClient.post('/api/v1/billing/create-checkout-session', {
        tier: tierId,
        billingCycle: 'monthly',
      });

      if (res.data.sessionUrl) {
        window.location.href = res.data.sessionUrl;
      } else {
        setError('Failed to create checkout session. Please try again.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to initiate checkout. Please try again.';
      setError(msg);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg.terminal, fontFamily: T.font.mono, color: T.text.primary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 48, background: T.bg.topBar, borderBottom: `1px solid ${T.border.subtle}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.text.amber, letterSpacing: 2 }}>JediRE</span>
          <span style={{ fontSize: 11, color: T.text.muted }}>|</span>
          <span style={{ fontSize: 11, color: T.text.secondary, letterSpacing: 1 }}>PRICING</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{ fontSize: 11, color: T.text.secondary, background: 'transparent', border: `1px solid ${T.border.medium}`, padding: '4px 14px', cursor: 'pointer', fontFamily: T.font.mono, letterSpacing: 0.5 }}
        >
          ← BACK
        </button>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: T.text.cyan, letterSpacing: 3, marginBottom: 12, fontWeight: 700 }}>SUBSCRIPTION PLANS</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text.primary, margin: '0 0 12px', letterSpacing: 1 }}>
            CHOOSE YOUR TIER
          </h1>
          <p style={{ fontSize: 12, color: T.text.secondary, margin: 0 }}>
            All plans billed monthly · Upgrade or downgrade at any time
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ marginBottom: 24, padding: '10px 16px', background: T.text.red + '11', border: `1px solid ${T.text.red}`, color: T.text.red, fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* Tier cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              style={{
                background: tier.highlight ? T.bg.panelAlt : T.bg.panel,
                border: `1px solid ${tier.highlight ? tier.color + '66' : T.border.subtle}`,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {tier.highlight && (
                <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: tier.color, color: T.bg.terminal, fontSize: 9, fontWeight: 700, padding: '2px 14px', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                  MOST POPULAR
                </div>
              )}

              <div style={{ padding: '28px 20px 20px' }}>
                {/* Tier header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: tier.color }}>
                  {tier.icon}
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{tier.label}</span>
                </div>

                <p style={{ fontSize: 11, color: T.text.muted, margin: '0 0 20px', lineHeight: 1.5 }}>{tier.tagline}</p>

                {/* Price */}
                <div style={{ marginBottom: 20 }}>
                  {tier.price !== null ? (
                    <>
                      <span style={{ fontSize: 32, fontWeight: 800, color: T.text.primary }}>${tier.price}</span>
                      <span style={{ fontSize: 11, color: T.text.muted }}>/mo</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 24, fontWeight: 700, color: tier.color }}>CUSTOM</span>
                  )}
                  {tier.credits !== null && (
                    <div style={{ fontSize: 10, color: tier.color, marginTop: 4, fontWeight: 600 }}>
                      {tier.credits.toLocaleString()} AI credits/month
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleUpgrade(tier.id)}
                  disabled={loadingTier !== null}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    background: tier.highlight ? tier.color : 'transparent',
                    color: tier.highlight ? T.bg.terminal : tier.color,
                    border: `1px solid ${tier.color}`,
                    cursor: loadingTier !== null ? 'not-allowed' : 'pointer',
                    opacity: loadingTier !== null && loadingTier !== tier.id ? 0.5 : 1,
                    fontFamily: T.font.mono,
                    marginBottom: 20,
                    animation: loadingTier === tier.id ? 'pulse 1s infinite' : 'none',
                  }}
                >
                  {loadingTier === tier.id
                    ? 'REDIRECTING...'
                    : tier.id === 'institutional'
                    ? 'CONTACT SALES'
                    : 'GET STARTED →'}
                </button>

                {/* Feature list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tier.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Check size={12} style={{ color: tier.color, flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 11, color: T.text.secondary, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limits footer */}
              <div style={{ marginTop: 'auto', padding: '12px 20px', borderTop: `1px solid ${T.border.subtle}`, background: T.bg.header }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {Object.entries(tier.limits).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: T.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: tier.color }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, marginBottom: 32 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border.subtle}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text.primary, letterSpacing: 1 }}>FEATURE COMPARISON</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, color: T.text.muted, fontWeight: 600, letterSpacing: 0.5 }}>FEATURE</th>
                  {TIERS.map(t => (
                    <th key={t.id} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: t.color, letterSpacing: 1 }}>
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_TABLE.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? 'transparent' : T.bg.panelAlt }}>
                    <td style={{ padding: '9px 20px', fontSize: 11, color: T.text.secondary }}>{row.label}</td>
                    {TIERS.map(t => {
                      const val = row.values[t.id];
                      return (
                        <td key={t.id} style={{ padding: '9px 16px', textAlign: 'center' }}>
                          {typeof val === 'boolean' ? (
                            val
                              ? <span style={{ color: T.text.green, fontSize: 14, fontWeight: 700 }}>✓</span>
                              : <span style={{ color: T.text.muted, fontSize: 12 }}>—</span>
                          ) : (
                            <span style={{ fontSize: 11, color: T.text.primary }}>{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: T.text.muted, margin: 0, lineHeight: 2 }}>
            All plans renew monthly · Cancel anytime from Subscription Settings<br />
            Credits reset each billing period · Unused credits do not roll over<br />
            <a href="mailto:sales@jedire.com" style={{ color: T.text.cyan, textDecoration: 'none' }}>Contact sales for institutional pricing →</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
