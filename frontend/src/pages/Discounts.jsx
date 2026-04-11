import { useState, useEffect } from 'react';
import api, { formatRupiah } from '../utils/api';
import Icon from '../components/Icon';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';

const emptyForm = { code: '', name: '', type: 'percent', value: '', min_purchase: '0', is_active: true };

export default function Discounts() {
  const { t } = useI18n();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/discounts');
      setDiscounts(res.data.data || []);
    } catch { toast.error('Gagal memuat diskon'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDiscounts(); }, []);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (d) => {
    setEditItem(d);
    setForm({ code: d.code, name: d.name, type: d.type, value: String(d.value), min_purchase: String(d.min_purchase), is_active: d.is_active });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.value) {
      toast.error('Kode, nama, dan nilai wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, value: parseFloat(form.value), min_purchase: parseFloat(form.min_purchase) || 0 };
      if (editItem) {
        await api.put(`/discounts/${editItem.id}`, payload);
        toast.success('Diskon diupdate');
      } else {
        await api.post('/discounts', payload);
        toast.success('Diskon ditambahkan');
      }
      setShowModal(false);
      fetchDiscounts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal simpan diskon');
    } finally { setSaving(false); }
  };

  const handleDelete = async (d) => {
    if (!confirm(`Hapus diskon "${d.name}"?`)) return;
    try {
      await api.delete(`/discounts/${d.id}`);
      toast.success('Diskon dihapus');
      fetchDiscounts();
    } catch { toast.error('Gagal hapus diskon'); }
  };

  const toggleActive = async (d) => {
    try {
      await api.put(`/discounts/${d.id}`, { ...d, is_active: !d.is_active });
      fetchDiscounts();
    } catch { toast.error('Gagal update status'); }
  };

  const previewDiscount = (amount = 100000) => {
    if (!form.value) return null;
    const val = parseFloat(form.value);
    if (form.type === 'percent') return amount * val / 100;
    return Math.min(val, amount);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className='page-title font-headline'>Promo &amp; Diskon</h1>
          <p className='page-subtitle'>{discounts.length} kode diskon terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="add" size={16} /> Tambah Diskon
        </button>
      </div>

      {/* How-to */}
      <div className="card" style={{ marginBottom: 20, padding: 14, background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.2)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>💡 Cara Pakai Kode Diskon</div>
        <p style={{ fontSize: 12, color: 'var(--outline)', lineHeight: 1.7 }}>
          Kasir dapat memasukkan kode diskon di layar <strong>Kasir / POS</strong> sebelum proses pembayaran.
          Diskon akan otomatis dipotong dari total belanja. Kode bersifat case-insensitive.
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Promo</th>
                <th>Tipe</th>
                <th>Nilai</th>
                <th>Min. Belanja</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : discounts.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <Icon name="sell" size={40} />
                    <h3>Belum ada kode diskon</h3>
                    <p>Buat promo untuk menarik lebih banyak pelanggan</p>
                  </div>
                </td></tr>
              ) : discounts.map(d => (
                <tr key={d.id}>
                  <td>
                    <code style={{
                      background: 'var(--surface-container-low)', padding: '3px 8px',
                      borderRadius: 4, fontSize: 13, fontWeight: 700,
                      color: d.is_active ? 'var(--primary)' : 'var(--outline)',
                      letterSpacing: 1
                    }}>{d.code}</code>
                  </td>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td>
                    <span className={`badge ${d.type === 'percent' ? 'badge-blue' : 'badge-green'}`}>
                      {d.type === 'percent' ? '% Persen' : 'Rp Nominal'}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    {d.type === 'percent' ? `${d.value}%` : formatRupiah(d.value)}
                  </td>
                  <td className="mono" style={{ fontSize: 13 }}>
                    {d.min_purchase > 0 ? formatRupiah(d.min_purchase) : <span style={{ color: 'var(--outline)' }}>—</span>}
                  </td>
                  <td>
                    <button onClick={() => toggleActive(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: d.is_active ? '#1a7a3c' : 'var(--outline)' }}>
                      {d.is_active ? <Icon name="toggle_on" size={22} /> : <Icon name="toggle_off" size={22} />}
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{d.is_active ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => openEdit(d)}>
                        <Icon name="edit" size={14} />
                      </button>
                      <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(d)}>
                        <Icon name="delete" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editItem ? '✏️ Edit Diskon' : '🏷️ Tambah Diskon'}</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><Icon name="close" size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div className="input-group">
                    <label className="input-label">Kode Diskon *</label>
                    <input className="input mono" style={{ letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}
                      placeholder="HEMAT10" value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Nama Promo *</label>
                    <input className="input" placeholder="cth: Diskon Hari Raya 10%"
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Tipe Diskon</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { id: 'percent', label: '% Persentase', desc: 'Contoh: 10% dari total' },
                      { id: 'fixed', label: 'Rp Nominal', desc: 'Contoh: Potongan Rp 5.000' },
                    ].map(t => (
                      <button key={t.id} type="button"
                        onClick={() => setForm(f => ({ ...f, type: t.id }))}
                        style={{
                          padding: 12, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          border: `2px solid ${form.type === t.id ? 'var(--primary)' : 'var(--outline-variant)'}`,
                          background: form.type === t.id ? 'rgba(249,115,22,0.08)' : 'var(--surface-container-low)',
                          color: form.type === t.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</div>
                        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="input-group">
                    <label className="input-label">
                      {form.type === 'percent' ? 'Nilai (%)' : 'Nilai (Rp)'} *
                    </label>
                    <input className="input mono" type="number" min="0"
                      placeholder={form.type === 'percent' ? 'cth: 10' : 'cth: 5000'}
                      value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Min. Pembelian (Rp)</label>
                    <input className="input mono" type="number" min="0" placeholder="0"
                      value={form.min_purchase} onChange={e => setForm(f => ({ ...f, min_purchase: e.target.value }))} />
                  </div>
                </div>

                {/* Preview */}
                {form.value && (
                  <div style={{ padding: 12, background: 'var(--surface-container-low)', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--on-surface-variant)' }}>Preview (belanja Rp 100.000)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--outline)' }}>Potongan</span>
                      <span className="mono" style={{ color: 'var(--error)', fontWeight: 700 }}>
                        — {previewDiscount() !== null ? `Rp ${previewDiscount()?.toLocaleString('id-ID')}` : '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ color: 'var(--outline)' }}>Bayar</span>
                      <span className="mono" style={{ color: '#1a7a3c', fontWeight: 800 }}>
                        Rp {(100000 - (previewDiscount() || 0)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-container-low)', borderRadius: 8 }}>
                  <input type="checkbox" id="is_active" checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                  <label htmlFor="is_active" style={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                    Aktifkan kode diskon ini
                  </label>
                </div>
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
    </div>
  );
}
