import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type Status = 'loading' | 'ready' | 'accepting' | 'success' | 'error' | 'no-token';

interface InviteInfo {
  orgName: string;
  inviterName: string;
  role: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>(token ? 'loading' : 'no-token');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Peek at the invite to surface org name + inviter before accepting
  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/orgs/invitations/${token}/preview`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMessage(data.error);
          setStatus('error');
        } else {
          setInviteInfo(data);
          setStatus('ready');
        }
      })
      .catch(() => {
        // Preview endpoint may not exist yet — show generic ready state so user can still accept
        setInviteInfo(null);
        setStatus('ready');
      });
  }, [token]);

  const handleAccept = async () => {
    setStatus('accepting');
    setErrorMessage('');
    try {
      const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
      const res = await fetch(`/api/v1/orgs/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
      } else if (res.status === 401) {
        // Not logged in — redirect to login with return URL
        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      } else {
        setErrorMessage(data.error || 'Failed to accept invitation.');
        setStatus('error');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
      setStatus('error');
    }
  };

  // ── No token ──────────────────────────────────────────────────────────────
  if (status === 'no-token') {
    return (
      <PageShell>
        <div className="text-center max-w-md mx-auto">
          <IconBubble color="red"><AlertCircle className="w-8 h-8 text-red-600" /></IconBubble>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Invalid Invitation Link</h1>
          <p className="text-gray-600 mb-8">This invitation link is missing or malformed. Ask the sender to resend the invite.</p>
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Go to Login →</Link>
        </div>
      </PageShell>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <PageShell>
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading invitation…</p>
        </div>
      </PageShell>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <PageShell>
        <div className="text-center max-w-md mx-auto">
          <IconBubble color="red"><AlertCircle className="w-8 h-8 text-red-600" /></IconBubble>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Invitation Unavailable</h1>
          <p className="text-gray-600 mb-8">{errorMessage || 'This invitation has expired or already been used.'}</p>
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Go to Login →</Link>
        </div>
      </PageShell>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <PageShell>
        <div className="text-center max-w-md mx-auto">
          <IconBubble color="green"><CheckCircle className="w-8 h-8 text-green-600" /></IconBubble>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">You're in!</h1>
          <p className="text-gray-600 mb-8">
            You've joined{inviteInfo?.orgName ? ` ${inviteInfo.orgName}` : ' the organization'}. You now share their AI credit pool.
          </p>
          <Link
            to="/terminal/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Go to Dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  // ── Ready to accept ───────────────────────────────────────────────────────
  return (
    <PageShell>
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">You've been invited</h1>

          {inviteInfo ? (
            <p className="text-gray-600 text-center mb-6">
              <strong>{inviteInfo.inviterName}</strong> invited you to join{' '}
              <strong>{inviteInfo.orgName}</strong> as {inviteInfo.role === 'analyst' ? 'an analyst' : `a ${inviteInfo.role}`}.
            </p>
          ) : (
            <p className="text-gray-600 text-center mb-6">
              Accept this invitation to join an organization on JediRe and share their AI credit pool.
            </p>
          )}

          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-sm text-blue-800">
            <strong>What this means:</strong> You'll become a member of this organization and share their AI credit pool. Your own workspace stays separate.
          </div>

          <button
            onClick={handleAccept}
            disabled={status === 'accepting'}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {status === 'accepting' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Accepting…</>
            ) : (
              'Accept Invitation'
            )}
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            You'll need to be logged in.{' '}
            <Link to={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="text-blue-600 hover:text-blue-700">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </PageShell>
  );
}

// ── Shared layout helpers ──────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        {children}
      </main>
    </div>
  );
}

function IconBubble({ color, children }: { color: 'green' | 'red' | 'blue'; children: React.ReactNode }) {
  const bg = color === 'green' ? 'bg-green-100' : color === 'red' ? 'bg-red-100' : 'bg-blue-100';
  return (
    <div className={`w-16 h-16 ${bg} rounded-full flex items-center justify-center mx-auto mb-6`}>
      {children}
    </div>
  );
}
