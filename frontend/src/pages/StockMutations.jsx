import { useState, useEffect, useCallback } from 'react';
import api, { formatDate } from '../utils/api';
import Icon from '../components/Icon';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import { trialSafeExport } from '../utils/trial';

const TYPE_LABELS = {
  in:         { label: 'Stok Masuk',    color: 'badge-green',  icon: '📥', arrow: 'up'   },
  out:        { label: 'Stok Keluar',   color: 'badge-red',    icon: '📤', arrow: 'down' },
  adjustment: { label: 'Penyesuaian',   color: 'badge-blue',   icon: '🔧', arrow: null   },
  sale:       { label: 'Penjualan',     color: 'badge-blue', icon: '🛒', arrow: 'down' },
};

export default function StockMutations() {
  const { t } = useI18n();
  const [mutations, setMutations] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterProduct, setFilterProduct] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ product_id: '', type: 'in', quantity: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const limit = 30;

  const handleExportMutations = async () => {
    await trialSafeExport(async () => {
      toast.success('Memulai export mutasi stok...');
      const response = await api.get('/export/stock-mutations', { responseType: 'blob' });
      
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mutasi_stok_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('File berhasil diunduh');
    });
  };

  const fetchMutations = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filterProduct) params.product_id = filterProduct;
      const res = await api.get('/stock-mutations', { params });
      setMutations(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Gagal memuat mutasi stok'); }
    finally { setLoading(false); }
  }, [page, filterProduct]);

  const fetchProducts = useCallback(async () => {
    const res = await api.get('/products', { params: { limit: 200, search: productSearch } });
    setProducts(res.data.data || []);
  }, [productSearch]);

  useEffect(() => { fetchMutations(); }, [fetchMutations]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleCreate = async () => {
    if (!form.product_id || !form.type || !form.quantity) {
      toast.error('Produk, tipe, dan kuantitas wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await api.post('/stock-mutations', {
        product_id: parseInt(form.product_id),
        type: form.type,
        quantity: parseInt(form.quantity),
        note: form.note,
      });
      toast.success('Mutasi stok berhasil dicatat');
      setShowModal(false);
      setForm({ product_id: '', type: 'in', quantity: '', note: '' });
      fetchMutations();
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal catat mutasi');
    } finally { setSaving(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ padding: 24 }}>
      <div className='page-header'>
        <div>
          <h1 className='page-title font-headline'>Mutasi Stok</h1>
          <p className='page-subtitle'>{total} catatan mutasi</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleExportMutations}>📊 Export CSV</button>
          <button className="btn btn-ghost" onClick={fetchMutations}><Icon name="refresh" size={15} /></button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Icon name="add" size={16} /> Catat Mutasi
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Icon name="search" size={14} />
            <input className="input" style={{ paddingLeft: 36 }} placeholder="Filter cari produk..."
              value={productSearch} onChange={e => setProductSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 220 }} value={filterProduct} onChange={e => { setFilterProduct(e.target.value); setPage(1); }}>
            <option value="">— Semua Produk —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock})</option>)}
          </select>
          {filterProduct && (
            <button className="btn btn-ghost" onClick={() => setFilterProduct('')}>Reset</button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {Object.entries(TYPE_LABELS).map(([type, info]) => {
          const count = mutations.filter(m => m.type === type).length;
          return (
            <div key={type} className="card" style={{ padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{info.icon}</div>
              <div style={{ fontSize: 11, color: 'var(--outline)', fontWeight: 700, textTransform: 'uppercase' }}>{info.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{count}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Produk</th>
                <th>Tipe</th>
                <th>Qty</th>
                <th>Sebelum</th>
                <th>Sesudah</th>
                <th>Perubahan</th>
                <th>Keterangan</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : mutations.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state">
                    <Icon name="history" size={40} />
                    <h3>Belum ada mutasi stok</h3>
                    <p>Mutasi tercatat otomatis saat ada penjualan atau input manual</p>
                  </div>
                </td></tr>
              ) : mutations.map(m => {
                const info = TYPE_LABELS[m.type] || { label: m.type, color: 'badge-blue', arrow: null };
                const delta = m.stock_after - m.stock_before;
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, color: 'var(--outline)', whiteSpace: 'nowrap' }}>{formatDate(m.created_at)}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--outline)', fontFamily: 'monospace' }}>{m.barcode_sku}</div>
                    </td>
                    <td><span className={`badge ${info.color}`}>{info.label}</span></td>
                    <td className="mono" style={{ fontWeight: 700 }}>{Math.abs(m.quantity)}</td>
                    <td className="mono" style={{ color: 'var(--on-surface-variant)' }}>{m.stock_before}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{m.stock_after}</td>
                    <td>
                      <span className="mono" style={{
                        fontWeight: 800, fontSize: 15,
                        color: delta > 0 ? '#1a7a3c' : delta < 0 ? 'var(--error)' : 'var(--outline)',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        {delta > 0 ? <Icon name="arrow_upward" size={13} /> : delta < 0 ? <Icon name="arrow_downward" size={13} /> : null}
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--outline)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.note || '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{m.username}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--outline)' }}>Halaman {page} dari {totalPages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px' }}>← Prev</button>
              <button className="btn btn-ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px' }}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Create mutation modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">📦 Catat Mutasi Stok</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><Icon name="close" size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Produk *</label>
                  <select className="input" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                    <option value="">— Pilih produk —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — Stok saat ini: {p.stock}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Tipe Mutasi *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { id: 'in', label: '📥 Stok Masuk', desc: 'Tambah stok' },
                      { id: 'out', label: '📤 Stok Keluar', desc: 'Kurangi stok' },
                      { id: 'adjustment', label: '🔧 Koreksi', desc: 'Set stok absolut' },
                    ].map(t => (
                      <button key={t.id} type="button"
                        onClick={() => setForm(f => ({ ...f, type: t.id }))}
                        style={{
                          padding: '10px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                          border: `2px solid ${form.type === t.id ? 'var(--primary)' : 'var(--outline-variant)'}`,
                          background: form.type === t.id ? 'rgba(249,115,22,0.08)' : 'var(--surface-container-low)',
                          color: form.type === t.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                          transition: 'all 0.15s', fontSize: 13, fontWeight: 600
                        }}
                      >
                        <div>{t.label}</div>
                        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">
                    {form.type === 'adjustment' ? 'Stok Baru (absolut)' : 'Kuantitas'} *
                  </label>
                  <input className="input mono" type="number" min="1" placeholder="0"
                    value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                  {form.type === 'adjustment' && (
                    <div style={{ fontSize: 11, color: 'var(--outline)', marginTop: 4 }}>
                      💡 Nilai ini akan langsung menjadi stok baru produk tersebut
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Keterangan</label>
                  <input className="input" placeholder="cth: Terima dari supplier, Barang rusak, dll..."
                    value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Simpan Mutasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
