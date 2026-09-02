import { useState, useRef, useEffect } from 'react';
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
  const [stockMode, setStockMode] = useState('replace_stock');
  const [jobId, setJobId] = useState(null);
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
      formData.append('stock_mode', stockMode);
      const res = await api.post('/import/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setJobId(res.data.data.job_id);
      setResult({ status: 'queued', total_rows: 0, processed_rows: 0, success_rows: 0, failed_rows: 0 });
      toast.success('Import masuk antrean');
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal import'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      try {
        const res = await api.get('/import/products/status', { params: { job_id: jobId } });
        const job = res.data.data;
        setResult(job);
        if (['completed', 'completed_with_errors', 'failed'].includes(job.status)) {
          clearInterval(timer);
          if (job.status === 'completed') toast.success('Import selesai');
          if (job.status === 'completed_with_errors') toast.error('Import selesai dengan beberapa error');
        }
      } catch { clearInterval(timer); }
    }, 700);
    return () => clearInterval(timer);
  }, [jobId]);

  const downloadTemplate = () => {
    const token = localStorage.getItem('access_token');
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
        <div className="card" style={{ marginBottom: 16 }}>
          <label className="input-label">Mode stok saat import</label>
          <select className="input" value={stockMode} onChange={e => setStockMode(e.target.value)}>
            <option value="replace_stock">Ganti stok (stok opname)</option>
            <option value="add_stock">Tambah stok (barang datang)</option>
            <option value="product_only">Produk & harga saja</option>
          </select>
        </div>
      )}

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
              { label: 'Diproses', value: `${result.processed_rows || 0}/${result.total_rows || 0}`, color: 'var(--primary)' },
              { label: 'Berhasil', value: result.success_rows || 0, color: '#1a7a3c', bg: '#d4f4e1' },
              { label: 'Gagal', value: result.failed_rows || 0, color: result.failed_rows > 0 ? 'var(--error)' : 'var(--outline)', bg: result.failed_rows > 0 ? 'var(--error-container)' : 'var(--surface-container)' },
            ].map(m => (
              <div key={m.label} style={{ padding: '14px 12px', background: m.bg || 'var(--surface-container-low)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: m.color, fontFamily: 'Manrope,sans-serif' }}>{m.value}</div>
                <div style={{ fontSize: 11, color: 'var(--outline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {result.status === 'processing' || result.status === 'queued' ? <p style={{ fontSize: 13, color: 'var(--outline)' }}>Status: {result.status}…</p> : null}
          {result.failed_rows > 0 && <p style={{ fontSize: 12, color: 'var(--error)' }}>Ada {result.failed_rows} baris gagal. Detail error tersedia melalui API import job.</p>}
          {result.success_rows > 0 && (
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
