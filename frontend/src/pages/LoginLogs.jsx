import { useState, useEffect } from 'react';
import api, { formatDate } from '../utils/api';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';

const fmt = (d) => d ? new Date(d).toLocaleString('id-ID') : '-';
const ua2short = (ua) => {
  if (!ua) return '-';
  if (/iPhone|iPad/.test(ua)) return '📱 iOS';
  if (/Android/.test(ua)) return '📱 Android';
  if (/Windows/.test(ua)) return '🖥️ Windows';
  if (/Macintosh/.test(ua)) return '🍎 Mac';
  if (/Linux/.test(ua)) return '🐧 Linux';
  return ua.slice(0, 30);
};

export default function LoginLogs() {
  const { t } = useI18n();
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit,   setLimit]   = useState(50);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/login-logs', { params: { limit } });
      setLogs(res.data.data || []);
    } catch { toast.error('Gagal memuat log login'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [limit]);

  const success = logs.filter(l => l.status === 'success').length;
  const failed  = logs.filter(l => l.status === 'failed').length;

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">Riwayat Login</h1>
          <p className="page-subtitle">Audit trail akses masuk ke sistem</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="input" style={{ width: 130 }} value={limit} onChange={e => setLimit(+e.target.value)}>
            {[20,50,100,200].map(n => <option key={n} value={n}>Tampilkan {n}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={fetch}>
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ padding: '8px 16px', background: '#d4f4e1', borderRadius: 100, fontSize: 13, fontWeight: 700, color: '#1a7a3c', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="check_circle" size={15} />
          {success} Login Berhasil
        </div>
        <div style={{ padding: '8px 16px', background: 'var(--error-container)', borderRadius: 100, fontSize: 13, fontWeight: 700, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="cancel" size={15} />
          {failed} Login Gagal
        </div>
        {failed > 3 && (
          <div style={{ padding: '8px 16px', background: '#fff3cd', borderRadius: 100, fontSize: 13, fontWeight: 700, color: '#92600a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="warning" size={15} />
            Banyak percobaan gagal — periksa keamanan!
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Username</th>
                <th>Status</th>
                <th>IP Address</th>
                <th>Perangkat</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <Icon name="login" size={18} />
                    <h3>Belum ada log login</h3>
                  </div>
                </td></tr>
              ) : logs.map(l => (
                <tr key={l.id} style={{ background: l.status === 'failed' ? 'rgba(186,26,26,.03)' : 'transparent' }}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--on-surface-variant)' }}>{fmt(l.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{l.username}</td>
                  <td>
                    <span className={`badge ${l.status === 'success' ? 'badge-green' : 'badge-red'}`}>
                      {l.status === 'success' ? '✓ Berhasil' : '✗ Gagal'}
                    </span>
                  </td>
                  <td><code style={{ fontSize: 11, background: 'var(--surface-container)', padding: '2px 6px', borderRadius: 4 }}>{l.ip_address || '-'}</code></td>
                  <td style={{ fontSize: 12 }}>{ua2short(l.user_agent)}</td>
                  <td style={{ fontSize: 12, color: l.status === 'failed' ? 'var(--error)' : 'var(--outline)' }}>{l.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
