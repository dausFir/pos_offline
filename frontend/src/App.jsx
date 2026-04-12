import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import Login          from './pages/Login';
import POS            from './pages/POS';
import Dashboard      from './pages/Dashboard';
import Products       from './pages/Products';
import Transactions   from './pages/Transactions';
import Users          from './pages/Users';
import StockMutations from './pages/StockMutations';
import Discounts      from './pages/Discounts';
import Settings       from './pages/Settings';
import Reports        from './pages/Reports';
import LoginLogs      from './pages/LoginLogs';
import Profile        from './pages/Profile';
import Customers      from './pages/Customers';
import Suppliers      from './pages/Suppliers';
import ShiftReport    from './pages/ShiftReport';
import ImportProducts from './pages/ImportProducts';
import Layout         from './components/Layout';

function Guard({ children, adminOnly = false, superAdminOnly = false }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (superAdminOnly && user.role !== 'super_admin') {
    return <Navigate to="/pos" replace />;
  }
  
  if (adminOnly && !['super_admin','admin'].includes(user.role)) {
    return <Navigate to="/pos" replace />;
  }
  
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  console.log('  - user exists:', !!user);
  console.log('  - user role:', user?.role);
  console.log('  - loading:', loading);
  console.log('  - current location:', window.location.pathname);
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Guard><Layout /></Guard>}>
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="pos"             element={<POS />} />
        <Route path="profile"         element={<Profile />} />
        <Route path="dashboard"       element={<Guard adminOnly><Dashboard /></Guard>} />
        <Route path="products"        element={<Guard adminOnly><Products /></Guard>} />
        <Route path="products/import" element={<Guard adminOnly><ImportProducts /></Guard>} />
        <Route path="stock"           element={<Guard adminOnly><StockMutations /></Guard>} />
        <Route path="transactions"    element={<Guard adminOnly><Transactions /></Guard>} />
        <Route path="reports"         element={<Guard adminOnly><Reports /></Guard>} />
        <Route path="reports/shift"   element={<Guard adminOnly><ShiftReport /></Guard>} />
        <Route path="customers"       element={<Guard adminOnly><Customers /></Guard>} />
        <Route path="suppliers"       element={<Guard adminOnly><Suppliers /></Guard>} />
        <Route path="discounts"       element={<Guard adminOnly><Discounts /></Guard>} />
        <Route path="settings"        element={<Guard adminOnly><Settings /></Guard>} />
        <Route path="login-logs"      element={<Guard adminOnly><LoginLogs /></Guard>} />
        <Route path="users"           element={<Guard adminOnly><Users /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // Safety mechanism to prevent infinite refresh loops
  const preventInfiniteLoop = () => {
    const refreshCount = sessionStorage.getItem('refresh_count') || 0;
    const newCount = parseInt(refreshCount) + 1;
    
    if (newCount > 5) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
      return;
    }
    
    sessionStorage.setItem('refresh_count', newCount);
    
    // Clear refresh count after successful load
    setTimeout(() => {
      sessionStorage.removeItem('refresh_count');
    }, 5000);
  };
  
  preventInfiniteLoop();
  
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-center" toastOptions={{
            style: {
              background: '#ffffff', color: '#181c20',
              borderRadius: '12px', border: '1px solid #c2c6d4',
              fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              fontFamily: "'Inter', sans-serif",
            },
            success: { iconTheme: { primary: '#1a7a3c', secondary: '#ffffff' } },
            error:   { iconTheme: { primary: '#ba1a1a', secondary: '#ffffff' }, duration: 5000 },
          }} />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
