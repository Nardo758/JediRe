import { useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import MainPage from './pages/MainPage';
import { Loader } from 'lucide-react';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-purple-50">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 text-primary-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading JediRe...</p>
        </div>
      </div>
    );
  }

  return user ? <MainPage /> : <AuthPage />;
}

export default App;
