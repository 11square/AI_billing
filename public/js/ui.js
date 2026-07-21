// ===== UI helpers: icons, toasts, modals, formatting =====
const Ui = {
  // ---------- formatting ----------
  fmt(n) {
    const v = parseFloat(n) || 0;
    return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  },
  fmtDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  fmtTime(d) {
    return new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // ---------- category placeholder images ----------
  catEmoji: { Coffee: '☕', Tea: '🍵', Snacks: '🍔', Desserts: '🍰', Beverages: '🥤', Bakery: '🥐', Breads: '🍞', 'Cakes & Pastries': '🎂', 'Cookies & Biscuits': '🍪' },
  placeholder(category) {
    const emoji = this.catEmoji[category] || '🍽️';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f3e5d3"/><text x="200" y="165" font-size="90" text-anchor="middle">${emoji}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  },
  imgTag(src, category, cls) {
    const ph = this.placeholder(category);
    const safe = src ? this.esc(src) : ph;
    return `<img class="${cls}" src="${safe}" loading="lazy" onerror="this.onerror=null;this.src='${ph}'" alt="">`;
  },

  // ---------- icons ----------
  icons: {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    pos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    invoices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><rect x="16" y="3" width="6" height="6" rx="1"/><path d="M19 13v8"/><path d="M22 16h-6"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'
  },
  hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      const ic = this.icons[el.dataset.icon];
      if (ic) el.innerHTML = ic;
    });
  },

  // ---------- toast ----------
  toast(msg, type = 'success') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${this.esc(msg)}`;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 3200);
  },

  // ---------- modal ----------
  modal({ title, body, foot, wide, onClose }) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal ${wide ? 'wide' : ''}">
        <div class="modal-head"><h3>${title}</h3><button class="modal-x">✕</button></div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>`;
    const close = () => { wrap.remove(); onClose && onClose(); };
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    wrap.querySelector('.modal-x').addEventListener('click', close);
    root.appendChild(wrap);
    this.hydrateIcons(wrap);
    return { el: wrap, close };
  },

  confirm(title, message, confirmLabel = 'Confirm') {
    return new Promise(resolve => {
      const m = this.modal({
        title,
        body: `<p style="color:var(--ink-2);line-height:1.6">${message}</p>`,
        foot: `<button class="btn btn-ghost" data-act="no">Cancel</button><button class="btn btn-danger" data-act="yes">${confirmLabel}</button>`
      });
      m.el.querySelector('[data-act="no"]').onclick = () => { m.close(); resolve(false); };
      m.el.querySelector('[data-act="yes"]').onclick = () => { m.close(); resolve(true); };
    });
  },

  // ---------- receipt ----------
  receiptHtml(inv) {
    const items = (inv.items || []).map(it => `
      <tr><td colspan="3">${this.esc(it.productName)}</td></tr>
      <tr>
        <td class="muted">&nbsp;&nbsp;${it.quantity} × ${this.fmt(it.unitPrice)}</td>
        <td></td>
        <td class="r-r">${this.fmt(it.totalPrice)}</td>
      </tr>`).join('');
    const payments = (inv.payments || []).map(p => `<tr><td>Paid (${this.esc(p.method).toUpperCase()})</td><td></td><td class="r-r">${this.fmt(p.amount)}</td></tr>`).join('');
    const due = parseFloat(inv.grandTotal) - parseFloat(inv.paidAmount || 0);
    return `
      <div class="receipt">
        <div class="r-center">
          <div class="r-brand">🍞 AMMAN BAKES</div>
          <div>Café &amp; Bakery</div>
          <div>Ph: 98765 43210</div>
        </div>
        <hr/>
        <table>
          <tr><td>Bill No</td><td></td><td class="r-r">${this.esc(inv.invoiceNumber)}</td></tr>
          <tr><td>Date</td><td></td><td class="r-r">${this.fmtDate(inv.created_at || Date.now())} ${this.fmtTime(inv.created_at || Date.now())}</td></tr>
          <tr><td>Customer</td><td></td><td class="r-r">${this.esc(inv.customerName || 'Walk-in')}</td></tr>
        </table>
        <hr/>
        <table>${items}</table>
        <hr/>
        <table>
          <tr><td>Subtotal</td><td></td><td class="r-r">${this.fmt(inv.subTotal)}</td></tr>
          ${parseFloat(inv.discount) > 0 ? `<tr><td>Discount</td><td></td><td class="r-r">- ${this.fmt(inv.discount)}</td></tr>` : ''}
          <tr class="r-tot"><td class="r-tot">TOTAL</td><td></td><td class="r-r r-tot">${this.fmt(inv.grandTotal)}</td></tr>
          ${payments}
          ${due > 0.009 && inv.paymentStatus !== 'cancelled' ? `<tr><td><b>BALANCE DUE</b></td><td></td><td class="r-r"><b>${this.fmt(due)}</b></td></tr>` : ''}
        </table>
        <hr/>
        <div class="r-center">Thank you! Visit again ☕</div>
      </div>`;
  },
  printReceipt(inv) {
    document.getElementById('print-area').innerHTML = this.receiptHtml(inv);
    window.print();
  },
  printHtml(html) {
    document.getElementById('print-area').innerHTML = `<div class="print-doc">${html}</div>`;
    window.print();
  }
};
