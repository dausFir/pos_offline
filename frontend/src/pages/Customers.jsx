import { useState, useEffect, useCallback } from 'react';
import api, { formatRupiah, formatDate } from '../utils/api';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';

export default function Customers() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [form,      setForm]      = useState({ name: '', phone: '', address: '' });
  const [saving,    setSaving]    = useState(false);
  const [debtView,  setDebtView]  = useState(null); // { customer, ledger }
  const [payModal,  setPayModal]  = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote,   setPayNote]   = useState('');
  const [paying,    setPaying]    = useState(false);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers', { params: { search, page, limit } });
      setCustomers(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Gagal memuat pelanggan'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { setPage(1); }, [search]);

  const openDebt = async (c) => {
    try {
      const res = await api.get(`/customers/${c.id}/debt`);
      setDebtView(res.data.data);
    } catch { toast.error('Gagal memuat hutang'); }
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Nama pelanggan wajib diisi'); return; }
    setSaving(true);
    try {
      if (editItem) { await api.put(`/customers/${editItem.id}`, form); toast.success('Pelanggan diupdate'); }
      else { await api.post('/customers', form); toast.success('Pelanggan ditambahkan'); }
      setShowModal(false); setForm({ name: '', phone: '', address: '' }); setEditItem(null); fetch();
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal simpan'); }
    finally { setSaving(false); }
  };

  const handlePay = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error('Jumlah bayar harus > 0'); return; }
    setPaying(true);
    try {
      await api.post('/customers/debt-payment', { customer_id: payModal.id, amount: amt, note: payNote });
      toast.success('Pembayaran hutang dicatat');
      setPayModal(null); setPayAmount(''); setPayNote('');
      fetch();
      if (debtView) { const res = await api.get(`/customers/${debtView.customer.id}/debt`); setDebtView(res.data.data); }
    } catch (err) { toast.error(err.response?.data?.error || 'Gagal catat pembayaran'); }
    finally { setPaying(false); }
  };

  const printDebtNote = (customer) => {
    const settings_data = {};
    api.get('/settings').then(r => {
      const s = r.data.data || {};
      const win = window.open('', '_blank', 'width=320,height=500');
      if (!win) { toast.error('Popup diblokir browser. Izinkan popup untuk mencetak.'); return; }
      const now = new Date().toLocaleString('id-ID');
      win.document.write(`<!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <style>
          body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px}
          .center{text-align:center} .bold{font-weight:bold} .line{border-top:1px dashed #000;margin:6px 0}
          .big{font-size:16px;font-weight:bold} .row{display:flex;justify-content:space-between}
        </style>
      </head><body>
        <div class="center bold" style="font-size:14px">${s.store_name || 'Kasir UMKM'}</div>
        ${s.store_address ? `<div class="center">${s.store_address}</div>` : ''}
        <div class="line"></div>
        <div class="center bold">NOTA HUTANG</div>
        <div class="line"></div>
        <div class="row"><span>Pelanggan</span><span>${customer.name}</span></div>
        ${customer.phone ? `<div class="row"><span>Telepon</span><span>${customer.phone}</span></div>` : ''}
        <div class="row"><span>Tanggal</span><span>${now}</span></div>
        <div class="line"></div>
        <div class="row"><span class="bold">Total Hutang</span><span class="big">Rp ${customer.debt_balance.toLocaleString('id-ID')}</span></div>
        <div class="line"></div>
        <br/>
        <div>Tanda Tangan Pelanggan:</div>
        <br/><br/><br/>
        <div>_______________________</div>
        <div>${customer.name}</div>
        <div class="line"></div>
        <div class="center" style="font-size:10px">Dicetak: ${now}</div>
      </body></html>`);
      win.document.close();
      setTimeout(() => { win.focus(); win.print(); win.close(); }, 400);
    }).catch(() => toast.error('Gagal memuat pengaturan untuk cetak'));
  };

  const handleDelete = async (c) => {
    if (c.debt_balance > 0) { toast.error('Tidak bisa hapus pelanggan yang masih punya hutang'); return; }
    if (!confirm(`Hapus pelanggan "${c.name}"?`)) return;
    await api.delete(`/customers/${c.id}`); toast.success('Dihapus'); fetch();
  };

  const totalPages = Math.ceil(total / limit);
  const totalDebt = customers.reduce((s, c) => s + c.debt_balance, 0);

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">Pelanggan & Piutang</h1>
          <p className="page-subtitle">{total} pelanggan · Hutang aktif: <span style={{ color: 'var(--error)', fontWeight: 700 }}>{formatRupiah(totalDebt)}</span></p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ name:'',phone:'',address:'' }); setShowModal(true); }}>
          <Icon name="person_add" size={16} /> Tambah Pelanggan
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14, position: 'relative', maxWidth: 320 }}>
        <Icon name="search" size={16} color="var(--outline)" />
        <input className="input" style={{ paddingLeft: 38 }} placeholder="Cari nama / nomor HP..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nama</th><th>Telepon</th><th>Total Belanja</th><th>Hutang</th><th>Transaksi</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ margin:'0 auto' }} /></td></tr>
              : customers.length === 0 ? <tr><td colSpan={6}>
                  <div className="empty-state">
                    <Icon name="group" size={18} /><h3>Belum ada pelanggan</h3>
                  </div></td></tr>
              : customers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div>{c.name}</div>
                    {c.address && <div style={{ fontSize: 11, color: 'var(--outline)' }}>{c.address}</div>}
                  </td>
                  <td style={{ fontSize: 13 }}>{c.phone || '—'}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatRupiah(c.total_spend)}</td>
                  <td>
                    <span className="mono" style={{ fontWeight: 800, color: c.debt_balance > 0 ? 'var(--error)' : '#1a7a3c', fontSize: 14 }}>
                      {formatRupiah(c.debt_balance)}
                    </span>
                    {c.debt_balance > 0 && (
                      <button className="btn btn-success" style={{ padding:'3px 10px', fontSize:11, marginLeft:8 }} onClick={() => { setPayModal(c); setPayAmount(''); setPayNote(''); }}>
                        Bayar
                      </button>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 13 }}>{c.tx_count}×</td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-ghost" style={{ padding:'5px 8px' }} onClick={() => openDebt(c)} title={t('cust.debt_history')}>
                        <Icon name="receipt_long" size={15} />
                      </button>
                      <button className="btn btn-ghost" style={{ padding:'5px 8px' }} onClick={() => { setEditItem(c); setForm({ name:c.name, phone:c.phone, address:c.address }); setShowModal(true); }}>
                        <Icon name="edit" size={15} />
                      </button>
                      <button className="btn btn-danger" style={{ padding:'5px 8px' }} onClick={() => handleDelete(c)}>
                        <Icon name="delete" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--outline-variant)', display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost" disabled={page===1} onClick={() => setPage(p=>p-1)} style={{ padding:'6px 14px' }}>← Prev</button>
            <button className="btn btn-ghost" disabled={page===totalPages} onClick={() => setPage(p=>p+1)} style={{ padding:'6px 14px' }}>Next →</button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="input-group">
                  <label className="input-label">Nama *</label>
                  <input className="input" placeholder="Nama lengkap pelanggan" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">No. Telepon</label>
                  <input className="input" placeholder="cth: 08123456789" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Alamat</label>
                  <input className="input" placeholder="Alamat (opsional)" value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width:18,height:18,borderWidth:2 }} /> : editItem ? 'Update' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt payment modal */}
      {payModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">💳 Catat Pembayaran Hutang</span>
              <button className="icon-btn" onClick={() => setPayModal(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding:'12px 14px', background:'var(--error-container)', borderRadius:10, marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--error)', marginBottom:4 }}>{payModal.name}</div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color:'var(--on-error-container)' }}>Sisa hutang</span>
                  <span className="mono" style={{ fontWeight:800, fontSize:18, color:'var(--error)' }}>{formatRupiah(payModal.debt_balance)}</span>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="input-group">
                  <label className="input-label">Jumlah Bayar (Rp) *</label>
                  <input className="input mono" style={{ fontSize:20, fontWeight:800, textAlign:'right' }}
                    type="number" min="1" max={payModal.debt_balance} placeholder="0"
                    value={payAmount} onChange={e => setPayAmount(e.target.value)} autoFocus />
                  <div style={{ display:'flex', gap:8, marginTop:6 }}>
                    {[payModal.debt_balance, payModal.debt_balance/2, payModal.debt_balance/4].filter(v=>v>0).map(v=>(
                      <button key={v} className="btn btn-tonal" style={{ flex:1, fontSize:12 }} onClick={() => setPayAmount(String(Math.round(v)))}>
                        {formatRupiah(Math.round(v))}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Keterangan</label>
                  <input className="input" placeholder="cth: Bayar hutang tgl 1" value={payNote} onChange={e => setPayNote(e.target.value)} />
                </div>
                {parseFloat(payAmount) > 0 && (
                  <div style={{ padding:'10px 14px', background:'#d4f4e1', borderRadius:8, display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, color:'#1a7a3c', fontWeight:600 }}>Sisa setelah bayar</span>
                    <span className="mono" style={{ fontWeight:800, color:'#1a7a3c' }}>{formatRupiah(payModal.debt_balance - (parseFloat(payAmount)||0))}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPayModal(null)}>Batal</button>
              <button className="btn btn-success" onClick={handlePay} disabled={paying || !payAmount || parseFloat(payAmount) <= 0}>
                {paying ? <span className="spinner" style={{ width:18,height:18,borderWidth:2 }} /> : '✓ Catat Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt history modal */}
      {debtView && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <span className="modal-title">📋 Riwayat Hutang</span>
                <div style={{ fontSize:12, color:'var(--outline)', marginTop:2 }}>{debtView.customer?.name}</div>
              </div>
              <button className="icon-btn" onClick={() => setDebtView(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:debtView.customer?.debt_balance > 0 ? 'var(--error-container)' : '#d4f4e1', borderRadius:10, marginBottom:14 }}>
                <span style={{ fontWeight:600, fontSize:14 }}>Saldo Hutang Saat Ini</span>
                <span className="mono font-headline" style={{ fontWeight:800, fontSize:20, color: debtView.customer?.debt_balance > 0 ? 'var(--error)' : '#1a7a3c' }}>
                  {formatRupiah(debtView.customer?.debt_balance)}
                </span>
              </div>
              {debtView.ledger?.length === 0 && <p style={{ textAlign:'center', color:'var(--outline)', padding:20 }}>Belum ada riwayat</p>}
              {debtView.ledger?.map(l => (
                <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--outline-variant)' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                      <span className={`badge ${l.type==='debt' ? 'badge-red' : 'badge-green'}`}>{l.type==='debt' ? '↑ Hutang' : '↓ Bayar'}</span>
                      {l.invoice_number && <code style={{ fontSize:10, color:'var(--outline)' }}>{l.invoice_number}</code>}
                    </div>
                    <div style={{ fontSize:12, color:'var(--outline)' }}>{formatDate(l.created_at)}</div>
                    {l.note && <div style={{ fontSize:11, color:'var(--on-surface-variant)' }}>{l.note}</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="mono" style={{ fontWeight:800, fontSize:15, color: l.type==='debt' ? 'var(--error)' : '#1a7a3c' }}>
                      {l.type==='debt' ? '+' : '−'}{formatRupiah(l.amount)}
                    </div>
                    <div style={{ fontSize:11, color:'var(--outline)' }}>saldo: {formatRupiah(l.balance_after)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDebtView(null)}>Tutup</button>
              {debtView.customer?.debt_balance > 0 && (
                <button className="btn btn-success" onClick={() => { setPayModal(debtView.customer); setDebtView(null); }}>
                  💳 Catat Pembayaran
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
