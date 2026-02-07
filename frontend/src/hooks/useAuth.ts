import { useEffect, useState } from 'react';
import { authAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { useAuthStore } from '@/stores/authStore';
import { User } from '@/types';

export function useAuth() {
  const { user, setUser } = useAppStore();
  const { setToken: setStoreToken, logout: storeLogout } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          setStoreToken(token);
          const userData = await authAPI.me();
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('auth_token');
          storeLogout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { token, user: userData } = await authAPI.login(email, password);
      localStorage.setItem('auth_token', token);
      setStoreToken(token);
      setUser(userData);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const { token, user: userData } = await authAPI.register(email, password, name);
      localStorage.setItem('auth_token', token);
      setStoreToken(token);
      setUser(userData);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('auth_token');
      storeLogout();
      setUser(null);
    }
  };

  return {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };
}
