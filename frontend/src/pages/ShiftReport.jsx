import { useState, useEffect } from 'react';
import api, { formatRupiah } from '../utils/api';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

export default function ShiftReport() {
  const { t } = useI18n();
	const { isAdmin } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo,   setDateTo]   = useState(today);
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
	const [activeShift, setActiveShift] = useState(null);
	const [shiftLoading, setShiftLoading] = useState(false);

	const loadMyShift = async () => {
		try { const res = await api.get('/shifts/me'); setActiveShift(res.data.data || null); } catch { /* keep page usable */ }
	};
	const openShift = async () => {
		const raw = window.prompt('Kas awal shift (Rp):', '0'); if (raw === null) return;
		const cash = Number(raw); if (!Number.isFinite(cash) || cash < 0) return toast.error('Kas awal tidak valid');
		setShiftLoading(true); try { await api.post('/shifts/open', { cash, note: '' }); toast.success('Shift dibuka'); loadMyShift(); } catch (e) { toast.error(e.response?.data?.error || 'Gagal membuka shift'); } finally { setShiftLoading(false); }
	};
	const closeShift = async () => {
		const raw = window.prompt('Kas fisik saat tutup shift (Rp):'); if (raw === null) return;
		const cash = Number(raw); if (!Number.isFinite(cash) || cash < 0) return toast.error('Kas fisik tidak valid');
		const note = window.prompt('Catatan selisih (opsional):', '') || '';
		setShiftLoading(true); try { const res = await api.post('/shifts/close', { cash, note }); const d=res.data.data; toast.success(`Shift ditutup. Selisih: ${formatRupiah(d.difference)}`); loadMyShift(); if (isAdmin()) fetch(); } catch (e) { toast.error(e.response?.data?.error || 'Gagal menutup shift'); } finally { setShiftLoading(false); }
	};

  const fetch = async () => {
    if (dateTo < dateFrom) {
      toast.error('Tanggal akhir tidak boleh lebih kecil dari tanggal awal');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/reports/shift', { params: { date_from: dateFrom, date_to: dateTo } });
      setData(res.data.data);
    } catch { toast.error('Gagal memuat laporan shift'); }
    finally { setLoading(false); }
  };

	useEffect(() => { loadMyShift(); if (isAdmin()) fetch(); }, []);

  const maxRev = data?.reports?.length ? Math.max(...data.reports.map(r => r.total_revenue), 1) : 1;

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">Laporan per Kasir / Shift</h1>
          <p className="page-subtitle">Performa penjualan per kasir dalam periode tertentu</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div className="input-group"><label className="input-label">Dari</label>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ minWidth:140 }} />
          </div>
          <div className="input-group"><label className="input-label">Sampai</label>
            <input className="input" type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} style={{ minWidth:140 }} />
          </div>
          <button className="btn btn-primary" onClick={fetch} disabled={loading}>
            {loading ? <span className="spinner" style={{ width:18, height:18, borderWidth:2 }} />
              : <><Icon name="search" size={16} /> Tampilkan</>}
          </button>
        </div>
      </div>

	  <section className="card" style={{ marginBottom: 22, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
		<div><h2 style={{ fontSize:16, fontWeight:800 }}>Shift Kasir</h2><p style={{ fontSize:13, color:'var(--outline)', marginTop:4 }}>{activeShift ? `Aktif sejak ${activeShift.opened_at} · Kas awal ${formatRupiah(activeShift.opening_cash)}` : 'Belum ada shift aktif'}</p></div>
		{activeShift ? <button className="btn btn-danger" disabled={shiftLoading} onClick={closeShift}>Tutup Shift</button> : <button className="btn btn-success" disabled={shiftLoading} onClick={openShift}>Buka Shift</button>}
	  </section>

	  {isAdmin() && data && (
        <>
          {/* Summary row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:14, marginBottom:24 }}>
            {[
              { label:'Total Transaksi', value: data.total_tx, icon:'receipt_long', color:'var(--primary)' },
              { label:'Total Penjualan', value: formatRupiah(data.total_revenue), icon:'payments', color:'var(--secondary)' },
              { label:'Total Laba',      value: formatRupiah(data.total_profit),  icon:'trending_up', color:'#1a7a3c' },
              { label:'Transaksi Batal', value: data.total_cancel, icon:'cancel', color:'var(--error)' },
            ].map(c => (
              <div key={c.label} className="card" style={{ borderTop:`3px solid ${c.color}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--on-surface-variant)', textTransform:'uppercase', letterSpacing:'.07em' }}>{c.label}</p>
                  <Icon name={c.icon} size={20} color={c.color} filled />
                </div>
                <p className="font-headline" style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Per-kasir cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {data.reports?.map((r, i) => (
              <div key={r.user_id} className="card">
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:`hsl(${(r.user_id*67)%360},60%,45%)`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:18, flexShrink:0 }}>
                    {r.username?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div className="font-headline" style={{ fontWeight:800, fontSize:16 }}>{r.username}</div>
                    <div style={{ fontSize:12, color:'var(--outline)' }}>{r.tx_count} transaksi · {r.cancelled_count} dibatalkan</div>
                  </div>
                  {i === 0 && data.reports.length > 1 && (
                    <span style={{ padding:'4px 12px', background:'var(--primary-fixed)', color:'var(--primary)', fontSize:11, fontWeight:700, borderRadius:100 }}>🏆 Tertinggi</span>
                  )}
                </div>

                {/* Bar comparison */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--outline)', marginBottom:4 }}>
                    <span>Penjualan</span><span className="mono" style={{ fontWeight:700, color:'var(--primary)' }}>{formatRupiah(r.total_revenue)}</span>
                  </div>
                  <div style={{ height:8, background:'var(--surface-container)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(r.total_revenue/maxRev)*100}%`, background:'var(--primary)', borderRadius:4, transition:'width .4s' }} />
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[
                    { label:'Laba', value: formatRupiah(r.total_profit), color:'#1a7a3c' },
                    { label:'Rata-rata', value: formatRupiah(r.avg_ticket), color:'var(--secondary)' },
                    { label:'Dibatalkan', value: r.cancelled_count + ' tx', color: r.cancelled_count > 0 ? 'var(--error)' : 'var(--outline)' },
                  ].map(m => (
                    <div key={m.label} style={{ padding:'8px 10px', background:'var(--surface-container-low)', borderRadius:8, textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'var(--outline)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{m.label}</div>
                      <div className="mono" style={{ fontWeight:800, fontSize:14, color:m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
