import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { inboxService, Email, EmailDetail, InboxStats } from '../services/inbox.service';

const T = {
  bg: {
    primary: "#0a0e17",
    secondary: "#111827",
    tertiary: "#1a2236",
    card: "#141c2e",
    hover: "#1e2a42",
    elevated: "#1a2540",
  },
  border: {
    subtle: "#1e293b",
    default: "#2a3a52",
    focus: "#3b82f6",
  },
  text: {
    primary: "#f1f5f9",
    secondary: "#94a3b8",
    tertiary: "#64748b",
    inverse: "#0f172a",
  },
  accent: {
    blue: "#3b82f6",
    green: "#10b981",
    amber: "#f59e0b",
    red: "#ef4444",
    purple: "#8b5cf6",
    cyan: "#06b6d4",
    emerald: "#34d399",
  },
  deal: {
    prospect: "#f59e0b",
    loi: "#3b82f6",
    dd: "#8b5cf6",
    closing: "#10b981",
    owned: "#06b6d4",
  },
};

const FONTS = {
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'IBM Plex Sans', -apple-system, sans-serif",
};

type ViewType = 'inbox' | 'flagged' | 'deals' | 'pst-imports' | 'unread';
type FilterType = 'all' | 'unread' | 'critical' | 'deal-linked' | 'attachments';
type SidePanelTab = 'actions' | 'deal' | 'team' | 'tasks';

interface ClassificationDef {
  label: string;
  color: string;
  icon: string;
}

const CLASSIFICATIONS: Record<string, ClassificationDef> = {
  "new-opportunity": { label: "New Opportunity", color: T.accent.green, icon: "\u25C6" },
  "deal-event": { label: "Deal Event", color: T.accent.blue, icon: "\u25CF" },
  "market-signal": { label: "Market Signal", color: T.accent.amber, icon: "\u25B2" },
  "system-alert": { label: "System Alert", color: T.accent.purple, icon: "\u2B21" },
  "correspondence": { label: "Correspondence", color: T.text.tertiary, icon: "\u25CB" },
  "pst-import": { label: "PST Import", color: T.accent.cyan, icon: "\u25A0" },
};

function classifyEmail(email: Email): string {
  if (email.source_provider === 'pst_import' || email.external_id?.startsWith('pst-')) {
    if (email.is_flagged || email.deal_id) return 'deal-event';
    const subj = (email.subject || '').toLowerCase();
    if (subj.includes('deal room') || subj.includes('offering memorandum') || subj.includes('investment sale'))
      return 'new-opportunity';
    if (subj.includes('due diligence') || subj.includes('access granted'))
      return 'market-signal';
    return 'pst-import';
  }
  if (email.deal_id) return 'deal-event';
  if (email.is_flagged) return 'new-opportunity';
  const subj = (email.subject || '').toLowerCase();
  if (subj.includes('jedi') || subj.includes('score') || subj.includes('alert'))
    return 'system-alert';
  return 'correspondence';
}

function extractSignals(email: Email): string[] {
  const signals: string[] = [];
  const subj = (email.subject || '').toLowerCase();
  if (subj.includes('off-market') || subj.includes('off market')) signals.push('off-market');
  if (subj.includes('price reduc')) signals.push('price-reduction');
  if (subj.includes('deal room')) signals.push('deal-room');
  if (subj.includes('term sheet')) signals.push('term-sheet');
  if (subj.includes('appraisal')) signals.push('appraisal');
  if (subj.includes('psa') || subj.includes('purchase')) signals.push('psa');
  if (subj.includes('zoning')) signals.push('zoning');
  if (subj.includes('offering')) signals.push('offering');
  if (subj.includes('due diligence')) signals.push('due-diligence');
  if (email.has_attachments) signals.push('has-docs');
  if (email.deal_id) signals.push('deal-linked');
  return signals.slice(0, 3);
}

function getInitials(name: string): string {
  if (!name) return '??';
  return name.split(/\s+/).map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2);
}

function extractCompany(fromAddress: string): string {
  if (!fromAddress) return '';
  const domain = fromAddress.split('@')[1] || '';
  const parts = domain.split('.');
  if (parts.length >= 2) {
    const name = parts[parts.length - 2];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return domain;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function SignalTag({ signal }: { signal: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px",
      background: `${T.accent.cyan}12`, border: `1px solid ${T.accent.cyan}25`,
      borderRadius: 3, color: T.accent.cyan, fontSize: 10,
      fontFamily: FONTS.mono, letterSpacing: 0.3,
    }}>
      {signal}
    </span>
  );
}

function DealStageIndicator({ stage, name }: { stage: string; name: string }) {
  const stageColors: Record<string, string> = {
    prospect: T.deal.prospect, loi: T.deal.loi, dd: T.deal.dd,
    closing: T.deal.closing, owned: T.deal.owned,
  };
  const stageLabels: Record<string, string> = {
    prospect: "Prospect", loi: "LOI", dd: "Due Diligence",
    closing: "Closing", owned: "Owned",
  };
  const c = stageColors[stage] || T.text.tertiary;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "3px 10px",
      background: `${c}12`, border: `1px solid ${c}30`, borderRadius: 4,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
      <span style={{ fontSize: 11, color: T.text.primary, fontFamily: FONTS.sans }}>{name}</span>
      <span style={{ fontSize: 9, color: T.text.tertiary, fontFamily: FONTS.mono }}>
        {stageLabels[stage] || stage}
      </span>
    </div>
  );
}

export function EmailPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<EmailDetail | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('inbox');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sidePanel, setSidePanel] = useState<SidePanelTab>('actions');
  const [searchQuery, setSearchQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
      if (e.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      setLoading(true);
      const filters: any = { limit: 100 };
      if (activeView === 'flagged') filters.flagged_only = true;
      if (activeView === 'pst-imports') filters.source = 'pst';
      if (activeView === 'unread') filters.unread_only = true;
      if (activeView === 'deals') filters.deal_linked = true;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const [emailsRes, statsRes] = await Promise.all([
        inboxService.getEmails(filters),
        inboxService.getStats(),
      ]);
      if (emailsRes.success) setEmails(emailsRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading inbox:', error);
    } finally {
      setLoading(false);
    }
  }, [activeView, searchQuery]);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  const handleEmailClick = async (email: Email) => {
    setSelectedEmailId(email.id);
    if (!email.is_read) {
      try {
        await inboxService.updateEmail(email.id, { is_read: true });
        setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: true } : e));
      } catch {}
    }
    try {
      const res = await inboxService.getEmail(email.id);
      if (res.success) setSelectedDetail(res.data);
    } catch {}
  };

  const handleToggleFlag = async (emailId: number, currentFlag: boolean) => {
    try {
      await inboxService.updateEmail(emailId, { is_flagged: !currentFlag });
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_flagged: !currentFlag } : e));
    } catch {}
  };

  const filteredEmails = useMemo(() => {
    let result = emails;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        (e.subject || '').toLowerCase().includes(q) ||
        (e.from_name || '').toLowerCase().includes(q) ||
        (e.from_address || '').toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'unread') result = result.filter(e => !e.is_read);
    if (activeFilter === 'deal-linked') result = result.filter(e => e.deal_id);
    if (activeFilter === 'attachments') result = result.filter(e => e.has_attachments);
    if (activeFilter === 'critical') result = result.filter(e => e.is_flagged || e.deal_id);
    return result;
  }, [emails, searchQuery, activeFilter]);

  const selectedEmail = useMemo(() =>
    emails.find(e => e.id === selectedEmailId) || null
  , [emails, selectedEmailId]);

  const views: { id: ViewType; label: string; count: number | null }[] = [
    { id: 'inbox', label: 'Inbox', count: stats?.unread ?? null },
    { id: 'flagged', label: 'Flagged', count: stats?.flagged ?? null },
    { id: 'deals', label: 'Deal-Linked', count: stats?.deal_related ?? null },
    { id: 'pst-imports', label: 'PST Imports', count: stats?.pst_imports ?? null },
    { id: 'unread', label: 'Unread', count: stats?.unread ?? null },
  ];

  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: emails.length },
    { id: 'unread', label: 'Unread', count: emails.filter(e => !e.is_read).length },
    { id: 'critical', label: 'Action Required', count: emails.filter(e => e.is_flagged || e.deal_id).length },
    { id: 'deal-linked', label: 'Deal-Linked', count: emails.filter(e => e.deal_id).length },
    { id: 'attachments', label: 'Attachments', count: emails.filter(e => e.has_attachments).length },
  ];

  const summaryStats = useMemo(() => {
    const pstCount = emails.filter(e => e.external_id?.startsWith('pst-')).length;
    const dealLinked = emails.filter(e => e.deal_id).length;
    const withDocs = emails.filter(e => e.has_attachments).length;
    const unread = emails.filter(e => !e.is_read).length;
    return [
      { label: "Total Emails", value: String(stats?.total ?? emails.length), color: T.accent.blue },
      { label: "Unread", value: String(unread), color: T.accent.amber },
      { label: "Deal-Linked", value: String(dealLinked), color: T.accent.green },
      { label: "PST Imported", value: String(pstCount), color: T.accent.cyan },
      { label: "With Attachments", value: String(withDocs), color: T.accent.purple },
    ];
  }, [emails, stats]);

  return (
    <div style={{
      width: "100%", height: "100vh", background: T.bg.primary,
      color: T.text.primary, fontFamily: FONTS.sans,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>

      {commandOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 100, display: "flex", justifyContent: "center", paddingTop: 120,
        }} onClick={() => setCommandOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 560, background: T.bg.secondary, border: `1px solid ${T.border.default}`,
            borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", maxHeight: 400,
          }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${T.border.subtle}`, gap: 10 }}>
              <span style={{ color: T.text.tertiary, fontSize: 14 }}>{"\u2318"}</span>
              <input ref={commandInputRef} autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setCommandOpen(false); }}
                placeholder="Search emails, deals, contacts, or type a command..."
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.text.primary, fontSize: 14, fontFamily: FONTS.sans }}
              />
              <kbd style={{ fontSize: 10, color: T.text.tertiary, fontFamily: FONTS.mono, padding: "2px 6px", background: T.bg.tertiary, borderRadius: 3, border: `1px solid ${T.border.subtle}` }}>ESC</kbd>
            </div>
            <div style={{ padding: 8 }}>
              {["Link email to deal...", "Create task from email...", "Draft response with AI...", "Extract attachment data...", "Find all emails from contact..."].map((cmd, i) => (
                <div key={i} style={{
                  padding: "10px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13,
                  color: T.text.secondary, display: "flex", alignItems: "center", gap: 10,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.bg.hover; e.currentTarget.style.color = T.text.primary; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.text.secondary; }}
                >
                  <span style={{ fontSize: 11, fontFamily: FONTS.mono, color: T.accent.blue }}>{"\u25B8"}</span>
                  {cmd}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 52, borderBottom: `1px solid ${T.border.subtle}`,
        background: T.bg.secondary, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700, color: T.accent.blue, letterSpacing: 1 }}>COMMS</span>
          <div style={{ width: 1, height: 20, background: T.border.subtle }} />
          {views.map(v => (
            <button key={v.id} onClick={() => { setActiveView(v.id); setActiveFilter('all'); }} style={{
              background: activeView === v.id ? `${T.accent.blue}15` : "transparent",
              border: activeView === v.id ? `1px solid ${T.accent.blue}40` : "1px solid transparent",
              borderRadius: 6, padding: "5px 12px",
              color: activeView === v.id ? T.accent.blue : T.text.secondary,
              fontSize: 12, fontFamily: FONTS.sans, fontWeight: 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}>
              {v.label}
              {v.count !== null && (
                <span style={{
                  fontSize: 10, fontFamily: FONTS.mono,
                  background: activeView === v.id ? T.accent.blue : T.bg.tertiary,
                  color: activeView === v.id ? "#fff" : T.text.tertiary,
                  padding: "1px 5px", borderRadius: 8, minWidth: 16, textAlign: "center" as const,
                }}>{v.count}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
            background: `${T.accent.green}10`, border: `1px solid ${T.accent.green}30`,
            borderRadius: 6, cursor: "pointer",
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent.green, animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontFamily: FONTS.mono, color: T.accent.green }}>
              {stats?.total ?? 0} EMAILS
            </span>
          </div>

          <div onClick={() => setCommandOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
            background: T.bg.tertiary, border: `1px solid ${searchQuery ? T.accent.blue : T.border.subtle}`,
            borderRadius: 6, cursor: "pointer", minWidth: 200,
          }}>
            <span style={{ color: searchQuery ? T.text.primary : T.text.tertiary, fontSize: 12 }}>
              {searchQuery || 'Search or command...'}
            </span>
            {searchQuery && (
              <span onClick={e => { e.stopPropagation(); setSearchQuery(''); }} style={{ color: T.text.tertiary, fontSize: 12, cursor: "pointer" }}>{"\u2715"}</span>
            )}
            <kbd style={{ fontSize: 10, color: T.text.tertiary, fontFamily: FONTS.mono, marginLeft: "auto", padding: "1px 5px", background: T.bg.primary, borderRadius: 3, border: `1px solid ${T.border.subtle}` }}>{"\u2318"}K</kbd>
          </div>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 16, padding: "8px 20px",
        borderBottom: `1px solid ${T.border.subtle}`, background: `${T.accent.blue}05`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, textTransform: "uppercase" as const, letterSpacing: 1 }}>Summary</span>
        <div style={{ display: "flex", gap: 12, flex: 1, overflowX: "auto" as const }}>
          {summaryStats.map((stat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16, fontFamily: FONTS.mono, fontWeight: 700, color: stat.color }}>{stat.value}</span>
              <span style={{ fontSize: 10, color: T.text.tertiary, fontFamily: FONTS.sans, whiteSpace: "nowrap" as const }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{
          width: 420, borderRight: `1px solid ${T.border.subtle}`,
          display: "flex", flexDirection: "column" as const, flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: `1px solid ${T.border.subtle}`, overflowX: "auto" as const, flexShrink: 0 }}>
            {filters.map(f => (
              <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
                background: activeFilter === f.id ? T.bg.tertiary : "transparent",
                border: `1px solid ${activeFilter === f.id ? T.border.default : "transparent"}`,
                borderRadius: 5, padding: "4px 10px",
                color: activeFilter === f.id ? T.text.primary : T.text.tertiary,
                fontSize: 11, fontFamily: FONTS.sans, cursor: "pointer",
                whiteSpace: "nowrap" as const, display: "flex", alignItems: "center", gap: 4,
                transition: "all 0.12s",
              }}>
                {f.label}
                <span style={{ fontSize: 10, fontFamily: FONTS.mono, opacity: 0.6 }}>{f.count}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" as const }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center" as const, color: T.text.tertiary, fontSize: 13 }}>Loading emails...</div>
            ) : filteredEmails.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" as const, color: T.text.tertiary }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{"\uD83D\uDCE7"}</div>
                <div style={{ fontSize: 13 }}>{searchQuery ? 'No emails match your search' : 'No emails in this view'}</div>
              </div>
            ) : filteredEmails.map(email => {
              const cls = CLASSIFICATIONS[classifyEmail(email)];
              const isSelected = selectedEmailId === email.id;
              const signals = extractSignals(email);
              return (
                <div key={email.id} onClick={() => handleEmailClick(email)} style={{
                  padding: "12px 16px", borderBottom: `1px solid ${T.border.subtle}`,
                  background: isSelected ? `${T.accent.blue}10` : "transparent",
                  borderLeft: `3px solid ${isSelected ? T.accent.blue : "transparent"}`,
                  cursor: "pointer", transition: "all 0.12s",
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = T.bg.hover; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${T.accent.blue}10` : "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: cls.color, fontSize: 9, fontFamily: FONTS.mono }}>{cls.icon}</span>
                    <span style={{ color: cls.color, fontSize: 9, fontFamily: FONTS.mono, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                      {cls.label}
                    </span>
                    {email.is_flagged && (
                      <span style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.accent.amber, background: `${T.accent.amber}15`, padding: "1px 5px", borderRadius: 3 }}>
                        FLAGGED
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: 10, color: T.text.tertiary, fontFamily: FONTS.mono }}>
                      {formatDate(email.received_at)}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: classifyEmail(email) === 'system-alert' ? `${T.accent.purple}20` : T.bg.tertiary,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontFamily: FONTS.mono,
                      color: classifyEmail(email) === 'system-alert' ? T.accent.purple : T.text.secondary,
                      fontWeight: 600, flexShrink: 0,
                    }}>
                      {getInitials(email.from_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: email.is_read ? 400 : 600, color: T.text.primary }}>
                          {email.from_name || email.from_address}
                        </span>
                        {!email.is_read && (
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent.blue, flexShrink: 0 }} />
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: T.text.tertiary }}>
                        {extractCompany(email.from_address)}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: email.is_read ? T.text.secondary : T.text.primary, fontWeight: email.is_read ? 400 : 500, marginBottom: 6, lineHeight: 1.3 }}>
                    {email.subject || '(No subject)'}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                    {email.deal_name && (
                      <DealStageIndicator stage="prospect" name={email.deal_name} />
                    )}
                    {email.has_attachments && (
                      <span style={{ fontSize: 10, color: T.text.tertiary, fontFamily: FONTS.mono }}>
                        {"\uD83D\uDCCE"} {email.attachment_count || 1}
                      </span>
                    )}
                    {signals.length > 0 && (
                      <span style={{
                        fontSize: 9, fontFamily: FONTS.mono, color: T.accent.cyan,
                        background: `${T.accent.cyan}12`, padding: "2px 6px", borderRadius: 3, marginLeft: "auto",
                      }}>
                        {signals[0]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
          {selectedEmail && selectedDetail ? (
            <>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" as const }}>
                      {(() => {
                        const cls = CLASSIFICATIONS[classifyEmail(selectedEmail)];
                        return (
                          <span style={{ color: cls.color, fontSize: 10, fontFamily: FONTS.mono }}>
                            {cls.icon} {cls.label.toUpperCase()}
                          </span>
                        );
                      })()}
                      {extractSignals(selectedEmail).map((s, i) => <SignalTag key={i} signal={s} />)}
                    </div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: T.text.primary, lineHeight: 1.3 }}>
                      {selectedEmail.subject || '(No subject)'}
                    </h2>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleToggleFlag(selectedEmail.id, selectedEmail.is_flagged)} style={{
                      background: selectedEmail.is_flagged ? `${T.accent.amber}20` : T.bg.tertiary,
                      border: `1px solid ${selectedEmail.is_flagged ? T.accent.amber + '40' : T.border.subtle}`,
                      borderRadius: 6, padding: "6px 12px",
                      color: selectedEmail.is_flagged ? T.accent.amber : T.text.secondary,
                      fontSize: 11, fontFamily: FONTS.sans, cursor: "pointer",
                    }}>
                      {selectedEmail.is_flagged ? '\u2605 Flagged' : '\u2606 Flag'}
                    </button>
                    <button style={{
                      background: `${T.accent.blue}15`, border: `1px solid ${T.accent.blue}40`,
                      borderRadius: 6, padding: "6px 12px", color: T.accent.blue,
                      fontSize: 11, fontFamily: FONTS.sans, cursor: "pointer",
                    }}>AI Draft</button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: classifyEmail(selectedEmail) === 'system-alert' ? `${T.accent.purple}20` : T.bg.tertiary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontFamily: FONTS.mono,
                    color: classifyEmail(selectedEmail) === 'system-alert' ? T.accent.purple : T.text.secondary,
                    fontWeight: 600,
                  }}>
                    {getInitials(selectedEmail.from_name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text.primary }}>
                      {selectedEmail.from_name || selectedEmail.from_address}
                      <span style={{ fontWeight: 400, color: T.text.tertiary, marginLeft: 8, fontSize: 11 }}>
                        {extractCompany(selectedEmail.from_address)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: T.text.tertiary }}>{formatFullDate(selectedEmail.received_at)}</div>
                  </div>
                  {selectedEmail.deal_name && (
                    <DealStageIndicator stage="prospect" name={selectedEmail.deal_name} />
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto" as const, padding: "20px 24px" }}>
                {selectedEmail.to_addresses && selectedEmail.to_addresses.length > 0 && (
                  <div style={{ marginBottom: 16, fontSize: 11, color: T.text.tertiary }}>
                    <span style={{ fontFamily: FONTS.mono, marginRight: 8 }}>TO:</span>
                    {selectedEmail.to_addresses.join(', ')}
                  </div>
                )}

                <div style={{ fontSize: 13, color: T.text.secondary, lineHeight: 1.7, maxWidth: 700, whiteSpace: "pre-wrap" as const, marginBottom: 24 }}>
                  {selectedDetail.body_text || selectedDetail.body_preview || selectedEmail.body_preview || 'No content available.'}
                </div>

                {selectedDetail.attachments && selectedDetail.attachments.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>
                      Attachments ({selectedDetail.attachments.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                      {selectedDetail.attachments.map((a, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                          background: `${T.accent.blue}10`, border: `1px solid ${T.accent.blue}30`, borderRadius: 6,
                        }}>
                          <span style={{ fontSize: 13 }}>{"\uD83D\uDCCE"}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: T.text.primary, fontFamily: FONTS.sans }}>{a.filename}</div>
                            <div style={{ fontSize: 10, color: T.text.tertiary, fontFamily: FONTS.mono }}>
                              {a.size_bytes ? `${(a.size_bytes / 1024).toFixed(0)} KB` : ''}
                            </div>
                          </div>
                          <button style={{
                            background: `${T.accent.blue}20`, border: `1px solid ${T.accent.blue}40`,
                            borderRadius: 3, color: T.accent.blue, fontSize: 9, fontFamily: FONTS.mono,
                            padding: "2px 8px", cursor: "pointer", letterSpacing: 0.5,
                          }}>EXTRACT</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEmail.external_id?.startsWith('pst-') && (
                  <div style={{
                    padding: 16, background: T.bg.card, border: `1px solid ${T.border.subtle}`, borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent.cyan }} />
                      <span style={{ fontSize: 11, fontFamily: FONTS.mono, color: T.text.primary, letterSpacing: 0.5 }}>
                        PST IMPORT SOURCE
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: T.text.tertiary }}>
                      This email was imported from a PST archive file. AI extraction may have identified real estate signals, contacts, and deal data from this communication.
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : selectedEmail ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: T.text.tertiary, fontSize: 13 }}>Loading email...</span>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" as const }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>{"\uD83D\uDCE8"}</div>
                <span style={{ color: T.text.tertiary, fontSize: 13 }}>Select an email to view</span>
              </div>
            </div>
          )}
        </div>

        <div style={{
          width: 300, borderLeft: `1px solid ${T.border.subtle}`,
          display: "flex", flexDirection: "column" as const, flexShrink: 0, background: T.bg.secondary,
        }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
            {([
              { id: 'actions' as SidePanelTab, label: 'Actions' },
              { id: 'deal' as SidePanelTab, label: 'Deal' },
              { id: 'team' as SidePanelTab, label: 'Team' },
              { id: 'tasks' as SidePanelTab, label: 'Tasks' },
            ]).map(tab => (
              <button key={tab.id} onClick={() => setSidePanel(tab.id)} style={{
                flex: 1, padding: "10px 0", background: "transparent", border: "none",
                borderBottom: `2px solid ${sidePanel === tab.id ? T.accent.blue : "transparent"}`,
                color: sidePanel === tab.id ? T.accent.blue : T.text.tertiary,
                fontSize: 11, fontFamily: FONTS.sans, fontWeight: 500, cursor: "pointer",
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" as const, padding: 16 }}>
            {sidePanel === 'actions' && (
              <div>
                <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" as const }}>
                  Quick Actions
                </div>
                {[
                  { label: "Link to Deal", icon: "\uD83D\uDD17", desc: "Associate this thread with a deal" },
                  { label: "Create Task", icon: "\u2713", desc: "Generate task from this email" },
                  { label: "Extract Data", icon: "\uD83D\uDCCA", desc: "Pull data from attachments" },
                  { label: "AI Summary", icon: "\u2728", desc: "Summarize thread with context" },
                  { label: "Draft Response", icon: "\u270D\uFE0F", desc: "AI-composed reply" },
                  { label: "Set Follow-up", icon: "\u23F0", desc: "Schedule reminder" },
                  { label: "Add to Deal Bible", icon: "\uD83D\uDCD8", desc: "Save to deal document repository" },
                  { label: "Log Activity", icon: "\uD83D\uDCDD", desc: "Record interaction in deal timeline" },
                ].map((action, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderRadius: 6, cursor: "pointer", marginBottom: 2, transition: "background 0.12s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.bg.hover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 14 }}>{action.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, color: T.text.primary, fontWeight: 500 }}>{action.label}</div>
                      <div style={{ fontSize: 10, color: T.text.tertiary }}>{action.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidePanel === 'deal' && selectedEmail?.deal_name && (
              <div>
                <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" as const }}>
                  Linked Deal
                </div>
                <div style={{ padding: 12, background: T.bg.card, borderRadius: 8, border: `1px solid ${T.border.subtle}`, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text.primary, marginBottom: 4 }}>{selectedEmail.deal_name}</div>
                  <DealStageIndicator stage="prospect" name={selectedEmail.deal_name} />
                </div>
                <button style={{
                  width: "100%", marginTop: 12, padding: "8px",
                  background: `${T.accent.blue}10`, border: `1px solid ${T.accent.blue}30`,
                  borderRadius: 6, color: T.accent.blue, fontSize: 11,
                  fontFamily: FONTS.sans, fontWeight: 500, cursor: "pointer",
                }}>Open Deal Capsule {"\u2192"}</button>
              </div>
            )}

            {sidePanel === 'deal' && (!selectedEmail || !selectedEmail.deal_name) && (
              <div style={{ textAlign: "center" as const, padding: "40px 20px" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{"\uD83D\uDD17"}</div>
                <div style={{ fontSize: 12, color: T.text.secondary, marginBottom: 12 }}>No deal linked</div>
                <button style={{
                  padding: "8px 16px", background: T.accent.blue, border: "none",
                  borderRadius: 6, color: "#fff", fontSize: 11, fontFamily: FONTS.sans, cursor: "pointer",
                }}>Link to Deal</button>
                <div style={{ fontSize: 10, color: T.text.tertiary, marginTop: 8 }}>or let the agent auto-detect</div>
              </div>
            )}

            {sidePanel === 'team' && (
              <div>
                <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" as const }}>
                  Participants
                </div>
                {selectedEmail ? (
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      background: T.bg.card, border: `1px solid ${T.border.subtle}`, borderRadius: 6, marginBottom: 6,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 6, background: `${T.accent.blue}15`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontFamily: FONTS.mono, color: T.accent.blue,
                      }}>
                        {getInitials(selectedEmail.from_name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.text.tertiary, textTransform: "uppercase" as const }}>Sender</span>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent.green }} />
                        </div>
                        <div style={{ fontSize: 12, color: T.text.primary, fontWeight: 500 }}>{selectedEmail.from_name || 'Unknown'}</div>
                        <div style={{ fontSize: 10, color: T.text.tertiary }}>{selectedEmail.from_address}</div>
                      </div>
                    </div>
                    {selectedEmail.to_addresses?.map((addr, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        background: T.bg.card, border: `1px solid ${T.border.subtle}`, borderRadius: 6, marginBottom: 6,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 6, background: T.bg.tertiary,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontFamily: FONTS.mono, color: T.text.secondary,
                        }}>
                          {addr.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.text.tertiary, textTransform: "uppercase" as const }}>Recipient</span>
                          <div style={{ fontSize: 11, color: T.text.primary }}>{addr}</div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ textAlign: "center" as const, padding: "40px 20px", color: T.text.tertiary, fontSize: 12 }}>
                    Select an email to see participants
                  </div>
                )}
              </div>
            )}

            {sidePanel === 'tasks' && (
              <div>
                <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" as const }}>
                  Active Tasks
                </div>
                <div style={{ textAlign: "center" as const, padding: "20px", color: T.text.tertiary, fontSize: 12 }}>
                  No tasks yet. Create tasks from email actions.
                </div>
                <button style={{
                  width: "100%", marginTop: 8, padding: "8px",
                  background: `${T.accent.blue}10`, border: `1px solid ${T.accent.blue}30`,
                  borderRadius: 6, color: T.accent.blue, fontSize: 11,
                  fontFamily: FONTS.sans, cursor: "pointer",
                }}>+ Create Task</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default EmailPage;
