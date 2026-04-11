import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';

export default function Suppliers() {
  const { t } = useI18n();
  const [suppliers, setSuppliers] = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [form,      setForm]      = useState({ name:'', phone:'', address:'', contact_name:'' });
  const [saving,    setSaving]    = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers', { params: { search } });
      setSuppliers(res.data.data || []);
    } catch { toast.error('Gagal memuat supplier'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    if (!form.name) { toast.error('Nama supplier wajib diisi'); return; }
    setSaving(true);
    try {
      if (editItem) { await api.put(`/suppliers/${editItem.id}`, form); toast.success('Supplier diupdate'); }
      else { await api.post('/suppliers', form); toast.success('Supplier ditambahkan'); }
      setShowModal(false); setEditItem(null); setForm({ name:'', phone:'', address:'', contact_name:'' }); fetch();
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Hapus supplier "${s.name}"?`)) return;
    await api.delete(`/suppliers/${s.id}`); toast.success('Dihapus'); fetch();
  };

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">Manajemen Supplier</h1>
          <p className="page-subtitle">{suppliers.length} supplier terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ name:'',phone:'',address:'',contact_name:'' }); setShowModal(true); }}>
          <Icon name="add_business" size={16} /> Tambah Supplier
        </button>
      </div>

      <div style={{ marginBottom:14, position:'relative', maxWidth:320 }}>
        <Icon name="search" size={16} color="var(--outline)" />
        <input className="input" style={{ paddingLeft:38 }} placeholder="Cari nama / kontak..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
        {loading ? <div className="spinner" style={{ margin:'40px auto' }} />
        : suppliers.length === 0 ? (
          <div className="empty-state" style={{ gridColumn:'1/-1' }}>
            <Icon name="local_shipping" size={18} />
            <h3>Belum ada supplier</h3>
            <p>Tambah data supplier untuk tracking pembelian barang</p>
          </div>
        ) : suppliers.map(s => (
          <div key={s.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'var(--primary-fixed)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon name="local_shipping" size={20} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
                  {s.contact_name && <div style={{ fontSize:12, color:'var(--outline)' }}>{s.contact_name}</div>}
                </div>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <button className="icon-btn" onClick={() => { setEditItem(s); setForm({ name:s.name, phone:s.phone, address:s.address, contact_name:s.contact_name }); setShowModal(true); }}>
                  <Icon name="edit" size={16} />
                </button>
                <button className="icon-btn" style={{ color:'var(--error)' }} onClick={() => handleDelete(s)}>
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
            {s.phone && (
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--on-surface-variant)' }}>
                <Icon name="call" size={15} /> {s.phone}
              </div>
            )}
            {s.address && (
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--outline)', marginTop:4 }}>
                <Icon name="location_on" size={14} /> {s.address}
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Supplier' : 'Tambah Supplier'}</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { key:'name',         label:'Nama Perusahaan *', ph:'cth: PT Sumber Rejeki' },
                  { key:'contact_name', label:'Nama Kontak',       ph:'cth: Pak Budi' },
                  { key:'phone',        label:'Nomor Telepon',      ph:'cth: 021-1234567' },
                  { key:'address',      label:'Alamat',             ph:'Jl. Raya No. 1...' },
                ].map(f => (
                  <div key={f.key} className="input-group">
                    <label className="input-label">{f.label}</label>
                    <input className="input" placeholder={f.ph} value={form[f.key]} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width:18, height:18, borderWidth:2 }} /> : editItem ? 'Update' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
