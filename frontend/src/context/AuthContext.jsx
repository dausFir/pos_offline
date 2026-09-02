import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef(null);

  const clearAuth = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const scheduleRefresh = () => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(async () => {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return clearAuth();
      try {
        const res = await api.post('/refresh-token', { refresh_token: refreshToken });
        const { access_token, refresh_token } = res.data.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        scheduleRefresh();
      } catch {
        clearAuth();
      }
    }, 25 * 60 * 1000);
  };

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      if (storedUser && accessToken && refreshToken) {
        setUser(JSON.parse(storedUser));
        scheduleRefresh();
      } else {
        clearAuth();
      }
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
    return () => clearTimeout(refreshTimeoutRef.current);
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/login', { username, password });
    if (!res.data?.success) throw new Error(res.data?.error || 'Login gagal');
    const { access_token, refresh_token, user: loggedInUser } = res.data.data;
    if (!access_token || !refresh_token || !loggedInUser) throw new Error('Respons login tidak lengkap');
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    scheduleRefresh();
    return loggedInUser;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      if (refreshToken) await api.post('/logout', { refresh_token: refreshToken });
    } finally {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      clearAuth();
    }
  };

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;
    try {
      const res = await api.post('/refresh-token', { refresh_token: refreshToken });
      localStorage.setItem('access_token', res.data.data.access_token);
      localStorage.setItem('refresh_token', res.data.data.refresh_token);
      scheduleRefresh();
      return true;
    } catch {
      clearAuth();
      return false;
    }
  };

  const hasRole = (...roles) => user && roles.includes(user.role);
  return <AuthContext.Provider value={{ user, login, logout, loading, hasRole,
    isAdmin: () => hasRole('super_admin', 'admin'),
    isSuperAdmin: () => hasRole('super_admin'), refreshAccessToken }}>
    {children}
  </AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
