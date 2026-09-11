import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { formatDate, formatRupiah } from '../utils/api';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import {
  canManageServiceOrder,
  getAllowedServiceStatuses,
  SERVICE_STATUS,
  toPositiveNumber,
} from '../utils/service-order.mjs';

const PAYMENT_METHODS = ['cash', 'qris', 'transfer', 'gopay', 'ovo', 'dana', 'linkaja', 'shopeepay'];
const FINAL_PAYMENT_METHODS = PAYMENT_METHODS.filter((method) => method !== 'transfer');

const emptyOrder = {
  customer_id: '',
  service_product_id: '',
  technician_id: '',
  item_name: '',
  item_brand: '',
  item_serial: '',
  complaint: '',
  estimated_cost: '',
  deposit_amount: '',
  deposit_payment_method: 'cash',
  due_at: '',
  notes: '',
};

const actionTitles = {
  progress: 'Perbarui progres',
  part: 'Tambahkan sparepart',
  deposit: 'Catat DP tambahan',
  cost: 'Catat biaya pekerjaan',
  reserve: 'Reservasi sparepart',
  checkout: 'Finalkan invoice',
};

export default function ServiceOrders() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [action, setAction] = useState(null);
  const [actionForm, setActionForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orderRes, customerRes, productRes, staffRes] = await Promise.all([
        api.get('/service-orders', { params: { status: statusFilter } }),
        api.get('/customers', { params: { limit: 200 } }),
        api.get('/products', { params: { limit: 300 } }),
        api.get('/service-technicians'),
      ]);
      const allProducts = productRes.data.data || [];
      setOrders(orderRes.data.data || []);
      setCustomers(customerRes.data.data || []);
      setProducts(allProducts.filter((product) => product.item_type === 'physical'));
      setServices(allProducts.filter((product) => product.item_type === 'service'));
      setStaff(staffRes.data.data || []);
    } catch {
      toast.error('Gagal memuat data order servis');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshActive = async (id) => {
    try {
      const response = await api.get(`/service-orders/${id}`);
      setActive(response.data.data);
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal memuat detail order');
    }
  };

  const updateOrderForm = (name, value) => setOrderForm((current) => ({ ...current, [name]: value }));
  const updateActionForm = (name, value) => setActionForm((current) => ({ ...current, [name]: value }));

  const createOrder = async () => {
    if (!orderForm.customer_id || !orderForm.service_product_id || !orderForm.item_name.trim()) {
      toast.error('Pelanggan, layanan, dan barang servis wajib diisi');
      return;
    }
    const estimatedCost = Number(orderForm.estimated_cost || 0);
    const depositAmount = Number(orderForm.deposit_amount || 0);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0 || !Number.isFinite(depositAmount) || depositAmount < 0) {
      toast.error('Estimasi biaya dan DP harus berupa angka positif');
      return;
    }

    setSaving(true);
    try {
      await api.post('/service-orders', {
        ...orderForm,
        customer_id: Number(orderForm.customer_id),
        service_product_id: Number(orderForm.service_product_id),
        technician_id: Number(orderForm.technician_id || 0),
        estimated_cost: estimatedCost,
        deposit_amount: depositAmount,
        due_at: orderForm.due_at ? new Date(orderForm.due_at).toISOString() : '',
      });
      toast.success('Order servis dibuat');
      setOrderForm(emptyOrder);
      setCreating(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal membuat order');
    } finally {
      setSaving(false);
    }
  };

  const openAction = (type) => {
    if (!active) return;
    const nextStatus = getAllowedServiceStatuses(active.status);
    const initialState = {
      progress: { status: nextStatus[0] || '', note: '', technician_id: active.technician_id || '' },
      part: { product_id: '', quantity: '1' },
      deposit: { amount: '', payment_method: 'cash', note: '' },
      cost: { cost_type: 'labor', amount: '', description: '' },
      reserve: {},
      checkout: { payment_method: 'cash', payment_amount: String(Math.max(0, active.outstanding_amount || 0)) },
    };
    setActionForm(initialState[type] || {});
    setAction(type);
  };

  const closeAction = () => {
    if (!saving) {
      setAction(null);
      setActionForm({});
    }
  };

  const submitAction = async () => {
    if (!active || !action) return;

    let request;
    if (action === 'progress') {
      if (!actionForm.status) {
        toast.error('Pilih progres berikutnya');
        return;
      }
      request = api.post(`/service-orders/${active.id}/status`, {
        status: actionForm.status,
        note: actionForm.note?.trim() || '',
        technician_id: Number(actionForm.technician_id || 0),
      });
    }
    if (action === 'part') {
      const quantity = toPositiveNumber(actionForm.quantity);
      if (!actionForm.product_id || !quantity || !Number.isInteger(quantity)) {
        toast.error('Pilih sparepart dan isi jumlah bulat lebih dari nol');
        return;
      }
      request = api.post(`/service-orders/${active.id}/parts`, {
        product_id: Number(actionForm.product_id),
        quantity,
      });
    }
    if (action === 'deposit') {
      const amount = toPositiveNumber(actionForm.amount);
      if (!amount) {
        toast.error('Nominal DP harus lebih dari nol');
        return;
      }
      request = api.post(`/service-orders/${active.id}/deposit`, {
        amount,
        payment_method: actionForm.payment_method,
        note: actionForm.note?.trim() || '',
      });
    }
    if (action === 'cost') {
      const amount = toPositiveNumber(actionForm.amount);
      if (!amount) {
        toast.error('Nominal biaya harus lebih dari nol');
        return;
      }
      request = api.post(`/service-orders/${active.id}/costs`, {
        cost_type: actionForm.cost_type,
        amount,
        description: actionForm.description?.trim() || '',
      });
    }
    if (action === 'reserve') {
      request = api.post(`/service-orders/${active.id}/reserve`);
    }
    if (action === 'checkout') {
      const paymentMethod = actionForm.payment_method;
      const outstanding = Math.max(0, active.outstanding_amount || 0);
      const paymentAmount = Number(actionForm.payment_amount);
      if (paymentMethod === 'cash' && (!Number.isFinite(paymentAmount) || paymentAmount < outstanding)) {
        toast.error(`Tunai diterima minimal ${formatRupiah(outstanding)}`);
        return;
      }
      request = api.post('/checkout', {
        service_order_id: active.id,
        payment_method: paymentMethod,
        payment_amount: Number.isFinite(paymentAmount) ? paymentAmount : 0,
      });
    }

    setSaving(true);
    try {
      const response = await request;
      const invoice = response.data?.data?.invoice_number;
      toast.success(invoice ? `Invoice ${invoice} dibuat` : 'Order servis diperbarui');
      if (action === 'checkout') {
        setActive(null);
        load();
      } else {
        setAction(null);
        await refreshActive(active.id);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Perubahan order servis gagal disimpan');
    } finally {
      setSaving(false);
    }
  };

  const canManage = canManageServiceOrder(active);
  const allowedStatuses = active ? getAllowedServiceStatuses(active.status) : [];

  return (
    <div className="rapipos-service page-content">
      <div className="page-header">
        <div>
          <p className="rapipos-page-kicker">OPERASIONAL / ORDER SERVIS</p>
          <h1 className="page-title font-headline">Order servis</h1>
          <p className="page-subtitle">Progres teknisi, sparepart, DP, dan invoice dalam satu alur yang terlacak.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon name="add" size={16} /> Order baru
        </button>
      </div>

      <section className="card service-filter-card">
        <div>
          <p className="service-section-kicker">FILTER</p>
          <strong>Status pengerjaan</strong>
        </div>
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Semua status</option>
          {Object.entries(SERVICE_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </section>

      <section className="card service-list-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Pelanggan / barang</th><th>Petugas</th><th>Status</th><th>Estimasi</th><th>DP</th><th aria-label="Aksi" /></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="7" className="service-empty">Memuat order servis…</td></tr>}
              {!loading && orders.length === 0 && <tr><td colSpan="7" className="service-empty">Belum ada order servis yang sesuai.</td></tr>}
              {!loading && orders.map((order) => (
                <tr key={order.id}>
                  <td className="mono"><strong>{order.order_number}</strong></td>
                  <td><strong>{order.customer_name}</strong><br /><small>{order.item_name}{order.item_brand ? ` · ${order.item_brand}` : ''}</small></td>
                  <td>{order.technician_name || <span className="text-muted">Belum ditugaskan</span>}</td>
                  <td><span className={`badge service-status-${order.status}`}>{SERVICE_STATUS[order.status] || order.status}</span></td>
                  <td className="mono">{formatRupiah(order.estimated_cost)}</td>
                  <td className="mono">{formatRupiah(order.deposit_balance ?? order.deposit_amount)}</td>
                  <td><button className="btn btn-ghost" onClick={() => refreshActive(order.id)}>Kelola</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {creating && (
        <div className="modal-overlay" role="presentation">
          <section className="modal service-modal" role="dialog" aria-modal="true" aria-labelledby="create-service-title">
            <div className="modal-header">
              <div><p className="service-section-kicker">ORDER BARU</p><h2 id="create-service-title" className="modal-title">Terima pekerjaan servis</h2></div>
              <button className="icon-btn" onClick={() => setCreating(false)} aria-label="Tutup"><Icon name="close" /></button>
            </div>
            <div className="modal-body service-form-grid">
              <FormSelect label="Pelanggan" value={orderForm.customer_id} onChange={(value) => updateOrderForm('customer_id', value)} required>
                <option value="">Pilih pelanggan</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
              </FormSelect>
              <FormSelect label="Layanan" value={orderForm.service_product_id} onChange={(value) => updateOrderForm('service_product_id', value)} required>
                <option value="">Pilih layanan</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name} · {formatRupiah(service.sell_price)}</option>)}
              </FormSelect>
              <FormSelect label="Petugas / teknisi" value={orderForm.technician_id} onChange={(value) => updateOrderForm('technician_id', value)}>
                <option value="">Tugaskan nanti</option>
                {staff.map((user) => <option key={user.id} value={user.id}>{user.username} · {user.role}</option>)}
              </FormSelect>
              <FormInput label="Target selesai" type="datetime-local" value={orderForm.due_at} onChange={(value) => updateOrderForm('due_at', value)} />
              <FormInput label="Barang yang diservis" value={orderForm.item_name} onChange={(value) => updateOrderForm('item_name', value)} required />
              <FormInput label="Merek / model" value={orderForm.item_brand} onChange={(value) => updateOrderForm('item_brand', value)} />
              <FormInput label="Serial / IMEI" value={orderForm.item_serial} onChange={(value) => updateOrderForm('item_serial', value)} />
              <FormInput label="Estimasi biaya" type="number" min="0" inputMode="numeric" value={orderForm.estimated_cost} onChange={(value) => updateOrderForm('estimated_cost', value)} />
              <FormInput label="DP diterima" type="number" min="0" inputMode="numeric" value={orderForm.deposit_amount} onChange={(value) => updateOrderForm('deposit_amount', value)} />
              <FormSelect label="Metode DP" value={orderForm.deposit_payment_method} onChange={(value) => updateOrderForm('deposit_payment_method', value)}>
                {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}
              </FormSelect>
              <FormTextarea className="service-field-full" label="Keluhan pelanggan" value={orderForm.complaint} onChange={(value) => updateOrderForm('complaint', value)} />
              <FormTextarea className="service-field-full" label="Catatan internal" value={orderForm.notes} onChange={(value) => updateOrderForm('notes', value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" disabled={saving} onClick={() => setCreating(false)}>Batal</button>
              <button className="btn btn-primary" disabled={saving} onClick={createOrder}>{saving ? 'Menyimpan…' : 'Buat order'}</button>
            </div>
          </section>
        </div>
      )}

      {active && (
        <div className="modal-overlay" role="presentation">
          <section className="modal service-modal service-detail-modal" role="dialog" aria-modal="true" aria-labelledby="service-detail-title">
            <div className="modal-header">
              <div>
                <p className="service-section-kicker">ORDER SERVIS</p>
                <h2 id="service-detail-title" className="modal-title">{active.order_number}</h2>
                <p className="text-sm text-secondary">{active.customer_name} · {active.item_name}</p>
              </div>
              <button className="icon-btn" onClick={() => setActive(null)} aria-label="Tutup"><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="service-summary">
                <Summary label="Status" value={SERVICE_STATUS[active.status] || active.status} />
                <Summary label="Petugas" value={active.technician_name || 'Belum ditugaskan'} />
                <Summary label="Estimasi" value={formatRupiah(active.estimated_cost)} />
                <Summary label="DP tercatat" value={formatRupiah(active.deposit_balance ?? active.deposit_amount)} />
                <Summary label="Sisa tagihan" value={formatRupiah(active.outstanding_amount || 0)} accent />
              </div>

              {canManage ? (
                <div className="service-action-grid">
                  <ActionButton icon="sync" title="Update progres" subtitle={allowedStatuses.length ? 'Catat status dan petugas' : 'Tidak ada status berikutnya'} onClick={() => openAction('progress')} />
                  <ActionButton icon="inventory_2" title="Tambah sparepart" subtitle="Harga dari master produk" onClick={() => openAction('part')} />
                  <ActionButton icon="payments" title="DP tambahan" subtitle="Masuk ke payment ledger" onClick={() => openAction('deposit')} />
                  {isAdmin() && <ActionButton icon="account_balance" title="Biaya pekerjaan" subtitle="Upah, vendor, atau biaya lain" onClick={() => openAction('cost')} />}
                  {isAdmin() && <ActionButton icon="lock" title="Reservasi sparepart" subtitle="Menahan stok tanpa mengurangi fisik" onClick={() => openAction('reserve')} />}
                </div>
              ) : (
                <p className="service-terminal-note">Order ini sudah final atau dibatalkan. Riwayat tetap dapat dilihat, tetapi tidak dapat diubah.</p>
              )}

              <ServiceSection title="Sparepart">
                {active.parts?.length ? (
                  <ul className="service-record-list">
                    {active.parts.map((part) => <li key={part.id}><span><strong>{part.product_name}</strong> × {part.quantity}</span><span className="mono">{formatRupiah(part.subtotal)}{part.reserved_quantity > 0 ? ' · direservasi' : ''}</span></li>)}
                  </ul>
                ) : <EmptyRecord message="Belum ada sparepart." />}
              </ServiceSection>

              <ServiceSection title="Biaya pekerjaan">
                {active.costs?.length ? (
                  <ul className="service-record-list">
                    {active.costs.map((cost) => <li key={cost.id}><span><strong>{cost.cost_type}</strong>{cost.description ? ` · ${cost.description}` : ''}</span><span className="mono">{formatRupiah(cost.amount)}</span></li>)}
                  </ul>
                ) : <EmptyRecord message="Belum ada biaya langsung." />}
              </ServiceSection>

              <ServiceSection title="Riwayat progres">
                {active.progress?.length ? (
                  <ol className="service-timeline">
                    {active.progress.map((progress) => <li key={progress.id}><span className="service-timeline-dot" /><div><strong>{SERVICE_STATUS[progress.status] || progress.status}</strong><p>{progress.note || 'Tanpa catatan'}</p><small>{progress.actor_name || 'Sistem'} · {formatDate(progress.created_at)}</small></div></li>)}
                  </ol>
                ) : <EmptyRecord message="Belum ada riwayat progres." />}
              </ServiceSection>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setActive(null)}>Tutup</button>
              {canManage && active.status === 'ready' && <button className="btn btn-primary" onClick={() => openAction('checkout')}><Icon name="receipt_long" size={16} /> Finalkan invoice</button>}
              {canManage && active.status !== 'ready' && <span className="text-sm text-muted">Tandai “Siap Diambil” sebelum membuat invoice.</span>}
              {active.invoice_number && <span className="badge badge-green">Invoice {active.invoice_number}</span>}
            </div>
          </section>
        </div>
      )}

      {active && action && (
        <div className="modal-overlay" role="presentation">
          <section className="modal service-action-modal" role="dialog" aria-modal="true" aria-labelledby="service-action-title">
            <div className="modal-header">
              <div><p className="service-section-kicker">{active.order_number}</p><h2 id="service-action-title" className="modal-title">{actionTitles[action]}</h2></div>
              <button className="icon-btn" onClick={closeAction} aria-label="Tutup"><Icon name="close" /></button>
            </div>
            <div className="modal-body form-stack">
              {action === 'progress' && (
                <>
                  <FormSelect label="Status berikutnya" value={actionForm.status} onChange={(value) => updateActionForm('status', value)} required>
                    {allowedStatuses.map((status) => <option key={status} value={status}>{SERVICE_STATUS[status]}</option>)}
                  </FormSelect>
                  <FormSelect label="Petugas / teknisi" value={actionForm.technician_id} onChange={(value) => updateActionForm('technician_id', value)}>
                    <option value="">Pertahankan penugasan saat ini</option>
                    {staff.map((user) => <option key={user.id} value={user.id}>{user.username} · {user.role}</option>)}
                  </FormSelect>
                  <FormTextarea label="Catatan progres" value={actionForm.note} onChange={(value) => updateActionForm('note', value)} />
                </>
              )}
              {action === 'part' && (
                <>
                  <FormSelect label="Produk sparepart" value={actionForm.product_id} onChange={(value) => updateActionForm('product_id', value)} required>
                    <option value="">Pilih produk fisik</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} · stok {product.stock} · {formatRupiah(product.sell_price)}</option>)}
                  </FormSelect>
                  <FormInput label="Jumlah" type="number" min="1" step="1" inputMode="numeric" value={actionForm.quantity} onChange={(value) => updateActionForm('quantity', value)} required />
                </>
              )}
              {action === 'deposit' && (
                <>
                  <FormInput label="Nominal DP" type="number" min="1" inputMode="numeric" value={actionForm.amount} onChange={(value) => updateActionForm('amount', value)} required />
                  <FormSelect label="Metode pembayaran" value={actionForm.payment_method} onChange={(value) => updateActionForm('payment_method', value)}>
                    {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}
                  </FormSelect>
                  <FormTextarea label="Catatan" value={actionForm.note} onChange={(value) => updateActionForm('note', value)} />
                </>
              )}
              {action === 'cost' && (
                <>
                  <FormSelect label="Jenis biaya" value={actionForm.cost_type} onChange={(value) => updateActionForm('cost_type', value)}>
                    <option value="labor">Upah tenaga kerja</option>
                    <option value="external">Vendor / pihak ketiga</option>
                    <option value="other">Biaya lainnya</option>
                  </FormSelect>
                  <FormInput label="Nominal biaya" type="number" min="1" inputMode="numeric" value={actionForm.amount} onChange={(value) => updateActionForm('amount', value)} required />
                  <FormTextarea label="Keterangan" value={actionForm.description} onChange={(value) => updateActionForm('description', value)} />
                </>
              )}
              {action === 'reserve' && <p className="service-confirmation">Sistem akan mengecek stok kemudian menahan seluruh sparepart pada order ini. Stok fisik baru berkurang saat invoice final dibuat.</p>}
              {action === 'checkout' && (
                <>
                  <p className="service-confirmation">Sisa yang akan ditagihkan: <strong>{formatRupiah(active.outstanding_amount || 0)}</strong>. Setelah berhasil, order dan stok sparepart menjadi transaksi final.</p>
                  <FormSelect label="Metode pembayaran" value={actionForm.payment_method} onChange={(value) => updateActionForm('payment_method', value)}>
                    {FINAL_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}
                  </FormSelect>
                  {actionForm.payment_method === 'cash' && <FormInput label="Tunai diterima" type="number" min={Math.max(0, active.outstanding_amount || 0)} inputMode="numeric" value={actionForm.payment_amount} onChange={(value) => updateActionForm('payment_amount', value)} required />}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" disabled={saving} onClick={closeAction}>Batal</button>
              <button className={action === 'checkout' ? 'btn btn-primary' : 'btn btn-primary'} disabled={saving || (action === 'progress' && !allowedStatuses.length)} onClick={submitAction}>
                {saving ? 'Menyimpan…' : action === 'checkout' ? 'Buat invoice' : 'Simpan perubahan'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function FormInput({ label, className = '', required = false, onChange, ...props }) {
  return <label className={`input-group ${className}`}><span className="input-label">{label}{required ? ' *' : ''}</span><input className="input" required={required} onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

function FormSelect({ label, className = '', required = false, onChange, children, ...props }) {
  return <label className={`input-group ${className}`}><span className="input-label">{label}{required ? ' *' : ''}</span><select className="input" required={required} onChange={(event) => onChange(event.target.value)} {...props}>{children}</select></label>;
}

function FormTextarea({ label, className = '', onChange, ...props }) {
  return <label className={`input-group ${className}`}><span className="input-label">{label}</span><textarea className="input" rows="3" onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

function Summary({ label, value, accent = false }) {
  return <div className={accent ? 'service-summary-card service-summary-card--accent' : 'service-summary-card'}><span>{label}</span><strong>{value}</strong></div>;
}

function ActionButton({ icon, title, subtitle, onClick }) {
  return <button className="service-action-button" onClick={onClick}><Icon name={icon} size={18} /><span><strong>{title}</strong><small>{subtitle}</small></span><Icon name="chevron_right" size={16} /></button>;
}

function ServiceSection({ title, children }) {
  return <section className="service-detail-section"><h3>{title}</h3>{children}</section>;
}

function EmptyRecord({ message }) {
  return <p className="service-empty-record">{message}</p>;
}
