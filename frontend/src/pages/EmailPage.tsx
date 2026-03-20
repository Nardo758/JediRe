import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { inboxService, Email, EmailDetail, InboxStats, InboxFilters, ConnectedAccount, EmailIntel } from '../services/inbox.service';

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

type ViewType = 'inbox' | 'deals' | 'tasks' | 'network';
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
  const isPst = email.source_provider === 'pst_import' || email.external_id?.startsWith('pst-');
  if (isPst) {
    if (email.has_signal) return 'deal-event';
    const subj = (email.subject || '').toLowerCase();
    if (subj.includes('alert') || subj.includes('notification') || subj.includes('system'))
      return 'system-alert';
    return 'correspondence';
  }
  if (email.has_signal || email.deal_id) return 'deal-event';
  if (email.is_flagged) return 'deal-event';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [connectNotice, setConnectNotice] = useState<string | null>(null);
  const [accountsPanelOpen, setAccountsPanelOpen] = useState(true);
  const [emailIntel, setEmailIntel] = useState<EmailIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [dealLinkOpen, setDealLinkOpen] = useState(false);
  const [dealsList, setDealsList] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealDetails, setDealDetails] = useState<any | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamActivity, setTeamActivity] = useState<any[]>([]);
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const [propPanelOpen, setPropPanelOpen] = useState(true);
  const [newsPanelOpen, setNewsPanelOpen] = useState(true);
  const [composeMode, setComposeMode] = useState<null | 'reply' | 'reply-all' | 'forward'>(null);
  const [replyTo, setReplyTo] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyCc, setReplyCc] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replySent, setReplySent] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    inboxService.getConnectedAccounts().then(res => {
      if (res.success) setConnectedAccounts(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      const providerLabel = connected === 'gmail' ? 'Gmail' : 'Outlook';
      const accountId = searchParams.get('accountId');
      setConnectNotice(`${providerLabel} account connected successfully. Syncing...`);
      searchParams.delete('connected');
      searchParams.delete('accountId');
      setSearchParams(searchParams, { replace: true });
      inboxService.getConnectedAccounts().then(async (res) => {
        if (res.success) {
          setConnectedAccounts(res.data);
          const targetAccount = accountId
            ? res.data.find(a => a.id === accountId)
            : res.data.find(a =>
                (connected === 'gmail' && a.provider === 'google') ||
                (connected === 'microsoft' && a.provider === 'microsoft')
              );
          if (targetAccount) {
            try {
              await inboxService.syncAccount(targetAccount.id);
              setConnectNotice(`${providerLabel} connected and synced`);
              loadInbox();
              const refreshed = await inboxService.getConnectedAccounts();
              if (refreshed.success) setConnectedAccounts(refreshed.data);
            } catch {
              setConnectNotice(`${providerLabel} connected (sync will run in background)`);
            }
          } else {
            setConnectNotice(`${providerLabel} account connected successfully`);
          }
        }
      }).catch(() => {});
      setTimeout(() => setConnectNotice(null), 6000);
    }
    if (error) {
      const detail = searchParams.get('detail') || 'Unknown error';
      setConnectNotice(`Connection failed: ${detail}`);
      searchParams.delete('error');
      searchParams.delete('detail');
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => setConnectNotice(null), 6000);
    }
  }, []);

  const handleConnectGmail = async () => {
    try {
      const res = await inboxService.getGmailAuthUrl();
      if (res.authUrl) window.location.href = res.authUrl;
    } catch (e) {
      setConnectNotice('Failed to start Gmail connection');
      setTimeout(() => setConnectNotice(null), 4000);
    }
  };

  const handleConnectMicrosoft = async () => {
    try {
      const res = await inboxService.getMicrosoftAuthUrl();
      if (res.authUrl) window.location.href = res.authUrl;
    } catch (e) {
      setConnectNotice('Failed to start Outlook connection');
      setTimeout(() => setConnectNotice(null), 4000);
    }
  };

  const handleSyncAccount = async (accountId: string) => {
    setSyncingAccountId(accountId);
    try {
      await inboxService.syncAccount(accountId);
      const res = await inboxService.getConnectedAccounts();
      if (res.success) setConnectedAccounts(res.data);
      loadInbox();
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setSyncingAccountId(null);
    }
  };

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

      const statsRes = await inboxService.getStats();
      if (statsRes.success) setStats(statsRes.data);

      if (activeView === 'network') {
        setEmails([]);
      } else {
        const filters: InboxFilters = { limit: 100 };
        if (activeView === 'deals') filters.deal_linked = true;
        if (searchQuery.trim()) filters.search = searchQuery.trim();
        const emailsRes = await inboxService.getEmails(filters);
        if (emailsRes.success) setEmails(emailsRes.data);
      }
    } catch (error) {
      console.error('Error loading inbox:', error);
    } finally {
      setLoading(false);
    }
  }, [activeView, searchQuery]);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  const openCompose = (mode: 'reply' | 'reply-all' | 'forward') => {
    if (!selectedEmail) return;
    setComposeMode(mode);
    setReplySent(null);
    setReplyError(null);
    setReplyBody('');

    if (mode === 'reply') {
      setReplyTo(selectedEmail.from_address);
      setReplyCc('');
    } else if (mode === 'reply-all') {
      setReplyTo(selectedEmail.from_address);
      const others = [
        ...(selectedEmail.to_addresses || []),
        ...(selectedEmail.cc_addresses || []),
      ].filter(a => a !== selectedEmail.from_address);
      setReplyCc(others.join(', '));
    } else {
      setReplyTo('');
      setReplyCc('');
      const original = selectedDetail?.body_text || selectedDetail?.body_preview || selectedEmail.body_preview || '';
      const from = selectedEmail.from_name || selectedEmail.from_address;
      setReplyBody(`\n\n---------- Forwarded message ----------\nFrom: ${from}\nDate: ${new Date(selectedEmail.received_at).toLocaleString()}\nSubject: ${selectedEmail.subject || '(no subject)'}\n\n${original}`);
    }
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replyBody.trim()) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const toList = replyTo.split(',').map(s => s.trim()).filter(Boolean);
      const subjectOverride = composeMode === 'forward'
        ? (selectedEmail.subject?.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject || ''}`)
        : undefined;
      const res = await inboxService.replyToEmail(selectedEmail.id, replyBody, replyCc || undefined, toList.length ? toList : undefined, subjectOverride);
      if (res.success) {
        setReplySent(toList[0] || selectedEmail.from_address);
        setReplyBody('');
        setReplyCc('');
        setReplyTo('');
        setComposeMode(null);
      } else {
        setReplyError(res.message || 'Failed to save message');
      }
    } catch (err: any) {
      setReplyError(err?.response?.data?.message || err?.message || 'Failed to save message');
    }
    setReplySending(false);
  };

  const handleEmailClick = async (email: Email) => {
    setSelectedEmailId(email.id);
    setEmailIntel(null);
    setDealDetails(null);
    setTeamMembers([]);
    setTeamActivity([]);
    setDismissedActions(new Set());
    setComposeMode(null);
    setReplyTo('');
    setReplyBody('');
    setReplyCc('');
    setReplySent(null);
    setReplyError(null);
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
    setIntelLoading(true);
    try {
      const intelRes = await inboxService.getEmailIntel(email.id);
      if (intelRes.success) setEmailIntel(intelRes.data);
    } catch {}
    setIntelLoading(false);
    if (email.deal_id) {
      try {
        const dealRes = await inboxService.getDealDetails(email.deal_id);
        if (dealRes.success) setDealDetails(dealRes.data);
      } catch {}
      try {
        const members = await inboxService.getDealTeamMembers(email.deal_id);
        if (Array.isArray(members)) setTeamMembers(members);
      } catch {}
      try {
        const activity = await inboxService.getDealTeamActivity(email.deal_id);
        if (Array.isArray(activity)) setTeamActivity(activity.slice(0, 5));
      } catch {}
    }
  };

  const handleLinkToDeal = async () => {
    if (!dealsLoading && dealsList.length === 0) {
      setDealsLoading(true);
      try {
        const res = await inboxService.getDeals();
        if (res.success) setDealsList(res.data || []);
      } catch {}
      setDealsLoading(false);
    }
    setDealLinkOpen(true);
  };

  const handleSelectDeal = async (dealId: string) => {
    if (!selectedEmailId) return;
    try {
      await inboxService.linkEmailToDeal(selectedEmailId, dealId);
      setEmails(prev => prev.map(e => e.id === selectedEmailId ? { ...e, deal_id: dealId } : e));
      setDealLinkOpen(false);
      loadInbox();
    } catch {}
  };

  const handleExecuteAction = async (actionItem?: { suggestedTask: string; priority: string; text?: string }) => {
    if (!selectedEmail || !selectedDetail) return;
    const emailBody = selectedDetail.body_text || selectedDetail.body_preview || '';
    try {
      await inboxService.quickTaskFromEmail(
        selectedEmail.id,
        emailBody,
        selectedEmail.deal_id || undefined,
        actionItem?.suggestedTask,
        actionItem?.priority
      );
      if (actionItem?.text) {
        setDismissedActions(prev => new Set([...prev, actionItem.text!]));
      }
      setIntelLoading(true);
      const intelRes = await inboxService.getEmailIntel(selectedEmail.id);
      if (intelRes.success) setEmailIntel(intelRes.data);
      setIntelLoading(false);
    } catch {}
  };

  const handleDismissAction = (actionText: string) => {
    setDismissedActions(prev => new Set([...prev, actionText]));
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

  const views: { id: ViewType; label: string; count: number | null; disabled?: boolean }[] = [
    { id: 'inbox', label: 'Inbox', count: stats?.unread ?? null },
    { id: 'deals', label: 'By Deal', count: stats?.deal_related ?? null },
    { id: 'tasks', label: 'Tasks', count: null },
    { id: 'network', label: 'Network', count: null, disabled: true },
  ];

  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: emails.length },
    { id: 'unread', label: 'Unread', count: emails.filter(e => !e.is_read).length },
    { id: 'critical', label: 'Action Required', count: emails.filter(e => e.is_flagged || e.deal_id).length },
    { id: 'deal-linked', label: 'Deal-Linked', count: emails.filter(e => e.deal_id).length },
    { id: 'attachments', label: 'Attachments', count: emails.filter(e => e.has_attachments).length },
  ];

  const agentActionCount = useMemo(() => {
    return emails.filter(e => e.has_signal || e.is_flagged || e.deal_id).length;
  }, [emails]);

  const readyActionsCount = useMemo(() => {
    return emails.filter(e => e.is_flagged || e.has_signal).length;
  }, [emails]);

  const summaryStats = useMemo(() => {
    const newOpps = emails.filter(e => classifyEmail(e) === 'new-opportunity').length;
    const dealEvents = emails.filter(e => classifyEmail(e) === 'deal-event').length;
    const deadlines = emails.filter(e => e.is_flagged).length;
    const withDocs = emails.filter(e => e.has_attachments).length;
    const tasksCreated = emails.filter(e => e.deal_id).length;
    return [
      { label: "New Opportunities", value: String(newOpps), color: T.accent.green },
      { label: "Deal Events", value: String(dealEvents), color: T.accent.blue },
      { label: "Deadlines This Week", value: String(deadlines), color: T.accent.red },
      { label: "Docs to Extract", value: String(withDocs), color: T.accent.purple },
      { label: "Tasks Created", value: String(tasksCreated), color: T.accent.amber },
    ];
  }, [emails]);

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
            <button key={v.id}
              onClick={() => { if (!v.disabled) { setActiveView(v.id); setActiveFilter('all'); } }}
              style={{
                background: activeView === v.id ? `${T.accent.blue}15` : "transparent",
                border: activeView === v.id ? `1px solid ${T.accent.blue}40` : "1px solid transparent",
                borderRadius: 6, padding: "5px 12px",
                color: v.disabled ? T.text.tertiary : activeView === v.id ? T.accent.blue : T.text.secondary,
                fontSize: 12, fontFamily: FONTS.sans, fontWeight: 500,
                cursor: v.disabled ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                opacity: v.disabled ? 0.5 : 1,
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
              {agentActionCount} AGENT ACTIONS
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

          <button
            onClick={() => navigate('/settings/email')}
            style={{
              background: "transparent", border: `1px solid ${T.border.subtle}`,
              borderRadius: 6, color: T.text.secondary,
              fontSize: 11, fontFamily: FONTS.sans, fontWeight: 500,
              padding: "6px 12px", cursor: "pointer",
            }}>
            Accounts
          </button>
          <button
            onClick={() => { setComposeMode('reply'); setReplyTo(''); setReplyBody(''); setReplyCc(''); setSelectedEmailId(null); }}
            style={{
              background: T.accent.blue, border: "none", borderRadius: 6,
              color: "#fff", fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600,
              padding: "7px 16px", cursor: "pointer",
            }}>
            Compose
          </button>
        </div>
      </div>

      {connectNotice && (
        <div style={{
          padding: "8px 20px", flexShrink: 0,
          background: connectNotice.toLowerCase().includes('fail') ? `${T.accent.red}12` : `${T.accent.green}12`,
          borderBottom: `1px solid ${connectNotice.toLowerCase().includes('fail') ? T.accent.red + '30' : T.accent.green + '30'}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{
            fontSize: 12, fontFamily: FONTS.sans,
            color: connectNotice.toLowerCase().includes('fail') ? T.accent.red : T.accent.green,
          }}>
            {connectNotice}
          </span>
          <button onClick={() => setConnectNotice(null)} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: T.text.tertiary, fontSize: 14, padding: "0 4px",
          }}>{"\u2715"}</button>
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 16, padding: "8px 20px",
        borderBottom: `1px solid ${T.border.subtle}`, background: `${T.accent.blue}05`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, textTransform: "uppercase" as const, letterSpacing: 1 }}>Today</span>
        <div style={{ display: "flex", gap: 12, flex: 1, overflowX: "auto" as const }}>
          {summaryStats.map((stat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16, fontFamily: FONTS.mono, fontWeight: 700, color: stat.color }}>{stat.value}</span>
              <span style={{ fontSize: 10, color: T.text.tertiary, fontFamily: FONTS.sans, whiteSpace: "nowrap" as const }}>{stat.label}</span>
            </div>
          ))}
        </div>
        <button style={{
          background: "transparent", border: `1px solid ${T.accent.green}40`,
          borderRadius: 5, color: T.accent.green, fontSize: 10, fontFamily: FONTS.mono,
          padding: "4px 10px", cursor: "pointer", letterSpacing: 0.5, whiteSpace: "nowrap" as const,
        }}>
          EXECUTE ALL READY ({readyActionsCount})
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{
          width: 380, borderRight: `1px solid ${T.border.subtle}`,
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
                      <span style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.accent.red, background: `${T.accent.red}15`, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                        URGENT
                      </span>
                    )}
                    {signals.length > 0 && (
                      <span style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.accent.green, background: `${T.accent.green}12`, padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>
                        {signals.length} READY
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
                    {(['reply', 'reply-all', 'forward'] as const).map(mode => (
                      <button key={mode} onClick={() => composeMode === mode ? setComposeMode(null) : openCompose(mode)} style={{
                        background: composeMode === mode ? `${T.accent.green}20` : T.bg.tertiary,
                        border: `1px solid ${composeMode === mode ? T.accent.green + '60' : T.border.subtle}`,
                        borderRadius: 6, padding: "6px 12px",
                        color: composeMode === mode ? T.accent.green : T.text.secondary,
                        fontSize: 11, fontFamily: FONTS.sans, cursor: "pointer", whiteSpace: "nowrap" as const,
                      }}>
                        {mode === 'reply' ? '↩ Reply' : mode === 'reply-all' ? '↩↩ Reply All' : '↪ Forward'}
                      </button>
                    ))}
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

                {emailIntel && emailIntel.actionItems && emailIntel.actionItems.filter((a: any) => !dismissedActions.has(a.text)).length > 0 && (
                  <div style={{
                    marginBottom: 24, padding: "14px 16px",
                    background: `${T.accent.amber}08`, border: `1px solid ${T.accent.amber}25`,
                    borderRadius: 8, maxWidth: 700,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent.amber }} />
                        <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.accent.amber, letterSpacing: 1 }}>
                          AGENT RECOMMENDATIONS
                        </span>
                      </div>
                      <button
                        onClick={() => handleExecuteAction(emailIntel.actionItems.find((a: any) => !dismissedActions.has(a.text)))}
                        style={{
                          background: T.accent.green, border: "none", borderRadius: 4,
                          color: "#fff", fontSize: 10, fontFamily: FONTS.mono, fontWeight: 600,
                          padding: "4px 10px", cursor: "pointer", letterSpacing: 0.5,
                        }}>
                        EXECUTE TOP ACTION
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                      {emailIntel.actionItems.filter((a: any) => !dismissedActions.has(a.text)).map((item: any, i: number) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "6px 10px", borderRadius: 5,
                          background: T.bg.card, border: `1px solid ${T.border.subtle}`,
                        }}>
                          <span style={{
                            fontSize: 8, fontFamily: FONTS.mono, padding: "1px 4px", borderRadius: 2,
                            color: item.priority === 'urgent' ? T.accent.red : item.priority === 'high' ? T.accent.amber : T.text.tertiary,
                            background: item.priority === 'urgent' ? `${T.accent.red}15` : item.priority === 'high' ? `${T.accent.amber}15` : T.bg.tertiary,
                          }}>{(item.priority || 'normal').toUpperCase()}</span>
                          <span style={{ fontSize: 11, color: T.text.primary, lineHeight: 1.3 }}>{item.suggestedTask}</span>
                          <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
                            <button onClick={() => handleExecuteAction(item)} style={{
                              fontSize: 9, fontFamily: FONTS.mono, padding: "2px 7px",
                              background: T.accent.blue, border: "none", borderRadius: 3,
                              color: "#fff", cursor: "pointer",
                            }}>Add</button>
                            <button onClick={() => handleDismissAction(item.text)} style={{
                              fontSize: 9, fontFamily: FONTS.mono, padding: "2px 6px",
                              background: "transparent", border: `1px solid ${T.border.subtle}`, borderRadius: 3,
                              color: T.text.tertiary, cursor: "pointer",
                            }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {replySent && (
                  <div style={{
                    marginBottom: 20, padding: "10px 14px",
                    background: `${T.accent.green}15`, border: `1px solid ${T.accent.green}40`,
                    borderRadius: 6, fontSize: 12, color: T.accent.green, fontFamily: FONTS.mono,
                  }}>
                    &#10003; Reply saved to sent items (addressed to {replySent})
                  </div>
                )}

                {composeMode && (
                  <div style={{
                    marginBottom: 24, border: `1px solid ${T.border.default}`,
                    borderRadius: 8, overflow: "hidden", background: T.bg.secondary,
                  }}>
                    <div style={{
                      padding: "10px 14px", background: T.bg.card,
                      borderBottom: `1px solid ${T.border.subtle}`,
                      fontSize: 11, fontFamily: FONTS.mono, color: T.text.tertiary,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ color: T.accent.green }}>
                        {composeMode === 'forward' ? '↪' : '↩'}
                      </span>
                      <span style={{ color: T.text.secondary, textTransform: "capitalize" as const }}>
                        {composeMode === 'reply' ? 'Reply' : composeMode === 'reply-all' ? 'Reply All' : 'Forward'}
                      </span>
                      {composeMode !== 'forward' && (
                        <span style={{ color: T.text.tertiary }}>
                          — {selectedEmail.subject?.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject || ''}`}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border.subtle}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, minWidth: 20 }}>TO</span>
                        <input
                          type="text"
                          value={replyTo}
                          onChange={e => setReplyTo(e.target.value)}
                          placeholder={composeMode === 'forward' ? 'Enter recipients...' : selectedEmail.from_address}
                          style={{
                            flex: 1, background: "transparent", border: "none", outline: "none",
                            fontSize: 12, color: T.text.primary, fontFamily: FONTS.sans,
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border.subtle}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, minWidth: 20 }}>CC</span>
                        <input
                          type="text"
                          value={replyCc}
                          onChange={e => setReplyCc(e.target.value)}
                          placeholder="Add CC recipients..."
                          style={{
                            flex: 1, background: "transparent", border: "none", outline: "none",
                            fontSize: 12, color: T.text.primary, fontFamily: FONTS.sans,
                          }}
                        />
                      </div>
                    </div>
                    <textarea
                      autoFocus={composeMode !== 'forward'}
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                      placeholder={composeMode === 'forward' ? 'Add a message...' : `Reply to ${selectedEmail.from_name || selectedEmail.from_address}...`}
                      style={{
                        width: "100%", minHeight: composeMode === 'forward' ? 160 : 120, padding: "14px",
                        background: "transparent", border: "none", outline: "none", resize: "vertical" as const,
                        fontSize: 13, color: T.text.primary, fontFamily: FONTS.sans, lineHeight: 1.6,
                        boxSizing: "border-box" as const,
                      }}
                    />
                    <div style={{
                      padding: "10px 14px", borderTop: `1px solid ${T.border.subtle}`,
                      display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const,
                    }}>
                      {replyError && (
                        <div style={{
                          width: "100%", marginBottom: 8, padding: "6px 10px",
                          background: `${T.accent.red}15`, border: `1px solid ${T.accent.red}40`,
                          borderRadius: 4, fontSize: 11, color: T.accent.red, fontFamily: FONTS.mono,
                        }}>
                          {replyError}
                        </div>
                      )}
                      <button
                        onClick={handleSendReply}
                        disabled={replySending || !replyBody.trim() || (composeMode === 'forward' && !replyTo.trim())}
                        style={{
                          padding: "7px 18px", borderRadius: 6, border: "none",
                          background: (replyBody.trim() && (composeMode !== 'forward' || replyTo.trim())) ? T.accent.green : T.bg.tertiary,
                          color: (replyBody.trim() && (composeMode !== 'forward' || replyTo.trim())) ? "#fff" : T.text.tertiary,
                          fontSize: 12, fontFamily: FONTS.sans, fontWeight: 600,
                          cursor: (replyBody.trim() && (composeMode !== 'forward' || replyTo.trim())) ? "pointer" : "not-allowed",
                          opacity: replySending ? 0.7 : 1,
                        }}
                      >
                        {replySending ? 'Saving...' : composeMode === 'forward' ? 'Forward' : 'Send Reply'}
                      </button>
                      <button
                        onClick={() => { setComposeMode(null); setReplyBody(''); setReplyCc(''); setReplyTo(''); setReplyError(null); }}
                        style={{
                          padding: "7px 14px", borderRadius: 6,
                          background: "transparent", border: `1px solid ${T.border.subtle}`,
                          color: T.text.tertiary, fontSize: 12, fontFamily: FONTS.sans, cursor: "pointer",
                        }}
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}

                {emailIntel && emailIntel.propertyExtractions.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div onClick={() => setPropPanelOpen(!propPanelOpen)} style={{
                      fontSize: 10, fontFamily: FONTS.mono, color: T.accent.green, letterSpacing: 1,
                      textTransform: "uppercase" as const, marginBottom: 8, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4, userSelect: "none" as const,
                    }}>
                      <span style={{ fontSize: 8, transition: "transform 0.15s", transform: propPanelOpen ? "rotate(90deg)" : "rotate(0deg)" }}>{"\u25B6"}</span>
                      Extracted Property ({emailIntel.propertyExtractions.length})
                    </div>
                    {propPanelOpen && emailIntel.propertyExtractions.map((prop: any, i: number) => (
                      <div key={i} style={{
                        padding: "10px 12px", background: T.bg.card, border: `1px solid ${T.border.subtle}`,
                        borderRadius: 6, marginBottom: 6,
                      }}>
                        <div style={{ fontSize: 12, color: T.text.primary, fontWeight: 500, marginBottom: 4 }}>
                          {prop.pin_address || prop.property_name || prop.extracted_data?.address || 'Property'}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, fontSize: 10, color: T.text.tertiary, marginBottom: 4 }}>
                          {prop.extracted_data?.propertyType && <span>Type: {prop.extracted_data.propertyType}</span>}
                          {prop.extracted_data?.units && <span>Units: {prop.extracted_data.units}</span>}
                          {prop.extracted_data?.price && <span>Price: ${(prop.extracted_data.price / 1000000).toFixed(1)}M</span>}
                          {prop.extracted_data?.capRate && <span>Cap: {(prop.extracted_data.capRate * 100).toFixed(1)}%</span>}
                          {prop.preference_match_score != null && <span>Match: {Math.round(prop.preference_match_score * 100)}%</span>}
                          {prop.extracted_data?.confidence != null && <span>Confidence: {Math.round(prop.extracted_data.confidence * 100)}%</span>}
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <span style={{
                            fontSize: 8, fontFamily: FONTS.mono, padding: "1px 5px", borderRadius: 2,
                            color: prop.status === 'auto-created' ? T.accent.green : prop.status === 'requires-review' ? T.accent.amber : T.text.tertiary,
                            background: prop.status === 'auto-created' ? `${T.accent.green}15` : prop.status === 'requires-review' ? `${T.accent.amber}15` : T.bg.tertiary,
                          }}>{prop.status || 'pending'}</span>
                          {prop.pin_id && <span style={{ fontSize: 9, color: T.accent.blue, fontFamily: FONTS.mono }}>Pin #{prop.pin_id.slice(0, 8)}</span>}
                          {(prop.status === 'requires-review' || prop.status === 'pending') && (
                            <button onClick={() => {
                              inboxService.approveExtraction(prop.id)
                                .then(() => { if (selectedEmail) inboxService.getEmailIntel(selectedEmail.id).then(r => { if (r.success) setEmailIntel(r.data); }); });
                            }} style={{
                              marginLeft: "auto", fontSize: 9, fontFamily: FONTS.mono, padding: "2px 8px",
                              background: T.accent.green, border: "none", borderRadius: 3,
                              color: "#fff", cursor: "pointer",
                            }}>Approve</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {emailIntel && emailIntel.newsExtraction && (
                  <div style={{ marginBottom: 16 }}>
                    <div onClick={() => setNewsPanelOpen(!newsPanelOpen)} style={{
                      fontSize: 10, fontFamily: FONTS.mono, color: T.accent.purple, letterSpacing: 1,
                      textTransform: "uppercase" as const, marginBottom: 8, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4, userSelect: "none" as const,
                    }}>
                      <span style={{ fontSize: 8, transition: "transform 0.15s", transform: newsPanelOpen ? "rotate(90deg)" : "rotate(0deg)" }}>{"\u25B6"}</span>
                      Private Intelligence
                    </div>
                    {newsPanelOpen && (
                      <div style={{
                        padding: "10px 12px", background: T.bg.card, border: `1px solid ${T.border.subtle}`, borderRadius: 6,
                      }}>
                        {emailIntel.newsExtraction.event_type && (
                          <div style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.accent.purple, marginBottom: 4, textTransform: "uppercase" as const }}>
                            {emailIntel.newsExtraction.event_type}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: T.text.primary, fontWeight: 500, marginBottom: 4 }}>
                          {emailIntel.newsExtraction.title}
                        </div>
                        <div style={{ fontSize: 11, color: T.text.secondary, lineHeight: 1.5, marginBottom: 6 }}>
                          {emailIntel.newsExtraction.summary}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, fontSize: 10, marginBottom: 6 }}>
                          <span style={{ fontFamily: FONTS.mono, color: T.text.tertiary }}>{emailIntel.newsExtraction.category}</span>
                          {emailIntel.newsExtraction.impact_score != null && (
                            <span style={{
                              fontFamily: FONTS.mono, padding: "1px 4px", borderRadius: 2,
                              color: emailIntel.newsExtraction.impact_score > 70 ? T.accent.red : emailIntel.newsExtraction.impact_score > 40 ? T.accent.amber : T.accent.green,
                              background: emailIntel.newsExtraction.impact_score > 70 ? `${T.accent.red}15` : emailIntel.newsExtraction.impact_score > 40 ? `${T.accent.amber}15` : `${T.accent.green}15`,
                            }}>Impact: {emailIntel.newsExtraction.impact_score}</span>
                          )}
                          {emailIntel.newsExtraction.sentiment_score != null && (
                            <span style={{ fontFamily: FONTS.mono, color: T.text.tertiary }}>
                              Sentiment: {emailIntel.newsExtraction.sentiment_score > 0 ? '+' : ''}{emailIntel.newsExtraction.sentiment_score.toFixed(1)}
                            </span>
                          )}
                          {emailIntel.newsExtraction.credibility_score != null && (
                            <span style={{
                              fontFamily: FONTS.mono, padding: "1px 4px", borderRadius: 2,
                              color: emailIntel.newsExtraction.credibility_score > 70 ? T.accent.green : emailIntel.newsExtraction.credibility_score > 40 ? T.accent.amber : T.accent.red,
                              background: emailIntel.newsExtraction.credibility_score > 70 ? `${T.accent.green}15` : emailIntel.newsExtraction.credibility_score > 40 ? `${T.accent.amber}15` : `${T.accent.red}15`,
                            }}>Credibility: {emailIntel.newsExtraction.credibility_score}</span>
                          )}
                          {emailIntel.newsExtraction.impact_radius && (
                            <span style={{ fontFamily: FONTS.mono, color: T.text.tertiary }}>
                              Radius: {emailIntel.newsExtraction.impact_radius}
                            </span>
                          )}
                        </div>
                        <a href="/dashboard/news" style={{
                          fontSize: 10, fontFamily: FONTS.mono, color: T.accent.blue,
                          textDecoration: "none", cursor: "pointer",
                        }}>View in News Feed {"\u2192"}</a>
                      </div>
                    )}
                  </div>
                )}

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
                <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" as const }}>
                  Quick Actions
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "Create / Update Deal", icon: "\uD83C\uDFE2", color: T.accent.blue, action: handleLinkToDeal },
                    { label: "Schedule Tour", icon: "\uD83D\uDCCD", color: T.accent.cyan, action: () => {} },
                    { label: "Draft Offer Letter", icon: "\u270D\uFE0F", color: T.accent.purple, action: () => { setComposeMode('reply'); } },
                    { label: "Research Comps", icon: "\uD83D\uDD0D", color: T.accent.amber, action: () => {} },
                    { label: "Flag for Review", icon: "\u26A0\uFE0F", color: T.accent.red,
                      action: () => { if (selectedEmail) inboxService.flagEmail(selectedEmail.id, !selectedEmail.is_flagged).then(() => loadInbox()); } },
                    { label: "Property Report", icon: "\uD83D\uDCCB", color: T.accent.green, action: () => {} },
                    { label: "Schedule Follow-up", icon: "\u23F0", color: T.accent.blue, action: () => {} },
                    { label: "Add to Campaign", icon: "\uD83D\uDCE3", color: T.accent.cyan, action: () => {} },
                  ].map((act, i) => (
                    <button key={i} onClick={act.action} style={{
                      display: "flex", flexDirection: "column" as const, alignItems: "flex-start",
                      gap: 4, padding: "10px 10px",
                      background: T.bg.card, border: `1px solid ${T.border.subtle}`,
                      borderRadius: 7, cursor: "pointer", textAlign: "left" as const,
                      transition: "border-color 0.12s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = act.color + '60'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.border.subtle; }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{act.icon}</span>
                      <span style={{ fontSize: 10, fontFamily: FONTS.sans, color: T.text.primary, fontWeight: 500, lineHeight: 1.3 }}>{act.label}</span>
                    </button>
                  ))}
                </div>

                {selectedEmail && emailIntel && emailIntel.propertyExtractions.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.accent.green, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                      Extracted Properties
                    </div>
                    {emailIntel.propertyExtractions.map((prop: any, i: number) => (
                      <div key={i} style={{
                        padding: "8px 10px", background: T.bg.card, border: `1px solid ${T.border.subtle}`,
                        borderRadius: 6, marginBottom: 6,
                      }}>
                        <div style={{ fontSize: 11, color: T.text.primary, fontWeight: 500, marginBottom: 2 }}>
                          {prop.pin_address || prop.property_name || 'Property'}
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <span style={{
                            fontSize: 8, fontFamily: FONTS.mono, padding: "1px 4px", borderRadius: 2,
                            color: prop.status === 'auto-created' ? T.accent.green : T.accent.amber,
                            background: prop.status === 'auto-created' ? `${T.accent.green}15` : `${T.accent.amber}15`,
                          }}>{prop.status || 'pending'}</span>
                          {prop.status === 'requires-review' && (
                            <button onClick={() => {
                              inboxService.approveExtraction(prop.id)
                                .then(() => { if (selectedEmail) inboxService.getEmailIntel(selectedEmail.id).then(r => { if (r.success) setEmailIntel(r.data); }); });
                            }} style={{
                              marginLeft: "auto", fontSize: 9, fontFamily: FONTS.mono, padding: "2px 8px",
                              background: T.accent.blue, border: "none", borderRadius: 3,
                              color: "#fff", cursor: "pointer",
                            }}>Approve</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedEmail && emailIntel && emailIntel.newsExtraction && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.accent.purple, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                      Private Intelligence
                    </div>
                    <div style={{
                      padding: "8px 10px", background: T.bg.card, border: `1px solid ${T.border.subtle}`, borderRadius: 6,
                    }}>
                      {emailIntel.newsExtraction.event_type && (
                        <div style={{ fontSize: 8, fontFamily: FONTS.mono, color: T.accent.purple, marginBottom: 3, textTransform: "uppercase" as const }}>
                          {emailIntel.newsExtraction.event_type}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: T.text.primary, fontWeight: 500, marginBottom: 2 }}>
                        {emailIntel.newsExtraction.title}
                      </div>
                      <div style={{ fontSize: 10, color: T.text.secondary, lineHeight: 1.4, marginBottom: 4 }}>
                        {emailIntel.newsExtraction.summary}
                      </div>
                      <a href="/dashboard/news" style={{
                        fontSize: 9, fontFamily: FONTS.mono, color: T.accent.blue, textDecoration: "none", cursor: "pointer",
                      }}>View in News Feed {"\u2192"}</a>
                    </div>
                  </div>
                )}
                {intelLoading && (
                  <div style={{ textAlign: "center" as const, padding: 12, fontSize: 10, color: T.text.tertiary }}>
                    Loading intelligence...
                  </div>
                )}
              </div>
            )}

            {sidePanel === 'deal' && selectedEmail?.deal_id && (
              <div>
                <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" as const }}>
                  Linked Deal
                </div>
                <div style={{ padding: 14, background: T.bg.card, borderRadius: 8, border: `1px solid ${T.border.subtle}`, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text.primary, marginBottom: 10 }}>
                    {dealDetails?.name || selectedEmail.deal_name || 'Deal'}
                  </div>
                  {dealDetails ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ padding: "8px 10px", background: T.bg.tertiary, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.text.tertiary, marginBottom: 3 }}>JEDI SCORE</div>
                        <div style={{ fontSize: 18, fontFamily: FONTS.mono, fontWeight: 700,
                          color: dealDetails.triage_score >= 80 ? T.accent.green : dealDetails.triage_score >= 50 ? T.accent.amber : T.accent.red }}>
                          {dealDetails.triage_score ?? '—'}
                        </div>
                      </div>
                      <div style={{ padding: "8px 10px", background: T.bg.tertiary, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.text.tertiary, marginBottom: 3 }}>STRATEGY</div>
                        <div style={{ fontSize: 11, color: T.text.primary, fontWeight: 500, lineHeight: 1.3 }}>
                          {dealDetails.deal_category || dealDetails.project_type || '—'}
                        </div>
                      </div>
                      <div style={{ padding: "8px 10px", background: T.bg.tertiary, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.text.tertiary, marginBottom: 3 }}>PIPELINE VALUE</div>
                        <div style={{ fontSize: 13, fontFamily: FONTS.mono, fontWeight: 600, color: T.accent.cyan }}>
                          {dealDetails.budget ? `$${(dealDetails.budget / 1000000).toFixed(1)}M` : '—'}
                        </div>
                      </div>
                      <div style={{ padding: "8px 10px", background: T.bg.tertiary, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, fontFamily: FONTS.mono, color: T.text.tertiary, marginBottom: 3 }}>DEADLINE</div>
                        <div style={{ fontSize: 11, fontFamily: FONTS.mono, color: T.text.primary }}>
                          {dealDetails.timeline_end ? new Date(dealDetails.timeline_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <DealStageIndicator stage="prospect" name={selectedEmail.deal_name || ''} />
                  )}
                  {dealDetails && (
                    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      {dealDetails.status && (
                        <span style={{
                          fontSize: 9, fontFamily: FONTS.mono, padding: "2px 6px", borderRadius: 3,
                          color: dealDetails.status === 'active' ? T.accent.green : T.text.tertiary,
                          background: dealDetails.status === 'active' ? `${T.accent.green}15` : T.bg.tertiary,
                        }}>{dealDetails.status}</span>
                      )}
                      {(dealDetails.pipeline_stage || dealDetails.pipelineStage) && (
                        <span style={{
                          fontSize: 9, fontFamily: FONTS.mono, padding: "2px 6px", borderRadius: 3,
                          color: T.accent.purple, background: `${T.accent.purple}15`,
                        }}>{dealDetails.pipeline_stage || dealDetails.pipelineStage}</span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => { window.location.href = `/dashboard/deals/${selectedEmail.deal_id}`; }} style={{
                  width: "100%", padding: "9px",
                  background: `${T.accent.blue}10`, border: `1px solid ${T.accent.blue}30`,
                  borderRadius: 6, color: T.accent.blue, fontSize: 11,
                  fontFamily: FONTS.sans, fontWeight: 500, cursor: "pointer",
                }}>Open Deal Capsule {"\u2192"}</button>
              </div>
            )}

            {sidePanel === 'deal' && (!selectedEmail || !selectedEmail.deal_id) && (
              <div style={{ textAlign: "center" as const, padding: "40px 20px" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{"\uD83D\uDD17"}</div>
                <div style={{ fontSize: 12, color: T.text.secondary, marginBottom: 12 }}>No deal linked</div>
                <button onClick={handleLinkToDeal} style={{
                  padding: "8px 16px", background: T.accent.blue, border: "none",
                  borderRadius: 6, color: "#fff", fontSize: 11, fontFamily: FONTS.sans, cursor: "pointer",
                }}>Link to Deal</button>
                <div style={{ fontSize: 10, color: T.text.tertiary, marginTop: 8 }}>or let the agent auto-detect</div>
              </div>
            )}

            {sidePanel === 'team' && (
              <div>
                {selectedEmail && !selectedEmail.deal_id && teamMembers.length === 0 && (
                  <div style={{ textAlign: "center" as const, padding: "20px", marginBottom: 16 }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{"\uD83D\uDC65"}</div>
                    <div style={{ fontSize: 12, color: T.text.secondary, marginBottom: 4 }}>No deal linked</div>
                    <div style={{ fontSize: 10, color: T.text.tertiary }}>Link this email to a deal to see team members</div>
                    <button onClick={handleLinkToDeal} style={{
                      marginTop: 12, padding: "6px 16px", background: `${T.accent.blue}10`,
                      border: `1px solid ${T.accent.blue}30`, borderRadius: 6,
                      color: T.accent.blue, fontSize: 11, fontFamily: FONTS.sans,
                      fontWeight: 500, cursor: "pointer",
                    }}>Link to Deal</button>
                  </div>
                )}
                {selectedEmail && (
                  <>
                    <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" as const }}>
                      Deal Team
                    </div>
                    {(teamMembers.length > 0 ? teamMembers : []).map((member: any) => (
                      <div key={member.id} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
                        background: T.bg.card, border: `1px solid ${T.border.subtle}`, borderRadius: 6, marginBottom: 5,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 6, background: `${T.accent.blue}15`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontFamily: FONTS.mono, color: T.accent.blue, fontWeight: 600, flexShrink: 0,
                        }}>
                          {(member.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: T.text.primary, fontWeight: 500 }}>{member.name}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <span style={{
                              fontSize: 8, fontFamily: FONTS.mono, padding: "1px 4px", borderRadius: 2,
                              color: T.accent.blue, background: `${T.accent.blue}15`,
                            }}>{member.role || 'Member'}</span>
                            {member.email && <span style={{ fontSize: 9, color: T.text.tertiary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{member.email}</span>}
                          </div>
                        </div>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: member.status === 'active' ? T.accent.green : T.border.default,
                        }} />
                      </div>
                    ))}
                    {teamMembers.length === 0 && selectedEmail.deal_id && (
                      <div style={{ padding: "12px", textAlign: "center" as const, color: T.text.tertiary, fontSize: 11 }}>No team members yet</div>
                    )}
                    {(['Lead Buyer', 'Legal', 'Finance', 'Broker'].map((role, i) => {
                      const hasMember = teamMembers.some((m: any) => (m.role || '').toLowerCase().includes(role.toLowerCase()));
                      if (hasMember) return null;
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
                          background: "transparent", border: `1px dashed ${T.border.subtle}`, borderRadius: 6, marginBottom: 5,
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 6, background: T.bg.tertiary,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, color: T.text.tertiary, flexShrink: 0,
                          }}>+</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: T.text.tertiary }}>{role}</div>
                            <div style={{ fontSize: 9, color: T.text.tertiary, fontFamily: FONTS.mono }}>Open slot</div>
                          </div>
                        </div>
                      );
                    }))}
                  </>
                )}

                {selectedEmail && teamActivity.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 8, marginTop: 16, textTransform: "uppercase" as const }}>
                      Recent Activity
                    </div>
                    {teamActivity.map((event: any, i: number) => (
                      <div key={i} style={{
                        padding: "6px 10px", borderLeft: `2px solid ${T.accent.blue}40`, marginBottom: 4,
                      }}>
                        <div style={{ fontSize: 10, color: T.text.secondary }}>{event.actor_name} {event.action}</div>
                        <div style={{ fontSize: 9, color: T.text.tertiary, fontFamily: FONTS.mono }}>
                          {event.created_at ? formatDate(event.created_at) : ''}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.text.tertiary, letterSpacing: 1, marginBottom: 12, marginTop: teamMembers.length > 0 ? 16 : 0, textTransform: "uppercase" as const }}>
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
                {emailIntel && emailIntel.linkedTasks.length > 0 ? (
                  emailIntel.linkedTasks.map((task: any) => (
                    <div key={task.id} style={{
                      padding: "10px 12px", background: T.bg.card, border: `1px solid ${T.border.subtle}`,
                      borderRadius: 6, marginBottom: 6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 8, fontFamily: FONTS.mono, padding: "1px 4px", borderRadius: 2,
                          color: task.status === 'completed' ? T.accent.green : task.status === 'in_progress' ? T.accent.blue : T.text.tertiary,
                          background: task.status === 'completed' ? `${T.accent.green}15` : task.status === 'in_progress' ? `${T.accent.blue}15` : T.bg.tertiary,
                        }}>{task.status}</span>
                        <span style={{
                          fontSize: 8, fontFamily: FONTS.mono, padding: "1px 4px", borderRadius: 2,
                          color: task.priority === 'urgent' ? T.accent.red : task.priority === 'high' ? T.accent.amber : T.text.tertiary,
                          background: task.priority === 'urgent' ? `${T.accent.red}15` : task.priority === 'high' ? `${T.accent.amber}15` : T.bg.tertiary,
                        }}>{task.priority}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.text.primary, fontWeight: 500 }}>{task.title}</div>
                      {task.due_date && (
                        <div style={{ fontSize: 10, color: T.text.tertiary, marginTop: 2 }}>Due: {new Date(task.due_date).toLocaleDateString()}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center" as const, padding: "20px", color: T.text.tertiary, fontSize: 12 }}>
                    {selectedEmail ? 'No tasks linked to this email' : 'Select an email to see tasks'}
                  </div>
                )}
                {selectedEmail && emailIntel && emailIntel.actionItems.filter(a => !dismissedActions.has(a.text)).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, fontFamily: FONTS.mono, color: T.accent.amber, marginBottom: 6, textTransform: "uppercase" as const }}>
                      Detected Action Items
                    </div>
                    {emailIntel.actionItems.filter(a => !dismissedActions.has(a.text)).map((item, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "6px 10px", background: T.bg.card, border: `1px solid ${T.border.subtle}`,
                        borderRadius: 6, marginBottom: 4,
                      }}>
                        <div style={{ fontSize: 11, color: T.text.primary, flex: 1 }}>{item.suggestedTask.slice(0, 60)}</div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 4 }}>
                          <button onClick={() => handleExecuteAction(item)} style={{
                            fontSize: 9, fontFamily: FONTS.mono, padding: "2px 6px",
                            background: T.accent.green, border: "none", borderRadius: 3,
                            color: "#fff", cursor: "pointer",
                          }}>+</button>
                          <button onClick={() => handleDismissAction(item.text)} style={{
                            fontSize: 9, fontFamily: FONTS.mono, padding: "2px 6px",
                            background: "transparent", border: `1px solid ${T.border.subtle}`, borderRadius: 3,
                            color: T.text.tertiary, cursor: "pointer",
                          }}>{"\u00D7"}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {dealLinkOpen && (
              <div style={{
                position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0,
                background: T.bg.secondary, zIndex: 10, padding: 16, overflowY: "auto" as const,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text.primary }}>Link to Deal</div>
                  <button onClick={() => setDealLinkOpen(false)} style={{
                    background: "transparent", border: "none", color: T.text.tertiary, cursor: "pointer", fontSize: 14,
                  }}>{"\u2715"}</button>
                </div>
                {dealsLoading ? (
                  <div style={{ textAlign: "center" as const, padding: 20, fontSize: 10, color: T.text.tertiary }}>Loading deals...</div>
                ) : dealsList.length === 0 ? (
                  <div style={{ textAlign: "center" as const, padding: 20, fontSize: 11, color: T.text.tertiary }}>No deals found</div>
                ) : (
                  dealsList.map((deal: any) => (
                    <div key={deal.id} onClick={() => handleSelectDeal(deal.id)} style={{
                      padding: "10px 12px", background: T.bg.card, border: `1px solid ${T.border.subtle}`,
                      borderRadius: 6, marginBottom: 4, cursor: "pointer",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent.blue; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border.subtle; }}
                    >
                      <div style={{ fontSize: 12, color: T.text.primary, fontWeight: 500 }}>{deal.name}</div>
                      <div style={{ fontSize: 10, color: T.text.tertiary }}>{deal.stage || deal.status || ''}</div>
                    </div>
                  ))
                )}
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
