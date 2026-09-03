import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function TrialBanner() {
  const { isSuperAdmin } = useAuth();
  const [status, setStatus] = useState(null);

  const load = async () => {
    try { setStatus((await api.get('/license/status')).data.data); } catch { /* API errors are handled centrally */ }
  };
  useEffect(() => { load(); }, []);
  if (!status || status.licensed) return null;

  const activate = async () => {
    const token = window.prompt('Masukkan token lisensi dari penerbit:');
    if (!token) return;
    try {
      await api.post('/license/activate', { token });
      toast.success('Lisensi aktif. Memuat ulang aplikasi…');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) { toast.error(err.response?.data?.error || 'Lisensi tidak dapat diaktifkan'); }
  };

  const expired = status.expired;
  return <div style={{ margin: '16px 24px 0', padding: '12px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: expired ? '#ffebee' : '#fff8e1', border: `1px solid ${expired ? '#ef9a9a' : '#ffe082'}`, color: expired ? '#b71c1c' : '#795548' }}>
    <span><strong>{expired ? 'Trial berakhir.' : `Trial: ${status.days_remaining} hari tersisa.`}</strong> Maksimal {status.product_limit} produk; import, export, backup, dan laporan shift terkunci.</span>
    {isSuperAdmin() && <button className="btn btn-primary" onClick={activate}>Aktivasi Lisensi</button>}
  </div>;
}
