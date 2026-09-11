import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';
import { isLicenseToken } from '../utils/license.mjs';

async function copyText(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('copy failed');
}

export default function LicenseBanner() {
  const { isSuperAdmin } = useAuth();
  const [status, setStatus] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/license/status').then((response) => setStatus(response.data.data)).catch(() => {});
  }, []);

  if (!status || status.licensed) return null;

  const copyActivationRequest = async () => {
    try {
      await copyText(status.activation_request);
      toast.success('Kode aktivasi disalin. Kirimkan ke penerbit lisensi.');
    } catch {
      toast.error('Kode tidak dapat disalin. Salin manual dari kolom di bawah.');
    }
  };

  const activate = async () => {
    const trimmed = token.trim();
    if (!isLicenseToken(trimmed)) {
      toast.error('Format token lisensi tidak valid');
      return;
    }
    setSaving(true);
    try {
      await api.post('/license/activate', { token: trimmed });
      toast.success('Lisensi aktif. Memuat ulang aplikasi…');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Lisensi tidak dapat diaktifkan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="license-banner" aria-live="polite">
        <div className="license-banner__icon"><Icon name="key" size={20} /></div>
        <div className="license-banner__copy">
          <strong>Lisensi perangkat belum aktif</strong>
          <span>Fitur bisnis dikunci sampai token lisensi untuk PC ini diaktifkan.</span>
        </div>
        {isSuperAdmin() && <button className="btn btn-primary" onClick={() => setDialogOpen(true)}>Aktivasi lisensi</button>}
      </section>

      {dialogOpen && (
        <div className="modal-overlay" role="presentation">
          <section className="modal license-dialog" role="dialog" aria-modal="true" aria-labelledby="license-dialog-title">
            <div className="modal-header">
              <div><p className="service-section-kicker">LISENSI PERANGKAT</p><h2 id="license-dialog-title" className="modal-title">Aktivasi RapiPos</h2></div>
              <button className="icon-btn" disabled={saving} onClick={() => setDialogOpen(false)} aria-label="Tutup"><Icon name="close" /></button>
            </div>
            <div className="modal-body form-stack">
              <p className="text-sm text-secondary">Salin kode aktivasi, kirim ke penerbit lisensi, lalu masukkan token yang diterima. Token hanya berlaku untuk perangkat ini.</p>
              <label className="input-group">
                <span className="input-label">Kode aktivasi perangkat</span>
                <textarea className="input mono" rows="4" value={status.activation_request} readOnly />
              </label>
              <button className="btn btn-ghost" onClick={copyActivationRequest}><Icon name="content_copy" size={16} /> Salin kode aktivasi</button>
              <label className="input-group">
                <span className="input-label">Token lisensi</span>
                <textarea className="input mono" rows="3" placeholder="poslic-v1.payload.signature" value={token} onChange={(event) => setToken(event.target.value)} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" disabled={saving} onClick={() => setDialogOpen(false)}>Batal</button>
              <button className="btn btn-primary" disabled={saving} onClick={activate}>{saving ? 'Memverifikasi…' : 'Aktifkan lisensi'}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
