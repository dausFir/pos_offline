import { useState, useEffect, useCallback, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api, { formatRupiah } from '../utils/api';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import { handleTrialError } from '../utils/trial';

const emptyForm = { barcode_sku: '', name: '', category_id: '0', buy_price: '', sell_price: '', stock: '', stock_min: '5' };

export default function Products() {
  const { t } = useI18n();
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('');
  const [lowFilter,  setLowFilter]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [showCatMgr, setShowCatMgr]   = useState(false);
  const [priceHistory, setPriceHistory] = useState(null); // { product, logs }
  const [showScanner, setShowScanner] = useState(false);
  const limit = 20;

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit };
      if (catFilter) params.category_id = catFilter;
      if (lowFilter) params.low_stock = '1';
      const res = await api.get('/products', { params });
      setProducts(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Gagal memuat produk'); }
    finally { setLoading(false); }
  }, [search, page, catFilter, lowFilter]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [search, catFilter, lowFilter]);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (p) => {
    setEditItem(p);
    setForm({
      barcode_sku: p.barcode_sku, name: p.name,
      category_id: String(p.category_id || '0'),
      buy_price: String(p.buy_price), sell_price: String(p.sell_price),
      stock: String(p.stock), stock_min: String(p.stock_min ?? 5),
    });
    setShowModal(true);
  };

  const openPriceHistory = async (p) => {
    try {
      const res = await api.get(`/products/${p.id}/price-history`);
      setPriceHistory({ product: p, logs: res.data.data || [] });
    } catch { toast.error('Gagal memuat riwayat harga'); }
  };

  const handleSave = async () => {
    if (!form.barcode_sku || !form.name) { toast.error('Barcode/SKU dan nama wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = {
        barcode_sku: form.barcode_sku.trim(),
        name: form.name.trim(),
        category_id: parseInt(form.category_id) || 0,
        buy_price: parseFloat(form.buy_price) || 0,
        sell_price: parseFloat(form.sell_price) || 0,
        stock: parseInt(form.stock) || 0,
        stock_min: parseInt(form.stock_min) ?? 5,
      };
      if (editItem) {
        await api.put(`/products/${editItem.id}`, payload);
        toast.success('Produk berhasil diupdate');
      } else {
        await api.post('/products', payload);
        toast.success('Produk berhasil ditambahkan');
      }
      setShowModal(false); fetchProducts();
    } catch (err) {
      if (!handleTrialError(err)) {
        toast.error(err.response?.data?.error || 'Gagal menyimpan produk');
      }
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    setDeleting(p.id);
    try {
      await api.delete(`/products/${p.id}`);
      toast.success('Produk dihapus'); fetchProducts();
    } catch { toast.error('Gagal menghapus produk'); }
    finally { setDeleting(null); }
  };

  const handleBarcodeScanned = async (code) => {
    setShowScanner(false);
    setForm(f => ({ ...f, barcode_sku: code }));
    
    // Check if product with this barcode already exists
    try {
      const res = await api.get(`/products/barcode/${code}`);
      if (res.data.success && res.data.data) {
        const existing = res.data.data;
        if (confirm(`Produk "${existing.name}" sudah ada dengan barcode ini. Edit produk yang sudah ada?`)) {
          openEdit(existing);
        }
      }
    } catch (err) {
      // Product doesn't exist, that's fine for new products
      if (err.response?.status !== 404) {
        toast.error('Gagal memeriksa produk existing');
      }
    }
  };

  const totalPages = Math.ceil(total / limit);
  const margin = (p) => p.buy_price > 0 ? ((p.sell_price - p.buy_price) / p.buy_price * 100).toFixed(1) : null;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">Master Produk</h1>
          <p className="page-subtitle">{total} produk terdaftar</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setShowCatMgr(true)}>
            <Icon name="category" size={16} />
            Kelola Kategori
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Icon name="add" size={16} />
            Tambah Produk
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Icon name="search" size={16} color="var(--outline)" />
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Cari nama/barcode..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: lowFilter ? 'var(--error)' : 'var(--on-surface-variant)', padding: '8px 12px', background: lowFilter ? 'var(--error-container)' : 'var(--surface-container-low)', borderRadius: 8, border: `1px solid ${lowFilter ? 'var(--error)44' : 'var(--outline-variant)'}`, userSelect: 'none' }}>
            <input type="checkbox" checked={lowFilter} onChange={e => setLowFilter(e.target.checked)} style={{ accentColor: 'var(--error)', width: 15, height: 15 }} />
            Stok Menipis
          </label>
          {(search || catFilter || lowFilter) && (
            <button className="btn btn-ghost" onClick={() => { setSearch(''); setCatFilter(''); setLowFilter(false); }}>Reset</button>
          )}
          <button className="btn btn-ghost" onClick={fetchProducts}>
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Barcode / SKU</th>
                <th>Nama Produk</th>
                <th>Kategori</th>
                <th>Harga Beli</th>
                <th>Harga Jual</th>
                <th>Margin</th>
                <th>Stok</th>
                <th>Min. Stok</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="empty-state">
                    <Icon name="inventory_2" size={18} />
                    <h3>Belum ada produk</h3>
                    <p>Klik {t('product.add')} untuk mulai</p>
                  </div>
                </td></tr>
              ) : products.map((p, i) => {
                const m = margin(p);
                const isLow = p.stock <= p.stock_min;
                return (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--outline)', fontSize: 12 }}>{(page-1)*limit + i + 1}</td>
                    <td><code style={{ fontSize: 11, background: 'var(--surface-container)', padding: '2px 6px', borderRadius: 4 }}>{p.barcode_sku}</code></td>
                    <td style={{ fontWeight: 600, maxWidth: 200 }}>{p.name}</td>
                    <td>
                      {p.category_name
                        ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: 'var(--primary-fixed)', color: 'var(--primary)', fontWeight: 700 }}>{p.category_name}</span>
                        : <span style={{ color: 'var(--outline)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>{formatRupiah(p.buy_price)}</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{formatRupiah(p.sell_price)}</td>
                    <td>
                      {m !== null
                        ? <span className={`badge ${parseFloat(m) >= 20 ? 'badge-green' : parseFloat(m) >= 10 ? 'badge-teal' : 'badge-red'}`}>{m}%</span>
                        : <span style={{ color: 'var(--outline)' }}>—</span>
                      }
                    </td>
                    <td>
                      <span className={`mono font-bold ${isLow ? 'stock-low' : 'stock-ok'}`} style={{ fontSize: 15 }}>{p.stock}</span>
                      {p.stock === 0 && <span className="badge badge-red" style={{ marginLeft: 6 }}>HABIS</span>}
                      {p.stock > 0 && isLow && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>TIPIS</span>}
                    </td>
                    <td className="mono" style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{p.stock_min}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn btn-ghost" style={{ padding: '5px 9px' }} onClick={() => openEdit(p)} title="Edit produk">
                          <Icon name="edit" size={15} />
                        </button>
                      <button className="btn btn-ghost" style={{ padding: '5px 9px' }} onClick={() => openPriceHistory(p)} title="Riwayat harga">
                        <Icon name="history" size={15} />
                      </button>
                        <button className="btn btn-danger" style={{ padding: '5px 9px' }} onClick={() => handleDelete(p)} disabled={deleting === p.id}>
                          <Icon name="delete" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--outline)' }}>Halaman {page} dari {totalPages} · {total} produk</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage(p => p-1)} style={{ padding: '6px 14px' }}>← Prev</button>
              <button className="btn btn-ghost" disabled={page === totalPages} onClick={() => setPage(p => p+1)} style={{ padding: '6px 14px' }}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Produk' : 'Tambah Produk'}</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-group" style={{ gridColumn: '1/-1' }}>
                    <label className="input-label">Barcode / SKU *</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input mono" style={{ letterSpacing: 1, flex: 1 }} placeholder="cth: 8991234567890"
                        value={form.barcode_sku} onChange={e => setForm(f => ({ ...f, barcode_sku: e.target.value }))} />
                      <button 
                        className="btn btn-tonal" 
                        style={{ padding: '0 16px', minWidth: 'auto' }}
                        type="button"
                        onClick={() => setShowScanner(true)}
                        title="Scan Barcode"
                      >
                        <Icon name="qr_code_scanner" size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="input-group" style={{ gridColumn: '1/-1' }}>
                    <label className="input-label">Nama Produk *</label>
                    <input className="input" placeholder="cth: Aqua Botol 600ml"
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="input-group" style={{ gridColumn: '1/-1' }}>
                    <label className="input-label">Kategori</label>
                    <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                      <option value="0">— Tanpa Kategori —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Harga Beli (Rp)</label>
                    <input className="input mono" type="number" placeholder="0"
                      value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Harga Jual (Rp)</label>
                    <input className="input mono" type="number" placeholder="0"
                      value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Stok Awal</label>
                    <input className="input mono" type="number" placeholder="0"
                      value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label" style={{ color: 'var(--error)' }}>Min. Stok (Threshold)</label>
                    <input className="input mono" type="number" min="0" placeholder="5"
                      value={form.stock_min} onChange={e => setForm(f => ({ ...f, stock_min: e.target.value }))} />
                    <span style={{ fontSize: 11, color: 'var(--outline)', marginTop: 3 }}>Peringatan muncul saat stok ≤ nilai ini</span>
                  </div>
                </div>
                {/* Profit preview */}
                {form.buy_price && form.sell_price && (
                  <div style={{ padding: 12, background: 'var(--surface-container-low)', borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                    <div>
                      <span style={{ color: 'var(--outline)' }}>Untung per pcs</span>
                      <div className="mono" style={{ fontWeight: 800, color: '#1a7a3c', fontSize: 15 }}>
                        {formatRupiah((parseFloat(form.sell_price)||0) - (parseFloat(form.buy_price)||0))}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--outline)' }}>Margin</span>
                      <div className="mono" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 15 }}>
                        {(parseFloat(form.buy_price) > 0 ? (((parseFloat(form.sell_price)||0) - (parseFloat(form.buy_price)||0)) / (parseFloat(form.buy_price)||1) * 100).toFixed(1) : 0)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : editItem ? 'Update' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price History Modal */}
      {priceHistory && (
        <PriceHistoryModal
          product={priceHistory.product}
          logs={priceHistory.logs}
          onClose={() => setPriceHistory(null)}
        />
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <ScannerModal 
          onScan={handleBarcodeScanned} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {/* Category Manager Modal */}
      {showCatMgr && (
        <CategoryManager
          categories={categories}
          onClose={() => { setShowCatMgr(false); fetchCategories(); fetchProducts(); }}
        />
      )}
    </div>
  );
}

/* ── Category Manager ─────────────────────────────────────────────────────── */
function CategoryManager({ categories, onClose }) {
  const [list, setList]     = useState(categories);
  const [form, setForm]     = useState({ name: '', description: '', color: '#005cbb' });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const COLORS = ['#005cbb','#006a6a','#7a3000','#1a7a3c','#ba1a1a','#92600a','#5c3bc0','#c2185b'];

  const refresh = async () => {
    const res = await api.get('/categories');
    setList(res.data.data || []);
  };

  const openPriceHistory = async (p) => {
    try {
      const res = await api.get(`/products/${p.id}/price-history`);
      setPriceHistory({ product: p, logs: res.data.data || [] });
    } catch { toast.error('Gagal memuat riwayat harga'); }
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Nama kategori wajib diisi'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, form);
        toast.success('Kategori diupdate');
      } else {
        await api.post('/categories', form);
        toast.success('Kategori ditambahkan');
      }
      setForm({ name: '', description: '', color: '#005cbb' });
      setEditing(null);
      refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal simpan kategori'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Hapus kategori "${c.name}"?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success('Kategori dihapus'); refresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal hapus'); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">Kelola Kategori</span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, padding: 14, background: 'var(--surface-container-low)', borderRadius: 10 }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--on-surface-variant)' }}>{editing ? 'Edit Kategori' : 'Tambah Kategori Baru'}</p>
            <div className="input-group">
              <label className="input-label">Nama *</label>
              <input className="input" placeholder="cth: Minuman, Makanan, Rokok..."
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Deskripsi</label>
              <input className="input" placeholder="Opsional"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">Warna Label</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {COLORS.map(col => (
                  <button key={col} type="button" onClick={() => setForm(f => ({ ...f, color: col }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: col, border: form.color === col ? '3px solid var(--on-surface)' : '2px solid transparent', cursor: 'pointer', transition: 'all .12s' }} />
                ))}
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : editing ? 'Update' : 'Tambah'}
              </button>
              {editing && (
                <button className="btn btn-ghost" onClick={() => { setEditing(null); setForm({ name: '', description: '', color: '#005cbb' }); }}>
                  Batal Edit
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.length === 0 && <p style={{ textAlign: 'center', color: 'var(--outline)', fontSize: 13, padding: 20 }}>Belum ada kategori</p>}
            {list.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-container-low)', borderRadius: 8, border: '1px solid var(--outline-variant)' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{cat.name}</div>
                  {cat.description && <div style={{ fontSize: 11, color: 'var(--outline)' }}>{cat.description}</div>}
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>{cat.product_count} produk</div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => { setEditing(cat); setForm({ name: cat.name, description: cat.description, color: cat.color }); }}>
                  <Icon name="edit" size={15} />
                </button>
                <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDelete(cat)}>
                  <Icon name="delete" size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Selesai</button>
        </div>
      </div>
    </div>
  );
}

/* ── PriceHistoryModal ───────────────────────────────────────────────────── */
function PriceHistoryModal({ product, logs, onClose }) {
  const fmt = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
  const fmtDate = (d) => d ? new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-';

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">📈 Riwayat Perubahan Harga</span>
            <div style={{ fontSize: 12, color: 'var(--outline)', marginTop: 3 }}>{product.name}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <div className="modal-body">
          {/* Current price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Harga Beli Saat Ini', value: fmt(product.buy_price), color: 'var(--tertiary)' },
              { label: 'Harga Jual Saat Ini', value: fmt(product.sell_price), color: 'var(--primary)' },
            ].map(r => (
              <div key={r.label} style={{ padding: '10px 12px', background: 'var(--surface-container-low)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{r.label}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: r.color }}>{r.value}</div>
              </div>
            ))}
          </div>

          {logs.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 20px' }}>
              <Icon name="history" size={40} />
              <h3>Belum ada perubahan harga</h3>
              <p>Riwayat akan muncul setiap kali harga produk diubah</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map((log, i) => (
                <div key={log.id} style={{ padding: '10px 12px', background: i === 0 ? 'var(--surface-container-low)' : 'transparent', borderRadius: 8, border: '1px solid var(--outline-variant)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--outline)' }}>{fmtDate(log.created_at)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-surface-variant)' }}>oleh {log.changed_by}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                    {/* Old */}
                    <div style={{ fontSize: 12 }}>
                      <div style={{ color: 'var(--outline)', marginBottom: 2 }}>Sebelumnya</div>
                      {log.old_buy !== log.new_buy && <div>Beli: <span className="mono" style={{ color: 'var(--tertiary)' }}>{fmt(log.old_buy)}</span></div>}
                      {log.old_sell !== log.new_sell && <div>Jual: <span className="mono" style={{ color: 'var(--outline)' }}>{fmt(log.old_sell)}</span></div>}
                    </div>
                    {/* Arrow */}
                    <Icon name="arrow_forward" size={16} color="var(--outline)" />
                    {/* New */}
                    <div style={{ fontSize: 12 }}>
                      <div style={{ color: 'var(--outline)', marginBottom: 2 }}>Sesudah</div>
                      {log.old_buy !== log.new_buy && (
                        <div>Beli: <span className="mono" style={{ fontWeight: 700, color: log.new_buy > log.old_buy ? 'var(--error)' : '#1a7a3c' }}>{fmt(log.new_buy)}</span>
                          <span style={{ fontSize: 10, marginLeft: 4, color: log.new_buy > log.old_buy ? 'var(--error)' : '#1a7a3c' }}>
                            {log.new_buy > log.old_buy ? '▲' : '▼'} {Math.abs(((log.new_buy - log.old_buy) / log.old_buy) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {log.old_sell !== log.new_sell && (
                        <div>Jual: <span className="mono" style={{ fontWeight: 700, color: log.new_sell > log.old_sell ? '#1a7a3c' : 'var(--error)' }}>{fmt(log.new_sell)}</span>
                          <span style={{ fontSize: 10, marginLeft: 4, color: log.new_sell > log.old_sell ? '#1a7a3c' : 'var(--error)' }}>
                            {log.new_sell > log.old_sell ? '▲' : '▼'} {Math.abs(((log.new_sell - log.old_sell) / log.old_sell) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

/* ── BarcodeScanner Component ─────────────────────────────────────────────── */
function BarcodeScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);

  useEffect(() => {
    if (!scannerRef.current) return;

    const html5QrcodeScanner = new Html5QrcodeScanner(
      "barcode-scanner-products", 
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        defaultZoomValueIfSupported: 2,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      },
      false
    );

    html5QrcodeScannerRef.current = html5QrcodeScanner;

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
      if (onScan) {
        onScan(decodedText);
      }
    };

    const qrCodeErrorCallback = (errorMessage) => {
      // Silently ignore frequent scanning errors
    };

    html5QrcodeScanner.render(qrCodeSuccessCallback, qrCodeErrorCallback);

    // Apply custom styles after render
    setTimeout(() => {
      const scannerElement = document.getElementById('barcode-scanner-products');
      if (scannerElement) {
        // Style video element
        const video = scannerElement.querySelector('video');
        if (video) {
          video.style.borderRadius = '8px';
          video.style.width = '100%';
          video.style.height = 'auto';
        }
        
        // Style buttons
        const buttons = scannerElement.querySelectorAll('button');
        buttons.forEach(button => {
          button.style.background = 'var(--primary)';
          button.style.color = 'white';
          button.style.border = 'none';
          button.style.borderRadius = '6px';
          button.style.padding = '8px 16px';
          button.style.margin = '4px';
          button.style.fontSize = '12px';
          button.style.fontFamily = 'inherit';
        });

        // Style select elements
        const selects = scannerElement.querySelectorAll('select');
        selects.forEach(select => {
          select.style.background = 'var(--surface-container)';
          select.style.border = '1px solid var(--outline-variant)';
          select.style.borderRadius = '6px';
          select.style.padding = '4px 8px';
          select.style.margin = '4px';
          select.style.fontFamily = 'inherit';
        });
      }
    }, 100);

    return () => {
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch((err) => {
          // Silent cleanup error
        });
      }
    };
  }, [onScan]);

  return (
    <div ref={scannerRef}>
      <div id="barcode-scanner-products" />
    </div>
  );
}

/* ── ScannerModal Component ────────────────────────────────────────────────── */
function ScannerModal({ onScan, onClose }) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('camera'); // 'camera' or 'manual'
  const [isScanning, setIsScanning] = useState(false);

  const handleScanSuccess = (scannedCode) => {
    onScan(scannedCode);
  };

  const toggleMode = () => {
    setMode(mode === 'camera' ? 'manual' : 'camera');
    setIsScanning(false);
  };

  useEffect(() => {
    if (mode === 'camera') {
      setIsScanning(true);
    }
  }, [mode]);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: mode === 'camera' ? '500px' : '400px' }}>
        <div className="modal-header">
          <span className="modal-title">Scanner Barcode</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className="btn btn-ghost" 
              style={{ padding: '4px 12px', fontSize: '12px' }}
              onClick={toggleMode}
            >
              <Icon name={mode === 'camera' ? 'keyboard' : 'camera'} size={14} />
              {mode === 'camera' ? 'Manual' : 'Camera'}
            </button>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
        
        <div className="modal-body">
          {mode === 'camera' ? (
            <div>
              <div style={{ 
                background: 'var(--surface-container)', 
                borderRadius: '12px', 
                padding: '16px', 
                marginBottom: '16px',
                overflow: 'hidden'
              }}>
                {isScanning && (
                  <BarcodeScanner 
                    onScan={handleScanSuccess} 
                    onError={(err) => toast.error('Scanner error: ' + err)} 
                  />
                )}
              </div>
              <p style={{ 
                fontSize: '13px', 
                color: 'var(--outline)', 
                textAlign: 'center', 
                lineHeight: 1.5 
              }}>
                📷 Arahkan kamera ke barcode untuk scan otomatis
                <br />
                💡 Pastikan barcode terlihat jelas dan dalam kotak
              </p>
            </div>
          ) : (
            <div>
              <div style={{ 
                background: 'var(--surface-container-low)', 
                borderRadius: 12, 
                padding: 28, 
                textAlign: 'center', 
                marginBottom: 14, 
                border: '2px dashed var(--outline-variant)' 
              }}>
                <Icon name="qr_code_scanner" size={48} color="var(--primary)" />
                <p style={{ fontSize: 12, color: 'var(--outline)', lineHeight: 1.6 }}>
                  Klik kolom di bawah, lalu scan atau ketik barcode
                </p>
              </div>
              <input 
                className="input mono" 
                style={{ fontSize: 18, letterSpacing: 2 }}
                placeholder="Scan atau ketik barcode..." 
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => { 
                  if (e.key === 'Enter' && code.trim()) {
                    onScan(code.trim());
                  }
                }}
                autoFocus 
              />
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          {mode === 'manual' && (
            <button 
              className="btn btn-primary" 
              disabled={!code.trim()} 
              onClick={() => onScan(code.trim())}
            >
              <Icon name="search" size={16} /> Cari
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
