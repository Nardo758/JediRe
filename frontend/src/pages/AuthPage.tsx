import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import { Shield, Mail, CheckCircle, AlertCircle } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const shareParam = searchParams.get('share');
  const [authMode, setAuthMode] = useState<AuthMode>(mode === 'register' ? 'register' : 'login');

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (shareParam) {
      sessionStorage.setItem('jedi_pending_share', shareParam);
    }
  }, [shareParam]);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotStatus('loading');
    try {
      await fetch('/api/v1/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotStatus('sent');
    } catch {
      setForgotStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-300 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-300 rounded-full opacity-20 blur-3xl"></div>
      </div>

      <header className="relative z-10 text-center py-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <h1 className="text-2xl font-bold text-white tracking-wide">JEDIRE</h1>
        <p className="text-blue-100 text-sm">Real Estate Intelligence</p>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="text-3xl font-bold">
              <span className="text-emerald-500">Jedi</span><span className="text-gray-900">Re</span>
            </div>
          </div>

          {authMode === 'login' && (
            <LoginForm
              onSwitchToRegister={() => setAuthMode('register')}
              onForgotPassword={() => { setAuthMode('forgot'); setForgotStatus('idle'); setForgotEmail(''); }}
            />
          )}

          {authMode === 'register' && (
            <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />
          )}

          {authMode === 'forgot' && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Forgot Password?</h2>
                <p className="text-gray-500 text-sm">Enter your email and we'll send a reset link</p>
              </div>

              {forgotStatus === 'sent' ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-gray-700 font-medium mb-2">Check your email</p>
                  <p className="text-gray-500 text-sm mb-6">
                    If an account exists for <strong>{forgotEmail}</strong>, a reset link was sent. Check your spam folder if it doesn't appear within a few minutes.
                  </p>
                  <button
                    onClick={() => setAuthMode('login')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  {forgotStatus === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      Network error. Please try again.
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotStatus === 'loading'}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {forgotStatus === 'loading' ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Back to login
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg py-2 px-4">
            <Shield className="w-4 h-4 text-green-500" />
            <span>Secure Login - Your data is encrypted</span>
          </div>

          <div className="mt-4 text-center text-xs text-gray-400">
            <a href="#" className="hover:text-gray-600">Privacy Policy</a>
            <span className="mx-2">|</span>
            <a href="#" className="hover:text-gray-600">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  );
}
