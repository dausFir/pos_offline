import { useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  ThermalReceipt — renders a receipt styled for 58mm or 80mm thermal printers
//  Call printReceipt(transaction, settings) to trigger window.print()
// ─────────────────────────────────────────────────────────────────────────────

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

const formatDateTime = (d) => {
  const dt = new Date(d);
  return dt.toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace(',', '');
};

/**
 * Prints a thermal receipt by opening a hidden iframe, injecting HTML, and calling print.
 * @param {Object} transaction  - full transaction object with .details[]
 * @param {Object} settings     - { store_name, store_address, qris_notes }
 * @param {string} paperWidth   - '58mm' | '80mm'
 */
export function printReceipt(transaction, settings = {}, paperWidth = '80mm') {
  const storeName    = settings.store_name    || 'Kasir UMKM';
  const storeAddress = settings.store_address || '';
  const receiptFooter = settings.receipt_footer || 'Terima kasih telah berbelanja!';
  const charWidth    = paperWidth === '58mm' ? 32 : 48;

  const line  = '─'.repeat(charWidth);
  const dline = '═'.repeat(charWidth);

  const padRight = (s, n) => String(s).padEnd(n);
  const padLeft  = (s, n) => String(s).padStart(n);

  const formatItemLine = (name, qty, price, sub) => {
    const nameStr  = String(name).substring(0, charWidth - 2);
    const qtyPrice = `${qty}x${formatRp(price).replace('Rp ','Rp')}`;
    const subStr   = formatRp(sub).replace('Rp ', '');
    const gap      = charWidth - qtyPrice.length - subStr.length - 2;
    return `${nameStr}\n  ${qtyPrice}${' '.repeat(Math.max(1,gap))}${subStr}`;
  };

  const labelValue = (label, value, bold = false) => {
    const gap = charWidth - label.length - value.length;
    const v   = bold ? `<b>${value}</b>` : value;
    return `<div class="row">${padRight(label, label.length)}${' '.repeat(Math.max(1,gap))}${v}</div>`;
  };

  const receiptHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Struk ${transaction.invoice_number}</title>
<style>
  @page { margin: 0; size: ${paperWidth} auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${paperWidth === '58mm' ? '10px' : '11px'};
    width: ${paperWidth};
    padding: 4mm 3mm;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: bold; }
  .big     { font-size: ${paperWidth === '58mm' ? '13px' : '15px'}; font-weight: bold; }
  .xl      { font-size: ${paperWidth === '58mm' ? '15px' : '18px'}; font-weight: bold; }
  .line    { border-top: 1px dashed #000; margin: 2mm 0; }
  .dline   { border-top: 2px solid #000; margin: 2mm 0; }
  .row     { display: flex; justify-content: space-between; margin: 1px 0; }
  .item    { margin: 1.5mm 0; }
  .item .name { font-weight: bold; word-break: break-word; }
  .item .detail { display: flex; justify-content: space-between; padding-left: 4px; color: #222; }
  .status-cancel { text-align: center; background: #000; color: #fff; padding: 1mm; font-weight: bold; letter-spacing: 2px; margin: 2mm 0; }
  .footer { text-align: center; margin-top: 3mm; font-size: 9px; }
  @media print {
    html, body { width: ${paperWidth}; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="center">
  <div class="xl">${storeName}</div>
  ${storeAddress ? `<div>${storeAddress}</div>` : ''}
</div>

<div class="dline"></div>

<div class="row"><span>No. Struk</span><span class="bold">${transaction.invoice_number}</span></div>
<div class="row"><span>Tanggal</span><span>${formatDateTime(transaction.created_at)}</span></div>
<div class="row"><span>Kasir</span><span>${transaction.username || '-'}</span></div>
<div class="row"><span>Metode</span><span class="bold">${transaction.payment_method === 'cash' ? 'TUNAI' : 'QRIS'}</span></div>

${transaction.status === 'cancelled' ? `<div class="status-cancel">*** TRANSAKSI DIBATALKAN ***</div>` : ''}

<div class="dline"></div>
<div class="bold center" style="margin-bottom:1mm;">DETAIL PEMBELIAN</div>
<div class="line"></div>

${(transaction.details || []).map(d => `
<div class="item">
  <div class="name">${d.product_name || d.name || '-'}</div>
  <div class="detail">
    <span>${d.quantity} x ${formatRp(d.unit_price)}</span>
    <span>${formatRp(d.subtotal)}</span>
  </div>
</div>`).join('')}

<div class="line"></div>

${transaction.discount_amount > 0 ? `
<div class="row"><span>Subtotal</span><span>${formatRp(transaction.total_amount + transaction.discount_amount)}</span></div>
<div class="row"><span>Diskon (${transaction.discount_code})</span><span>- ${formatRp(transaction.discount_amount)}</span></div>
` : ''}

${transaction.ppn_amount > 0 ? `
<div class="row"><span>Subtotal</span><span>${formatRp((transaction.total_amount || 0) - (transaction.ppn_amount || 0))}</span></div>
<div class="row"><span>PPN</span><span>${formatRp(transaction.ppn_amount)}</span></div>
` : ''}

<div class="dline"></div>
<div class="row">
  <span class="big">TOTAL</span>
  <span class="xl">${formatRp(transaction.total_amount)}</span>
</div>
<div class="line"></div>
<div class="row"><span>Bayar</span><span>${formatRp(transaction.payment_amount)}</span></div>
<div class="row"><span class="bold">Kembali</span><span class="bold">${formatRp(transaction.change_amount)}</span></div>
<div class="dline"></div>

<div class="footer">
  <div>${receiptFooter}</div>
  <div>Barang yang sudah dibeli</div>
  <div>tidak dapat dikembalikan</div>
  <div style="margin-top:2mm; font-size:8px; color:#555;">${new Date().toLocaleString('id-ID')}</div>
</div>

<div style="height: 10mm;"></div>

</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  
  let printed = false;
  
  iframe.onload = () => {
    if (printed) return;
    printed = true;
    
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch(e) { console.error('Print error', e); }
    
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 3000);
  };
  
  iframe.contentDocument.open();
  iframe.contentDocument.write(receiptHTML);
  iframe.contentDocument.close();
}

/**
 * ReceiptPreview — shows an on-screen preview of the thermal receipt
 */
export function ReceiptPreview({ transaction, settings = {}, paperWidth = '80mm', onClose, onPrint }) {
  const storeName    = settings.store_name    || 'Kasir UMKM';
  const storeAddress = settings.store_address || '';
  const receiptFooter = settings.receipt_footer || 'Terima kasih telah berbelanja!';

  const formatDateTime = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('id-ID', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit', second:'2-digit',
    });
  };

  const fmt = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  const isCancelled = transaction?.status === 'cancelled';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)',
        borderRadius: '16px 16px 0 0',
        display: 'flex', flexDirection: 'column',
        maxHeight: '95dvh',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🧾 Preview Struk</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onPrint('58mm')} style={btnStyle('#0f766e')}>Cetak 58mm</button>
            <button onClick={() => onPrint('80mm')} style={btnStyle('#0369a1')}>Cetak 80mm</button>
            <button onClick={onClose} style={btnStyle('#475569')}>✕</button>
          </div>
        </div>

        {/* Receipt paper */}
        <div style={{ overflow: 'auto', flex: 1, padding: '16px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            background: '#ffffff', color: '#000',
            width: paperWidth === '58mm' ? 200 : 280,
            fontFamily: "'Courier New', monospace",
            fontSize: paperWidth === '58mm' ? 10 : 11,
            padding: '10px 8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            minHeight: 400,
          }}>
            {/* Store header */}
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{storeName}</div>
              {storeAddress && <div style={{ fontSize: 10 }}>{storeAddress}</div>}
            </div>

            <div style={divider(2)} />

            <ReceiptRow label="Struk" value={transaction?.invoice_number || '-'} bold />
            <ReceiptRow label="Tgl" value={formatDateTime(transaction?.created_at)} />
            <ReceiptRow label="Kasir" value={transaction?.username || '-'} />
            <ReceiptRow label="Metode" value={transaction?.payment_method === 'cash' ? 'TUNAI' : 'QRIS'} bold />

            {isCancelled && (
              <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '3px', fontWeight: 800, letterSpacing: 2, margin: '4px 0', fontSize: 10 }}>
                *** DIBATALKAN ***
              </div>
            )}

            <div style={divider(2)} />
            <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 4, fontSize: 11 }}>DETAIL PEMBELIAN</div>
            <div style={divider(1)} />

            {(transaction?.details || []).map((d, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{d.product_name || d.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 4, color: '#333' }}>
                  <span>{d.quantity} × {fmt(d.unit_price)}</span>
                  <span>{fmt(d.subtotal)}</span>
                </div>
              </div>
            ))}

            <div style={divider(1)} />

            {transaction?.discount_amount > 0 && (
              <>
                <ReceiptRow label="Subtotal" value={fmt((transaction?.total_amount||0) + (transaction?.discount_amount||0))} />
                <ReceiptRow label={`Diskon (${transaction?.discount_code})`} value={'- '+fmt(transaction?.discount_amount)} />
              </>
            )}

            {transaction?.ppn_amount > 0 && (
              <>
                <ReceiptRow label="Subtotal" value={fmt((transaction?.total_amount||0) - (transaction?.ppn_amount||0))} />
                <ReceiptRow label="PPN" value={fmt(transaction?.ppn_amount)} />
              </>
            )}

            <div style={divider(2)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: 13 }}>TOTAL</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{fmt(transaction?.total_amount)}</span>
            </div>
            <div style={divider(1)} />
            <ReceiptRow label="Bayar" value={fmt(transaction?.payment_amount)} />
            <ReceiptRow label="Kembali" value={fmt(transaction?.change_amount)} bold />
            <div style={divider(2)} />

            <div style={{ textAlign: 'center', fontSize: 9, color: '#444', marginTop: 6 }}>
              <div>{receiptFooter}</div>
              <div>Barang yang sudah dibeli</div>
              <div>tidak dapat dikembalikan</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

function divider(weight) {
  return { borderTop: `${weight}px ${weight > 1 ? 'solid' : 'dashed'} #000`, margin: '4px 0' };
}

function btnStyle(bg) {
  return {
    background: bg, color: '#fff', border: 'none',
    borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
  };
}
