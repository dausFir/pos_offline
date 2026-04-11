import { useState, useEffect, useCallback } from 'react';
import api, { formatRupiah, formatDate } from '../utils/api';
import Icon from '../components/Icon';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';
import { printReceipt, ReceiptPreview } from '../components/ThermalReceipt';

export default function Transactions() {
  const { t } = useI18n();
  const [transactions, setTransactions]   = useState([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [methodFilter, setMethodFilter]   = useState('');
  const [loading, setLoading]             = useState(true);
  const [detail, setDetail]               = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [previewTx, setPreviewTx]         = useState(null);
  const [settings, setSettings]           = useState({});
  const [cancelModal, setCancelModal]     = useState(null);
  const [cancelReason, setCancelReason]   = useState('');
  const [cancelling, setCancelling]       = useState(false);
  const limit = 20;

  // Load store settings once (for receipt header)
  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data.data || {})).catch(() => {});
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (dateFrom && dateTo && dateTo < dateFrom) {
      toast.error('Tanggal akhir tidak boleh lebih kecil dari tanggal awal');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/transactions', {
        params: { page, limit, date_from: dateFrom, date_to: dateTo, status: statusFilter, search: invoiceSearch, method: methodFilter },
      });
      setTransactions(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Gagal memuat transaksi'); }
    finally { setLoading(false); }
  }, [page, dateFrom, dateTo, statusFilter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const openDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/transactions/${id}`);
      setDetail(res.data.data);
    } catch { toast.error('Gagal memuat detail'); }
    finally { setLoadingDetail(false); }
  };

  const openPrint = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/transactions/${id}`);
      setPreviewTx(res.data.data);
    } catch { toast.error('Gagal memuat struk'); }
    finally { setLoadingDetail(false); }
  };

  const handlePrint = (width) => {
    if (!previewTx) return;
    printReceipt(previewTx, settings, width);
  };

  const openCancel = (tx) => {
    setCancelModal(tx);
    setCancelReason('');
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      await api.post(`/transactions/${cancelModal.id}/cancel`, { reason: cancelReason });
      toast.success(`Transaksi ${cancelModal.invoice_number} dibatalkan`);
      setCancelModal(null);
      setDetail(null);
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membatalkan transaksi');
    } finally { setCancelling(false); }
  };

  const totalPages = Math.ceil(total / limit);
  const pageTotal  = transactions.filter(t => t.status === 'completed').reduce((s, t) => s + t.total_amount, 0);

  const statusBadge = (status) => (
    <span className={`badge ${status === 'completed' ? 'badge-green' : 'badge-red'}`}>
      {status === 'completed' ? t('tx.completed') : t('tx.cancelled')}
    </span>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Riwayat Transaksi</h1>
        <p style={{ color: 'var(--outline)', fontSize: 13 }}>{total} transaksi ditemukan</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="input-label">Dari Tanggal</label>
            <input className="input" type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="input-label">Sampai Tanggal</label>
            <input className="input" type="date" value={dateTo} min={dateFrom}
              onChange={e => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          <div className="input-group" style={{ minWidth: 150 }}>
            <label className="input-label">Status</label>
            <select className="input" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Semua Status</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="input-label">Cari Invoice</label>
            <input className="input" placeholder="INV-..." value={invoiceSearch} onChange={e => { setInvoiceSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="input-group" style={{ minWidth: 130 }}>
            <label className="input-label">Metode</label>
            <select className="input" value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1); }}>
              <option value="">Semua Metode</option>
              <option value="cash">Tunai</option>
              <option value="qris">QRIS</option>
              <option value="split">Split</option>
            </select>
          </div>
          <button className="btn btn-ghost" onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter(''); setInvoiceSearch(''); setMethodFilter(''); setPage(1); }}>
            Reset
          </button>
          <button className="btn btn-ghost" onClick={fetchTransactions}><Icon name="refresh" size={14} /></button>

          {/* Page total */}
          <div style={{ marginLeft: 'auto', padding: '8px 14px', background: 'rgba(249,115,22,0.1)', borderRadius: 8, border: '1px solid rgba(249,115,22,0.2)' }}>
            <div style={{ fontSize: 10, color: 'var(--outline)', fontWeight: 700, textTransform: 'uppercase' }}>Total Selesai (halaman ini)</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>{formatRupiah(pageTotal)}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Waktu</th>
                <th>Kasir</th>
                <th>Metode</th>
                <th>Total</th>
                <th>Diskon</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <Icon name="receipt_long" size={40} /><h3>Belum ada transaksi</h3>
                  </div>
                </td></tr>
              ) : transactions.map(t => (
                <tr key={t.id} style={{ opacity: t.status === 'cancelled' ? 0.6 : 1 }}>
                  <td>
                    <code style={{ fontSize: 11, color: t.status === 'cancelled' ? 'var(--error)' : 'var(--on-surface-variant)' }}>
                      {t.invoice_number}
                    </code>
                  </td>
                  <td style={{ fontSize: 12 }}>{formatDate(t.created_at)}</td>
                  <td style={{ fontSize: 13 }}>{t.username || '-'}</td>
                  <td>
                    <span className={`badge ${t.payment_method === 'cash' ? 'badge-green' : 'badge-blue'}`}>
                      {t.payment_method === 'cash' ? '💵 Tunai' : '📱 QRIS'}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight: 700, color: t.status === 'cancelled' ? 'var(--outline)' : 'var(--primary)', textDecoration: t.status === 'cancelled' ? 'line-through' : 'none' }}>
                    {formatRupiah(t.total_amount)}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {t.discount_amount > 0
                      ? <span style={{ color: '#1a7a3c' }}>-{formatRupiah(t.discount_amount)}</span>
                      : <span style={{ color: 'var(--outline)' }}>—</span>
                    }
                  </td>
                  <td>{statusBadge(t.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 12 }}
                        onClick={() => openDetail(t.id)} disabled={loadingDetail} title="Lihat detail">
                        <Icon name="chevron_down" size={13} />
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 12, color: 'var(--secondary)' }}
                        onClick={() => openPrint(t.id)} disabled={loadingDetail} title="Cetak struk">
                        <Icon name="print" size={13} />
                      </button>
                      {t.status === 'completed' && (
                        <button className="btn btn-danger" style={{ padding: '5px 8px', fontSize: 12 }}
                          onClick={() => openCancel(t)} title="Batalkan transaksi">
                          <Icon name="cancel" size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--outline)' }}>Halaman {page} dari {totalPages} · {total} transaksi</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage(p => p-1)} style={{ padding: '6px 14px' }}>← Prev</button>
              <button className="btn btn-ghost" disabled={page === totalPages} onClick={() => setPage(p => p+1)} style={{ padding: '6px 14px' }}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {detail && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">📄 Detail Transaksi</div>
                <code style={{ fontSize: 11, color: 'var(--outline)' }}>{detail.invoice_number}</code>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--secondary)' }}
                  onClick={() => { setDetail(null); openPrint(detail.id); }}>
                  <Icon name="print" size={14} /> Cetak
                </button>
                {detail.status === 'completed' && (
                  <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => { setDetail(null); openCancel(detail); }}>
                    <Icon name="cancel" size={14} /> Batalkan
                  </button>
                )}
                <button className="icon-btn" onClick={() => setDetail(null)}><Icon name="close" size={20} /></button>
              </div>
            </div>
            <div className="modal-body">
              {/* Status banner */}
              {detail.status === 'cancelled' && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: 'var(--error)', marginBottom: 2 }}>❌ Transaksi Dibatalkan</div>
                  <div style={{ color: 'var(--on-surface-variant)' }}>{detail.cancel_reason}</div>
                </div>
              )}

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Kasir', value: detail.username },
                  { label: 'Waktu', value: formatDate(detail.created_at) },
                  { label: 'Metode', value: detail.payment_method === 'cash' ? '💵 Tunai' : '📱 QRIS' },
                  { label: 'Versi Data', value: `v${detail.version}` },
                ].map(row => (
                  <div key={row.label} style={{ background: 'var(--surface-container-low)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--outline)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{row.label}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.value}</div>
                  </div>
                ))}
              </div>

              {/* Items */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Item Dibeli</div>
              {detail.details?.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.product_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--outline)' }}>{formatRupiah(d.unit_price)} × {d.quantity}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 700 }}>{formatRupiah(d.subtotal)}</div>
                </div>
              ))}

              {/* Totals */}
              <div style={{ marginTop: 14, padding: 14, background: 'var(--surface-container-low)', borderRadius: 8 }}>
                {detail.discount_amount > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                      <span style={{ color: 'var(--outline)' }}>Subtotal</span>
                      <span className="mono">{formatRupiah(detail.total_amount + detail.discount_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                      <span style={{ color: '#1a7a3c' }}>Diskon ({detail.discount_code})</span>
                      <span className="mono" style={{ color: '#1a7a3c' }}>-{formatRupiah(detail.discount_amount)}</span>
                    </div>
                  </>
                )}
                {[
                  { label: 'Total Belanja', value: formatRupiah(detail.total_amount), accent: true },
                  { label: 'Uang Dibayar',  value: formatRupiah(detail.payment_amount) },
                  { label: 'Kembalian',      value: formatRupiah(detail.change_amount), green: true },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ color: 'var(--outline)', fontWeight: 600, fontSize: 14 }}>{row.label}</span>
                    <span className="mono" style={{ fontWeight: 800, fontSize: row.accent || row.green ? 17 : 14, color: row.accent ? 'var(--primary)' : row.green ? '#1a7a3c' : 'var(--on-surface)' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Audit info */}
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--outline)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Dibuat: {formatDate(detail.created_at)}</span>
                <span>Diupdate: {formatDate(detail.updated_at)}</span>
                <span>Versi: {detail.version}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Preview Modal ─────────────────────────────────────────── */}
      {previewTx && (
        <ReceiptPreview
          transaction={previewTx}
          settings={settings}
          onClose={() => setPreviewTx(null)}
          onPrint={handlePrint}
        />
      )}

      {/* ── Cancel Confirmation Modal ─────────────────────────────────────── */}
      {cancelModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Batalkan Transaksi</span>
              <button className="icon-btn" onClick={() => setCancelModal(null)}><Icon name="close" size={20} /></button>
            </div>
            <div className="modal-body">
              {/* Warning box */}
              <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--error)', marginBottom: 6, fontSize: 14 }}>Konfirmasi Pembatalan</div>
                <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
                  Transaksi <strong>{cancelModal.invoice_number}</strong> senilai{' '}
                  <strong style={{ color: 'var(--primary)' }}>{formatRupiah(cancelModal.total_amount)}</strong> akan dibatalkan.
                  <br />
                  <span style={{ color: '#1a7a3c' }}>✅ Stok semua produk akan dikembalikan otomatis.</span>
                  <br />
                  <span style={{ color: 'var(--tertiary)' }}>⚠️ Tindakan ini tidak dapat diurungkan.</span>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Alasan Pembatalan *</label>
                <textarea
                  className="input"
                  style={{ height: 80, resize: 'vertical' }}
                  placeholder="cth: Salah input, pelanggan batal, dll..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCancelModal(null)}>Tidak, Kembali</button>
              <button
                className="btn btn-danger"
                disabled={!cancelReason.trim() || cancelling}
                onClick={handleCancel}
              >
                {cancelling
                  ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  : <><Icon name="cancel" size={16} /> Ya, Batalkan Transaksi</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
