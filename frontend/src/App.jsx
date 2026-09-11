import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import Layout from './components/Layout';
import { getHomePath } from './utils/navigation.mjs';

const Login = lazy(() => import('./pages/Login'));
const POS = lazy(() => import('./pages/POS'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Users = lazy(() => import('./pages/Users'));
const StockMutations = lazy(() => import('./pages/StockMutations'));
const Discounts = lazy(() => import('./pages/Discounts'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));
const LoginLogs = lazy(() => import('./pages/LoginLogs'));
const Profile = lazy(() => import('./pages/Profile'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const ShiftReport = lazy(() => import('./pages/ShiftReport'));
const ImportProducts = lazy(() => import('./pages/ImportProducts'));
const Operations = lazy(() => import('./pages/Operations'));
const ServiceOrders = lazy(() => import('./pages/ServiceOrders'));
const AccountingControls = lazy(() => import('./pages/AccountingControls'));

function PageLoader() {
  return <div className="loading-screen" aria-label="Memuat halaman"><div className="spinner" /></div>;
}

function Guard({ children, adminOnly = false, superAdminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (superAdminOnly && user.role !== 'super_admin') return <Navigate to="/pos" replace />;
  if (adminOnly && !['super_admin', 'admin'].includes(user.role)) return <Navigate to="/pos" replace />;

  return children;
}

function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={getHomePath(user?.role)} replace />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={getHomePath(user.role)} replace /> : <Login />} />
        <Route path="/" element={<Guard><Layout /></Guard>}>
          <Route index element={<RoleHome />} />
          <Route path="pos" element={<POS />} />
          <Route path="profile" element={<Profile />} />
          <Route path="dashboard" element={<Guard adminOnly><Dashboard /></Guard>} />
          <Route path="products" element={<Guard adminOnly><Products /></Guard>} />
          <Route path="products/import" element={<Guard adminOnly><ImportProducts /></Guard>} />
          <Route path="stock" element={<Guard adminOnly><StockMutations /></Guard>} />
          <Route path="transactions" element={<Guard adminOnly><Transactions /></Guard>} />
          <Route path="reports" element={<Guard adminOnly><Reports /></Guard>} />
          <Route path="reports/shift" element={<Guard><ShiftReport /></Guard>} />
          <Route path="accounting" element={<Guard adminOnly><AccountingControls /></Guard>} />
          <Route path="customers" element={<Guard adminOnly><Customers /></Guard>} />
          <Route path="service-orders" element={<Guard><ServiceOrders /></Guard>} />
          <Route path="suppliers" element={<Guard adminOnly><Suppliers /></Guard>} />
          <Route path="discounts" element={<Guard adminOnly><Discounts /></Guard>} />
          <Route path="settings" element={<Guard adminOnly><Settings /></Guard>} />
          <Route path="login-logs" element={<Guard adminOnly><LoginLogs /></Guard>} />
          <Route path="users" element={<Guard adminOnly><Users /></Guard>} />
          <Route path="operations" element={<Guard superAdminOnly><Operations /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'var(--surface-container-lowest)',
                color: 'var(--on-surface)',
                borderRadius: '12px',
                border: '1px solid var(--outline-variant)',
                fontSize: '14px',
                boxShadow: 'var(--shadow-2)',
                fontFamily: "'Inter', sans-serif",
              },
              success: { iconTheme: { primary: 'var(--secondary)', secondary: 'var(--on-secondary)' } },
              error: { iconTheme: { primary: 'var(--error)', secondary: 'var(--on-error)' }, duration: 5000 },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
