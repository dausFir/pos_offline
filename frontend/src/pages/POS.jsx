import { useState, useEffect, useRef, useCallback } from 'react';
import api, { formatRupiah } from '../utils/api';
import toast from 'react-hot-toast';
import { printReceipt, ReceiptPreview } from '../components/ThermalReceipt';
import { useI18n } from '../context/I18nContext';
import Icon from '../components/Icon';

// ── Keyboard Shortcut Map ────────────────────────────────────────────────────
// F1 = focus search, F2 = bayar, F3 = hold, F4 = resume hold, Esc = clear/close
// Alt+1~4 = quick payment amounts, Delete = remove last item

const SHORTCUT_HELP = [
  { key: 'F1', desc: 'Fokus pencarian produk' },
  { key: 'F2', desc: 'Buka modal pembayaran' },
  { key: 'F3', desc: 'Hold / simpan transaksi sementara' },
  { key: 'F4', desc: 'Resume transaksi yang di-hold' },
  { key: 'Esc', desc: 'Tutup modal / kosongkan pencarian' },
  { key: 'Enter', desc: 'Scan barcode (jika input numerik panjang)' },
  { key: 'Delete', desc: 'Hapus item terakhir dari keranjang' },
  { key: 'Alt + 1-4', desc: 'Pilih nominal bayar cepat' },
];

export default function POS() {
  console.log('🛒🛒🛒 [POS PAGE] POS component loading! 🛒🛒🛒');
  console.log('🔍 [POS PAGE] Checking localStorage availability...');
  
  // Check localStorage immediately
  const storedAccess = localStorage.getItem('access_token');
  const storedRefresh = localStorage.getItem('refresh_token');
  const storedUser = localStorage.getItem('user');
  
  console.log('🔍 [POS PAGE] POS component localStorage state:');
  console.log('   - access_token available:', !!storedAccess);
  console.log('   - access_token length:', storedAccess?.length || 0);
  console.log('   - refresh_token available:', !!storedRefresh);
  console.log('   - user available:', !!storedUser);
  
  if (!storedAccess) {
    console.error('🚨 [POS PAGE] CRITICAL: NO ACCESS TOKEN ON POS PAGE LOAD!');
    console.error('🚨 [POS PAGE] This will cause 401 errors on API calls!');
  }

  const { t } = useI18n();
  const [products,    setProducts]    = useState([]);
  const [cart,        setCart]        = useState([]);
  const [search,      setSearch]      = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showScanner,  setShowScanner]  = useState(false);
  const [receipt,      setReceipt]      = useState(null);
  const [showHelp,     setShowHelp]     = useState(false);
  const [catFilter,    setCatFilter]    = useState('');
  const [categories,   setCategories]   = useState([]);

  // Penting #4: Hold orders
  const [holds,       setHolds]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_holds') || '[]'); } catch { return []; }
  });
  const [showHolds,   setShowHolds]   = useState(false);
  const undoTimeoutRef = useRef(null);

  const searchRef  = useRef(null);
  const searchTimeout = useRef(null);

  const fetchProducts = useCallback(async (q = '', cat = '') => {
    console.log('🛍️ [POS PAGE] fetchProducts called');
    console.log('   - query:', q);
    console.log('   - category:', cat);
    
    try {
      const params = { search: q, limit: 60 };
      if (cat) params.category_id = cat;
      
      console.log('📤 [POS PAGE] Making /products API call...');
      console.log('   - params:', params);
      
      const res = await api.get('/products', { params });
      console.log('✅ [POS PAGE] Products API call successful');
      console.log('   - received products count:', res.data.data?.length || 0);
      
      setProducts(res.data.data || []);
    } catch (error) {
      console.error('❌ [POS PAGE] fetchProducts ERROR:', error);
      console.error('   - status:', error.response?.status);
      console.error('   - message:', error.message);
      console.error('   - response data:', error.response?.data);
      
      if (error.response?.status === 401) {
        console.error('🚨 [POS PAGE] 401 UNAUTHORIZED - Token issue detected!');
      }
    }
  }, []);

  const fetchCategories = async () => {
    console.log('📂 [POS PAGE] fetchCategories called');
    
    try {
      console.log('📤 [POS PAGE] Making /categories API call...');
      const res = await api.get('/categories');
      
      console.log('✅ [POS PAGE] Categories API call successful');
      console.log('   - received categories count:', res.data.data?.length || 0);
      
      setCategories(res.data.data || []);
    } catch (error) {
      console.error('❌ [POS PAGE] fetchCategories ERROR:', error);
      console.error('   - status:', error.response?.status);
      console.error('   - message:', error.message);
      
      if (error.response?.status === 401) {
        console.error('🚨 [POS PAGE] 401 UNAUTHORIZED on categories - Token issue!');
      }
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchProducts(search, catFilter), 260);
    return () => clearTimeout(searchTimeout.current);
  }, [search, catFilter, fetchProducts]);

  // ── Penting #2: Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Don't fire if typing in a non-search input or textarea inside a modal
      const tag = e.target.tagName;
      const inModal = e.target.closest('.modal');
      if (inModal && e.key !== 'Escape') return;

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case 'F2':
          e.preventDefault();
          if (cart.length > 0) setShowCheckout(true);
          else toast.error(t('pos.empty_cart'));
          break;
        case 'F3':
          e.preventDefault();
          handleHold();
          break;
        case 'F4':
          e.preventDefault();
          if (holds.length > 0) setShowHolds(true);
          else toast(t('pos.no_holds'), { icon: '📋' });
          break;
        case 'Escape':
          setShowCheckout(false);
          setShowScanner(false);
          setShowHolds(false);
          setShowHelp(false);
          if (search) setSearch('');
          break;
        case 'Delete':
          if ((tag === 'INPUT' || tag === 'TEXTAREA') && !inModal) break;
          if (cart.length > 0) {
            setCart(prev => prev.slice(0, -1));
            toast('Item terakhir dihapus', { icon: '🗑️', duration: 1200 });
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart, holds, search]);

  // Price tier cache: productId -> [{min_qty, price, label}]
  const tierCache = useRef({});

  const getTierPrice = async (productId, qty, basePrice) => {
    // Load tiers if not cached
    if (!tierCache.current[productId]) {
      try {
        const res = await api.get(`/products/${productId}/price-tiers`);
        tierCache.current[productId] = res.data.data || [];
      } catch { tierCache.current[productId] = []; }
    }
    const tiers = tierCache.current[productId];
    // Find best applicable tier (highest min_qty that is <= qty)
    const applicable = tiers.filter(t => qty >= t.min_qty && t.price < basePrice);
    if (!applicable.length) return { price: basePrice, label: null };
    const best = applicable.reduce((a, b) => b.min_qty > a.min_qty ? b : a);
    return { price: best.price, label: best.label };
  };

  const addToCart = useCallback((product, overridePrice = null) => {
    if (product.stock <= 0) { toast.error(`Stok ${product.name} habis!`); return; }
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      const newQty = ex ? ex.qty + 1 : 1;
      if (ex && ex.qty >= product.stock) { toast.error(`Stok maks: ${product.stock}`); return prev; }

      // Apply tier price asynchronously after state update
      setTimeout(async () => {
        if (overridePrice === null) {
          const { price, label } = await getTierPrice(product.id, newQty, product.sell_price);
          if (price !== product.sell_price) {
            setCart(current => current.map(i =>
              i.id === product.id ? { ...i, unitPrice: price, tierLabel: label } : i
            ));
          } else {
            setCart(current => current.map(i =>
              i.id === product.id ? { ...i, unitPrice: product.sell_price, tierLabel: null } : i
            ));
          }
        }
      }, 0);

      const price = overridePrice ?? product.sell_price;
      if (ex) {
        return prev.map(i => i.id === product.id ? { ...i, qty: newQty, unitPrice: price } : i);
      }
      // Low stock warning notification
      if (product.stock <= (product.stock_min || 5) && product.stock > 0) {
        setTimeout(() => {
          toast(`⚠️ Stok ${product.name} menipis! Sisa: ${product.stock} pcs`, {
            icon: '⚠️',
            style: { background: '#fff3cd', color: '#92600a', border: '1px solid #e8a600' },
            duration: 3500,
          });
        }, 100);
      }

      return [...prev, { ...product, qty: 1, unitPrice: price, tierLabel: null }];
    });
  }, []);

  const updateQty = (id, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const newQty = Math.max(0, item.qty + delta);
      if (newQty === 0) return prev.filter(i => i.id !== id);
      const updated = prev.map(i => i.id === id ? { ...i, qty: newQty } : i);
      // Re-check tier price on qty change
      setTimeout(async () => {
        const { price, label } = await getTierPrice(id, newQty, item.sell_price);
        setCart(cur => cur.map(i => i.id === id ? { ...i, unitPrice: price, tierLabel: label } : i));
      }, 0);
      return updated;
    });
  };

  const setQtyDirect = (id, newQty) => {
    const qty = Math.max(0, parseInt(newQty) || 0);
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (qty === 0) return prev.filter(i => i.id !== id);
      if (qty > item.stock) {
        toast.error(`Stok tersedia: ${item.stock}`);
        return prev;
      }
      const updated = prev.map(i => i.id === id ? { ...i, qty } : i);
      // Re-check tier price on qty change
      setTimeout(async () => {
        const { price, label } = await getTierPrice(id, qty, item.sell_price);
        setCart(cur => cur.map(i => i.id === id ? { ...i, unitPrice: price, tierLabel: label } : i));
      }, 0);
      return updated;
    });
  };

  const total      = cart.reduce((s, i) => s + (i.unitPrice ?? i.sell_price) * i.qty, 0);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  // ── Penting #4: Hold ─────────────────────────────────────────────────────────
  const saveHolds = (newHolds) => {
    setHolds(newHolds);
    localStorage.setItem('pos_holds', JSON.stringify(newHolds));
  };

  const handleHold = () => {
    if (cart.length === 0) { toast.error('Keranjang kosong, tidak ada yang di-hold'); return; }
    const label = `Hold #${holds.length + 1} — ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    const newHold = { id: Date.now().toString(), label, items: cart, total, createdAt: new Date().toISOString() };
    saveHolds([...holds, newHold]);
    setCart([]);
    toast.success(`Transaksi di-hold: ${label}`, { icon: '📋' });
  };

  const handleResumeHold = (hold) => {
    if (cart.length > 0 && !confirm('Keranjang saat ini akan digabung dengan hold. Lanjutkan?')) return;
    const merged = [...cart];
    hold.items.forEach(hi => {
      const ex = merged.find(i => i.id === hi.id);
      if (ex) ex.qty += hi.qty;
      else merged.push(hi);
    });
    setCart(merged);
    saveHolds(holds.filter(h => h.id !== hold.id));
    setShowHolds(false);
    toast.success(`Hold "${hold.label}" dilanjutkan`);
  };

  const handleDeleteHold = (id) => {
    saveHolds(holds.filter(h => h.id !== id));
    toast('Hold dihapus', { icon: '🗑️' });
  };

  const handleBarcodeSearch = async (code) => {
    try {
      const res = await api.get(`/products/barcode/${code}`);
      addToCart(res.data.data);
      setSearch('');
    } catch { toast.error('Produk tidak ditemukan'); }
  };

  return (
    <div className="pos-root">
      {/* ── Product pane ───────────────────────────────────────────────────── */}
      <div className="pos-products-pane">
        {/* Search + filters */}
        <div className="pos-search">
          <div style={{ position: 'relative', flex: 1 }}>
            <Icon name="search" size={18} color="var(--outline)" />
            <input
              ref={searchRef}
              className="input"
              style={{ paddingLeft: 40, borderRadius: 100 }}
              placeholder="F1 · Cari produk atau scan barcode…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && /^\d{8,}$/.test(search.trim())) handleBarcodeSearch(search.trim()); }}
            />
          </div>
          <button className="btn btn-tonal" style={{ borderRadius: 100, padding: '0 14px', minHeight: 44 }} onClick={() => setShowScanner(true)} title="Scanner (Ctrl+K)">
            <Icon name="qr_code_scanner" size={18} />
          </button>
          <button className="btn btn-tonal" style={{ borderRadius: 100, padding: '0 14px', minHeight: 44 }} onClick={() => setShowHelp(true)} title="Shortcut keyboard">
            <Icon name="keyboard" size={18} />
          </button>
        </div>

        {/* Category filter tabs */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px 4px', overflowX: 'auto', borderBottom: '1px solid var(--outline-variant)', scrollbarWidth: 'none' }}>
            <button onClick={() => setCatFilter('')} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, border: '1.5px solid', borderColor: catFilter === '' ? 'var(--primary)' : 'var(--outline-variant)', background: catFilter === '' ? 'var(--primary-fixed)' : 'transparent', color: catFilter === '' ? 'var(--primary)' : 'var(--outline)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Semua
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCatFilter(catFilter === String(c.id) ? '' : String(c.id))} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, border: '1.5px solid', borderColor: catFilter === String(c.id) ? c.color : 'var(--outline-variant)', background: catFilter === String(c.id) ? c.color + '22' : 'transparent', color: catFilter === String(c.id) ? c.color : 'var(--outline)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Product grid */}
        <div className="product-grid">
          {products.length === 0
            ? <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <Icon name="search_off" size={18} />
                <h3>Produk tidak ditemukan</h3>
              </div>
            : products.map(p => (
              <button key={p.id} className={`product-card ${p.stock <= 0 ? 'product-card--empty' : ''}`}
                onClick={() => addToCart(p)} disabled={p.stock <= 0}>
                {p.stock <= 0 && <div className="product-card__badge product-card__badge--empty">HABIS</div>}
                {p.stock > 0 && p.stock <= (p.stock_min || 5) && <div className="product-card__badge product-card__badge--low">TIPIS</div>}
                {p.category_name && <div style={{ fontSize: 9, color: 'var(--outline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{p.category_name}</div>}
                <div className="product-card__name">{p.name}</div>
                <div className="product-card__sku">{p.barcode_sku}</div>
                <div className="product-card__price">{formatRupiah(p.sell_price)}</div>
                <div className={`product-card__stock ${p.stock <= (p.stock_min || 5) ? 'product-card__stock--low' : ''}`}>
                  Stok: {p.stock}
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* ── Cart pane ──────────────────────────────────────────────────────── */}
      <div className="pos-cart-pane">
        <div className="cart-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="shopping_cart" size={20} color="var(--primary)" />
            <span style={{ fontWeight: 800, fontSize: 15, fontFamily: 'Manrope, sans-serif' }}>Keranjang</span>
            {totalItems > 0 && (
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 100 }}>{totalItems}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {holds.length > 0 && (
              <button className="btn btn-tonal" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8 }} onClick={() => setShowHolds(true)}>
                <Icon name="pause_circle" size={14} />
                Hold ({holds.length})
              </button>
            )}
            {cart.length > 0 && (
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8 }} onClick={handleHold} title="F3 — Hold transaksi">
                <Icon name="pause" size={14} />
              </button>
            )}
            {cart.length > 0 && (
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8 }} onClick={() => setCart([])}>
                <Icon name="delete_sweep" size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="cart-items">
          {cart.length === 0
            ? <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--outline)' }}>
                <Icon name="shopping_cart" size={44} />
                <p style={{ fontSize: 14, fontWeight: 600 }}>Keranjang kosong</p>
                <p style={{ fontSize: 12 }}>Pilih produk di sebelah kiri</p>
                <p style={{ fontSize: 11, marginTop: 8, color: 'var(--outline)' }}>Tekan F1 untuk fokus pencarian</p>
              </div>
            : cart.map(item => (
              <div key={item.id} className="cart-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>{item.name}</span>
                    {item.tierLabel && (
                      <span style={{ fontSize: 10, background: 'var(--secondary-container)', color: 'var(--secondary)', padding: '1px 6px', borderRadius: 100, marginLeft: 6, fontWeight: 700 }}>{item.tierLabel}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--outline)' }}>{formatRupiah(item.unitPrice ?? item.sell_price)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>
                    <Icon name="remove" size={14} />
                  </button>
                  <input 
                    type="number" 
                    min="0" 
                    max={item.stock}
                    className="qty-input" 
                    style={{ 
                      minWidth: 45, 
                      textAlign: 'center', 
                      fontWeight: 800, 
                      fontSize: 14,
                      border: '1px solid var(--outline-variant)',
                      borderRadius: 6,
                      padding: '4px 2px',
                      background: 'var(--surface-container)',
                      fontFamily: 'monospace'
                    }}
                    value={item.qty}
                    onChange={(e) => setQtyDirect(item.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <button className="qty-btn" onClick={() => updateQty(item.id, 1)} disabled={item.qty >= item.stock}>
                    <Icon name="add" size={14} />
                  </button>
                  <button className="qty-btn qty-btn--danger" onClick={() => {
                    const removed = item;
                    setCart(c => c.filter(i => i.id !== item.id));
                    // Clear any existing undo timeout
                    clearTimeout(undoTimeoutRef.current);
                    // Show undo toast
                    toast((toastObj) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13 }}>Hapus <strong>{removed.name}</strong></span>
                        <button
                          onClick={() => {
                            setCart(prev => {
                              const exists = prev.find(i => i.id === removed.id);
                              if (exists) return prev.map(i => i.id === removed.id ? removed : i);
                              return [...prev, removed];
                            });
                            toast.dismiss(toastObj.id);
                          }}
                          style={{ padding: '3px 10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          Undo
                        </button>
                      </div>
                    ), { duration: 3000, icon: '🗑️' });
                  }}>
                    <Icon name="delete" size={13} />
                  </button>
                  <span className="mono" style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13, color: '#1a7a3c' }}>
                    {formatRupiah((item.unitPrice ?? item.sell_price) * item.qty)}
                  </span>
                </div>
              </div>
            ))
          }
        </div>

        <div className="cart-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface-variant)' }}>Total Pembayaran</span>
            <span className="mono font-headline" style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{formatRupiah(total)}</span>
          </div>
          <button className="btn btn-primary btn-xl" disabled={cart.length === 0} onClick={() => setShowCheckout(true)}
            style={{ boxShadow: cart.length > 0 ? '0 4px 20px rgba(0,69,143,.3)' : 'none' }}>
            <Icon name="payment" size={22} />
            BAYAR <span style={{ fontSize: 12, opacity: .7, marginLeft: 4 }}>(F2)</span>
          </button>
          <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: 'var(--outline)' }}>
            F1 Cari · F2 Bayar · F3 Hold · F4 Resume · Del Hapus
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showCheckout && (
        <CheckoutModal cart={cart} total={total} onClose={() => setShowCheckout(false)}
          onSuccess={tx => { setCart([]); setShowCheckout(false); setReceipt(tx); fetchProducts(search, catFilter); }} />
      )}
      {receipt && <ReceiptSuccessModal transaction={receipt} onClose={() => setReceipt(null)} />}
      {showScanner && <ScannerModal onScan={c => { setShowScanner(false); handleBarcodeSearch(c); }} onClose={() => setShowScanner(false)} />}

      {/* ── Penting #4: Hold list ─────────────────────────────────────────── */}
      {showHolds && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">📋 Transaksi yang Di-Hold</span>
              <button className="icon-btn" onClick={() => setShowHolds(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              {holds.length === 0
                ? <p style={{ textAlign: 'center', color: 'var(--outline)', padding: 20 }}>Tidak ada transaksi yang di-hold</p>
                : holds.map(h => (
                  <div key={h.id} style={{ padding: '12px 14px', background: 'var(--surface-container-low)', borderRadius: 10, border: '1px solid var(--outline-variant)', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{h.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--outline)' }}>{h.items.length} item</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="mono" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 16 }}>{formatRupiah(h.total)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className="btn btn-primary" style={{ flex: 2, padding: '8px' }} onClick={() => handleResumeHold(h)}>
                        <Icon name="play_arrow" size={16} /> Lanjutkan
                      </button>
                      <button className="btn btn-ghost" style={{ flex: 1, padding: '8px' }} onClick={() => handleDeleteHold(h.id)}>
                        <Icon name="delete" size={15} /> Hapus
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowHolds(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Penting #2: Shortcut help ─────────────────────────────────────── */}
      {showHelp && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">⌨️ Shortcut Keyboard</span>
              <button className="icon-btn" onClick={() => setShowHelp(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SHORTCUT_HELP.map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                    <kbd style={{ background: 'var(--surface-container-highest)', border: '1.5px solid var(--outline-variant)', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', minWidth: 80, textAlign: 'center', boxShadow: '0 1px 0 var(--outline-variant)' }}>{s.key}</kbd>
                    <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{s.desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--primary-fixed)', borderRadius: 8, fontSize: 12, color: 'var(--primary)' }}>
                💡 Shortcut aktif di seluruh halaman Kasir. Tidak aktif ketika kursor berada di dalam kotak input modal.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowHelp(false)}>Mengerti</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pos-root { display: flex; height: 100dvh; overflow: hidden; background: var(--surface); }
        .pos-products-pane { flex: 1; display: flex; flex-direction: column; border-right: 1px solid var(--outline-variant); overflow: hidden; background: var(--surface-container-low); }
        .pos-search { padding: 10px 12px; border-bottom: 1px solid var(--outline-variant); display: flex; gap: 8px; align-items: center; background: var(--surface-container-lowest); }
        .product-grid { flex: 1; overflow-y: auto; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 8px; align-content: start; }
        .product-card { background: var(--surface-container-lowest); border: 1.5px solid var(--outline-variant); border-radius: 12px; padding: 11px; cursor: pointer; text-align: left; transition: all .14s; position: relative; min-height: 105px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow-1); }
        .product-card:hover:not(:disabled) { border-color: var(--primary); box-shadow: 0 4px 16px rgba(0,69,143,.14); transform: translateY(-1px); }
        .product-card:active:not(:disabled) { transform: scale(.97); }
        .product-card--empty { opacity: .5; cursor: not-allowed; }
        .product-card__badge { position: absolute; top: 6px; right: 6px; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 100px; text-transform: uppercase; }
        .product-card__badge--empty { background: var(--error-container); color: var(--error); }
        .product-card__badge--low { background: #fff3cd; color: var(--tertiary); }
        .product-card__name { font-size: 13px; font-weight: 700; color: var(--on-surface); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .product-card__sku { font-size: 10px; color: var(--outline); font-family: monospace; }
        .product-card__price { font-size: 14px; font-weight: 800; color: var(--primary); font-family: monospace; margin-top: auto; }
        .product-card__stock { font-size: 11px; font-weight: 600; color: #1a7a3c; }
        .product-card__stock--low { color: var(--error); }
        .pos-cart-pane { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--surface-container-lowest); }
        .cart-head { padding: 10px 12px; border-bottom: 1px solid var(--outline-variant); display: flex; align-items: center; justify-content: space-between; min-height: 50px; }
        .cart-items { flex: 1; overflow-y: auto; padding: 8px; }
        .cart-item { padding: 10px; border-radius: 10px; background: var(--surface-container-low); border: 1px solid var(--outline-variant); margin-bottom: 6px; }
        .qty-btn { width: 28px; height: 28px; border-radius: 7px; border: 1.5px solid var(--outline-variant); background: var(--surface-container-lowest); color: var(--on-surface-variant); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .1s; flex-shrink: 0; }
        .qty-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); background: var(--primary-fixed); }
        .qty-btn:disabled { opacity: .4; cursor: not-allowed; }
        .qty-btn--danger:hover { border-color: var(--error); color: var(--error); background: var(--error-container); }
        .cart-footer { padding: 12px; border-top: 1.5px solid var(--outline-variant); background: var(--surface-container-lowest); }
        @media (max-width: 768px) {
          .pos-root { flex-direction: column; }
          .pos-products-pane { height: 52dvh; border-right: none; border-bottom: 1px solid var(--outline-variant); }
          .pos-cart-pane { width: 100%; flex: 1; }
          .product-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
        }
      `}</style>
    </div>
  );
}

/* ── CheckoutModal — with customer + credit ──────────────────────────────── */
function CheckoutModal({ cart, total: rawTotal, onClose, onSuccess }) {
  const { t } = useI18n();
  const [storeSettings, setStoreSettings] = useState({});
  const [method, setMethod]     = useState('cash');
  const [paid, setPaid]         = useState('');
  const [cashAmt, setCashAmt]   = useState('');
  const [qrisAmt, setQrisAmt]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [discountInfo, setDiscountInfo]   = useState(null);
  const [discountCode, setDiscountCode]   = useState('');
  const [checkingDisc, setCheckingDisc]   = useState(false);
  const [qrisImg, setQrisImg]   = useState('');
  const [qrisNotes, setQrisNotes] = useState('');

  // Penting #5: Customer
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch]     = useState('');
  const [onCredit, setOnCredit] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => { const d = r.data.data || {}; setQrisImg(d.qris_image_b64 || ''); setQrisNotes(d.qris_notes || ''); setStoreSettings(d); }).catch(() => {});
    api.get('/customers', { params: { limit: 200 } }).then(r => setCustomers(r.data.data || [])).catch(() => {});
  }, []);

  const discAmt  = discountInfo?.discount_amount || 0;
  const total    = rawTotal - discAmt;
  const paidNum  = parseFloat(paid) || 0;
  const cashNum  = parseFloat(cashAmt) || 0;
  const qrisNum  = parseFloat(qrisAmt) || 0;
  const change   = method === 'cash' ? paidNum - total : 0;
  const canPay   = onCredit ||
    (method === 'qris' ) ||
    (method === 'cash'  && paidNum >= total) ||
    (method === 'split' && (cashNum + qrisNum) >= total);

  const quickAmounts = [
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 5000) * 5000,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4);

  // Keyboard: Alt+1~4 for quick amounts
  useEffect(() => {
    const h = (e) => {
      if (!e.altKey) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < quickAmounts.length) {
        e.preventDefault();
        setPaid(String(quickAmounts[idx]));
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [quickAmounts]);

  const applyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code) return;
    setCheckingDisc(true);
    try {
      const res = await api.get(`/discounts/validate/${code}?total=${rawTotal}`);
      setDiscountInfo(res.data.data); setDiscountCode(code);
      toast.success(`Diskon "${res.data.data.discount.name}" diterapkan!`);
    } catch (err) { toast.error(err.response?.data?.error || 'Kode diskon tidak valid'); setDiscountInfo(null); setDiscountCode(''); }
    finally { setCheckingDisc(false); }
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await api.post('/checkout', {
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
        payment_amount: onCredit ? 0 : method === 'split' ? cashNum + qrisNum : method === 'qris' ? total : paidNum,
        payment_method: onCredit ? 'cash' : method,
        cash_amount: onCredit ? 0 : method === 'split' ? cashNum : method === 'cash' ? paidNum : 0,
        qris_amount: onCredit ? 0 : method === 'split' ? qrisNum : method === 'qris' ? total : 0,
        discount_code: discountCode,
        customer_id: selectedCustomer?.id || 0,
        on_credit: onCredit,
      });
      toast.success('Transaksi berhasil!');
      onSuccess(res.data.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Checkout gagal'); }
    finally { setLoading(false); }
  };

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)
  );

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title">Proses Pembayaran</span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Summary */}
          <div style={{ background: 'var(--surface-container-low)', borderRadius: 10, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Ringkasan</p>
            {cart.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>{i.name} <span style={{ color: 'var(--outline)' }}>×{i.qty}</span></span>
                <span className="mono" style={{ fontWeight: 600 }}>{formatRupiah((i.unitPrice ?? i.sell_price) * i.qty)}</span>
              </div>
            ))}
            {discAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#1a7a3c' }}>
                <span>Diskon ({discountCode})</span><span className="mono" style={{ fontWeight: 700 }}>− {formatRupiah(discAmt)}</span>
              </div>
            )}
            {storeSettings.ppn_percent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>PPN {storeSettings.ppn_percent}%</span>
                <span className="mono" style={{ color: 'var(--on-surface-variant)' }}>{formatRupiah((rawTotal - discAmt) * storeSettings.ppn_percent / 100)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4 }}>
              <span className="font-headline" style={{ fontWeight: 800, fontSize: 16 }}>TOTAL</span>
              <span className="mono font-headline" style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary)' }}>{formatRupiah(total)}</span>
            </div>
          </div>

          {/* Discount */}
          {discountInfo
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#d4f4e1', border: '1px solid #1a7a3c44', borderRadius: 8 }}>
                <Icon name="sell" size={16} color="#1a7a3c" />
                <span style={{ flex: 1, fontSize: 13 }}><strong style={{ color: '#1a7a3c' }}>{discountInfo.discount.name}</strong> <span style={{ color: 'var(--outline)' }}>hemat {formatRupiah(discAmt)}</span></span>
                <button className="icon-btn" onClick={() => { setDiscountInfo(null); setDiscountCode(''); setDiscountInput(''); }}>
                  <Icon name="close" size={15} />
                </button>
              </div>
            : <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}
                  placeholder="Kode diskon (opsional)" value={discountInput}
                  onChange={e => setDiscountInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && applyDiscount()} />
                <button className="btn btn-tonal" onClick={applyDiscount} disabled={checkingDisc || !discountInput.trim()}>
                  {checkingDisc ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    : <Icon name="sell" size={18} />}
                </button>
              </div>
          }

          {/* Penting #5: Customer selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Pelanggan (opsional)</p>
            {selectedCustomer
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--primary-fixed)', borderRadius: 8 }}>
                  <Icon name="person" size={18} color="var(--primary)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedCustomer.name}</div>
                    {selectedCustomer.debt_balance > 0 && <div style={{ fontSize: 11, color: 'var(--error)' }}>Hutang: {formatRupiah(selectedCustomer.debt_balance)}</div>}
                  </div>
                  <button className="icon-btn" onClick={() => { setSelectedCustomer(null); setOnCredit(false); }}>
                    <Icon name="close" size={15} />
                  </button>
                </div>
              : <div style={{ position: 'relative' }}>
                  <Icon name="person_search" size={16} color="var(--outline)" />
                  <input className="input" style={{ paddingLeft: 34 }} placeholder="Cari nama / nomor HP pelanggan..."
                    value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                  {customerSearch && filteredCustomers.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', borderRadius: 8, zIndex: 10, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
                      {filteredCustomers.slice(0, 6).map(c => (
                        <button key={c.id} style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--outline-variant)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-container-low)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}>
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                          {c.debt_balance > 0 && <span style={{ color: 'var(--error)', fontSize: 11 }}>Hutang {formatRupiah(c.debt_balance)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
            }

            {/* Penting #5: On credit toggle */}
            {selectedCustomer && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: onCredit ? 'rgba(186,26,26,.06)' : 'var(--surface-container-low)', borderRadius: 8, cursor: 'pointer', border: `1px solid ${onCredit ? 'rgba(186,26,26,.2)' : 'var(--outline-variant)'}` }}>
                <input type="checkbox" checked={onCredit} onChange={e => setOnCredit(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--error)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: onCredit ? 'var(--error)' : 'var(--on-surface)' }}>Bayar Nanti / Kredit</div>
                  <div style={{ fontSize: 11, color: 'var(--outline)' }}>Total akan dicatat sebagai hutang {selectedCustomer.name}</div>
                </div>
              </label>
            )}
          </div>

          {/* Payment method — hide if on credit */}
          {!onCredit && (
            <>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Metode Pembayaran</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[{ id:'cash', label:t('checkout.cash'), icon:'payments' }, { id:'qris', label:t('checkout.qris'), icon:'qr_code' }, { id:'split', label:t('checkout.split'), icon:'call_split' }].map(m => (
                    <button key={m.id} onClick={() => setMethod(m.id)} style={{ padding: '10px 6px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${method === m.id ? 'var(--primary)' : 'var(--outline-variant)'}`, background: method === m.id ? 'var(--primary-fixed)' : 'var(--surface-container-low)', color: method === m.id ? 'var(--primary)' : 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 13, transition: 'all .14s' }}>
                      <Icon name={m.icon} size={18} filled /> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash */}
              {method === 'cash' && (
                <div>
                  <div className="input-group" style={{ marginBottom: 8 }}>
                    <label className="input-label">Uang Dibayar <span style={{ color: 'var(--outline)', fontWeight: 400 }}>(Alt+1~4 untuk nominal cepat)</span></label>
                    <input className="input mono" style={{ fontSize: 22, fontWeight: 800, textAlign: 'right' }}
                      type="number" placeholder="0" value={paid} onChange={e => setPaid(e.target.value)} autoFocus />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {quickAmounts.map((a, i) => (
                      <button key={a} className="btn btn-tonal" style={{ fontSize: 13 }} onClick={() => setPaid(String(a))}>
                        {formatRupiah(a)} <span style={{ fontSize:10, opacity:.6 }}>(Alt+{i+1})</span>
                      </button>
                    ))}
                  </div>
                  {paidNum >= total && (
                    <div style={{ marginTop: 10, padding: 12, background: '#d4f4e1', border: '1px solid #1a7a3c44', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#1a7a3c', fontSize: 14 }}>💰 Kembalian</span>
                      <span className="mono font-headline" style={{ fontSize: 22, fontWeight: 800, color: '#1a7a3c' }}>{formatRupiah(change)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* QRIS */}
              {method === 'qris' && (
                <div style={{ padding: 16, textAlign: 'center', background: 'var(--surface-container-low)', borderRadius: 10, border: '1px dashed var(--outline-variant)' }}>
                  {qrisImg ? (
                    <>
                      <img src={qrisImg} alt="QRIS" style={{ width: 180, height: 180, objectFit: 'contain', borderRadius: 10, margin: '0 auto 10px', border: '2px solid var(--outline-variant)' }} />
                      <div className="mono font-headline" style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>{formatRupiah(total)}</div>
                      <p style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{qrisNotes}</p>
                    </>
                  ) : (
                    <>
                      <Icon name="qr_code" size={52} color="var(--outline)" />
                      <div className="mono font-headline" style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{formatRupiah(total)}</div>
                      <p style={{ fontSize: 12, color: 'var(--outline)', marginTop: 4 }}>Upload QRIS di menu Pengaturan</p>
                    </>
                  )}
                </div>
              )}

              {/* Split */}
              {method === 'split' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: '8px 12px', background: 'var(--primary-fixed)', borderRadius: 8, fontSize: 13, color: 'var(--primary)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total harus dibayar</span><span className="mono" style={{ fontWeight: 800 }}>{formatRupiah(total)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="input-group">
                      <label className="input-label">Tunai (Rp)</label>
                      <input className="input mono" type="number" min="0" placeholder="0" value={cashAmt} onChange={e => setCashAmt(e.target.value)} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">QRIS (Rp)</label>
                      <input className="input mono" type="number" min="0" placeholder="0" value={qrisAmt} onChange={e => setQrisAmt(e.target.value)} />
                    </div>
                  </div>
                  {(cashNum + qrisNum) > 0 && (
                    <div style={{ padding: 10, background: (cashNum+qrisNum) >= total ? '#d4f4e1' : 'var(--error-container)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>Total: {formatRupiah(cashNum + qrisNum)}</span>
                      {(cashNum+qrisNum) < total && <span style={{ color: 'var(--error)' }}>Kurang {formatRupiah(total - cashNum - qrisNum)}</span>}
                      {(cashNum+qrisNum) >= total && <span style={{ color: '#1a7a3c', fontWeight: 800 }}>✓ Cukup</span>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Credit summary */}
          {onCredit && (
            <div style={{ padding: '12px 14px', background: 'rgba(186,26,26,.06)', border: '1px solid rgba(186,26,26,.2)', borderRadius: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: 'var(--error)', marginBottom: 4 }}>⚠️ Bayar Nanti / Kredit</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Akan dicatat hutang untuk</span>
                <span style={{ fontWeight: 700 }}>{selectedCustomer?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Jumlah hutang</span>
                <span className="mono" style={{ fontWeight: 800, color: 'var(--error)', fontSize: 16 }}>{formatRupiah(total)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary btn-xl" disabled={!canPay || loading} onClick={handleCheckout}
            style={{ boxShadow: canPay ? '0 4px 20px rgba(0,69,143,.3)' : 'none' }}>
            {loading ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2 }} />
              : onCredit
                ? <><Icon name="history_edu" size={20} /> Catat & Simpan Hutang</>
                : <><Icon name="check_circle" size={20} /> Konfirmasi Pembayaran</>
            }
          </button>
          <button className="btn btn-ghost w-full" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}

/* ── ReceiptSuccessModal ──────────────────────────────────────────────────── */
function ReceiptSuccessModal({ transaction, onClose }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState({});
  const [showPrint, setShowPrint] = useState(false);
  useEffect(() => { api.get('/settings').then(r => setSettings(r.data.data || {})).catch(() => {}); }, []);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Transaksi Berhasil</span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: 'center', padding: '14px 0 12px', borderBottom: '1px solid var(--outline-variant)', marginBottom: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: 20, background: '#d4f4e1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <Icon name={transaction?.on_credit ? 'history_edu' : 'check_circle'} size={34} filled />
            </div>
            <div className="font-headline" style={{ fontWeight: 800, fontSize: 17, color: '#1a7a3c' }}>
              {transaction?.on_credit ? t('checkout.debt_recorded') : t('checkout.success')}
            </div>
            <div className="mono" style={{ color: 'var(--outline)', fontSize: 12, marginTop: 3 }}>{transaction?.invoice_number}</div>
          </div>
          {transaction?.details?.map(d => (
            <div key={d.product_id || d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>{d.product_name} <span style={{ color: 'var(--outline)' }}>×{d.quantity}</span></span>
              <span className="mono">{formatRupiah(d.subtotal)}</span>
            </div>
          ))}
          <div className="divider" />
          {[
            { label: 'Total', value: formatRupiah(transaction?.total_amount), color: 'var(--primary)', big: true },
            { label: transaction?.on_credit ? 'Status' : 'Dibayar', value: transaction?.on_credit ? '🔴 Hutang' : formatRupiah(transaction?.payment_amount), color: transaction?.on_credit ? 'var(--error)' : 'var(--on-surface-variant)' },
            { label: 'Kembalian', value: formatRupiah(transaction?.change_amount), color: '#1a7a3c', big: true },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--outline)' }}>{r.label}</span>
              <span className="mono font-headline" style={{ fontWeight: 800, fontSize: r.big ? 17 : 14, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="modal-footer" style={{ gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowPrint(true)}>
            <Icon name="print" size={16} /> Cetak
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={onClose}>
            <Icon name="add_shopping_cart" size={16} /> Transaksi Baru
          </button>
        </div>
      </div>
      {showPrint && (
        <ReceiptPreview transaction={transaction} settings={settings}
          onClose={() => setShowPrint(false)}
          onPrint={w => printReceipt(transaction, settings, w)} />
      )}
    </div>
  );
}

/* ── ScannerModal ─────────────────────────────────────────────────────────── */
function ScannerModal({ onScan, onClose }) {
  const [code, setCode] = useState('');
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Scanner Barcode</span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--surface-container-low)', borderRadius: 12, padding: 28, textAlign: 'center', marginBottom: 14, border: '2px dashed var(--outline-variant)' }}>
            <Icon name="qr_code_scanner" size={48} color="var(--primary)" />
            <p style={{ fontSize: 12, color: 'var(--outline)', lineHeight: 1.6 }}>Klik kolom di bawah, lalu scan atau ketik barcode</p>
          </div>
          <input className="input mono" style={{ fontSize: 18, letterSpacing: 2 }}
            placeholder="Scan atau ketik barcode..." value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && code.trim()) onScan(code.trim()); }}
            autoFocus />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={!code.trim()} onClick={() => onScan(code.trim())}>
            <Icon name="search" size={16} /> Cari
          </button>
        </div>
      </div>
    </div>
  );
}
