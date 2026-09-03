import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function LicenseBanner() {
  const { isSuperAdmin } = useAuth();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get('/license/status').then(res => setStatus(res.data.data)).catch(() => {});
  }, []);

  if (!status || status.licensed) return null;

  const activate = async () => {
    const token = window.prompt('Masukkan token lisensi yang diberikan penerbit:');
    if (!token) return;
    try {
      await api.post('/license/activate', { token });
      toast.success('Lisensi aktif. Memuat ulang aplikasi…');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) { toast.error(err.response?.data?.error || 'Lisensi tidak dapat diaktifkan'); }
  };

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(status.activation_request);
      toast.success('Kode aktivasi disalin. Kirimkan ke penerbit lisensi.');
    } catch { toast.error('Gagal menyalin kode aktivasi'); }
  };

  return <div style={{ margin: '16px 24px 0', padding: '12px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#ffebee', border: '1px solid #ef9a9a', color: '#8b1a1a' }}>
    <span><strong>Lisensi perangkat belum aktif.</strong> Fitur bisnis dikunci sampai lisensi untuk PC ini diaktifkan.</span>
    {isSuperAdmin() && <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-ghost" onClick={copyRequest}>Salin Kode Aktivasi</button><button className="btn btn-primary" onClick={activate}>Aktivasi Lisensi</button></div>}
  </div>;
}
