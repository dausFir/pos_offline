import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import ServerStatus from './ServerStatus';
import GlobalSearch from './GlobalSearch';
import Icon from './Icon';
import TrialBanner from './TrialBanner';
import toast from 'react-hot-toast';

const NAV_SECTIONS = [
  {
    tk: 'nav.main',
    items: [
      { to: '/pos',             icon: 'point_of_sale',  tk: 'nav.pos',         always: true },
      { to: '/dashboard',       icon: 'dashboard',       tk: 'nav.dashboard',   adminOnly: true },
    ]
  },
  {
    tk: 'nav.inventory',
    items: [
      { to: '/products',        icon: 'inventory_2',     tk: 'nav.products',    adminOnly: true },
      { to: '/products/import', icon: 'upload_file',     tk: 'nav.import_csv',  adminOnly: true },
      { to: '/stock',           icon: 'swap_horiz',      tk: 'nav.stock',       adminOnly: true },
      { to: '/suppliers',       icon: 'local_shipping',  tk: 'nav.suppliers',   adminOnly: true },
    ]
  },
  {
    tk: 'nav.sales',
    items: [
      { to: '/transactions',    icon: 'receipt_long',    tk: 'nav.transactions',adminOnly: true },
      { to: '/customers',       icon: 'group',           tk: 'nav.customers',   adminOnly: true },
      { to: '/discounts',       icon: 'sell',            tk: 'nav.discounts',   adminOnly: true },
    ]
  },
  {
    tk: 'nav.reports_sec',
    items: [
      { to: '/reports',         icon: 'analytics',       tk: 'nav.reports',     adminOnly: true },
      { to: '/reports/shift',   icon: 'people',          tk: 'nav.shift_report' },
    ]
  },
  {
    tk: 'nav.system',
    items: [
      { to: '/settings',        icon: 'settings',        tk: 'nav.settings',    adminOnly: true },
      { to: '/operations',      icon: 'shield',          tk: 'nav.operations',  superAdminOnly: true },
      { to: '/login-logs',      icon: 'manage_history',  tk: 'nav.login_logs',  adminOnly: true },
      { to: '/users',           icon: 'manage_accounts', tk: 'nav.users',       superAdminOnly: true },
    ]
  },
];

export default function Layout() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const { t, toggleLang, toggleTheme, isDark } = useI18n();
  const navigate = useNavigate();
  const [drawer, setDrawer]       = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPwaPrompt(e); };
    const installed = () => setPwaInstalled(true);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', installed); };
  }, []);

  const installPWA = async () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    const { outcome } = await pwaPrompt.userChoice;
    if (outcome === 'accepted') { setPwaPrompt(null); toast.success('App berhasil diinstall!'); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', cashier: t('nav.pos').includes('Cashier') ? 'Cashier' : 'Kasir' };

  const filterItems = (items) => items.filter(n => {
    if (n.superAdminOnly) return isSuperAdmin();
    if (n.adminOnly) return isAdmin();
    return true;
  });

  const linkClass = ({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`;

  const SidebarContent = ({ onClose = () => {} }) => (
    <>
      {NAV_SECTIONS.map(section => {
        const filtered = filterItems(section.items);
        if (filtered.length === 0) return null;
        return (
          <div key={section.tk} style={{ marginBottom: 4 }}>
            {isAdmin() && (
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '8px 12px 3px' }}>
                {t(section.tk)}
              </div>
            )}
            {filtered.map(({ to, icon, tk }) => (
              <NavLink key={to} to={to} className={linkClass} onClick={onClose}>
                <Icon name={icon} size={17} />
                <span className="nav-label">{t(tk)}</span>
              </NavLink>
            ))}
          </div>
        );
      })}
    </>
  );

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Icon name="storefront" size={20} color="#fff" />
          </div>
          <div>
            <div className="brand-name font-headline">Kasir UMKM</div>
            <div className="brand-sub">v3.1 · Offline</div>
          </div>
        </div>

        <div style={{ padding: '0 10px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <GlobalSearch />
          <ServerStatus />
        </div>

        <nav className="sidebar-nav">
          <SidebarContent />
        </nav>

        <div style={{ borderTop: '1px solid var(--outline-variant)', padding: '6px 10px' }}>
          {/* Dark mode toggle */}
          <button className="nav-item" onClick={toggleTheme} style={{ color: isDark ? 'var(--tertiary)' : 'var(--outline)', marginBottom: 2 }}>
            <Icon name={isDark ? 'light_mode' : 'dark_mode'} size={17} />
            <span className="nav-label">{isDark ? t('theme.light') : t('theme.dark')}</span>
          </button>
          {/* PWA Install */}
          {pwaPrompt && !pwaInstalled && (
            <button className="nav-item" onClick={installPWA}
              style={{ color: '#1a7a3c', background: 'rgba(26,122,60,.08)', marginBottom: 2 }}>
              <Icon name="download" size={17} />
              <span className="nav-label">Install di HP</span>
            </button>
          )}
          {/* Language toggle */}
          <button className="nav-item" onClick={toggleLang} style={{ color: 'var(--secondary)', marginBottom: 2 }}>
            <Icon name="language" size={17} />
            <span className="nav-label">{t('lang.toggle')}</span>
          </button>
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
              <div style={{ fontSize: 10, color: 'var(--outline)' }}>{ROLE_LABEL[user?.role] || user?.role}</div>
            </div>
          </NavLink>
          <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--outline)', width: '100%' }}>
            <Icon name="logout" size={17} />
            <span className="nav-label">{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="mobile-topbar">
        <button className="icon-btn" onClick={() => setDrawer(true)}>
          <Icon name="menu" size={22} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', padding: '0 8px' }}>
          <GlobalSearch />
        </div>
        <NavLink to="/profile" style={{ textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
        </NavLink>
      </header>

      {/* Drawer */}
      {drawer && (
        <div className="drawer-scrim" onClick={() => setDrawer(false)}>
          <aside className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="brand-icon" style={{ width: 32, height: 32 }}>
                  <Icon name="storefront" size={18} color="#fff" />
                </div>
                <span className="brand-name font-headline" style={{ fontSize: 14 }}>Kasir UMKM</span>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(false)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div style={{ padding: '4px 10px 6px' }}><ServerStatus /></div>
            <nav className="sidebar-nav" style={{ padding: '0 10px' }}>
              <SidebarContent onClose={() => setDrawer(false)} />
            </nav>
            <div style={{ borderTop: '1px solid var(--outline-variant)', padding: '6px 10px' }}>
              <button className="nav-item" onClick={toggleTheme} style={{ color: isDark ? 'var(--tertiary)' : 'var(--outline)' }}>
                <Icon name={isDark ? 'light_mode' : 'dark_mode'} size={17} />
                <span className="nav-label">{isDark ? t('theme.light') : t('theme.dark')}</span>
              </button>
              <button className="nav-item" onClick={() => { toggleLang(); }} style={{ color: 'var(--secondary)' }}>
                <Icon name="language" size={17} /><span className="nav-label">{t('lang.toggle')}</span>
              </button>
              <NavLink to="/profile" className={linkClass} onClick={() => setDrawer(false)}>
                <Icon name="manage_accounts" size={17} />{t('nav.profile')}
              </NavLink>
              <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--outline)', width: '100%' }}>
                <Icon name="logout" size={17} />{t('nav.logout')}
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="main-content"><TrialBanner /><Outlet /></main>

      <style>{`
        .app-shell { display: flex; min-height: 100dvh; background: var(--surface); }
        .sidebar { width: 228px; background: #f0f4fb; border-right: 1px solid var(--outline-variant); display: flex; flex-direction: column; padding: 0; position: fixed; top: 0; left: 0; bottom: 0; z-index: 30; }
        .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 16px 14px 12px; border-bottom: 1px solid var(--outline-variant); margin-bottom: 6px; }
        .brand-icon { width: 36px; height: 36px; background: var(--primary); border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,69,143,.25); }
        .brand-name { font-weight: 800; font-size: 14px; color: var(--primary); line-height: 1; }
        .brand-sub  { font-size: 9.5px; color: var(--outline); text-transform: uppercase; letter-spacing: .08em; margin-top: 2px; }
        .sidebar-nav { flex: 1; padding: 0 10px; display: flex; flex-direction: column; overflow-y: auto; }
        .nav-item { display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: 9px; color: var(--on-surface-variant); text-decoration: none; font-size: 13px; font-weight: 500; transition: all .12s ease; border: none; background: none; cursor: pointer; width: 100%; white-space: nowrap; }
        .nav-label { }
        .nav-item:hover { background: rgba(0,69,143,.07); color: var(--primary); }
        .nav-item--active { background: var(--primary-fixed); color: var(--primary); font-weight: 700; }
        .main-content { flex: 1; margin-left: 228px; min-height: 100dvh; background: var(--surface); }
        .mobile-topbar { display: none; position: fixed; top: 0; left: 0; right: 0; height: 54px; background: rgba(247,249,255,.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--outline-variant); padding: 0 14px; align-items: center; justify-content: space-between; z-index: 25; }
        .drawer-scrim { position: fixed; inset: 0; background: rgba(24,28,32,.4); backdrop-filter: blur(3px); z-index: 40; display: flex; }
        .drawer { width: 268px; height: 100%; background: #f0f4fb; border-right: 1px solid var(--outline-variant); display: flex; flex-direction: column; box-shadow: var(--shadow-3); animation: slideInLeft .2s cubic-bezier(.34,1.3,.64,1); }
        .drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 12px 10px; border-bottom: 1px solid var(--outline-variant); margin-bottom: 6px; }
        @keyframes slideInLeft { from { transform: translateX(-40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @media (max-width: 768px) { .sidebar { display: none; } .mobile-topbar { display: flex; } .main-content { margin-left: 0; padding-top: 54px; } }
      `}</style>
    </div>
  );
}
