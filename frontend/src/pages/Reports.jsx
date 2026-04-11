import { useState, useEffect } from 'react';
import api, { formatRupiah } from '../utils/api';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import Icon from '../components/Icon';

export default function Reports() {
  const { t } = useI18n();
  const today     = new Date().toISOString().slice(0, 10);
  const firstDay  = today.slice(0, 8) + '01';
  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo,   setDateTo]   = useState(today);
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  const fetch = async () => {
    if (dateTo < dateFrom) {
      toast.error('Tanggal akhir tidak boleh lebih kecil dari tanggal awal');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/reports/profit', { params: { date_from: dateFrom, date_to: dateTo } });
      setData(res.data.data);
    } catch { toast.error('Gagal memuat laporan'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const s = data?.summary;
  const maxRev = data?.daily?.length ? Math.max(...data.daily.map(d => d.rev), 1) : 1;

  const MetricCard = ({ label, value, sub, color = 'var(--primary)', bg = 'var(--primary-fixed)' }) => (
    <div className="card" style={{ borderTop: `3px solid ${color}`, position: 'relative', overflow: 'hidden' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>{label}</p>
      <p className="font-headline" style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--outline)' }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ padding: '32px', maxWidth: 1200 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title font-headline">Laporan Laba Rugi</h1>
          <p className="page-subtitle">Analisis pendapatan, HPP, dan margin keuntungan</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group">
            <label className="input-label">Dari</label>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ minWidth: 140 }} />
          </div>
          <div className="input-group">
            <label className="input-label">Sampai</label>
            <input className="input" type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} style={{ minWidth: 140 }} />
          </div>
          <button className="btn btn-primary" onClick={fetch} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <><Icon name="search" size={16} /> Tampilkan</>}
          </button>
        </div>
      </div>

      {!data && !loading && (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <Icon name="analytics" size={18} />
          <h3>Pilih periode dan klik Tampilkan</h3>
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16, marginBottom: 28 }}>
            <MetricCard label={t('report.revenue')} value={formatRupiah(s?.total_revenue)} sub={`${s?.tx_count} transaksi · ${s?.items_sold} item`} color="var(--primary)" />
            <MetricCard label={t('report.cogs')} value={formatRupiah(s?.total_cogs)} sub="Biaya modal semua item terjual" color="var(--tertiary)" bg="#ffdbcc" />
            <MetricCard label={t('report.profit_g')} value={formatRupiah(s?.gross_profit)} sub={`Margin ${(s?.margin_pct || 0).toFixed(1)}%`}
              color={s?.gross_profit >= 0 ? '#1a7a3c' : 'var(--error)'}
              bg={s?.gross_profit >= 0 ? '#d4f4e1' : 'var(--error-container)'} />
            <MetricCard label="Rata-rata / Transaksi" value={formatRupiah(s?.avg_ticket)} sub="Average transaction value" color="var(--secondary)" />
          </div>

          {/* Profit margin visual */}
          {(s?.total_revenue || 0) > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <p className="font-headline" style={{ fontWeight: 700, marginBottom: 12 }}>Komposisi Pendapatan</p>
              <div style={{ position: 'relative', height: 40, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-container)' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min((s.total_cogs / s.total_revenue) * 100, 100)}%`, background: '#a04101', transition: 'width .5s' }} />
                <div style={{ position: 'absolute', left: `${Math.min((s.total_cogs / s.total_revenue) * 100, 100)}%`, top: 0, bottom: 0, right: 0, background: '#1a7a3c', transition: 'all .5s' }} />
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#a04101', borderRadius: 2, display: 'inline-block' }} /> HPP {((s.total_cogs / s.total_revenue) * 100).toFixed(1)}%</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#1a7a3c', borderRadius: 2, display: 'inline-block' }} /> Laba {(s.margin_pct || 0).toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Daily bar chart */}
          {data.daily?.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p className="font-headline" style={{ fontWeight: 700 }}>Tren Harian</p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--primary)', borderRadius: 2 }} /> Penjualan</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: '#1a7a3c', borderRadius: 2 }} /> Laba</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, overflowX: 'auto', paddingBottom: 24, position: 'relative' }}>
                {data.daily.map(d => (
                  <div key={d.day} style={{ flex: `0 0 ${Math.max(36, 600 / data.daily.length)}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}
                    title={`${d.day}\nPenjualan: ${formatRupiah(d.rev)}\nLaba: ${formatRupiah(d.profit)}`}>
                    <div style={{ width: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', background: 'var(--primary)', borderRadius: '3px 3px 0 0', height: `${(d.rev / maxRev) * 100}%`, minHeight: d.rev > 0 ? 4 : 0, transition: 'height .3s' }} />
                      <div style={{ width: '60%', background: '#1a7a3c', borderRadius: '3px 3px 0 0', height: `${(Math.max(d.profit,0) / maxRev) * 100}%`, minHeight: d.profit > 0 ? 3 : 0, position: 'absolute', bottom: 24, transition: 'height .3s', opacity: .75 }} />
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--outline)', whiteSpace: 'nowrap', position: 'absolute', bottom: 4 }}>
                      {d.day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By category */}
          {data.by_category?.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px 14px' }}>
                <p className="font-headline" style={{ fontWeight: 700, fontSize: 15 }}>Laba per Kategori</p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kategori</th>
                      <th>Penjualan</th>
                      <th>HPP</th>
                      <th>Laba Kotor</th>
                      <th>Margin</th>
                      <th>Item Terjual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_category.map(c => (
                      <tr key={c.category_name}>
                        <td style={{ fontWeight: 600 }}>{c.category_name}</td>
                        <td className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>{formatRupiah(c.revenue)}</td>
                        <td className="mono" style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{formatRupiah(c.cogs)}</td>
                        <td className="mono" style={{ fontWeight: 700, color: c.profit >= 0 ? '#1a7a3c' : 'var(--error)' }}>{formatRupiah(c.profit)}</td>
                        <td>
                          <span className={`badge ${c.margin_pct >= 20 ? 'badge-green' : c.margin_pct >= 10 ? 'badge-teal' : 'badge-red'}`}>
                            {c.margin_pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="mono" style={{ fontWeight: 600 }}>{c.items_sold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
