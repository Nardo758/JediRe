import { useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import { Shield } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

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

          {isLogin ? (
            <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
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
