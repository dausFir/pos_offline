import axios from 'axios';

const BASE_URL = window.location.origin;

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
});

// Flag to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

api.interceptors.request.use((config) => {
  console.log('🌐 [API] === REQUEST INTERCEPTOR ===');
  console.log('🌐 [API] URL:', config.url);
  console.log('🌐 [API] Method:', config.method);
  
  // Try new token format first
  let token = localStorage.getItem('access_token');
  console.log('🔑 [API] Checking access_token from localStorage...');
  console.log('   - access_token exists:', !!token);
  console.log('   - access_token length:', token?.length || 0);
  console.log('   - access_token preview:', token?.substring(0,30) || 'MISSING');
  
  // Fallback to old token format for backward compatibility
  if (!token) {
    token = localStorage.getItem('token');
    console.log('🔑 [API] Fallback to old token format...');
    console.log('   - old token exists:', !!token);
    console.log('   - old token length:', token?.length || 0);
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ [API] Authorization header set');
    console.log('📤 [API] Final headers:', config.headers);
  } else {
    console.log('❌ [API] NO TOKEN FOUND - Request will be unauthorized!');
    console.log('🔍 [API] Full localStorage dump:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      console.log(`   - ${key}:`, localStorage.getItem(key)?.substring(0,50) || 'empty');
    }
  }
  
  return config;
});

api.interceptors.response.use(
  (res) => {
    console.log('📤 [API] Response received:', {
      url: res.config.url,
      status: res.status,
      data: res.data
    });
    return res;
  },
  async (err) => {
    console.log('❌ [API] Response error:', {
      url: err.config?.url,
      status: err.response?.status,
      message: err.message,
      data: err.response?.data
    });
    
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      console.log('🔄 [API] Attempting token refresh...');
      
      if (isRefreshing) {
        console.log('⏳ [API] Refresh already in progress, queuing request...');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = 'Bearer ' + token;
          return api(original);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        // No refresh token available - fallback to old logout behavior
        console.log('🔒 [API] No refresh token, using legacy logout');
        processQueue(err, null);
        logoutLegacy();
        return Promise.reject(err);
      }

      try {
        console.log('🔄 [API] Sending refresh request...');
        const res = await axios.post(`${BASE_URL}/api/refresh-token`, {
          refresh_token: refreshToken
        });
        
        const { access_token, refresh_token: newRefreshToken } = res.data.data;
        console.log('✅ [API] Token refresh successful');
        
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', newRefreshToken);
        
        api.defaults.headers.common['Authorization'] = 'Bearer ' + access_token;
        processQueue(null, access_token);
        
        return api(original);
      } catch (refreshError) {
        console.error('❌ [API] Token refresh failed:', refreshError);
        processQueue(refreshError, null);
        logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

const logoutLegacy = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export default api;

export const formatRupiah = (num) => {
  if (!num && num !== 0) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const formatDateOnly = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};
