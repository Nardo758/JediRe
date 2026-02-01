import { useEffect, useState } from 'react';
import { authAPI } from '@/services/api';
import { useAppStore } from '@/store';
import { User } from '@/types';

export function useAuth() {
  const { user, setUser } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const userData = await authAPI.me();
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('auth_token');
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
