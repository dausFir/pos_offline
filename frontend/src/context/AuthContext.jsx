import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTimeout, setRefreshTimeout] = useState(null);
  const [trialExpired, setTrialExpired] = useState(false);

  useEffect(() => {
    // Prevent infinite loops by setting loading false first
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 100);
    
    const stored = localStorage.getItem('user');
    
    // Check for new token format first
    const accessToken = localStorage.getItem('access_token'); 
    const refreshToken = localStorage.getItem('refresh_token');
    
    // Fallback to old token format for backward compatibility
    const oldToken = localStorage.getItem('token');
    
    if (stored) {
      try {
        const userData = JSON.parse(stored);
        setUser(userData);
        
        if (accessToken && refreshToken) {
          // New refresh token system
          setupTokenRefresh();
        } else if (oldToken) {
          // Old single token system (still valid for existing sessions)
        }
      } catch (parseError) {
        localStorage.removeItem('user');
      }
    }
    
    clearTimeout(timeoutId);
    setLoading(false);
  }, []);

  // Auto-refresh access token before it expires
  const setupTokenRefresh = () => {
    // Clear existing timeout
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    
    // Set refresh to happen 5 minutes before expiry (25 min for 30 min token)
    const timeout = setTimeout(async () => {
      await refreshAccessToken();
    }, 25 * 60 * 1000); // 25 minutes in milliseconds
    
    setRefreshTimeout(timeout);
  };

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      logout();
      return false;
    }

    try {
      const res = await api.post('/refresh-token', { refresh_token: refreshToken });
      const { access_token, refresh_token: newRefreshToken } = res.data.data;
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', newRefreshToken);
      
      setupTokenRefresh(); // Setup next refresh
      return true;
    } catch (err) {
      console.error('Token refresh failed:', err);
      logout();
      return false;
    }
  };

  // Check trial status
  const checkTrialStatus = async () => {
    try {
      const res = await api.get('/settings');
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        const errorData = err.response.data;
        if (errorData.error_code === 'TRIAL_EXPIRED') {
          setTrialExpired(true);
          return null;
        }
      }
      throw err;
    }
  };

  // Setup API interceptor for trial expiry
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403) {
          const errorData = error.response.data;
          if (errorData.error_code === 'TRIAL_EXPIRED') {
            setTrialExpired(true);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (username, password) => {
    console.log('🔥🔥🔥 ========================================= 🔥🔥🔥');
    console.log('🔥🔥🔥 [FRONTEND] LOGIN FUNCTION CALLED!!!!! 🔥🔥🔥');
    console.log('🔥🔥🔥 ========================================= 🔥🔥🔥');
    
    try {
      console.log('🔐 [FRONTEND] === LOGIN DEBUG START ===');
      console.log('🔐 [FRONTEND] Username:', username);
      
      // Test localStorage first
      try {
        localStorage.setItem('login_test', 'test123');
        const testValue = localStorage.getItem('login_test'); 
        console.log('✅ [FRONTEND] localStorage test:', testValue);
        localStorage.removeItem('login_test');
      } catch (storageErr) {
        console.error('❌ [FRONTEND] localStorage BROKEN:', storageErr);
        throw new Error('localStorage not available');
      }
      
      console.log('🌐 [FRONTEND] Making API call to /login...');
      const res = await api.post('/login', { username, password });
      
      console.log('📋 [FRONTEND] Full response object:', res);
      console.log('📋 [FRONTEND] Response status:', res.status);
      console.log('📋 [FRONTEND] Response data:', res.data);
      
      // More detailed data inspection
      if (res.data) {
        console.log('📋 [FRONTEND] res.data.success:', res.data.success);
        console.log('📋 [FRONTEND] res.data.data exists:', !!res.data.data);
        if (res.data.data) {
          console.log('📋 [FRONTEND] res.data.data keys:', Object.keys(res.data.data));
        }
      }
      
      if (!res.data || !res.data.success) {
        console.error('❌ [FRONTEND] API returned error:', res.data?.error);
        throw new Error(res.data?.error || 'Login failed');
      }
      
      const responseData = res.data.data;
      const access_token = responseData.access_token || responseData.AccessToken;
      const refresh_token = responseData.refresh_token || responseData.RefreshToken;  
      const user = responseData.user || responseData.User;
      
      console.log('🔑 [FRONTEND] Extracted data:');
      console.log('   - access_token exists:', !!access_token);
      console.log('   - access_token preview:', access_token ? access_token.substring(0,20) + '...' : 'MISSING');
      console.log('   - refresh_token exists:', !!refresh_token);
      console.log('   - refresh_token preview:', refresh_token ? refresh_token.substring(0,20) + '...' : 'MISSING');
      console.log('   - user exists:', !!user);
      console.log('   - user data:', user);
      
      if (!access_token || !refresh_token) {
        console.error('❌ [FRONTEND] Missing tokens! Available keys:', Object.keys(responseData || {}));
        throw new Error('Missing access_token or refresh_token in response');
      }
      
      console.log('💾 [FRONTEND] Attempting localStorage.setItem...');
      
      try {
        console.log('🔧 [FRONTEND] Step 1: Setting access_token...');
        localStorage.setItem('access_token', access_token);
        console.log('✅ [FRONTEND] Step 1 complete');
        
        console.log('🔧 [FRONTEND] Step 2: Setting refresh_token...');
        localStorage.setItem('refresh_token', refresh_token);
        console.log('✅ [FRONTEND] Step 2 complete');
        
        console.log('🔧 [FRONTEND] Step 3: Setting user data...');
        const userString = JSON.stringify(user);
        console.log('🔧 [FRONTEND] User string to store:', userString);
        localStorage.setItem('user', userString);
        console.log('✅ [FRONTEND] Step 3 complete');
        
        // IMMEDIATE VERIFICATION
        console.log('🔍 [FRONTEND] === IMMEDIATE VERIFICATION ===');
        const verifyAccess = localStorage.getItem('access_token');
        const verifyRefresh = localStorage.getItem('refresh_token');
        const verifyUser = localStorage.getItem('user');
        
        console.log('🔍 [FRONTEND] Verification results:');
        console.log('   - access_token length:', verifyAccess?.length || 'MISSING');
        console.log('   - access_token preview:', verifyAccess?.substring(0,30) || 'MISSING');
        console.log('   - refresh_token length:', verifyRefresh?.length || 'MISSING');
        console.log('   - refresh_token preview:', verifyRefresh?.substring(0,30) || 'MISSING');
        console.log('   - user data length:', verifyUser?.length || 'MISSING');
        console.log('   - user data preview:', verifyUser?.substring(0,50) || 'MISSING');
        
        // Test localStorage quotas
        console.log('🧪 [FRONTEND] Testing localStorage quota...');
        const testKey = 'storage_test_' + Date.now();
        const testValue = 'x'.repeat(1000); // 1KB test
        try {
          localStorage.setItem(testKey, testValue);
          localStorage.removeItem(testKey);
          console.log('✅ [FRONTEND] localStorage quota OK');
        } catch (quotaErr) {
          console.error('❌ [FRONTEND] localStorage QUOTA ERROR:', quotaErr);
          throw new Error('localStorage quota exceeded: ' + quotaErr.message);
        }
        
        // Check if values persist
        console.log('⏱️ [FRONTEND] Testing persistence after 100ms...');
        setTimeout(() => {
          const persistAccess = localStorage.getItem('access_token');
          const persistRefresh = localStorage.getItem('refresh_token');
          const persistUser = localStorage.getItem('user');
          
          console.log('⏱️ [FRONTEND] Persistence check:');
          console.log('   - access_token persists:', !!persistAccess);
          console.log('   - refresh_token persists:', !!persistRefresh);
          console.log('   - user persists:', !!persistUser);
          
          if (!persistAccess || !persistRefresh || !persistUser) {
            console.error('🚨 [FRONTEND] TOKENS NOT PERSISTING IN LOCALSTORAGE!');
          }
        }, 100);
        
      } catch (storageError) {
        console.error('❌ [FRONTEND] localStorage.setItem CRITICAL ERROR:');
        console.error('   - Error type:', storageError.name);
        console.error('   - Error message:', storageError.message);
        console.error('   - Error stack:', storageError.stack);
        console.error('   - localStorage available:', !!window.localStorage);
        console.error('   - localStorage quota:', (() => {
          try {
            const test = 'x'.repeat(1000000); // 1MB test
            localStorage.setItem('quota_test', test);
            localStorage.removeItem('quota_test');
            return 'OK';
          } catch (e) {
            return e.message;
          }
        })());
        throw new Error('Failed to save authentication data: ' + storageError.message);
      }
      
      console.log('⚡ [FRONTEND] Setting user state...');
      setUser(user);
      
      console.log('🔄 [FRONTEND] Setting up token refresh...');  
      setupTokenRefresh();
      
      console.log('✅ [FRONTEND] === LOGIN SUCCESS ===');
      return user;
      
    } catch (error) {
      console.error('❌ [FRONTEND] === LOGIN ERROR ===');
      console.error('❌ [FRONTEND] Error message:', error.message);
      console.error('❌ [FRONTEND] Error stack:', error.stack);
      if (error.response) {
        console.error('❌ [FRONTEND] Response status:', error.response.status);
        console.error('❌ [FRONTEND] Response data:', error.response.data);
      }
      throw error;
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    
    // Clear timeout
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      setRefreshTimeout(null);
    }
    
    // Try to logout on server (invalidate session) - only for new system
    if (refreshToken) {
      try {
        await api.post('/logout', { refresh_token: refreshToken });
        console.log('✅ Server session invalidated');
      } catch (err) {
        console.warn('⚠️ Logout request failed:', err);
      }
    }
    
    // Clear all possible storage keys (both old and new)
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token'); // Legacy
    localStorage.removeItem('user');
    setUser(null);
    
    console.log('🚪 Logout complete');
  };

  const hasRole = (...roles) => user && roles.includes(user.role);
  const isAdmin = () => hasRole('super_admin', 'admin');
  const isSuperAdmin = () => hasRole('super_admin');

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      loading, 
      hasRole, 
      isAdmin, 
      isSuperAdmin,
      refreshAccessToken, // Expose for manual refresh if needed
      trialExpired,
      setTrialExpired,
      checkTrialStatus  
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
