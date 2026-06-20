import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface AuthUser {
  id: string;
  email: string;
  plan: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loginAsDevFree: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from local storage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('convocarry_session_token');
    const storedUserStr = localStorage.getItem('convocarry_user');
    if (storedToken && storedUserStr) {
      try {
        const storedUser = JSON.parse(storedUserStr);
        setToken(storedToken);
        setUser(storedUser);
      } catch (_e) {
        localStorage.removeItem('convocarry_session_token');
        localStorage.removeItem('convocarry_user');
      }
    }
    setIsLoading(false);
  }, []);

  const loginAsDevFree = useCallback(async () => {
    try {
      // NOTE: In production, this would open a Google OAuth popup or redirect.
      // Here, we bypass to the local dev endpoint.
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/dev-login`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Login failed: ${res.status}`);
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('convocarry_session_token', data.token);
      localStorage.setItem('convocarry_user', JSON.stringify(data.user));
      // Also update the legacy plan tracker used by some components
      localStorage.setItem('convocarry_user_plan', data.user.plan);
    } catch (err) {
      console.error('Failed dev login:', err);
      alert('Failed dev login. Is ENABLE_DEV_LOGIN=true set on the backend?');
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('convocarry_session_token');
    localStorage.removeItem('convocarry_user');
    localStorage.removeItem('convocarry_user_plan');
  }, []);

  const value = {
    user,
    token,
    loginAsDevFree,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
