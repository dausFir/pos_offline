import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useI18n } from '../context/I18nContext';
import Icon from '../components/Icon';
import api from '../utils/api';

export default function Login() {
  const { login } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ username: '', password: '' });
  const [showPass, setShow] = useState(false);
  const [loading, setLoad]  = useState(false);
  const [trialInfo, setTrialInfo] = useState(null);

  // Get trial information on component mount
  useEffect(() => {
    const getTrialInfo = async () => {
      try {
        const res = await api.get('/api/settings');
        if (res.data.success && res.data.data.is_trial_version) {
          setTrialInfo(res.data.data);
        }
      } catch (err) {
        // Ignore errors, just don't show trial info
        console.log('Failed to get trial info:', err);
      }
    };
    getTrialInfo();
  }, []);

  const handleSubmit = async (e) => {
    // PREVENT DEFAULT IMMEDIATELY 
    e.preventDefault();
    e.stopPropagation();
    
    if (!form.username || !form.password) { 
      toast.error('Username dan password wajib diisi'); 
      return false;
    }
    
    setLoad(true);
    
    try {
      const user = await login(form.username, form.password);
      
      // Verify localStorage before navigation
      const storedAccess = localStorage.getItem('access_token');
      const storedRefresh = localStorage.getItem('refresh_token');
      const storedUser = localStorage.getItem('user');
      
      if (!storedAccess || !storedRefresh || !storedUser) {
        toast.error('Login berhasil tapi token tidak tersimpan. Coba lagi.');
        return false;
      }
      
      toast.success(`Selamat datang, ${user.username}!`);
      navigate('/pos');
      
    } catch (err) {
      toast.error(err.response?.data?.error || 'Username atau password salah');
    } finally { 
      setLoad(false); 
    }
    
    return false; // Extra insurance against form submission
  };

  return (
    <div className="login-page">
      {/* Left panel — branding */}
      <div className="login-left">
        <div className="login-left-inner">
          <div className="login-logo">
            <Icon name="storefront" size={36} color="#fff" />
          </div>
          <h1 className="font-headline" style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '20px 0 10px', lineHeight: 1.1 }}>
            Kasir &amp; Manajemen<br />Gudang UMKM
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.6, maxWidth: 320 }}>
            Sistem kasir offline-first untuk toko Anda. Cepat, andal, dan bekerja tanpa internet.
          </p>
          <div className="login-features">
            {[
              ['point_of_sale', 'Kasir mobile-friendly'],
              ['inventory_2', 'Manajemen stok lengkap'],
              ['receipt_long', 'Laporan & struk termal'],
              ['wifi_off', '100% offline — jaringan lokal'],
            ].map(([icon, text]) => (
              <div key={icon} className="login-feature-item">
                <Icon name={icon} size={18} color="rgba(255,255,255,.85)" filled />
                <span style={{ color: 'rgba(255,255,255,.85)', fontSize: 14 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-right">
        {/* Language toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button type="button" onClick={toggleLang}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 100, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Icon name="language" size={15} color="rgba(255,255,255,.85)" />
            {t('lang.toggle')}
          </button>
        </div>
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 32 }}>
            <h2 className="font-headline" style={{ fontSize: 24, fontWeight: 800, color: 'var(--on-surface)', marginBottom: 6 }}>
              Masuk ke Sistem
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--on-surface-variant)' }}>
              Masukkan kredensial akun Anda untuk melanjutkan
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="input-group">
              <label className="input-label">Username</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display:'flex' }}><Icon name="person" size={18} color="var(--outline)" /></span>
                <input className="input" style={{ paddingLeft: 40 }} type="text"
                  placeholder={t('auth.username')} value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  autoComplete="username" autoFocus 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display:'flex' }}><Icon name="lock" size={18} color="var(--outline)" /></span>
                <input className="input" style={{ paddingLeft: 40, paddingRight: 44 }}
                  type={showPass ? 'text' : 'password'}
                  placeholder={t('auth.password')} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="current-password" 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }} />
                <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--outline)', display: 'flex', alignItems: 'center' }}
                  onClick={() => setShow(v => !v)}>
                  <Icon name={showPass ? "visibility_off" : "visibility"} size={18} />
                </button>
              </div>
            </div>

            <button 
              type="button" 
              className="btn btn-primary btn-lg w-full" 
              disabled={loading}
              onClick={(e) => {

                e.preventDefault();
                e.stopPropagation();
                handleSubmit(e);
              }}
              style={{ marginTop: 4, boxShadow: '0 4px 16px rgba(0,69,143,.3)' }}>
              {loading
                ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                : <>
                    <Icon name="login" size={18} />
                    Masuk
                  </>
              }
            </button>
          </div>

          <div style={{ marginTop: 24, padding: '12px 14px', background: 'var(--surface-container-low)', borderRadius: 10, border: '1px dashed var(--outline-variant)', fontSize: 13, color: 'var(--on-surface-variant)', textAlign: 'center' }}>
            Login default: <strong style={{ color: 'var(--primary)' }}>admin</strong> / <strong style={{ color: 'var(--primary)' }}>admin123</strong>
          </div>

          {/* Trial version notification */}
          {trialInfo?.is_trial_version && (
            <div style={{ 
              marginTop: 16, 
              padding: '14px 16px', 
              background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
              borderRadius: 10, 
              border: '1px solid #f39c12',
              borderLeft: '4px solid #f39c12',
              fontSize: 13
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon name="schedule" size={16} color="#d68910" />
                <strong style={{ color: '#d68910', fontSize: 14 }}>VERSI TRIAL</strong>
              </div>
              <div style={{ color: '#856404', lineHeight: 1.4 }}>
                {trialInfo.is_trial_expired ? (
                  <div style={{ color: '#dc3545' }}>
                    <strong>Trial telah berakhir.</strong> Hubungi kami untuk upgrade ke versi penuh.
                  </div>
                ) : (
                  <div>
                    Sisa waktu: <strong>{trialInfo.trial_days_left} hari</strong><br />
                    Sudah digunakan: <strong>{trialInfo.trial_usage_stats?.days_used || 0} hari</strong><br />
                    Batas produk: <strong>{trialInfo.max_products} produk</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      <style>{`
        .login-page {
          min-height: 100dvh; display: flex;
          background: var(--surface);
        }
        .login-left {
          width: 420px; flex-shrink: 0;
          background: linear-gradient(145deg, #003a80 0%, #0057b3 50%, #005cbb 100%);
          display: flex; align-items: center; justify-content: center;
          padding: 48px 40px;
          position: relative; overflow: hidden;
        }
        .login-left::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(circle at 80% 20%, rgba(171,199,255,.12) 0%, transparent 60%),
                      radial-gradient(circle at 20% 80%, rgba(157,238,237,.08) 0%, transparent 60%);
        }
        .login-left-inner { position: relative; z-index: 1; }
        .login-logo {
          width: 64px; height: 64px;
          background: rgba(255,255,255,.15);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid rgba(255,255,255,.25);
          backdrop-filter: blur(8px);
        }
        .login-features { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }
        .login-feature-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          background: rgba(255,255,255,.08);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.1);
        }
        .login-right {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 40px 24px;
          background: var(--surface);
        }
        .login-form {
          width: 100%; max-width: 400px;
        }
        @media (max-width: 768px) {
          .login-left { display: none; }
          .login-right { padding: 32px 20px; }
          .login-form { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
