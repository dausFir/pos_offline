import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';

const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', cashier: 'Kasir' };
const ROLE_COLOR = { super_admin: 'badge-blue', admin: 'badge-teal', cashier: 'badge-green' };

export default function Profile() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [showCurr, setShowCurr] = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  const strength = (p) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6)  s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const pw = form.new_password;
  const str = strength(pw);
  const strLabel = ['', 'Sangat Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'][str];
  const strColor = ['', '#ba1a1a', '#e85d24', '#92600a', '#1a7a3c', '#006a6a'][str];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('Konfirmasi password tidak cocok'); return;
    }
    if (form.new_password.length < 6) {
      toast.error('Password baru minimal 6 karakter'); return;
    }
    setLoading(true);
    try {
      await api.post('/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success('Password berhasil diubah! Silakan login ulang.');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mengubah password');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">{t("nav.profile")}</h1>
          <p className="page-subtitle">Kelola informasi akun dan keamanan</p>
        </div>
      </div>

      {/* User info card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--outline-variant)' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, fontFamily: 'Manrope, sans-serif' }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-headline" style={{ fontSize: 20, fontWeight: 800 }}>{user?.username}</div>
            <span className={`badge ${ROLE_COLOR[user?.role] || 'badge-blue'}`} style={{ marginTop: 4, display: 'inline-flex' }}>
              {ROLE_LABEL[user?.role] || user?.role}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Username', value: user?.username },
            { label: 'Role Akses', value: ROLE_LABEL[user?.role] || user?.role },
          ].map(r => (
            <div key={r.label} style={{ background: 'var(--surface-container-low)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{r.label}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--outline-variant)' }}>
          <Icon name="lock_reset" size={20} color="var(--primary)" />
          <div>
            <p className="font-headline" style={{ fontWeight: 700, fontSize: 15 }}>Ubah Password</p>
            <p style={{ fontSize: 12, color: 'var(--outline)', marginTop: 2 }}>Ganti password secara berkala untuk keamanan akun</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current password */}
          <div className="input-group">
            <label className="input-label">Password Saat Ini *</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showCurr ? 'text' : 'password'}
                placeholder="Masukkan password saat ini"
                value={form.current_password}
                onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} />
              <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--outline)', display: 'flex' }}
                onClick={() => setShowCurr(v => !v)}>
                <Icon name={showCurr ? "visibility_off" : "visibility"} size={18} />
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="input-group">
            <label className="input-label">Password Baru * (min. 6 karakter)</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showNew ? 'text' : 'password'}
                placeholder="Masukkan password baru"
                value={form.new_password}
                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} />
              <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--outline)', display: 'flex' }}
                onClick={() => setShowNew(v => !v)}>
                <Icon name={showNew ? "visibility_off" : "visibility"} size={18} />
              </button>
            </div>
            {/* Strength bar */}
            {pw && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-container)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(str/5)*100}%`, background: strColor, borderRadius: 4, transition: 'all .2s' }} />
                </div>
                <p style={{ fontSize: 11, color: strColor, marginTop: 4, fontWeight: 600 }}>{strLabel}</p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="input-group">
            <label className="input-label">Konfirmasi Password Baru *</label>
            <input className="input" type="password"
              placeholder="Ketik ulang password baru"
              value={form.confirm_password}
              onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))} />
            {form.confirm_password && form.new_password !== form.confirm_password && (
              <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>❌ Password tidak cocok</p>
            )}
            {form.confirm_password && form.new_password === form.confirm_password && (
              <p style={{ fontSize: 12, color: '#1a7a3c', marginTop: 4 }}>✓ Password cocok</p>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || !form.current_password || !form.new_password || form.new_password !== form.confirm_password}
            style={{ alignSelf: 'flex-start', minWidth: 160 }}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : <><Icon name="save" size={16} /> Simpan Password</>}
          </button>
        </form>
      </div>
    </div>
  );
}
