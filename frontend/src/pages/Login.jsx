import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import Icon from '../components/Icon';
import { getHomePath } from '../utils/navigation.mjs';

const BENEFITS = [
  ['point_of_sale', 'Transaksi cepat untuk kasir'],
  ['inventory_2', 'Stok, harga, dan laporan terkendali'],
  ['build', 'Jasa & sparepart dalam satu nota'],
  ['wifi_off', 'Tetap bekerja tanpa internet'],
];

export default function Login() {
  const { login } = useAuth();
  const { t, toggleLang, toggleTheme, isDark } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.username || !form.password) {
      toast.error('Username dan password wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      toast.success(`Selamat datang, ${user.username}!`);
      navigate(getHomePath(user.role));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Username atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rapipos-login">
      <section className="rapipos-login__brand" aria-label="Tentang RapiPos">
        <div className="rapipos-login__glow rapipos-login__glow--one" />
        <div className="rapipos-login__glow rapipos-login__glow--two" />
        <div className="rapipos-login__brand-inner">
          <div className="rapipos-login__mark">R</div>
          <p className="rapipos-login__eyebrow">RapiPos · Offline first</p>
          <h1>Kasir, stok, dan usaha lebih rapi.</h1>
          <p className="rapipos-login__lead">Satu tempat yang tenang untuk melayani pelanggan, mengelola persediaan, dan memantau usaha Anda.</p>
          <div className="rapipos-login__benefits">
            {BENEFITS.map(([icon, label]) => <div key={icon} className="rapipos-login__benefit"><Icon name={icon} size={18} color="#bfeee0" /><span>{label}</span></div>)}
          </div>
          <div className="rapipos-login__offline-note"><span className="rapipos-login__status-dot" />Data tersimpan lokal dan siap dipakai di jaringan toko.</div>
        </div>
      </section>

      <section className="rapipos-login__panel">
        <div className="rapipos-login__toolbar">
          <button type="button" className="rapipos-login__tool" onClick={toggleLang}><Icon name="language" size={16} /> {t('lang.toggle')}</button>
          <button type="button" className="rapipos-login__tool rapipos-login__tool--icon" onClick={toggleTheme} title={isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap'}><Icon name={isDark ? 'light_mode' : 'dark_mode'} size={17} /></button>
        </div>

        <form className="rapipos-login__form" onSubmit={handleSubmit} noValidate>
          <div className="rapipos-login__heading">
            <div className="rapipos-login__mobile-brand"><span>R</span> RapiPos</div>
            <p className="rapipos-login__eyebrow rapipos-login__eyebrow--panel">AKSES AMAN</p>
            <h2>Masuk ke ruang kerja</h2>
            <p>Gunakan akun yang diberikan pemilik toko atau administrator.</p>
          </div>

          <label className="rapipos-login__field"><span>Username</span><div><Icon name="person" size={18} /><input className="input" type="text" placeholder={t('auth.username')} value={form.username} onChange={event => setForm(current => ({ ...current, username: event.target.value }))} autoComplete="username" autoFocus /></div></label>
          <label className="rapipos-login__field"><span>Password</span><div><Icon name="lock" size={18} /><input className="input" type={showPass ? 'text' : 'password'} placeholder={t('auth.password')} value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} autoComplete="current-password" /><button type="button" onClick={() => setShowPass(value => !value)} aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}><Icon name={showPass ? 'visibility_off' : 'visibility'} size={18} /></button></div></label>

          <button type="submit" className="btn btn-primary btn-lg w-full rapipos-login__submit" disabled={loading}>{loading ? <span className="spinner" style={{ width: 19, height: 19, borderWidth: 2 }} /> : <><Icon name="login" size={18} /> Masuk ke RapiPos</>}</button>
          <div className="rapipos-login__hint"><Icon name="shield" size={16} /><span>Login awal: <strong>admin</strong>. Password diatur melalui <code>INITIAL_ADMIN_PASSWORD</code>.</span></div>
        </form>
      </section>

      <style>{`
        .rapipos-login { min-height:100dvh; display:grid; grid-template-columns:minmax(360px, 47%) 1fr; background:var(--surface); }
        .rapipos-login__brand { position:relative; overflow:hidden; padding:clamp(42px,7vw,96px); display:flex; align-items:center; background:linear-gradient(145deg,#082b25 0%,#0e4b42 56%,#08766a 115%); color:#fff; }
        .rapipos-login__glow { position:absolute; border-radius:50%; filter:blur(2px); pointer-events:none; }
        .rapipos-login__glow--one { width:390px; height:390px; right:-170px; top:-120px; background:rgba(129,216,197,.17); }
        .rapipos-login__glow--two { width:300px; height:300px; left:-140px; bottom:-160px; background:rgba(255,183,136,.12); }
        .rapipos-login__brand-inner { position:relative; z-index:1; max-width:430px; }
        .rapipos-login__mark { width:58px; height:58px; border-radius:18px; display:grid; place-items:center; color:#fff; font:800 28px 'Manrope',sans-serif; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2); box-shadow:inset 0 1px rgba(255,255,255,.16); }
        .rapipos-login__eyebrow { margin-top:24px; color:#bfeee0; font-size:10px; line-height:1; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
        .rapipos-login__brand h1 { max-width:430px; margin:14px 0; font:800 clamp(34px,4vw,50px)/1.05 'Manrope',sans-serif; letter-spacing:-.05em; }
        .rapipos-login__lead { color:rgba(255,255,255,.72); max-width:390px; font-size:15px; line-height:1.65; }
        .rapipos-login__benefits { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:34px; }
        .rapipos-login__benefit { display:flex; align-items:center; gap:10px; padding:12px; color:rgba(255,255,255,.86); font-size:12px; font-weight:600; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:rgba(5,40,34,.16); }
        .rapipos-login__offline-note { display:flex; align-items:center; gap:8px; margin-top:28px; color:rgba(255,255,255,.62); font-size:12px; }
        .rapipos-login__status-dot { width:7px; height:7px; border-radius:50%; background:#a7e8c3; box-shadow:0 0 0 4px rgba(167,232,195,.12); }
        .rapipos-login__panel { min-width:0; padding:30px clamp(24px,7vw,120px) 46px; display:flex; flex-direction:column; justify-content:center; }
        .rapipos-login__toolbar { position:absolute; top:24px; right:28px; display:flex; gap:8px; }
        .rapipos-login__tool { display:inline-flex; align-items:center; gap:6px; min-height:34px; padding:0 11px; border:1px solid var(--outline-variant); border-radius:10px; background:var(--surface-container-lowest); color:var(--on-surface-variant); font:600 12px 'Inter',sans-serif; cursor:pointer; }
        .rapipos-login__tool--icon { width:34px; justify-content:center; padding:0; }
        .rapipos-login__form { width:100%; max-width:404px; margin:0 auto; }
        .rapipos-login__heading h2 { margin:9px 0 7px; color:var(--on-surface); font:800 28px/1.1 'Manrope',sans-serif; letter-spacing:-.04em; }
        .rapipos-login__heading p:last-child { color:var(--on-surface-variant); font-size:13.5px; line-height:1.55; }
        .rapipos-login__eyebrow--panel { margin-top:0; color:var(--primary); }
        .rapipos-login__mobile-brand { display:none; align-items:center; gap:8px; color:var(--on-surface); font:800 17px 'Manrope',sans-serif; }
        .rapipos-login__mobile-brand span { width:28px; height:28px; display:grid; place-items:center; border-radius:9px; color:#fff; background:var(--primary); font-size:15px; }
        .rapipos-login__field { display:block; margin-top:22px; color:var(--on-surface-variant); font-size:12px; font-weight:700; }
        .rapipos-login__field > span { display:block; margin-bottom:7px; }
        .rapipos-login__field > div { position:relative; }
        .rapipos-login__field svg { position:absolute; top:13px; left:14px; color:var(--outline); pointer-events:none; }
        .rapipos-login__field .input { padding-left:42px; min-height:46px; }
        .rapipos-login__field button { position:absolute; right:10px; top:8px; display:grid; place-items:center; width:30px; height:30px; border:0; border-radius:8px; background:transparent; color:var(--outline); cursor:pointer; }
        .rapipos-login__field button svg { position:static; }
        .rapipos-login__submit { margin-top:28px; border-radius:12px; }
        .rapipos-login__hint { display:flex; align-items:flex-start; gap:9px; margin-top:20px; padding:12px; border:1px dashed var(--outline-variant); border-radius:12px; background:var(--surface-container-low); color:var(--on-surface-variant); font-size:11px; line-height:1.5; }
        .rapipos-login__hint svg { flex:0 0 auto; margin-top:1px; color:var(--primary); }
        .rapipos-login__hint strong { color:var(--primary); }
        .rapipos-login__hint code { font-size:10px; overflow-wrap:anywhere; }
        @media (max-width:820px) { .rapipos-login { grid-template-columns:1fr; } .rapipos-login__brand { display:none; } .rapipos-login__panel { min-height:100dvh; padding:84px 22px 36px; } .rapipos-login__mobile-brand { display:flex; margin-bottom:34px; } .rapipos-login__toolbar { top:20px; right:18px; } }
        @media (max-width:420px) { .rapipos-login__panel { padding-left:18px; padding-right:18px; } }
      `}</style>
    </main>
  );
}
