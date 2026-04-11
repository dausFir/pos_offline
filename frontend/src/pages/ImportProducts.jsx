import { useState, useRef } from 'react';
import api from '../utils/api';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';

export default function ImportProducts() {
  const { t } = useI18n();
  const [file,     setFile]     = useState(null);
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.csv')) { toast.error('Hanya file .csv yang didukung'); return; }
    setFile(f); setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/import/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data.data);
      toast.success(res.data.message);
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal import'); }
    finally { setLoading(false); }
  };

  const downloadTemplate = () => {
    const token = localStorage.getItem('token');
    fetch('/api/import/products/template', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'template_produk.csv';
        a.click(); URL.revokeObjectURL(a.href);
      });
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">Import Produk dari CSV</h1>
          <p className="page-subtitle">Upload file CSV untuk menambah atau update banyak produk sekaligus</p>
        </div>
        <button className="btn btn-tonal" onClick={downloadTemplate}>
          <Icon name="download" size={16} />
          Download Template
        </button>
      </div>

      {/* Format guide */}
      <div className="card" style={{ marginBottom: 20, background: 'var(--primary-fixed)', border: 'none' }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 8 }}>📋 Format Kolom CSV</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                {['barcode_sku *', 'name *', 'category', 'buy_price', 'sell_price', 'stock', 'stock_min'].map(h => (
                  <th key={h} style={{ background: 'rgba(0,69,143,.08)', color: 'var(--primary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code style={{ fontSize: 11 }}>8991234567890</code></td>
                <td>Aqua 600ml</td>
                <td>Minuman</td>
                <td>2500</td>
                <td>3500</td>
                <td>100</td>
                <td>10</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul style={{ fontSize: 12, color: 'var(--primary)', paddingLeft: 18, marginTop: 10, lineHeight: 2 }}>
          <li>Kolom bertanda * wajib diisi</li>
          <li>Kolom <code>category</code> akan auto-buat kategori baru jika belum ada</li>
          <li>Jika barcode_sku sudah ada, data produk akan di-<strong>update</strong> (upsert)</li>
          <li>File harus berformat UTF-8. Simpan dari Excel dengan "CSV UTF-8 (Comma delimited)"</li>
        </ul>
      </div>

      {/* Upload dropzone */}
      <div
        className="card"
        style={{ marginBottom: 20, border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--outline-variant)'}`, background: dragOver ? 'var(--primary-fixed)' : 'var(--surface-container-lowest)', transition: 'all .15s', cursor: 'pointer', textAlign: 'center', padding: '40px 20px' }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
      >
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        <Icon name={file ? "description" : "upload_file"} size={48} color={file ? "var(--primary)" : "var(--outline)"} style={{ display: 'block', marginBottom: 12 }} />
        {file ? (
          <>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{file.name}</p>
            <p style={{ fontSize: 13, color: 'var(--outline)', marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · Klik untuk ganti file</p>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--on-surface)' }}>Drag & Drop file CSV di sini</p>
            <p style={{ fontSize: 13, color: 'var(--outline)', marginTop: 4 }}>atau klik untuk pilih file</p>
          </>
        )}
      </div>

      {file && (
        <button className="btn btn-primary btn-lg" onClick={handleImport} disabled={loading} style={{ marginBottom: 24 }}>
          {loading
            ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Mengimport...</>
            : <><Icon name="upload" size={20} /> Import Sekarang</>
          }
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="card">
          <p className="font-headline" style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>Hasil Import</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total Baris', value: result.total, color: 'var(--primary)' },
              { label: 'Berhasil', value: result.success, color: '#1a7a3c', bg: '#d4f4e1' },
              { label: 'Gagal', value: result.failed, color: result.failed > 0 ? 'var(--error)' : 'var(--outline)', bg: result.failed > 0 ? 'var(--error-container)' : 'var(--surface-container)' },
            ].map(m => (
              <div key={m.label} style={{ padding: '14px 12px', background: m.bg || 'var(--surface-container-low)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: m.color, fontFamily: 'Manrope,sans-serif' }}>{m.value}</div>
                <div style={{ fontSize: 11, color: 'var(--outline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {result.errors?.length > 0 && (
            <div style={{ background: 'var(--error-container)', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontWeight: 700, color: 'var(--error)', marginBottom: 8, fontSize: 13 }}>❌ Detail Error ({result.errors.length})</p>
              <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                {result.errors.map((err, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--on-error-container)', padding: '3px 0', borderBottom: '1px solid rgba(186,26,26,.1)' }}>
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.success > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <a href="/products" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary">
                  <Icon name="inventory_2" size={16} /> Lihat Produk
                </button>
              </a>
              <button className="btn btn-ghost" onClick={() => { setFile(null); setResult(null); }}>Import Lagi</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
