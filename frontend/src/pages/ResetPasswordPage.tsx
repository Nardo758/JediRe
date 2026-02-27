import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Lock, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return;
    setLoading(true);
    setTimeout(() => {
      setStatus('success');
      setLoading(false);
    }, 1500);
  };

  if (!token) {
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
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Reset Link</h1>
            <p className="text-gray-600 mb-8">This password reset link is invalid or has expired.</p>
            <Link to="/auth" className="text-blue-600 hover:text-blue-700 font-medium">
              Request a new reset link
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
        <div className="w-full max-w-md">
          {status === 'form' && (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Reset Password</h1>
              <p className="text-gray-600 text-center mb-6">Enter your new password below</p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="reset-password"
                      name="resetPassword"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter new password"
                      aria-label="New password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    id="reset-confirm-password"
                    name="resetConfirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm new password"
                    aria-label="Confirm password"
                    required
                  />
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={loading || password !== confirmPassword}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Password Reset Successful</h1>
              <p className="text-gray-600 mb-8">Your password has been successfully reset. You can now log in with your new password.</p>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Go to Login
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
