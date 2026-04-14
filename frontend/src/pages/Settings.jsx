import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import Icon from '../components/Icon';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { handleTrialError, trialSafeExport } from '../utils/trial';

export default function Settings() {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState({ store_name: '', store_address: '', logo_image_b64: '', qris_image_b64: '', qris_notes: '', ppn_percent: 0, receipt_footer: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const qrisInputRef = useRef(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data.data || {});
    } catch { toast.error('Gagal memuat pengaturan'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Pengaturan berhasil disimpan');
    } catch { toast.error('Gagal menyimpan pengaturan'); }
    finally { setSaving(false); }
  };

  const handleQRISUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 800 * 1024; // 800KB
    if (file.size > MAX_SIZE) {
      toast.error('Ukuran gambar maksimal 800KB. Kompres gambar terlebih dahulu.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettings(s => ({ ...s, qris_image_b64: ev.target.result }));
      toast.success('Gambar QRIS siap. Klik Simpan untuk menyimpan.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 500 * 1024; // 500KB for logo
    if (file.size > MAX_SIZE) {
      toast.error('Ukuran logo maksimal 500KB. Kompres gambar terlebih dahulu.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettings(s => ({ ...s, logo_image_b64: ev.target.result }));
      toast.success('Logo toko siap. Klik Simpan untuk menyimpan.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteQRIS = async () => {
    if (!confirm('Hapus gambar QRIS?')) return;
    try {
      await api.delete('/settings/qris-image');
      setSettings(s => ({ ...s, qris_image_b64: '' }));
      toast.success('Gambar QRIS dihapus');
    } catch { toast.error('Gagal hapus gambar'); }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Hapus logo toko?')) return;
    try {
      await api.delete('/settings/logo-image');
      setSettings(s => ({ ...s, logo_image_b64: '' }));
      toast.success('Logo toko dihapus');
    } catch { toast.error('Gagal hapus logo'); }
  };

  const handleBackup = async () => {
    await trialSafeExport(async () => {
      toast.success('Memulai backup database...');
      const response = await api.get('/backup', { responseType: 'blob' });
      
      const blob = new Blob([response.data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup_kasir_${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Backup berhasil diunduh');
    });
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('⚠️ PERHATIAN: Restore akan mengganti seluruh data saat ini! Lanjutkan?')) {
      e.target.value = '';
      return;
    }
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('backup', file);
      const res = await api.post('/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message || 'Restore berhasil. Restart aplikasi!', { duration: 6000 });
    } catch (err) {
      if (!handleTrialError(err)) {
        toast.error(err.response?.data?.error || 'Gagal restore database');
      }
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const exportWithAuth = async (path, filename) => {
    await trialSafeExport(async () => {
      toast.success('Memulai export data...');
      const response = await api.get(path, { responseType: 'blob' });
      
      // Check if response is actually an error JSON (not CSV)
      if (response.headers['content-type']?.includes('application/json')) {
        // Parse JSON error from blob
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || 'Export gagal');
      }
      
      const blob = new Blob([response.data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('File berhasil diunduh');
    });
  };

  if (loading) return (
    <div className="loading-screen" style={{ minHeight: '80vh' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Pengaturan</h1>
        <p style={{ color: 'var(--outline)', fontSize: 13 }}>Konfigurasi toko, QRIS, backup data, dan ekspor laporan</p>
      </div>

      {/* ── Store Info ──────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--outline-variant)' }}>
          <Icon name="storefront" size={18} color="var(--primary)" />
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Informasi Toko</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Nama Toko</label>
            <input className="input" placeholder="cth: Warung Berkah Jaya"
              value={settings.store_name || ''}
              onChange={e => setSettings(s => ({ ...s, store_name: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Alamat / Keterangan</label>
            <input className="input" placeholder="cth: Jl. Mawar No. 12, Bandung"
              value={settings.store_address || ''}
              onChange={e => setSettings(s => ({ ...s, store_address: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">PPN / Pajak (%)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input className="input mono" type="number" min="0" max="100" step="0.5"
                style={{ width: 100 }} placeholder="0"
                value={settings.ppn_percent || 0}
                onChange={e => setSettings(s => ({ ...s, ppn_percent: parseFloat(e.target.value) || 0 }))} />
              <span style={{ fontSize: 13, color: settings.ppn_percent > 0 ? '#1a7a3c' : 'var(--outline)', fontWeight: settings.ppn_percent > 0 ? 600 : 400 }}>
                {settings.ppn_percent > 0 ? `✓ PPN ${settings.ppn_percent}% aktif` : 'Isi 0 jika tidak ada PPN'}
              </span>
            </div>
          </div>
          {settings.ppn_percent > 0 && (
            <div className="input-group">
              <label className="input-label">Mode Perhitungan PPN</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="ppn_mode"
                    value="inclusive"
                    checked={(settings.ppn_mode || 'exclusive') === 'inclusive'}
                    onChange={e => setSettings(s => ({ ...s, ppn_mode: e.target.value }))}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Tax Inclusive (Harga sudah termasuk PPN)</div>
                    <div style={{ fontSize: 12, color: 'var(--outline)' }}>
                      PPN sudah termasuk dalam harga jual. PPN dipotong dari total, bukan ditambahkan.
                    </div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="ppn_mode"
                    value="exclusive"
                    checked={(settings.ppn_mode || 'exclusive') === 'exclusive'}
                    onChange={e => setSettings(s => ({ ...s, ppn_mode: e.target.value }))}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Tax Exclusive (PPN dibebankan ke pembeli)</div>
                    <div style={{ fontSize: 12, color: 'var(--outline)' }}>
                      PPN ditambahkan ke harga jual. Total yang dibayar = Harga + PPN.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Pesan Footer Struk</label>
            <input className="input" placeholder="cth: Terima kasih! Barang yang dibeli tidak dapat dikembalikan."
              value={settings.receipt_footer || ''}
              onChange={e => setSettings(s => ({ ...s, receipt_footer: e.target.value }))} />
          </div>
        </div>
      </section>

      {/* ── Custom Logo ─────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--outline-variant)' }}>
          <Icon name="image" size={18} color="var(--primary)" />
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Logo Toko (Opsional)</h2>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'start' }}>
          {/* Logo preview */}
          <div style={{ flex: '0 0 120px' }}>
            {settings.logo_image_b64 ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={settings.logo_image_b64}
                  alt="Logo"
                  style={{ width: '100%', maxHeight: 80, objectFit: 'contain', borderRadius: 8, border: '2px solid var(--outline-variant)', backgroundColor: '#f8f9fa' }}
                />
                <button
                  onClick={handleDeleteLogo}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'rgba(239,68,68,0.9)', border: 'none',
                    borderRadius: 4, cursor: 'pointer', padding: 4,
                    color: 'white', display: 'flex', alignItems: 'center'
                  }}
                >
                  <Icon name="delete" size={12} />
                </button>
              </div>
            ) : (
              <div style={{
                width: '100%', height: 80, backgroundColor: 'var(--surface-variant)',
                border: '2px dashed var(--outline-variant)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4
              }}>
                <Icon name="image" size={20} color="var(--outline)" />
                <span style={{ fontSize: 10, color: 'var(--outline)' }}>No Logo</span>
              </div>
            )}
          </div>

          {/* Logo upload controls */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 12, color: 'var(--outline)', marginBottom: 12, lineHeight: '16px' }}>
              Logo akan tampil di header struk thermal. Format: PNG/JPG, maksimal 500KB, ukuran ideal: 200x60px.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="file"
                ref={logoInputRef}
                accept="image/*"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
              <button
                className="button secondary"
                onClick={() => logoInputRef.current?.click()}
                style={{ fontSize: 13, padding: '8px 16px' }}
              >
                <Icon name="upload" size={14} style={{ marginRight: 6 }} />
                {settings.logo_image_b64 ? 'Ganti Logo' : 'Upload Logo'}
              </button>
              {settings.logo_image_b64 && (
                <button
                  className="button"
                  onClick={handleDeleteLogo}
                  style={{ fontSize: 13, padding: '8px 16px', backgroundColor: 'var(--error)', color: 'white' }}
                >
                  <Icon name="delete" size={14} style={{ marginRight: 6 }} />
                  Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── QRIS ────────────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--outline-variant)' }}>
          <Icon name="qr_code" size={18} color="var(--primary)" />
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>QRIS Pembayaran</h2>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Image preview */}
          <div style={{ flex: '0 0 180px' }}>
            {settings.qris_image_b64 ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={settings.qris_image_b64}
                  alt="QRIS"
                  style={{ width: '100%', borderRadius: 10, border: '2px solid var(--outline-variant)' }}
                />
                <button
                  onClick={handleDeleteQRIS}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(239,68,68,0.9)', border: 'none',
                    borderRadius: 6, cursor: 'pointer', padding: 6,
                    color: 'white', display: 'flex', alignItems: 'center'
                  }}
                >
                  <Icon name="delete" size={14} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => qrisInputRef.current?.click()}
                style={{
                  width: '100%', height: 180,
                  border: '2px dashed var(--outline-variant)',
                  borderRadius: 10,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--outline)',
                  transition: 'all 0.15s', gap: 8
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--outline-variant)'}
              >
                <Icon name="qr_code" size={32} />
                <span style={{ fontSize: 12 }}>Upload gambar QRIS</span>
                <span style={{ fontSize: 10 }}>(maks. 800KB)</span>
              </div>
            )}
            <input ref={qrisInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleQRISUpload} />
            <button className="btn btn-ghost w-full" style={{ marginTop: 10, fontSize: 13 }} onClick={() => qrisInputRef.current?.click()}>
              <Icon name="upload" size={14} /> {settings.qris_image_b64 ? 'Ganti Gambar' : 'Upload QRIS'}
            </button>
          </div>

          {/* QRIS notes */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="input-group" style={{ marginBottom: 12 }}>
              <label className="input-label">Pesan di Layar QRIS</label>
              <textarea
                className="input"
                style={{ height: 90, resize: 'vertical' }}
                placeholder="cth: Scan QR di atas untuk bayar QRIS. Tunjukkan bukti transfer ke kasir."
                value={settings.qris_notes || ''}
                onChange={e => setSettings(s => ({ ...s, qris_notes: e.target.value }))}
              />
            </div>
            <div style={{ padding: 12, background: 'rgba(249,115,22,0.05)', borderRadius: 8, border: '1px solid rgba(249,115,22,0.15)', fontSize: 12, color: 'var(--outline)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--primary)' }}>💡 Tips:</strong> Gambar QRIS ini akan ditampilkan di modal pembayaran QRIS saat kasir memproses transaksi. Upload gambar QR code yang diberikan oleh bank/penyedia QRIS Anda.
            </div>
          </div>
        </div>
      </section>

      {/* ── Payment Gateway ─────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--outline-variant)' }}>
          <Icon name="credit_card" size={18} color="var(--primary)" />
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Payment Gateway (Opsional)</h2>
        </div>
        
        {/* Enable/Disable Toggle */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.payment_gateway_enabled || false}
              onChange={e => setSettings(s => ({ ...s, payment_gateway_enabled: e.target.checked }))}
              style={{ transform: 'scale(1.2)' }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Aktifkan Payment Gateway</div>
              <div style={{ fontSize: 12, color: 'var(--outline)' }}>
                Integrasi dengan e-wallet (GoPay, OVO, DANA, dll) dan kartu kredit/debit
              </div>
            </div>
          </label>
        </div>

        {settings.payment_gateway_enabled && (
          <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
            {/* Provider Selection */}
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label className="input-label">Provider Payment Gateway</label>
              <select 
                className="input"
                value={settings.payment_provider || 'manual'}
                onChange={e => setSettings(s => ({ ...s, payment_provider: e.target.value }))}
              >
                <option value="manual">Manual QRIS Only</option>
                <option value="xendit">Xendit</option>
                <option value="midtrans">Midtrans</option>
              </select>
              <div style={{ fontSize: 12, color: 'var(--outline)', marginTop: 6 }}>
                {settings.payment_provider === 'xendit' && '🟢 Xendit - Support GoPay, OVO, DANA, LinkAja, ShopeePay, Cards'}
                {settings.payment_provider === 'midtrans' && '🟢 Midtrans - Support semua e-wallet + kartu kredit/debit'}
                {settings.payment_provider === 'manual' && 'ℹ️ Hanya QRIS manual yang diupload di section atas'}
              </div>
            </div>

            {/* Xendit Configuration */}
            {settings.payment_provider === 'xendit' && (
              <div style={{ padding: 16, background: 'rgba(59, 130, 246, 0.05)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.15)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Icon name="api" size={16} color="#3b82f6" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#3b82f6' }}>Konfigurasi Xendit</span>
                </div>
                
                <div style={{ display: 'grid', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">API Key (Secret Key)</label>
                    <input 
                      type="password"
                      className="input"
                      placeholder="xnd_development_xxx atau xnd_production_xxx"
                      value={settings.xendit_api_key || ''}
                      onChange={e => setSettings(s => ({ ...s, xendit_api_key: e.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Public Key</label>
                    <input 
                      className="input"
                      placeholder="xnd_public_development_xxx atau xnd_public_production_xxx"
                      value={settings.xendit_public_key || ''}
                      onChange={e => setSettings(s => ({ ...s, xendit_public_key: e.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Webhook URL (Opsional)</label>
                    <input 
                      className="input"
                      placeholder="https://yourdomain.com/webhooks/xendit"
                      value={settings.xendit_webhook || ''}
                      onChange={e => setSettings(s => ({ ...s, xendit_webhook: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Midtrans Configuration */}
            {settings.payment_provider === 'midtrans' && (
              <div style={{ padding: 16, background: 'rgba(34, 197, 94, 0.05)', borderRadius: 8, border: '1px solid rgba(34, 197, 94, 0.15)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Icon name="api" size={16} color="#22c55e" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#22c55e' }}>Konfigurasi Midtrans</span>
                </div>
                
                <div style={{ display: 'grid', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">Server Key</label>
                    <input 
                      type="password"
                      className="input"
                      placeholder="SB-Mid-server-xxx (sandbox) atau Mid-server-xxx (production)"
                      value={settings.midtrans_server_key || ''}
                      onChange={e => setSettings(s => ({ ...s, midtrans_server_key: e.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Client Key</label>
                    <input 
                      className="input"
                      placeholder="SB-Mid-client-xxx (sandbox) atau Mid-client-xxx (production)"
                      value={settings.midtrans_client_key || ''}
                      onChange={e => setSettings(s => ({ ...s, midtrans_client_key: e.target.value }))}
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.midtrans_sandbox || false}
                        onChange={e => setSettings(s => ({ ...s, midtrans_sandbox: e.target.checked }))}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Mode Sandbox (Testing)</div>
                        <div style={{ fontSize: 12, color: 'var(--outline)' }}>
                          Uncheck jika menggunakan production keys
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* E-wallet Selection */}
            {(settings.payment_provider === 'xendit' || settings.payment_provider === 'midtrans') && (
              <div style={{ padding: 16, background: 'var(--surface-container-low)', borderRadius: 8, border: '1px solid var(--outline-variant)' }}>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>E-wallet yang Diaktifkan</h3>
                  <p style={{ fontSize: 12, color: 'var(--outline)' }}>Pilih metode pembayaran yang akan tersedia di POS</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {[
                    { key: 'enable_gopay', label: 'GoPay', icon: '🟢', desc: 'Gojek ecosystem' },
                    { key: 'enable_ovo', label: 'OVO', icon: '🟣', desc: 'Grab ecosystem' },
                    { key: 'enable_dana', label: 'DANA', icon: '🔵', desc: 'Ant Financial' },
                    { key: 'enable_linkaja', label: 'LinkAja', icon: '🔴', desc: 'Telkomsel ecosystem' },
                    { key: 'enable_shopee_pay', label: 'ShopeePay', icon: '🟠', desc: 'Shopee ecosystem' },
                  ].map(wallet => (
                    <label key={wallet.key} style={{ 
                      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      padding: 12, borderRadius: 8, border: '1px solid var(--outline-variant)',
                      backgroundColor: settings[wallet.key] ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                      borderColor: settings[wallet.key] ? 'rgba(34, 197, 94, 0.2)' : 'var(--outline-variant)'
                    }}>
                      <input
                        type="checkbox"
                        checked={settings[wallet.key] || false}
                        onChange={e => setSettings(s => ({ ...s, [wallet.key]: e.target.checked }))}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{wallet.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{wallet.label}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--outline)' }}>{wallet.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Configuration Tips */}
            <div style={{ padding: 12, background: 'rgba(249,115,22,0.05)', borderRadius: 8, border: '1px solid rgba(249,115,22,0.15)', fontSize: 12, color: 'var(--outline)', lineHeight: 1.7, marginTop: 16 }}>
              <strong style={{ color: 'var(--primary)' }}>💡 Setup Instructions:</strong><br />
              • <strong>Xendit:</strong> <a href="https://dashboard.xendit.co" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>dashboard.xendit.co</a> → Settings → API Keys<br />
              • <strong>Midtrans:</strong> <a href="https://dashboard.midtrans.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>dashboard.midtrans.com</a> → Settings → Access Keys<br />
              • Pastikan webhook URL sudah dikonfigurasi di dashboard provider untuk notifikasi pembayaran<br />
              • Test dengan mode sandbox terlebih dahulu sebelum production
            </div>
          </div>
        )}
      </section>

      {/* Save button */}
      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-primary btn-lg" onClick={handleSaveSettings} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : <><Icon name="save" size={18} /> Simpan Pengaturan</>}
        </button>
      </div>

      {/* ── Export CSV ──────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--outline-variant)' }}>
          <Icon name="description" size={18} color="var(--primary)" />
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Export Laporan (CSV / Excel)</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--outline)', marginBottom: 16, lineHeight: 1.6 }}>
          Download data dalam format CSV yang bisa dibuka langsung di Microsoft Excel atau Google Sheets.
          File sudah menggunakan format angka Rupiah dan encoding UTF-8 dengan BOM agar karakter Indonesia tampil benar.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            {
              label: '📊 Riwayat Transaksi',
              desc: 'Semua transaksi penjualan',
              action: () => exportWithAuth('/api/export/transactions', `transaksi_${new Date().toISOString().slice(0,10)}.csv`)
            },
            {
              label: '📦 Daftar Produk',
              desc: 'Semua produk & stok',
              action: () => exportWithAuth('/api/export/products', `produk_${new Date().toISOString().slice(0,10)}.csv`)
            },
            {
              label: '🔄 Mutasi Stok',
              desc: 'Histori pergerakan stok',
              action: () => exportWithAuth('/api/export/stock-mutations', `mutasi_stok_${new Date().toISOString().slice(0,10)}.csv`)
            },
          ].map(item => (
            <button key={item.label} className="btn btn-ghost" style={{ flexDirection: 'column', height: 80, gap: 4 }} onClick={item.action}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontSize: 11, color: 'var(--outline)', fontWeight: 400 }}>{item.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Backup / Restore ────────────────────────────────────────────────── */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--outline-variant)' }}>
          <Icon name="database" size={18} color="var(--primary)" />
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Backup & Restore Database</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Backup */}
          <div style={{ padding: 16, background: 'var(--surface-container-low)', borderRadius: 10, border: '1px solid var(--outline-variant)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="download" size={16} color="#1a7a3c" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Backup Data</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--outline)', marginBottom: 14, lineHeight: 1.6 }}>
              Unduh salinan database.sqlite ke PC Anda. Simpan di tempat aman sebagai cadangan.
            </p>
            <button className="btn btn-success w-full" onClick={handleBackup}>
              <Icon name="download" size={16} /> Download Backup (.zip)
            </button>
          </div>

          {/* Restore */}
          <div style={{ padding: 16, background: 'var(--surface-container-low)', borderRadius: 10, border: `1px solid ${isSuperAdmin() ? 'var(--outline-variant)' : 'var(--outline-variant)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="upload" size={16} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Restore Data</span>
              {!isSuperAdmin() && <span className="badge badge-yellow">Super Admin</span>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--outline)', marginBottom: 14, lineHeight: 1.6 }}>
              Pulihkan database dari file backup. <strong style={{ color: 'var(--error)' }}>Semua data saat ini akan digantikan.</strong>
            </p>
            {isSuperAdmin() ? (
              <>
                <input ref={fileInputRef} type="file" accept=".sqlite,.zip" style={{ display: 'none' }} onChange={handleRestore} />
                <button
                  className="btn btn-danger w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={restoring}
                >
                  {restoring
                    ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    : <><Icon name="upload" size={16} /> Restore dari File</>
                  }
                </button>
              </>
            ) : (
              <button className="btn btn-ghost w-full" disabled>
                🔒 Hanya Super Admin
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 12, background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--outline)', lineHeight: 1.7 }}>
          ⚠️ <strong>Rekomendasi:</strong> Lakukan backup minimal seminggu sekali. Simpan file backup di USB flashdisk atau Google Drive agar aman jika PC bermasalah. Setelah restore, restart aplikasi (tutup dan buka kembali .exe).
        </div>
      </section>
    </div>
  );
}
