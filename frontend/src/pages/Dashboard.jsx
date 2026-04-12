import { useState, useEffect } from 'react';
import api, { formatRupiah } from '../utils/api';
import { useI18n } from '../context/I18nContext';
import Icon from '../components/Icon';

export default function Dashboard() {
  const { t } = useI18n();
  const [stats, setStats]       = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading]   = useState(true);

  const handleExportData = async () => {
    try {
      const response = await api.get('/export/transactions', { responseType: 'blob' });
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) { // feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transaksi_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Gagal mengexport data: ' + (error.response?.data?.error || error.message));
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch stats (includes low_stock_products count)
        const sRes = await api.get('/dashboard/stats');
        setStats(sRes.data.data);
      } catch (err) {
        console.error('Dashboard stats error:', err);
      }
      try {
        // Fetch low stock products separately with low_stock filter
        const pRes = await api.get('/products', { params: { low_stock: '1', limit: 50 } });
        setLowStock(pRes.data.data || []);
      } catch (err) {
        console.error('Low stock fetch error:', err);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="loading-screen" style={{ minHeight: '100dvh' }}><div className="spinner" /></div>;

  const cards = [
    { label: t('dash.today_revenue'), value: formatRupiah(stats?.today_revenue || 0), sub: `${stats?.today_transactions || 0} transaksi hari ini`, icon: 'calendar_today', color: 'var(--primary)', bg: 'var(--primary-fixed)' },
    { label: t('dash.today_profit'),       value: formatRupiah(stats?.today_profit || 0),  sub: 'Omset - HPP hari ini', icon: 'trending_up', color: '#1a7a3c', bg: '#d4f4e1' },
    { label: t('dash.gross_profit'),    value: formatRupiah(stats?.gross_profit || 0),  sub: `Margin ${stats?.total_revenue > 0 ? ((stats.gross_profit/stats.total_revenue)*100).toFixed(1) : 0}%`, icon: 'savings', color: 'var(--secondary)', bg: 'var(--secondary-container)' },
    { label: t('dash.total_products'),        value: stats?.total_products || 0,              sub: 'SKU terdaftar', icon: 'inventory_2', color: 'var(--outline)', bg: 'var(--surface-container)' },
    { label: t('dash.low_stock'),    value: stats?.low_stock_products || 0,          sub: 'per-produk, perlu restok', icon: 'warning', color: 'var(--tertiary)', bg: '#ffdbcc' },
  ];

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: 1280 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard Overview</h2>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/reports" style={{ textDecoration: 'none' }}>
            <button className="btn btn-ghost" style={{ gap: 6 }}>
              <Icon name="analytics" size={16} />
              Laporan Laba Rugi
            </button>
          </a>
          <button className="btn btn-tonal" style={{ gap: 6 }} onClick={handleExportData}>
            <Icon name="download" size={18} />
            Export Data
          </button>
        </div>
      </div>

      {/* Stat Cards — bento grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 28 }}>
        {cards.map(c => (
          <div key={c.label} className="card" style={{ position: 'relative', overflow: 'hidden', borderTop: `3px solid ${c.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1.3, maxWidth: 120 }}>{c.label}</p>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={c.icon} size={20} color={c.color} filled />
              </div>
            </div>
            <div className="font-headline" style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1, marginBottom: 5 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--outline)' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Main bento grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Weekly bar chart — real data from API */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--primary)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 className="font-headline" style={{ fontSize: 16, fontWeight: 800 }}>Tren Transaksi Mingguan</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--on-surface-variant)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--primary-fixed)', display: 'inline-block', border: '1px solid var(--primary)' }} /> Penjualan
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--on-surface-variant)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1a7a3c', display: 'inline-block' }} /> Laba
              </span>
            </div>
          </div>
          <BarChart stats={stats} />
        </div>

        {/* Quick stats right col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ position: 'relative', overflow: 'hidden', flex: 1 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--secondary)' }} />
            <h3 className="font-headline" style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Ringkasan Cepat</h3>
            {[
              { label: 'Rata-rata per transaksi', value: stats?.total_transactions > 0 ? formatRupiah(stats.total_revenue / stats.total_transactions) : 'Rp 0' },
              { label: 'Produk stok habis', value: (lowStock.filter(p => p.stock === 0).length) + ' produk', color: 'var(--error)' },
              { label: 'Produk stok menipis', value: (lowStock.filter(p => p.stock > 0).length) + ' produk', color: 'var(--tertiary)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{r.label}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: r.color || 'var(--on-surface)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low stock table */}
      {lowStock.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="font-headline" style={{ fontSize: 17, fontWeight: 800 }}>⚠️ Peringatan Stok Rendah</h3>
              <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                {lowStock.length} item perlu segera direstok
              </p>
            </div>
            <span style={{ padding: '5px 14px', background: 'var(--error-container)', color: 'var(--error)', fontWeight: 700, fontSize: 11, borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.06em', animation: 'pulse 2s infinite' }}>
              PERHATIAN
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Detail Produk</th>
                  <th>Barcode / SKU</th>
                  <th>Stok Saat Ini</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: p.stock === 0 ? 'var(--error-container)' : '#fff3cd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name="{p.stock === 0 ? 'do_not_disturb_on' : 'warning'}" size={18} />
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--outline)' }}>{formatRupiah(p.sell_price)}</p>
                        </div>
                      </div>
                    </td>
                    <td><code style={{ fontSize: 11, background: 'var(--surface-container)', padding: '2px 6px', borderRadius: 4 }}>{p.barcode_sku}</code></td>
                    <td>
                      <span className={`mono font-bold ${p.stock === 0 ? 'stock-low' : 'text-secondary'}`} style={{ fontSize: 15 }}>{p.stock}</span>
                    </td>
                    <td>
                      <span className={`badge ${p.stock === 0 ? 'badge-red' : 'badge-yellow'}`}>
                        {p.stock === 0 ? 'HABIS' : 'MENIPIS'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
                        onClick={() => window.location.href = '/stock'}>
                        <Icon name="add_circle" size={14} />
                        {t('dash.restock')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ marginTop: 20, background: 'var(--primary-fixed)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Icon name="tips_and_updates" size={18} color="var(--primary)" />
          <span className="font-headline" style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>Tips Penggunaan</span>
        </div>
        <ul style={{ fontSize: 13, color: 'var(--primary)', paddingLeft: 20, lineHeight: 2.1 }}>
          <li>Kasir bisa login dari HP via WiFi/hotspot yang sama dengan PC Server</li>
          <li>Scan barcode dengan scanner USB/Bluetooth di menu <strong>Kasir / POS</strong></li>
          <li>Backup database rutin di menu <strong>Pengaturan</strong> untuk keamanan data</li>
          <li>Upload gambar QRIS toko agar muncul di layar kasir saat pembayaran QRIS</li>
        </ul>
      </div>
    </div>
  );
}

function BarChart({ stats }) {
  const weekly = stats?.weekly_data || [];
  const maxRev = weekly.length ? Math.max(...weekly.map(d => d.revenue), 1) : 1;
  const today  = new Date().toISOString().slice(0, 10);
  const maxH   = 110;

  if (!weekly.length) {
    return (
      <div style={{ height: maxH + 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--outline)', fontSize: 13 }}>
        Belum ada data transaksi minggu ini
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: maxH + 28, paddingTop: 8 }}>
      {weekly.map((d) => {
        const isToday   = d.date === today;
        const revPct    = maxRev > 0 ? (d.revenue / maxRev) * 100 : 0;
        const profitPct = maxRev > 0 ? (Math.max(d.profit, 0) / maxRev) * 100 : 0;
        return (
          <div key={d.date} title={`${d.date}\nPenjualan: Rp ${d.revenue.toLocaleString('id-ID')}\nLaba: Rp ${d.profit.toLocaleString('id-ID')}\n${d.tx_count} transaksi`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <div style={{ width: '100%', position: 'relative', height: maxH }}>
              {/* Revenue bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${revPct}%`, minHeight: d.revenue > 0 ? 4 : 0,
                background: isToday ? 'var(--primary)' : 'var(--primary-fixed)',
                borderRadius: '4px 4px 2px 2px', transition: 'height .4s ease',
              }} />
              {/* Profit bar overlay */}
              {d.profit > 0 && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '15%', right: '15%',
                  height: `${profitPct}%`, minHeight: 3,
                  background: '#1a7a3c', borderRadius: '3px 3px 0 0', opacity: 0.7,
                  transition: 'height .4s ease',
                }} />
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--primary)' : 'var(--outline)', letterSpacing: '0.04em' }}>
              {d.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}
