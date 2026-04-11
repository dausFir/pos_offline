import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatRupiah } from '../utils/api';
import { useI18n } from '../context/I18nContext';
import Icon from './Icon';

export default function GlobalSearch() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState({ products: [], transactions: [], customers: [] });
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const timeout  = useRef(null);

  // Ctrl+K or / to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
    else { setQuery(''); setResults({ products: [], transactions: [], customers: [] }); }
  }, [open]);

  const search = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) {
      setResults({ products: [], transactions: [], customers: [] });
      return;
    }
    setLoading(true);
    try {
      const [pRes, tRes, cRes] = await Promise.all([
        api.get('/products',     { params: { search: q, limit: 5 } }),
        api.get('/transactions', { params: { search: q, limit: 5 } }),
        api.get('/customers',    { params: { search: q, limit: 5 } }),
      ]);
      setResults({
        products:     pRes.data.data || [],
        transactions: tRes.data.data || [],
        customers:    cRes.data.data || [],
      });
      setActiveIdx(0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout.current);
  }, [query, search]);

  const allItems = [
    ...results.products.map(p => ({ type: 'product', label: p.name, sub: p.barcode_sku, right: formatRupiah(p.sell_price), path: '/products', icon: 'inventory_2' })),
    ...results.transactions.map(t => ({ type: 'transaction', label: t.invoice_number, sub: t.username, right: formatRupiah(t.total_amount), path: '/transactions', icon: 'receipt_long' })),
    ...results.customers.map(c => ({ type: 'customer', label: c.name, sub: c.phone, right: c.debt_balance > 0 ? `Hutang: ${formatRupiah(c.debt_balance)}` : '', path: '/customers', icon: 'group' })),
  ];

  const go = (item) => {
    navigate(item.path);
    setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && allItems[activeIdx]) go(allItems[activeIdx]);
  };

  const SECTION_LABELS = { product: 'Produk', transaction: 'Transaksi', customer: 'Pelanggan' };
  let lastType = null;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--surface-container)', border: '1px solid var(--outline-variant)', borderRadius: 100, cursor: 'pointer', fontSize: 13, color: 'var(--outline)', transition: 'all .12s' }}
        title="Pencarian global (Ctrl+K)">
        <Icon name="search" size={15} />
        <span>Cari... <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--outline-variant)', background: 'var(--surface-container-high)', color: 'var(--outline)' }}>Ctrl K</kbd></span>
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}
      onClick={() => setOpen(false)}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.18)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--outline-variant)' }}>
          {loading
            ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, flexShrink: 0 }} />
            : <Icon name="search" size={18} color="var(--outline)" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Cari produk, invoice, pelanggan..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--on-surface)', fontFamily: 'Inter, sans-serif' }}
          />
          <button onClick={() => setOpen(false)} className="icon-btn">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {query.length < 2 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--outline)', fontSize: 13 }}>
              Ketik minimal 2 karakter untuk mencari
            </div>
          ) : allItems.length === 0 && !loading ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--outline)', fontSize: 13 }}>
              <Icon name="search" size={32} color="var(--outline)" />
              <div style={{ marginTop: 8 }}>Tidak ada hasil untuk "<strong>{query}</strong>"</div>
            </div>
          ) : (
            allItems.map((item, idx) => {
              const showHeader = item.type !== lastType;
              lastType = item.type;
              return (
                <div key={`${item.type}-${idx}`}>
                  {showHeader && (
                    <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                      {SECTION_LABELS[item.type]}
                    </div>
                  )}
                  <button onClick={() => go(item)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .1s', background: idx === activeIdx ? 'var(--primary-fixed)' : 'transparent' }}
                    onMouseEnter={() => setActiveIdx(idx)}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: idx === activeIdx ? 'var(--primary)' : 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={item.icon} size={16} color={idx === activeIdx ? '#fff' : 'var(--on-surface-variant)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                      {item.sub && <div style={{ fontSize: 11, color: 'var(--outline)' }}>{item.sub}</div>}
                    </div>
                    {item.right && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{item.right}</div>}
                    <Icon name="arrow_forward" size={14} color="var(--outline)" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--outline-variant)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--outline)' }}>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--outline-variant)', background: 'var(--surface-container)' }}>↑↓</kbd> navigasi</span>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--outline-variant)', background: 'var(--surface-container)' }}>Enter</kbd> buka</span>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--outline-variant)', background: 'var(--surface-container)' }}>Esc</kbd> tutup</span>
        </div>
      </div>
    </div>
  );
}
