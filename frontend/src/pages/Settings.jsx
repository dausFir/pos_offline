import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import Icon from '../components/Icon';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState({ store_name: '', store_address: '', qris_image_b64: '', qris_notes: '', ppn_percent: 0, receipt_footer: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);
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

  const handleDeleteQRIS = async () => {
    if (!confirm('Hapus gambar QRIS?')) return;
    try {
      await api.delete('/settings/qris-image');
      setSettings(s => ({ ...s, qris_image_b64: '' }));
      toast.success('Gambar QRIS dihapus');
    } catch { toast.error('Gagal hapus gambar'); }
  };

  const handleBackup = async () => {
    try {
      toast.success('Memulai backup database...');
      const response = await api.get('/backup', { responseType: 'blob' });
      
      const blob = new Blob([response.data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup_kasir_${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Backup berhasil diunduh');
    } catch (err) {
      console.error('Backup error:', err);
      toast.error(err.response?.data?.error || 'Gagal backup database');
    }
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
      toast.error(err.response?.data?.error || 'Gagal restore database');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const exportWithAuth = async (path, filename) => {
    try {
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
    } catch (err) {
      console.error('Export error:', err);
      if (err.message?.includes('kadaluarsa') || err.message?.includes('expired')) {
        toast.error('Session expired. Silakan login ulang dan coba lagi.');
      } else {
        toast.error(err.message || err.response?.data?.error || 'Gagal export data');
      }
    }
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
